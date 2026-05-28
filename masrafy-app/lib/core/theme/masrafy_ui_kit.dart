import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

class MasrafyUiKitInitializer extends StatelessWidget {
  final Widget child;

  const MasrafyUiKitInitializer({super.key, required this.child});

  static const double tabletBreakpoint = 600;

  static const Size phoneDesignSize = Size(393, 852);
  // Tablet design size is intentionally smaller than the actual iPad
  // viewport so ScreenUtil's `.sp`/`.w`/`.h` scale factor grows (e.g.
  // 820 / 640 ≈ 1.28). The result is iPad-proportional typography
  // (body ≈ 17pt, headings ≈ 28-30pt — matches Apple HIG) and
  // generous spacing without per-widget breakpoint logic.
  static const Size tabletDesignSize = Size(640, 900);

  static Size designSizeFor(Size screen) =>
      screen.shortestSide >= tabletBreakpoint
          ? tabletDesignSize
          : phoneDesignSize;

  static bool isTablet(BuildContext context) =>
      MediaQuery.sizeOf(context).shortestSide >= tabletBreakpoint;

  static void update(BuildContext context) {
    ScreenUtil.init(
      context,
      designSize: designSizeFor(MediaQuery.sizeOf(context)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screen = Size(constraints.maxWidth, constraints.maxHeight);
        return ScreenUtilInit(
          designSize: designSizeFor(screen),
          minTextAdapt: true,
          splitScreenMode: true,
          builder: (context, _) => child,
        );
      },
    );
  }
}
