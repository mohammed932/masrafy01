import { Injectable } from '@nestjs/common';
import { Prisma, type OnboardingScreen } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Domain row returned to services / controllers — keeps Prisma's
 * `OnboardingScreen` row type confined to this repository
 * (Constitution Principle X / A8).
 */
export interface OnboardingScreenRow {
  id: string;
  order: number;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageS3Key: string | null;
  active: boolean;
}

export interface CreateOnboardingScreenInput {
  order: number;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageS3Key: string | null;
  updatedBy: string;
}

export interface UpdateOnboardingScreenPatch {
  titleAr?: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  imageS3Key?: string | null;
  active?: boolean;
  updatedBy: string;
}

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<OnboardingScreenRow[]> {
    const rows = await this.prisma.onboardingScreen.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });
    return rows.map(toOnboardingRow);
  }

  async listAll(): Promise<OnboardingScreenRow[]> {
    const rows = await this.prisma.onboardingScreen.findMany({
      orderBy: { order: 'asc' },
    });
    return rows.map(toOnboardingRow);
  }

  async findById(id: string): Promise<OnboardingScreenRow | null> {
    const row = await this.prisma.onboardingScreen.findUnique({ where: { id } });
    return row ? toOnboardingRow(row) : null;
  }

  async create(input: CreateOnboardingScreenInput): Promise<OnboardingScreenRow> {
    const row = await this.prisma.onboardingScreen.create({ data: input });
    return toOnboardingRow(row);
  }

  async update(id: string, patch: UpdateOnboardingScreenPatch): Promise<OnboardingScreenRow> {
    const row = await this.prisma.onboardingScreen.update({ where: { id }, data: patch });
    return toOnboardingRow(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.onboardingScreen.delete({ where: { id } });
  }

  async reorder(
    items: ReadonlyArray<{ id: string; order: number }>,
    actorStaffId: string,
  ): Promise<OnboardingScreenRow[]> {
    const rows = await this.prisma.$transaction(async (tx) => {
      // Two-phase: bump all ordered rows into a temp range to dodge the unique
      // constraint, then write final values.
      const tempOffset = 1_000_000;
      for (const item of items) {
        await tx.onboardingScreen.update({
          where: { id: item.id },
          data: { order: tempOffset + item.order, updatedBy: actorStaffId },
        });
      }
      for (const item of items) {
        await tx.onboardingScreen.update({
          where: { id: item.id },
          data: { order: item.order, updatedBy: actorStaffId },
        });
      }
      return tx.onboardingScreen.findMany({ orderBy: { order: 'asc' } });
    });
    return rows.map(toOnboardingRow);
  }

  isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}

// ---- Boundary mapper -----------------------------------------------------

function toOnboardingRow(row: OnboardingScreen): OnboardingScreenRow {
  return {
    id: row.id,
    order: row.order,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    bodyAr: row.bodyAr,
    bodyEn: row.bodyEn,
    imageS3Key: row.imageS3Key,
    active: row.active,
  };
}
