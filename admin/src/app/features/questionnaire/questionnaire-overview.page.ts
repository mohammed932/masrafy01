import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  type LoanCategory,
  type QuestionnaireVersionRow,
} from './questionnaire.api.service';

interface CategoryCard {
  category: LoanCategory;
  active: QuestionnaireVersionRow | null;
  versionCount: number;
}

/**
 * Questionnaire overview — one card per loan category (Principle II scope-lock:
 * exactly four) showing the active published version + count + a publish action.
 * The full tree editor is a follow-up screen.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, NzButtonModule, NzCardModule, NzTagModule, NzSpinModule],
  template: `
    <section class="page">
      <header class="page-head">
        <h1 i18n="@@questionnaire.overview.title">Questionnaires</h1>
        <p class="muted" i18n="@@questionnaire.overview.subtitle">
          One published version per loan category drives the mobile questionnaire.
        </p>
      </header>

      @if (loading()) {
        <nz-spin nzSimple />
      } @else {
        <div class="cards">
          @for (c of cards(); track c.category) {
            <nz-card class="cat-card">
              <div class="row between">
                <span class="cat">{{ c.category }}</span>
                @if (c.active) {
                  <nz-tag nzColor="success" i18n="@@questionnaire.overview.live">LIVE</nz-tag>
                } @else {
                  <nz-tag i18n="@@questionnaire.overview.none">No version</nz-tag>
                }
              </div>
              <p class="muted small">
                @if (c.active) {
                  <span i18n="@@questionnaire.overview.active_version">Active version</span>
                  <span class="mono">#{{ c.active.versionNumber }}</span>
                } @else {
                  <span i18n="@@questionnaire.overview.unpublished">Not published yet</span>
                }
                · <span class="mono">{{ c.versionCount }}</span>
                <span i18n="@@questionnaire.overview.total_versions">versions</span>
              </p>
              <div class="row gap">
                <a nz-button nzType="primary" [routerLink]="['/questionnaire/edit', c.category]" i18n="@@questionnaire.overview.edit">
                  Edit
                </a>
                <button nz-button nzType="default" (click)="publish(c)" i18n="@@questionnaire.overview.publish">
                  Publish
                </button>
              </div>
            </nz-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page { padding: var(--space-6, 24px); }
      .page-head { margin-block-end: var(--space-5, 20px); }
      .muted { color: var(--ant-text-color-secondary, #6b7280); }
      .small { font-size: 13px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-4, 16px); }
      .row { display: flex; align-items: center; }
      .gap { gap: var(--space-2, 8px); }
      .between { justify-content: space-between; }
      .cat { text-transform: capitalize; font-weight: 600; font-size: 18px; }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
    `,
  ],
})
export class QuestionnaireOverviewPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);

  readonly cards = signal<CategoryCard[]>([]);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async publish(c: CategoryCard): Promise<void> {
    const v = await this.api.publish(c.category);
    this.message.success($localize`:@@questionnaire.overview.published:Published version #${v.versionNumber}`);
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const cards = await Promise.all(
        LOAN_CATEGORIES.map(async (category): Promise<CategoryCard> => {
          const history = await this.api.versionHistory(category);
          return {
            category,
            active: history.find((v) => v.isActive) ?? null,
            versionCount: history.length,
          };
        }),
      );
      this.cards.set(cards);
    } finally {
      this.loading.set(false);
    }
  }
}
