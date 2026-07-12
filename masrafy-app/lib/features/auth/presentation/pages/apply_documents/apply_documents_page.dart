part of 'apply_documents.imports.dart';

/// Apply-time document gate (Constitution v9.1.0). Reached when the user taps
/// "Apply" on an offer and the National ID front/back aren't both on file yet.
/// Profile photo is optional (v9.1.0) and not collected here. Pre-checks
/// already-uploaded documents, lets the user add the missing ones, and pops
/// `true` once both ID sides are present so the offer screen auto-resumes
/// select-offer. A collapsing gradient sliver hero over a
/// rounded sheet (Principle XXXIII / A35); the single route-level widget for
/// this file (Principle XXXVI).
@RoutePage()
class ApplyDocumentsPage extends StatelessWidget {
  const ApplyDocumentsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<ApplyDocumentsCubit>(
      create: (_) => getIt<ApplyDocumentsCubit>()..load(),
      child: const _ApplyDocumentsView(),
    );
  }
}

class _ApplyDocumentsView extends StatelessWidget {
  const _ApplyDocumentsView();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;
    final title = l.apply_docs_title;
    final subtitle = l.apply_docs_subtitle;

    return Scaffold(
      backgroundColor: colors.bg.container,
      body: BlocConsumer<ApplyDocumentsCubit, ApplyDocumentsState>(
        listenWhen: (p, c) => p.error != c.error && c.error != null,
        listener: (ctx, state) {
          if (state.error != null && !state.isStatusError) {
            MasrafyToast.error(ctx, l.apply_docs_upload_error);
          }
        },
        builder: (ctx, state) {
          final cubit = ctx.read<ApplyDocumentsCubit>();
          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: title,
                  subtitle: subtitle,
                  onBack: () => ctx.router.maybePop<bool>(false),
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: title,
                    subtitle: subtitle,
                    hasBack: true,
                    minHeight: 180.h,
                  ),
                  collapsedHeight: topInset + kToolbarHeight + 14,
                ),
              ),
              SliverToBoxAdapter(
                child: Transform.translate(
                  offset: Offset(0, -28.h),
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: colors.bg.container,
                      borderRadius: BorderRadiusDirectional.only(
                        topStart: Radius.circular(28.r),
                        topEnd: Radius.circular(28.r),
                      ),
                    ),
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                          24.w, 40.h, 24.w, 30.h),
                      child: state.isLoadingStatus
                          ? const _ApplyDocumentsShimmer()
                          : state.isStatusError
                              ? Padding(
                                  padding: EdgeInsets.only(top: 40.h),
                                  child: MasrafyFetchErrorState(
                                    onRetry: cubit.load,
                                  ),
                                )
                              : _ApplyDocumentsForm(state: state, cubit: cubit),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// The three upload tiles + the continue CTA (status already loaded).
class _ApplyDocumentsForm extends StatelessWidget {
  const _ApplyDocumentsForm({required this.state, required this.cubit});

  final ApplyDocumentsState state;
  final ApplyDocumentsCubit cubit;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MasrafyNationalIdUploader(
          sectionLabel: l.signup_national_id_label,
          sectionHint: l.signup_national_id_hint,
          frontLabel: l.signup_id_front,
          backLabel: l.signup_id_back,
          frontSubtitle: l.signup_id_tap_to_upload,
          backSubtitle: l.signup_id_tap_to_upload,
          frontUploaded: state.idFrontUploaded,
          backUploaded: state.idBackUploaded,
          onTapFront: state.idFrontUploading
              ? null
              : () => cubit.pickAndUploadNationalId(front: true),
          onTapBack: state.idBackUploading
              ? null
              : () => cubit.pickAndUploadNationalId(front: false),
        ),
        Gap(28.h),
        MasrafyGradientButton(
          label: l.apply_docs_cta,
          isLoading: state.anyUploading,
          onPressed: state.canSubmit
              ? () => context.router.maybePop<bool>(true)
              : null,
        ),
      ],
    );
  }
}

/// Shape-matched shimmer (Principle XXXIV): the section label + a two-card
/// National ID row + the CTA bar.
class _ApplyDocumentsShimmer extends StatelessWidget {
  const _ApplyDocumentsShimmer();

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MasrafyShimmerBox(width: 160, height: 12, radius: 6),
          Gap(12.h),
          Row(
            children: [
              Expanded(child: MasrafyShimmerBox(height: 100, radius: 14)),
              Gap(10.w),
              Expanded(child: MasrafyShimmerBox(height: 100, radius: 14)),
            ],
          ),
          Gap(28.h),
          MasrafyShimmerBox(height: 52, radius: 14),
        ],
      ),
    );
  }
}
