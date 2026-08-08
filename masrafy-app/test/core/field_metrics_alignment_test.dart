import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/core/widgets/input_controls/masrafy_dob_selector.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';
import 'package:app/core/widgets/input_controls/masrafy_labeled_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_phone_field.dart';
import 'package:app/core/widgets/input_controls/masrafy_select_field.dart';

/// Guards the shared field geometry: every single-line control on a form must
/// render exactly [MasrafyFieldMetrics.height]. A regression here is invisible
/// to the analyzer — an input can silently squash (padding-derived height) or a
/// suffix `IconButton` can inflate its box — and only shows up on device.
void main() {
  Future<void> pumpForm(WidgetTester tester, {Widget? suffix}) async {
    // Portrait phone surface equal to the design size, so every ScreenUtil
    // factor is 1.0 — the default 800×600 test window would scale `.w`/`.sp` up
    // and `.h` down, a ratio no real device has.
    tester.view.physicalSize = const Size(360 * 3, 800 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ScreenUtilInit(
        designSize: const Size(360, 800),
        builder: (_, __) => MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  MasrafyLabeledField(
                    label: 'First name',
                    controller: TextEditingController(),
                    hint: 'David',
                    onChanged: (_) {},
                  ),
                  MasrafyLabeledField(
                    label: 'Password',
                    controller: TextEditingController(),
                    hint: 'Create a password',
                    obscure: true,
                    suffix: suffix,
                    onChanged: (_) {},
                  ),
                  MasrafyPhoneField(
                    dialCode: '+20',
                    onDialCodeChanged: (_) {},
                    phoneNumber: '',
                    onPhoneNumberChanged: (_) {},
                    uppercaseLabels: true,
                  ),
                  MasrafyDobSelector(
                    label: 'Date of birth',
                    hint: 'Select date of birth',
                    onTap: () {},
                  ),
                  MasrafySelectField<String>(
                    label: 'Governorate',
                    hint: 'Select',
                    options: const [
                      MasrafySelectOption(value: 'cai', label: 'Cairo'),
                    ],
                    value: null,
                    onSelected: (_) {},
                  ),
                  MasrafySelectField<String>(
                    label: 'Governorate (dense)',
                    hint: 'Select',
                    dense: true,
                    options: const [
                      MasrafySelectOption(value: 'cai', label: 'Cairo'),
                    ],
                    value: null,
                    onSelected: (_) {},
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// The decorated box of one control, scoped to its own widget so the phone
  /// row's inner collapsed `TextField` can't be mistaken for a field box.
  Finder boxOf(Type widget, Type box, {int at = 0}) => find
      .descendant(of: find.byType(widget), matching: find.byType(box))
      .at(at);

  testWidgets('every single-line field is MasrafyFieldMetrics.height tall',
      (tester) async {
    await pumpForm(tester);

    final fields = <String, Finder>{
      'text input': boxOf(MasrafyLabeledField, TextField),
      'phone dial-code select': boxOf(MasrafyPhoneField, Container),
      'phone number input': boxOf(MasrafyPhoneField, Container, at: 1),
      'date of birth': boxOf(MasrafyDobSelector, Container),
      'select (default)': boxOf(MasrafySelectField<String>, Container),
      'select (dense)': find
          .descendant(
            of: find.byType(MasrafySelectField<String>).last,
            matching: find.byType(Container),
          )
          .first,
    };

    fields.forEach((name, finder) {
      expect(
        tester.getSize(finder).height,
        moreOrLessEquals(MasrafyFieldMetrics.height, epsilon: 1),
        reason: '$name is off the shared field height',
      );
    });
  });

  testWidgets('a suffix icon does not inflate the field', (tester) async {
    await pumpForm(
      tester,
      suffix: IconButton(
        onPressed: () {},
        icon: const Icon(Icons.visibility_off_outlined),
      ),
    );

    final withSuffix = find
        .descendant(
          of: find.byType(MasrafyLabeledField).last,
          matching: find.byType(TextField),
        )
        .first;

    expect(
      tester.getSize(withSuffix).height,
      moreOrLessEquals(MasrafyFieldMetrics.height, epsilon: 1),
    );
  });
}
