import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';
import 'package:app/features/saved_offers/domain/repositories/saved_offers_repository.dart';

/// Saved-offers usecase — forwards to the repository (no side effects).
@injectable
class SavedOffersUseCase extends BaseUseCase<SavedOffersRepository> {
  SavedOffersUseCase(super.repository);

  Future<Either<Failure, List<SavedOfferEntity>>> list() => repository.list();

  Future<Either<Failure, Unit>> save(String bankOfferId) =>
      repository.save(bankOfferId);

  Future<Either<Failure, Unit>> remove(String bankOfferId) =>
      repository.remove(bankOfferId);
}
