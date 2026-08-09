import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/masrafy_ui_kit.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/steppers/masrafy_segmented_progress.dart';
import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_test/flutter_test.dart';

/// The questionnaire step hero — the longest real title/subtitle pair, plus the
/// segmented progress bar, which together made the expanded Column overflow.
const _title = 'About the financing';
const _subtitle = "We'll match you with banks that specialise in your needs";

Widget _harness({required double keyboardProgress}) => MaterialApp(
      home: ScreenUtilInit(
        designSize: MasrafyUiKitInitializer.phoneDesignSize,
        builder: (_, __) => MasrafyColorThemeProvider(
          theme: const MasrafyLightTheme(),
          child: Builder(
            builder: (context) {
              final collapsedHeight =
                  MediaQuery.viewPaddingOf(context).top + kToolbarHeight + 14;
              return Scaffold(
                body: CustomScrollView(
                  slivers: [
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: MasrafySliverGradientHeaderDelegate(
                        title: _title,
                        subtitle: _subtitle,
                        onBack: () {},
                        bottom: const MasrafySegmentedProgress(
                          total: 4,
                          current: 0,
                        ),
                        expandedHeight:
                            MasrafyGradientHeader.expandedHeightFor(
                          context,
                          title: _title,
                          subtitle: _subtitle,
                          hasBack: true,
                          bottomExtent: 18.h + 4.h,
                          minHeight: 180.h,
                        ),
                        collapsedHeight: collapsedHeight,
                        keyboardProgress: keyboardProgress,
                      ),
                    ),
                    SliverToBoxAdapter(child: SizedBox(height: 1200.h)),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );

double _headerHeight(WidgetTester tester) =>
    tester.getSize(find.byType(MasrafyGradientHeader)).height;

void main() {
  // Regression: collapsing the hero for the keyboard shortened the delegate's
  // maxExtent but left collapseProgress derived from shrinkOffset, which is 0
  // when the user has not scrolled. The header therefore kept rendering its
  // full-size bottom-aligned title + subtitle + progress bar inside a
  // toolbar-height box: "BOTTOM OVERFLOWED BY 9.4 PIXELS".
  testWidgets('hero does not overflow at any keyboard progress',
      (tester) async {
    for (var step = 0; step <= 20; step++) {
      final progress = step / 20;
      await tester.pumpWidget(_harness(keyboardProgress: progress));
      await tester.pump();

      expect(
        tester.takeException(),
        isNull,
        reason: 'overflowed at keyboardProgress=$progress',
      );
    }
  });

  testWidgets('hero shrinks to exactly the collapsed height at progress 1',
      (tester) async {
    await tester.pumpWidget(_harness(keyboardProgress: 0));
    await tester.pump();
    final expanded = _headerHeight(tester);

    await tester.pumpWidget(_harness(keyboardProgress: 1));
    await tester.pump();
    final collapsed = _headerHeight(tester);

    final topInset =
        tester.view.viewPadding.top / tester.view.devicePixelRatio;
    expect(collapsed, closeTo(topInset + kToolbarHeight + 14, 0.5));
    expect(collapsed, lessThan(expanded));
  });

  // Same defect via the other collapse driver: scrolling shortens the header
  // through exactly the same range, so a long title overflowed on scroll too,
  // independently of the keyboard.
  testWidgets('hero does not overflow while scrolling it closed',
      (tester) async {
    await tester.pumpWidget(_harness(keyboardProgress: 0));
    await tester.pump();
    final range = _headerHeight(tester) -
        (tester.view.viewPadding.top / tester.view.devicePixelRatio +
            kToolbarHeight +
            14);

    for (var step = 0; step <= 20; step++) {
      await tester.drag(
        find.byType(CustomScrollView),
        Offset(0, -range / 20),
      );
      await tester.pump();

      expect(
        tester.takeException(),
        isNull,
        reason: 'overflowed after scroll step $step',
      );
    }
  });

  testWidgets('progress 0 leaves the header untouched (no regression for '
      'screens that never pass keyboardProgress)', (tester) async {
    await tester.pumpWidget(_harness(keyboardProgress: 0));
    await tester.pump();

    expect(tester.takeException(), isNull);
    // Fully expanded means the big hero title is the one on screen.
    expect(find.text(_title), findsOneWidget);
    expect(find.text(_subtitle), findsOneWidget);
  });
}
