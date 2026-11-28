import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { CloseOutline, DeleteOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { SearchSelectComponent, type SearchSelectOption } from '@shared/ui/search-select.component';
import {
  CAR_FIGURES,
  carPricingIssues,
  type CarBand,
  type CarException,
  type CarExceptionKind,
  type CarFigure,
  type CarPricing,
} from './car-pricing.rules';

const LABEL: Record<CarFigure, string> = {
  rate: $localize`:@@carPricing.fig.rate:Rate`,
  maxYears: $localize`:@@carPricing.fig.maxYears:Longest term`,
  insurance: $localize`:@@carPricing.fig.insurance:Insurance`,
  interestFreeYears: $localize`:@@carPricing.fig.interestFree:Interest-free`,
  oldestCar: $localize`:@@carPricing.fig.oldestCar:Oldest car`,
};

const UNIT: Record<CarFigure, string> = {
  rate: '%',
  maxYears: $localize`:@@carPricing.unit.years:years`,
  insurance: $localize`:@@carPricing.unit.perYear:% a year`,
  interestFreeYears: $localize`:@@carPricing.unit.years:years`,
  oldestCar: $localize`:@@carPricing.unit.yearsOld:years old`,
};

const ADD_LABEL: Record<CarFigure, string> = {
  rate: '',
  maxYears: $localize`:@@carPricing.add.maxYears:Longest term`,
  insurance: $localize`:@@carPricing.add.insurance:Insurance`,
  interestFreeYears: $localize`:@@carPricing.add.interestFree:Interest-free years`,
  oldestCar: $localize`:@@carPricing.add.oldestCar:Oldest car`,
};

/**
 * The car pricing card (v37.0.0): rows by down payment and the exceptions on them.
 *
 * Controlled — the host owns the `CarPricing`; every edit emits a new one. The rate column is
 * always there; the other four figures are columns the operator adds with one click and removes
 * with the × on their heading. An exception is one sentence ("Brand BMW · all bands → Rate 9%")
 * that opens into a small editor in place. Problems show under the line they are about.
 */
@Component({
  selector: 'app-car-pricing-card',
  standalone: true,
  imports: [NzButtonModule, NzIconModule, NzInputModule, SearchSelectComponent],
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline, CloseOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cp">
      <div class="cp__scroll">
        <table class="cp__table">
          <thead>
            <tr>
              <th scope="col" i18n="@@carPricing.col.downPayment">Down payment</th>
              @for (f of columns(); track f) {
                <th scope="col">
                  <span class="cp__th">
                    {{ label[f] }}
                    @if (f !== 'rate') {
                      <button
                        type="button"
                        class="cp__thRemove"
                        [attr.aria-label]="removeColumnLabel + ' ' + label[f]"
                        (click)="removeColumn(f)"
                      >
                        <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
                      </button>
                    }
                  </span>
                </th>
              }
              <th scope="col"><span class="cp__sr" i18n="@@carPricing.col.remove">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            @for (band of pricing().bands; track $index; let i = $index; let last = $last) {
              <tr [class.cp__row--bad]="bandIssue(i)">
                <td>
                  <span class="cp__band">
                    <input
                      nz-input
                      class="cp__num cp__num--edge"
                      inputmode="decimal"
                      [attr.aria-label]="fromLabel"
                      [value]="band.from"
                      (input)="setBand(i, 'from', $any($event.target).value)"
                    />
                    <span class="cp__to" i18n="@@carPricing.to">to</span>
                    <input
                      nz-input
                      class="cp__num cp__num--edge"
                      inputmode="decimal"
                      [attr.aria-label]="toLabel"
                      [placeholder]="last ? andAbove : ''"
                      [value]="band.to ?? ''"
                      (input)="setBand(i, 'to', $any($event.target).value)"
                    />
                    <span class="cp__unit">%</span>
                  </span>
                </td>
                @for (f of columns(); track f) {
                  <td>
                    <span class="cp__cell">
                      <input
                        nz-input
                        class="cp__num"
                        inputmode="decimal"
                        [attr.aria-label]="label[f]"
                        [value]="pricing().rows[i]?.[f] ?? ''"
                        (input)="setRow(i, f, $any($event.target).value)"
                      />
                      <span class="cp__unit">{{ unit[f] }}</span>
                    </span>
                  </td>
                }
                <td class="cp__end">
                  @if (pricing().bands.length > 1) {
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      class="cp__icon"
                      [attr.aria-label]="removeBandLabel"
                      (click)="removeBand(i)"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                  }
                </td>
              </tr>
              @if (bandIssue(i); as msg) {
                <tr class="cp__issueRow">
                  <td [attr.colspan]="columns().length + 2">
                    <p class="cp__issue" role="alert">{{ msg }}</p>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="cp__actions">
        <button nz-button nzType="dashed" type="button" (click)="addBand()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@carPricing.addBand">Add a band</span>
        </button>
        @for (f of addable(); track f) {
          <button nz-button nzType="text" type="button" class="cp__chip" (click)="addColumn(f)">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ addLabel[f] }}</span>
          </button>
        }
      </div>

      <div class="cp__ex">
        <h4 class="cp__title" i18n="@@carPricing.ex.title">Exceptions</h4>
        <p class="cp__hint" i18n="@@carPricing.ex.hint">A brand beats electric, electric beats a category, and each beats the band's own row.</p>

        @if (pricing().exceptions.length > 0) {
          <ul class="cp__list">
            @for (ex of pricing().exceptions; track $index; let i = $index) {
              <li class="cp__item" [class.cp__item--open]="editing() === i">
                @if (editing() === i) {
                  <div class="cpx">
                    <div class="cpx__line">
                      <div class="cpx__kinds" role="group" [attr.aria-label]="kindLabel">
                        @for (k of kinds; track k.kind) {
                          <button
                            nz-button
                            type="button"
                            [nzType]="ex.kind === k.kind ? 'primary' : 'default'"
                            [attr.aria-pressed]="ex.kind === k.kind"
                            (click)="setKind(i, k.kind)"
                          >
                            {{ k.label }}
                          </button>
                        }
                      </div>
                      @if (ex.kind !== 'electric') {
                        <app-search-select
                          class="cpx__value"
                          [options]="ex.kind === 'brand' ? brands() : categories()"
                          [value]="ex.value ?? ''"
                          [placeholder]="ex.kind === 'brand' ? pickBrand : pickCategory"
                          [ariaLabel]="ex.kind === 'brand' ? pickBrand : pickCategory"
                          (changed)="setValue(i, $event)"
                        />
                      }
                    </div>

                    <div class="cpx__bands" role="group" [attr.aria-labelledby]="'cpx-on-' + i">
                      <span class="cpx__legend" [id]="'cpx-on-' + i" i18n="@@carPricing.ex.on">On</span>
                      <label class="cpx__check">
                        <input type="checkbox" [checked]="ex.bands === 'all'" (change)="setAll(i, $any($event.target).checked)" />
                        <span i18n="@@carPricing.ex.allBands">All bands</span>
                      </label>
                      @if (ex.bands !== 'all') {
                        @for (band of pricing().bands; track $index; let b = $index) {
                          <label class="cpx__check">
                            <input type="checkbox" [checked]="ex.bands.includes(b)" (change)="toggleBand(i, b, $any($event.target).checked)" />
                            <span>{{ bandText(band) }}</span>
                          </label>
                        }
                      }
                    </div>

                    <div class="cpx__figs">
                      @for (f of figures; track f) {
                        <label class="cpx__fig">
                          <span class="cpx__figLabel">{{ label[f] }}</span>
                          <span class="cp__cell">
                            <input
                              nz-input
                              class="cp__num"
                              inputmode="decimal"
                              [value]="ex.figures[f] ?? ''"
                              (input)="setFigure(i, f, $any($event.target).value)"
                            />
                            <span class="cp__unit">{{ unit[f] }}</span>
                          </span>
                        </label>
                      }
                    </div>
                    <p class="cp__hint" i18n="@@carPricing.ex.blank">Leave a figure empty to keep the band's.</p>

                    <div class="cpx__done">
                      <button nz-button nzType="primary" type="button" (click)="editing.set(null)" i18n="@@carPricing.ex.done">Done</button>
                    </div>
                  </div>
                } @else {
                  <span class="cp__sentence">{{ sentence(ex) }}</span>
                  <span class="cp__itemActions">
                    <button nz-button nzType="link" type="button" (click)="editing.set(i)" i18n="@@carPricing.ex.edit">Edit</button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      class="cp__icon"
                      [attr.aria-label]="removeExceptionLabel"
                      (click)="removeException(i)"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                  </span>
                }
                @if (exceptionIssue(i); as msg) {
                  <p class="cp__issue cp__issue--item" role="alert">{{ msg }}</p>
                }
              </li>
            }
          </ul>
        }

        <button nz-button nzType="dashed" type="button" class="cp__addEx" (click)="addException()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@carPricing.ex.add">Add an exception</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cp__scroll {
        overflow-x: auto;
      }
      .cp__table {
        inline-size: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      .cp__table th {
        padding: var(--space-2) var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        text-align: start;
        white-space: nowrap;
        border-block-end: 1px solid var(--color-border-strong);
      }
      .cp__table td {
        padding: var(--space-2);
        vertical-align: middle;
        border-block-end: 1px solid var(--color-border-default);
      }
      .cp__row--bad td {
        border-block-end-color: transparent;
      }
      .cp__th {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .cp__thRemove {
        display: inline-grid;
        place-items: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-tertiary);
        cursor: pointer;
      }
      .cp__thRemove:hover {
        color: var(--color-error);
        background: var(--color-surface-muted);
      }
      .cp__thRemove:focus-visible {
        outline: 2px solid var(--focus-ring-color);
        outline-offset: 1px;
      }
      .cp__band,
      .cp__cell {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
      }
      .cp__num {
        inline-size: 5.5rem;
        text-align: end;
        font-feature-settings: var(--font-feature-tabular);
      }
      .cp__num--edge {
        inline-size: 4.5rem;
      }
      .cp__to,
      .cp__unit {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .cp__end {
        inline-size: 1%;
        text-align: end;
      }
      .cp__icon {
        min-block-size: 2.75rem;
        min-inline-size: 2.75rem;
      }
      .cp__issueRow td {
        padding-block: 0 var(--space-2);
      }
      .cp__issue {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }
      .cp__issue--item {
        flex-basis: 100%;
      }
      .cp__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }
      .cp__chip {
        color: var(--color-text-link);
      }
      .cp__ex {
        margin-block-start: var(--space-6);
      }
      .cp__title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .cp__hint {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
        max-inline-size: 65ch;
      }
      .cp__list {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .cp__item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
      }
      .cp__item--open {
        padding: var(--space-4);
        border-color: var(--color-border-focus);
      }
      .cp__sentence {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        min-inline-size: 0;
      }
      .cp__itemActions {
        display: inline-flex;
        align-items: center;
      }
      .cp__addEx {
        margin-block-start: var(--space-3);
      }
      .cpx {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        inline-size: 100%;
      }
      .cpx__line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
      }
      .cpx__kinds {
        display: inline-flex;
        gap: var(--space-1);
      }
      .cpx__value {
        flex: 1 1 16rem;
        min-inline-size: 0;
      }
      .cpx__bands {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
      }
      .cpx__legend {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }
      .cpx__check {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: 2.75rem;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        cursor: pointer;
      }
      .cpx__check input {
        inline-size: 1rem;
        block-size: 1rem;
        accent-color: var(--color-brand-primary);
      }
      .cpx__figs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
        gap: var(--space-3);
      }
      .cpx__fig {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .cpx__figLabel {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .cpx__done {
        display: flex;
        justify-content: flex-end;
      }
      .cp__sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    `,
  ],
})
export class CarPricingCardComponent {
  readonly pricing = input.required<CarPricing>();
  readonly categories = input<readonly SearchSelectOption[]>([]);
  readonly brands = input<readonly SearchSelectOption[]>([]);
  readonly pricingChange = output<CarPricing>();

  protected readonly label = LABEL;
  protected readonly unit = UNIT;
  protected readonly addLabel = ADD_LABEL;
  protected readonly figures = CAR_FIGURES;
  protected readonly kinds: ReadonlyArray<{ kind: CarExceptionKind; label: string }> = [
    { kind: 'category', label: $localize`:@@carPricing.kind.category:Category` },
    { kind: 'brand', label: $localize`:@@carPricing.kind.brand:Brand` },
    { kind: 'electric', label: $localize`:@@carPricing.kind.electric:Electric` },
  ];

  protected readonly fromLabel = $localize`:@@carPricing.aria.from:Down payment from`;
  protected readonly toLabel = $localize`:@@carPricing.aria.to:Down payment up to`;
  protected readonly andAbove = $localize`:@@carPricing.andAbove:and above`;
  protected readonly removeBandLabel = $localize`:@@carPricing.aria.removeBand:Remove this band`;
  protected readonly removeColumnLabel = $localize`:@@carPricing.aria.removeColumn:Remove the column`;
  protected readonly removeExceptionLabel = $localize`:@@carPricing.aria.removeException:Remove this exception`;
  protected readonly kindLabel = $localize`:@@carPricing.aria.kind:What the exception is for`;
  protected readonly pickBrand = $localize`:@@carPricing.pickBrand:Pick a brand`;
  protected readonly pickCategory = $localize`:@@carPricing.pickCategory:Pick a category`;

  /** Columns the operator added that nothing fills yet. */
  private readonly added = signal<ReadonlySet<CarFigure>>(new Set());
  protected readonly editing = signal<number | null>(null);

  protected readonly columns = computed<CarFigure[]>(() => {
    const p = this.pricing();
    const added = this.added();
    return CAR_FIGURES.filter(
      (f) =>
        f === 'rate' ||
        added.has(f) ||
        p.rows.some((r) => (r[f] ?? '') !== '') ||
        p.exceptions.some((e) => (e.figures[f] ?? '') !== ''),
    );
  });
  protected readonly addable = computed(() => CAR_FIGURES.filter((f) => !this.columns().includes(f)));

  private readonly issues = computed(() => carPricingIssues(this.pricing()));

  protected bandIssue(i: number): string | null {
    return this.issues().find((x) => x.where === 'band' && x.index === i)?.message ?? null;
  }

  protected exceptionIssue(i: number): string | null {
    return this.issues().find((x) => x.where === 'exception' && x.index === i)?.message ?? null;
  }

  protected bandText(band: CarBand): string {
    return band.to === null || band.to === ''
      ? $localize`:@@carPricing.bandOpen:${band.from}:FROM:% and above`
      : `${band.from}–${band.to}%`;
  }

  protected sentence(ex: CarException): string {
    const p = this.pricing();
    const who =
      ex.kind === 'electric'
        ? this.kinds[2]!.label
        : `${ex.kind === 'brand' ? this.kinds[1]!.label : this.kinds[0]!.label} ${this.nameOf(ex)}`;
    const on =
      ex.bands === 'all'
        ? $localize`:@@carPricing.allBandsShort:all bands`
        : ex.bands
            .map((b) => p.bands[b])
            .filter((b): b is CarBand => b !== undefined)
            .map((b) => this.bandText(b))
            .join(', ');
    const what = CAR_FIGURES.filter((f) => (ex.figures[f] ?? '') !== '')
      .map((f) => `${LABEL[f]} ${ex.figures[f]}${f === 'rate' ? '%' : ' ' + UNIT[f]}`)
      .join(' · ');
    return `${who} · ${on} → ${what || '…'}`;
  }

  private nameOf(ex: CarException): string {
    const list = ex.kind === 'brand' ? this.brands() : this.categories();
    return list.find((o) => o.value === ex.value)?.label ?? ex.value ?? '…';
  }

  // ── Edits ──────────────────────────────────────────────────────────────────────────────────

  private emit(next: CarPricing): void {
    this.pricingChange.emit(next);
  }

  protected setBand(i: number, edge: 'from' | 'to', raw: string): void {
    const value = raw.trim();
    const bands = this.pricing().bands.map((b, j) =>
      j === i ? { ...b, [edge]: edge === 'to' && value === '' ? null : value } : b,
    );
    this.emit({ ...this.pricing(), bands });
  }

  protected setRow(i: number, f: CarFigure, raw: string): void {
    const p = this.pricing();
    const rows = p.bands.map((_, j) => {
      const row = { ...(p.rows[j] ?? {}) };
      if (j === i) {
        if (raw.trim() === '') delete row[f];
        else row[f] = raw.trim();
      }
      return row;
    });
    this.emit({ ...p, rows });
  }

  protected addBand(): void {
    const p = this.pricing();
    const last = p.bands[p.bands.length - 1];
    const from = last?.to ?? '';
    this.emit({ ...p, bands: [...p.bands, { from, to: null }], rows: [...p.rows, {}] });
  }

  /** Removing a band takes it out of every exception's list, and renumbers the rest. */
  protected removeBand(i: number): void {
    const p = this.pricing();
    const exceptions = p.exceptions.map((ex) =>
      ex.bands === 'all'
        ? ex
        : { ...ex, bands: ex.bands.filter((b) => b !== i).map((b) => (b > i ? b - 1 : b)) },
    );
    this.emit({
      bands: p.bands.filter((_, j) => j !== i),
      rows: p.rows.filter((_, j) => j !== i),
      exceptions,
    });
  }

  protected addColumn(f: CarFigure): void {
    this.added.update((s) => new Set([...s, f]));
  }

  /** The × on a heading clears that figure from every row and every exception. */
  protected removeColumn(f: CarFigure): void {
    const p = this.pricing();
    this.added.update((s) => new Set([...s].filter((x) => x !== f)));
    const strip = <T extends Partial<Record<CarFigure, string>>>(o: T): T => {
      const copy = { ...o };
      delete copy[f];
      return copy;
    };
    this.emit({
      ...p,
      rows: p.rows.map(strip),
      exceptions: p.exceptions.map((ex) => ({ ...ex, figures: strip(ex.figures) })),
    });
  }

  private patchException(i: number, patch: Partial<CarException>): void {
    const p = this.pricing();
    this.emit({ ...p, exceptions: p.exceptions.map((ex, j) => (j === i ? { ...ex, ...patch } : ex)) });
  }

  protected addException(): void {
    const p = this.pricing();
    const next: CarException = { kind: 'brand', value: null, bands: 'all', figures: {} };
    this.emit({ ...p, exceptions: [...p.exceptions, next] });
    this.editing.set(p.exceptions.length);
  }

  protected removeException(i: number): void {
    const p = this.pricing();
    this.editing.set(null);
    this.emit({ ...p, exceptions: p.exceptions.filter((_, j) => j !== i) });
  }

  protected setKind(i: number, kind: CarExceptionKind): void {
    const current = this.pricing().exceptions[i];
    if (!current || current.kind === kind) return;
    this.patchException(i, { kind, value: null });
  }

  protected setValue(i: number, value: string): void {
    this.patchException(i, { value: value === '' ? null : value });
  }

  protected setAll(i: number, all: boolean): void {
    this.patchException(i, { bands: all ? 'all' : this.pricing().bands.map((_, b) => b) });
  }

  protected toggleBand(i: number, b: number, on: boolean): void {
    const ex = this.pricing().exceptions[i];
    if (!ex || ex.bands === 'all') return;
    const bands = on ? [...new Set([...ex.bands, b])].sort((x, y) => x - y) : ex.bands.filter((x) => x !== b);
    this.patchException(i, { bands: bands.length === this.pricing().bands.length ? 'all' : bands });
  }

  protected setFigure(i: number, f: CarFigure, raw: string): void {
    const ex = this.pricing().exceptions[i];
    if (!ex) return;
    const figures = { ...ex.figures };
    if (raw.trim() === '') delete figures[f];
    else figures[f] = raw.trim();
    this.patchException(i, { figures });
  }
}
