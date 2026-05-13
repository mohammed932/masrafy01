import {
  APP_INITIALIZER,
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Overlay } from '@angular/cdk/overlay';
import { MAT_SELECT_SCROLL_STRATEGY } from '@angular/material/select';
import { MAT_DIALOG_DEFAULT_OPTIONS, type MatDialogConfig } from '@angular/material/dialog';

import { APP_ROUTES } from './app.routes';
import { correlationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
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
 * Interceptors run in registration order: correlation → auth → error → toast.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: false }),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        correlationIdInterceptor,
        authInterceptor,
        errorInterceptor,
        toastInterceptor,
      ]),
    ),
    provideAnimationsAsync(),
    {
      provide: APP_INITIALIZER,
      useFactory: bootstrapAuth,
      deps: [AuthService],
      multi: true,
    },
    // Mat-select scroll strategy: REPOSITION so the panel follows its trigger
    // as the user scrolls. Required for the bank-program form (feat 002) where
    // selects live inside a scrollable content container.
    {
      provide: MAT_SELECT_SCROLL_STRATEGY,
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.reposition(),
      deps: [Overlay],
    },
    // Global modal defaults. Every dialog.open(...) call inherits these so we
    // never have to remember panelClass / backdropClass / sizing at the call
    // site — the dashboard's modal surface is uniform by construction.
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: 'app-modal-panel',
        backdropClass: 'app-modal-backdrop',
        width: '480px',
        maxWidth: '92vw',
        maxHeight: '92vh',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        hasBackdrop: true,
        disableClose: false,
      } satisfies MatDialogConfig,
    },
  ],
};
