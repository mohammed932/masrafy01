import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  CloseOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
  UndoOutline,
} from '@ant-design/icons-angular/icons';
import { RailTabsComponent, StatStripComponent } from '@shared/ui';
import type { RailTabItem, StatStripItem } from '@shared/ui';
import {
  parsePastedValues,
  type PasteClass,
  type PasteParseResult,
  type PasteRow,
  type PasteRowState,
  type PasteSeparator,
} from './parse-pasted-values';

/**
 * What a save would send, each row still carrying the LINE it came from.
 *
 * `line` is client-only and the host strips it before the request. It is carried because the
 * server reports a bad row by its ZERO-BASED index into what was sent, and turning that back
 * into a line the operator can see is otherwise a guess — matching on the label would be
 * wrong the moment two lines share one, and pointing at the wrong line is worse than pointing
 * at none.
 */
export interface PasteValuesDraft {
  rows: ReadonlyArray<{ line: number; labelEn: string; labelAr: string; parentKey?: string }>;
  /**
   * Lines that cannot be added as typed.
   *
   * Carried so the HOST can refuse the save. Sending the good rows and dropping these would be
   * the screen quietly deciding that two of the operator's lines did not matter — and it is
   * the shape most likely to go unnoticed, because the count that says so is the one they
   * would have had to read before pressing Add.
   *
   * Skipped and duplicate lines are NOT counted here: those are lines the operator, or the
   * list, has already answered for.
   */
  blocked: number;
}

type PreviewFilter = 'all' | 'problems' | 'fallback' | 'dupes';

/** How many rows are rendered before the operator asks for more. See the styles note. */
const WINDOW = 100;

/**
 * Paste a block of text, see what it parses to, fix it in place.
 *
 * PRESENTATIONAL. It writes nothing and fetches nothing: the host supplies the class list and
 * the keys already taken, and takes the parsed draft back. Two hosts want it for genuinely
 * different reasons — the values screen, where the list already exists, and the product's
 * create-a-fact screen, where the classes do not exist yet and a trip to a separate URL would
 * have nothing to file against.
 *
 * ── THE THREE THINGS THIS SCREEN IS ───────────────────────────────────────────
 * 1. A SUMMARY. At four hundred rows nobody reads a table; they read five numbers and open
 *    the table only when one of them is not zero. The strip is the primary surface.
 * 2. A FIXER. Re-pasting four hundred lines to correct three is the failure this feature
 *    exists to delete. Three mechanisms and no fourth: a per-token class picker (one pick
 *    fixes every line with that spelling — this is where the leverage is), per-row inline
 *    edit on EVERY row (someone who spots a typo on line 5 must not have to break it first),
 *    and row remove/restore.
 * 3. A PREVIEW, never a writer. The host owns the transaction.
 *
 * ── THE OVERLAY RULE, which is the subtle bit ─────────────────────────────────
 * The textarea is the SOURCE. An inline edit is an OVERLAY keyed by line number, and it is
 * dropped only when that line's raw text changes. So typing at the bottom of the box never
 * silently discards a fix made at the top, and editing the very line a fix was made against
 * correctly abandons it.
 *
 * ── STATE IS NEVER COLOUR ALONE ───────────────────────────────────────────────
 * Every row state is a WORD, and the tint is reinforcement. The operator's job here is to
 * find three bad rows in four hundred, and a tint is not something you can search.
 */
