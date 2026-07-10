/// Request DTO for `POST /api/v1/saved-offers`. Bookmarks one matched offer.
class SaveOfferRequest {
  const SaveOfferRequest({required this.bankOfferId});

  final String bankOfferId;

  Map<String, dynamic> toJson() => {'bankOfferId': bankOfferId};
}
