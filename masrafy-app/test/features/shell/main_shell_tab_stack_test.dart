import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app/features/shell/presentation/pages/main_shell/widgets/main_shell_tab_stack.dart';

/// Counts how many times its state was created, so a rebuilt (rather than
/// preserved) tab is visible to the test.
class _Counter extends StatefulWidget {
  const _Counter(this.label);

  final String label;

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  static final Map<String, int> mounts = {};
  int taps = 0;

  @override
  void initState() {
    super.initState();
    mounts.update(widget.label, (v) => v + 1, ifAbsent: () => 1);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => taps++),
      child: ColoredBox(
        color: const Color(0xFF000000),
        child: Center(child: Text('${widget.label}:$taps')),
      ),
    );
  }
}

Widget _host(ValueNotifier<int> index) => MaterialApp(
      home: ValueListenableBuilder<int>(
        valueListenable: index,
        builder: (_, i, __) => MainShellTabStack(
          index: i,
          children: const [_Counter('a'), _Counter('b')],
        ),
      ),
    );

void main() {
  setUp(_CounterState.mounts.clear);

  testWidgets('keeps every tab mounted exactly once across switches',
      (tester) async {
    final index = ValueNotifier(0);
    await tester.pumpWidget(_host(index));

    // Tab "a" holds state; switching away and back must not rebuild it.
    await tester.tap(find.text('a:0'));
    await tester.pump();
    expect(find.text('a:1'), findsOneWidget);

    index.value = 1;
    await tester.pumpAndSettle();
    index.value = 0;
    await tester.pumpAndSettle();

    expect(find.text('a:1'), findsOneWidget);
    expect(_CounterState.mounts, {'a': 1, 'b': 1});
  });

  testWidgets('the hidden tab is inert — taps land on the active one',
      (tester) async {
    final index = ValueNotifier(0);
    await tester.pumpWidget(_host(index));

    index.value = 1;
    await tester.pumpAndSettle();

    // "a" is still mounted and still covers the screen; the tap must fall
    // through to "b" rather than hitting the hidden tab.
    await tester.tap(find.text('a:0'), warnIfMissed: false);
    await tester.pump();

    expect(find.text('a:0'), findsOneWidget);
    expect(find.text('b:1'), findsOneWidget);
  });

  testWidgets('fades the incoming tab in instead of cutting', (tester) async {
    final index = ValueNotifier(0);
    await tester.pumpWidget(_host(index));

    index.value = 1;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 80));

    double opacityOf(String label) => tester
        .widget<Opacity>(
          find.ancestor(of: find.text(label), matching: find.byType(Opacity)),
        )
        .opacity;

    expect(opacityOf('b:0'), greaterThan(0));
    expect(opacityOf('b:0'), lessThan(1));
    // The outgoing tab stays fully painted underneath, so nothing flashes.
    expect(opacityOf('a:0'), 1);

    await tester.pumpAndSettle();
    expect(opacityOf('b:0'), 1);
    expect(opacityOf('a:0'), 0);
  });
}
