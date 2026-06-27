import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import '../models/saved_offer_model.dart';

/// Saved-offers datasource. Routes to the masrafy `/api/v1/saved-offers`
/// surface via `appNetwork` (Principle XXX — no `package:dio` here).
@injectable
class SavedOffersRemoteDataSource extends BaseRemoteDataSource {
  SavedOffersRemoteDataSource(super.appNetwork);

  Future<SavedOffersListModel> getSavedOffers() async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.savedOffers),
    );
    return SavedOffersListModel.fromJson(_unwrap(json));
  }

  Future<void> removeOffer(String bankOfferId) async {
    await appNetwork.delete(
      MasrafyEndpoint(endpoint: ApiStrings.savedOfferDelete(bankOfferId)),
    );
  }

  Map<String, dynamic> _unwrap(dynamic envelope) {
    if (envelope is Map<String, dynamic>) {
      final data = envelope['data'];
      if (data is Map<String, dynamic>) return data;
      return envelope;
    }
    return const {};
  }
}
