class SubjectModel {
  final int subjectId;
  final String subjectCode;
  final String subjectName;

  const SubjectModel({
    required this.subjectId,
    required this.subjectCode,
    required this.subjectName,
  });

  factory SubjectModel.fromJson(Map<String, dynamic> json) => SubjectModel(
    subjectId: (json['subjectId'] as num).toInt(),
    subjectCode: json['subjectCode'] as String,
    subjectName: json['subjectName'] as String,
  );
}
