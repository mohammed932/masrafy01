import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/profile/data/models/request/update_profile_request.dart';
import 'package:app/features/profile/domain/entities/customer_profile_entity.dart';
import 'package:app/features/profile/domain/repositories/profile_repository.dart';

/// Thin network-mapping forwarder for [ProfileRepository] (Principles X + XXX).
@Injectable(as: ProfileRepository)
class ProfileRepositoryImpl extends ProfileRepository {
  ProfileRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, CustomerProfileEntity>> getMe() async {
    final result = await ApiHandler.callApi(() => remoteDataSource.getMe());
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, CustomerProfileEntity>> updateProfile(
    UpdateProfileRequest request,
  ) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.updateProfile(request));
    return result.map((m) => m.toEntity());
  }
}
