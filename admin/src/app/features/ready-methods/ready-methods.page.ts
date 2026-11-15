/**
 * Ready methods (v37.0.0) — the list a product's Amount step picks a method from.
 *
 * Add, change and delete here. A product that already picked a method keeps its own copy, so
 * nothing on this screen moves a live product's money.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { registryFacts, type MethodTemplate } from '@features/bank-programs/bank-programs.types';
import { methodFacts, methodName, methodSummary } from './method-facts';

@Component({
  selector: 'app-ready-methods-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="head">
        <div>
          <h1 i18n="@@rm.title">Ready methods</h1>
          <p class="lede" i18n="@@rm.lede">
            Ways of working out a product's amount. On a product's Amount step, pick one instead of
            building it by hand — it is copied into the product, so changing or deleting a method
            here never changes a product that already uses it.
          </p>
        </div>
        <a class="btn primary" routerLink="new" i18n="@@rm.new">+ New method</a>
      </header>

      @if (loading()) {
        <p class="muted" i18n="@@ps.loading">Loading…</p>
      } @else if (methods().length === 0) {
        <p class="muted" i18n="@@rm.empty">No ready methods yet.</p>
      } @else {
        <ul class="list" role="list">
          @for (m of methods(); track m.key) {
            <li class="row">
              <div class="txt">
                <a class="name" [routerLink]="[m.key]">{{ name(m) }}</a>
                <span class="sum">{{ summary(m) }}</span>
                @if (m.usedBy.length > 0) {
                  <span class="used"
                    ><span i18n="@@rm.used_by">Used by:</span> {{ usedBy(m) }}</span
                  >
                } @else {
                  <span class="used none" i18n="@@rm.used_none">Not used by any product</span>
                }
              </div>
              @if (m.source === 'seed') {
                <span class="tag" i18n="@@rm.shipped">Shipped</span>
              } @else {
                <span class="tag own" i18n="@@rm.added">Added</span>
              }
              <a class="link" [routerLink]="[m.key]" i18n="@@rm.edit">Edit</a>
              @if (m.usedBy.length === 0) {
                <button
                  type="button"
                  class="link danger"
                  (click)="confirmDelete(m)"
                  i18n="@@rm.delete"
                >
                  Delete
                </button>
              }
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
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      h1 {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      .lede,
      .muted {
        margin: var(--space-1) 0 0;
        max-inline-size: 48rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .btn {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font-weight: var(--font-weight-semibold);
        text-decoration: none;
        white-space: nowrap;
      }
      .btn.primary {
        background: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        flex-wrap: wrap;
      }
      .row + .row {
        border-block-start: 1px solid var(--color-border-default);
      }
      .txt {
        flex: 1 1 20rem;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .name {
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
      .used {
        font-size: var(--text-xs);
        color: var(--color-text-primary);
      }
      .used.none {
        color: var(--color-text-tertiary);
      }
      .tag {
        font-size: var(--text-xxs);
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .tag.own {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .link {
        border: 0;
        background: none;
        color: var(--color-text-link);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        text-decoration: none;
        padding: 0;
      }
      .link.danger {
        color: var(--color-error);
      }
      a:focus-visible,
      button:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
    `,
  ],
})
export class ReadyMethodsPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly loading = signal(true);
  protected readonly methods = signal<MethodTemplate[]>([]);
  private readonly facts = computed(() =>
    methodFacts(registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr), this.isAr),
  );

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

  protected usedBy(m: MethodTemplate): string {
    return m.usedBy.map((p) => (this.isAr ? p.labelAr : p.labelEn)).join(', ');
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
