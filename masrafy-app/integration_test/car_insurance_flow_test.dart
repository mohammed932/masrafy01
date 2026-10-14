/// Drives a REAL car request to the screen that states the cover, on the device.
///
/// Temporary harness. There is no tap automation for the iOS simulator here (macOS
/// Accessibility is denied to the shell, so osascript / cliclick / CGEvent are all out);
/// `integration_test` drives from INSIDE the app and needs no OS permission. It talks to the
/// real backend on localhost:3000 and writes a real application — the same path a customer
/// walks, not a fake.
///
/// It DUMPS the visible text at every step and never fails early, so one run reports exactly
/// how far it got rather than a bare "finder not found" after an eight-minute build.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:app/core/environments/dev_environment.dart';
import 'package:app/main.dart' as app;

Future<void> settle(WidgetTester t, [int ms = 2500]) async {
  final end = DateTime.now().add(Duration(milliseconds: ms));
  while (DateTime.now().isBefore(end)) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

List<String> visibleText() => find
    .byType(Text)
    .evaluate()
    .map((e) => (e.widget as Text).data ?? '')
    .where((s) => s.trim().isNotEmpty)
    .toList();

void dump(String label) => debugPrint('@@STEP $label :: ${visibleText().take(45).join(" | ")}');

Future<bool> tapText(WidgetTester t, String needle, {int ms = 2500}) async {
  final lower = needle.toLowerCase();
  final f = find.byWidgetPredicate((w) =>
      w is Text && ((w.data ?? w.textSpan?.toPlainText() ?? '').toLowerCase().contains(lower)));
  if (f.evaluate().isEmpty) return false;
  await t.tap(f.first, warnIfMissed: false);
  await settle(t, ms);
  return true;
}

/// Types into the field a question owns. Each question widget is keyed by its code.
Future<bool> typeIn(WidgetTester t, String questionCode, String value) async {
  final key = find.byKey(ValueKey(questionCode));
  if (key.evaluate().isEmpty) return false;
  final field = find.descendant(of: key, matching: find.byType(EditableText));
  if (field.evaluate().isEmpty) return false;
  await t.tap(field.first, warnIfMissed: false);
  await t.pump(const Duration(milliseconds: 200));
  await t.enterText(field.first, value);
  await settle(t, 800);
  debugPrint('@@TYPED $questionCode = $value');
  return true;
}

/// Opens a question's select sheet and takes the first real option.
///
/// The sheet's rows are `GestureDetector` + `Text` (not `ListTile`), and their labels differ
/// per question — so rather than guess a finder, this diffs the visible text before and after
/// the sheet opens and taps the first line that APPEARED. That is the option list by
/// construction, whatever the question is.
Future<bool> pickFirst(WidgetTester t, String questionCode) async {
  final key = find.byKey(ValueKey(questionCode));
  if (key.evaluate().isEmpty) return false;

  final before = visibleText().toSet();
  await t.tap(key.first, warnIfMissed: false);
  await settle(t, 1600);

  const chrome = <String>{'Select an option', 'Clear', 'Cancel', 'Done', 'Search'};
  final fresh = visibleText()
      .where((s) => !before.contains(s) && !chrome.contains(s) && s.trim().length > 1)
      .toList();
  if (fresh.isEmpty) {
    debugPrint('@@PICK-FAIL $questionCode (sheet showed nothing new)');
    return false;
  }

  final choice = fresh.first;
  final f = find.byWidgetPredicate(
      (w) => w is Text && (w.data ?? w.textSpan?.toPlainText() ?? '') == choice);
  if (f.evaluate().isEmpty) return false;
  await t.tap(f.first, warnIfMissed: false);
  await settle(t, 1600);
  debugPrint('@@PICKED $questionCode = "$choice"');
  return true;
}

Future<bool> tapNext(WidgetTester t) async {
  for (final label in ['Continue', 'Next', 'Finish', 'See my matches', 'Show']) {
    if (await tapText(t, label, ms: 3500)) {
      debugPrint('@@NEXT via "$label"');
      return true;
    }
  }
  return false;
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('a car request states the cover the programme demands', (t) async {
    app.main(environment: DevEnvironment());
    await settle(t, 9000);
    dump('home');

    // ── loan setup: category -> income basis -> programme name ──
    await tapText(t, 'Auto loan');
    dump('category-picked');
    await tapNext(t);
    dump('income-step');

    // The no-payslip basis. Its wording varies, so try the likely ones in order.
    for (final s in ['No payslip', 'no payslip', 'Surrogate', 'without a payslip', 'Other']) {
      if (await tapText(t, s)) break;
    }
    dump('income-picked');
    await tapNext(t);
    dump('programme-step');

    await tapText(t, 'Down Payment');
    dump('programme-picked');
    await tapNext(t);
    dump('questionnaire-start');

    // ── the questionnaire: fill what this flow requires, step by step ──
    const numerics = <String, String>{
      'car_price': '2000000',
      'car_down_payment': '500000',
      'monthly_income': '60000',
      'current_installments': '0',
      'amount_requested': '1400000',
      'repayment_period_months': '60',
    };
    const selects = <String>[
      'business_months',
      'home_ownership',
      'self_employed_licence',
      'car_origin',
      'vehicle_condition',
      'priority_factor',
      'current_loans',
    ];

    for (var step = 0; step < 14; step += 1) {
      for (final e in numerics.entries) {
        await typeIn(t, e.key, e.value);
      }
      for (final code in selects) {
        await pickFirst(t, code);
      }
      dump('q-step-$step');
      if (visibleText().any((s) => s.toLowerCase().contains('car insurance'))) break;
      if (!await tapNext(t)) {
        debugPrint('@@NO-NEXT at step $step');
        break;
      }
      await settle(t, 2500);
      // The results screen: open the first offer and stop stepping.
      if (visibleText().any((s) => s.contains('%'))) {
        dump('maybe-results-$step');
      }
    }

    dump('after-questionnaire');

    // ── results -> an offer -> its fees ──
    for (final s in ['View offer', 'Details', 'Car Loan', '10%']) {
      if (await tapText(t, s, ms: 4000)) {
        debugPrint('@@OPENED offer via "$s"');
        break;
      }
    }
    await settle(t, 3000);

    // Scroll the details screen to the fees card.
    final scrollables = find.byType(Scrollable);
    if (scrollables.evaluate().isNotEmpty) {
      for (var i = 0; i < 6; i += 1) {
        await t.drag(scrollables.first, const Offset(0, -400));
        await settle(t, 600);
        if (visibleText().any((s) => s.toLowerCase().contains('car insurance'))) break;
      }
    }
    dump('offer-details');

    final texts = visibleText();
    final hasCover = texts.any((s) => s.toLowerCase().contains('car insurance'));
    debugPrint('@@RESULT hasCover=$hasCover');
    debugPrint('@@FINAL ${texts.join(" | ")}');
    expect(hasCover, isTrue, reason: 'the fees card never stated the cover');
  }, timeout: const Timeout(Duration(minutes: 8)));
}
