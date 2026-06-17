// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'business_questionnaire_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$BusinessQuestionnaireState {
  int get currentStep => throw _privateConstructorUsedError; // Step 1
  String? get activityType => throw _privateConstructorUsedError;
  String get businessAge => throw _privateConstructorUsedError;
  String get financingAmount => throw _privateConstructorUsedError;
  String? get financingPurpose => throw _privateConstructorUsedError;
  double get repaymentPeriod => throw _privateConstructorUsedError; // Step 2
  double get monthlyRevenueStart => throw _privateConstructorUsedError;
  double get monthlyRevenueEnd => throw _privateConstructorUsedError;
  bool? get businessAccount => throw _privateConstructorUsedError;
  String? get registered => throw _privateConstructorUsedError;
  bool? get taxRegistration => throw _privateConstructorUsedError; // Step 3
  bool? get currentFacilities => throw _privateConstructorUsedError;
  String get currentInstallments => throw _privateConstructorUsedError;
  bool? get priorRejection => throw _privateConstructorUsedError; // Step 4
  String? get priorityFactor => throw _privateConstructorUsedError;
  bool? get needsConsultation => throw _privateConstructorUsedError; // UI
  BusinessField? get openField => throw _privateConstructorUsedError;
  bool get submitted => throw _privateConstructorUsedError;

  /// Create a copy of BusinessQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BusinessQuestionnaireStateCopyWith<BusinessQuestionnaireState>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BusinessQuestionnaireStateCopyWith<$Res> {
  factory $BusinessQuestionnaireStateCopyWith(BusinessQuestionnaireState value,
          $Res Function(BusinessQuestionnaireState) then) =
      _$BusinessQuestionnaireStateCopyWithImpl<$Res,
          BusinessQuestionnaireState>;
  @useResult
  $Res call(
      {int currentStep,
      String? activityType,
      String businessAge,
      String financingAmount,
      String? financingPurpose,
      double repaymentPeriod,
      double monthlyRevenueStart,
      double monthlyRevenueEnd,
      bool? businessAccount,
      String? registered,
      bool? taxRegistration,
      bool? currentFacilities,
      String currentInstallments,
      bool? priorRejection,
      String? priorityFactor,
      bool? needsConsultation,
      BusinessField? openField,
      bool submitted});
}

