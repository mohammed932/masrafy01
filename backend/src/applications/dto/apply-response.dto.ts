/**
 * Mobile apply-endpoint response envelope (Constitution Principle XIV).
 * Mirrors the OpenAPI contract under specs/003-matching-engine-post/contracts/openapi.yaml.
 */

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
      programCode: string;
      programVersion: number;
      bankName: string;
      programFriendlyName: string;
      currency: string;
      effectiveRatePercent: string;
      monthlyInstallmentEGP: string;
      requestedLoanAmountEGP: string;
      effectiveLoanAmountEGP: string;
      requestedTenorMonths: number;
      effectiveTenorMonths: number;
      approvalProbabilityPercent: number;
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
