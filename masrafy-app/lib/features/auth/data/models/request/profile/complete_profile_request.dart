import 'dart:typed_data';

// Profile-completion request payloads (Principle XXXVII). The root
// [CompleteProfileRequest] carries the scalar fields; the nested upload
// payloads describe the presign / S3-PUT / confirm steps. All co-located in
// one file per the payload-co-location convention.

/// `POST /api/v1/auth/profile/complete`. Password is sent ONLY for PHONE
/// customers setting it for the first time (omitted/null for SOCIAL).
class CompleteProfileRequest {
  const CompleteProfileRequest({
    required this.firstName,
    required this.lastName,
    required this.birthday,
    this.password,
  });

  final String firstName;
  final String lastName;
  final DateTime birthday;
  final String? password;

  Map<String, dynamic> toJson() => {
        'firstName': firstName,
        'lastName': lastName,
        'birthday': _isoDate(birthday),
        if (password != null && password!.isNotEmpty) 'password': password,
      };

  /// `yyyy-MM-dd` (date only — age derived server-side, never stored).
  static String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

/// `POST /api/v1/profile/photo/upload-url`.
class PhotoUploadUrlRequest {
  const PhotoUploadUrlRequest({required this.mimeType, required this.sizeBytes});

  final String mimeType;
  final int sizeBytes;

  Map<String, dynamic> toJson() => {'mimeType': mimeType, 'sizeBytes': sizeBytes};
}

/// `POST /api/v1/profile/photo/confirm-upload`.
class PhotoConfirmRequest {
  const PhotoConfirmRequest({required this.s3Key});

  final String s3Key;

  Map<String, dynamic> toJson() => {'s3Key': s3Key};
}

/// `POST /api/v1/profile/documents/upload-url`. [documentType] is
/// `NATIONAL_ID_FRONT` or `NATIONAL_ID_BACK`.
class ProfileDocUploadUrlRequest {
  const ProfileDocUploadUrlRequest({
    required this.documentType,
    required this.mimeType,
    required this.sizeBytes,
    required this.originalFilename,
  });

  final String documentType;
  final String mimeType;
  final int sizeBytes;
  final String originalFilename;

  Map<String, dynamic> toJson() => {
        'documentType': documentType,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        'originalFilename': originalFilename,
      };
}

/// Datasource-level transport for the raw S3 PUT (>2 params → typed DTO, A28).
class S3UploadRequest {
  const S3UploadRequest({
    required this.url,
    required this.bytes,
    required this.contentType,
  });

  final String url;
  final Uint8List bytes;
  final String contentType;
}

/// Repo-level request to upload the profile photo (bytes + content type).
class UploadAssetRequest {
  const UploadAssetRequest({required this.bytes, required this.contentType});

  final Uint8List bytes;
  final String contentType;
}

/// Repo-level request to upload one side of the National ID (>2 params → DTO).
class UploadNationalIdRequest {
  const UploadNationalIdRequest({
    required this.documentType,
    required this.bytes,
    required this.contentType,
    required this.filename,
  });

  /// `NATIONAL_ID_FRONT` or `NATIONAL_ID_BACK`.
  final String documentType;
  final Uint8List bytes;
  final String contentType;
  final String filename;
}
