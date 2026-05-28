/// Country dialing codes used by Masrafy.
///
/// Per constitution Project Context, the platform serves Egyptian customers
/// only. All mobile numbers persisted by the platform are E.164-formatted
/// with the Egypt prefix `+20`. UI inputs SHOULD render this prefix as a
/// non-editable affordance (e.g. `InputDecoration.prefixText`) and only
/// collect the local-part digits from the user.
abstract final class MasrafyCountryCode {
  /// Egypt — `+20`. The platform is Egypt-only by product scope.
  static const String egypt = '+20';
}
