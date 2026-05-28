part of 'login.imports.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.initialPhone, required this.onForgotPassword});
  final String? initialPhone;
  final VoidCallback onForgotPassword;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late final TextEditingController _phone =
      TextEditingController(text: widget.initialPhone ?? '');
  final _pwd = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.initialPhone != null && widget.initialPhone!.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context
            .read<LoginCubit>()
            .updateField(LoginField.phone, widget.initialPhone!);
      });
    }
  }

  @override
  void dispose() {
    _phone.dispose();
    _pwd.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<LoginCubit, LoginState>(
      listener: (ctx, state) {
        if (state.isFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text(state.error!.code)),
          );
        }
      },
      builder: (ctx, state) {
        final busy = state.isBusy;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_login_title)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l10n.auth_login_field_mobile),
                  onChanged: (v) => ctx
                      .read<LoginCubit>()
                      .updateField(LoginField.phone, v.trim()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _pwd,
                  obscureText: true,
                  decoration: InputDecoration(labelText: l10n.auth_login_field_password),
                  onChanged: (v) => ctx
                      .read<LoginCubit>()
                      .updateField(LoginField.password, v),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy ? null : () => ctx.read<LoginCubit>().submit(),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_login_action_submit),
                ),
                TextButton(
                  onPressed: widget.onForgotPassword,
                  child: Text(l10n.auth_login_action_forgot),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
