import { Injectable } from '@nestjs/common';
import { Prisma, ScoringWeightSetStatus } from '@prisma/client';
import type { ScoringWeightSet } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** Scoring data access (Constitution Principle X). */
@Injectable()
export class ScoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Weight sets --------------------------------------------------------
  activeSet(programId: string): Promise<ScoringWeightSet | null> {
    return this.prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: programId, status: ScoringWeightSetStatus.ACTIVE },
    });
  }

  listByProgram(programId: string): Promise<ScoringWeightSet[]> {
    return this.prisma.scoringWeightSet.findMany({
      where: { bankProgramId: programId },
      orderBy: { versionNumber: 'desc' },
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

  /**
   * Direct save (Constitution V v5.0.0, no maker-checker): atomically archive the
   * program's prior ACTIVE set and activate a freshly versioned one. The editor's
   * id is recorded on both `createdBy` and `approvedBy` for the audit trail.
   */
  saveActiveTx(args: {
    programId: string;
    versionNumber: number;
    weights: Prisma.InputJsonValue;
    editorId: string;
  }): Promise<ScoringWeightSet> {
    return this.prisma.$transaction(async (tx) => {
      await tx.scoringWeightSet.updateMany({
        where: { bankProgramId: args.programId, status: ScoringWeightSetStatus.ACTIVE },
        data: { status: ScoringWeightSetStatus.ARCHIVED },
      });
      return tx.scoringWeightSet.create({
        data: {
          bankProgramId: args.programId,
          status: ScoringWeightSetStatus.ACTIVE,
          versionNumber: args.versionNumber,
          weights: args.weights,
          createdBy: args.editorId,
          approvedBy: args.editorId,
          approvedAt: new Date(),
        },
      });
    });
  }
}
