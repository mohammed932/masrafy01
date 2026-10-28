import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CloseOutline, LockOutline } from '@ant-design/icons-angular/icons';
import { ruleCodes } from '@shared/questions/enabled-when';
import type { ServedPage, ServedQuestion } from '@shared/questions/asked-questions.rules';

/**
 * Why a served question is on the list, and so whether this program may drop it.
 *
 *   - `fixed`: a fixed question — asked on every program, shown as is, never removed here.
 *   - `engine`: every quote reads it, so it is the loan type's, not one program's.
 *   - `program`: a bank program under this name reads it.
 *   - `gate`: another question on the list appears only after an answer to this one.
 *   - `added`: added for this program — removable.
 *   - `free`: asked by the loan type, not locked — removable (a per-program skip).
 */
export type ServedRowState = 'fixed' | 'engine' | 'program' | 'gate' | 'added' | 'free';

/** Which rows the list draws: every one, only the fixed ones, or only the rest. */
export type ServedFilter = 'all' | 'fixed' | 'other';

/** One question, as the list draws it. */
interface PageRow {
  readonly q: ServedQuestion;
  /** Its place on the page as the app shows it — kept while a filter hides its neighbours. */
  readonly pos: number;
  readonly label: string;
  /**
   * Hangs on the question right above it (or on the same question as the follow-ups between
   * them): drawn indented under it, so its rule needs only the answer.
   */
  readonly follow: boolean;
  /** The rule as drawn — the answer alone on a follow-up — or null when everyone sees it. */
  readonly gate: string | null;
  /** The whole rule, "Asked only when …", for the tooltip. */
  readonly gateFull: string | null;
  /** Why it is here; null when the page did not say (an older server). */
  readonly state: ServedRowState | null;
  /** The admin may take it off this program. */
  readonly removable: boolean;
}

interface PageView {
  readonly code: string;
  /** Its place in the app's order — a filter that empties an earlier page does not renumber it. */
  readonly num: number;
  readonly title: string;
  readonly rows: readonly PageRow[];
  /** Every question on the page, filter or not. */
  readonly total: number;
}

/**
 * What the mobile app asks someone applying for one program name, in one loan type: every
 * page, every question, in order — and, when `editable`, a Remove on each question this program
 * may drop. A fixed question is drawn as is, with a lock: it is asked on every program and only
 * Questionnaire changes it.
 *
 * Read off the server's served snapshot — the customer read itself — so it is what the app
 * shows, not a second opinion. The app renders one step per question group
 * (`questionnaire_state.dart`), in group order; a gated question is listed with the answer
 * that shows it.
 */
