import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponseData,
  PasswordChangeRequest,
  RefreshResponseData,
  StaffRole,
  SuccessEnvelope,
} from './auth.types';

/**
 * Skip the auth interceptor for a request. Use on /auth/refresh to avoid an
 * infinite refresh loop (refresh relies on the cookie, not the access token).
 */
export const SKIP_AUTH_INTERCEPTOR = new HttpContextToken<boolean>(() => false);
export const SKIP_ERROR_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // ---- Internal signals -----------------------------------------------------
  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<AuthenticatedUser | null>(null);
  private readonly _isRefreshing = signal<boolean>(false);
  private inflightRefresh: Promise<string> | null = null;

  // ---- Public read-only signals --------------------------------------------
  readonly accessToken: Signal<string | null> = this._accessToken.asReadonly();
  readonly currentUser: Signal<AuthenticatedUser | null> = this._currentUser.asReadonly();
  readonly isRefreshing: Signal<boolean> = this._isRefreshing.asReadonly();

  readonly isAuthenticated = computed<boolean>(
    () => this._accessToken() !== null && this._currentUser() !== null,
  );

  readonly role = computed<StaffRole | null>(() => this._currentUser()?.role ?? null);

  readonly mustChangePassword = computed<boolean>(
    () => this._currentUser()?.mustChangePassword === true,
  );

  private base(): string {
    return environment.apiBaseUrl;
  }

  // ---- HTTP wrappers --------------------------------------------------------

  async login(req: LoginRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<LoginResponseData>>(`${this.base()}/auth/login`, req, {
        withCredentials: true,
      }),
    );
    this._accessToken.set(res.data.accessToken);
    this._currentUser.set(res.data.user);
  }

  /**
   * Silent refresh. Coalesces concurrent callers — at most one in-flight
   * `/auth/refresh` per AuthService instance, all callers await the same
   * promise. On failure, clears state and rethrows.
   */
  async refresh(): Promise<string> {
    if (this.inflightRefresh) return this.inflightRefresh;
    this._isRefreshing.set(true);
    this.inflightRefresh = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.post<SuccessEnvelope<RefreshResponseData>>(
            `${this.base()}/auth/refresh`,
            {},
            {
              withCredentials: true,
              context: new HttpContext()
                .set(SKIP_AUTH_INTERCEPTOR, true)
                .set(SKIP_ERROR_INTERCEPTOR, true),
            },
          ),
        );
        this._accessToken.set(res.data.accessToken);
        return res.data.accessToken;
      } finally {
        this._isRefreshing.set(false);
        this.inflightRefresh = null;
      }
    })();
    return this.inflightRefresh;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.base()}/auth/logout`,
          {},
          { withCredentials: true },
        ),
      );
    } finally {
      this.clear();
    }
  }

  async loadCurrentUser(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<AuthenticatedUser>>(`${this.base()}/auth/me`, {
        withCredentials: true,
      }),
    );
    this._currentUser.set(res.data);
  }

  async changePassword(req: PasswordChangeRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<LoginResponseData>>(
        `${this.base()}/auth/password`,
        req,
        { withCredentials: true },
      ),
    );
    this._accessToken.set(res.data.accessToken);
    this._currentUser.set(res.data.user);
  }

  // ---- Mutators -------------------------------------------------------------

  setSession(accessToken: string, user: AuthenticatedUser): void {
    this._accessToken.set(accessToken);
    this._currentUser.set(user);
  }

  setAccessToken(accessToken: string): void {
    this._accessToken.set(accessToken);
  }

  clear(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    this._isRefreshing.set(false);
    this.inflightRefresh = null;
  }
}
