import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Static, Figma-driven content for one onboarding slide. Onboarding is a
/// presentation-only feature (no datasource/repository) per the chosen
/// design: illustration + localized title + body.
class OnboardingSlideData {
  const OnboardingSlideData({
    required this.image,
    required this.title,
    required this.body,
  });

  final String image;
  final String title;
  final String body;
}

/// The 3 onboarding slides (Figma `71:256` / `71:188` / `71:221`).
List<OnboardingSlideData> onboardingSlidesData(AppLocalizations l) => [
      OnboardingSlideData(
        image: MasrafyAssets.onboardingSlide1,
        title: l.onboarding_slide1_title,
        body: l.onboarding_slide1_body,
      ),
      OnboardingSlideData(
        image: MasrafyAssets.onboardingSlide2,
        title: l.onboarding_slide2_title,
        body: l.onboarding_slide2_body,
      ),
      OnboardingSlideData(
        image: MasrafyAssets.onboardingSlide3,
        title: l.onboarding_slide3_title,
        body: l.onboarding_slide3_body,
      ),
    ];
