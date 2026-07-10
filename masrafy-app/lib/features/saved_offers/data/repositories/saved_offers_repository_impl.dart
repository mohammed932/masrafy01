import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';
import 'package:app/features/saved_offers/domain/repositories/saved_offers_repository.dart';

/// Thin network-mapping forwarder for [SavedOffersRepository]
/// (Principles X + XXX). Each call routes through [ApiHandler.callApi]; the
/// list maps wire models → entities.
@Injectable(as: SavedOffersRepository)
class SavedOffersRepositoryImpl extends SavedOffersRepository {
  SavedOffersRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, List<SavedOfferEntity>>> list() async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.getSavedOffers());
    return result.map((m) => m.toEntities());
  }

  @override
  Future<Either<Failure, Unit>> save(String bankOfferId) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.saveOffer(bankOfferId));
    return result.map((_) => unit);
  }

  @override
  Future<Either<Failure, Unit>> remove(String bankOfferId) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.removeOffer(bankOfferId));
    return result.map((_) => unit);
  }
}
