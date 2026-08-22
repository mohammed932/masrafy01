/// Every refusal code the engine can send has a SENTENCE, in both locales.
///
/// The mapper's own comment has asked for this since the codes were added: a build that
/// predates a condition must fall back to the generic line, and a code the backend already
/// sends must never reach a customer as `MULTI_UNIT_NOT_CONFIRMED`. Both halves are only
/// checkable by walking the closed lists, which is what this does.
library;

import 'package:app/features/matching/presentation/mappers/figures_unavailable_reason.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'package:app/l10n/generated/app_localizations_ar.dart';
import 'package:app/l10n/generated/app_localizations_en.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final locales = <String, AppLocalizations>{
    'en': AppLocalizationsEn(),
    'ar': AppLocalizationsAr(),
  };

  group('gateReasonLabel', () {
    for (final entry in locales.entries) {
      test('every gate reason has a ${entry.key} sentence', () {
        final seen = <String>{};
        for (final code in GateReasonCodes.all) {
          final label = gateReasonLabel(entry.value, code);
          expect(label, isNotEmpty, reason: '$code has no sentence');
          // The raw token must never be what the customer reads.
          expect(label, isNot(contains(code)), reason: '$code rendered as its own token');
          seen.add(label);
        }
        // Only the fallback may share its sentence, and it shares it with nobody here:
        // every listed code says something specific, which is the point of the list.
        expect(seen.length, GateReasonCodes.all.length,
            reason: 'two gate reasons render the same sentence in ${entry.key}');
      });

      test('an unknown gate reason falls back to the generic line in ${entry.key}', () {
        // A backend that ships a new condition before the app does must degrade, not leak.
        expect(
          gateReasonLabel(entry.value, 'A_CONDITION_THIS_BUILD_HAS_NEVER_HEARD_OF'),
          entry.value.gate_not_met,
        );
        expect(gateReasonLabel(entry.value, null), entry.value.gate_not_met);
      });
    }

    test('carries the two self-employed conditions the collateral products added', () {
      // Named explicitly: these are the codes a bank turns on per program, so a rename on
      // either side has to fail here rather than on a customer's screen.
      expect(GateReasonCodes.all, contains('SELF_EMPLOYED_DOCS_MISSING'));
      expect(GateReasonCodes.all, contains('BUSINESS_TOO_NEW'));
    });
  });

  group('figuresUnavailableLabel', () {
    for (final entry in locales.entries) {
      test('every unavailable reason has a ${entry.key} sentence', () {
        for (final code in FiguresUnavailableReasons.all) {
          final label = figuresUnavailableLabel(entry.value, code);
          expect(label, isNotEmpty, reason: '$code has no sentence');
          expect(label, isNot(contains(code)));
        }
      });

      test('a refused condition shows the CONDITION, not the generic line (${entry.key})', () {
        // The whole reason `gateReasonCode` travels: "a condition your answers don't meet" is
        // true and useless, and the specific line names something the customer can change.
        final specific = figuresUnavailableLabel(
          entry.value,
          FiguresUnavailableReasons.productRuleGateFailed,
          gateReasonCode: GateReasonCodes.downPaymentBelowMin,
        );
        expect(specific, entry.value.gate_down_payment_below_min);
        expect(specific, isNot(entry.value.gate_not_met));
      });

      test('a refused condition with no code still says something (${entry.key})', () {
        expect(
          figuresUnavailableLabel(
            entry.value,
            FiguresUnavailableReasons.productRuleGateFailed,
          ),
          entry.value.gate_not_met,
        );
      });
    }
  });
}
