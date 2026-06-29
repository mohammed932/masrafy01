// Presigned-upload tickets returned by the customer-scoped profile upload
// endpoints. Data-layer only — consumed inside the repository's upload
// orchestration and never surfaced past it (Principle XXX).

/// `POST /api/v1/profile/photo/upload-url` → presigned PUT target + S3 key.
class PhotoUploadTicketModel {
  const PhotoUploadTicketModel({required this.uploadUrl, required this.s3Key});

  factory PhotoUploadTicketModel.fromJson(Map<String, dynamic> json) =>
      PhotoUploadTicketModel(
        uploadUrl: json['uploadUrl'] as String,
        s3Key: json['s3Key'] as String,
      );

  final String uploadUrl;
  final String s3Key;
}

/// `POST /api/v1/profile/documents/upload-url` → document id + presigned PUT.
class DocUploadTicketModel {
  const DocUploadTicketModel({
    required this.documentId,
    required this.uploadUrl,
    required this.s3Key,
  });

  factory DocUploadTicketModel.fromJson(Map<String, dynamic> json) =>
      DocUploadTicketModel(
        documentId: json['documentId'] as String,
        uploadUrl: json['uploadUrl'] as String,
        s3Key: json['s3Key'] as String,
      );

  final String documentId;
  final String uploadUrl;
  final String s3Key;
}
