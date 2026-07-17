import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ApplicantQuestionnaire } from '../../api/applications.api.service';

interface RenderedGroup {
  title: string;
  rows: { question: string; answer: string }[];
}

/**
 * The applicant's real questionnaire responses — the data they actually gave in
 * the mobile app — from the frozen version snapshot. Groups become tabs so each
 * section gets the full card width; within a tab, every question stacks its
 * answer beneath it (label over value) so long answers wrap at word boundaries
 * instead of being crushed into a narrow right column.
 *
 * Replaces the old "Declared financials" card (derived offer-math placeholders).
 * Labels are bilingual in the payload; the active dashboard locale (LOCALE_ID)
 * selects Arabic vs English. Group/question/answer text is DB content, not i18n.
 */
@Component({
  selector: 'app-applicant-questionnaire',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (groups().length > 0) {
      <section class="responses">
        <h2 i18n="@@applications.responses.title">Questionnaire responses</h2>

        <div class="card">
          @if (groups().length > 1) {
            <div class="tabs" role="tablist">
              @for (g of groups(); track g.title; let i = $index) {
                <button
                  type="button"
                  class="tab"
                  role="tab"
                  [class.active]="i === activeIndex()"
                  [attr.aria-selected]="i === activeIndex()"
                  [attr.tabindex]="i === activeIndex() ? 0 : -1"
                  (click)="activeIndex.set(i)"
                  (keydown)="onKeydown($event, i)"
                >
                  <span class="tab-title">{{ g.title }}</span>
                  <span class="tab-count">{{ g.rows.length }}</span>
                </button>
              }
            </div>
          }

          @if (activeGroup(); as g) {
            <div class="panel" role="tabpanel">
              <dl class="qa-grid">
                @for (row of g.rows; track row.question) {
                  <div class="qa">
                    <dt class="q">{{ row.question }}</dt>
                    <dd class="a">{{ row.answer }}</dd>
                  </div>
                }
              </dl>
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      .responses {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      h2 {
        margin: 0;
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
      .card {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      /* Tab strip — scrolls horizontally when the category names are long */
      .tabs {
        display: flex;
        gap: var(--space-1);
        padding-inline: var(--space-4);
        border-block-end: 1px solid var(--color-border-default);
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
        padding-block: var(--space-3);
        padding-inline: var(--space-2);
        background: none;
        border: none;
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        white-space: nowrap;
        cursor: pointer;
        transition:
          color var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tab:hover:not(.active) {
        color: var(--color-text-secondary);
      }
      .tab.active {
        color: var(--color-brand-primary);
        border-block-end-color: var(--color-brand-primary);
      }
      .tab:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: -2px;
        border-radius: var(--radius-sm);
      }
      .tab-count {
        min-inline-size: 18px;
        padding-inline: 6px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        line-height: 1.5;
        text-align: center;
      }
      .tab.active .tab-count {
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
      }

      /* Answer panel — question label stacked over its value, full column width */
      .panel {
        padding: var(--space-4);
        animation: fade var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes fade {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .panel {
          animation: none;
        }
      }
      .qa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--space-4) var(--space-5);
        margin: 0;
      }
      .qa {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .q {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
        line-height: 1.4;
      }
      .a {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class ApplicantQuestionnaireComponent {
  private readonly localeId = inject(LOCALE_ID);
  readonly data = input.required<ApplicantQuestionnaire>();

  protected readonly activeIndex = signal(0);

  protected readonly groups = computed<RenderedGroup[]>(() => {
    const ar = this.localeId.startsWith('ar');
    return this.data()
      .groups.map((g) => ({
        title: ar ? g.titleAr : g.titleEn,
        rows: g.items.map((it) => ({
          question: ar ? it.questionAr : it.questionEn,
          answer: (ar ? it.answerAr : it.answerEn) ?? it.answerEn ?? it.answerAr ?? '—',
        })),
      }))
      .filter((g) => g.rows.length > 0);
  });

  protected readonly activeGroup = computed<RenderedGroup | null>(() => {
    const gs = this.groups();
    if (gs.length === 0) return null;
    return gs[Math.min(this.activeIndex(), gs.length - 1)] ?? null;
  });

  /** Roving arrow-key navigation across the tablist (WAI-ARIA tabs pattern). */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.groups().length;
    if (count < 2) return;
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % count;
    else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
    else return;
    event.preventDefault();
    this.activeIndex.set(next);
    const list = (event.currentTarget as HTMLElement).parentElement;
    const target = list?.children[next];
    if (target instanceof HTMLElement) target.focus();
  }
}
