part of 'comments_widgets.imports.dart';

/// Shimmer skeleton for the comments list area, shown while
/// [CommentsCubit] is in initial-loading state.
///
/// Only the comment tiles are replaced — the composer, divider, and
/// header remain visible above (they are always rendered by
/// [CommentsPanel] regardless of load state). This mirrors the exact
/// layout of [CommentTile] so the transition from skeleton → real
/// content is seamless.
class CommentsSkeleton extends StatelessWidget {
  const CommentsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return PilotShimmer(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 12.h),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < 4; i++) ...[
              _CommentTileSkeleton(),
              Gap(16.h),
            ],
          ],
        ),
      ),
    );
  }
}

/// Skeleton for a single [CommentTile]: avatar circle, name + date,
/// body text lines, and a reaction row — all matching the real tile's
/// exact layout and spacing.
class _CommentTileSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header row: avatar (40) + name + date
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            PilotShimmerCircle(diameter: 40.r),
            Gap(12.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PilotShimmerLine(width: 100.w, height: 14.h),
                  Gap(4.h),
                  PilotShimmerLine(width: 70.w, height: 10.h),
                ],
              ),
            ),
          ],
        ),
        // Body text — indented to match comment tile (52.w = 40 avatar + 12 gap)
        Padding(
          padding: EdgeInsets.only(left: 52.w, top: 8.h),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PilotShimmerLine(width: double.infinity, height: 14.h),
              Gap(4.h),
              PilotShimmerLine(width: 240.w, height: 14.h),
              Gap(12.h),
              // Reaction row: like + count, dislike + count, reply
              Row(
                children: [
                  PilotShimmerBox(width: 50.w, height: 20.h, radius: 4.r),
                  Gap(16.w),
                  PilotShimmerBox(width: 50.w, height: 20.h, radius: 4.r),
                  Gap(24.w),
                  PilotShimmerBox(width: 60.w, height: 20.h, radius: 4.r),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}