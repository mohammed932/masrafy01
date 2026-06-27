import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';
import 'package:app/core/widgets/sliders/masrafy_range_slider.dart';
import 'package:app/core/widgets/sliders/masrafy_value_slider.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/car_questionnaire/car_questionnaire_cubit.dart';
import '../lookups/car_lookups.dart';
import 'car_step_scaffold.dart';

/// Step 1 body — Vehicle & Financing (Figma `4024:2586`). Vehicle condition,
/// model year, an EGP price range slider, a down-payment bucket, and a
/// repayment-years slider. Selects are driven by the cubit (`updateField`).
/// Flow-local widget (Principle XXXII); UI-only.
class CarStepVehicle extends StatelessWidget {
  const CarStepVehicle({super.key, required this.state});

  final CarQuestionnaireState state;

  static const double _minPrice = 100000;
  static const double _maxPrice = 5000000;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<CarQuestionnaireCubit>();

    String egp(double v) => '${l.q_common_currency_egp} ${_compact(v)}';

    return CarStepScaffold(
      title: l.q_car_step1_title,
      stepIndex: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MasrafySelectField<String>(
            label: l.q_car_q_condition,
            hint: l.q_car_select_hint,
            options: CarLookups.vehicleConditions(l),
            value: state.vehicleCondition,
            onSelected: (v) =>
                cubit.updateField(CarField.vehicleCondition, v),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_car_q_model_year,
            hint: l.q_car_select_hint,
            options: CarLookups.modelYears(l),
            value: state.modelYear,
            onSelected: (v) => cubit.updateField(CarField.modelYear, v),
          ),
          Gap(20.h),
          MasrafyRangeSlider(
            label: l.q_car_q_price,
            values: RangeValues(
              state.vehiclePriceStart,
              state.vehiclePriceEnd,
            ),
            min: _minPrice,
            max: _maxPrice,
            divisions: 49,
            valueLabelBuilder: egp,
            minLabel: egp(_minPrice),
            maxLabel: egp(_maxPrice),
            onChanged: (rv) =>
                cubit.updateVehiclePrice(start: rv.start, end: rv.end),
          ),
          Gap(20.h),
          MasrafySelectField<String>(
            label: l.q_car_q_down_payment,
            hint: l.q_car_select_hint,
            options: CarLookups.downPaymentBuckets(l),
            value: state.downPaymentPct,
            onSelected: (v) =>
                cubit.updateField(CarField.downPaymentPct, v),
          ),
          Gap(20.h),
          MasrafyValueSlider(
            label: l.q_car_repayment_label,
            value: state.repaymentPeriod,
            min: 1,
            max: 8,
            divisions: 7,
            valueLabelBuilder: (v) => l.q_car_years(v.toInt()),
            minLabel: l.q_car_years(1),
            maxLabel: l.q_car_years(8),
            onChanged: (v) =>
                cubit.updateField(CarField.repaymentPeriod, v),
          ),
        ],
      ),
    );
  }
}

/// Compact money formatter: 100000 → "100K", 5000000 → "5M".
String _compact(double v) {
  if (v >= 1e6) {
    final m = v / 1e6;
    return '${m == m.roundToDouble() ? m.toInt() : m.toStringAsFixed(1)}M';
  }
  if (v >= 1e3) return '${(v / 1e3).round()}K';
  return v.round().toString();
}
