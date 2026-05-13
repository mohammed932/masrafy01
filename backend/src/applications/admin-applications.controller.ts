/**
 * Admin-facing application reads (US2). JWT + role-gated; PII masked.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { ApplicationStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ApplicationRepository, type LeadListFilter } from './application.repository';
import { ForbiddenException, NotFoundException } from '@/common/errors/domain.exceptions';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { ApplicationsService } from './applications.service';
import { maskApplicantProfile, type RawApplicantProfileJson } from './pii-masker';

@ApiTags('Admin · Applications')
@ApiBearerAuth()
@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
export class AdminApplicationsController {
  private static readonly LEAD_FILTER_VALUES: readonly LeadListFilter[] = [
    'needs_first_contact',
    'stale',
    'recent',
    'followup_today',
    'docs_in_progress',
    'ready_for_submission',
    'submitted_to_bank',
  ];

  constructor(
    private readonly repo: ApplicationRepository,
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List applications (paginated, with bestOffer + tier + lead filter)' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('loanPurpose') loanPurpose?: string,
    @Query('tier') tier?: string,
    @Query('filter') leadFilter?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ): Promise<unknown> {
    const tierBucket =
      tier === 'high' || tier === 'medium' || tier === 'needs_coaching' ? tier : undefined;
    const filterBucket = AdminApplicationsController.LEAD_FILTER_VALUES.includes(
      leadFilter as LeadListFilter,
    )
      ? (leadFilter as LeadListFilter)
      : undefined;
    const assignedAgentStaffId = user.role === 'sales_agent' ? user.sub : undefined;
    const rows = await this.repo.findManyAdmin({
      status: status?.split(',') as ApplicationStatus[] | undefined,
      loanPurpose,
      tier: tierBucket,
      leadFilter: filterBucket,
      assignedAgentStaffId,
      cursor,
      limit,
    });
    const ids = rows.map((r) => r.id);
    const pendingFollowupCounts =
      await this.repo.countActivitiesPendingFollowupForApplications(ids);
    return {
      success: true,
      data: rows.map((r) => this.projectListItem(r, pendingFollowupCounts)),
      pagination: {
        nextCursor: rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null,
      },
    };
  }

  @Post(':id/assign')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'Assign or reassign an application to an agent' })
  async assign(
    @Param('id') applicationId: string,
    @Body() body: AssignLeadDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationIdHeader: string | undefined,
    @Ip() ip: string,
  ): Promise<unknown> {
    if (user.role !== 'super_admin' && user.role !== 'sales_manager') {
      throw new ForbiddenException();
    }
    const correlationId =
      correlationIdHeader && correlationIdHeader.length > 0 ? correlationIdHeader : randomUUID();
    const out = await this.applicationsService.assignAgent({
      applicationId,
      toAgentStaffId: body.toAgentStaffId,
      reason: body.reason,
      notes: body.notes ?? null,
      actor: { staffId: user.sub, role: user.role },
      correlationId,
      sourceIp: ip ?? null,
    });
    return { success: true, data: out };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application detail (PII masked)' })
  async findById(@Param('id') id: string): Promise<unknown> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException();
    return { success: true, data: this.projectDetail(row) };
  }

  private projectListItem(
    row: Awaited<ReturnType<ApplicationRepository['findManyAdmin']>>[number],
    pendingFollowups: Map<string, number>,
  ) {
    const profile = row.applicantProfile as RawApplicantProfileJson;
    const best = [...row.bankOffers].sort((a, b) => b.approvalScore - a.approvalScore)[0];
    const bestOffer = best
      ? {
          score: best.approvalScore,
          tier: best.approvalTier,
          tierLabelCode: `approval.tier.${best.approvalTier}`,
        }
      : null;
    const last = row.activities[0];
    const activityCount = row._count.activities;
    const lastActivityAt = last?.occurredAt ?? null;
    const stale48hMs = 48 * 60 * 60 * 1000;
    const isStale =
      (row.leadStatus === 'needs_first_contact' || row.leadStatus === 'document_collection') &&
      (lastActivityAt === null || Date.now() - lastActivityAt.getTime() >= stale48hMs);
    const pendingFollowupCount = pendingFollowups.get(row.id) ?? 0;
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
      leadStatus: row.leadStatus,
      assignedAgent: row.assignedAgent
        ? { id: row.assignedAgent.id, name: row.assignedAgent.name }
        : null,
      lastActivity: last
        ? { activityType: last.activityType, occurredAt: last.occurredAt.toISOString() }
        : null,
      activityCount,
      isStale,
      hasOverdueFollowUp: pendingFollowupCount > 0,
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