/// @nodoc
class _$BusinessQuestionnaireStateCopyWithImpl<$Res,
        $Val extends BusinessQuestionnaireState>
    implements $BusinessQuestionnaireStateCopyWith<$Res> {
  _$BusinessQuestionnaireStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BusinessQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = null,
    Object? activityType = freezed,
    Object? businessAge = null,
    Object? financingAmount = null,
    Object? financingPurpose = freezed,
    Object? repaymentPeriod = null,
    Object? monthlyRevenueStart = null,
    Object? monthlyRevenueEnd = null,
    Object? businessAccount = freezed,
    Object? registered = freezed,
    Object? taxRegistration = freezed,
    Object? currentFacilities = freezed,
    Object? currentInstallments = null,
    Object? priorRejection = freezed,
    Object? priorityFactor = freezed,
    Object? needsConsultation = freezed,
    Object? openField = freezed,
    Object? submitted = null,
  }) {
    return _then(_value.copyWith(
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      activityType: freezed == activityType
          ? _value.activityType
          : activityType // ignore: cast_nullable_to_non_nullable
              as String?,
      businessAge: null == businessAge
          ? _value.businessAge
          : businessAge // ignore: cast_nullable_to_non_nullable
              as String,
      financingAmount: null == financingAmount
          ? _value.financingAmount
          : financingAmount // ignore: cast_nullable_to_non_nullable
              as String,
      financingPurpose: freezed == financingPurpose
          ? _value.financingPurpose
          : financingPurpose // ignore: cast_nullable_to_non_nullable
              as String?,
      repaymentPeriod: null == repaymentPeriod
          ? _value.repaymentPeriod
          : repaymentPeriod // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenueStart: null == monthlyRevenueStart
          ? _value.monthlyRevenueStart
          : monthlyRevenueStart // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenueEnd: null == monthlyRevenueEnd
          ? _value.monthlyRevenueEnd
          : monthlyRevenueEnd // ignore: cast_nullable_to_non_nullable
              as double,
      businessAccount: freezed == businessAccount
          ? _value.businessAccount
          : businessAccount // ignore: cast_nullable_to_non_nullable
              as bool?,
      registered: freezed == registered
          ? _value.registered
          : registered // ignore: cast_nullable_to_non_nullable
              as String?,
      taxRegistration: freezed == taxRegistration
          ? _value.taxRegistration
          : taxRegistration // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentFacilities: freezed == currentFacilities
          ? _value.currentFacilities
          : currentFacilities // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentInstallments: null == currentInstallments
          ? _value.currentInstallments
          : currentInstallments // ignore: cast_nullable_to_non_nullable
              as String,
      priorRejection: freezed == priorRejection
          ? _value.priorRejection
          : priorRejection // ignore: cast_nullable_to_non_nullable
              as bool?,
      priorityFactor: freezed == priorityFactor
          ? _value.priorityFactor
          : priorityFactor // ignore: cast_nullable_to_non_nullable
              as String?,
      needsConsultation: freezed == needsConsultation
          ? _value.needsConsultation
          : needsConsultation // ignore: cast_nullable_to_non_nullable
              as bool?,
      openField: freezed == openField
          ? _value.openField
          : openField // ignore: cast_nullable_to_non_nullable
              as BusinessField?,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BusinessQuestionnaireStateImplCopyWith<$Res>
    implements $BusinessQuestionnaireStateCopyWith<$Res> {
  factory _$$BusinessQuestionnaireStateImplCopyWith(
          _$BusinessQuestionnaireStateImpl value,
          $Res Function(_$BusinessQuestionnaireStateImpl) then) =
      __$$BusinessQuestionnaireStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int currentStep,
      String? activityType,
      String businessAge,
      String financingAmount,
      String? financingPurpose,
      double repaymentPeriod,
      double monthlyRevenueStart,
      double monthlyRevenueEnd,
      bool? businessAccount,
      String? registered,
      bool? taxRegistration,
      bool? currentFacilities,
      String currentInstallments,
      bool? priorRejection,
      String? priorityFactor,
      bool? needsConsultation,
      BusinessField? openField,
      bool submitted});
}

/// @nodoc
class __$$BusinessQuestionnaireStateImplCopyWithImpl<$Res>
    extends _$BusinessQuestionnaireStateCopyWithImpl<$Res,
        _$BusinessQuestionnaireStateImpl>
    implements _$$BusinessQuestionnaireStateImplCopyWith<$Res> {
  __$$BusinessQuestionnaireStateImplCopyWithImpl(
      _$BusinessQuestionnaireStateImpl _value,
      $Res Function(_$BusinessQuestionnaireStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of BusinessQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = null,
    Object? activityType = freezed,
    Object? businessAge = null,
    Object? financingAmount = null,
    Object? financingPurpose = freezed,
    Object? repaymentPeriod = null,
    Object? monthlyRevenueStart = null,
    Object? monthlyRevenueEnd = null,
    Object? businessAccount = freezed,
    Object? registered = freezed,
    Object? taxRegistration = freezed,
    Object? currentFacilities = freezed,
    Object? currentInstallments = null,
    Object? priorRejection = freezed,
    Object? priorityFactor = freezed,
    Object? needsConsultation = freezed,
    Object? openField = freezed,
    Object? submitted = null,
  }) {
    return _then(_$BusinessQuestionnaireStateImpl(
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      activityType: freezed == activityType
          ? _value.activityType
          : activityType // ignore: cast_nullable_to_non_nullable
              as String?,
      businessAge: null == businessAge
          ? _value.businessAge
          : businessAge // ignore: cast_nullable_to_non_nullable
              as String,
      financingAmount: null == financingAmount
          ? _value.financingAmount
          : financingAmount // ignore: cast_nullable_to_non_nullable
              as String,
      financingPurpose: freezed == financingPurpose
          ? _value.financingPurpose
          : financingPurpose // ignore: cast_nullable_to_non_nullable
              as String?,
      repaymentPeriod: null == repaymentPeriod
          ? _value.repaymentPeriod
          : repaymentPeriod // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenueStart: null == monthlyRevenueStart
          ? _value.monthlyRevenueStart
          : monthlyRevenueStart // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenueEnd: null == monthlyRevenueEnd
          ? _value.monthlyRevenueEnd
          : monthlyRevenueEnd // ignore: cast_nullable_to_non_nullable
              as double,
      businessAccount: freezed == businessAccount
          ? _value.businessAccount
          : businessAccount // ignore: cast_nullable_to_non_nullable
              as bool?,
      registered: freezed == registered
          ? _value.registered
          : registered // ignore: cast_nullable_to_non_nullable
              as String?,
      taxRegistration: freezed == taxRegistration
          ? _value.taxRegistration
          : taxRegistration // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentFacilities: freezed == currentFacilities
          ? _value.currentFacilities
          : currentFacilities // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentInstallments: null == currentInstallments
          ? _value.currentInstallments
          : currentInstallments // ignore: cast_nullable_to_non_nullable
              as String,
      priorRejection: freezed == priorRejection
          ? _value.priorRejection
          : priorRejection // ignore: cast_nullable_to_non_nullable
              as bool?,
      priorityFactor: freezed == priorityFactor
          ? _value.priorityFactor
          : priorityFactor // ignore: cast_nullable_to_non_nullable
              as String?,
      needsConsultation: freezed == needsConsultation
          ? _value.needsConsultation
          : needsConsultation // ignore: cast_nullable_to_non_nullable
              as bool?,
      openField: freezed == openField
          ? _value.openField
          : openField // ignore: cast_nullable_to_non_nullable
              as BusinessField?,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$BusinessQuestionnaireStateImpl extends _BusinessQuestionnaireState {
  const _$BusinessQuestionnaireStateImpl(
      {this.currentStep = 0,
      this.activityType,
      this.businessAge = '',
      this.financingAmount = '',
      this.financingPurpose,
      this.repaymentPeriod = 4,
      this.monthlyRevenueStart = 2000000,
      this.monthlyRevenueEnd = 5000000,
      this.businessAccount,
      this.registered,
      this.taxRegistration,
      this.currentFacilities,
      this.currentInstallments = '',
      this.priorRejection,
      this.priorityFactor,
      this.needsConsultation,
      this.openField,
      this.submitted = false})
      : super._();

  @override
  @JsonKey()
  final int currentStep;
// Step 1
  @override
  final String? activityType;
  @override
  @JsonKey()
  final String businessAge;
  @override
  @JsonKey()
  final String financingAmount;
  @override
  final String? financingPurpose;
  @override
  @JsonKey()
  final double repaymentPeriod;
// Step 2
  @override
  @JsonKey()
  final double monthlyRevenueStart;
  @override
  @JsonKey()
  final double monthlyRevenueEnd;
  @override
  final bool? businessAccount;
  @override
  final String? registered;
  @override
  final bool? taxRegistration;
// Step 3
  @override
  final bool? currentFacilities;
  @override
  @JsonKey()
  final String currentInstallments;
  @override
  final bool? priorRejection;
// Step 4
  @override
  final String? priorityFactor;
  @override
  final bool? needsConsultation;
// UI
  @override
  final BusinessField? openField;
  @override
  @JsonKey()
  final bool submitted;

  @override
  String toString() {
    return 'BusinessQuestionnaireState(currentStep: $currentStep, activityType: $activityType, businessAge: $businessAge, financingAmount: $financingAmount, financingPurpose: $financingPurpose, repaymentPeriod: $repaymentPeriod, monthlyRevenueStart: $monthlyRevenueStart, monthlyRevenueEnd: $monthlyRevenueEnd, businessAccount: $businessAccount, registered: $registered, taxRegistration: $taxRegistration, currentFacilities: $currentFacilities, currentInstallments: $currentInstallments, priorRejection: $priorRejection, priorityFactor: $priorityFactor, needsConsultation: $needsConsultation, openField: $openField, submitted: $submitted)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BusinessQuestionnaireStateImpl &&
            (identical(other.currentStep, currentStep) ||
                other.currentStep == currentStep) &&
            (identical(other.activityType, activityType) ||
                other.activityType == activityType) &&
            (identical(other.businessAge, businessAge) ||
                other.businessAge == businessAge) &&
            (identical(other.financingAmount, financingAmount) ||
                other.financingAmount == financingAmount) &&
            (identical(other.financingPurpose, financingPurpose) ||
                other.financingPurpose == financingPurpose) &&
            (identical(other.repaymentPeriod, repaymentPeriod) ||
                other.repaymentPeriod == repaymentPeriod) &&
            (identical(other.monthlyRevenueStart, monthlyRevenueStart) ||
                other.monthlyRevenueStart == monthlyRevenueStart) &&
            (identical(other.monthlyRevenueEnd, monthlyRevenueEnd) ||
                other.monthlyRevenueEnd == monthlyRevenueEnd) &&
            (identical(other.businessAccount, businessAccount) ||
                other.businessAccount == businessAccount) &&
            (identical(other.registered, registered) ||
                other.registered == registered) &&
            (identical(other.taxRegistration, taxRegistration) ||
                other.taxRegistration == taxRegistration) &&
            (identical(other.currentFacilities, currentFacilities) ||
                other.currentFacilities == currentFacilities) &&
            (identical(other.currentInstallments, currentInstallments) ||
                other.currentInstallments == currentInstallments) &&
            (identical(other.priorRejection, priorRejection) ||
                other.priorRejection == priorRejection) &&
            (identical(other.priorityFactor, priorityFactor) ||
                other.priorityFactor == priorityFactor) &&
            (identical(other.needsConsultation, needsConsultation) ||
                other.needsConsultation == needsConsultation) &&
            (identical(other.openField, openField) ||
                other.openField == openField) &&
            (identical(other.submitted, submitted) ||
                other.submitted == submitted));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      currentStep,
      activityType,
      businessAge,
      financingAmount,
      financingPurpose,
      repaymentPeriod,
      monthlyRevenueStart,
      monthlyRevenueEnd,
      businessAccount,
      registered,
      taxRegistration,
      currentFacilities,
      currentInstallments,
      priorRejection,
      priorityFactor,
      needsConsultation,
      openField,
      submitted);

  /// Create a copy of BusinessQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BusinessQuestionnaireStateImplCopyWith<_$BusinessQuestionnaireStateImpl>
      get copyWith => __$$BusinessQuestionnaireStateImplCopyWithImpl<
          _$BusinessQuestionnaireStateImpl>(this, _$identity);
}

abstract class _BusinessQuestionnaireState extends BusinessQuestionnaireState {
  const factory _BusinessQuestionnaireState(
      {final int currentStep,
      final String? activityType,
      final String businessAge,
      final String financingAmount,
      final String? financingPurpose,
      final double repaymentPeriod,
      final double monthlyRevenueStart,
      final double monthlyRevenueEnd,
      final bool? businessAccount,
      final String? registered,
      final bool? taxRegistration,
      final bool? currentFacilities,
      final String currentInstallments,
      final bool? priorRejection,
      final String? priorityFactor,
      final bool? needsConsultation,
      final BusinessField? openField,
      final bool submitted}) = _$BusinessQuestionnaireStateImpl;
  const _BusinessQuestionnaireState._() : super._();

  @override
  int get currentStep; // Step 1
  @override
  String? get activityType;
  @override
  String get businessAge;
  @override
  String get financingAmount;
  @override
  String? get financingPurpose;
  @override
  double get repaymentPeriod; // Step 2
  @override
  double get monthlyRevenueStart;
  @override
  double get monthlyRevenueEnd;
  @override
  bool? get businessAccount;
  @override
  String? get registered;
  @override
  bool? get taxRegistration; // Step 3
  @override
  bool? get currentFacilities;
  @override
  String get currentInstallments;
  @override
  bool? get priorRejection; // Step 4
  @override
  String? get priorityFactor;
  @override
  bool? get needsConsultation; // UI
  @override
  BusinessField? get openField;
  @override
  bool get submitted;

  /// Create a copy of BusinessQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BusinessQuestionnaireStateImplCopyWith<_$BusinessQuestionnaireStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
