part of 'comments_widgets.imports.dart';

/// T129 — 5 rules verbatim from spec FR-044 / Figma §6.3. Footer "Got it".
class CommunityGuidelinesSheet extends StatelessWidget {
  const CommunityGuidelinesSheet({super.key});

  static Future<void> show(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16.r)),
        ),
        builder: (_) => const CommunityGuidelinesSheet(),
      );

  static const List<_GuidelineRule> _rules = [
    _GuidelineRule(
      title: 'Badly worded questions',
      body:
          'Our questions reflect original EASA questions. We agree, that some questions are badly worded. However, questions are also badly worded on the real examination too. Anyway, our aim is to keep the database as close to the original questions as possible. Please, do not post vulgar comments or comments of frustration. It is only allowed to discuss relevant topics relating to the question. Violating posts will be deleted and users banned from further posting.',
    ),
    _GuidelineRule(
      title: 'Masrafy response to comments',
      body:
          'Our team does their best to monitor comments and provide you with responses where it is possible. However, the monitoring is done on irregular basis = we can not guarantee a response within a specific time-frame.',
    ),
    _GuidelineRule(
      title: 'Do not offend other users',
      body:
          'if you do not like a post someone else has made, do not offend or insult that user. Violating posts will be deleted and user banned from further posting.',
    ),
    _GuidelineRule(
      title: 'Do not refer to answer with letters A, B, … only within the comments',
      body:
          'it is not sufficient. The order of answers is changing in each test. Therefore, please write the text of the question.',
    ),
    _GuidelineRule(
      title: 'You are allowed to delete your comment for a limited time',
      body:
          'Check your comment carefully before submission and remember that you can\'t delete them after 24 hours of posting them.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(20.w, 20.h, 20.w, 20.h + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Community Guidelines',
                  style: texts.heading5.bold().copyWith(color: colors.text.primary),
                ),
              ),
              IconButton(
                icon: Icon(Icons.close, size: 20.r, color: colors.text.secondary),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          Gap(16.h),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (int i = 0; i < _rules.length; i++) ...[
                    _RuleItem(number: i + 1, rule: _rules[i], colors: colors, texts: texts),
                    if (i < _rules.length - 1) Gap(16.h),
                  ],
                ],
              ),
            ),
          ),
          Gap(20.h),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(backgroundColor: colors.primary.main),
              child: Text(
                'Got it',
                style: texts.body.semiBold().copyWith(color: colors.bg.container),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GuidelineRule {
  const _GuidelineRule({required this.title, required this.body});
  final String title;
  final String body;
}

class _RuleItem extends StatelessWidget {
  const _RuleItem({
    required this.number,
    required this.rule,
    required this.colors,
    required this.texts,
  });

  final int number;
  final _GuidelineRule rule;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24.r,
          height: 24.r,
          decoration: BoxDecoration(
            color: colors.primary.main,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            '$number',
            style: texts.bodySmall.semiBold().copyWith(color: colors.bg.container),
          ),
        ),
        Gap(12.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                rule.title,
                style: texts.body.semiBold().copyWith(color: colors.text.primary),
              ),
              Gap(4.h),
              Text(
                rule.body,
                style: texts.bodySmall.copyWith(color: colors.text.secondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
