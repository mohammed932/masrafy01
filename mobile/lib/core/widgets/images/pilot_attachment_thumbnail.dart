import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/injection/injection.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/images/pilot_network_image.dart';
import 'package:app/core/widgets/shimmers/pilot_shimmer.dart';
import 'package:app/core/widgets/shimmers/pilot_shimmer_box.dart';
import 'package:app/features/attachments/domain/usecases/attachments_usecase.dart';

/// Renders a question/explanation/note attachment as a fixed-size
/// thumbnail. Resolves the (signed, expiring) image URL from
/// [AttachmentsUseCase] on mount and renders via [PilotNetworkImage].
///
/// Defaults match the question annex strip in the Study screen
/// (171×125 dp, 8 dp radius). Pass [width]/[height]/[borderRadius] to
/// override.
class PilotAttachmentThumbnail extends StatefulWidget {
  const PilotAttachmentThumbnail({
    super.key,
    required this.attachmentId,
    this.fileName,
    this.width,
    this.height,
    this.borderRadius,
  });

  final String attachmentId;

  /// Shown in the fallback widget when the URL fetch fails. Optional.
  final String? fileName;

  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  @override
  State<PilotAttachmentThumbnail> createState() =>
      _PilotAttachmentThumbnailState();
}

class _PilotAttachmentThumbnailState extends State<PilotAttachmentThumbnail> {
  late final Future<String?> _urlFuture;

  @override
  void initState() {
    super.initState();
    _urlFuture = _resolve(widget.attachmentId);
  }

  Future<String?> _resolve(String id) async {
    final result = await getIt<AttachmentsUseCase>().getAttachmentUrl(id);
    return result.fold((_) => null, (entity) => entity.url);
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final radius = widget.borderRadius ?? BorderRadius.circular(8.r);
    final w = widget.width ?? 171.w;
    final h = widget.height ?? 125.h;

    return Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: colors.fill.handleBg,
        borderRadius: radius,
        border: Border.all(color: colors.border.main),
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: FutureBuilder<String?>(
          future: _urlFuture,
          builder: (_, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return _ShimmerPlaceholder(width: w, height: h);
            }
            return PilotNetworkImage(
              imageUrl: snap.data,
              // Signed attachment URLs rotate per request — key the cache
              // by the stable attachmentId so the bytes are reused across
              // mounts/sessions instead of being re-downloaded each time
              // the signature changes.
              cacheKey: widget.attachmentId,
              width: w,
              height: h,
              placeholder: (_) => _ShimmerPlaceholder(width: w, height: h),
              errorWidget: (_) =>
                  _Fallback(colors: colors, fileName: widget.fileName),
            );
          },
        ),
      ),
    );
  }
}

class _ShimmerPlaceholder extends StatelessWidget {
  const _ShimmerPlaceholder({required this.width, required this.height});

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return PilotShimmer(
      child: PilotShimmerBox(
        width: width,
        height: height,
        radius: 0,
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.colors, required this.fileName});
  final PilotColorTheme colors;
  final String? fileName;

  @override
  Widget build(BuildContext context) {
    final texts = PilotTextTheme.of(context);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.image_outlined, size: 32.r, color: colors.text.secondary),
        Gap(8.h),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 8.w),
          child: Text(
            fileName ?? 'Attachment',
            style: texts.bodySmall.copyWith(color: colors.text.secondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}
