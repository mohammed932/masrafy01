import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { EnumerationMember, EnumerationType } from './platform-enumerations.types';

interface EnumerationsState {
  loading: boolean;
  members: Partial<Record<EnumerationType, EnumerationMember[]>>;
  unavailable: boolean;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ErrorEnvelope {
  success: false;
  code: string;
  meta?: Record<string, unknown>;
}

/**
 * Signal-cache of platform enumeration members.
 * Tier-key pickers in the bank-program form bind to `members(type)`.
 *
 * Fail-closed contract: when the backend returns ENUMERATION_REGISTRY_UNAVAILABLE,
 * `unavailable()` is set true; pickers MUST refuse to render and surface the
 * localized "enumerations unavailable, retry shortly" state.
 *
 * Spec anchors: FR-010b (live registry feeds pickers), FR-010 (fail-closed),
 *   Research R4 (stub today; feature 003 swaps the interface).
 */
@Injectable({ providedIn: 'root' })
export class PlatformEnumerationsService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<EnumerationsState>({
    loading: false,
    members: {},
    unavailable: false,
  });

  readonly unavailable: Signal<boolean> = computed(() => this.state().unavailable);
  readonly loading: Signal<boolean> = computed(() => this.state().loading);

  /** Read-only signal of cached members for a given type. Returns `[]` if not yet loaded. */
  membersFor(type: EnumerationType): Signal<EnumerationMember[]> {
    return computed(() => this.state().members[type] ?? []);
  }

  /** Eagerly fetch members for a type. Re-fetches if not in cache. */
  async load(type: EnumerationType): Promise<EnumerationMember[]> {
    const cached = this.state().members[type];
    if (cached) {
      return cached;
    }
    return this.refresh(type);
  }

  /** Force re-fetch from the backend; bypasses cache. */
  async refresh(type: EnumerationType): Promise<EnumerationMember[]> {
    this.state.update((s) => ({ ...s, loading: true }));
    try {
      const res = await firstValueFrom(
        this.http.get<SuccessEnvelope<EnumerationMember[]>>(
          `${environment.apiBaseUrl}/platform-enumerations/${type}`,
        ),
      );
      const members = res.data;
      this.state.update((s) => ({
        ...s,
        loading: false,
        unavailable: false,
        members: { ...s.members, [type]: members },
      }));
      return members;
    } catch (err: unknown) {
      const envelope = (err as { error?: ErrorEnvelope }).error;
      if (envelope?.code === 'ENUMERATION_REGISTRY_UNAVAILABLE') {
        this.state.update((s) => ({ ...s, loading: false, unavailable: true }));
        return [];
      }
      this.state.update((s) => ({ ...s, loading: false }));
      throw err;
    }
  }

  /** Pre-warm a set of common types in parallel. */
  async preload(types: EnumerationType[]): Promise<void> {
    await Promise.all(types.map((t) => this.load(t)));
  }

  /** Clear the cache (e.g., on locale switch or admin-triggered manual refresh). */
  clear(): void {
    this.state.set({ loading: false, members: {}, unavailable: false });
  }
}
