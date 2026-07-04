/// Request DTO for `POST /api/v1/apply` (Principle XXX — one typed request per
/// call; Principle I / A3 — money as decimal strings, never floats).
///
/// Root [ApplyRequest] + its nested payload classes live in this one file on
/// purpose (payload co-location); do not split per class. The per-category
/// wizard mappers build this; [age] is filled in later by the results cubit
/// from `/auth/me` (the wizard never collects it), hence nullable here.
class ApplyRequest {
  const ApplyRequest({
    required this.loanPurpose,
    required this.requestedAmountEGP,
    required this.preferredTenorMonths,
    required this.priority,
    required this.employment,
    required this.obligations,
    required this.assets,
    this.age,
    this.requestedCurrency = 'EGP',
    this.mortgageDetails,
    this.carDetails,
    this.category,
    this.questionnaireVersionId,
    this.questionnaireAnswers,
  });

  /// 18–75. Null until the results cubit injects it from the customer profile.
  final int? age;
  final String loanPurpose;

  /// Decimal string, 5000–50,000,000 (Principle I).
  final String requestedAmountEGP;
  final String requestedCurrency;
  final int preferredTenorMonths;

  /// One of: lowest_installment | lowest_interest | fastest_approval | least_paperwork.
  final String priority;

  final EmploymentPayload employment;
  final ObligationsPayload obligations;
  final AssetsPayload assets;
  final MortgageDetailsPayload? mortgageDetails;
  final CarDetailsPayload? carDetails;

  /// Loan category (`personal|car|mortgage|business`). Set by the dynamic
  /// questionnaire flow so the engine applies per-bank weighted scoring; null
  /// for the legacy structured-only wizards.
  final String? category;

  /// Published questionnaire version the [questionnaireAnswers] were collected
  /// against (echoed from the snapshot).
  final String? questionnaireVersionId;

  /// Picked answers `{questionCode, optionCode}` — drives admin-weighted
  /// approval scoring (Principle V). Null for the legacy flows.
  final List<QuestionnaireAnswer>? questionnaireAnswers;

  /// Returns a copy with [age] set — called by the results cubit before submit.
  ApplyRequest withAge(int age) => ApplyRequest(
        loanPurpose: loanPurpose,
        requestedAmountEGP: requestedAmountEGP,
        preferredTenorMonths: preferredTenorMonths,
        priority: priority,
        employment: employment,
        obligations: obligations,
        assets: assets,
        age: age,
        requestedCurrency: requestedCurrency,
        mortgageDetails: mortgageDetails,
        carDetails: carDetails,
        category: category,
        questionnaireVersionId: questionnaireVersionId,
        questionnaireAnswers: questionnaireAnswers,
      );

  Map<String, dynamic> toJson() => {
        'age': age,
        'loanPurpose': loanPurpose,
        'requestedAmountEGP': requestedAmountEGP,
        'requestedCurrency': requestedCurrency,
        'preferredTenorMonths': preferredTenorMonths,
        'priority': priority,
        'employment': employment.toJson(),
        'obligations': obligations.toJson(),
        'assets': assets.toJson(),
        if (mortgageDetails != null) 'mortgageDetails': mortgageDetails!.toJson(),
        if (carDetails != null) 'carDetails': carDetails!.toJson(),
        if (category != null) 'category': category,
        if (questionnaireVersionId != null)
          'questionnaireVersionId': questionnaireVersionId,
        if (questionnaireAnswers != null)
          'questionnaireAnswers':
              questionnaireAnswers!.map((a) => a.toJson()).toList(),
      };
}

/// A single picked questionnaire answer sent to `/api/v1/apply`
/// (`SubmittedAnswerDto` on the backend). Co-located with [ApplyRequest] on
/// purpose; do not split per-class.
class QuestionnaireAnswer {
  const QuestionnaireAnswer({
    required this.questionCode,
    required this.optionCode,
  });

  final String questionCode;
  final String optionCode;

  Map<String, dynamic> toJson() => {
        'questionCode': questionCode,
        'optionCode': optionCode,
      };
}

class EmploymentPayload {
  const EmploymentPayload({
    required this.employmentType,
    required this.monthlyNetSalaryEGP,
    required this.monthsInJob,
    required this.salaryTransferType,
    required this.companyName,
    required this.companyType,
    this.bankCategory,
  });

  final String employmentType;

  /// Decimal string (Principle I).
  final String monthlyNetSalaryEGP;
  final int monthsInJob;
  final String salaryTransferType;
  final String companyName;
  final String companyType;

  /// 'public' | 'commercial' (optional).
  final String? bankCategory;

  Map<String, dynamic> toJson() => {
        'employmentType': employmentType,
        'monthlyNetSalaryEGP': monthlyNetSalaryEGP,
        'monthsInJob': monthsInJob,
        'salaryTransferType': salaryTransferType,
        'companyName': companyName,
        'companyType': companyType,
        if (bankCategory != null) 'bankCategory': bankCategory,
      };
}

class ObligationsPayload {
  const ObligationsPayload({
    required this.existingMonthlyObligationsEGP,
    required this.hasCurrentLoan,
    required this.hasPreviousRejection,
  });

  /// Decimal string (Principle I).
  final String existingMonthlyObligationsEGP;
  final bool hasCurrentLoan;
  final bool hasPreviousRejection;

  Map<String, dynamic> toJson() => {
        'existingMonthlyObligationsEGP': existingMonthlyObligationsEGP,
        'hasCurrentLoan': hasCurrentLoan,
        'hasPreviousRejection': hasPreviousRejection,
      };
}

/// All asset fields are optional in the backend DTO; the wizards collect none of
/// them for this iteration, so an empty object is sent. Kept as a class so
/// future asset inputs slot in without touching the request shape.
class AssetsPayload {
  const AssetsPayload();

  Map<String, dynamic> toJson() => const {};
}

class MortgageDetailsPayload {
  const MortgageDetailsPayload({
    required this.propertyValueEGP,
    required this.downPaymentEGP,
    required this.propertyType,
    required this.isCompound,
    required this.constructionStage,
  });

  /// Decimal strings (Principle I).
  final String propertyValueEGP;
  final String downPaymentEGP;
  final String propertyType;
  final bool isCompound;
  final String constructionStage;

  Map<String, dynamic> toJson() => {
        'propertyValueEGP': propertyValueEGP,
        'downPaymentEGP': downPaymentEGP,
        'propertyType': propertyType,
        'isCompound': isCompound,
        'constructionStage': constructionStage,
      };
}

class CarDetailsPayload {
  const CarDetailsPayload({
    required this.carValueEGP,
    required this.downPaymentEGP,
  });

  /// Decimal strings (Principle I).
  final String carValueEGP;
  final String downPaymentEGP;

  Map<String, dynamic> toJson() => {
        'carValueEGP': carValueEGP,
        'downPaymentEGP': downPaymentEGP,
      };
}
