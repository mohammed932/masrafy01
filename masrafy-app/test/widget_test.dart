import 'package:app/core/di/injection.dart';
import 'package:app/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    await configureDependencies();
  });

  testWidgets('App boots router shell without throwing', (tester) async {
    await tester.pumpWidget(const MasrafyApp());
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
