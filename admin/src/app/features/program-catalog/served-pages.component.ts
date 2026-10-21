import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  DownOutline,
  HolderOutline,
} from '@ant-design/icons-angular/icons';
import { ruleCodes } from '@shared/questions/enabled-when';
import {
  moveBlock,
  moveBlockText,
  orderedIds,
  placeSubset,
  type OrderStep,
} from '@shared/questions/category-order';
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
  /** Its questions can be moved: every one of them is in the loan type's draft list. */
  readonly movable: boolean;
}

/**
 * The questionnaire as the mobile app pages it, for one program name in one loan type.
 *
 * Read-only, and read off the server's served snapshot — the customer read itself — so it is
 * what the app shows, not a second opinion. The app renders one step per group
 * (`questionnaire_state.dart`), in group order, and drops a group whose every question an
 * earlier answer hides; a gated question is listed here with the answer that shows it.
 *
 * A question moves within its page and nowhere else — a page is a section, and the order is
 * the LOAN TYPE's (`questions/categories/:category/reorder`), so every name under it follows.
 * A follow-up stays below the question it follows (`moveBlock`).
 */
@Component({
  selector: 'app-served-pages',
  standalone: true,
  imports: [DragDropModule, NzIconModule],
  providers: [provideNzIconsPatch([DownOutline, HolderOutline, ArrowUpOutline, ArrowDownOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="served" [attr.aria-label]="headingText()">
      <header class="head">
        <div class="head-row">
          <h3 class="title">{{ headingText() }}</h3>
          <!-- Collapsed by default: it sits above the board, and the board is what is edited.
               The choice is the viewer's own and survives a reload. -->
          <button
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
        @if (open() && reorderable()) {
          <p class="sub">{{ reorderHint() }}</p>
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
              <!-- One drop list per page and never connected: a question cannot be carried
                   onto another page, which is a different section. -->
              <ol
                class="qs"
                cdkDropList
                [cdkDropListDisabled]="!canMove(page)"
                (cdkDropListDropped)="dropped(page, $event)"
              >
                @for (row of page.rows; track row.q.code; let j = $index) {
                  <li class="q" cdkDrag cdkDragLockAxis="y" [cdkDragDisabled]="!canMove(page)">
                    @if (reorderable()) {
                      <button
                        type="button"
                        class="handle"
                        cdkDragHandle
                        [disabled]="!canMove(page)"
                        aria-label="Drag to reorder"
                        i18n-aria-label="@@qcat.reorder_aria"
                      >
                        <span nz-icon nzType="holder" nzTheme="outline" aria-hidden="true"></span>
                      </button>
                    }
                    <span class="q-no" aria-hidden="true">{{ j + 1 }}.</span>
                    <div class="q-body">
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
                    </div>
                    @if (reorderable()) {
                      <span class="q-acts">
                        <button
                          type="button"
                          class="icon-btn"
                          [disabled]="j === 0 || !canMove(page)"
                          (click)="move(page, j, j - 1)"
                          aria-label="Move up"
                          i18n-aria-label="@@qcat.move_up"
                        >
                          <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
                        </button>
                        <button
                          type="button"
                          class="icon-btn"
                          [disabled]="j === page.rows.length - 1 || !canMove(page)"
                          (click)="move(page, j, j + 1)"
                          aria-label="Move down"
                          i18n-aria-label="@@qcat.move_down"
                        >
                          <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                        </button>
                      </span>
                    }
                    <div class="drag-ghost" *cdkDragPlaceholder></div>
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
      /* A plain button on the theme's tokens: the library default paints white in dark mode. */
      .toggle {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-block-size: 28px;
        padding: 0 var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        cursor: pointer;
      }
      .toggle:hover {
        border-color: var(--primary);
        color: var(--primary-visible);
      }
      @media (hover: none) {
        .toggle {
          min-block-size: 44px;
        }
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
      .q {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2-5) var(--space-3);
        background: var(--bg-surface);
      }
      .q + .q {
        border-block-start: 1px solid var(--border-subtle);
      }
      /* A number in the markup, not a CSS counter: a counter renumbers the rows while one is
         being carried, and the numbers are what the operator is reading the move by. */
      .q-no {
        flex: none;
        min-inline-size: 1.75em;
        color: var(--text-tertiary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums lining-nums;
        text-align: end;
      }
      .q-body {
        flex: 1 1 auto;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .handle,
      .icon-btn {
        display: grid;
        place-items: center;
        flex: none;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: none;
        color: var(--text-secondary);
      }
      .handle {
        inline-size: 24px;
        block-size: 28px;
        cursor: grab;
      }
      .q-acts {
        display: flex;
        flex: none;
        gap: var(--space-1);
      }
      .icon-btn {
        inline-size: 28px;
        block-size: 28px;
        cursor: pointer;
      }
      .icon-btn:hover:not(:disabled) {
        border-color: var(--border-default);
        background: color-mix(in srgb, currentColor 6%, transparent);
      }
      .handle:disabled,
      .icon-btn:disabled {
        cursor: default;
        opacity: 0.35;
      }
      .handle:focus-visible,
      .icon-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .drag-ghost {
        block-size: 44px;
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }
      .cdk-drag-preview {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
      }
      .cdk-drag-placeholder > :not(.drag-ghost) {
        visibility: hidden;
      }
      .cdk-drop-list-dragging .q:not(.cdk-drag-placeholder) {
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      @media (hover: none) {
        .icon-btn,
        .handle {
          min-inline-size: 44px;
          min-block-size: 44px;
        }
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
  /**
   * The loan type's WHOLE asked list per step, from the draft tree. Empty turns reordering off —
   * the tree has not landed, or the operator may not write it.
   */
  readonly steps = input<readonly OrderStep[]>([]);
  readonly busy = input(false);
  /** The loan type's new order: every asked id once, in step order — the endpoint's contract. */
  readonly reorder = output<string[]>();

  private readonly message = inject(NzMessageService);

  protected readonly reorderable = computed(() => this.steps().length > 0);

  /**
   * The order this screen just sent, shown until the parent hands back a new served read — so a
   * moved row does not snap back for the length of the round trip. Keyed to the `pages` it was
   * made from: a fresh read is a new array and makes it stale.
   */
  private readonly pending = signal<{
    readonly pages: readonly ServedPage[];
    readonly order: ReadonlyMap<string, readonly string[]>;
  } | null>(null);

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
        const pending = this.pending();
        const override = pending?.pages === this.pages() ? pending.order.get(page.code) : undefined;
        const rank = (code: string): number => override?.indexOf(code) ?? -1;
        const rows = [...page.questions]
          .sort((a, b) => rank(a.code) - rank(b.code) || a.displayOrder - b.displayOrder)
          .map((q) => this.toRow(q));
        const step = this.steps().find((s) => s.code === page.code);
        const inStep = new Set(step?.rows.map((r) => r.code) ?? []);
        return {
          code: page.code,
          title: this.isAr() ? page.titleAr : page.titleEn,
          rows,
          mayBeSkipped: rows.every((r) => r.gate !== null),
          movable: rows.length > 1 && rows.every((r) => inStep.has(r.q.code)),
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
    return $localize`:@@srvp.summary2:${pages.length}:PAGES: pages · ${total}:TOTAL: questions · ${required}:REQUIRED: required`;
  });

  protected readonly reorderHint = computed(
    () =>
      $localize`:@@srvp.reorder_hint2:Drag or use the arrows to move a question within its page. This changes the order for every ${this.categoryName()}:TYPE: program.`,
  );

  protected canMove(page: PageView): boolean {
    return this.reorderable() && page.movable && !this.busy();
  }

  protected dropped(page: PageView, event: CdkDragDrop<unknown>): void {
    this.move(page, event.previousIndex, event.currentIndex);
  }

  /**
   * Move one served question within its page. The page shows what THIS name is served, a subset
   * of the loan type's step, so the new order is written into the slots these questions hold in
   * the whole step and the questions this name never sees stay where they are.
   */
  protected move(page: PageView, from: number, to: number): void {
    if (from === to || to < 0 || to >= page.rows.length || !this.canMove(page)) return;
    const steps = this.steps();
    const step = steps.find((s) => s.code === page.code);
    if (step === undefined) return;
    const codes = page.rows.map((r) => r.q.code);
    const [moved] = codes.splice(from, 1);
    if (moved === undefined) return;
    codes.splice(to, 0, moved);
    const rows = placeSubset(step.rows, codes);
    const block = moveBlock(rows, moved);
    if (block) {
      this.message.warning(moveBlockText(block, this.isAr()));
      return;
    }
    const order = new Map(this.pending()?.pages === this.pages() ? this.pending()?.order : []);
    order.set(page.code, codes);
    this.pending.set({ pages: this.pages(), order });
    this.reorder.emit(orderedIds(steps.map((s) => (s === step ? { ...s, rows } : s))));
  }

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

/** Collapsed unless this viewer opened it last time. */
function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
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