@Component({
  selector: 'app-paste-values',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    RailTabsComponent,
    StatStripComponent,
  ],
  providers: [
    provideNzIconsPatch([CloseOutline, ExclamationCircleOutline, InfoCircleOutline, UndoOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pv">
      <label class="pv__field">
        <span class="pv__label" i18n="@@pv.box.label">Paste your list here</span>
        <textarea
          nz-input
          class="pv__box"
          rows="10"
          spellcheck="false"
          [placeholder]="boxPlaceholder()"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
          [ngModelOptions]="{ standalone: true }"
        ></textarea>
        <span class="pv__help">{{ boxHint() }}</span>
      </label>

      <div class="pv__sep" role="radiogroup" [attr.aria-label]="sepAria">
        @for (option of separators; track option) {
          <button
            type="button"
            class="pv__sep-btn"
            role="radio"
            [class.is-on]="separator() === option"
            [attr.aria-checked]="separator() === option"
            (click)="separator.set(option)"
          >
            {{ separatorLabel(option) }}
          </button>
        }
      </div>
      @if (text().trim() !== '') {
        <p class="pv__read">{{ readAs() }}</p>
      }
      @if (parsed().headerSkipped) {
        <p class="pv__note" role="status">
          <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@pv.header_skipped"
            >The first line looked like column headings, so it was skipped.</span
          >
        </p>
      }

      @if (parsed().rows.length > 0) {
        <app-stat-strip [items]="stats()" />

        @if (parsed().unknownTokens.length > 0) {
          <section class="pv__fixer">
            <h3 class="pv__fixer-title" i18n="@@pv.fix.title">Names this list has no class for</h3>
            <ul class="pv__fixer-list">
              @for (t of parsed().unknownTokens; track t.token) {
                <li class="pv__fixer-row">
                  <span class="pv__token">{{ t.token }}</span>
                  <span class="pv__token-lines">{{ tokenLinesLabel(t.lines.length) }}</span>
                  <nz-select
                    class="pv__token-pick"
                    [ngModel]="null"
                    [ngModelOptions]="{ standalone: true }"
                    [nzPlaceHolder]="pickClassLabel"
                    (ngModelChange)="fixToken(t.token, $event)"
                  >
                    @for (c of classes(); track c.key) {
                      <nz-option [nzValue]="c.key" [nzLabel]="classLabel(c)"></nz-option>
                    }
                  </nz-select>
                </li>
              }
            </ul>
          </section>
        }

        <app-rail-tabs
          [items]="filterTabs()"
          [activeId]="filter()"
          [ariaLabel]="filterAria"
          idPrefix="pv"
          appearance="segmented"
          (select)="setFilter($event)"
        />

        <div
          class="pv__table"
          role="tabpanel"
          [id]="'pv-panel-' + filter()"
          [attr.aria-labelledby]="'pv-tab-' + filter()"
        >
          @if (visible().length === 0) {
            <p class="pv__empty">{{ emptyLabel() }}</p>
          } @else {
            <!-- Six columns of bare inputs named only by aria-label read as unfinished to
                 everyone who can see them: the operator has to infer which box is English and
                 which is Arabic, and the one thing this screen exists to make obvious is
                 which column is which. Sticky, because the table scrolls inside itself. -->
            <div class="pv__head" [class.is-flat]="parsed().columns === 2" aria-hidden="true">
              <span class="pv__line" i18n="@@pv.col.line">#</span>
              <span i18n="@@pv.col.en">English name</span>
              <span i18n="@@pv.col.ar">Arabic name</span>
              @if (parsed().columns === 3) {
                <span i18n="@@pv.col.class">Class</span>
              }
              <span i18n="@@pv.col.state">State</span>
              <span></span>
            </div>
            <ol class="pv__rows">
              @for (row of windowed(); track row.line) {
                <li
                  class="pv__row"
                  [class.is-flat]="parsed().columns === 2"
                  [class.is-bad]="isBad(row)"
                  [class.is-out]="isOut(row)"
                >
                  <span class="pv__line">{{ row.line }}</span>
                  <input
                    class="pv__cell"
                    type="text"
                    [attr.aria-label]="cellAria(row, 'en')"
                    [ngModel]="row.labelEn"
                    (ngModelChange)="edit(row, 'labelEn', $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  <input
                    class="pv__cell"
                    type="text"
                    [class.is-derived]="hasState(row, 'noArabic')"
                    [attr.aria-label]="cellAria(row, 'ar')"
                    [ngModel]="row.labelAr"
                    (ngModelChange)="edit(row, 'labelAr', $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  @if (parsed().columns === 3) {
                    <nz-select
                      class="pv__cell-class"
                      [ngModel]="row.classKey"
                      [ngModelOptions]="{ standalone: true }"
                      [attr.aria-label]="cellAria(row, 'class')"
                      (ngModelChange)="edit(row, 'classKey', $event)"
                    >
                      @for (c of classes(); track c.key) {
                        <nz-option [nzValue]="c.key" [nzLabel]="classLabel(c)"></nz-option>
                      }
                    </nz-select>
                  }
                  <span class="pv__state">
                    <span
                      class="pv__dot"
                      [class]="'is-' + stateTone(row)"
                      aria-hidden="true"
                    ></span>
                    {{ stateLabel(row) }}
                  </span>
                  @if (isOut(row)) {
                    <button
                      type="button"
                      class="pv__row-btn"
                      [attr.aria-label]="restoreAria(row)"
                      (click)="restore(row)"
                    >
                      <span nz-icon nzType="undo" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="pv__row-btn"
                      [attr.aria-label]="removeAria(row)"
                      (click)="remove(row)"
                    >
                      <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                  }
                </li>
              }
            </ol>
            @if (windowed().length < visible().length) {
              <div class="pv__more">
                <button
                  nz-button
                  nzType="default"
                  nzSize="small"
                  type="button"
                  (click)="showMore()"
                >
                  {{ moreLabel() }}
                </button>
              </div>
            }
          }
        </div>
      }

      <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
    </div>
  `,
  styles: [
    `
      .pv {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .pv__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .pv__label {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      /* Monospace is doing ONE job — making the columns line up so the operator can see that
         the third one is the class. It is the only monospace on the screen.

         unicode-bidi: plaintext is not a nicety. The Arabic build sets dir=rtl on the root,
         and a box holding mixed Arabic and English lines then lays out as one reversed blob
         with no way to tell which column is which. plaintext gives every LINE its own
         direction, which is what a pasted spreadsheet actually is. */
      .pv__box {
        min-block-size: 12rem;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        unicode-bidi: plaintext;
        text-align: start;
      }
      .pv__help,
      .pv__read {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
      }

      .pv__sep {
        display: inline-flex;
        gap: var(--space-0-5);
        padding: var(--space-0-5);
        border-radius: var(--radius-pill);
        background: var(--color-surface-page);
        inline-size: fit-content;
      }
      .pv__sep-btn {
        padding: var(--space-1) var(--space-3);
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-xs);
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pv__sep-btn.is-on {
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        box-shadow: var(--shadow-sm);
      }
      .pv__sep-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .pv__note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-info) 30%, transparent);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .pv__note [nz-icon] {
        flex: none;
        color: var(--color-info);
      }

      /* One pick fixes every line carrying that spelling. Unknown tokens are few and rows are
         many, so this is where the leverage is — it sits ABOVE the table for that reason. */
      .pv__fixer {
        padding: var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
      }
      .pv__fixer-title {
        margin: 0 0 var(--space-2);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
      }
      .pv__fixer-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pv__fixer-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .pv__token {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .pv__token-lines {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }
      .pv__token-pick {
        min-inline-size: 12rem;
        margin-inline-start: auto;
      }

      /* Capped and scrolled rather than paged: the operator is scanning for the rows the
         summary already counted, and a page control would make them hunt across pages for
         three rows the strip told them exist. */
      .pv__table {
        max-block-size: 26rem;
        overflow-y: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
      }
      .pv__rows {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pv__head,
      .pv__row {
        display: grid;
        grid-template-columns:
          3ch minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 9rem)
          auto;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
        border-block-end: 1px solid var(--color-border-default);
      }
      /* A list with no class axis has no class column — reserving one would leave a dead gap
         the eye reads as a column that failed to load. */
      .pv__head.is-flat,
      .pv__row.is-flat {
        grid-template-columns: 3ch minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 9rem) auto;
      }
      /* Sticky because the table scrolls inside its own box: a header that scrolls away on a
         four-hundred-row list is only there for the first ten. */
      .pv__head {
        position: sticky;
        inset-block-start: 0;
        z-index: 1;
        background: var(--color-surface-page);
        color: var(--color-text-secondary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .pv__row:last-child {
        border-block-end: 0;
      }
      /* The tint is REINFORCEMENT. The state column carries the word, and the word is what an
         operator can search for and a screen reader can read. */
      .pv__row.is-bad {
        background: var(--color-error-bg);
      }
      .pv__row.is-out {
        background: var(--color-surface-muted);
      }
      .pv__row.is-out .pv__cell,
      .pv__row.is-out .pv__state {
        text-decoration: line-through;
      }
      /* Secondary, not tertiary. The line number is the whole mechanism for matching a
         reported problem back to the text in the box — it is read, not decoration, and
         tertiary sits under 4.5:1 at this size. */
      .pv__line {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      .pv__cell {
        min-inline-size: 0;
        padding: var(--space-1) var(--space-2);
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .pv__cell:hover {
        border-color: var(--color-border-default);
      }
      .pv__cell:focus-visible {
        border-color: var(--color-border-focus);
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* A name the parser supplied rather than the operator. Tertiary ink says "not typed"
         without hiding it — the count in the strip is what makes it a decision. */
      .pv__cell.is-derived {
        color: var(--color-text-secondary);
        font-style: italic;
      }
      .pv__state {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
      }
      /* Redundant with the word beside it, deliberately: the word is what is searchable and
         readable, the dot is what the eye lands on scanning two hundred rows. Neither carries
         the state on its own. */
      .pv__dot {
        flex: none;
        inline-size: 0.5rem;
        block-size: 0.5rem;
        border-radius: 50%;
        background: var(--color-text-tertiary);
      }
      .pv__dot.is-error {
        background: var(--color-error-dot);
      }
      .pv__dot.is-warning {
        background: var(--color-warning-dot);
      }
      .pv__dot.is-success {
        background: var(--color-success-dot);
      }
      /* Drawn small to keep the row dense; the HIT AREA is widened by the pseudo-element. A
         28px target is under every guideline and this is pressed repeatedly. */
      .pv__row-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-tertiary);
        cursor: pointer;
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pv__row-btn::after {
        content: '';
        position: absolute;
        inset: calc(var(--space-2) * -1);
      }
      .pv__row-btn:hover {
        color: var(--color-text-primary);
      }
      .pv__row-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .pv__empty,
      .pv__more {
        padding: var(--space-4);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        text-align: center;
      }

      @media (prefers-reduced-motion: reduce) {
        .pv__sep-btn,
        .pv__cell,
        .pv__row-btn {
          transition: none;
        }
      }
    `,
  ],
})
export class PasteValuesFormComponent {
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** The classes a row may name. Empty = the list has no class axis, so two columns. */
  readonly classes = input.required<readonly PasteClass[]>();
  /** Where a row with no class named goes. `null` = there is no catch-all. */
  readonly fallbackKey = input<string | null>(null);
  /** Keys the list already holds, so a re-paste reports rather than duplicating. */
  readonly existingSlugs = input<ReadonlySet<string>>(new Set<string>());
  /** Per-row problems the SERVER reported, by 1-based line. Painted onto the preview. */
  readonly serverProblems = input<ReadonlyMap<number, string>>(new Map<number, string>());

  /** The rows a save would send, and whether there is anything blocking it. */
  readonly draft = output<PasteValuesDraft>();

  protected readonly text = signal('');
  protected readonly separator = signal<PasteSeparator>('auto');
  protected readonly filter = signal<PreviewFilter>('all');
  protected readonly announcement = signal('');
  protected readonly shown = signal(WINDOW);

  protected readonly separators: readonly PasteSeparator[] = ['auto', 'tab', 'comma'];
  protected readonly sepAria = $localize`:@@pv.sep.label:How the columns are split`;
  protected readonly filterAria = $localize`:@@pv.filter.aria:Which lines to show`;
  protected readonly pickClassLabel = $localize`:@@pv.fix.pick:Pick the class`;

  /**
   * Inline edits, keyed by 1-BASED line, each remembering the source line it was made against.
   *
   * Dropped only when that line's raw text changes — see the class doc. Fifteen lines of rule,
   * and it is what lets someone type at the bottom of the box without losing a fix at the top.
   */
  private readonly overlay = signal<ReadonlyMap<number, { raw: string; patch: Partial<PasteRow> }>>(
    new Map(),
  );
  private readonly removed = signal<ReadonlySet<number>>(new Set<number>());

  protected readonly parsed = computed<PasteParseResult>(() => {
    const base = parsePastedValues({
      text: this.text(),
      separator: this.separator(),
      classes: this.classes(),
      fallbackKey: this.fallbackKey(),
      existingSlugs: this.existingSlugs(),
      removedLines: this.removed(),
    });
    const overlay = this.overlay();
    if (overlay.size === 0) return base;
    const rows = base.rows.map((row) => {
      const held = overlay.get(row.line);
      return held && held.raw === row.raw ? { ...row, ...held.patch } : row;
    });
    // Re-derived rather than patched: an edit can move a row between states (naming the class
    // clears the error, renaming into an existing key creates a duplicate), and a preview that
    // showed the old state next to the new text would be lying about what Save will do.
    return recount(rows, base);
  });

  protected readonly visible = computed<readonly PasteRow[]>(() => {
    const rows = this.parsed().rows;
    switch (this.filter()) {
      case 'problems':
        return rows.filter((r) => this.isBad(r));
      case 'fallback':
        return rows.filter((r) => r.states.includes('fallback'));
      case 'dupes':
        return rows.filter((r) => r.states.includes('duplicate') || r.states.includes('existing'));
      default:
        return rows;
    }
  });

  protected readonly windowed = computed(() => this.visible().slice(0, this.shown()));

  constructor() {
    // Whenever the parse moves, hand the host the draft. The host owns the transaction and
    // the Save button; this component never writes.
    effect(() => {
      const rows = this.parsed().importable.map((r) => ({
        line: r.line,
        labelEn: r.labelEn,
        labelAr: r.labelAr,
        ...(r.classKey !== null ? { parentKey: r.classKey } : {}),
      }));
      this.draft.emit({ rows, blocked: this.parsed().counts.error });
    });

    // Land on the rows that need work. At four hundred rows nobody scrolls to find line 217,
    // and the whole design of the summary strip is that a non-zero number is a destination.
    effect(() => {
      const bad = this.parsed().counts.error;
      if (bad > 0 && this.filter() === 'all') this.filter.set('problems');
    });

    // A new window on every filter change and on every re-parse: showing rows 1..100 of the
    // previous filter's set would be a silent lie about what is on screen.
    effect(() => {
      this.filter();
      this.text();
      this.shown.set(WINDOW);
    });
  }

  // --- labels -----------------------------------------------------------------

  protected classLabel(c: PasteClass): string {
    return this.isAr ? c.labelAr : c.labelEn;
  }

  protected separatorLabel(option: PasteSeparator): string {
    if (option === 'tab') return $localize`:@@pv.sep.tab:By tab`;
    if (option === 'comma') return $localize`:@@pv.sep.comma:By comma`;
    return $localize`:@@pv.sep.auto:Work it out`;
  }

  protected readAs(): string {
    return this.parsed().separator === 'tab'
      ? $localize`:@@pv.sep.read_tab:Read as tab-separated, so commas inside a name are safe.`
      : $localize`:@@pv.sep.read_comma:Read as comma-separated. A name may contain commas — the class is the last column and the Arabic name the one before it.`;
  }

  protected boxHint(): string {
    return this.classes().length > 0
      ? $localize`:@@pv.box.hint3:One line per value: English name, Arabic name, class. Copy straight from a spreadsheet and the columns line up on their own.`
      : $localize`:@@pv.box.hint2:One line per value: English name, then Arabic name.`;
  }

  protected boxPlaceholder(): string {
    const first = this.classes()[0];
    if (!first) return 'Cairo\tالقاهرة';
    return `Mivida\tميفيدا\t${this.classLabel(first)}`;
  }

  protected tokenLinesLabel(count: number): string {
    return $localize`:@@pv.fix.token_lines:on ${count}:COUNT: line(s)`;
  }

  protected moreLabel(): string {
    const left = this.visible().length - this.windowed().length;
    return $localize`:@@pv.window.more:Show the next ${Math.min(WINDOW, left)}:COUNT: (${left}:REMAINING: left)`;
  }

  protected emptyLabel(): string {
    return $localize`:@@pv.filter.empty:No lines here.`;
  }

  protected readonly stats = computed<StatStripItem[]>(() => {
    const c = this.parsed().counts;
    const items: StatStripItem[] = [
      {
        label: $localize`:@@pv.count.ready:Ready`,
        value: this.parsed().importable.length,
        tone: 'success',
      },
    ];
    if (c.error > 0) {
      items.push({ label: $localize`:@@pv.count.error:To fix`, value: c.error, tone: 'error' });
    }
    if (c.fallback > 0) {
      items.push({
        label: $localize`:@@pv.count.fallback:Going to the catch-all`,
        value: c.fallback,
        tone: 'warning',
      });
    }
    if (c.noArabic > 0) {
      items.push({
        label: $localize`:@@pv.count.noArabic:No Arabic name`,
        value: c.noArabic,
        tone: 'warning',
      });
    }
    if (c.duplicate > 0) {
      items.push({
        label: $localize`:@@pv.count.duplicate:Repeated`,
        value: c.duplicate,
        tone: 'muted',
      });
    }
    if (c.existing > 0) {
      items.push({
        label: $localize`:@@pv.count.existing:Already in the list`,
        value: c.existing,
        tone: 'muted',
      });
    }
    return items;
  });

  protected readonly filterTabs = computed<RailTabItem[]>(() => {
    const c = this.parsed().counts;
    const tabs: RailTabItem[] = [
      { id: 'all', label: $localize`:@@pv.filter.all:All`, count: this.parsed().rows.length },
    ];
    if (c.error > 0) {
      tabs.push({ id: 'problems', label: $localize`:@@pv.filter.problems:To fix`, count: c.error });
    }
    if (c.fallback > 0) {
      tabs.push({
        id: 'fallback',
        label: $localize`:@@pv.filter.fallback:Going to the catch-all`,
        count: c.fallback,
      });
    }
    if (c.duplicate + c.existing > 0) {
      tabs.push({
        id: 'dupes',
        label: $localize`:@@pv.filter.dupes:Repeated`,
        count: c.duplicate + c.existing,
      });
    }
    return tabs;
  });

  /**
   * The row's state IN WORDS. Never colour alone, and never more than one sentence: this
   * column is scanned down, not read across.
   */
  protected stateLabel(row: PasteRow): string {
    const server = this.serverProblems().get(row.line);
    if (server !== undefined) return server;
    if (row.states.includes('skipped')) return $localize`:@@pv.state.skipped:Left out`;
    if (row.classToken.trim() !== '' && row.classKey === null) {
      return $localize`:@@pv.state.unknown_class:No class is called that`;
    }
    if (row.labelEn.trim() === '') return $localize`:@@pv.state.no_name:No name`;
    if (row.states.includes('error')) return $localize`:@@pv.state.error:Cannot be added`;
    if (row.states.includes('duplicate')) {
      return $localize`:@@pv.state.duplicate:Repeats line ${row.duplicateOf ?? 0}:LINE:`;
    }
    if (row.states.includes('existing')) {
      return $localize`:@@pv.state.existing:Already in the list`;
    }
    const notes: string[] = [];
    if (row.states.includes('fallback'))
      notes.push($localize`:@@pv.state.fallback:To the catch-all`);
    if (row.states.includes('noArabic')) {
      notes.push($localize`:@@pv.state.no_arabic:English name will be used`);
    }
    return notes.length > 0 ? notes.join(' · ') : $localize`:@@pv.state.ready:Ready`;
  }

  /**
   * The tone the row's dot carries.
   *
   * The dot is REDUNDANT with the word beside it, on purpose: a word is what an operator can
   * search and a screen reader can read, and a dot is what the eye finds when scanning two
   * hundred rows for the three that need work. Neither carries the state alone.
   */
  protected stateTone(row: PasteRow): 'error' | 'warning' | 'muted' | 'success' {
    if (this.isBad(row)) return 'error';
    if (this.isOut(row) || row.states.includes('duplicate') || row.states.includes('existing')) {
      return 'muted';
    }
    if (row.states.includes('fallback') || row.states.includes('noArabic')) return 'warning';
    return 'success';
  }

  protected cellAria(row: PasteRow, which: 'en' | 'ar' | 'class'): string {
    if (which === 'en') return $localize`:@@pv.col.en_aria:English name, line ${row.line}:LINE:`;
    if (which === 'ar') return $localize`:@@pv.col.ar_aria:Arabic name, line ${row.line}:LINE:`;
    return $localize`:@@pv.col.class_aria:Class, line ${row.line}:LINE:`;
  }

  protected removeAria(row: PasteRow): string {
    return $localize`:@@pv.row.remove:Leave line ${row.line}:LINE: out`;
  }

  protected restoreAria(row: PasteRow): string {
    return $localize`:@@pv.row.restore:Put line ${row.line}:LINE: back`;
  }

  // --- state ------------------------------------------------------------------

  protected isBad(row: PasteRow): boolean {
    return row.states.includes('error') || this.serverProblems().has(row.line);
  }

  protected isOut(row: PasteRow): boolean {
    return row.states.includes('skipped');
  }

  protected hasState(row: PasteRow, state: PasteRow['states'][number]): boolean {
    return row.states.includes(state);
  }

  protected setFilter(id: string): void {
    this.filter.set(id as PreviewFilter);
  }

  protected showMore(): void {
    this.shown.update((n) => n + WINDOW);
  }

  // --- fixes ------------------------------------------------------------------

  protected edit(row: PasteRow, field: 'labelEn' | 'labelAr' | 'classKey', value: string): void {
    const next = new Map(this.overlay());
    const held = next.get(row.line);
    const patch = held && held.raw === row.raw ? { ...held.patch } : {};
    if (field === 'classKey') {
      Object.assign(patch, { classKey: value, classToken: value });
    } else {
      Object.assign(patch, { [field]: value });
    }
    next.set(row.line, { raw: row.raw, patch });
    this.overlay.set(next);
  }

  /** One pick, every line with that spelling. The leverage on this screen. */
  protected fixToken(token: string, classKey: string | null): void {
    if (classKey === null) return;
    const next = new Map(this.overlay());
    let fixed = 0;
    for (const row of this.parsed().rows) {
      if (row.classToken !== token) continue;
      const held = next.get(row.line);
      const patch = held && held.raw === row.raw ? { ...held.patch } : {};
      Object.assign(patch, { classKey, classToken: classKey });
      next.set(row.line, { raw: row.raw, patch });
      fixed += 1;
    }
    this.overlay.set(next);
    this.announcement.set(
      $localize`:@@pv.fix.done:${fixed}:COUNT: line(s) moved to the class you picked.`,
    );
  }

  protected remove(row: PasteRow): void {
    this.removed.update((set) => new Set([...set, row.line]));
  }

  protected restore(row: PasteRow): void {
    this.removed.update((set) => {
      const next = new Set(set);
      next.delete(row.line);
      return next;
    });
  }
}

/**
 * Recount a row set after the overlay has been applied.
 *
 * An inline edit genuinely moves a row between states — naming the class clears the error,
 * renaming into a key the list already holds creates a duplicate — so counting once before
 * the overlay and rendering after it would put the old word beside the new text.
 *
 * Only the states an EDIT can change are re-derived. Everything structural (which columns the
 * line had, whether it was a header) belongs to the parse and is left alone.
 */
function recount(rows: readonly PasteRow[], base: PasteParseResult): PasteParseResult {
  const counts: Record<PasteRow['states'][number], number> = {
    ready: 0,
    fallback: 0,
    noArabic: 0,
    duplicate: 0,
    existing: 0,
    error: 0,
    skipped: 0,
  };
  const unknown = new Map<string, number[]>();
  const out = rows.map((row) => {
    const states: PasteRowState[] = row.states.filter((s) => s !== 'error' && s !== 'ready');
    if (row.classToken.trim() !== '' && row.classKey === null) {
      states.push('error');
      const at = unknown.get(row.classToken) ?? [];
      at.push(row.line);
      unknown.set(row.classToken, at);
    }
    if (row.labelEn.trim() === '' || row.labelEn.length > 160 || row.labelAr.length > 160) {
      if (!states.includes('error')) states.push('error');
    }
    if (states.length === 0) states.push('ready');
    for (const s of states) counts[s] += 1;
    return { ...row, states };
  });
  const blocked: readonly PasteRow['states'][number][] = [
    'error',
    'duplicate',
    'existing',
    'skipped',
  ];
  return {
    ...base,
    rows: out,
    counts,
    importable: out.filter((r) => !r.states.some((s) => blocked.includes(s))),
    unknownTokens: [...unknown.entries()].map(([token, lines]) => ({ token, lines })),
  };
}
