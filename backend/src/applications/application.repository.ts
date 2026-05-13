/**
 * Application repository — thin Prisma data-access layer.
 * Constitution Principle X: services NEVER touch Prisma directly.
 *
 * Writes use a single $transaction (Application + BankOffers + AuditEvents) so
 * an offer-creation failure cannot leave an orphan application row.
 */

import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type ApplicationPriority,
  type ApplicationStatus,
  type ApprovalTier,
  type LeadStatus,
} from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

export type LeadListFilter =
  | 'needs_first_contact'
  | 'stale'
  | 'recent'
  | 'followup_today'
  | 'docs_in_progress'
  | 'ready_for_submission'
  | 'submitted_to_bank';

export interface ApplicationListItemAggregates {
  lastActivityType: string | null;
  lastActivityOccurredAt: string | null;
  activityCount: number;
  isStale: boolean;
  hasOverdueFollowUp: boolean;
  pendingFollowUpCount: number;
}

export interface CreateApplicationInput {
  mobileClientId: string;
  submissionCorrelationId: string;
  idempotencyKey?: string | null;
  payloadHash?: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  requestedAmountEGP: Prisma.Decimal;
  requestedCurrency: string;
  preferredTenorMonths: number;
  loanPurpose: string;
  age: number;
  isGuest: boolean;
  applicantProfile: Prisma.InputJsonValue;
  summary: Prisma.InputJsonValue;
  noMatchSummary?: Prisma.InputJsonValue;
  engineDurationMs?: number;
  programsCheckedCount: number;
  eligibleProgramsCount: number;
}

export interface CreateBankOfferInput {
  programCode: string;
  programVersion: number;
  bankName: string;
  programFriendlyName: string;
  currency: string;
  effectiveRatePercent: Prisma.Decimal;
  monthlyInstallmentEGP: Prisma.Decimal;
  requestedLoanAmountEGP: Prisma.Decimal;
  effectiveLoanAmountEGP: Prisma.Decimal;
  requestedTenorMonths: number;
  effectiveTenorMonths: number;
  feesBreakdown: Prisma.InputJsonValue;
  approvalProbabilityPercent: Prisma.Decimal;
  approvalScore: number;
  approvalTier: ApprovalTier;
  approvalFactors: Prisma.InputJsonValue;
  engineVersion: string;
  requiredDocuments: string[];
  matchReasons: string[];
  cascadeTrace: Prisma.InputJsonValue;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
  maxLoanAvailableEGP?: Prisma.Decimal | null;
}

export interface PersistMatchInput {
  application: CreateApplicationInput;
  offers: CreateBankOfferInput[];
  txCallback?: (tx: Prisma.TransactionClient, applicationId: string) => Promise<void>;
}

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persistMatch(input: PersistMatchInput): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({ data: input.application });
      if (input.offers.length > 0) {
        await tx.bankOffer.createMany({
          data: input.offers.map((o) => ({ ...o, applicationId: created.id })),
        });
      }
      if (input.txCallback) {
        await input.txCallback(tx, created.id);
      }
      return created.id;
    });
  }

  async findById(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      include: { bankOffers: { where: { erasedAt: null }, orderBy: { createdAt: 'asc' } } },
    });
  }

  async findByIdempotencyKey(mobileClientId: string, idempotencyKey: string) {
    return this.prisma.application.findFirst({
      where: { mobileClientId, idempotencyKey },
      include: { bankOffers: { where: { erasedAt: null } } },
    });
  }

  async findManyAdmin(params: {
    status?: ApplicationStatus[];
    loanPurpose?: string;
    tier?: 'high' | 'medium' | 'needs_coaching';
    leadFilter?: LeadListFilter;
    assignedAgentStaffId?: string;
    cursor?: string;
    limit?: number;
  }) {
    const where: Prisma.ApplicationWhereInput = {};
    if (params.status?.length) where.status = { in: params.status };
    if (params.loanPurpose) where.loanPurpose = params.loanPurpose;
    if (params.assignedAgentStaffId) where.assignedAgentStaffId = params.assignedAgentStaffId;

    if (params.tier === 'high') {
      where.bankOffers = { some: { approvalTier: 'excellent', erasedAt: null } };
    } else if (params.tier === 'medium') {
      where.AND = [
        { bankOffers: { some: { approvalTier: 'good', erasedAt: null } } },
        { bankOffers: { none: { approvalTier: 'excellent', erasedAt: null } } },
      ];
    } else if (params.tier === 'needs_coaching') {
      where.OR = [
        { status: 'no_match' },
        {
          AND: [
            {
              bankOffers: {
                some: { approvalTier: { in: ['moderate', 'low', 'very_low'] }, erasedAt: null },
              },
            },
            {
              bankOffers: { none: { approvalTier: { in: ['excellent', 'good'] }, erasedAt: null } },
            },
          ],
        },
      ];
    }

    const stale48hCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const last24hCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (params.leadFilter === 'needs_first_contact') {
      where.leadStatus = 'needs_first_contact';
    } else if (params.leadFilter === 'docs_in_progress') {
      where.leadStatus = 'document_collection';
    } else if (params.leadFilter === 'ready_for_submission') {
      where.leadStatus = 'ready_for_submission';
    } else if (params.leadFilter === 'submitted_to_bank') {
      where.leadStatus = 'submitted_to_bank';
    } else if (params.leadFilter === 'recent') {
      where.activities = { some: { occurredAt: { gte: last24hCutoff } } };
    } else if (params.leadFilter === 'stale') {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { leadStatus: { in: ['needs_first_contact', 'document_collection'] } },
        {
          OR: [
            { activities: { none: {} } },
            { activities: { every: { occurredAt: { lt: stale48hCutoff } } } },
          ],
        },
      ];
    } else if (params.leadFilter === 'followup_today') {
      where.activities = {
        some: {
          followUpAt: { gte: todayStart, lte: todayEnd },
        },
      };
    }

    return this.prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 25,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        bankOffers: { where: { erasedAt: null } },
        activities: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { activityType: true, occurredAt: true },
        },
        _count: { select: { activities: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });
  }

  async countActivitiesPendingFollowupForApplications(
    applicationIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (applicationIds.length === 0) return new Map();
    const now = new Date();
    const rows = await this.prisma.activity.groupBy({
      by: ['applicationId'],
      where: {
        applicationId: { in: [...applicationIds] },
        followUpAt: { not: null, lte: now },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.applicationId, r._count._all]));
  }

  async assignAgent(input: {
    applicationId: string;
    toAgentStaffId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<{ previousAgentId: string | null }> {
    const client = input.tx ?? this.prisma;
    const existing = await client.application.findUnique({
      where: { id: input.applicationId },
      select: { assignedAgentStaffId: true },
    });
    if (!existing) throw new Error(`Application not found: ${input.applicationId}`);
    await client.application.update({
      where: { id: input.applicationId },
      data: { assignedAgentStaffId: input.toAgentStaffId, assignedAt: new Date() },
    });
    return { previousAgentId: existing.assignedAgentStaffId };
  }
}
