import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { DownOutline } from '@ant-design/icons-angular/icons';
import { ruleCodes } from '@shared/questions/enabled-when';
import type { ServedPage, ServedQuestion } from '@shared/questions/asked-questions.rules';

/** One question, as the page draws it: its number on the page and the rule in words. */
interface PageRow {
  readonly q: ServedQuestion;
  readonly label: string;
  readonly helper: string | null;
  readonly type: string | null;
  /** "Asked only when …", or null when everyone on this page sees it. */
  readonly gate: string | null;
  readonly answers: readonly string[];
}

interface PageView {
  readonly code: string;
  readonly title: string;
  readonly rows: readonly PageRow[];
  /** Every question on it hangs on an earlier answer, so some applicants never see the page. */
  readonly mayBeSkipped: boolean;
}

/**
 * The questionnaire as the mobile app pages it, for one program name in one loan type.
 *
 * Read-only, and read off the server's served snapshot — the customer read itself — so it is
 * what the app shows, not a second opinion. The app renders one step per group
 * (`questionnaire_state.dart`), in group order, and drops a group whose every question an
 * earlier answer hides; a gated question is listed here with the answer that shows it.
 */
@Component({
  selector: 'app-served-pages',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  providers: [provideNzIconsPatch([DownOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="served" [attr.aria-label]="headingText()">
      <header class="head">
        <div class="head-row">
          <h3 class="title">{{ headingText() }}</h3>
          <!-- Open by default: it sits above the board, and the board is what is edited. The
               choice is the viewer's own and survives a reload. -->
          <button
            nz-button
            nzSize="small"
            type="button"
            class="toggle"
            [class.is-open]="open()"
            [attr.aria-expanded]="open()"
            aria-controls="served-pages-list"
            (click)="toggle()"
          >
            <span>{{ open() ? hideText : showText }}</span>
            <span nz-icon nzType="down" nzTheme="outline" aria-hidden="true"></span>
          </button>
        </div>
        <p class="sub">{{ summaryText() }}</p>
        @if (!nameAxisActive()) {
          <p class="note" i18n="@@srvp.axis_off">
            No bank sells this name yet, so the app asks what the loan type asks — your unticks and
            additions apply once a bank program is filed under it.
          </p>
        }
      </header>

      <!-- Collapsed, the heading and the summary line stay and the pages do not. -->
      @if (open() && views().length === 0) {
        <p class="empty" i18n="@@srvp.empty">The app asks nothing on this loan type.</p>
      } @else if (open()) {
        <ol class="pages" id="served-pages-list">
          @for (page of views(); track page.code; let i = $index) {
            <li class="page">
              <div class="page-head">
                <span class="page-no">{{ pageLabel(i + 1) }}</span>
                <span class="page-title">{{ page.title }}</span>
                <span class="page-count">{{ countLabel(page.rows.length) }}</span>
                @if (page.mayBeSkipped) {
                  <span class="tag is-type" i18n="@@srvp.page_skippable"
                    >Shown only to some applicants</span
                  >
                }
              </div>
              <ol class="qs">
                @for (row of page.rows; track row.q.code) {
                  <li class="q">
                    <span class="q-label">{{ row.label }}</span>
                    @if (row.helper) {
                      <span class="q-helper">{{ row.helper }}</span>
                    }
                    <span class="meta">
                      @if (row.q.isRequired) {
                        <span class="tag" i18n="@@caq.tag_required">Required</span>
                      } @else {
                        <span class="tag is-type" i18n="@@srvp.tag_optional">Optional</span>
                      }
                      @if (row.type) {
                        <span class="tag is-type">{{ row.type }}</span>
                      }
                      @if (row.gate) {
                        <span class="tag is-gate">{{ row.gate }}</span>
                      }
                    </span>
                    @if (row.answers.length > 0) {
                      <span class="answers">{{ row.answers.join(' · ') }}</span>
                    }
                  </li>
                }
              </ol>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .served {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .toggle {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .toggle [nz-icon] {
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .toggle.is-open [nz-icon] {
        transform: rotate(180deg);
      }
      .toggle:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      @media (prefers-reduced-motion: reduce) {
        .toggle [nz-icon] {
          transition: none;
        }
      }
      .head {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .sub,
      .note,
      .empty {
        margin: 0;
        max-inline-size: 72ch;
        font-size: var(--text-xs);
        line-height: 1.55;
        color: var(--text-secondary);
      }
      .note {
        padding: var(--space-2) var(--space-3);
        border-inline-start: var(--rule-width-accent) solid var(--ant-warning-color);
        border-radius: var(--radius-sm);
        background: var(--color-warning-bg);
        color: var(--text-primary);
      }
      .pages,
      .qs {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pages {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .page {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        overflow: hidden;
      }
      .page-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2-5) var(--space-3);
        border-block-end: 1px solid var(--border-subtle);
        background: var(--bg-subtle);
      }
      .page-no {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--primary) 12%, var(--bg-surface));
        color: var(--primary-visible);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .page-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .page-count {
        margin-inline-start: auto;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .qs {
        counter-reset: q;
      }
      .q {
        counter-increment: q;
        display: grid;
        grid-template-columns: 2.25em minmax(0, 1fr);
        column-gap: var(--space-2);
        row-gap: var(--space-1);
        padding: var(--space-2-5) var(--space-3);
      }
      .q + .q {
        border-block-start: 1px solid var(--border-subtle);
      }
      .q::before {
        content: counter(q) '.';
        grid-row: 1 / span 4;
        color: var(--text-tertiary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums lining-nums;
        text-align: end;
      }
      .q-label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        line-height: var(--leading-snug);
        color: var(--text-primary);
      }
      .q-helper,
      .answers {
        font-size: var(--text-xs);
        line-height: 1.5;
        color: var(--text-secondary);
      }
      .q > :not(.q-label) {
        grid-column: 2;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .tag {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .tag.is-type {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-default);
      }
      /* A long rule wraps, and a two-line pill reads as a blob: a box instead. */
      .tag.is-gate {
        border-radius: var(--radius-sm);
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-strong);
        color: var(--text-primary);
        font-weight: var(--font-weight-medium);
      }
    `,
  ],
})
export class ServedPagesComponent {
  readonly pages = input.required<readonly ServedPage[]>();
  readonly isAr = input(false);
  /** The loan type's label, for the heading. */
  readonly categoryName = input.required<string>();
  readonly nameAxisActive = input(true);

  protected readonly open = signal(readOpen());
  protected readonly showText = $localize`:@@srvp.show:Show pages`;
  protected readonly hideText = $localize`:@@srvp.hide:Hide pages`;

  protected toggle(): void {
    this.open.update((v) => !v);
    try {
      localStorage.setItem(OPEN_KEY, this.open() ? '1' : '0');
    } catch {
      // Storage blocked: the toggle still works for this visit.
    }
  }

  /** Every served question by code — a gate's source may sit on an earlier page. */
  private readonly byCode = computed(() => {
    const map = new Map<string, ServedQuestion>();
    for (const page of this.pages()) for (const q of page.questions) map.set(q.code, q);
    return map;
  });

  protected readonly views = computed<PageView[]>(() =>
    [...this.pages()]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((page) => {
        const rows = [...page.questions]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((q) => this.toRow(q));
        return {
          code: page.code,
          title: this.isAr() ? page.titleAr : page.titleEn,
          rows,
          mayBeSkipped: rows.every((r) => r.gate !== null),
        };
      }),
  );

  protected readonly headingText = computed(
    () => $localize`:@@srvp.heading:What the app shows a ${this.categoryName()}:TYPE: applicant`,
  );

  protected readonly summaryText = computed(() => {
    const pages = this.views();
    const total = pages.reduce((n, p) => n + p.rows.length, 0);
    const required = pages.reduce((n, p) => n + p.rows.filter((r) => r.q.isRequired).length, 0);
    return $localize`:@@srvp.summary:${pages.length}:PAGES: pages, ${total}:TOTAL: questions, ${required}:REQUIRED: required — one page per section, in this order, after the applicant picks the loan type and this program in the app. A question that depends on an earlier answer says which.`;
  });

  protected pageLabel(n: number): string {
    return $localize`:@@srvp.page_no:Page ${n}:N:`;
  }

  protected countLabel(n: number): string {
    return n === 1
      ? $localize`:@@srvp.count_one:1 question`
      : $localize`:@@srvp.count_many:${n}:N: questions`;
  }

  private toRow(q: ServedQuestion): PageRow {
    const ar = this.isAr();
    return {
      q,
      label: ar ? q.questionAr : q.questionEn,
      helper: (ar ? q.helperTextAr : q.helperTextEn) || null,
      type: typeLabel(q.type),
      gate: this.gateText(q),
      answers: [...q.options]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((o) => (ar ? o.labelAr : o.labelEn)),
    };
  }

  /**
   * The show-when rule in words. A rule whose source is not served, or that names no answer,
   * never hides its question in the app (`gateOpen`), so it reads as no rule here too.
   */
  private gateText(q: ServedQuestion): string | null {
    const rule = q.enabledWhen;
    const source = rule?.questionCode ? this.byCode().get(rule.questionCode) : undefined;
    const codes = ruleCodes(rule);
    if (!rule || source === undefined || codes.length === 0) return null;
    const ar = this.isAr();
    const answers = codes
      .map((code) => source.options.find((o) => o.code === code))
      .map((o, i) => (o ? (ar ? o.labelAr : o.labelEn) : codes[i]))
      .join(' / ');
    const asked = ar ? source.questionAr : source.questionEn;
    return rule.operator === 'not_equals'
      ? $localize`:@@srvp.gate_not:Asked unless “${asked}:SOURCE:” is ${answers}:ANSWERS:`
      : $localize`:@@srvp.gate_is:Asked only when “${asked}:SOURCE:” is ${answers}:ANSWERS:`;
  }
}

const OPEN_KEY = 'masrafy.servedPages.open';

/** Open unless this viewer closed it last time. */
function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

function typeLabel(type: string): string | null {
  switch (type) {
    case 'SINGLE_SELECT':
      return $localize`:@@askq.type_single:Pick one`;
    case 'MULTI_SELECT':
      return $localize`:@@askq.type_multi:Pick several`;
    case 'NUMERIC':
      return $localize`:@@askq.type_number:Number`;
    case 'TEXT':
      return $localize`:@@askq.type_text:Text`;
    default:
      return null;
  }
}
