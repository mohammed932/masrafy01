import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

/// T143 — stateless 5-star rater.
/// [rating] = 0 means no rating yet. [onChanged] fires on tap.
class MasrafyStarRating extends StatelessWidget {
  const MasrafyStarRating({
    super.key,
    required this.rating,
    required this.onChanged,
    this.starSize,
    this.spacing,
    this.readOnly = false,
  });

  final int rating;
  final ValueChanged<int> onChanged;
  final double? starSize;
  final double? spacing;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final size = starSize ?? 28.r;
    final gap = spacing ?? 4.w;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starNumber = index + 1;
        final isFilled = starNumber <= rating;
        return Padding(
          padding: EdgeInsetsDirectional.only(end: index < 4 ? gap : 0),
          child: GestureDetector(
            onTap: readOnly ? null : () => onChanged(starNumber),
            child: Icon(
              isFilled ? Icons.star_rounded : Icons.star_outline_rounded,
              size: size,
              color: isFilled
                  ? Colors.amber
                  : colors.border.main,
            ),
          ),
        );
      }),
    );
  }
}
