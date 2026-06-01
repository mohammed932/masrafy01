import { Injectable } from '@nestjs/common';
import { LoanCategory, ScoringWeightSetStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringRepository } from './scoring.repository';
import type {
  CreateScoringFactorDto,
  RejectWeightsDto,
  UpsertWeightsDraftDto,
} from './dto/scoring.dto';

export interface ScoringRequestContext {
  sourceIp: string | null;
  correlationId: string;
}

@Injectable()
export class ScoringService {
  constructor(
    private readonly repo: ScoringRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  // ---- Factors ------------------------------------------------------------
  listFactors(category: LoanCategory) {
    return this.repo.activeFactors(category);
  }

  createFactor(dto: CreateScoringFactorDto) {
    return this.repo.createFactor({
      category: dto.category,
      code: dto.code,
      kind: dto.kind ?? 'DIRECT',
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      description: dto.description ?? null,
      sourceQuestionCode: dto.sourceQuestionCode ?? null,
    });
  }

  // ---- Weight sets (maker-checker) ----------------------------------------
  async getProgramWeights(programId: string) {
    const [active, draft, pending] = await Promise.all([
      this.repo.activeSet(programId),
      this.repo.findByStatus(programId, ScoringWeightSetStatus.DRAFT),
      this.repo.findByStatus(programId, ScoringWeightSetStatus.PENDING_APPROVAL),
    ]);
    return { active, draft, pending };
  }

  async upsertDraft(programId: string, dto: UpsertWeightsDraftDto, makerId: string) {
    const category = await this.repo.programCategory(programId);
    if (!category) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    await this.assertKnownFactors(category, dto.weights);

    const existing = await this.repo.findByStatus(programId, ScoringWeightSetStatus.DRAFT);
    const weights = dto.weights as unknown as Prisma.InputJsonValue;
    if (existing) {
      return this.repo.updateSet(existing.id, { weights, createdBy: makerId });
    }
    const versionNumber = await this.repo.nextVersionNumber(programId);
    return this.repo.createSet({
      bankProgramId: programId,
      status: ScoringWeightSetStatus.DRAFT,
      versionNumber,
      weights,
      createdBy: makerId,
    });
  }

  async submit(programId: string, makerId: string, ctx: ScoringRequestContext) {
    const draft = await this.repo.findByStatus(programId, ScoringWeightSetStatus.DRAFT);
    if (!draft) throw new DomainException(ERROR_CODES.WEIGHT_SET_NOT_DRAFT);
    const category = await this.repo.programCategory(programId);
    if (!category) throw new DomainException(ERROR_CODES.BANK_PROGRAM_INVALID);
    const weights = draft.weights as Record<string, number>;
    await this.assertKnownFactors(category, weights);
    this.assertSums100(weights);

    const updated = await this.repo.updateSet(draft.id, {
      status: ScoringWeightSetStatus.PENDING_APPROVAL,
      createdBy: makerId,
    });
    await this.audit.write({
      actorId: makerId,
      targetId: draft.id,
      eventType: AuditEventType.SCORING_WEIGHTS_SUBMITTED,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
      payload: { bankProgramId: programId, weightSetId: draft.id },
    });
    return updated;
  }

  async approve(setId: string, approverId: string, ctx: ScoringRequestContext) {
    const set = await this.repo.findSet(setId);
    if (!set) throw new DomainException(ERROR_CODES.WEIGHT_SET_NOT_FOUND);
    if (set.status !== ScoringWeightSetStatus.PENDING_APPROVAL) {
      throw new DomainException(ERROR_CODES.WEIGHT_SET_NOT_PENDING);
    }
    if (set.createdBy === approverId) {
      throw new DomainException(ERROR_CODES.APPROVER_MUST_DIFFER_FROM_MAKER);
    }
    const activated = await this.repo.approveTx({
      setId,
      programId: set.bankProgramId,
      approvedBy: approverId,
    });
    await this.audit.write({
      actorId: approverId,
      targetId: setId,
      eventType: AuditEventType.SCORING_WEIGHTS_APPROVED,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
      payload: { bankProgramId: set.bankProgramId, weightSetId: setId, makerId: set.createdBy },
    });
    return activated;
  }

  async reject(setId: string, approverId: string, dto: RejectWeightsDto, ctx: ScoringRequestContext) {
    const set = await this.repo.findSet(setId);
    if (!set) throw new DomainException(ERROR_CODES.WEIGHT_SET_NOT_FOUND);
    if (set.status !== ScoringWeightSetStatus.PENDING_APPROVAL) {
      throw new DomainException(ERROR_CODES.WEIGHT_SET_NOT_PENDING);
    }
    const updated = await this.repo.updateSet(setId, {
      status: ScoringWeightSetStatus.REJECTED,
      rejectedReason: dto.reason,
    });
    await this.audit.write({
      actorId: approverId,
      targetId: setId,
      eventType: AuditEventType.SCORING_WEIGHTS_REJECTED,
      sourceIp: ctx.sourceIp,
      correlationId: ctx.correlationId,
      payload: { bankProgramId: set.bankProgramId, weightSetId: setId, reason: dto.reason },
    });
    return updated;
  }

  history(programId: string) {
    return this.repo.listByProgram(programId);
  }

  pendingInbox() {
    return this.repo.listPending();
  }

  // ---- Validation ---------------------------------------------------------
  private async assertKnownFactors(
    category: LoanCategory,
    weights: Record<string, number>,
  ): Promise<void> {
    const valid = new Set((await this.repo.activeFactors(category)).map((f) => f.code));
    for (const code of Object.keys(weights)) {
      if (!valid.has(code)) {
        throw new DomainException(ERROR_CODES.WEIGHTS_UNKNOWN_FACTOR, { factorCode: code });
      }
    }
  }

  private assertSums100(weights: Record<string, number>): void {
    const total = Object.values(weights).reduce((a, b) => a + Number(b), 0);
    if (Math.round(total * 1000) / 1000 !== 100) {
      throw new DomainException(ERROR_CODES.WEIGHTS_MUST_SUM_TO_100, { total });
    }
  }
}
