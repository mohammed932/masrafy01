import { Injectable } from '@nestjs/common';
import {
  LoanCategory,
  Prisma,
  ScoringWeightSetStatus,
} from '@prisma/client';
import type { ScoringFactor, ScoringWeightSet } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** Scoring data access (Constitution Principle X). */
@Injectable()
export class ScoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Factors ------------------------------------------------------------
  activeFactors(category: LoanCategory): Promise<ScoringFactor[]> {
    return this.prisma.scoringFactor.findMany({
      where: { category, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  createFactor(data: Prisma.ScoringFactorUncheckedCreateInput): Promise<ScoringFactor> {
    return this.prisma.scoringFactor.create({ data });
  }

  // ---- Bank program lookup ------------------------------------------------
  async programCategory(programId: string): Promise<LoanCategory | null> {
    const row = await this.prisma.bankProgram.findUnique({
      where: { id: programId },
      select: { productCategory: true },
    });
    if (!row) return null;
    const v = row.productCategory.toLowerCase();
    return (Object.values(LoanCategory) as string[]).includes(v) ? (v as LoanCategory) : null;
  }

  // ---- Weight sets --------------------------------------------------------
  findSet(id: string): Promise<ScoringWeightSet | null> {
    return this.prisma.scoringWeightSet.findUnique({ where: { id } });
  }

  findByStatus(
    programId: string,
    status: ScoringWeightSetStatus,
  ): Promise<ScoringWeightSet | null> {
    return this.prisma.scoringWeightSet.findFirst({ where: { bankProgramId: programId, status } });
  }

  activeSet(programId: string): Promise<ScoringWeightSet | null> {
    return this.findByStatus(programId, ScoringWeightSetStatus.ACTIVE);
  }

  listByProgram(programId: string): Promise<ScoringWeightSet[]> {
    return this.prisma.scoringWeightSet.findMany({
      where: { bankProgramId: programId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  listPending(): Promise<ScoringWeightSet[]> {
    return this.prisma.scoringWeightSet.findMany({
      where: { status: ScoringWeightSetStatus.PENDING_APPROVAL },
      orderBy: { createdAt: 'asc' },
    });
  }

  async nextVersionNumber(programId: string): Promise<number> {
    const last = await this.prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: programId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  createSet(data: Prisma.ScoringWeightSetUncheckedCreateInput): Promise<ScoringWeightSet> {
    return this.prisma.scoringWeightSet.create({ data });
  }

  updateSet(id: string, data: Prisma.ScoringWeightSetUpdateInput): Promise<ScoringWeightSet> {
    return this.prisma.scoringWeightSet.update({ where: { id }, data });
  }

  /** Atomic: archive prior ACTIVE for the program, activate the approved set. */
  approveTx(args: {
    setId: string;
    programId: string;
    approvedBy: string;
  }): Promise<ScoringWeightSet> {
    return this.prisma.$transaction(async (tx) => {
      await tx.scoringWeightSet.updateMany({
        where: { bankProgramId: args.programId, status: ScoringWeightSetStatus.ACTIVE },
        data: { status: ScoringWeightSetStatus.ARCHIVED },
      });
      return tx.scoringWeightSet.update({
        where: { id: args.setId },
        data: {
          status: ScoringWeightSetStatus.ACTIVE,
          approvedBy: args.approvedBy,
          approvedAt: new Date(),
        },
      });
    });
  }
}
