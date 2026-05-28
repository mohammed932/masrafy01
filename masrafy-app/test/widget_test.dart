import 'package:app/core/di/injection.dart';
import 'package:app/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    await configureDependencies();
  });

  testWidgets('Placeholder screen renders brand', (tester) async {
    await tester.pumpWidget(const MasrafyApp());
    await tester.pump();

    expect(find.text('Masrafy'), findsOneWidget);
    expect(find.textContaining('Data + domain'), findsOneWidget);
  });
}
