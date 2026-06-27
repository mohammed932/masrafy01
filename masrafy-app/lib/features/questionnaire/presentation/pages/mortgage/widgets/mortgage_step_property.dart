import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/core/widgets/sliders/masrafy_range_slider.dart';
import 'package:app/core/widgets/sliders/masrafy_value_slider.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import '../lookups/mortgage_lookups.dart';
import 'mortgage_step_scaffold.dart';

/// Step 1 body — Property & Financing Details (Figma `4024:2197`). Property
/// type / compound / registration / governorate + address, an EGP property-
/// value range slider, a down-payment bucket, and a repayment-years slider.
/// Stateful to own the address [TextEditingController]; selects are driven by
/// the cubit (`updateField`). Flow-local widget (Principle XXXII); UI-only.
class MortgageStepProperty extends StatefulWidget {
  const MortgageStepProperty({super.key, required this.state});

  final MortgageQuestionnaireState state;

  @override
  State<MortgageStepProperty> createState() => _MortgageStepPropertyState();
}

class _MortgageStepPropertyState extends State<MortgageStepProperty> {
  late final TextEditingController _address =
      TextEditingController(text: widget.state.address);

  static const double _minValue = 1500000;
  static const double _maxValue = 50000000;

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<MortgageQuestionnaireCubit>();
    final state = widget.state;

    String egp(double v) => '${l.q_common_currency_egp} ${_compact(v)}';

    return MortgageStepScaffold(
      title: l.q_mortgage_step1_title,
      stepIndex: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_mortgage_q_property_type,
            hint: l.q_mortgage_hint_property_type,
            options: MortgageLookups.propertyTypes(l),
            value: state.propertyType,
            onSelected: (v) =>
                cubit.updateField(MortgageField.propertyType, v),
          ),
          Gap(20.h),
          MasrafySelectField<bool>(
            label: l.q_mortgage_q_in_compound,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.yesNo(l),
            value: state.inCompound,
            onSelected: (v) => cubit.updateField(MortgageField.inCompound, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_mortgage_q_registration_status,
            hint: l.q_mortgage_select_hint,
            options: MortgageLookups.registrationStatuses(l),
            value: state.registrationStatus,
            onSelected: (v) =>
                cubit.updateField(MortgageField.registrationStatus, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_mortgage_q_address,
            hint: l.q_mortgage_hint_governorate,
            options: MortgageLookups.governorates(l),
            value: state.governorate,
            onSelected: (v) => cubit.updateField(MortgageField.governorate, v),
            showSearch: true,
          ),
          Gap(12.h),
          MasrafyLabeledField(
            label: l.q_mortgage_address_label,
            hint: l.q_mortgage_address_hint,
            controller: _address,
            onChanged: (v) => cubit.updateField(MortgageField.address, v),
          ),
          Gap(20.h),
          MasrafyRangeSlider(
            label: l.q_mortgage_q_property_value,
            values: RangeValues(
              state.propertyValueStart,
              state.propertyValueEnd,
            ),
            min: _minValue,
            max: _maxValue,
            divisions: 97,
            valueLabelBuilder: egp,
            minLabel: egp(_minValue),
            maxLabel: egp(_maxValue),
            onChanged: (rv) =>
                cubit.updatePropertyValue(start: rv.start, end: rv.end),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_mortgage_q_down_payment,
            hint: l.q_mortgage_hint_down_payment,
            options: MortgageLookups.downPaymentBuckets(l),
            value: state.downPaymentPct,
            onSelected: (v) =>
                cubit.updateField(MortgageField.downPaymentPct, v),
          ),
          Gap(20.h),
          MasrafyValueSlider(
            label: l.q_mortgage_repayment_label,
            value: state.repaymentPeriod,
            min: 5,
            max: 30,
            divisions: 25,
            valueLabelBuilder: (v) => l.q_mortgage_years(v.toInt()),
            minLabel: l.q_mortgage_years(5),
            maxLabel: l.q_mortgage_years(30),
            onChanged: (v) =>
                cubit.updateField(MortgageField.repaymentPeriod, v),
          ),
        ],
      ),
    );
  }
}

/// Compact money formatter: 1500000 → "1.5M", 50000000 → "50M".
String _compact(double v) {
  if (v >= 1e6) {
    final m = v / 1e6;
    return '${m == m.roundToDouble() ? m.toInt() : m.toStringAsFixed(1)}M';
  }
  if (v >= 1e3) return '${(v / 1e3).round()}K';
  return v.round().toString();
}