@Component({
  selector: 'app-served-pages',
  standalone: true,
  imports: [NzButtonModule, NzIconModule],
  providers: [provideNzIconsPatch([CloseOutline, LockOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (views().length === 0) {
      <p class="empty" i18n="@@srvp.empty">The app asks nothing on this loan type.</p>
    } @else {
      <ol class="pages">
        @for (page of views(); track page.code) {
          <li class="page">
            <h3 class="page-title">
              <span class="page-num">{{ page.num }}</span>
              <span class="page-name">{{ page.title }}</span>
              <span class="page-count">{{ countLabel(page.rows.length, page.total) }}</span>
            </h3>
            <ol class="rows">
              @for (row of page.rows; track row.q.code) {
                <li class="row" [class.is-follow]="row.follow">
                  <span class="num" aria-hidden="true">{{ row.pos }}</span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    @if (row.gate) {
                      <span class="gate" [attr.title]="row.gateFull">{{ row.gate }}</span>
                    }
                  </span>
                  <span class="tail">
                    @if (!row.q.isRequired) {
                      <span class="tag" i18n="@@srvp.tag_optional">Optional</span>
                    }
                    @switch (row.state) {
                      @case ('fixed') {
                        @if (filter() !== 'fixed') {
                          <span
                            class="tag is-lock is-fixed"
                            title="Asked on every program. Change it on Questionnaire."
                            i18n-title="@@srvp.fixed_hint"
                          >
                            <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                            <span i18n="@@srvp.tag_fixed">Fixed</span>
                          </span>
                        }
                      }
                      @case ('engine') {
                        <span class="tag is-lock">
                          <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@srvp.tag_engine">Every quote reads it</span>
                        </span>
                      }
                      @case ('program') {
                        <span class="tag is-lock is-bank">
                          <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@srvp.tag_bank">A bank here needs it</span>
                        </span>
                      }
                      @case ('gate') {
                        @if (editable()) {
                          <span class="tag is-lock">
                            <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                            <span i18n="@@srvp.tag_gate">A question below follows it</span>
                          </span>
                        }
                      }
                      @case ('added') {
                        <span class="tag is-added" i18n="@@srvp.tag_added"
                          >Added for this program</span
                        >
                      }
                    }
                    @if (editable() && row.removable) {
                      <button
                        nz-button
                        nzType="text"
                        nzSize="small"
                        type="button"
                        class="remove"
                        [nzLoading]="busy().has(row.q.code)"
                        [disabled]="busy().size > 0"
                        [attr.aria-label]="removeLabel(row.label)"
                        (click)="remove.emit(row.q.code)"
                      >
                        @if (!busy().has(row.q.code)) {
                          <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
                        }
                        <span i18n="@@srvp.remove">Remove</span>
                      </button>
                    }
                  </span>
                </li>
              }
            </ol>
          </li>
        }
      </ol>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .empty {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .pages,
      .rows {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pages {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .page-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .page-num {
        display: inline-grid;
        place-items: center;
        flex: none;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        border-radius: var(--radius-pill);
        background: var(--primary-subtle);
        color: var(--primary-visible);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }
      .page-name {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .page-count {
        flex: none;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-regular);
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums;
      }
      .rows {
        overflow: hidden;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }
      .row {
        display: grid;
        grid-template-columns: 1.75rem minmax(0, 1fr) auto;
        align-items: center;
        column-gap: var(--space-3);
        min-block-size: 44px;
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .row + .row {
        border-block-start: 1px solid var(--border-subtle);
      }
      .row:hover {
        background: var(--color-surface-row-hover);
      }
      .num {
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }
      /* A follow-up sits under the question it hangs on: the text steps in, and a short rule
         ties it to the row above. */
      .row.is-follow .text {
        padding-inline-start: var(--space-4);
        border-inline-start: 2px solid var(--border-default);
      }
      .text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .label {
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .gate {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .tail {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-2);
      }
      .tag {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        line-height: 1.5;
        white-space: nowrap;
      }
      .tag [nz-icon] {
        font-size: 0.85em;
      }
      /* Quiet on purpose: most rows are fixed, and seventeen loud chips would drown the one
         row the admin changed. */
      .tag.is-fixed {
        background: none;
        color: var(--text-tertiary);
        cursor: help;
      }
      .tag.is-bank {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .tag.is-added {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .remove {
        color: var(--text-secondary);
      }
      .remove:not([disabled]):hover {
        color: var(--ant-error-color);
      }
      @media (max-width: 560px) {
        .row {
          grid-template-columns: 1.75rem minmax(0, 1fr);
          row-gap: var(--space-2);
        }
        .tail {
          grid-column: 2;
          justify-content: flex-start;
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
export class ServedPagesComponent {
  readonly pages = input.required<readonly ServedPage[]>();
  readonly isAr = input(false);
  /** Why each served question is here, by code. Null on an older server: no chip, no action. */
  readonly states = input<ReadonlyMap<string, ServedRowState> | null>(null);
  /** Draws the Remove buttons and the gate locks. Off while no bank sells the name. */
  readonly editable = input(false);
  /** Codes with a write in flight. */
  readonly busy = input<ReadonlySet<string>>(new Set<string>());
  /** Which rows to draw. Numbers and page order stay the app's, so a filtered row keeps its place. */
  readonly filter = input<ServedFilter>('all');

  /** A question's code: take it off this program. */
  readonly remove = output<string>();

  /** Every served question by code — a gate's source may sit on an earlier page. */
  private readonly byCode = computed(() => {
    const map = new Map<string, ServedQuestion>();
    for (const page of this.pages()) for (const q of page.questions) map.set(q.code, q);
    return map;
  });

  protected readonly views = computed<PageView[]>(() => {
    const filter = this.filter();
    const states = this.states();
    const keep = (q: ServedQuestion): boolean => {
      if (filter === 'all') return true;
      const fixed = states?.get(q.code) === 'fixed';
      return filter === 'fixed' ? fixed : !fixed;
    };
    return [...this.pages()]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .filter((page) => page.questions.length > 0)
      .map((page, i) => {
        const sorted = [...page.questions].sort((a, b) => a.displayOrder - b.displayOrder);
        const pos = new Map(sorted.map((q, i) => [q.code, i + 1] as const));
        return {
          code: page.code,
          num: i + 1,
          title: this.isAr() ? page.titleAr : page.titleEn,
          // Filtered BEFORE the rows are built: a follow-up is indented only under a parent
          // that is actually drawn above it.
          rows: this.toRows(sorted.filter(keep), pos),
          total: sorted.length,
        };
      })
      .filter((page) => page.rows.length > 0);
  });

  protected countLabel(shown: number, total: number): string {
    if (shown !== total) return $localize`:@@srvp.count_of:${shown}:SHOWN: of ${total}:TOTAL:`;
    return total === 1
      ? $localize`:@@srvp.count_one:1 question`
      : $localize`:@@srvp.count_many:${total}:N: questions`;
  }

  protected removeLabel(label: string): string {
    return $localize`:@@srvp.remove_aria:Remove “${label}:QUESTION:” from this program`;
  }

  /**
   * A gated question is a follow-up when the question it hangs on is right above it, or above
   * an unbroken run of other follow-ups of that same question. Anywhere else the indent would
   * point at the wrong parent, so the whole sentence is drawn.
   */
  private toRows(
    questions: readonly ServedQuestion[],
    pos: ReadonlyMap<string, number>,
  ): PageRow[] {
    const states = this.states();
    return questions.map((q, i) => {
      const gateFull = this.gateText(q);
      const source = q.enabledWhen?.questionCode;
      let k = i - 1;
      while (k >= 0 && questions[k]?.enabledWhen?.questionCode === source) k--;
      const follow = gateFull !== null && !!source && questions[k]?.code === source;
      const state = states?.get(q.code) ?? null;
      return {
        q,
        pos: pos.get(q.code) ?? i + 1,
        label: this.isAr() ? q.questionAr : q.questionEn,
        follow,
        gate: follow ? this.gateShort(q) : gateFull,
        gateFull,
        state,
        removable: state === 'added' || state === 'free',
      };
    });
  }

  /** The answers a rule names, in words; a code its source no longer offers stays a code. */
  private gateAnswers(q: ServedQuestion, source: ServedQuestion): string {
    const ar = this.isAr();
    const codes = ruleCodes(q.enabledWhen);
    return codes
      .map((code) => source.options.find((o) => o.code === code))
      .map((o, i) => (o ? (ar ? o.labelAr : o.labelEn) : codes[i]))
      .join(' / ');
  }

  /** A follow-up's rule: the answer alone, because the question it follows is right above. */
  private gateShort(q: ServedQuestion): string | null {
    const code = q.enabledWhen?.questionCode;
    const source = code ? this.byCode().get(code) : undefined;
    if (source === undefined) return null;
    const answers = this.gateAnswers(q, source);
    return q.enabledWhen?.operator === 'not_equals'
      ? $localize`:@@srvp.gate_unless:Unless: ${answers}:ANSWERS:`
      : $localize`:@@srvp.gate_if:If: ${answers}:ANSWERS:`;
  }

  /**
   * The show-when rule in words. A rule whose source is not served, or that names no answer,
   * never hides its question in the app (`gateOpen`), so it reads as no rule here too.
   */
  private gateText(q: ServedQuestion): string | null {
    const rule = q.enabledWhen;
    const source = rule?.questionCode ? this.byCode().get(rule.questionCode) : undefined;
    if (!rule || source === undefined || ruleCodes(rule).length === 0) return null;
    const answers = this.gateAnswers(q, source);
    const asked = this.isAr() ? source.questionAr : source.questionEn;
    return rule.operator === 'not_equals'
      ? $localize`:@@srvp.gate_not:Asked unless “${asked}:SOURCE:” is ${answers}:ANSWERS:`
      : $localize`:@@srvp.gate_is:Asked only when “${asked}:SOURCE:” is ${answers}:ANSWERS:`;
  }
}
