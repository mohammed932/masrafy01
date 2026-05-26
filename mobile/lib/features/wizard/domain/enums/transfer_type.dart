enum TransferType {
  payroll('payroll', 'تحويل راتب', 'Payroll transfer'),
  salaryTransferLetter('salary_transfer_letter', 'خطاب تحويل راتب', 'Salary transfer letter'),
  incomeTransferLetter('income_transfer_letter', 'خطاب تحويل دخل', 'Income transfer letter'),
  none('none', 'بدون تحويل راتب', 'No salary transfer');

  const TransferType(this.key, this.labelAr, this.labelEn);

  final String key;
  final String labelAr;
  final String labelEn;
}
