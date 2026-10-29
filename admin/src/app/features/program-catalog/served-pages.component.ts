import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  CloseOutline,
  HolderOutline,
  LockOutline,
} from '@ant-design/icons-angular/icons';
import { ruleCodes } from '@shared/questions/enabled-when';
import type { ServedPage, ServedQuestion } from '@shared/questions/asked-questions.rules';
import type { PageMove } from '@shared/questions/question-order';

/**
 * Why a served question is on the list, and so whether this program may drop it.
 *
 *   - `fixed`: a fixed question — asked on every program, shown as is, never removed here.
 *   - `engine`: every quote reads it, so every program asks it.
 *   - `program`: a bank program under this name reads it.
 *   - `gate`: another question on the list appears only after an answer to this one.
 *   - `added`: ticked for this program — removable (v32.0.0: the only removable kind; there is
 *     no loan-type list to skip a question from any more).
 */
export type ServedRowState = 'fixed' | 'engine' | 'program' | 'gate' | 'added';

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
 * `ordering` turns the list into the program's ORDER editor (v32.0.0): each page is its own drop
 * list — a question never changes page — with a drag handle on every row and up / down arrows as
 * the keyboard path. A move is emitted (`move`); the host checks it, saves it and hands the
 * pages back in the new order.
 *
 * Read off the server's served snapshot — the customer read itself — so it is what the app
 * shows, not a second opinion. The app renders one step per question group
 * (`questionnaire_state.dart`), in group order; a gated question is listed with the answer
 * that shows it.
 */
