/**
 * Admin-facing application reads (US2). JWT + role-gated; PII masked.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationStatus, LeadStatus } from './dto/enums';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ApplicationRepository } from './application.repository';
import { AdminApplicationsService } from './admin-applications.service';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { NotFoundException } from '@/common/errors/domain.exceptions';
import { maskApplicantProfile, type RawApplicantProfileJson } from './pii-masker';

@ApiTags('Admin · Applications')
@ApiBearerAuth()
@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
export class AdminApplicationsController {
  constructor(
    private readonly repo: ApplicationRepository,
    private readonly service: AdminApplicationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List applications (paginated, with bestOffer + tier)' })
  async findMany(
    @Query('status') status?: string,
    @Query('leadStatus') leadStatus?: string,
    @Query('loanPurpose') loanPurpose?: string,
    @Query('tier') tier?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ): Promise<unknown> {
    const tierBucket = tier === 'high' || tier === 'medium' ? tier : undefined;
    const rows = await this.repo.findManyAdmin({
      status: status?.split(',') as ApplicationStatus[] | undefined,
      leadStatus: leadStatus?.split(',') as LeadStatus[] | undefined,
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

  @Patch(':id/lead-status')
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set the sales pipeline status of an application (lead)' })
  @ApiResponse({ status: 200, description: 'Lead status updated.' })
  @ApiResponse({ status: 403, description: 'FORBIDDEN' })
  @ApiResponse({ status: 404, description: 'NOT_FOUND' })
  async setLeadStatus(
    @Param('id') id: string,
    @Body() body: UpdateLeadStatusDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<unknown> {
    await this.service.setLeadStatus(id, body.leadStatus, {
      id: user.sub,
      sourceIp: this.readClientIp(req),
    });
    return { success: true };
  }

  private readClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }

  private projectListItem(
    row: Awaited<ReturnType<ApplicationRepository['findManyAdmin']>>[number],
  ) {
    const profile = row.applicantProfile as RawApplicantProfileJson;
    // Prefer the offer the applicant actually selected (feature 008).
    // Fall back to the highest-scored offer for legacy rows where the
    // user-proceed gate did not yet exist.
    const selected = row.userSelectedBankOfferId
      ? row.bankOffers.find((o) => o.id === row.userSelectedBankOfferId)
      : undefined;
    const best =
      selected ?? [...row.bankOffers].sort((a, b) => b.approvalScore - a.approvalScore)[0];
    const bestOffer = best
      ? {
          score: best.approvalScore,
          tier: best.approvalTier,
          tierLabelCode: `approval.tier.${best.approvalTier}`,
        }
      : null;
    const selectedOfferDecision = selected?.decision?.outcome ?? null;
    return {
      id: row.id,
      status: row.status,
      leadStatus: row.leadStatus,
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
      userProceededAt: row.userProceededAt ? row.userProceededAt.toISOString() : null,
      userSelectedBankOfferId: row.userSelectedBankOfferId ?? null,
      selectedOfferDecision,
    };
  }

  private projectDetail(row: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>) {
    return {
      id: row.id,
      status: row.status,
      leadStatus: row.leadStatus,
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
