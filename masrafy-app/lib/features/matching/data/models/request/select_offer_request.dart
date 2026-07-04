/// Request DTO for `POST /api/v1/applications/{applicationId}/select-offer`.
/// The customer proceeds with one returned offer (Feature 008 user-intent gate).
class SelectOfferRequest {
  const SelectOfferRequest({required this.bankOfferId});

  final String bankOfferId;

  Map<String, dynamic> toJson() => {'bankOfferId': bankOfferId};
}
