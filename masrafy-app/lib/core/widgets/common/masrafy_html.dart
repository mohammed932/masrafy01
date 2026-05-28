import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/images/masrafy_network_image.dart';

/// Renders backend-supplied HTML as styled text.
///
/// The Masrafy backend returns question titles, option text, and
/// explanation bodies as HTML strings (e.g. `<p>...</p>`,
/// `<strong>...</strong>`, `<u class="hl">...</u>`). Plain `Text`
/// widgets render the markup literally — this wrapper hands the
/// payload to `flutter_html` with the app's typography + color
/// defaults pre-applied.
///
/// Use [textColor], [fontSize], and [fontWeight] to override per
/// caller (e.g. red for an incorrect option, larger for the question
/// title). Margins are stripped on `<p>` and `<body>` so the HTML
/// flows like a `Text` widget — no surprise vertical gaps inside
/// already-padded cards.
class MasrafyHtml extends StatelessWidget {
  const MasrafyHtml({
    super.key,
    required this.data,
    this.textColor,
    this.fontSize,
    this.fontWeight,
    this.lineHeight,
  });

  final String data;
  final Color? textColor;
  final double? fontSize;
  final FontWeight? fontWeight;

  /// Multiplier of font size — same convention as CSS `line-height`.
  final double? lineHeight;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final body = texts.body;
    final size = fontSize ?? body.fontSize ?? 14;
    final color = textColor ?? colors.text.heading;

    return Html(
      data: data,
      style: {
        'body': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
          color: color,
          fontFamily: body.fontFamily,
          fontSize: FontSize(size),
          fontWeight: fontWeight ?? body.fontWeight,
          lineHeight: LineHeight(lineHeight ?? 1.57),
        ),
        'p': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
        ),
        'strong': Style(fontWeight: FontWeight.w600),
        'b': Style(fontWeight: FontWeight.w600),
        'em': Style(fontStyle: FontStyle.italic),
        'i': Style(fontStyle: FontStyle.italic),
        'u': Style(textDecoration: TextDecoration.underline),
      },
      // Replace flutter_html's default `Image.network` (no caching) with
      // MasrafyNetworkImage, which goes through CachedNetworkImage so question
      // figures are read from disk on subsequent loads instead of refetched.
      extensions: [
        TagExtension(
          tagsToExtend: const {'img'},
          builder: (ctx) {
            final src = ctx.attributes['src'];
            final width = double.tryParse(ctx.attributes['width'] ?? '');
            final height = double.tryParse(ctx.attributes['height'] ?? '');
            return MasrafyNetworkImage(
              imageUrl: src,
              width: width,
              height: height,
              fit: BoxFit.contain,
            );
          },
        ),
      ],
    );
  }
}
