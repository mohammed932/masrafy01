import { Injectable } from '@nestjs/common';
import { Prisma, OnboardingScreen } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

@Injectable()
export class OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<OnboardingScreen[]> {
    return this.prisma.onboardingScreen.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });
  }

  async listAll(): Promise<OnboardingScreen[]> {
    return this.prisma.onboardingScreen.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string): Promise<OnboardingScreen | null> {
    return this.prisma.onboardingScreen.findUnique({ where: { id } });
  }

  async create(
    input: Pick<
      OnboardingScreen,
      'order' | 'titleAr' | 'titleEn' | 'bodyAr' | 'bodyEn' | 'imageS3Key' | 'updatedBy'
    >,
  ): Promise<OnboardingScreen> {
    return this.prisma.onboardingScreen.create({ data: input });
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        OnboardingScreen,
        'titleAr' | 'titleEn' | 'bodyAr' | 'bodyEn' | 'imageS3Key' | 'active' | 'updatedBy'
      >
    >,
  ): Promise<OnboardingScreen> {
    return this.prisma.onboardingScreen.update({ where: { id }, data: patch });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.onboardingScreen.delete({ where: { id } });
  }

  async reorder(
    items: ReadonlyArray<{ id: string; order: number }>,
    actorStaffId: string,
  ): Promise<OnboardingScreen[]> {
    return this.prisma.$transaction(async (tx) => {
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
  }

  isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
