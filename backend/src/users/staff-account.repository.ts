import { Injectable } from '@nestjs/common';
import { Prisma, StaffRole, type StaffAccount } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  DuplicateEntryException,
  NotFoundException,
  SuperAdminFloorViolatedException,
} from '@/common/errors/domain.exceptions';

export interface StaffAccountForLogin {
  id: string;
  email: string;
  emailDisplay: string;
  name: string;
  passwordHash: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export type StaffAccountSummary = Omit<StaffAccount, 'passwordHash'>;

export interface CreateStaffInput {
  rawEmail: string;
  name: string;
  role: StaffRole;
  passwordHash: string;
  mustChangePassword?: boolean;
}

export interface UpdateMetaInput {
  name?: string;
}

export interface RoleAndActivePatch {
  role?: StaffRole;
  isActive?: boolean;
}

export interface PaginatedStaff {
  rows: readonly StaffAccountSummary[];
  total: number;
}

export function canonicaliseEmail(raw: string): { email: string; display: string } {
  const display = raw.trim();
  const email = display.normalize('NFKC').toLowerCase();
  return { email, display };
}

function toForLogin(row: StaffAccount): StaffAccountForLogin {
  return {
    id: row.id,
    email: row.email,
    emailDisplay: row.emailDisplay,
    name: row.name,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
  };
}

function stripPassword(row: StaffAccount): StaffAccountSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...rest } = row;
  return rest;
}

@Injectable()
export class StaffAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Reads --------------------------------------------------------------

  async findForLogin(canonicalEmail: string): Promise<StaffAccountForLogin | null> {
    const row = await this.prisma.staffAccount.findUnique({
      where: { email: canonicalEmail },
    });
    return row ? toForLogin(row) : null;
  }

  async findForLoginById(id: string): Promise<StaffAccountForLogin | null> {
    const row = await this.prisma.staffAccount.findUnique({ where: { id } });
    return row ? toForLogin(row) : null;
  }

  async findById(id: string): Promise<StaffAccountSummary | null> {
    const row = await this.prisma.staffAccount.findUnique({ where: { id } });
    return row ? stripPassword(row) : null;
  }

  async list(page: number, pageSize: number): Promise<PaginatedStaff> {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.staffAccount.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.staffAccount.count(),
    ]);
    return { rows: rows.map(stripPassword), total };
  }

  // ---- Writes --------------------------------------------------------------

  async updateLastLogin(id: string, when: Date = new Date()): Promise<void> {
    await this.prisma.staffAccount.update({
      where: { id },
      data: { lastLoginAt: when },
    });
  }

  /**
   * Create a staff account with canonicalised email. Duplicate-email collisions
   * (including Unicode/casing/whitespace differences) surface as
   * `DuplicateEntryException` with `meta: { field: 'email' }`.
   */
  async create(input: CreateStaffInput): Promise<StaffAccountSummary> {
    const { email, display } = canonicaliseEmail(input.rawEmail);
    try {
      const row = await this.prisma.staffAccount.create({
        data: {
          email,
          emailDisplay: display,
          name: input.name.trim(),
          role: input.role,
          passwordHash: input.passwordHash,
          isActive: true,
          mustChangePassword: input.mustChangePassword ?? true,
        },
      });
      return stripPassword(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateEntryException('email');
      }
      throw err;
    }
  }

  /**
   * Mutate fields that DO NOT affect the active-super_admin floor (currently:
   * just `name`). Returns updated summary.
   */
  async updateMeta(id: string, patch: UpdateMetaInput): Promise<StaffAccountSummary> {
    try {
      const row = await this.prisma.staffAccount.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        },
      });
      return stripPassword(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException();
      }
      throw err;
    }
  }

  /**
   * Mutate `role` and/or `isActive` under a SERIALIZABLE transaction with the
   * post-mutation super_admin floor check (FR-023). Retries once on Postgres
   * serialization failure (40001 / Prisma P2034) per research R-007. If the
   * mutation would leave 0 active super_admins, the tx rolls back and the
   * caller receives `SuperAdminFloorViolatedException`.
   *
   * On deactivation, also revokes all of the target's refresh tokens in the
   * same tx (data-model invariant #2).
   */
  async updateRoleAndActiveTx(id: string, patch: RoleAndActivePatch): Promise<StaffAccountSummary> {
    const run = async (): Promise<StaffAccountSummary> =>
      this.prisma.runSerializable(async (tx) => {
        const current = await tx.staffAccount.findUnique({ where: { id } });
        if (!current) throw new NotFoundException();

        const updated = await tx.staffAccount.update({
          where: { id },
          data: {
            ...(patch.role !== undefined ? { role: patch.role } : {}),
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
          },
        });

        if (patch.isActive === false) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        const activeSuperAdmins = await tx.staffAccount.count({
          where: { role: StaffRole.super_admin, isActive: true },
        });
        if (activeSuperAdmins < 1) {
          throw new SuperAdminFloorViolatedException();
        }

        return stripPassword(updated);
      });

    return run();
  }

  /**
   * Reset another user's password: set hash, force change on next login,
   * revoke all of the target's refresh tokens. Single transaction
   * (data-model invariant #3).
   */
  async resetPasswordTx(args: { targetId: string; newPasswordHash: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.staffAccount.findUnique({ where: { id: args.targetId } });
      if (!found) throw new NotFoundException();
      await tx.staffAccount.update({
        where: { id: args.targetId },
        data: {
          passwordHash: args.newPasswordHash,
          mustChangePassword: true,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: args.targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Self password change (called from AuthService.changePassword). Sets the
   * new hash, clears mustChangePassword, revokes all refresh tokens. Caller
   * passes a fresh bcrypt hash.
   */
  async updatePasswordAndClearMcpTx(args: {
    userId: string;
    newPasswordHash: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffAccount.update({
        where: { id: args.userId },
        data: {
          passwordHash: args.newPasswordHash,
          mustChangePassword: false,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: args.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
