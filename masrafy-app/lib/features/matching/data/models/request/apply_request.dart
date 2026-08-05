/// Request DTO for `POST /api/v1/apply` (Principle XXX — one typed request per
/// call; Principle I / A3 — money as decimal strings, never floats).
///
/// Root [ApplyRequest] + its nested payload classes live in this one file on
/// purpose (payload co-location); do not split per class. The per-category
/// wizard mappers build this.
///
/// No `age` field: the backend derives the applicant's age from the
/// authenticated customer's `birthday` (Principle XXXVII / A31). Sending one
/// would be rejected by the API's `forbidNonWhitelisted` validation.
class ApplyRequest {
  const ApplyRequest({
    required this.loanPurpose,
    required this.requestedAmountEGP,
    required this.preferredTenorMonths,
    required this.priority,
    required this.employment,
    required this.obligations,
    required this.assets,
    this.requestedCurrency = 'EGP',
    this.mortgageDetails,
    this.carDetails,
    this.category,
    this.questionnaireVersionId,
    this.questionnaireAnswers,
  });

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

  Map<String, dynamic> toJson() => {
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

/// A single questionnaire answer sent to `/api/v1/apply`
/// (`SubmittedAnswerDto` on the backend). The DTO requires **exactly one** of
/// `optionCode | optionCodes | textValue | numericValue`, so this model is only
/// constructible through the four named constructors and `toJson` emits exactly
/// the one key that was set. Numeric values stay decimal STRINGS (Principle I /
/// A3). Co-located with [ApplyRequest] on purpose; do not split per-class.
class QuestionnaireAnswer {
  const QuestionnaireAnswer._({
    required this.questionCode,
    this.optionCode,
    this.optionCodes,
    this.textValue,
    this.numericValue,
  });

  /// `SINGLE_SELECT`.
  const QuestionnaireAnswer.single({
    required String questionCode,
    required String optionCode,
  }) : this._(questionCode: questionCode, optionCode: optionCode);

  /// `MULTI_SELECT`.
  const QuestionnaireAnswer.multi({
    required String questionCode,
    required List<String> optionCodes,
  }) : this._(questionCode: questionCode, optionCodes: optionCodes);

  /// `NUMERIC` — [value] is a decimal string, never a JS number.
  const QuestionnaireAnswer.number({
    required String questionCode,
    required String value,
  }) : this._(questionCode: questionCode, numericValue: value);

  /// `TEXT`.
  const QuestionnaireAnswer.text({
    required String questionCode,
    required String value,
  }) : this._(questionCode: questionCode, textValue: value);

  final String questionCode;
  final String? optionCode;
  final List<String>? optionCodes;
  final String? textValue;
  final String? numericValue;

  Map<String, dynamic> toJson() => {
        'questionCode': questionCode,
        if (optionCode != null) 'optionCode': optionCode,
        if (optionCodes != null) 'optionCodes': optionCodes,
        if (textValue != null) 'textValue': textValue,
        if (numericValue != null) 'numericValue': numericValue,
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
