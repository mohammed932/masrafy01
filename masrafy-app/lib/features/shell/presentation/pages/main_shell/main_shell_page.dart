part of 'main_shell.imports.dart';

/// The signed-in root: My Loans / Home / Menu as real tabs.
///
/// One route hosts all three bodies in a [MainShellTabStack], so switching is a
/// fade-through on a fixed nav bar — no page push, no route transition, no
/// reload, and each tab keeps its scroll offset and cubit state. Screens opened
/// from a tab (Profile, Offer details…) still push over the shell and return to
/// it with [openMainTab]. Single route-level widget (Principle XXXVI).
@RoutePage()
class MainShellPage extends StatefulWidget {
  const MainShellPage({super.key, this.initialTab = MasrafyAppNavTab.home});

  /// Tab to open on. Login / OTP / Splash land on [MasrafyAppNavTab.home].
  final MasrafyAppNavTab initialTab;

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> {
  @override
  void initState() {
    super.initState();
    mainShellTab.value = widget.initialTab;
  }

  void _select(MasrafyAppNavTab tab) => mainShellTab.value = tab;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);

    return ValueListenableBuilder<MasrafyAppNavTab>(
      valueListenable: mainShellTab,
      builder: (context, tab, _) {
        return PopScope(
          // Android back on a secondary tab returns to Home first, and only
          // then leaves the app — the standard tab-root contract.
          canPop: tab == MasrafyAppNavTab.home,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _select(MasrafyAppNavTab.home);
          },
          child: Scaffold(
            // Each tab body is itself a Scaffold that lifts its own content off
            // the keyboard; resizing here too would shrink it twice.
            resizeToAvoidBottomInset: false,
            body: MainShellTabStack(
              // Children follow `MasrafyAppNavTab`'s declaration order.
              index: tab.index,
              children: const [
                SavedOffersPage(fromTab: true),
                HomePage(),
                AccountPage(),
              ],
            ),
            bottomNavigationBar: MasrafyAppBottomNav(
              active: tab,
              loansLabel: l.home_nav_loans,
              homeLabel: l.home_nav_home,
              menuLabel: l.home_nav_menu,
              onLoans: () => _select(MasrafyAppNavTab.loans),
              onHome: () => _select(MasrafyAppNavTab.home),
              onMenu: () => _select(MasrafyAppNavTab.menu),
            ),
          ),
        );
      },
    );
  }
}
