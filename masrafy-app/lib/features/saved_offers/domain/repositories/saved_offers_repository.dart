import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/saved_offers/data/datasources/saved_offers_remote_datasource.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';

/// Saved-offers repository contract (Principle X + XXX). Every method returns
/// `Either<Failure, T>`.
abstract class SavedOffersRepository
    extends BaseRepository<SavedOffersRemoteDataSource> {
  SavedOffersRepository(super.remoteDataSource);

  Future<Either<Failure, List<SavedOfferEntity>>> list();

  Future<Either<Failure, Unit>> save(String bankOfferId);

  Future<Either<Failure, Unit>> remove(String bankOfferId);
}
