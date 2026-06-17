// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'car_questionnaire_cubit.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

/// @nodoc
mixin _$CarQuestionnaireState {
  int get currentStep => throw _privateConstructorUsedError; // Step 1
  String? get vehicleCondition => throw _privateConstructorUsedError;
  String? get modelYear => throw _privateConstructorUsedError;
  double get vehiclePriceStart => throw _privateConstructorUsedError;
  double get vehiclePriceEnd => throw _privateConstructorUsedError;
  String? get downPaymentPct => throw _privateConstructorUsedError;
  double get repaymentPeriod => throw _privateConstructorUsedError; // Step 2
  String? get employmentStatus => throw _privateConstructorUsedError;
  String? get monthlyIncome => throw _privateConstructorUsedError;
  bool? get salaryTransfer => throw _privateConstructorUsedError;
  String? get employerApproved => throw _privateConstructorUsedError; // Step 3
  bool? get currentLoans => throw _privateConstructorUsedError;
  String get currentInstallments => throw _privateConstructorUsedError;
  bool? get hasCreditCard => throw _privateConstructorUsedError; // Step 4
  String? get priorityFactor => throw _privateConstructorUsedError;
  bool? get wantsInsurance => throw _privateConstructorUsedError; // UI
  CarField? get openField => throw _privateConstructorUsedError;
  bool get submitted => throw _privateConstructorUsedError;

  /// Create a copy of CarQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CarQuestionnaireStateCopyWith<CarQuestionnaireState> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CarQuestionnaireStateCopyWith<$Res> {
  factory $CarQuestionnaireStateCopyWith(CarQuestionnaireState value,
          $Res Function(CarQuestionnaireState) then) =
      _$CarQuestionnaireStateCopyWithImpl<$Res, CarQuestionnaireState>;
  @useResult
  $Res call(
      {int currentStep,
      String? vehicleCondition,
      String? modelYear,
      double vehiclePriceStart,
      double vehiclePriceEnd,
      String? downPaymentPct,
      double repaymentPeriod,
      String? employmentStatus,
      String? monthlyIncome,
      bool? salaryTransfer,
      String? employerApproved,
      bool? currentLoans,
      String currentInstallments,
      bool? hasCreditCard,
      String? priorityFactor,
      bool? wantsInsurance,
      CarField? openField,
      bool submitted});
}

