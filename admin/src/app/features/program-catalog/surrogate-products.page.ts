/**
 * The surrogate-product library — every pre-defined way of working an income out when there
 * is no payslip.
 *
 * WHY THIS SCREEN EXISTS. A catalog program name sold without a payslip has to state how the
 * income is worked out, and admin had no way to author one: the rule editor edits FIGURES and
 * deliberately cannot author a step list, so a new no-payslip name was created silently
 * broken and stayed that way until somebody wrote a seed. Now the calculation is a row of its
 * own and a name points at one, so widening the product is an operator action.
 *
 * WHAT A CARD DELIBERATELY DOES NOT SHOW: money. What a product PAYS is per bank — five banks
 * quote the compound guarantee off five different cap tables — so a figure here would be a
 * lie the moment a second bank configures it. The card shows what the calculation READS and
 * who SELLS it, which are both true of the product itself.
 *
 * Nor are the cards colour-coded. Four accents would imply a taxonomy of products; there
 * isn't one — a product's identity is the calculation it holds.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import {
  EnumerationEditDrawerComponent,
  type EnumerationEditDrawerData,
} from '@shared/lookups/enumeration-edit.drawer';
import {
  ArrowRightOutline,
  CheckCircleOutline,
  ExclamationCircleOutline,
  FunctionOutline,
  InboxOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  openFormDrawer,
} from '@shared/ui';
import type { StatStripItem } from '@shared/ui';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  incomeMethodLabel,
  registryFacts,
  type IncomeAssumptionStrategy,
} from '@features/bank-programs/bank-programs.types';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import type { SurrogateProductSummary } from '@features/bank-programs/bank-programs.types';

@Component({
  selector: 'app-surrogate-products-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NzIconModule,
    PageHeaderComponent,
    StatStripComponent,
    SkeletonRowsComponent,
  ],
  providers: [
    // The stat-strip renders whatever `icon` a caller names, so every one of them has to
    // be registered HERE — the strip itself patches nothing.
    provideNzIconsPatch([
      ArrowRightOutline,
      CheckCircleOutline,
      ExclamationCircleOutline,
      FunctionOutline,
      InboxOutline,
      PlusOutline,
    ]),
  ],
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrow" [title]="title" [subtitle]="subtitle">
        @if (!loading()) {
          <app-stat-strip [items]="stats()" layout="row" [ariaLabel]="statsAria" />
        }
      </app-page-header>

      <div class="head-actions">
        <button type="button" class="new-product" (click)="createProduct()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@sp.new">New surrogate product</span>
        </button>
      </div>

      @if (loading()) {
        <app-skeleton-rows [rows]="4" [cols]="[3, 1, 1]" [ariaLabel]="loadingLabel" />
      } @else if (products().length === 0) {
        <p class="empty" i18n="@@sp.empty">
          No surrogate products yet. Add one above, or run
          <code>npm run seed:surrogate-products</code> to write the starter library.
        </p>
      } @else {
        <ul class="grid" role="list">
          @for (p of products(); track p.key) {
            <li>
              <a class="card" [class.is-off]="!p.active" [routerLink]="[p.key]">
                <span class="medallion" aria-hidden="true">
                  <span nz-icon nzType="function" nzTheme="outline"></span>
                </span>

                <span class="body">
                  <span class="name">{{ label(p) }}</span>
                  <span class="reads">{{ reads(p) }}</span>

                  <span class="uses">
                    @if (p.usedBy.length === 0) {
                      <span class="tag is-warn">
                        <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
                        <span i18n="@@sp.unused">No catalog name sells this yet</span>
                      </span>
                    } @else {
                      @for (name of p.usedBy; track name) {
                        <span class="tag">{{ name }}</span>
                      }
                    }
                    @if (!p.active) {
                      <span class="tag is-off" i18n="@@sp.retired">Retired</span>
                    }
                  </span>
                </span>

                <span class="go" aria-hidden="true">
                  <span nz-icon nzType="arrow-right" nzTheme="outline"></span>
                </span>
              </a>
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
        gap: var(--space-6);
      }

      .grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-4);
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
      }

      .card {
        display: flex;
        align-items: flex-start;
        gap: var(--space-4);
        padding: var(--space-5);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        color: inherit;
        text-decoration: none;
        cursor: pointer;
        block-size: 100%;
        transition:
          border-color var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-base) var(--motion-easing-standard);
      }

      .card:hover {
        border-color: var(--primary);
        /* Logical, so RTL lifts toward the reader's start edge too (A19). */
        transform: translateY(-2px);
      }

      .card:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-color: var(--primary);
      }

      .card.is-off {
        opacity: 0.62;
      }

      .medallion {
        flex: 0 0 auto;
        inline-size: var(--icon-tile-sm);
        block-size: var(--icon-tile-sm);
        display: grid;
        place-items: center;
        border-radius: var(--radius-md);
        background: var(--bg-muted);
        color: var(--primary-visible);
      }

      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
        flex: 1 1 auto;
      }

      .name {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      .reads {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .uses {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-block-start: var(--space-1);
      }

      .tag {
        font-size: var(--text-xs);
        font-family: var(--font-mono);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
      }

      .tag.is-warn {
        font-family: var(--font-sans);
        color: var(--warning);
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }

      .tag.is-off {
        font-family: var(--font-sans);
        color: var(--text-tertiary);
      }

      .go {
        flex: 0 0 auto;
        color: var(--text-tertiary);
        align-self: center;
      }

      /* The arrow points along the reading direction, so it mirrors in Arabic. */
      :host-context([dir='rtl']) .go {
        transform: scaleX(-1);
      }

      .head-actions {
        display: flex;
        justify-content: flex-end;
      }
      .new-product {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font: inherit;
        font-size: 0.8125rem;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          color 120ms ease;
      }
      .new-product:hover {
        border-color: var(--accent);
        color: var(--text-primary);
      }
      .new-product:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .empty {
        margin: 0;
        max-inline-size: 46rem;
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
      }

      code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: var(--space-0-5) var(--space-1);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
        .card:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class SurrogateProductsPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly drawer = inject(NzDrawerService);
  private readonly router = inject(Router);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /**
   * Create a product, then go straight to it.
   *
   * Reuses the generic value dialog with `type: 'surrogate_product'` — the row IS an
   * enumeration value, and `POST admin/enumerations` has always accepted this type; what was
   * missing was any screen that passed it. The row is born with no calculation, so the next
   * thing the operator needs is step ① of the new product, not this list again.
   */
  protected createProduct(): void {
    const ref = openFormDrawer<EnumerationEditDrawerComponent, EnumerationEditDrawerData, boolean>(
      this.drawer,
      {
        content: EnumerationEditDrawerComponent,
        data: {
          mode: 'create',
          type: 'surrogate_product',
          title: $localize`:@@sp.create_title:New surrogate product`,
          submitLabel: $localize`:@@sp.create_cta:Create product`,
          subtitle: $localize`:@@sp.create_sub:Names the calculation. It is born with no steps — the next screen is where you write them.`,
        },
      },
    );
    ref.afterClose.subscribe(async (saved: boolean | undefined) => {
      if (!saved) return;
      const before = new Set(this.products().map((p) => p.key));
      await this.load();
      const created = this.products().find((p) => !before.has(p.key));
      if (created) void this.router.navigate(['/surrogate-products', created.key]);
    });
  }

  protected readonly loading = signal(true);
  protected readonly products = signal<readonly SurrogateProductSummary[]>([]);

  /**
   * The fact registry, so a `fact:<key>` product names its fact rather than rendering the
   * raw key. Lazily cached — nothing populates it unless a screen asks.
   */
  private readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );

  protected readonly eyebrow = $localize`:@@sp.eyebrow:Program catalog`;
  protected readonly title = $localize`:@@sp.title:Surrogate products`;
  protected readonly subtitle = $localize`:@@sp.subtitle:The pre-defined ways of working an income out when there is no payslip. A catalog program name sold without a payslip picks one of these, and every bank under that name quotes from it.`;
  protected readonly statsAria = $localize`:@@sp.stats_aria:Surrogate product totals`;
  protected readonly loadingLabel = $localize`:@@sp.loading:Loading surrogate products`;

  protected readonly stats = computed<StatStripItem[]>(() => {
    const all = this.products();
    return [
      {
        label: $localize`:@@sp.stat.total:Products`,
        value: String(all.length),
        icon: 'function',
      },
      {
        label: $localize`:@@sp.stat.sold:Sold under a name`,
        value: String(all.filter((p) => p.usedBy.length > 0).length),
        icon: 'check-circle',
      },
      {
        label: $localize`:@@sp.stat.unused:Not sold yet`,
        value: String(all.filter((p) => p.usedBy.length === 0).length),
        icon: 'inbox',
      },
    ];
  });

  constructor() {
    void this.enums.load('surrogate_fact');
    void this.load();
  }

  protected label(p: SurrogateProductSummary): string {
    return this.isAr ? p.labelAr : p.labelEn;
  }

  /**
   * What the calculation reads, in the operator's words.
   *
   * `incomeMethodLabel` is the same mapper the bank wizard and the catalog page use, so a
   * method is named identically wherever it appears — including `steps`, which reads as a
   * multi-step product rather than as a blank.
   */
  protected reads(p: SurrogateProductSummary): string {
    if (p.strategy === null) {
      return $localize`:@@sp.reads_none:No calculation stated yet`;
    }
    // The label is already a complete phrase, so it stands alone — "Reads By Academic rank"
    // reads as a typo.
    return incomeMethodLabel(p.strategy as IncomeAssumptionStrategy, this.facts());
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.listSurrogateProducts();
      this.products.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }
}
