import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/masrafy_ui_kit.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';
import 'package:app/features/offers/presentation/pages/offer_details/offer_details.imports.dart';
import 'package:app/features/offers/presentation/pages/results/results.imports.dart';
import 'package:app/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';

/// Pumps [child] inside the minimum shell the offers screens need: a localized
/// [MaterialApp] (English), a `ScreenUtil` design context, and a light
/// [MasrafyColorTheme]. The pages reach `context.router` only inside tap
/// callbacks, so no router scope is required just to lay them out.
Widget _harness(Widget child) => MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: ScreenUtilInit(
        designSize: MasrafyUiKitInitializer.phoneDesignSize,
        builder: (_, __) => MasrafyColorThemeProvider(
          theme: const MasrafyLightTheme(),
          child: child,
        ),
      ),
    );

void main() {
  final args = MatchResultsArgs.mock(
    loanTypeKey: 'mortgage',
    amount: 150000,
    durationMonths: 36,
  );

  testWidgets('OfferDetailsPage lays out without throwing (regression: blank)',
      (tester) async {
    await tester.pumpWidget(
      _harness(OfferDetailsPage(offer: args.offers.first, summary: args)),
    );
    await tester.pumpAndSettle();

    // The stat grid previously forced infinite height (stretch row inside an
    // unbounded sliver column), which blanked the whole screen.
    expect(tester.takeException(), isNull);
    expect(find.text('Mortgage Loan'), findsOneWidget);
    expect(find.text('TOTAL LOAN'), findsOneWidget);
    expect(find.text('Apply for this offer'), findsOneWidget);
  });

  testWidgets('MatchResultsPage lays out without throwing', (tester) async {
    await tester.pumpWidget(_harness(MatchResultsPage(args: args)));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Your top matches are ready'), findsOneWidget);
    // Every match card leads with the bank and what it matched. The mock
    // offers carry no bank name, so the subline is the whole head — one per
    // card, all three of them.
    expect(find.text('Mortgage · 36 months'), findsNWidgets(3));
  });
}
