// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

// **************************************************************************
// InjectableConfigGenerator
// **************************************************************************

// ignore_for_file: type=lint
// coverage:ignore-file

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:get_it/get_it.dart' as _i174;
import 'package:injectable/injectable.dart' as _i526;
import 'package:shared_preferences/shared_preferences.dart' as _i460;

import '../cache/secure_storage.dart' as _i111;
import '../cache/shared_prefs_service.dart' as _i459;
import '../features/attachment_editor/cubit/attachment_editor_cubit.dart'
    as _i974;
import '../features/comments/cubit/comments_cubit.dart' as _i970;
import '../features/comments/data/repositories/comments_repository_impl.dart'
    as _i347;
import '../features/comments/domain/repositories/comments_repository.dart'
    as _i671;
import '../features/comments/domain/usecases/comments_usecase.dart' as _i434;
import '../features/exam_reports/cubit/exam_reports_cubit.dart' as _i562;
import '../features/notes/cubit/notes_cubit.dart' as _i975;
import '../features/notes/data/repositories/notes_repository_impl.dart'
    as _i131;
import '../features/notes/domain/repositories/notes_repository.dart' as _i987;
import '../features/notes/domain/usecases/notes_usecase.dart' as _i1025;
import '../features/portal_auth/cubit/portal_auth_handshake_cubit.dart'
    as _i696;
import '../network/dio_helper.dart' as _i172;
import '../network/network_interface.dart' as _i490;
import '../router/router.dart' as _i285;
import '../services/auth/session_expiration_handler.dart' as _i255;
import '../services/deep_links/deep_link_service.dart' as _i214;
import '../services/device_id_service.dart' as _i148;
import '../services/firebase_auth_service.dart' as _i592;
import '../services/integrity/integrity_service.dart' as _i505;
import '../services/notifications/fcm_token_registrar.dart' as _i926;
import '../services/notifications/local_notification_service.dart' as _i42;
import '../services/notifications/notification_router.dart' as _i10;
import '../services/notifications/push_notification_service.dart' as _i967;
import '../services/pending_navigation_service.dart' as _i394;
import '../services/unread_count/unread_count_service.dart' as _i74;
import '../services/user_service.dart' as _i381;
import '../theme/theme_bloc/theme_bloc.dart' as _i599;

extension GetItInjectableX on _i174.GetIt {
// initializes the registration of main-scope dependencies inside of GetIt
  _i174.GetIt init({
    String? environment,
    _i526.EnvironmentFilter? environmentFilter,
  }) {
    final gh = _i526.GetItHelper(
      this,
      environment,
      environmentFilter,
    );
    gh.factory<_i974.AttachmentEditorCubit>(
        () => _i974.AttachmentEditorCubit());
    gh.factory<_i592.FirebaseAuthService>(() => _i592.FirebaseAuthService());
    gh.singleton<_i111.SecureStorage>(() => _i111.SecureStorage());
    gh.singleton<_i394.PendingNavigationService>(
        () => _i394.PendingNavigationService());
    gh.singleton<_i381.UserService>(() => _i381.UserService());
    gh.lazySingleton<_i42.LocalNotificationService>(
        () => _i42.LocalNotificationService());
    gh.lazySingleton<_i490.BaseNetwork>(() => _i172.DioHelper());
    gh.singleton<_i459.SharedPrefsService>(
        () => _i459.SharedPrefsService(gh<_i460.SharedPreferences>()));
    gh.factory<_i599.ThemeBloc>(
        () => _i599.ThemeBloc(gh<_i459.SharedPrefsService>()));
    gh.lazySingleton<_i505.IntegrityService>(
        () => _i505.IntegrityService(gh<_i490.BaseNetwork>()));
    gh.lazySingleton<_i214.DeepLinkService>(
        () => _i214.DeepLinkService(gh<InvalidType>()));
    gh.factory<_i987.NotesRepository>(
        () => _i131.NotesRepositoryImpl(gh<InvalidType>()));
    gh.factory<_i1025.NotesUseCase>(
        () => _i1025.NotesUseCase(gh<_i987.NotesRepository>()));
    gh.factory<_i696.PortalAuthHandshakeCubit>(
        () => _i696.PortalAuthHandshakeCubit(gh<_i592.FirebaseAuthService>()));
    gh.lazySingleton<_i10.NotificationRouter>(() => _i10.NotificationRouter(
          gh<InvalidType>(),
          gh<InvalidType>(),
        ));
    gh.lazySingleton<_i74.UnreadCountService>(
        () => _i74.UnreadCountService(gh<InvalidType>()));
    gh.factory<_i562.ExamReportsCubit>(
        () => _i562.ExamReportsCubit(gh<InvalidType>()));
    gh.factory<_i671.CommentsRepository>(
        () => _i347.CommentsRepositoryImpl(gh<InvalidType>()));
    gh.factory<_i434.CommentsUseCase>(
        () => _i434.CommentsUseCase(gh<_i671.CommentsRepository>()));
    gh.factory<_i975.NotesCubit>(
        () => _i975.NotesCubit(gh<_i1025.NotesUseCase>()));
    gh.singleton<_i148.DeviceIdService>(
        () => _i148.DeviceIdService(gh<_i111.SecureStorage>()));
    gh.lazySingleton<_i967.PushNotificationService>(
        () => _i967.PushNotificationService(
              gh<InvalidType>(),
              gh<_i42.LocalNotificationService>(),
              gh<_i10.NotificationRouter>(),
            ));
    gh.factory<_i970.CommentsCubit>(() => _i970.CommentsCubit(
          gh<_i434.CommentsUseCase>(),
          gh<_i381.UserService>(),
          gh<_i459.SharedPrefsService>(),
        ));
    gh.lazySingleton<_i926.FcmTokenRegistrar>(() => _i926.FcmTokenRegistrar(
          gh<InvalidType>(),
          gh<InvalidType>(),
          gh<_i148.DeviceIdService>(),
        ));
    gh.lazySingleton<_i255.SessionExpirationHandler>(
        () => _i255.SessionExpirationHandler(
              gh<_i285.AppRouter>(),
              gh<_i592.FirebaseAuthService>(),
              gh<_i381.UserService>(),
              gh<_i111.SecureStorage>(),
              gh<_i74.UnreadCountService>(),
              gh<InvalidType>(),
            ));
    return this;
  }
}
