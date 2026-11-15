/**
 * Surrogate methods (v37.0.0) — the list a product's Amount step picks a method from.
 *
 * Add, change and delete here. A method a product is linked to cannot be deleted; the row
 * says which products use it, and each name opens that product's Amount step.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  DeleteOutline,
  EditOutline,
  FunctionOutline,
  PlusOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { PageHeaderComponent } from '@shared/ui';
import { EmptyStateComponent } from '@shared/empty-state.component';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { registryFacts, type MethodTemplate } from '@features/bank-programs/bank-programs.types';
import { methodFacts, methodName, methodSummary } from './method-facts';

@Component({
  selector: 'app-ready-methods-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  providers: [
    provideNzIconsPatch([DeleteOutline, EditOutline, FunctionOutline, PlusOutline, SearchOutline]),
  ],
  template: `
    <section class="page">
      <app-page-header
        title="Surrogate methods"
        i18n-title="@@rm.title"
        subtitle="Ways of working out a product's amount. A product linked to a method takes its questions, how and groups from it, and keeps its own amounts."
        i18n-subtitle="@@rm.lede3"
      >
        <a nz-button nzType="primary" routerLink="new">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@rm.new2">New method</span>
        </a>
      </app-page-header>

      <div class="toolbar">
        <nz-input-group [nzPrefix]="searchIcon" class="search">
          <input
            nz-input
            type="search"
            [formControl]="search"
            placeholder="Search methods or products…"
            i18n-placeholder="@@rm.search"
          />
        </nz-input-group>
        <ng-template #searchIcon>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
        </ng-template>
        @if (!loading()) {
          <span class="count" i18n="@@rm.count">{{ shown().length }} of {{ methods().length }}</span>
        }
      </div>

      @if (loading()) {
        <ul class="list" role="list" aria-busy="true">
          @for (k of [1, 2, 3, 4]; track k) {
            <li class="row skel">
              <span class="tile"></span>
              <span class="txt"><span class="bar w40"></span><span class="bar w70"></span></span>
            </li>
          }
        </ul>
      } @else if (methods().length === 0) {
        <app-empty-state
          icon="inbox"
          title="No surrogate methods yet."
          i18n-title="@@rm.empty"
          subtitle="Add one, then pick it on a product's Amount step."
          i18n-subtitle="@@rm.empty_sub"
        >
          <a nz-button nzType="primary" routerLink="new">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@rm.new2">New method</span>
          </a>
        </app-empty-state>
      } @else if (shown().length === 0) {
        <p class="none" role="status" i18n="@@rm.no_match">No method matches your search.</p>
      } @else {
        <ul class="list" role="list">
          @for (m of shown(); track m.key) {
            <li class="row">
              <span class="tile" aria-hidden="true">
                <span nz-icon nzType="function" nzTheme="outline"></span>
              </span>
              <div class="txt">
                <div class="line1">
                  <a class="name" [routerLink]="[m.key]">{{ name(m) }}</a>
                  @if (m.source === 'seed') {
                    <span class="tag" i18n="@@rm.shipped">Shipped</span>
                  } @else {
                    <span class="tag own" i18n="@@rm.added">Added</span>
                  }
                </div>
                <span class="sum">{{ summary(m) }}</span>
                @if (m.usedBy.length > 0) {
                  <ul class="chips" role="list" [attr.aria-label]="usedAria">
                    @for (p of m.usedBy; track p.key) {
                      <li>
                        <a
                          [routerLink]="['/program-catalog/products', p.key]"
                          [queryParams]="{ step: 3 }"
                          >{{ isAr ? p.labelAr : p.labelEn }}</a
                        >
                      </li>
                    }
                  </ul>
                } @else {
                  <span class="unused" i18n="@@rm.used_none">Not used by any product</span>
                }
              </div>
              <div class="acts">
                <button
                  nz-button
                  nzType="text"
                  nzShape="circle"
                  type="button"
                  nz-tooltip
                  [nzTooltipTitle]="editLabel"
                  [attr.aria-label]="editLabel + ' ' + name(m)"
                  (click)="open(m)"
                >
                  <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                </button>
                <span nz-tooltip [nzTooltipTitle]="m.usedBy.length > 0 ? inUse : deleteLabel">
                  <button
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    nzDanger
                    type="button"
                    [disabled]="m.usedBy.length > 0"
                    [attr.aria-label]="deleteLabel + ' ' + name(m)"
                    (click)="confirmDelete(m)"
                  >
                    <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                  </button>
                </span>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block: var(--space-4) var(--space-8);
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .search {
        flex: 0 1 24rem;
        min-inline-size: 0;
      }
      .count {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
      }
      .none {
        margin: 0;
        padding: var(--space-5);
        text-align: center;
        color: var(--color-text-secondary);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-lg);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        overflow: hidden;
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .row:hover {
        background: var(--color-surface-row-hover);
      }
      .row + .row {
        border-block-start: 1px solid var(--color-border-default);
      }
      .tile {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: 2.5rem;
        block-size: 2.5rem;
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-brand-primary) 10%, var(--color-surface-default));
        color: var(--color-brand-primary);
        font-size: var(--text-lg);
      }
      .txt {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .line1 {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .name {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        text-decoration: none;
      }
      .name:hover {
        color: var(--color-text-link);
      }
      .sum {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .unused {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .tag {
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }
      .tag.own {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .chips {
        list-style: none;
        margin: var(--space-1) 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .chips a {
        display: inline-block;
        padding: 0 var(--space-2-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-link);
        font-size: var(--text-xs);
        line-height: 1.8;
        text-decoration: none;
      }
      .chips a:hover {
        border-color: var(--color-brand-primary);
      }
      .acts {
        flex: none;
        display: flex;
        gap: var(--space-1);
      }
      .skel .bar {
        display: block;
        block-size: var(--space-3);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
      }
      .skel .tile {
        background: var(--color-surface-muted);
      }
      .w40 {
        inline-size: 40%;
      }
      .w70 {
        inline-size: 70%;
      }
      a:focus-visible,
      button:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      @media (max-width: 600px) {
        .row {
          padding: var(--space-3);
        }
        .tile {
          display: none;
        }
        .search {
          flex-basis: 100%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .row {
          transition: none;
        }
      }
    `,
  ],
})
export class ReadyMethodsPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly loading = signal(true);
  protected readonly methods = signal<MethodTemplate[]>([]);
  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly term = toSignal(this.search.valueChanges, { initialValue: '' });

  protected readonly editLabel = $localize`:@@rm.edit:Edit`;
  protected readonly deleteLabel = $localize`:@@rm.delete:Delete`;
  protected readonly inUse = $localize`:@@rm.delete_blocked:A product uses it. Unlink it on the product first.`;
  protected readonly usedAria = $localize`:@@rm.used_by:Used by:`;

  private readonly facts = computed(() =>
    methodFacts(registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr), this.isAr),
  );

  protected readonly shown = computed(() => {
    const t = this.term().trim().toLowerCase();
    if (t === '') return this.methods();
    return this.methods().filter((m) =>
      [m.labelEn, m.labelAr, this.summary(m), ...m.usedBy.flatMap((p) => [p.labelEn, p.labelAr])]
        .join(' ')
        .toLowerCase()
        .includes(t),
    );
  });

  constructor() {
    void this.enums.load('surrogate_fact');
    void this.load();
  }

  protected name(m: MethodTemplate): string {
    return methodName(m, this.isAr);
  }

  protected summary(m: MethodTemplate): string {
    return methodSummary(m, this.facts());
  }

  protected open(m: MethodTemplate): void {
    void this.router.navigate(['/surrogate-methods', m.key]);
  }

  protected confirmDelete(m: MethodTemplate): void {
    const name = this.name(m);
    this.modal.confirm({
      nzTitle: $localize`:@@rm.delete_title:Delete “${name}:NAME:”?`,
      nzContent: $localize`:@@rm.delete_body2:It leaves the list. No product uses it.`,
      nzOkText: $localize`:@@rm.delete:Delete`,
      nzOkDanger: true,
      nzOnOk: async () => {
        await this.api.deleteMethodTemplate(m.key);
        this.message.success($localize`:@@rm.deleted:Method deleted.`);
        await this.load();
      },
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.methods.set((await this.api.listMethodTemplates()).data);
    } finally {
      this.loading.set(false);
    }
  }
}
