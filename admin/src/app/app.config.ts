import {
  APP_INITIALIZER,
  type ApplicationConfig,
  LOCALE_ID,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NZ_I18N, ar_EG, en_US } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService } from 'ng-zorro-antd/drawer';

import { APP_ROUTES } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { toastInterceptor } from './core/interceptors/toast.interceptor';
import { AuthService } from './core/auth/auth.service';

/**
 * Boot-time silent refresh. Reads the httpOnly refresh cookie, mints a fresh
 * access token, and hydrates `currentUser` so the auth guard sees the user as
 * signed in on the very first navigation. Without this, every page reload
 * dropped the in-memory session and bounced the user to /login even though
 * the refresh cookie was still valid.
 *
 * Failure modes are swallowed silently: no cookie, expired cookie, or
 * network blip → app boots in the logged-out state and the auth guard
 * redirects to /login as designed.
 */
function bootstrapAuth(auth: AuthService): () => Promise<void> {
  return async (): Promise<void> => {
    try {
      await auth.refresh();
      await auth.loadCurrentUser();
    } catch {
      // No valid refresh cookie — proceed unauthenticated.
    }
  };
}

/**
 * Functional-DI application config (Constitution Principles XVII, XX).
 * Interceptors run in registration order: auth → error → toast.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: false }),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        errorInterceptor,
        toastInterceptor,
      ]),
    ),
    provideAnimationsAsync(),
    // NG-ZORRO locale — resolved at runtime from the build-time --localize bundle
    // (en-US default, ar-EG for the Arabic build).
    {
      provide: NZ_I18N,
      useFactory: () => (inject(LOCALE_ID).toString().startsWith('ar') ? ar_EG : en_US),
    },
    // Empty global icon registry — features register their own icons via
    // `provideNzIconsPatch([...])` in route providers (tree-shaking).
    provideNzIcons([]),
    NzModalService,
    NzDrawerService,
    {
      provide: APP_INITIALIZER,
      useFactory: bootstrapAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};
