part of 'notes_widgets.imports.dart';

/// Shimmer skeleton for the notes content area, shown while
/// [NotesCubit] is in loading state.
///
/// Only replaces the note card area — the composer, divider, and
/// "Previous Notes" header remain visible above (they are always
/// rendered by [NotesPanel] regardless of load state). Mirrors the
/// exact layout of [_NoteCard] so the transition is seamless.
class NotesSkeleton extends StatelessWidget {
  const NotesSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.all(12.w),
        decoration: BoxDecoration(
          color: MasrafyColorTheme.of(context).fill.alterSolid,
          border: Border.all(
            color: MasrafyColorTheme.of(context).border.main,
          ),
          borderRadius: BorderRadius.circular(8.r),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MasrafyShimmerLine(width: double.infinity, height: 14.h),
            Gap(6.h),
            MasrafyShimmerLine(width: double.infinity, height: 14.h),
            Gap(6.h),
            MasrafyShimmerLine(width: 180.w, height: 14.h),
          ],
        ),
      ),
    );
  }
}