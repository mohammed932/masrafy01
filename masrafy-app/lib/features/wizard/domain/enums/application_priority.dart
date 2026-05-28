enum ApplicationPriority {
  lowestInstallment('lowest_installment', 'أقل قسط شهري', 'Lowest monthly installment'),
  lowestInterest('lowest_interest', 'أقل سعر فائدة', 'Lowest interest rate'),
  fastestApproval('fastest_approval', 'أسرع موافقة', 'Fastest approval'),
  leastPaperwork('least_paperwork', 'أقل مستندات مطلوبة', 'Least paperwork');

  const ApplicationPriority(this.key, this.labelAr, this.labelEn);

  final String key;
  final String labelAr;
  final String labelEn;
}
