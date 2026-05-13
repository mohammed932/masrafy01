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
} from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';

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
    cursor?: string;
    limit?: number;
  }) {
    const where: Prisma.ApplicationWhereInput = {};
    if (params.status?.length) where.status = { in: params.status };
    if (params.loanPurpose) where.loanPurpose = params.loanPurpose;

    // Tier-bucket filter (feature 004 FR-017). Acts on the best-offer tier.
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

    return this.prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 25,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { bankOffers: { where: { erasedAt: null } } },
    });
  }
}
