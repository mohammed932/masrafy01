/// Wire payload for `POST /api/v1/apply`. Mirrors backend
/// `ApplyRequestDto` (see `backend/src/applications/dto/apply.dto.ts`).
/// Money fields are decimal strings — never JS numbers (Constitution
/// Principle I).
class LoanApplicationRequest {
  LoanApplicationRequest({
    required this.loanPurpose,
    required this.requestedAmountEGP,
    required this.preferredTenorMonths,
    required this.age,
    required this.priority,
    required this.employment,
    required this.obligations,
    this.assets,
    this.mortgageDetails,
    this.carDetails,
    this.nationalId,
    this.isGuest = true,
    this.requestedCurrency = 'EGP',
  });

  final String loanPurpose;
  final String requestedAmountEGP;
  final int preferredTenorMonths;
  final int age;
  final String priority;
  final EmploymentPayload employment;
  final ObligationsPayload obligations;
  final AssetsPayload? assets;
  final MortgageDetailsPayload? mortgageDetails;
  final CarDetailsPayload? carDetails;
  final String? nationalId;
  final bool isGuest;
  final String requestedCurrency;

  Map<String, dynamic> toJson() => {
        'loanPurpose': loanPurpose,
        'requestedAmountEGP': requestedAmountEGP,
        'requestedCurrency': requestedCurrency,
        'preferredTenorMonths': preferredTenorMonths,
        'age': age,
        'priority': priority,
        'isGuest': isGuest,
        if (nationalId != null) 'nationalId': nationalId,
        'employment': employment.toJson(),
        'obligations': obligations.toJson(),
        if (assets != null) 'assets': assets!.toJson(),
        if (mortgageDetails != null) 'mortgageDetails': mortgageDetails!.toJson(),
        if (carDetails != null) 'carDetails': carDetails!.toJson(),
      };
}

class EmploymentPayload {
  EmploymentPayload({
    required this.employmentType,
    required this.monthlyNetSalaryEGP,
    required this.monthsInJob,
    required this.salaryTransferType,
    required this.companyName,
    required this.companyType,
  });

  final String employmentType;
  final String monthlyNetSalaryEGP;
  final int monthsInJob;
  final String salaryTransferType;
  final String companyName;
  final String companyType;

  Map<String, dynamic> toJson() => {
        'employmentType': employmentType,
        'monthlyNetSalaryEGP': monthlyNetSalaryEGP,
        'monthsInJob': monthsInJob,
        'salaryTransferType': salaryTransferType,
        'companyName': companyName,
        'companyType': companyType,
      };
}

class ObligationsPayload {
  ObligationsPayload({
    required this.existingMonthlyObligationsEGP,
    required this.hasCurrentLoan,
    required this.hasPreviousRejection,
  });

  final String existingMonthlyObligationsEGP;
  final bool hasCurrentLoan;
  final bool hasPreviousRejection;

  Map<String, dynamic> toJson() => {
        'existingMonthlyObligationsEGP': existingMonthlyObligationsEGP,
        'hasCurrentLoan': hasCurrentLoan,
        'hasPreviousRejection': hasPreviousRejection,
      };
}

class AssetsPayload {
  AssetsPayload({this.creditCardLimit});

  final String? creditCardLimit;

  Map<String, dynamic> toJson() => {
        if (creditCardLimit != null) 'creditCardLimit': creditCardLimit,
      };
}

class MortgageDetailsPayload {
  MortgageDetailsPayload({
    required this.propertyValueEGP,
    required this.downPaymentEGP,
    required this.propertyType,
  });

  final String propertyValueEGP;
  final String downPaymentEGP;
  final String propertyType;

  Map<String, dynamic> toJson() => {
        'propertyValueEGP': propertyValueEGP,
        'downPaymentEGP': downPaymentEGP,
        'propertyType': propertyType,
      };
}

class CarDetailsPayload {
  CarDetailsPayload({required this.carValueEGP, required this.downPaymentEGP});

  final String carValueEGP;
  final String downPaymentEGP;

  Map<String, dynamic> toJson() => {
        'carValueEGP': carValueEGP,
        'downPaymentEGP': downPaymentEGP,
      };
}
