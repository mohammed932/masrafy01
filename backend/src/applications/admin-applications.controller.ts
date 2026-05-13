/**
 * Admin-facing application reads (US2). JWT + role-gated; PII masked.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { ApplicationStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApplicationRepository } from './application.repository';
import { NotFoundException } from '@/common/errors/domain.exceptions';
import { maskApplicantProfile, type RawApplicantProfileJson } from './pii-masker';

@ApiTags('Admin · Applications')
@ApiBearerAuth()
@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
export class AdminApplicationsController {
  constructor(private readonly repo: ApplicationRepository) {}

  @Get()
  @ApiOperation({ summary: 'List applications (paginated, with bestOffer + tier filter)' })
  async findMany(
    @Query('status') status?: string,
    @Query('loanPurpose') loanPurpose?: string,
    @Query('tier') tier?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ): Promise<unknown> {
    const tierBucket =
      tier === 'high' || tier === 'medium' || tier === 'needs_coaching' ? tier : undefined;
    const rows = await this.repo.findManyAdmin({
      status: status?.split(',') as ApplicationStatus[] | undefined,
      loanPurpose,
      tier: tierBucket,
      cursor,
      limit,
    });
    return {
      success: true,
      data: rows.map((r) => this.projectListItem(r)),
      pagination: {
        nextCursor: rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application detail (PII masked)' })
  async findById(@Param('id') id: string): Promise<unknown> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException();
    return { success: true, data: this.projectDetail(row) };
  }

  private projectListItem(
    row: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>,
  ) {
    const profile = row.applicantProfile as RawApplicantProfileJson;
    // Best offer = highest approvalScore among the application's non-erased offers.
    // null when status='no_match' or no offers persisted.
    const best = [...row.bankOffers].sort((a, b) => b.approvalScore - a.approvalScore)[0];
    const bestOffer = best
      ? {
          score: best.approvalScore,
          tier: best.approvalTier,
          tierLabelCode: `approval.tier.${best.approvalTier}`,
        }
      : null;
    return {
      id: row.id,
      status: row.status,
      priority: row.priority,
      requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
      requestedCurrency: row.requestedCurrency,
      loanPurpose: row.loanPurpose,
      age: row.age,
      createdAt: row.createdAt.toISOString(),
      eligibleProgramsCount: row.eligibleProgramsCount,
      programsCheckedCount: row.programsCheckedCount,
      maskedApplicant: maskApplicantProfile(profile),
      bestOffer,
    };
  }

  private projectDetail(row: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>) {
    return {
      id: row.id,
      status: row.status,
      priority: row.priority,
      requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
      requestedCurrency: row.requestedCurrency,
      preferredTenorMonths: row.preferredTenorMonths,
      loanPurpose: row.loanPurpose,
      age: row.age,
      createdAt: row.createdAt.toISOString(),
      submissionCorrelationId: row.submissionCorrelationId,
      engineDurationMs: row.engineDurationMs,
      programsCheckedCount: row.programsCheckedCount,
      eligibleProgramsCount: row.eligibleProgramsCount,
      summary: row.summary,
      noMatchSummary: row.noMatchSummary,
      applicantProfile: maskApplicantProfile(row.applicantProfile as RawApplicantProfileJson),
      offers: row.bankOffers.map((o) => ({
        programCode: o.programCode,
        programVersion: o.programVersion,
        bankName: o.bankName,
        programFriendlyName: o.programFriendlyName,
        currency: o.currency,
        effectiveRatePercent: o.effectiveRatePercent.toFixed(4),
        monthlyInstallmentEGP: o.monthlyInstallmentEGP.toFixed(2),
        requestedLoanAmountEGP: o.requestedLoanAmountEGP.toFixed(2),
        effectiveLoanAmountEGP: o.effectiveLoanAmountEGP.toFixed(2),
        requestedTenorMonths: o.requestedTenorMonths,
        effectiveTenorMonths: o.effectiveTenorMonths,
        feesBreakdown: o.feesBreakdown,
        approvalProbability: this.projectApprovalProbability(o),
        requiredDocuments: o.requiredDocuments,
        matchReasons: o.matchReasons,
        cascadeTrace: o.cascadeTrace,
        qualitativeReviewBadge: o.qualitativeReviewBadge,
        selfDeclared: o.selfDeclared,
        maxLoanAvailableEGP: o.maxLoanAvailableEGP?.toFixed(2),
      })),
    };
  }

  private projectApprovalProbability(o: {
    approvalScore: number;
    approvalTier: string;
    approvalFactors: unknown;
    engineVersion: string;
  }) {
    const raw = (o.approvalFactors ?? {}) as {
      positive?: Array<{ code: string; impact: number }>;
      negative?: Array<{ code: string; impact: number }>;
      legacy?: boolean;
    };
    return {
      score: o.approvalScore,
      tier: o.approvalTier,
      tierLabelCode: `approval.tier.${o.approvalTier}`,
      factors: {
        positive: raw.positive ?? [],
        negative: raw.negative ?? [],
        ...(raw.legacy === true ? { legacy: true } : {}),
      },
      engineVersion: o.engineVersion,
    };
  }
}
