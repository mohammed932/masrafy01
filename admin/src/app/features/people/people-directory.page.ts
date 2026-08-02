import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { debounceTime, filter, map } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  ArrowRightOutline,
  CloseCircleOutline,
  SearchOutline,
  UserAddOutline,
} from '@ant-design/icons-angular/icons';
import { AuthService } from '@core/auth/auth.service';
import { PageHeaderComponent } from '@shared/ui';
import { UsersService } from '../users/users.service';
import { CustomersApiService } from '../customers/customers.api.service';
import { CohortSwitcherComponent } from './cohort-switcher.component';
import { PeopleDirectoryStore } from './people-directory.store';
import { type Cohort, visibleCohorts, writeLastCohort } from './people.cohort';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * People — one directory for both human cohorts (Staff + Customers), replacing
 * the two separate nav entries. The shell owns everything the cohorts share:
 * the header, the primary action slot, and ONE search box. Each cohort roster
 * renders into the outlet below and keeps its own columns, stats, and actions.
 *
 * Two behaviours make the merge feel like one surface rather than tabs:
 *   - the search term survives a cohort switch (no retyping), and
 *   - both segments carry live match counts for that term, with a bridge link
 *     when the hits are in the cohort you are NOT looking at — so a search can
 *     never silently dead-end.
 */
