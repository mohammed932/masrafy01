import 'package:app/main.dart';
import 'package:app/core/di/injection.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    await configureDependencies(prod: false);
  });

  testWidgets('Login screen renders brand + sign-in button', (tester) async {
    await tester.pumpWidget(const MasrafyApp());
    await tester.pump();

    expect(find.text('Masrafy'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Phone number'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
  });
}
