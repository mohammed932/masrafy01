import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { DeleteOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { PercentFieldComponent } from './percent-field.component';
import type { NumericScoreBand } from '../../features/questionnaire/questionnaire.api.service';

/** Mirrors what the backend's `assertNumericBands` can reject, minus what this control makes impossible. */
export type ScoreBandsError = 'NO_BANDS' | 'EDGE_MISSING' | 'NOT_ASCENDING' | null;

/**
 * Client-side mirror of the backend band rules, as a pure function so a host can
 * gate its own save on the same verdict shown inline — including while the editor
 * is off-screen on another wizard step. The server re-checks on save; this only
 * saves the round trip.
 *
 * Gaps and overlaps are impossible by construction (see the component doc), so
 * only ascending order and a missing edge are left to check.
 */
export function scoreBandsErrorFor(rows: readonly NumericScoreBand[]): ScoreBandsError {
  if (rows.length === 0) return 'NO_BANDS';
  let previous: number | null = null;
  for (const [index, row] of rows.entries()) {
    if (index === 0) continue; // opens at -∞ by definition
    const raw = row.from;
    if (raw === null || raw.trim() === '') return 'EDGE_MISSING';
    const edge = Number(raw);
    if (!Number.isFinite(edge)) return 'EDGE_MISSING';
    if (previous !== null && edge <= previous) return 'NOT_ASCENDING';
    previous = edge;
  }
  return null;
}

/**
 * Score bands for a NUMERIC question (Constitution V, v14.0.0).
 *
 * A number has no options to score, so a program scores it by RANGE: "0–4,999
 * earns 20, 5,000–14,999 earns 60, 15,000 and up earns 100". Bands are what a
 * credit scorecard actually does, and unlike a worst→best straight line they can
 * express a range that peaks in the middle (an ideal tenor, a healthy DBR).
 *
 * Every row shows BOTH ends as a real box — `from → to` — but the two are LINKED:
 * a band's end IS the next band's start, so typing either box moves the other.
 * Gaps and overlaps stay unrepresentable rather than merely validated, which
 * matters because an uncovered value earns nothing while still costing the
 * question's full weight, penalising an applicant for a hole in the configuration.
 * The first row opens at −∞ and the last closes at +∞ (the backend rejects any
 * other shape), so those two ends read as "No minimum" / "No maximum".
 *
 * Until this revision the upper edge was a read-only mirror. It was correct and
 * unguessable: admins hunted for the field that produced the number and could not
 * find one, because it belonged to the row below.
 */
@Component({
  selector: 'app-score-bands-editor',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSliderModule,
    MoneyInputDirective,
    PercentFieldComponent,
  ],
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sb">
      @if (bands().length === 0) {
        <div class="sb__empty">
          <p class="sb__emptyText" i18n="@@scoreBands.empty">
            This number earns nothing yet. Band it so a higher — or lower — answer scores better.
          </p>
          <button nz-button nzType="primary" type="button" (click)="seed()">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@scoreBands.seed">Start with three bands</span>
          </button>
        </div>
      } @else {
        <!-- Column names, not per-row labels: the row is a sentence and repeating
             "from"/"to" on every line would drown the numbers. aria-hidden because
             each box already carries its own label. -->
        <div class="sb__head" aria-hidden="true">
          <span class="sb__headRange">
            <span i18n="@@scoreBands.colFrom">From</span>
            <span class="sb__arrow">→</span>
            <span i18n="@@scoreBands.colTo">To</span>
          </span>
          <span i18n="@@scoreBands.colScore">Score</span>
        </div>

        <ol class="sb__list">
          @for (band of bands(); track $index) {
            <li class="sb__row">
              <!-- The range reads as one sentence, so the boundary an admin is
                   typing is the boundary they see the effect of. Both boxes are
                   live: the upper one writes the NEXT row's lower edge (see
                   setUpperEdge) — the same edit from the other side, not a second
                   value. -->
              <span class="sb__range">
                @if ($index === 0) {
                  <span class="sb__open" i18n="@@scoreBands.noMinimum">No minimum</span>
                } @else {
                  <input
                    nz-input
                    appMoneyInput
                    type="text"
                    class="sb__edge"
                    [attr.aria-label]="fromAriaLabel"
                    [ngModel]="band.from"
                    (ngModelChange)="setEdge($index, $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                }
                <span class="sb__arrow" aria-hidden="true">→</span>
                @if ($index < bands().length - 1) {
                  <input
                    nz-input
                    appMoneyInput
                    type="text"
                    class="sb__edge"
                    [attr.aria-label]="toAriaLabel"
                    [ngModel]="band.to"
                    (ngModelChange)="setUpperEdge($index, $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                } @else {
                  <span class="sb__open" i18n="@@scoreBands.noMaximum">No maximum</span>
                }
                @if (unit()) {
                  <span class="sb__unit">{{ unit() }}</span>
                }
              </span>

              <nz-slider
                class="sb__slider"
                [ngModel]="band.score"
                (ngModelChange)="setScore($index, $event)"
                [ngModelOptions]="{ standalone: true }"
                [nzMin]="0"
                [nzMax]="100"
                [nzStep]="1"
                [attr.aria-label]="scoreSliderAriaLabel"
              />
              <app-percent-field
                [value]="band.score"
                (valueChange)="setScore($index, $event)"
                [accent]="$index === bestIndex()"
                [ariaLabel]="scoreFieldAriaLabel"
              />

              @if (bands().length > 2 && $index > 0) {
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  class="sb__remove"
                  [attr.aria-label]="removeAriaLabel"
                  (click)="removeAt($index)"
                >
                  <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                </button>
              } @else {
                <span class="sb__removeSpacer" aria-hidden="true"></span>
              }
            </li>
          }
        </ol>

        <!-- Says out loud what the linkage does, so a box changing on its own on
             the row below reads as the design and not as a bug. -->
        <p class="sb__hint" i18n="@@scoreBands.linkHint">
          A band's end is the next band's start — edit either box and the other follows.
        </p>

        <div class="sb__actions">
          <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addBand()">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@scoreBands.add">Add a band</span>
          </button>
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="clear()"
            i18n="@@scoreBands.clear"
          >
            Remove all bands
          </button>
        </div>

        @if (error(); as err) {
          <p class="sb__error" role="alert">
            @switch (err) {
              @case ('EDGE_MISSING') {
                <span i18n="@@scoreBands.error.edgeMissing"
                  >Every band needs a starting value.</span
                >
              }
              @case ('NOT_ASCENDING') {
                <span i18n="@@scoreBands.error.notAscending"
                  >Each band must start higher than the one before it.</span
                >
              }
              @case ('NO_BANDS') {
                <span i18n="@@scoreBands.error.noBands"
                  >Add at least one band, or this question earns nothing.</span
                >
              }
            }
          </p>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .sb__empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-4);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }

      .sb__emptyText {
        margin: 0;
        max-inline-size: 46ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .sb__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      /* Ranges left, score right — the same rhythm the option rows above use, so a
         mixed-type program reads as one screen instead of two controls. The range
         column carries two boxes now, so it is wider than the single-edge version. */
      .sb__row,
      .sb__head {
        display: grid;
        grid-template-columns: minmax(0, 24rem) minmax(0, 1fr) auto auto;
        align-items: center;
        gap: var(--space-3);
      }

      .sb__head {
        margin-block-end: var(--space-2);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-tertiary);
      }

      /* Mirrors .sb__range's own layout so "From"/"To" sit over their boxes. */
      .sb__headRange {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      .sb__headRange > span:first-child,
      .sb__headRange > span:last-child {
        inline-size: 7.5rem;
      }

      .sb__hint {
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .sb__range {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .sb__edge {
        inline-size: 7.5rem;
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      /* The two open ends. Sized like an edge box so the arrow column stays on one
         vertical line down the table instead of stepping in and out. */
      .sb__open {
        inline-size: 7.5rem;
        text-align: center;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }

      .sb__arrow {
        color: var(--color-text-tertiary);
      }

      .sb__unit {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .sb__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }

      .sb__remove {
        min-block-size: 2.75rem;
        min-inline-size: 2.75rem;
      }

      .sb__removeSpacer {
        inline-size: 2.75rem;
      }

      .sb__error {
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }

      /* Brand skin, matching the answer-score sliders this editor sits beside —
         ant's own palette blue is not the product's blue. */
      .sb__slider {
        margin: 0;
      }
      .sb__slider ::ng-deep .ant-slider {
        margin-block: 0;
        margin-inline: var(--space-2);
      }
      .sb__slider ::ng-deep .ant-slider-rail {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
      }
      .sb__slider ::ng-deep .ant-slider-track {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--primary);
      }
      .sb__slider ::ng-deep .ant-slider:hover .ant-slider-track {
        background: var(--primary-hover);
      }
      .sb__slider ::ng-deep .ant-slider-handle {
        inline-size: 18px;
        block-size: 18px;
        margin-block-start: -6px;
        border: 2px solid var(--primary);
        background: var(--bg-surface);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .sb__slider ::ng-deep .ant-slider-handle:hover,
      .sb__slider ::ng-deep .ant-slider-handle:focus {
        transform: scale(1.14);
        box-shadow: var(--focus-halo);
      }

      @media (prefers-reduced-motion: reduce) {
        .sb__slider ::ng-deep .ant-slider-handle {
          transition: none;
        }
      }

      @media (max-width: 767px) {
        .sb__row {
          grid-template-columns: minmax(0, 1fr) auto auto;
        }

        .sb__range {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class ScoreBandsEditorComponent {
  /** Two-way bound band table. `[]` means the question is weighted but earns nothing. */
  readonly bands = model.required<NumericScoreBand[]>();

  /** Display unit of the underlying question ("EGP", "months") — label only. */
  readonly unit = input<string | null>(null);

  /** The question's own published bounds, used to seed sensible first edges. */
  readonly minValue = input<string | null>(null);
  readonly maxValue = input<string | null>(null);

  readonly fromAriaLabel = $localize`:@@scoreBands.aria.from:Band starts at`;
  readonly toAriaLabel = $localize`:@@scoreBands.aria.to:Band ends at — also the next band's start`;
  readonly scoreSliderAriaLabel = $localize`:@@scoreBands.aria.scoreSlider:Band score — slider`;
  readonly scoreFieldAriaLabel = $localize`:@@scoreBands.aria.scoreField:Band score — type or use arrow keys`;
  readonly removeAriaLabel = $localize`:@@scoreBands.aria.remove:Remove this band`;

  readonly error = computed<ScoreBandsError>(() => scoreBandsErrorFor(this.bands()));

  /** Highest-scoring band — accented so the program's ideal range is visible at a glance. */
  readonly bestIndex = computed<number>(() => {
    let best = -1;
    let top = -Infinity;
    for (const [index, band] of this.bands().entries()) {
      if (band.score > top) {
        top = band.score;
        best = index;
      }
    }
    return best;
  });

  /**
   * Three bands split at the thirds of the question's own range, ascending. A
   * blank table is the one state that cannot score, so the empty view offers this
   * instead of an empty row for the admin to decode.
   */
  seed(): void {
    this.bands.set(seedScoreBands(this.minValue(), this.maxValue()));
  }

  clear(): void {
    this.bands.set([]);
  }

  /** Splits the LAST band in two, so the open-ended row always stays last. */
  addBand(): void {
    const rows = [...this.bands()];
    const last = rows[rows.length - 1];
    if (!last) {
      this.seed();
      return;
    }
    const previousEdge = Number(last.from ?? 0);
    const nextEdge = Number.isFinite(previousEdge) ? previousEdge * 2 || 1000 : 1000;
    const edge = String(Math.round(nextEdge));
    rows.splice(
      rows.length - 1,
      1,
      { ...last, to: edge },
      { from: edge, to: null, score: last.score },
    );
    this.bands.set(rows);
  }

  /**
   * Removing a band hands its range to the band before it — the neighbour's upper
   * edge moves up, which is what keeps the table gapless.
   */
  removeAt(index: number): void {
    const rows = this.bands().filter((_, i) => i !== index);
    this.bands.set(relink(rows));
  }

  setEdge(index: number, value: string): void {
    const rows = this.bands().map((row, i) => (i === index ? { ...row, from: value } : row));
    this.bands.set(relink(rows));
  }

  /**
   * Typing a band's UPPER edge is the same edit as typing the next band's lower
   * edge, so it routes through `setEdge` rather than writing `to` directly —
   * `relink` then mirrors the value straight back into this row. Writing `to`
   * here would give the boundary two owners, which is exactly how a gap appears.
   * Never called on the last row: that one closes at +∞ and renders no box.
   */
  setUpperEdge(index: number, value: string): void {
    this.setEdge(index + 1, value);
  }

  setScore(index: number, value: number | null): void {
    const score = Math.min(100, Math.max(0, Number(value ?? 0)));
    this.bands.set(this.bands().map((row, i) => (i === index ? { ...row, score } : row)));
  }
}

/**
 * Re-derive every `to` from the next row's `from`, and pin the two open ends.
 * The upper edges are not independent data — treating them as such is how a table
 * ends up with a gap nobody typed.
 */
function relink(rows: readonly NumericScoreBand[]): NumericScoreBand[] {
  return rows.map((row, i) => ({
    from: i === 0 ? null : row.from,
    to: i === rows.length - 1 ? null : (rows[i + 1]?.from ?? null),
    score: row.score,
  }));
}

/** Three ascending bands split at the thirds of `[min, max]`, or one flat band without bounds. */
export function seedScoreBands(
  minValue: string | null,
  maxValue: string | null,
): NumericScoreBand[] {
  const min = minValue != null ? Number(minValue) : NaN;
  const max = maxValue != null ? Number(maxValue) : NaN;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [{ from: null, to: null, score: 50 }];
  }
  const third = (max - min) / 3;
  const lower = String(Math.round(min + third));
  const upper = String(Math.round(min + third * 2));
  return [
    { from: null, to: lower, score: 25 },
    { from: lower, to: upper, score: 60 },
    { from: upper, to: null, score: 100 },
  ];
}
