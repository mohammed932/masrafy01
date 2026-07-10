/// Outcome of a device biometric prompt. Distinct from [Failure] (Principle
/// XXX) since this wraps a local OS capability, not a network/repository
/// call — `local_auth` is queried directly by [BiometricService].
enum BiometricAuthResult { success, cancelled, notAvailable, notEnrolled, lockedOut, error }