@Component({
  selector: 'app-served-pages',
  standalone: true,
  imports: [NzButtonModule, NzIconModule, DragDropModule],
  providers: [
    provideNzIconsPatch([
      ArrowDownOutline,
      ArrowUpOutline,
      CloseOutline,
      HolderOutline,
      LockOutline,
    ]),
  ],
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
            <ol
              class="rows"
              cdkDropList
              [cdkDropListDisabled]="!ordering() || orderBusy()"
              (cdkDropListDropped)="dropped(page.code, $event)"
            >
              @for (
                row of page.rows;
                track row.q.code;
                let i = $index, first = $first, last = $last
              ) {
                <li
                  class="row"
                  [class.is-follow]="row.follow"
                  [class.is-ordering]="ordering()"
                  cdkDrag
                  cdkDragLockAxis="y"
                  [cdkDragDisabled]="!ordering() || orderBusy()"
                >
                  @if (ordering()) {
                    <button
                      type="button"
                      class="handle"
                      cdkDragHandle
                      [disabled]="orderBusy()"
                      aria-label="Drag to reorder"
                      i18n-aria-label="@@qedit.reorder_aria"
                    >
                      <span nz-icon nzType="holder" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                  }
                  <span class="num" aria-hidden="true">{{ row.pos }}</span>
                  <span class="text">
                    <span class="label">{{ row.label }}</span>
                    @if (row.gate) {
                      <span class="gate" [attr.title]="row.gateFull">{{ row.gate }}</span>
                    }
                  </span>
                  <span class="tail">
                    @if (ordering()) {
                      <span class="moves">
                        <button
                          nz-button
                          nzType="text"
                          nzSize="small"
                          type="button"
                          class="move-btn"
                          [id]="'srvp-up-' + row.q.code"
                          [disabled]="first"
                          [attr.aria-disabled]="orderBusy() ? 'true' : null"
                          [attr.aria-label]="upLabel(row.label)"
                          [attr.title]="upLabel(row.label)"
                          (click)="step(page.code, i, -1, row.q.code)"
                        >
                          <span
                            nz-icon
                            nzType="arrow-up"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                        </button>
                        <button
                          nz-button
                          nzType="text"
                          nzSize="small"
                          type="button"
                          class="move-btn"
                          [id]="'srvp-down-' + row.q.code"
                          [disabled]="last"
                          [attr.aria-disabled]="orderBusy() ? 'true' : null"
                          [attr.aria-label]="downLabel(row.label)"
                          [attr.title]="downLabel(row.label)"
                          (click)="step(page.code, i, 1, row.q.code)"
                        >
                          <span
                            nz-icon
                            nzType="arrow-down"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                        </button>
                      </span>
                    } @else {
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
                              <span
                                nz-icon
                                nzType="lock"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
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
                              <span
                                nz-icon
                                nzType="lock"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
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
                            <span
                              nz-icon
                              nzType="close"
                              nzTheme="outline"
                              aria-hidden="true"
                            ></span>
                          }
                          <span i18n="@@srvp.remove">Remove</span>
                        </button>
                      }
                    }
                  </span>
                  <div class="drag-ghost" *cdkDragPlaceholder></div>
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
      /* ---- Order mode: a handle in front, arrows at the end ---- */
      .row.is-ordering {
        grid-template-columns: 1.75rem 1.75rem minmax(0, 1fr) auto;
        padding-inline-start: var(--space-2);
      }
      .handle {
        display: grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: var(--size-field);
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: none;
        color: var(--text-tertiary);
        cursor: grab;
      }
      .handle:hover:not(:disabled) {
        color: var(--text-secondary);
      }
      .handle:disabled {
        cursor: default;
        opacity: 0.4;
      }
      .handle:focus-visible,
      .move-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .moves {
        display: inline-flex;
        gap: var(--space-1);
      }
      .move-btn {
        min-inline-size: 2.25rem;
        color: var(--text-secondary);
      }
      /* The colour above outranks ng-zorro's disabled one, so the top row's up arrow would
         look pressable. */
      .move-btn:disabled {
        opacity: 0.4;
      }
      /* A save in flight: still focusable (a disabled button drops the keyboard user's place),
         but inert — step() ignores the press. */
      .move-btn[aria-disabled='true'] {
        cursor: progress;
        opacity: 0.5;
      }
      .cdk-drag-preview {
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        box-shadow: var(--shadow-lg);
      }
      .drag-ghost {
        block-size: var(--size-field);
        border: 1px dashed var(--primary-visible);
        border-radius: var(--radius-md);
        background: var(--primary-subtle);
      }
      .cdk-drop-list-dragging .row {
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      @media (hover: none) {
        .handle,
        .move-btn {
          min-inline-size: var(--size-field);
          min-block-size: var(--size-field);
        }
        .row.is-ordering {
          grid-template-columns: var(--size-field) 1.75rem minmax(0, 1fr) auto;
        }
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
        .row.is-ordering {
          grid-template-columns: 1.75rem 1.75rem minmax(0, 1fr);
        }
        .row.is-ordering .tail {
          grid-column: 3;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .row,
        .cdk-drop-list-dragging .row {
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
  /** The order editor: handles and arrows instead of tags and Remove. The host forces `all`. */
  readonly ordering = input(false);
  /** A move is being saved: every handle and arrow waits. */
  readonly orderBusy = input(false);

  /** A question's code: take it off this program. */
  readonly remove = output<string>();
  /** A question moved within its page — `from` / `to` in the page's own order, 0-based. */
  readonly move = output<PageMove>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

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

  protected upLabel(label: string): string {
    return $localize`:@@srvp.up_aria:Move “${label}:QUESTION:” up`;
  }

  protected downLabel(label: string): string {
    return $localize`:@@srvp.down_aria:Move “${label}:QUESTION:” down`;
  }

  /** A drop inside one page. Drop lists are not connected, so a question never changes page. */
  protected dropped(page: string, event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.move.emit({ page, from: event.previousIndex, to: event.currentIndex });
  }

  /**
   * One arrow press: the keyboard path, one place at a time. The row's element moves with it, which
   * drops focus, so the same arrow is focused again once the new order is drawn — or the other
   * arrow, when the row has reached the end this one points at.
   */
  protected step(page: string, index: number, delta: -1 | 1, code: string): void {
    // Not `disabled` while a save is in flight — focus would fall to the page — so refused here.
    if (this.orderBusy()) return;
    this.move.emit({ page, from: index, to: index + delta });
    afterNextRender(
      () => {
        const id = (dir: 'up' | 'down'): HTMLButtonElement | null =>
          this.host.nativeElement.querySelector<HTMLButtonElement>(
            `#${CSS.escape(`srvp-${dir}-${code}`)}`,
          );
        const same = id(delta < 0 ? 'up' : 'down');
        const other = id(delta < 0 ? 'down' : 'up');
        (same !== null && !same.disabled ? same : other)?.focus();
      },
      { injector: this.injector },
    );
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
        removable: state === 'added',
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