/// @nodoc
class _$CarQuestionnaireStateCopyWithImpl<$Res,
        $Val extends CarQuestionnaireState>
    implements $CarQuestionnaireStateCopyWith<$Res> {
  _$CarQuestionnaireStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CarQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = null,
    Object? vehicleCondition = freezed,
    Object? modelYear = freezed,
    Object? vehiclePriceStart = null,
    Object? vehiclePriceEnd = null,
    Object? downPaymentPct = freezed,
    Object? repaymentPeriod = null,
    Object? employmentStatus = freezed,
    Object? monthlyIncome = freezed,
    Object? salaryTransfer = freezed,
    Object? employerApproved = freezed,
    Object? currentLoans = freezed,
    Object? currentInstallments = null,
    Object? hasCreditCard = freezed,
    Object? priorityFactor = freezed,
    Object? wantsInsurance = freezed,
    Object? openField = freezed,
    Object? submitted = null,
  }) {
    return _then(_value.copyWith(
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      vehicleCondition: freezed == vehicleCondition
          ? _value.vehicleCondition
          : vehicleCondition // ignore: cast_nullable_to_non_nullable
              as String?,
      modelYear: freezed == modelYear
          ? _value.modelYear
          : modelYear // ignore: cast_nullable_to_non_nullable
              as String?,
      vehiclePriceStart: null == vehiclePriceStart
          ? _value.vehiclePriceStart
          : vehiclePriceStart // ignore: cast_nullable_to_non_nullable
              as double,
      vehiclePriceEnd: null == vehiclePriceEnd
          ? _value.vehiclePriceEnd
          : vehiclePriceEnd // ignore: cast_nullable_to_non_nullable
              as double,
      downPaymentPct: freezed == downPaymentPct
          ? _value.downPaymentPct
          : downPaymentPct // ignore: cast_nullable_to_non_nullable
              as String?,
      repaymentPeriod: null == repaymentPeriod
          ? _value.repaymentPeriod
          : repaymentPeriod // ignore: cast_nullable_to_non_nullable
              as double,
      employmentStatus: freezed == employmentStatus
          ? _value.employmentStatus
          : employmentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      monthlyIncome: freezed == monthlyIncome
          ? _value.monthlyIncome
          : monthlyIncome // ignore: cast_nullable_to_non_nullable
              as String?,
      salaryTransfer: freezed == salaryTransfer
          ? _value.salaryTransfer
          : salaryTransfer // ignore: cast_nullable_to_non_nullable
              as bool?,
      employerApproved: freezed == employerApproved
          ? _value.employerApproved
          : employerApproved // ignore: cast_nullable_to_non_nullable
              as String?,
      currentLoans: freezed == currentLoans
          ? _value.currentLoans
          : currentLoans // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentInstallments: null == currentInstallments
          ? _value.currentInstallments
          : currentInstallments // ignore: cast_nullable_to_non_nullable
              as String,
      hasCreditCard: freezed == hasCreditCard
          ? _value.hasCreditCard
          : hasCreditCard // ignore: cast_nullable_to_non_nullable
              as bool?,
      priorityFactor: freezed == priorityFactor
          ? _value.priorityFactor
          : priorityFactor // ignore: cast_nullable_to_non_nullable
              as String?,
      wantsInsurance: freezed == wantsInsurance
          ? _value.wantsInsurance
          : wantsInsurance // ignore: cast_nullable_to_non_nullable
              as bool?,
      openField: freezed == openField
          ? _value.openField
          : openField // ignore: cast_nullable_to_non_nullable
              as CarField?,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CarQuestionnaireStateImplCopyWith<$Res>
    implements $CarQuestionnaireStateCopyWith<$Res> {
  factory _$$CarQuestionnaireStateImplCopyWith(
          _$CarQuestionnaireStateImpl value,
          $Res Function(_$CarQuestionnaireStateImpl) then) =
      __$$CarQuestionnaireStateImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {int currentStep,
      String? vehicleCondition,
      String? modelYear,
      double vehiclePriceStart,
      double vehiclePriceEnd,
      String? downPaymentPct,
      double repaymentPeriod,
      String? employmentStatus,
      String? monthlyIncome,
      bool? salaryTransfer,
      String? employerApproved,
      bool? currentLoans,
      String currentInstallments,
      bool? hasCreditCard,
      String? priorityFactor,
      bool? wantsInsurance,
      CarField? openField,
      bool submitted});
}

/// @nodoc
class __$$CarQuestionnaireStateImplCopyWithImpl<$Res>
    extends _$CarQuestionnaireStateCopyWithImpl<$Res,
        _$CarQuestionnaireStateImpl>
    implements _$$CarQuestionnaireStateImplCopyWith<$Res> {
  __$$CarQuestionnaireStateImplCopyWithImpl(_$CarQuestionnaireStateImpl _value,
      $Res Function(_$CarQuestionnaireStateImpl) _then)
      : super(_value, _then);

  /// Create a copy of CarQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? currentStep = null,
    Object? vehicleCondition = freezed,
    Object? modelYear = freezed,
    Object? vehiclePriceStart = null,
    Object? vehiclePriceEnd = null,
    Object? downPaymentPct = freezed,
    Object? repaymentPeriod = null,
    Object? employmentStatus = freezed,
    Object? monthlyIncome = freezed,
    Object? salaryTransfer = freezed,
    Object? employerApproved = freezed,
    Object? currentLoans = freezed,
    Object? currentInstallments = null,
    Object? hasCreditCard = freezed,
    Object? priorityFactor = freezed,
    Object? wantsInsurance = freezed,
    Object? openField = freezed,
    Object? submitted = null,
  }) {
    return _then(_$CarQuestionnaireStateImpl(
      currentStep: null == currentStep
          ? _value.currentStep
          : currentStep // ignore: cast_nullable_to_non_nullable
              as int,
      vehicleCondition: freezed == vehicleCondition
          ? _value.vehicleCondition
          : vehicleCondition // ignore: cast_nullable_to_non_nullable
              as String?,
      modelYear: freezed == modelYear
          ? _value.modelYear
          : modelYear // ignore: cast_nullable_to_non_nullable
              as String?,
      vehiclePriceStart: null == vehiclePriceStart
          ? _value.vehiclePriceStart
          : vehiclePriceStart // ignore: cast_nullable_to_non_nullable
              as double,
      vehiclePriceEnd: null == vehiclePriceEnd
          ? _value.vehiclePriceEnd
          : vehiclePriceEnd // ignore: cast_nullable_to_non_nullable
              as double,
      downPaymentPct: freezed == downPaymentPct
          ? _value.downPaymentPct
          : downPaymentPct // ignore: cast_nullable_to_non_nullable
              as String?,
      repaymentPeriod: null == repaymentPeriod
          ? _value.repaymentPeriod
          : repaymentPeriod // ignore: cast_nullable_to_non_nullable
              as double,
      employmentStatus: freezed == employmentStatus
          ? _value.employmentStatus
          : employmentStatus // ignore: cast_nullable_to_non_nullable
              as String?,
      monthlyIncome: freezed == monthlyIncome
          ? _value.monthlyIncome
          : monthlyIncome // ignore: cast_nullable_to_non_nullable
              as String?,
      salaryTransfer: freezed == salaryTransfer
          ? _value.salaryTransfer
          : salaryTransfer // ignore: cast_nullable_to_non_nullable
              as bool?,
      employerApproved: freezed == employerApproved
          ? _value.employerApproved
          : employerApproved // ignore: cast_nullable_to_non_nullable
              as String?,
      currentLoans: freezed == currentLoans
          ? _value.currentLoans
          : currentLoans // ignore: cast_nullable_to_non_nullable
              as bool?,
      currentInstallments: null == currentInstallments
          ? _value.currentInstallments
          : currentInstallments // ignore: cast_nullable_to_non_nullable
              as String,
      hasCreditCard: freezed == hasCreditCard
          ? _value.hasCreditCard
          : hasCreditCard // ignore: cast_nullable_to_non_nullable
              as bool?,
      priorityFactor: freezed == priorityFactor
          ? _value.priorityFactor
          : priorityFactor // ignore: cast_nullable_to_non_nullable
              as String?,
      wantsInsurance: freezed == wantsInsurance
          ? _value.wantsInsurance
          : wantsInsurance // ignore: cast_nullable_to_non_nullable
              as bool?,
      openField: freezed == openField
          ? _value.openField
          : openField // ignore: cast_nullable_to_non_nullable
              as CarField?,
      submitted: null == submitted
          ? _value.submitted
          : submitted // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc

class _$CarQuestionnaireStateImpl extends _CarQuestionnaireState {
  const _$CarQuestionnaireStateImpl(
      {this.currentStep = 0,
      this.vehicleCondition,
      this.modelYear,
      this.vehiclePriceStart = 500000,
      this.vehiclePriceEnd = 1500000,
      this.downPaymentPct,
      this.repaymentPeriod = 5,
      this.employmentStatus,
      this.monthlyIncome,
      this.salaryTransfer,
      this.employerApproved,
      this.currentLoans,
      this.currentInstallments = '',
      this.hasCreditCard,
      this.priorityFactor,
      this.wantsInsurance,
      this.openField,
      this.submitted = false})
      : super._();

  @override
  @JsonKey()
  final int currentStep;
// Step 1
  @override
  final String? vehicleCondition;
  @override
  final String? modelYear;
  @override
  @JsonKey()
  final double vehiclePriceStart;
  @override
  @JsonKey()
  final double vehiclePriceEnd;
  @override
  final String? downPaymentPct;
  @override
  @JsonKey()
  final double repaymentPeriod;
// Step 2
  @override
  final String? employmentStatus;
  @override
  final String? monthlyIncome;
  @override
  final bool? salaryTransfer;
  @override
  final String? employerApproved;
// Step 3
  @override
  final bool? currentLoans;
  @override
  @JsonKey()
  final String currentInstallments;
  @override
  final bool? hasCreditCard;
// Step 4
  @override
  final String? priorityFactor;
  @override
  final bool? wantsInsurance;
// UI
  @override
  final CarField? openField;
  @override
  @JsonKey()
  final bool submitted;

  @override
  String toString() {
    return 'CarQuestionnaireState(currentStep: $currentStep, vehicleCondition: $vehicleCondition, modelYear: $modelYear, vehiclePriceStart: $vehiclePriceStart, vehiclePriceEnd: $vehiclePriceEnd, downPaymentPct: $downPaymentPct, repaymentPeriod: $repaymentPeriod, employmentStatus: $employmentStatus, monthlyIncome: $monthlyIncome, salaryTransfer: $salaryTransfer, employerApproved: $employerApproved, currentLoans: $currentLoans, currentInstallments: $currentInstallments, hasCreditCard: $hasCreditCard, priorityFactor: $priorityFactor, wantsInsurance: $wantsInsurance, openField: $openField, submitted: $submitted)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CarQuestionnaireStateImpl &&
            (identical(other.currentStep, currentStep) ||
                other.currentStep == currentStep) &&
            (identical(other.vehicleCondition, vehicleCondition) ||
                other.vehicleCondition == vehicleCondition) &&
            (identical(other.modelYear, modelYear) ||
                other.modelYear == modelYear) &&
            (identical(other.vehiclePriceStart, vehiclePriceStart) ||
                other.vehiclePriceStart == vehiclePriceStart) &&
            (identical(other.vehiclePriceEnd, vehiclePriceEnd) ||
                other.vehiclePriceEnd == vehiclePriceEnd) &&
            (identical(other.downPaymentPct, downPaymentPct) ||
                other.downPaymentPct == downPaymentPct) &&
            (identical(other.repaymentPeriod, repaymentPeriod) ||
                other.repaymentPeriod == repaymentPeriod) &&
            (identical(other.employmentStatus, employmentStatus) ||
                other.employmentStatus == employmentStatus) &&
            (identical(other.monthlyIncome, monthlyIncome) ||
                other.monthlyIncome == monthlyIncome) &&
            (identical(other.salaryTransfer, salaryTransfer) ||
                other.salaryTransfer == salaryTransfer) &&
            (identical(other.employerApproved, employerApproved) ||
                other.employerApproved == employerApproved) &&
            (identical(other.currentLoans, currentLoans) ||
                other.currentLoans == currentLoans) &&
            (identical(other.currentInstallments, currentInstallments) ||
                other.currentInstallments == currentInstallments) &&
            (identical(other.hasCreditCard, hasCreditCard) ||
                other.hasCreditCard == hasCreditCard) &&
            (identical(other.priorityFactor, priorityFactor) ||
                other.priorityFactor == priorityFactor) &&
            (identical(other.wantsInsurance, wantsInsurance) ||
                other.wantsInsurance == wantsInsurance) &&
            (identical(other.openField, openField) ||
                other.openField == openField) &&
            (identical(other.submitted, submitted) ||
                other.submitted == submitted));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      currentStep,
      vehicleCondition,
      modelYear,
      vehiclePriceStart,
      vehiclePriceEnd,
      downPaymentPct,
      repaymentPeriod,
      employmentStatus,
      monthlyIncome,
      salaryTransfer,
      employerApproved,
      currentLoans,
      currentInstallments,
      hasCreditCard,
      priorityFactor,
      wantsInsurance,
      openField,
      submitted);

  /// Create a copy of CarQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CarQuestionnaireStateImplCopyWith<_$CarQuestionnaireStateImpl>
      get copyWith => __$$CarQuestionnaireStateImplCopyWithImpl<
          _$CarQuestionnaireStateImpl>(this, _$identity);
}

abstract class _CarQuestionnaireState extends CarQuestionnaireState {
  const factory _CarQuestionnaireState(
      {final int currentStep,
      final String? vehicleCondition,
      final String? modelYear,
      final double vehiclePriceStart,
      final double vehiclePriceEnd,
      final String? downPaymentPct,
      final double repaymentPeriod,
      final String? employmentStatus,
      final String? monthlyIncome,
      final bool? salaryTransfer,
      final String? employerApproved,
      final bool? currentLoans,
      final String currentInstallments,
      final bool? hasCreditCard,
      final String? priorityFactor,
      final bool? wantsInsurance,
      final CarField? openField,
      final bool submitted}) = _$CarQuestionnaireStateImpl;
  const _CarQuestionnaireState._() : super._();

  @override
  int get currentStep; // Step 1
  @override
  String? get vehicleCondition;
  @override
  String? get modelYear;
  @override
  double get vehiclePriceStart;
  @override
  double get vehiclePriceEnd;
  @override
  String? get downPaymentPct;
  @override
  double get repaymentPeriod; // Step 2
  @override
  String? get employmentStatus;
  @override
  String? get monthlyIncome;
  @override
  bool? get salaryTransfer;
  @override
  String? get employerApproved; // Step 3
  @override
  bool? get currentLoans;
  @override
  String get currentInstallments;
  @override
  bool? get hasCreditCard; // Step 4
  @override
  String? get priorityFactor;
  @override
  bool? get wantsInsurance; // UI
  @override
  CarField? get openField;
  @override
  bool get submitted;

  /// Create a copy of CarQuestionnaireState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CarQuestionnaireStateImplCopyWith<_$CarQuestionnaireStateImpl>
      get copyWith => throw _privateConstructorUsedError;
}
