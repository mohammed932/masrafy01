import { Injectable, computed, signal } from '@angular/core';
import type { Cohort } from './people.cohort';

type CountMap = Readonly<Record<Cohort, number | null>>;

const EMPTY_COUNTS: CountMap = { staff: null, customers: null };

/**
 * Cross-cohort state for the People directory, provided by
 * `PeopleDirectoryPage` so it lives and dies with the `/people` shell.
 *
 * Owns the three things the shell and the two rosters must agree on:
 *   1. `query`  — one debounced search term, shared across cohorts so switching
 *      never makes the operator retype.
 *   2. `counts` — how many rows each cohort has for that query. The active
 *      roster reports its own total; the shell probes the other one. Feeds the
 *      switcher badges and the cross-cohort bridge.
 *   3. `createStaffTick` — the header's primary action lives in the shell but
 *      the dialog belongs to the staff feature, so the shell pings and the
 *      staff roster opens.
 */
@Injectable()
export class PeopleDirectoryStore {
  private readonly _query = signal('');
  private readonly _counts = signal<CountMap>(EMPTY_COUNTS);
  private readonly _createStaffTick = signal(0);

  /** Debounced search term, already trimmed. Empty string = unfiltered. */
  readonly query = this._query.asReadonly();
  /** Row count per cohort for the current query; `null` while unmeasured. */
  readonly counts = this._counts.asReadonly();
  readonly createStaffTick = this._createStaffTick.asReadonly();

  readonly searching = computed(() => this._query().length > 0);

  setQuery(next: string): void {
    const value = next.trim();
    if (value === this._query()) return;
    // Counts belong to the previous query — drop them so badges show "—"
    // instead of a number that no longer describes what is on screen.
    this._counts.set(EMPTY_COUNTS);
    this._query.set(value);
  }

  reportCount(cohort: Cohort, total: number): void {
    const current = this._counts();
    if (current[cohort] === total) return;
    this._counts.set({ ...current, [cohort]: total });
  }

  requestCreateStaff(): void {
    this._createStaffTick.update((n) => n + 1);
  }
}
