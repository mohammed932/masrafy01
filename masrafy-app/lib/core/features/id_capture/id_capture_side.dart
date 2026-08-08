/// Which face of the National ID a capture session is for.
///
/// Drives the on-screen title and the uploaded filename only — the frame
/// geometry and the crop are identical for both sides.
enum IdCaptureSide {
  front,
  back;

  /// Filename sent with the presign request. Kept stable and side-tagged so an
  /// object in storage is identifiable without opening it.
  String get filename => 'national_id_${name}.jpg';
}
