/// Static list of common dial codes shown in the Phone Code picker.
/// Mirrors the Figma sample format — `"+1 (US/CA)"` style — so the
/// field reads the same as `node-id=3173:91172`. The cubit only stores
/// the dial-code string (e.g. `"+1"`); the country abbreviation is
/// purely a display hint.
class PhoneDialCode {
  const PhoneDialCode({required this.code, required this.label});

  final String code;
  final String label;

  String get display => '$code ($label)';
}

const phoneDialCodes = <PhoneDialCode>[
  PhoneDialCode(code: '+1', label: 'US/CA'),
  PhoneDialCode(code: '+20', label: 'EG'),
  PhoneDialCode(code: '+27', label: 'ZA'),
  PhoneDialCode(code: '+30', label: 'GR'),
  PhoneDialCode(code: '+31', label: 'NL'),
  PhoneDialCode(code: '+32', label: 'BE'),
  PhoneDialCode(code: '+33', label: 'FR'),
  PhoneDialCode(code: '+34', label: 'ES'),
  PhoneDialCode(code: '+39', label: 'IT'),
  PhoneDialCode(code: '+40', label: 'RO'),
  PhoneDialCode(code: '+41', label: 'CH'),
  PhoneDialCode(code: '+43', label: 'AT'),
  PhoneDialCode(code: '+44', label: 'UK'),
  PhoneDialCode(code: '+45', label: 'DK'),
  PhoneDialCode(code: '+46', label: 'SE'),
  PhoneDialCode(code: '+47', label: 'NO'),
  PhoneDialCode(code: '+48', label: 'PL'),
  PhoneDialCode(code: '+49', label: 'DE'),
  PhoneDialCode(code: '+51', label: 'PE'),
  PhoneDialCode(code: '+52', label: 'MX'),
  PhoneDialCode(code: '+54', label: 'AR'),
  PhoneDialCode(code: '+55', label: 'BR'),
  PhoneDialCode(code: '+56', label: 'CL'),
  PhoneDialCode(code: '+57', label: 'CO'),
  PhoneDialCode(code: '+60', label: 'MY'),
  PhoneDialCode(code: '+61', label: 'AU'),
  PhoneDialCode(code: '+62', label: 'ID'),
  PhoneDialCode(code: '+63', label: 'PH'),
  PhoneDialCode(code: '+64', label: 'NZ'),
  PhoneDialCode(code: '+65', label: 'SG'),
  PhoneDialCode(code: '+66', label: 'TH'),
  PhoneDialCode(code: '+81', label: 'JP'),
  PhoneDialCode(code: '+82', label: 'KR'),
  PhoneDialCode(code: '+84', label: 'VN'),
  PhoneDialCode(code: '+86', label: 'CN'),
  PhoneDialCode(code: '+90', label: 'TR'),
  PhoneDialCode(code: '+91', label: 'IN'),
  PhoneDialCode(code: '+92', label: 'PK'),
  PhoneDialCode(code: '+93', label: 'AF'),
  PhoneDialCode(code: '+94', label: 'LK'),
  PhoneDialCode(code: '+95', label: 'MM'),
  PhoneDialCode(code: '+961', label: 'LB'),
  PhoneDialCode(code: '+962', label: 'JO'),
  PhoneDialCode(code: '+963', label: 'SY'),
  PhoneDialCode(code: '+964', label: 'IQ'),
  PhoneDialCode(code: '+965', label: 'KW'),
  PhoneDialCode(code: '+966', label: 'SA'),
  PhoneDialCode(code: '+967', label: 'YE'),
  PhoneDialCode(code: '+968', label: 'OM'),
  PhoneDialCode(code: '+970', label: 'PS'),
  PhoneDialCode(code: '+971', label: 'AE'),
  PhoneDialCode(code: '+972', label: 'IL'),
  PhoneDialCode(code: '+973', label: 'BH'),
  PhoneDialCode(code: '+974', label: 'QA'),
  PhoneDialCode(code: '+98', label: 'IR'),
];
