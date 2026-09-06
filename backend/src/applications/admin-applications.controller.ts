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
import { deriveAge } from '@/customer-auth/age.util';

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
  @ApiOperation({ summary: 'List applications (paginated, newest first)' })
  async findMany(
    @Query('status') status?: string,
    @Query('leadStatus') leadStatus?: string,
    @Query('loanPurpose') loanPurpose?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ): Promise<unknown> {
    const rows = await this.repo.findManyAdmin({
      status: status?.split(',') as ApplicationStatus[] | undefined,
      leadStatus: leadStatus?.split(',') as LeadStatus[] | undefined,
      loanPurpose,
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
    const questionnaire = await this.service.buildApplicantQuestionnaire(row);
    return { success: true, data: { ...this.projectDetail(row), questionnaire } };
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
    // The offer the applicant actually selected (feature 008) — it carries the
    // bank's verdict, which is what admin triage reads the row for.
    const selected = row.userSelectedBankOfferId
      ? row.bankOffers.find((o) => o.id === row.userSelectedBankOfferId)
      : undefined;
    const selectedOfferDecision = selected?.decision?.outcome ?? null;
    return {
      id: row.id,
      status: row.status,
      leadStatus: row.leadStatus,
      priority: row.priority,
      requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
      loanPurpose: row.loanPurpose,
      age: row.age,
      createdAt: row.createdAt.toISOString(),
      eligibleProgramsCount: row.eligibleProgramsCount,
      programsCheckedCount: row.programsCheckedCount,
      applicant: row.applicantCustomer
        ? { firstName: row.applicantCustomer.firstName, lastName: row.applicantCustomer.lastName }
        : null,
      maskedApplicant: maskApplicantProfile(profile),
      userProceededAt: row.userProceededAt ? row.userProceededAt.toISOString() : null,
      userSelectedBankOfferId: row.userSelectedBankOfferId ?? null,
      selectedOfferDecision,
    };
  }

  private projectDetail(row: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>) {
    const offers = row.bankOffers.map((o) => this.projectOffer(o, o.id === row.userSelectedBankOfferId));
    return {
      id: row.id,
      status: row.status,
      leadStatus: row.leadStatus,
      priority: row.priority,
      requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
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
      // What narrowed the program set for this submission. A null on either
      // optional axis means "not narrowed by it" — every program in the category,
      // or both income bases — not "unknown".
      category: row.category,
      programNameKey: row.programNameKey,
      programType: row.programType,
      applicant: this.projectApplicant(row.applicantCustomer),
      applicantProfile: maskApplicantProfile(row.applicantProfile as RawApplicantProfileJson),
      // The offer the applicant actually committed to (feature 008 proceed gate)
      // — the loan this file is really about. Null for rows that never proceeded.
      userSelectedBankOfferId: row.userSelectedBankOfferId ?? null,
      userProceededAt: row.userProceededAt ? row.userProceededAt.toISOString() : null,
      selectedOffer: offers.find((o) => o.isSelected) ?? null,
      offers,
    };
  }

  /**
   * One matched offer, with the money figures an admin needs to describe the
   * actual loan: what was borrowed, at what rate, for how long, what it costs in
   * total, and what the bank came back with. Totals are Decimal arithmetic on
   * the frozen offer — never floats, never recomputed from program config
   * (Principles I + A6: the offer is immutable, so its own numbers are the truth).
   */
  private projectOffer(
    o: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>['bankOffers'][number],
    isSelected: boolean,
  ) {
    const totalPayable = o.monthlyInstallmentEGP.mul(o.effectiveTenorMonths);
    return {
      id: o.id,
      isSelected,
      programCode: o.programCode,
      programVersion: o.programVersion,
      bankName: o.bankName,
      bankIsFeatured: o.bankIsFeatured,
      isShariaCompliant: o.isShariaCompliant,
      programFriendlyName: o.programFriendlyName,
      effectiveRatePercent: o.effectiveRatePercent.toFixed(4),
      monthlyInstallmentEGP: o.monthlyInstallmentEGP.toFixed(2),
      requestedLoanAmountEGP: o.requestedLoanAmountEGP.toFixed(2),
      effectiveLoanAmountEGP: o.effectiveLoanAmountEGP.toFixed(2),
      requestedTenorMonths: o.requestedTenorMonths,
      effectiveTenorMonths: o.effectiveTenorMonths,
      // installment × tenor, and the part of it that is not principal.
      totalPayableEGP: totalPayable.toFixed(2),
      totalCostOfCreditEGP: totalPayable.sub(o.effectiveLoanAmountEGP).toFixed(2),
      feesBreakdown: o.feesBreakdown,
      // The engine's own rank position, frozen with the offer — the order the
      // applicant was shown, by the priority they stated.
      rankIndex: o.rankIndex,
      requiredDocuments: o.requiredDocuments,
      matchReasons: o.matchReasons,
      cascadeTrace: o.cascadeTrace,
      qualitativeReviewBadge: o.qualitativeReviewBadge,
      selfDeclared: o.selfDeclared,
      maxLoanAvailableEGP: o.maxLoanAvailableEGP?.toFixed(2),
      // The DBR verdict frozen with the offer — why the amount is what it is.
      dbrPercent: o.dbrPercent?.toFixed(2) ?? null,
      dbrCapPercent: o.dbrCapPercent?.toFixed(4) ?? null,
      decision: o.decision
        ? { outcome: o.decision.outcome, recordedAt: o.decision.recordedAt.toISOString() }
        : null,
    };
  }

  /**
   * Applicant identity + contact for the detail page. Mirrors the field set
   * already blessed by GET /admin/customers/:id (name, phone, email, derived
   * age, verification/active flags, timestamps) plus the applicant's location.
   * `age` is DERIVED from birthday (Principle XXXVII — never stored). The raw
   * `profilePhotoKey` never crosses the boundary; only a boolean flag does.
   */
  private projectApplicant(
    c: NonNullable<Awaited<ReturnType<ApplicationRepository['findById']>>>['applicantCustomer'] | null,
  ) {
    if (!c) return null;
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      age: deriveAge(c.birthday),
      governorate: c.governorate,
      city: c.city,
      address: c.address,
      locale: c.locale,
      registrationPath: c.registrationPath,
      isVerified: c.isVerified,
      isActive: c.isActive,
      mobileVerifiedAt: c.mobileVerifiedAt ? c.mobileVerifiedAt.toISOString() : null,
      memberSince: c.createdAt.toISOString(),
      lastLoginAt: c.lastLoginAt ? c.lastLoginAt.toISOString() : null,
      hasProfilePhoto: c.profilePhotoKey !== null,
    };
  }
}
