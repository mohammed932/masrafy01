/**
 * Mobile apply-endpoint response envelope (Constitution Principle XIV).
 * Mirrors the OpenAPI contract under specs/004-approval-probability-display/contracts/openapi.yaml.
 *
 * Feature 004: per-offer `approvalProbabilityPercent: number` is replaced by the structured
 * `approvalProbability: ApprovalProbabilityResponseDto`. Mobile + admin both read this shape.
 */

export type ApprovalTierLiteral = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

export interface FactorImpactDto {
  code: string;
  impact: number;
}

export interface ApprovalProbabilityResponseDto {
  score: number;
  tier: ApprovalTierLiteral;
  tierLabelCode: string;
  factors: {
    positive: FactorImpactDto[];
    negative: FactorImpactDto[];
    legacy?: boolean;
  };
  engineVersion: string;
}

export interface ApplyMatchedResponse {
  success: true;
  data: {
    applicationId: string;
    correlationId: string;
    summary: {
      totalProgramsChecked: number;
      eligiblePrograms: number;
      bestInstallmentEGP: string;
      bestRatePercent: string;
    };
    matchedOffers: Array<{
      /** Persisted BankOffer id — the select-offer key the client sends back. */
      bankOfferId: string;
      programCode: string;
      programVersion: number;
      bankName: string;
      /** Phase-1 partner-bank flag. Mobile renders a FEATURED chip when true. */
      bankIsFeatured: boolean;
      programFriendlyName: string;
      currency: string;
      effectiveRatePercent: string;
      monthlyInstallmentEGP: string;
      requestedLoanAmountEGP: string;
      effectiveLoanAmountEGP: string;
      requestedTenorMonths: number;
      effectiveTenorMonths: number;
      approvalProbability: ApprovalProbabilityResponseDto;
      requiredDocuments: string[];
      matchReasons: string[];
      feesBreakdown: unknown;
      cascadeTrace: unknown;
      qualitativeReviewBadge: boolean;
      selfDeclared: boolean;
      maxLoanAvailableEGP?: string;
    }>;
  };
}

export interface ApplyNoMatchResponse {
  success: false;
  code: 'NO_MATCHING_PROGRAMS';
  meta: {
    applicationId: string;
    correlationId: string;
    primaryReason?: string;
    details: Array<{ programCode: string; failedChecks: string[] }>;
    suggestions: Array<{
      code: string;
      magnitude: number;
      programsUnlocked: number;
      suggestedValue?: string;
    }>;
  };
}

export type ApplyResponse = ApplyMatchedResponse | ApplyNoMatchResponse;
