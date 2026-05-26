/// Phase-1 spec: four job-type choices. Wire keys match the backend
/// `employment_type` enumeration registry (migration
/// `20260526150000_expand_employment_types`).
enum EmploymentType {
  governmentEmployee('government_employee', 'موظف حكومي', 'Government employee'),
  privateEmployee('private_employee', 'موظف قطاع خاص', 'Private-sector employee'),
  businessOwner('business_owner', 'صاحب عمل', 'Business owner'),
  freelancer('freelancer', 'مستقل', 'Freelancer');

  const EmploymentType(this.key, this.labelAr, this.labelEn);

  final String key;
  final String labelAr;
  final String labelEn;
}
