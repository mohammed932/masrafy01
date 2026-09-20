export interface NewProgramDefaults {
  plansSource: 'product' | 'own';
  incomeAssumptionAmounts: 'catalog' | 'own';
  tenor: {
    minMonths: number | null;
    maxMonths: number | null;
  };
  loanLimits: {
    minAmountEGP: string | null;
    maxAmountEGP: string | null;
    qualitativeReviewMaxEGP: string | null;
    ltvCeilingPercent: string | null;
    minDownPaymentPercent: string | null;
  };
  pricing: {
    isVariableRate: boolean;
    rateBasis: 'reducing' | 'flat';
    baseRatePercent: string | null;
    currentEffectiveRatePercent: string | null;
    variableRateNote: string | null;
  };
}

export function newProgramDefaults(): NewProgramDefaults {
  return {
    plansSource: 'product',
    incomeAssumptionAmounts: 'catalog',
    tenor: {
      minMonths: null,
      maxMonths: null,
    },
    loanLimits: {
      minAmountEGP: null,
      maxAmountEGP: null,
      qualitativeReviewMaxEGP: null,
      ltvCeilingPercent: null,
      minDownPaymentPercent: null,
    },
    pricing: {
      isVariableRate: false,
      rateBasis: 'reducing',
      baseRatePercent: null,
      currentEffectiveRatePercent: null,
      variableRateNote: null,
    },
  };
}
