import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  CarOutline,
  ClockCircleOutline,
  HomeOutline,
  ShopOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { RelativeTimePipe } from '@shared/relative-time.pipe';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  categoryLabel,
  type LoanCategory,
} from './questionnaire.api.service';

interface CategoryCard {
  category: LoanCategory;
  lastPublishedAt: string | null;
}

/** Presentation-only accent + icon per category (Principle II: keyed by data, no branches). */
interface CategoryMeta {
  /** CSS custom-property reference into the shared category palette in _tokens.scss. */
  accent: string;
  /** ng-zorro icon nzType. */
  icon: string;
}
const CATEGORY_META: Record<LoanCategory, CategoryMeta> = {
  personal: { accent: 'var(--color-cat-personal)', icon: 'user' },
  car: { accent: 'var(--color-cat-car)', icon: 'car' },
  mortgage: { accent: 'var(--color-cat-mortgage)', icon: 'home' },
  business: { accent: 'var(--color-cat-business)', icon: 'shop' },
};

/**
 * Questionnaire overview — one card per loan category (Principle II scope-lock: exactly four).
 * MVP launchpad: the whole card is a link into the editor; it shows category identity and when
 * the questionnaire last shipped. Publishing + version history live inside the editor.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideNzIconsPatch([UserOutline, CarOutline, HomeOutline, ShopOutline, ClockCircleOutline]),
  ],
  imports: [
    CommonModule,
    RouterLink,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    RelativeTimePipe,
  ],
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Matching engine"
        i18n-eyebrow="@@questionnaire.overview.eyebrow"
        title="Questionnaires"
        i18n-title="@@questionnaire.overview.title"
        subtitle="One published version per loan category drives the mobile questionnaire."
        i18n-subtitle="@@questionnaire.overview.subtitle"
      />

      @if (loading()) {
        <div class="loading"><nz-spin nzSimple /></div>
      } @else {
        <div class="cards">
          @for (c of cards(); track c.category) {
            <a
              class="cat-card"
              [routerLink]="['/questionnaire/edit', c.category]"
              [style.--cat]="meta(c.category).accent"
            >
              <div class="card-head">
                <span class="icon-chip" aria-hidden="true">
                  <span nz-icon [nzType]="meta(c.category).icon" nzTheme="outline"></span>
                </span>
                <h2 class="cat-name">{{ label(c.category) }}</h2>
              </div>

              <p class="published">
                <span
                  class="ic"
                  nz-icon
                  nzType="clock-circle"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
                @if (c.lastPublishedAt) {
                  <span
                    ><span i18n="@@questionnaire.overview.published_prefix">Published</span>
                    {{ c.lastPublishedAt | relativeTime }}</span
                  >
                } @else {
                  <span i18n="@@questionnaire.overview.never_published">Never published</span>
                }
              </p>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        padding: var(--space-6, 32px);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .loading {
        display: flex;
        justify-content: center;
        padding-block: var(--space-8);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-4);
      }

      .cat-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-5);
        padding-inline-start: calc(var(--space-5) + 4px);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        transition:
          transform var(--motion-duration-base) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          border-color var(--motion-duration-base) var(--motion-easing-standard);
      }
      /* Category accent rail — colored by the per-card --cat custom property. */
      .cat-card::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 4px;
        background: var(--cat);
      }
      .cat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: color-mix(in srgb, var(--cat) 45%, var(--color-border-default));
      }
      .cat-card:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .card-head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .icon-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--radius-md);
        font-size: var(--text-lg);
        background: color-mix(in srgb, var(--cat) 14%, transparent);
        color: var(--cat);
        flex-shrink: 0;
      }
      .cat-name {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-bold);
        letter-spacing: -0.01em;
        color: var(--color-text-primary);
      }

      .published {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .published .ic {
        color: var(--color-text-tertiary);
        flex-shrink: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        .cat-card {
          transition: none;
        }
        .cat-card:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class QuestionnaireOverviewPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);

  readonly cards = signal<CategoryCard[]>([]);
  readonly loading = signal(true);

  /** Friendly localized category name ("car" → "Auto Loan"), shared with the editor. */
  readonly label = categoryLabel;
  /** Accent + icon for a category — template helper. */
  meta(category: LoanCategory): CategoryMeta {
    return CATEGORY_META[category];
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const cards = await Promise.all(
        LOAN_CATEGORIES.map(async (category): Promise<CategoryCard> => {
          const history = await this.api.versionHistory(category);
          const active = history.find((v) => v.isActive) ?? null;
          return { category, lastPublishedAt: active?.publishedAt ?? null };
        }),
      );
      this.cards.set(cards);
    } finally {
      this.loading.set(false);
    }
  }
}
