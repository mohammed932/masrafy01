import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a personal-loan `ApplyRequest`.
///
/// The four economic figures (amount, tenor, income, current installments) come
/// straight from the bound NUMERIC questions via [MoneyFigures] — the bucket →
/// representative-value maps this file used to carry are gone (feature 010:
/// an applicant asking for 500 000 was being quoted on 300 000). Choice answers
/// that have no NUMERIC equivalent (job tenure, priority) still map through the
/// documented approximations below. The full answer set also rides along as
/// `questionnaireAnswers` so the engine applies per-bank weighted scoring
/// (Principle V). `age` stays null — the results cubit fills it from the profile
/// (`/auth/me`); the sub-purpose has no backend field so `loanPurpose` carries
/// the category id `personal`.
///
/// `questionnaireVersionId` is deliberately unset: the snapshot exposes a
/// version NUMBER, not the version id the DTO wants, and the backend falls back
/// to the active version.
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapPersonalAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers,
) {
  final money = MoneyFigures.fromAnswers(answers);
  final employmentCode = pickedOption(answers, 'employment_status');
  final employmentType =
      _employmentType[employmentCode] ?? employmentCode ?? 'salaried';

  return ApplyRequest(
    loanPurpose: 'personal',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: _priority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      monthsInJob: _monthsInJob[pickedOption(answers, 'job_tenure')] ?? 24,
      salaryTransferType: salaryTransferType(
        answerCode: pickedOption(answers, 'salary_transfer'),
      ),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: money.existingObligationsEGP,
      // Both derived from the itemised debt answers — the total is the SUM of the
      // per-debt amounts, and this flag comes from which TYPES were ticked (a
      // card at a zero minimum payment is still a loan on book).
      hasCurrentLoan: money.hasCurrentLoan,
      hasPreviousRejection: pickedOption(answers, 'prior_rejection') == 'yes',
    ),
    assets: const AssetsPayload(),
    category: 'personal',
    questionnaireAnswers: toSubmittedAnswers(answers),
  );
}

/// `job_tenure` bucket → representative months in job.
const Map<String, int> _monthsInJob = {
  'less_than_6_months': 3,
  '6_months_to_1_year': 9,
  '1_to_3_years': 24,
  'more_than_3_years': 48,
};

/// `employment_status` seed code → the engine's `employmentType` token
/// (the engine keys on the shorter legacy tokens for bank-employee programs).
const Map<String, String> _employmentType = {
  'government_employee': 'government_employee',
  'private_sector_employee': 'private_employee',
  'business_owner_company_owner': 'business_owner',
  'freelancer': 'freelancer',
  'retired': 'retired',
};

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'lowest_monthly_installment' || 'flexible_repayment' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'least_documentation_required' => 'least_paperwork',
      _ => 'fastest_approval',
    };
