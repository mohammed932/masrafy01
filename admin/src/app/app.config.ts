import {
  type ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Overlay } from '@angular/cdk/overlay';
import { MAT_SELECT_SCROLL_STRATEGY } from '@angular/material/select';

import { APP_ROUTES } from './app.routes';
import { correlationIdInterceptor } from './core/interceptors/correlation-id.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { toastInterceptor } from './core/interceptors/toast.interceptor';

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
    // Mat-select scroll strategy: REPOSITION so the panel follows its trigger
    // as the user scrolls (default is `reposition` but we set explicitly to
    // guarantee it works with the cdkScrollable main-content container).
    {
      provide: MAT_SELECT_SCROLL_STRATEGY,
      useFactory: (overlay: Overlay) => () => overlay.scrollStrategies.reposition(),
      deps: [Overlay],
    },
  ],
};
