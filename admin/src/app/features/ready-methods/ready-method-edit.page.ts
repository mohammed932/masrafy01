/**
 * Add or change one ready method (v37.0.0): its name, the question that decides the amount,
 * how, an optional second question for the columns, and the default figures.
 *
 * The same building blocks as a product's Amount step, for ONE method, with no product behind
 * it: the boxes are drawn from the questions' own answers, not from a compiled product.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  registryFacts,
  type IncomeBand,
  type MethodTemplate,
  type StepFigures,
  type TemplateGroup,
  type TemplateMechanism,
  type TemplateMechanismKind,
} from '@features/bank-programs/bank-programs.types';
import { howLabel, methodFacts, type MethodFact, type MethodOption } from './method-facts';

type ColMode = 'answer' | 'groups';

const NUMBER_KINDS: readonly TemplateMechanismKind[] = [
  'numberBand',
  'shareOf',
  'multipleOf',
  'dividedBy',
];

@Component({
  selector: 'app-ready-method-edit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <section class="page">
      <a class="back" routerLink="/ready-methods"
        ><span aria-hidden="true">←</span> <span i18n="@@rm.back">All ready methods</span></a
      >
      <h1>
        @if (isNew) {
          <span i18n="@@rm.new_title">New ready method</span>
        } @else {
          {{ nameForm.controls.labelEn.value || key }}
        }
      </h1>

      @if (loading()) {
        <p class="muted" i18n="@@ps.loading">Loading…</p>
      } @else {
        @if (usedBy().length > 0) {
          <p class="used" role="status">
            <span i18n="@@rm.used_note"
              >Saving changes this method on every product that uses it:</span
            >
            <b>{{ usedByNames() }}</b>
          </p>
        }
        <section class="blk">
          <h2 i18n="@@ps.called">What is it called?</h2>
          <div class="names" [formGroup]="nameForm">
            <label class="fl"
              ><span i18n="@@ps.name_en">Name in English</span><input formControlName="labelEn"
            /></label>
            <label class="fl"
              ><span i18n="@@ps.name_ar">Name in Arabic</span
              ><input formControlName="labelAr" dir="rtl"
            /></label>
          </div>
        </section>

        <section class="blk">
          <h2 i18n="@@ps.decides">What decides the amount?</h2>
          <label class="fl"
            ><span i18n="@@rm.q1">Question</span>
            <select (change)="setFact(val($event))">
              <option value="" [selected]="fact() === ''" i18n="@@ps.choose">Choose…</option>
              @for (f of askable(); track f.key) {
                <option [value]="f.key" [selected]="f.key === fact()">{{ f.label }}</option>
              }
            </select>
          </label>

          @if (factOf(fact()); as f) {
            <div class="seg" role="radiogroup" [attr.aria-label]="howAria">
              @for (k of kindsFor(f); track k) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="kind() === k"
                  (click)="setKind(k)"
                >
                  {{ how(k) }}
                </button>
              }
            </div>

            <label class="fl"
              ><span i18n="@@rm.q2">Different amounts by a second answer (optional)</span>
              <select (change)="setColumn(val($event))">
                <option value="" [selected]="colFact() === ''" i18n="@@rm.q2_none">No</option>
                @for (c of columnFacts(); track c.key) {
                  <option [value]="c.key" [selected]="c.key === colFact()">{{ c.label }}</option>
                }
              </select>
            </label>
            @if (factOf(colFact()); as c) {
              @if (c.groups.length > 0) {
                <div class="seg" role="radiogroup" [attr.aria-label]="colAria">
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="colMode() === 'answer'"
                    (click)="setColMode('answer')"
                    i18n="@@ps.col_answer"
                  >
                    one per answer
                  </button>
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="colMode() === 'groups'"
                    (click)="setColMode('groups')"
                    i18n="@@ps.col_groups"
                  >
                    one per group
                  </button>
                </div>
              }
            }

            <p class="hint" i18n="@@rm.figures_hint">
              Default amounts. A box left empty is filled in by each bank.
            </p>
            @switch (shape()) {
              @case ('table') {
                <div class="sheet">
                  <table>
                    <thead>
                      <tr>
                        <th>{{ f.label }}</th>
                        @for (c of cols(); track c.code) {
                          <th class="n">{{ c.label }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (r of rows(); track r.code) {
                        <tr>
                          <td>{{ r.label }}</td>
                          @for (c of cols(); track c.code) {
                            <td class="n">
                              <input
                                class="amt"
                                inputmode="decimal"
                                [value]="cell(c.code, r.code)"
                                (change)="setCell(c.code, r.code, val($event))"
                                [placeholder]="bankSets"
                                [attr.aria-label]="r.label + ' — ' + c.label"
                              />
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @case ('ranges') {
                <div class="sheet">
                  <table>
                    <thead>
                      <tr>
                        <th>{{ f.label }}</th>
                        @for (c of cols(); track c.code) {
                          <th class="n">{{ c.label }}</th>
                        }
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (b of ranges(); track $index; let k = $index) {
                        <tr>
                          <td>
                            <div class="rng">
                              <input
                                class="edge"
                                inputmode="decimal"
                                [value]="fmt(b.fromInclusive ?? '')"
                                (change)="setEdge(k, 'fromInclusive', val($event))"
                                [attr.aria-label]="fromAria"
                              />
                              <span i18n="@@ps.to">to</span>
                              <input
                                class="edge"
                                inputmode="decimal"
                                [value]="fmt(b.toExclusive ?? '')"
                                (change)="setEdge(k, 'toExclusive', val($event))"
                                [placeholder]="andUp"
                                [attr.aria-label]="toAria"
                              />
                            </div>
                          </td>
                          @for (c of cols(); track c.code) {
                            <td class="n">
                              <input
                                class="amt"
                                inputmode="decimal"
                                [value]="bandAmount(c.code, k)"
                                (change)="setBandAmount(c.code, k, val($event))"
                                [placeholder]="bankSets"
                                [attr.aria-label]="c.label"
                              />
                            </td>
                          }
                          <td>
                            <button
                              type="button"
                              class="x"
                              [attr.aria-label]="removeAria"
                              (click)="removeRange(k)"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <button type="button" class="link" (click)="addRange()" i18n="@@ps.add_range">
                  + Add a range
                </button>
              }
              @case ('scalar') {
                <div class="formula">
                  @for (c of cols(); track c.code) {
                    <p>
                      @if (cols().length > 1) {
                        <b>{{ c.label }}:</b>
                      }
                      <span>{{ f.label }} {{ kind() === 'dividedBy' ? '÷' : '×' }}</span>
                      <input
                        class="amt sm"
                        inputmode="decimal"
                        [value]="scalar(c.code)"
                        (change)="setScalar(c.code, val($event))"
                        [placeholder]="bankSets"
                        [attr.aria-label]="c.label"
                      />
                      @if (kind() === 'shareOf') {
                        <span>%</span>
                      }
                    </p>
                  }
                </div>
              }
            }
          }
        </section>

        @if (error(); as e) {
          <p class="err" role="alert">{{ e }}</p>
        }
        <div class="foot">
          @if (!isNew && usedBy().length === 0) {
            <button type="button" class="link danger" (click)="confirmDelete()" i18n="@@rm.delete">
              Delete
            </button>
          } @else {
            <span></span>
          }
          <div class="acts">
            <a class="btn" routerLink="/ready-methods" i18n="@@rm.cancel">Cancel</a>
            <button
              type="button"
              class="btn primary"
              (click)="save()"
              [disabled]="saving() || block() !== null"
              [attr.title]="block()"
            >
              @if (saving()) {
                <span i18n="@@ps.saving">Saving…</span>
              } @else {
                <span i18n="@@rm.save">Save method</span>
              }
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block: var(--space-4) var(--space-8);
      }
      .back {
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        align-self: flex-start;
      }
      h1 {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      h2 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .muted,
      .hint {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .err {
        margin: 0;
        color: var(--color-error);
      }
      .used {
        margin: 0;
        padding: var(--space-2-5) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .blk {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: flex-start;
        min-width: 0;
      }
      .blk > * {
        max-inline-size: 100%;
      }
      .names {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: var(--space-3);
        inline-size: 100%;
        max-inline-size: 40rem;
      }
      .fl {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      input,
      select {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-2-5);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-weight: var(--font-weight-regular);
        max-inline-size: 100%;
      }
      select {
        min-inline-size: 18rem;
      }
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .seg button {
        border: 0;
        background: var(--color-surface-default);
        padding: var(--space-1-5) var(--space-3);
        cursor: pointer;
        font: inherit;
        color: var(--color-text-primary);
      }
      .seg button + button {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .seg button[aria-checked='true'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        font-weight: var(--font-weight-semibold);
      }
      .sheet {
        max-inline-size: 100%;
        overflow-x: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      table {
        border-collapse: collapse;
      }
      th,
      td {
        padding: var(--space-1-5) var(--space-3);
        text-align: start;
        border-block-end: 1px solid var(--color-border-default);
        color: var(--color-text-primary);
      }
      tr:last-child td {
        border-block-end: 0;
      }
      th {
        background: var(--color-surface-muted);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      th.n,
      td.n {
        text-align: end;
      }
      .amt,
      .edge {
        inline-size: 10rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .amt.sm {
        inline-size: 8rem;
      }
      .edge {
        inline-size: 7.5rem;
      }
      .amt::placeholder,
      .edge::placeholder {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .rng {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
        color: var(--color-text-secondary);
      }
      .formula {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .formula p {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .link {
        border: 0;
        background: none;
        color: var(--color-text-link);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        padding: 0;
      }
      .link.danger {
        color: var(--color-error);
      }
      .x {
        border: 0;
        background: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        font: inherit;
      }
      .foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-3);
      }
      .acts {
        display: flex;
        gap: var(--space-2);
      }
      .btn {
        border: 1px solid var(--color-border-default);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-4);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        text-decoration: none;
      }
      .btn.primary {
        background: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible,
      a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
    `,
  ],
})
export class ReadyMethodEditPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly errors = inject(ErrorCodeService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly key = inject(ActivatedRoute).snapshot.paramMap.get('key') ?? 'new';
  protected readonly isNew = this.key === 'new';

  protected readonly loading = signal(!this.isNew);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly nameForm = this.fb.nonNullable.group({ labelEn: '', labelAr: '' });
  private readonly nameRev = signal(0);

  protected readonly fact = signal('');
  protected readonly kind = signal<TemplateMechanismKind>('choiceTable');
  protected readonly colFact = signal('');
  protected readonly colMode = signal<ColMode>('answer');
  /** The column order a stored method was saved with — its first column keys as ''. */
  private readonly storedBranches = signal<string[] | null>(null);
  protected readonly figures = signal<Record<string, StepFigures>>({});
  /** The products linked to it — what a save changes. */
  protected readonly usedBy = signal<MethodTemplate['usedBy']>([]);
  protected usedByNames(): string {
    return this.usedBy()
      .map((p) => (this.isAr ? p.labelAr : p.labelEn))
      .join(', ');
  }

  /** A method's own row groups, kept as they were when it was opened. */
  private readonly ownGroups = signal<TemplateGroup[] | undefined>(undefined);

  protected readonly bankSets = $localize`:@@ps.bank_sets:bank sets`;
  protected readonly andUp = $localize`:@@ps.and_up:and up`;
  protected readonly fromAria = $localize`:@@spt.v2.from_col:From`;
  protected readonly toAria = $localize`:@@spt.v2.to_col:Up to`;
  protected readonly removeAria = $localize`:@@ps.remove:Remove`;
  protected readonly howAria = $localize`:@@rm.how:How`;
  protected readonly colAria = $localize`:@@spt.v2.col_mode_aria:A column per answer or per group`;

  private readonly facts = computed(() =>
    methodFacts(registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr), this.isAr),
  );
  /** A worked-out answer can only split columns, never be the question itself. */
  protected readonly askable = computed(() => this.facts().filter((f) => !f.derived));
  protected readonly columnFacts = computed(() =>
    this.facts().filter((f) => f.type === 'choice' && f.key !== this.fact()),
  );

  constructor() {
    this.nameForm.valueChanges.subscribe(() => this.nameRev.update((n) => n + 1));
    void this.enums.load('surrogate_fact');
    if (!this.isNew) void this.load();
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected how(k: TemplateMechanismKind): string {
    return howLabel(k);
  }

  protected factOf(key: string): MethodFact | undefined {
    return key === '' ? undefined : this.facts().find((f) => f.key === key);
  }

  protected kindsFor(f: MethodFact): readonly TemplateMechanismKind[] {
    if (f.type === 'number') return NUMBER_KINDS;
    return f.groups.length > 0 ? ['choiceTable', 'classTable'] : ['choiceTable'];
  }

  protected setFact(key: string): void {
    this.fact.set(key);
    const f = this.factOf(key);
    this.kind.set(f?.type === 'number' ? 'numberBand' : 'choiceTable');
    if (this.colFact() === key) {
      this.colFact.set('');
      this.storedBranches.set(null);
    }
    this.ownGroups.set(undefined);
    this.figures.set({});
  }

  protected setKind(k: TemplateMechanismKind): void {
    this.kind.set(k);
    this.ownGroups.set(undefined);
    this.figures.set({});
  }

  protected setColumn(key: string): void {
    this.storedBranches.set(null);
    this.colFact.set(key);
    this.colMode.set('answer');
    this.figures.set({});
  }

  protected setColMode(mode: ColMode): void {
    this.storedBranches.set(null);
    this.colMode.set(mode);
    this.figures.set({});
  }

  protected readonly shape = computed<'table' | 'ranges' | 'scalar'>(() => {
    const k = this.kind();
    if (k === 'numberBand') return 'ranges';
    if (k === 'choiceTable' || k === 'classTable') return 'table';
    return 'scalar';
  });

  /** One column per answer (or group) of the second question; the first keys as ''. */
  protected readonly cols = computed<MethodOption[]>(() => {
    const c = this.factOf(this.colFact());
    const amount =
      this.kind() === 'shareOf'
        ? $localize`:@@rm.col_value:Value`
        : $localize`:@@rm.col_amount:Amount`;
    if (!c) return [{ code: '', label: amount }];
    const list = this.colMode() === 'groups' ? c.groups : c.options;
    return this.branches().map((code, i) => ({
      code: i === 0 ? '' : code,
      label: list.find((o) => o.code === code)?.label ?? code,
    }));
  });

  private branches(): string[] {
    const stored = this.storedBranches();
    if (stored) return stored;
    const c = this.factOf(this.colFact());
    if (!c) return [];
    return (this.colMode() === 'groups' ? c.groups : c.options).map((o) => o.code);
  }

  protected readonly rows = computed<readonly MethodOption[]>(() => {
    const f = this.factOf(this.fact());
    if (!f) return [];
    if (this.kind() === 'classTable') {
      const own = this.ownGroups();
      return own
        ? own.map((g) => ({ code: g.key, label: this.isAr ? g.labelAr : g.labelEn }))
        : f.groups;
    }
    return f.options;
  });

  // --- figures -----------------------------------------------------------------

  private update(col: string, change: (f: StepFigures) => StepFigures): void {
    this.figures.set({ ...this.figures(), [col]: change({ ...(this.figures()[col] ?? {}) }) });
  }

  protected fmt(raw: string): string {
    return /^\d+(\.\d+)?$/.test(raw)
      ? Number(raw).toLocaleString('en-US', { maximumFractionDigits: 4 })
      : raw;
  }

  private clean(raw: string): string {
    return raw.replace(/,/g, '').trim();
  }

  protected cell(col: string, row: string): string {
    return this.fmt(this.figures()[col]?.keyTable?.find((r) => r.key === row)?.incomeEGP ?? '');
  }

  protected setCell(col: string, row: string, raw: string): void {
    const value = this.clean(raw);
    this.update(col, (f) => {
      const rows = (f.keyTable ?? []).filter((r) => r.key !== row);
      if (value !== '') rows.push({ key: row, incomeEGP: value });
      return { ...f, keyTable: rows };
    });
  }

  /** The ranges, read off the first column; every column shares them. */
  protected ranges(): readonly IncomeBand[] {
    const first = this.figures()['']?.bands ?? [];
    return first.length > 0 ? first : [{ fromInclusive: '0', toExclusive: null, incomeEGP: '' }];
  }

  private eachColumn(change: (bands: IncomeBand[], col: string) => IncomeBand[]): void {
    const edges = this.ranges();
    const next = { ...this.figures() };
    for (const { code } of this.cols()) {
      const own = next[code]?.bands ?? [];
      const aligned = edges.map((e, k) => ({
        fromInclusive: e.fromInclusive,
        toExclusive: e.toExclusive,
        incomeEGP: own[k]?.incomeEGP ?? '',
      }));
      next[code] = { ...(next[code] ?? {}), bands: change(aligned, code) };
    }
    this.figures.set(next);
  }

  protected setEdge(k: number, edge: 'fromInclusive' | 'toExclusive', raw: string): void {
    const value = this.clean(raw);
    this.eachColumn((bands) =>
      bands.map((b, i) =>
        i === k ? { ...b, [edge]: edge === 'toExclusive' && value === '' ? null : value } : b,
      ),
    );
  }

  protected bandAmount(col: string, k: number): string {
    return this.fmt(this.figures()[col]?.bands?.[k]?.incomeEGP ?? '');
  }

  protected setBandAmount(col: string, k: number, raw: string): void {
    const value = this.clean(raw);
    this.eachColumn((bands, c) =>
      c === col ? bands.map((b, i) => (i === k ? { ...b, incomeEGP: value } : b)) : bands,
    );
  }

  protected addRange(): void {
    const last = this.ranges().at(-1);
    const start = last?.toExclusive ?? '';
    this.eachColumn((bands) => [
      ...bands,
      { fromInclusive: start, toExclusive: null, incomeEGP: '' },
    ]);
  }

  protected removeRange(k: number): void {
    this.eachColumn((bands) => bands.filter((_, i) => i !== k));
  }

  protected scalar(col: string): string {
    return this.fmt(this.figures()[col]?.scalar?.value ?? '');
  }

  protected setScalar(col: string, raw: string): void {
    const value = this.clean(raw);
    const unit = this.kind() === 'shareOf' ? 'percent' : 'multiplier';
    this.update(col, (f) => {
      const next = { ...f };
      if (value === '') delete next.scalar;
      else next.scalar = { value, unit };
      return next;
    });
  }

  // --- save ----------------------------------------------------------------------

  protected readonly block = computed<string | null>(() => {
    this.nameRev();
    const v = this.nameForm.getRawValue();
    if (v.labelEn.trim() === '' || v.labelAr.trim() === '') {
      return $localize`:@@rm.need_names:Give the method a name in English and Arabic.`;
    }
    if (this.fact() === '')
      return $localize`:@@rm.need_q:Pick the question that decides the amount.`;
    if (this.colFact() !== '' && this.branches().length < 2) {
      return $localize`:@@rm.need_cols:The second question needs at least two answers.`;
    }
    return null;
  });

  private mechanism(): TemplateMechanism {
    const branches = this.branches();
    const own = this.ownGroups();
    return {
      kind: this.kind(),
      fact: this.fact(),
      ...(this.kind() === 'classTable' && own ? { groups: own } : {}),
      ...(this.colFact() !== ''
        ? {
            column: {
              fact: this.colFact(),
              branches,
              ...(this.colMode() === 'groups' ? { branchOn: 'parentClass' as const } : {}),
            },
          }
        : {}),
    } as TemplateMechanism;
  }

  /** Blank rows out, and only the columns the method has. */
  private cleanFigures(): Record<string, StepFigures> {
    const keep = new Set(this.cols().map((c) => c.code));
    const out: Record<string, StepFigures> = {};
    for (const [col, f] of Object.entries(this.figures())) {
      if (!keep.has(col)) continue;
      const copy: StepFigures = { ...f };
      if (copy.keyTable) {
        copy.keyTable = copy.keyTable.filter((r) => String(r.incomeEGP ?? '').trim() !== '');
        if (copy.keyTable.length === 0) delete copy.keyTable;
      }
      if (copy.bands) {
        copy.bands = copy.bands.filter((b) => String(b.incomeEGP ?? '').trim() !== '');
        if (copy.bands.length === 0) delete copy.bands;
      }
      if (Object.keys(copy).length > 0) out[col] = copy;
    }
    return out;
  }

  /** A method products use asks first, naming them: the save changes their amounts. */
  protected save(): void {
    if (this.block() !== null || this.saving()) return;
    if (this.isNew || this.usedBy().length === 0) {
      void this.doSave();
      return;
    }
    const names = this.usedByNames();
    this.modal.confirm({
      nzTitle: $localize`:@@rm.confirm_title:Change it on every product that uses it?`,
      nzContent: $localize`:@@rm.confirm_body:These products are changed from the next quote: ${names}:NAMES:. Offers already issued keep their own figures.`,
      nzOkText: $localize`:@@rm.save:Save method`,
      nzOnOk: () => this.doSave(),
    });
  }

  private async doSave(): Promise<void> {
    if (this.block() !== null || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const v = this.nameForm.getRawValue();
    const body = {
      labelEn: v.labelEn.trim(),
      labelAr: v.labelAr.trim(),
      mechanism: this.mechanism(),
      figures: this.cleanFigures(),
    };
    try {
      if (this.isNew) {
        await this.api.createMethodTemplate(body);
        this.message.success($localize`:@@rm.saved:Method saved.`);
      } else {
        const res = await this.api.updateMethodTemplate(this.key, body);
        const { updated, refused } = res.data.propagation;
        if (refused.length > 0) {
          const names = refused.map((r) => r.key).join(', ');
          this.error.set(
            $localize`:@@rm.refused:Saved, but these products could not take the change and kept their old copy: ${names}:NAMES:.`,
          );
          return;
        }
        const n = updated.length;
        this.message.success(
          n > 0
            ? $localize`:@@rm.saved_n:Method saved and ${n}:N: product(s) updated.`
            : $localize`:@@rm.saved:Method saved.`,
        );
      }
      void this.router.navigate(['/ready-methods']);
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.error.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(): void {
    const name = this.nameForm.controls.labelEn.value;
    this.modal.confirm({
      nzTitle: $localize`:@@rm.delete_title:Delete “${name}:NAME:”?`,
      nzContent: $localize`:@@rm.delete_body:It leaves the list. Products that already use it keep their own copy.`,
      nzOkText: $localize`:@@rm.delete:Delete`,
      nzOkDanger: true,
      nzOnOk: async () => {
        await this.api.deleteMethodTemplate(this.key);
        this.message.success($localize`:@@rm.deleted:Method deleted.`);
        void this.router.navigate(['/ready-methods']);
      },
    });
  }

  private async load(): Promise<void> {
    try {
      const list = (await this.api.listMethodTemplates()).data;
      const m: MethodTemplate | undefined = list.find((x) => x.key === this.key);
      if (!m) {
        this.error.set(this.errors.toLocalizedMessage('METHOD_TEMPLATE_NOT_FOUND' as ErrorCode));
        return;
      }
      this.nameForm.reset({ labelEn: m.labelEn, labelAr: m.labelAr });
      this.usedBy.set(m.usedBy ?? []);
      const mech = m.mechanism;
      if (mech.kind !== 'flatAmount') this.fact.set(mech.fact);
      this.kind.set(mech.kind);
      if (mech.kind === 'classTable' && mech.groups) this.ownGroups.set(mech.groups);
      this.colFact.set(mech.column?.fact ?? '');
      this.colMode.set(mech.column?.branchOn === 'parentClass' ? 'groups' : 'answer');
      this.storedBranches.set(mech.column ? [...mech.column.branches] : null);
      this.figures.set(structuredClone(m.figures ?? {}));
    } finally {
      this.loading.set(false);
    }
  }
}
