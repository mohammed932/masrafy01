import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/storage/customer_session_storage.dart';
import '../../data/models/request/otp/otp_request.dart';
import '../../data/models/request/otp/otp_verify_request.dart';
import '../../data/models/request/signup/signup_phone_complete_request.dart';
import '../../data/models/request/signup/signup_phone_start_request.dart';
import '../entities/customer_entity.dart';
import '../entities/otp_challenge_entity.dart';
import '../repositories/customer_auth_repository.dart';

/// Orchestrates the PHONE two-path registration (Principle XIII): start →
/// OTP verify → complete. Plain class (the repository is a flat interface, not
/// a [BaseRepository]); mirrors [AuthUseCase] in that the secure-storage
/// side-effect on a fresh session lives here, NOT in the repository, so the
/// repo stays a pure network-mapping forwarder.
@injectable
class CustomerAuthUseCase {
  CustomerAuthUseCase(this._repo, this._session);

  final CustomerAuthRepository _repo;
  final CustomerSessionStorage _session;

  Future<Either<Failure, OtpChallengeEntity>> signupPhoneStart(
    SignupPhoneStartRequest request,
  ) =>
      _repo.signupPhoneStart(request);

  Future<Either<Failure, OtpChallengeEntity>> requestOtp(OtpRequestRequest request) =>
      _repo.requestOtp(request);

  Future<Either<Failure, OtpVerifyOutcome>> verifyOtp(OtpVerifyRequest request) =>
      _repo.verifyOtp(request);

  Future<Either<Failure, CustomerSessionEntity>> signupPhoneComplete(
    SignupPhoneCompleteRequest request,
  ) async {
    final result = await _repo.signupPhoneComplete(request);
    await result.fold(
      (_) async {},
      (session) => _session.save(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        customerId: session.customer.id,
      ),
    );
    return result;
  }
}
