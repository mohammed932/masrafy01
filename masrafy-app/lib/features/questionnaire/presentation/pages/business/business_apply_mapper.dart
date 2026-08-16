import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a business-loan `ApplyRequest`.
///
/// Amount, tenor, income and current installments come from the bound NUMERIC
/// questions via [MoneyFigures] (feature 010 — no bucket midpoints); the bound
/// `monthly_income` figure stands in for `monthlyNetSalaryEGP`, as average
/// monthly revenue did before. Business has no dedicated details payload:
/// business age maps to `monthsInJob` and employment is fixed to
/// `business_owner`. The full answer set rides along as `questionnaireAnswers`
/// so the engine applies per-bank weighted scoring (Principle V). `age` stays
/// null — the results cubit fills it from the profile (`/auth/me`).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapBusinessAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers, {
  String? programNameKey,
  String? programType,
}) {
  final money = MoneyFigures.fromAnswers(answers);

  return ApplyRequest(
    loanPurpose: 'business',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: _priority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: 'business_owner',
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      monthsInJob: _monthsInBusiness(pickedOption(answers, 'business_age')),
      salaryTransferType: 'none',
      companyName: 'N/A',
      companyType: 'commercial_bank',
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: money.existingObligationsEGP,
      hasCurrentLoan: money.hasCurrentLoan,
      hasPreviousRejection: pickedOption(answers, 'prior_rejection') == 'yes',
    ),
    assets: const AssetsPayload(),
    category: 'business',
    programNameKey: programNameKey,
    programType: programType,
    questionnaireAnswers: toSubmittedAnswers(answers),
  );
}

/// `business_age` bucket → representative `monthsInJob` (business operating age).
int _monthsInBusiness(String? bucket) => switch (bucket) {
      'less_than_1_year' => 6,
      '1_to_2_years' => 18,
      'more_than_2_years' => 48,
      _ => 24,
    };

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'flexible_repayment' || 'highest_financing_amount' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'least_documentation_required' => 'least_paperwork',
      _ => 'fastest_approval',
    };
