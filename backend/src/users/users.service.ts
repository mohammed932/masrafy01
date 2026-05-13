import { Injectable } from '@nestjs/common';
import { AuditEventType, StaffRole, type Prisma } from '@prisma/client';
import { CannotSelfModifyException, NotFoundException } from '@/common/errors/domain.exceptions';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { PasswordService } from '@/auth/password.service';
import {
  StaffAccountRepository,
  type StaffAccountSummary,
  type RoleAndActivePatch,
} from './staff-account.repository';
import type { CreateStaffRequestDto } from './dto/create-staff.request.dto';
import type { UpdateStaffRequestDto } from './dto/update-staff.request.dto';

export interface ActionContext {
  actorId: string;
  sourceIp: string | null;
  correlationId: string;
}

export interface ListArgs {
  page: number;
  pageSize: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly accounts: StaffAccountRepository,
    private readonly password: PasswordService,
    private readonly audit: AuditEventWriter,
  ) {}

  // ---- Create -------------------------------------------------------------

  async create(input: CreateStaffRequestDto, ctx: ActionContext): Promise<StaffAccountSummary> {
    await this.password.validatePolicy(input.initialPassword);
    const passwordHash = await this.password.hash(input.initialPassword);
    const created = await this.accounts.create({
      rawEmail: input.email,
      name: input.name,
      role: input.role as StaffRole,
      passwordHash,
      mustChangePassword: true,
    });
    await this.audit.write({
      actorId: ctx.actorId,
      targetId: created.id,
      eventType: AuditEventType.ADMIN_USER_CREATED,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
      payload: { targetEmail: created.email, targetRole: created.role },
    });
    return created;
  }

  // ---- Read ---------------------------------------------------------------

  async list(args: ListArgs): Promise<{ rows: readonly StaffAccountSummary[]; total: number }> {
    return this.accounts.list(args.page, args.pageSize);
  }

  async getById(id: string): Promise<StaffAccountSummary> {
    const row = await this.accounts.findById(id);
    if (!row) throw new NotFoundException();
    return row;
  }

  // ---- Update -------------------------------------------------------------

  async update(
    targetId: string,
    patch: UpdateStaffRequestDto,
    ctx: ActionContext,
  ): Promise<StaffAccountSummary> {
    // FR-022: self-modify of role or isActive is forbidden.
    if (targetId === ctx.actorId && (patch.role !== undefined || patch.isActive !== undefined)) {
      throw new CannotSelfModifyException();
    }

    const before = await this.accounts.findById(targetId);
    if (!before) throw new NotFoundException();

    const changedFields: string[] = [];
    if (patch.name !== undefined && patch.name !== before.name) changedFields.push('name');
    if (patch.role !== undefined && patch.role !== before.role) changedFields.push('role');
    if (patch.isActive !== undefined && patch.isActive !== before.isActive) {
      changedFields.push('isActive');
    }

    let updated: StaffAccountSummary;
    if (patch.role !== undefined || patch.isActive !== undefined) {
      const rolePatch: RoleAndActivePatch = {};
      if (patch.role !== undefined) rolePatch.role = patch.role;
      if (patch.isActive !== undefined) rolePatch.isActive = patch.isActive;
      updated = await this.accounts.updateRoleAndActiveTx(targetId, rolePatch);
      if (patch.name !== undefined && patch.name !== before.name) {
        updated = await this.accounts.updateMeta(targetId, { name: patch.name });
      }
    } else {
      updated = await this.accounts.updateMeta(targetId, { name: patch.name });
    }

    if (changedFields.length > 0) {
      await this.audit.write({
        actorId: ctx.actorId,
        targetId,
        eventType: AuditEventType.ADMIN_USER_UPDATED,
        sourceIp: ctx.sourceIp,
        correlationId: ctx.correlationId,
        payload: { changedFields } as Prisma.JsonObject,
      });
    }

    if (patch.role !== undefined && patch.role !== before.role) {
      await this.audit.write({
        actorId: ctx.actorId,
        targetId,
        eventType: AuditEventType.ADMIN_USER_ROLE_CHANGED,
        sourceIp: ctx.sourceIp,
        correlationId: ctx.correlationId,
        payload: { fromRole: before.role, toRole: patch.role },
      });
    }
    if (patch.isActive === false && before.isActive) {
      await this.audit.write({
        actorId: ctx.actorId,
        targetId,
        eventType: AuditEventType.ADMIN_USER_DEACTIVATED,
        sourceIp: ctx.sourceIp,
        correlationId: ctx.correlationId,
      });
    }

    return updated;
  }

  // ---- Reset password -----------------------------------------------------

  async resetPassword(targetId: string, newPassword: string, ctx: ActionContext): Promise<void> {
    if (targetId === ctx.actorId) {
      // Users self-change via /auth/password — never via /users/:id/password.
      throw new CannotSelfModifyException();
    }
    const target = await this.accounts.findById(targetId);
    if (!target) throw new NotFoundException();

    await this.password.validatePolicy(newPassword);
    const newPasswordHash = await this.password.hash(newPassword);
    await this.accounts.resetPasswordTx({ targetId, newPasswordHash });

    await this.audit.write({
      actorId: ctx.actorId,
      targetId,
      eventType: AuditEventType.ADMIN_USER_PASSWORD_RESET,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
    });
  }
}