@Component({
  selector: 'app-people-directory',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RouterOutlet,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    PageHeaderComponent,
    CohortSwitcherComponent,
  ],
  providers: [
    PeopleDirectoryStore,
    provideNzIconsPatch([SearchOutline, CloseCircleOutline, UserAddOutline, ArrowRightOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrow" [title]="titleText" [subtitle]="subtitle()">
        @if (cohort() === 'staff') {
          <button nz-button nzType="primary" (click)="store.requestCreateStaff()">
            <span nz-icon nzType="user-add" nzTheme="outline"></span>
            <span i18n="@@users.create">Create user</span>
          </button>
        }
      </app-page-header>

      <div class="control-bar">
        @if (cohorts().length > 1) {
          <app-cohort-switcher [cohorts]="cohorts()" [counts]="store.counts()" />
        }

        <div class="search">
          <label class="sr-only" for="people-search">{{ searchLabel }}</label>
          <nz-input-group nzPrefixIcon="search" [nzSuffix]="clearTpl">
            <input
              id="people-search"
              nz-input
              type="search"
              autocomplete="off"
              [formControl]="searchControl"
              [placeholder]="searchPlaceholder"
              (keydown.escape)="clearSearch()"
            />
          </nz-input-group>
          <ng-template #clearTpl>
            @if (draft().length > 0) {
              <button
                type="button"
                class="clear"
                [attr.aria-label]="clearLabel"
                (click)="clearSearch()"
              >
                <span nz-icon nzType="close-circle" nzTheme="outline"></span>
              </button>
            }
          </ng-template>
        </div>
      </div>

      <p class="bridge" role="status" aria-live="polite">
        @if (bridge(); as b) {
          <a class="bridge-link" [routerLink]="['/people', b.cohort]">
            <span>{{ b.text }}</span>
            <span nz-icon nzType="arrow-right" nzTheme="outline" aria-hidden="true"></span>
          </a>
        }
      </p>

      <router-outlet />
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        animation: rise var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .control-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .search {
        flex: 1;
        min-inline-size: 240px;
        max-inline-size: 380px;
      }
      @media (max-width: 720px) {
        .control-bar {
          flex-direction: column;
          align-items: stretch;
        }
        .search {
          max-inline-size: none;
        }
      }
      .clear {
        display: inline-flex;
        align-items: center;
        padding: 0;
        border: 0;
        background: none;
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .clear:hover {
        color: var(--color-text-primary);
      }
      .clear:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }
      /* Reserves its line so revealing the bridge never shifts the table. */
      .bridge {
        margin: calc(var(--space-5) * -1) 0 0;
        min-block-size: 20px;
        font-size: var(--text-sm);
      }
      .bridge-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-link);
        text-decoration: none;
        font-weight: var(--font-weight-medium);
        animation: bridge-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .bridge-link:hover {
        color: var(--color-text-link-hover);
        text-decoration: underline;
      }
      .bridge-link:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 3px;
        border-radius: var(--radius-sm);
      }
      @keyframes bridge-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      /* Direction arrow is a glyph, not a logical property — flip it in RTL so
         it keeps pointing the way the reader travels. */
      :host-context([dir='rtl']) .bridge-link .anticon-arrow-right {
        transform: scaleX(-1);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .page,
        .bridge-link {
          animation: none;
        }
      }
    `,
  ],
})
export class PeopleDirectoryPage {
  protected readonly store = inject(PeopleDirectoryStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly staffApi = inject(UsersService);
  private readonly customersApi = inject(CustomersApiService);

  protected readonly eyebrow = $localize`:@@people.eyebrow:Directory`;
  protected readonly titleText = $localize`:@@people.title:People`;
  protected readonly searchLabel = $localize`:@@people.search.label:Search people`;
  protected readonly searchPlaceholder = $localize`:@@people.search.placeholder:Search name, email, or phone`;
  protected readonly clearLabel = $localize`:@@people.search.clear:Clear search`;

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  /** Undebounced mirror of the input — drives the clear button under OnPush. */
  protected readonly draft = signal('');

  /** Cohorts this role may open. One cohort ⇒ the switcher is not rendered. */
  protected readonly cohorts = computed(() => visibleCohorts(this.auth.role()));

  /** Active cohort, read off the routed child so it is correct on first paint. */
  protected readonly cohort = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.readCohort()),
    ),
    { initialValue: this.readCohort() },
  );

  /** The cohort currently off screen, or null when the role sees only one. */
  private readonly otherCohort = computed<Cohort | null>(() => {
    const visible = this.cohorts();
    if (visible.length < 2) return null;
    const active = this.cohort();
    return visible.find((c) => c !== active) ?? null;
  });

  protected readonly subtitle = computed(() =>
    this.cohort() === 'staff'
      ? $localize`:@@people.subtitle.staff:Internal staff accounts — roles, access, and passwords.`
      : $localize`:@@people.subtitle.customers:Mobile end-users who signed up for the Masrafy app.`,
  );

  /** Hits for the current search that live in the cohort not on screen. */
  protected readonly bridge = computed<{ cohort: Cohort; text: string } | null>(() => {
    if (!this.store.searching()) return null;
    const other = this.otherCohort();
    if (other === null) return null;
    const matches = this.store.counts()[other];
    if (matches === null || matches === 0) return null;
    return { cohort: other, text: this.bridgeText(other, matches) };
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.draft.set(value));
    this.searchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((value) => this.store.setQuery(value));

    // Remember the cohort so collapsing two nav entries into one loses nothing.
    effect(() => {
      const active = this.cohort();
      if (active) writeLastCohort(active);
    });

    // The roster on screen reports its own total; measure the other cohort here
    // so both segment badges describe the same query.
    effect(
      () => {
        const query = this.store.query();
        const other = this.otherCohort();
        if (other === null) return;
        const known = untracked(() => this.store.counts()[other]);
        if (known !== null) return;
        void this.measure(other, query);
      },
      { allowSignalWrites: true },
    );
  }

  protected clearSearch(): void {
    this.searchControl.setValue('');
    this.draft.set('');
    this.store.setQuery('');
  }

  private readCohort(): Cohort | null {
    const path = this.route.snapshot.firstChild?.url[0]?.path;
    return path === 'staff' || path === 'customers' ? path : null;
  }

  private bridgeText(cohort: Cohort, matches: number): string {
    return cohort === 'staff'
      ? $localize`:@@people.bridge.staff:Your search also matches ${matches}:count: in Staff`
      : $localize`:@@people.bridge.customers:Your search also matches ${matches}:count: in Customers`;
  }

  /** One-row probe — we only need `total`. Failures leave the badge unmeasured. */
  private async measure(cohort: Cohort, query: string): Promise<void> {
    try {
      const total =
        cohort === 'staff'
          ? (await this.staffApi.list(1, 1, query)).total
          : (await this.customersApi.list({ q: query, pageIndex: 0, pageSize: 1 })).pagination
              .total;
      // Drop late responses — a newer query already reset the badges.
      if (this.store.query() !== query) return;
      this.store.reportCount(cohort, total);
    } catch {
      // Badge stays "—"; the roster surfaces its own load errors.
    }
  }
}
