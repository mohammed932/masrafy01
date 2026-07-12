import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:app/features/profile/domain/entities/customer_profile_entity.dart';

/// Profile repository contract (Principle X + XXX). Every method returns
/// `Either<Failure, T>`.
abstract class ProfileRepository extends BaseRepository<ProfileRemoteDataSource> {
  ProfileRepository(super.remoteDataSource);

  Future<Either<Failure, CustomerProfileEntity>> getMe();
}
