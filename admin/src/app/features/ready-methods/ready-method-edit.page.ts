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
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { GroupBoardComponent } from '@shared/groups/group-board.component';
import { FormPageComponent, SearchSelectComponent, type SearchSelectOption } from '@shared/ui';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  CloseOutline,
  DeleteOutline,
  ExclamationCircleOutline,
  LinkOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
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
  type MethodQuestion,
  type MethodTemplate,
  type StepFigures,
  type TemplateGroup,
  type TemplateMechanism,
  type TemplateMechanismKind,
} from '@features/bank-programs/bank-programs.types';
import { howLabel, methodFacts, type MethodFact, type MethodOption } from './method-facts';

type ColMode = 'answer' | 'groups';

/** The prefix a question with no fact yet is offered under. */
const UNBOUND = 'q:';

const SCALAR_KINDS: readonly TemplateMechanismKind[] = ['shareOf', 'multipleOf', 'dividedBy'];

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
  imports: [
    RouterLink,
    ReactiveFormsModule,
    NgTemplateOutlet,
    GroupBoardComponent,
    FormPageComponent,
    SearchSelectComponent,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
  ],
  providers: [
    provideNzIconsPatch([
      DeleteOutline,
      PlusOutline,
      CloseOutline,
      LinkOutline,
      ExclamationCircleOutline,
    ]),
  ],
  template: `
    <app-form-page
      wide
      [title]="pageTitle()"
      [subtitle]="pageLede"
      [backLabel]="backLabel"
      [cancelLabel]="cancelLabel"
      [submitLabel]="saveLabel"
      [submitting]="saving()"
      [blockReason]="loading() ? null : block()"
      [hint]="usedBy().length > 0 ? usedHint() : null"
      (cancelled)="leave()"
      (submitted)="save()"
    >
      @if (!isNew && !loading()) {
        <div formPageAside class="aside">
          <span class="src" [class.own]="source() !== 'seed'">
            @if (source() === 'seed') {
              <span i18n="@@rm.shipped">Shipped</span>
            } @else {
              <span i18n="@@rm.added">Added</span>
            }
          </span>
          <span
            nz-tooltip
            [nzTooltipTitle]="usedBy().length > 0 ? deleteBlocked() : null"
          >
            <button
              nz-button
              nzType="default"
              nzDanger
              type="button"
              [disabled]="usedBy().length > 0"
              (click)="confirmDelete()"
            >
              <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@rm.delete">Delete</span>
            </button>
          </span>
        </div>
      }

      @if (loading()) {
        <div class="blk skel" aria-busy="true">
          <span class="bar w40"></span><span class="bar w70"></span><span class="bar w55"></span>
        </div>
      } @else {
        @if (usedBy().length > 0) {
          <div class="used" role="status">
            <span nz-icon nzType="link" nzTheme="outline" class="used-i" aria-hidden="true"></span>
            <div>
              <p i18n="@@rm.used_note3">
                Saving changes the questions, how and groups of these products. Each keeps its own
                amounts.
              </p>
              <ul class="chips" role="list">
                @for (p of usedBy(); track p.key) {
                  <li>
                    <a
                      [routerLink]="['/program-catalog/products', p.key]"
                      [queryParams]="{ step: 3 }"
                      >{{ isAr ? p.labelAr : p.labelEn }}</a
                    >
                  </li>
                }
              </ul>
            </div>
          </div>
        }
        <section class="blk">
          <h2 i18n="@@ps.called">What is it called?</h2>
          <div class="names" [formGroup]="nameForm">
            <label class="fl"
              ><span i18n="@@ps.name_en">Name in English</span
              ><input nz-input formControlName="labelEn"
            /></label>
            <label class="fl"
              ><span i18n="@@ps.name_ar">Name in Arabic</span
              ><input nz-input formControlName="labelAr" dir="rtl"
            /></label>
          </div>
        </section>

        <section class="blk">
          <h2 i18n="@@ps.decides">What decides the amount?</h2>
          <div class="fl wide">
            <span i18n="@@rm.q1">Question</span>
            <app-search-select
              [options]="askableOpts()"
              [value]="fact()"
              [ariaLabel]="q1Aria"
              (changed)="pickQuestion('row', $event)"
            />
          </div>

          @if (factOf(fact()); as f) {
            <div class="row">
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
              @if (kind() === 'classTable') {
                <button type="button" class="link" (click)="toggleEditor('row')">
                  @if (editorOpen() === 'row') {
                    <span i18n="@@ps.groups_done">Done with groups</span>
                  } @else {
                    <span i18n="@@ps.groups_edit">Edit groups</span>
                  }
                </button>
              }
            </div>
            @if (kind() === 'classTable' && editorOpen() === 'row') {
              <ng-container *ngTemplateOutlet="groupsEd; context: { axis: 'row' }" />
            }

            <div class="fl wide">
              <span i18n="@@rm.q2">Different amounts by a second answer (optional)</span>
              <app-search-select
                [options]="columnOpts()"
                [value]="colFact()"
                [clearLabel]="noSecond"
                [ariaLabel]="q2Aria"
                (changed)="pickQuestion('col', $event)"
              />
            </div>
            @if (factOf(colFact()); as c) {
              @if (groupable(c)) {
                <div class="row">
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
                  @if (colMode() === 'groups') {
                    <button type="button" class="link" (click)="toggleEditor('col')">
                      @if (editorOpen() === 'col') {
                        <span i18n="@@ps.groups_done">Done with groups</span>
                      } @else {
                        <span i18n="@@ps.groups_edit">Edit groups</span>
                      }
                    </button>
                  }
                </div>
                @if (colMode() === 'groups' && editorOpen() === 'col') {
                  <ng-container *ngTemplateOutlet="groupsEd; context: { axis: 'col' }" />
                }
              }
            }

            <p class="hint" i18n="@@rm.figures_hint2">
              Default amounts: a product that picks this method starts from them, then sets its own.
              A box left empty is filled in by each bank.
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
                              nz-button
                              nzType="text"
                              nzShape="circle"
                              type="button"
                              [attr.aria-label]="removeAria"
                              (click)="removeRange(k)"
                            >
                              <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <button nz-button nzType="dashed" type="button" (click)="addRange()">
                  <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@rm.add_range">Add a range</span>
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
          <p class="err" role="alert">
            <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
            {{ e }}
          </p>
        }
      }
    </app-form-page>

    <ng-template #groupsEd let-axis="axis">
      <div class="groups">
        <p class="hint" i18n="@@rm.groups_own">
          These groups belong to this method, and are copied to every product that uses it.
        </p>
        <app-group-board
          [groups]="groupsOf(axis)"
          [answers]="axisOptions(axis)"
          [placements]="placementsOf(axis)"
          [minGroups]="axis === 'row' ? 1 : 2"
          [isAr]="isAr"
          (renamed)="renameGroup(axis, $event.key, $event.labelEn, $event.labelAr)"
          (added)="addGroup(axis)"
          (removed)="removeGroup(axis, $event)"
          (placed)="place(axis, $event.code, $event.group)"
        />
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .aside {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .src {
        padding: var(--space-0-5) var(--space-2-5);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }
      .src.own {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }
      .skel {
        gap: var(--space-3);
      }
      .bar {
        display: block;
        block-size: var(--space-3);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
      }
      .w40 {
        inline-size: 40%;
      }
      .w55 {
        inline-size: 55%;
      }
      .w70 {
        inline-size: 70%;
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
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-error);
      }
      .used {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .used p {
        margin: 0;
      }
      .used-i {
        margin-block-start: var(--space-0-5);
        color: var(--color-brand-primary);
      }
      .chips {
        list-style: none;
        margin: var(--space-2) 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .chips a {
        display: inline-block;
        padding: var(--space-0-5) var(--space-2-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-link);
        font-weight: var(--font-weight-semibold);
        text-decoration: none;
      }
      .chips a:hover {
        border-color: var(--color-brand-primary);
      }
      .blk,
      .used {
        margin-block-end: var(--space-4);
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
      .fl.wide {
        inline-size: 100%;
      }
      .fl {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      input:not([nz-input]) {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-2) var(--space-2-5);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-weight: var(--font-weight-regular);
        max-inline-size: 100%;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        align-items: center;
      }
      .groups {
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
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
  private readonly lookups = inject(LookupsApiService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

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

  /** The method's own groups: its rows (per group), its columns (one per group). */
  protected readonly rowGroups = signal<TemplateGroup[] | undefined>(undefined);
  protected readonly colGroups = signal<TemplateGroup[] | undefined>(undefined);
  /** Per question: answer code → group key. */
  private readonly placements = signal<Record<string, Record<string, string>>>({});
  /** Per question: answer code → list row id (what a product's groups are filed by). */
  private readonly valueIds = signal<Record<string, Record<string, string>>>({});
  /** Per question: the group each answer sits in on the shared list. */
  private readonly shared = signal<Record<string, Record<string, string>>>({});
  protected readonly editorOpen = signal<'row' | 'col' | null>(null);

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
  /** Every number or one-choice question in the system (v37.0.0), bound or not. */
  private readonly questions = signal<MethodQuestion[]>([]);
  /** A question with no fact yet is offered by its code, prefixed; picking it binds one. */
  private questionOpts(type: 'NUMERIC' | 'SINGLE_SELECT' | null, skip: string) {
    const seen = new Set<string>();
    const out: SearchSelectOption[] = [];
    for (const f of type === 'SINGLE_SELECT' ? this.columnFacts() : this.askable()) {
      seen.add(f.key);
      out.push({ value: f.key, label: f.label });
    }
    for (const q of this.questions()) {
      if (q.type !== 'NUMERIC' && q.type !== 'SINGLE_SELECT') continue;
      if (type !== null && q.type !== type) continue;
      if (q.factKey !== null && (seen.has(q.factKey) || q.factKey === skip)) continue;
      out.push({
        value: q.factKey ?? UNBOUND + q.code,
        label: (this.isAr ? q.labelAr : q.labelEn).trim() || q.labelEn,
      });
    }
    return out;
  }
  protected readonly askableOpts = computed(() => this.questionOpts(null, ''));
  protected readonly columnOpts = computed(() => this.questionOpts('SINGLE_SELECT', this.fact()));
  protected readonly binding = signal(false);

  /** A pick from the list: a question with no fact gets one first, then is read as usual. */
  protected async pickQuestion(axis: 'row' | 'col', value: string): Promise<void> {
    let key = value;
    if (value.startsWith(UNBOUND)) {
      this.binding.set(true);
      try {
        key = (await this.api.ensureMethodFact(value.slice(UNBOUND.length))).data.factKey;
        await this.enums.refresh('surrogate_fact');
        this.questions.set((await this.api.listMethodQuestions()).data);
      } catch (err) {
        const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
          ?.error;
        this.error.set(
          this.errors.toLocalizedMessage(
            (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
            envelope?.meta,
          ),
        );
        return;
      } finally {
        this.binding.set(false);
      }
    }
    if (axis === 'row') this.setFact(key);
    else this.setColumn(key);
  }
  protected readonly source = signal<MethodTemplate['source']>('operator');
  protected readonly pageTitle = computed(() => {
    this.nameRev();
    if (this.isNew) return $localize`:@@rm.new_title:New surrogate method`;
    const v = this.nameForm.controls;
    return (this.isAr ? v.labelAr.value : v.labelEn.value) || v.labelEn.value || this.key;
  });
  protected readonly pageLede = $localize`:@@rm.page_lede:Name it, pick the question that decides the amount, and set the default amounts a product starts from.`;
  protected readonly backLabel = $localize`:@@rm.back:All surrogate methods`;
  protected readonly cancelLabel = $localize`:@@rm.cancel:Cancel`;
  protected readonly saveLabel = $localize`:@@rm.save:Save method`;
  protected readonly q1Aria = $localize`:@@rm.q1:Question`;
  protected readonly q2Aria = $localize`:@@rm.q2:Different amounts by a second answer (optional)`;
  protected readonly noSecond = $localize`:@@rm.q2_none:No`;
  protected usedHint(): string {
    const n = this.usedBy().length;
    return n === 1
      ? $localize`:@@rm.used_hint_one:Saving changes 1 product.`
      : $localize`:@@rm.used_hint:Saving changes ${n}:N: products.`;
  }
  protected deleteBlocked(): string {
    return $localize`:@@rm.delete_blocked:A product uses it. Unlink it on the product first.`;
  }
  protected leave(): void {
    void this.router.navigateByUrl('/surrogate-methods');
  }

  constructor() {
    this.nameForm.valueChanges.subscribe(() => this.nameRev.update((n) => n + 1));
    void this.enums.load('surrogate_fact');
    void this.api.listMethodQuestions().then((r) => this.questions.set(r.data));
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
    return this.groupable(f) ? ['choiceTable', 'classTable'] : ['choiceTable'];
  }

  /** Its answers come from a list long enough to group, or already grouped. */
  protected groupable(f: MethodFact): boolean {
    return f.listType !== null && (f.groups.length > 0 || f.options.length > 3);
  }

  protected toggleEditor(axis: 'row' | 'col'): void {
    if (this.editorOpen() === axis) {
      this.editorOpen.set(null);
      return;
    }
    if ((axis === 'row' ? this.rowGroups() : this.colGroups()) === undefined) {
      void this.seedGroups(axis);
      return;
    }
    this.editorOpen.set(axis);
  }

  private axisFact(axis: 'row' | 'col'): string {
    return axis === 'row' ? this.fact() : this.colFact();
  }

  protected axisOptions(axis: 'row' | 'col'): readonly MethodOption[] {
    return this.factOf(this.axisFact(axis))?.options ?? [];
  }

  protected groupsOf(axis: 'row' | 'col'): TemplateGroup[] {
    return (axis === 'row' ? this.rowGroups() : this.colGroups()) ?? [];
  }

  private setGroups(axis: 'row' | 'col', groups: TemplateGroup[]): void {
    if (axis === 'row') this.rowGroups.set(groups);
    else {
      this.colGroups.set(groups);
      this.storedBranches.set(null);
    }
  }

  protected groupLabel(g: TemplateGroup): string {
    return (this.isAr ? g.labelAr : g.labelEn).trim() || g.labelEn || g.labelAr;
  }

  /** The list's row ids and where each answer sits on the shared list, read once per question. */
  private async ensureList(fact: string): Promise<void> {
    const f = this.factOf(fact);
    if (!f || f.listType === null || this.valueIds()[fact] !== undefined) return;
    const rows = await this.lookups.list(f.listType);
    this.valueIds.set({
      ...this.valueIds(),
      [fact]: Object.fromEntries(rows.map((r) => [r.key, r.id])),
    });
    this.shared.set({
      ...this.shared(),
      [fact]: Object.fromEntries(
        rows.filter((r) => r.parentKey).map((r) => [r.key, r.parentKey as string]),
      ),
    });
  }

  /**
   * Make the groups the method's own: a list that has groups is copied as it stands (same keys,
   * each answer where it sits today); any other list starts with none.
   */
  private async seedGroups(axis: 'row' | 'col'): Promise<void> {
    const fact = this.axisFact(axis);
    const f = this.factOf(fact);
    if (!f) return;
    await this.ensureList(fact);
    // A list with no groups of its own starts with none: the operator adds and names them.
    const groups: TemplateGroup[] = f.groups.map((g) => ({
      key: g.code,
      labelEn: g.label,
      labelAr: g.label,
    }));
    // Both names from the list when it carries them.
    const enums = registryFacts(this.enums.membersFor('surrogate_fact')(), false);
    const parents = enums.find((x) => x.key === fact)?.question?.parentOptions ?? [];
    for (const g of groups) {
      const p = parents.find((o) => o.code === g.key);
      if (p) {
        g.labelEn = p.labelEn;
        g.labelAr = p.labelAr;
      }
    }
    const keys = new Set(groups.map((g) => g.key));
    const now = this.shared()[fact] ?? {};
    this.placements.set({
      ...this.placements(),
      [fact]: Object.fromEntries(
        f.options.flatMap((o) => {
          const at = now[o.code];
          return at !== undefined && keys.has(at) ? [[o.code, at]] : [];
        }),
      ),
    });
    this.setGroups(axis, groups);
    this.editorOpen.set(axis);
  }

  protected renameGroup(
    axis: 'row' | 'col',
    key: string,
    en: string | null,
    ar: string | null,
  ): void {
    this.setGroups(
      axis,
      this.groupsOf(axis).map((g) =>
        g.key === key ? { ...g, labelEn: en ?? g.labelEn, labelAr: ar ?? g.labelAr } : g,
      ),
    );
  }

  protected addGroup(axis: 'row' | 'col'): void {
    const groups = this.groupsOf(axis);
    const taken = new Set(groups.map((g) => g.key));
    let n = groups.length + 1;
    while (taken.has(`g${n}`)) n += 1;
    this.setGroups(axis, [
      ...groups,
      { key: `g${n}`, labelEn: `Group ${n}`, labelAr: `المجموعة ${n}` },
    ]);
  }

  protected removeGroup(axis: 'row' | 'col', key: string): void {
    const fact = this.axisFact(axis);
    this.setGroups(
      axis,
      this.groupsOf(axis).filter((g) => g.key !== key),
    );
    const mine = { ...(this.placements()[fact] ?? {}) };
    for (const [code, g] of Object.entries(mine)) if (g === key) delete mine[code];
    this.placements.set({ ...this.placements(), [fact]: mine });
    const next = { ...this.figures() };
    if (axis === 'row') {
      for (const [col, f] of Object.entries(next)) {
        if (f.keyTable) next[col] = { ...f, keyTable: f.keyTable.filter((r) => r.key !== key) };
      }
    } else {
      delete next[key];
    }
    this.figures.set(next);
  }

  protected placementsOf(axis: 'row' | 'col'): Record<string, string> {
    return this.placements()[this.axisFact(axis)] ?? {};
  }

  protected place(axis: 'row' | 'col', code: string, group: string): void {
    const fact = this.axisFact(axis);
    const mine = { ...(this.placements()[fact] ?? {}) };
    if (group === '') delete mine[code];
    else mine[code] = group;
    this.placements.set({ ...this.placements(), [fact]: mine });
  }

  /**
   * Every setup tried while the page is open, so switching back (per answer ↔ per group, one
   * way of working it out ↔ another, a second question on ↔ off) restores its amounts and
   * groups instead of starting empty.
   */
  private readonly tried = new Map<
    string,
    {
      figures: Record<string, StepFigures>;
      rowGroups: TemplateGroup[] | undefined;
      colGroups: TemplateGroup[] | undefined;
      storedBranches: string[] | null;
      placements: Record<string, Record<string, string>>;
    }
  >();

  private setupKey(): string {
    return [this.fact(), this.kind(), this.colFact(), this.colMode()].join('|');
  }

  private remember(): void {
    this.tried.set(this.setupKey(), {
      figures: structuredClone(this.figures()),
      rowGroups: structuredClone(this.rowGroups()),
      colGroups: structuredClone(this.colGroups()),
      storedBranches: this.storedBranches() ? [...this.storedBranches()!] : null,
      placements: structuredClone(this.placements()),
    });
  }

  /** Bring back the setup now selected, if it was tried before. Says whether it did. */
  private recall(): boolean {
    const was = this.tried.get(this.setupKey());
    if (!was) return false;
    this.figures.set(structuredClone(was.figures));
    this.rowGroups.set(structuredClone(was.rowGroups));
    this.colGroups.set(structuredClone(was.colGroups));
    this.storedBranches.set(was.storedBranches ? [...was.storedBranches] : null);
    this.placements.set(structuredClone(was.placements));
    return true;
  }

  protected setFact(key: string): void {
    if (key === this.fact()) return;
    this.remember();
    const before = this.factOf(this.fact());
    const was = this.figures();
    const wasKind = this.kind();
    this.fact.set(key);
    const f = this.factOf(key);
    // Same kind of answer, same way of working it out: the amounts carry over.
    const sameShape = before !== undefined && f !== undefined && before.type === f.type;
    this.kind.set(sameShape && wasKind !== 'classTable' ? wasKind : f?.type === 'number' ? 'numberBand' : 'choiceTable');
    if (this.colFact() === key) this.colFact.set('');
    this.editorOpen.set(null);
    if (this.recall()) return;
    if (this.colFact() === '') {
      this.storedBranches.set(null);
      this.colGroups.set(undefined);
    }
    this.rowGroups.set(undefined);
    this.figures.set(sameShape ? this.carried(was, f!) : {});
  }

  /**
   * What of the amounts survives a new question: ranges and single figures as they are, and a
   * per-answer table's rows for the answers the new question shares.
   */
  private carried(was: Record<string, StepFigures>, f: MethodFact): Record<string, StepFigures> {
    if (this.kind() !== 'choiceTable') return structuredClone(was);
    const codes = new Set(f.options.map((o) => o.code));
    const out: Record<string, StepFigures> = {};
    for (const [col, fig] of Object.entries(was)) {
      const rows = (fig.keyTable ?? []).filter((r) => codes.has(r.key));
      if (rows.length > 0) out[col] = { ...fig, keyTable: rows };
    }
    return out;
  }

  protected setKind(k: TemplateMechanismKind): void {
    if (k === this.kind()) return;
    this.remember();
    const wasScalar = SCALAR_KINDS.includes(this.kind());
    const was = this.figures();
    this.kind.set(k);
    if (this.recall()) {
      if (k !== 'classTable' && this.editorOpen() === 'row') this.editorOpen.set(null);
      return;
    }
    this.rowGroups.set(undefined);
    // One figure per column either way (% of it ↔ multiplied ↔ divided): it stays.
    this.figures.set(wasScalar && SCALAR_KINDS.includes(k) ? structuredClone(was) : {});
    if (k === 'classTable') void this.seedGroups('row');
    else this.editorOpen.set(null);
  }

  protected setColumn(key: string): void {
    if (key === this.colFact()) return;
    this.remember();
    const first = this.firstColumn();
    this.colFact.set(key);
    this.colMode.set('answer');
    if (this.editorOpen() === 'col') this.editorOpen.set(null);
    if (this.recall()) return;
    this.storedBranches.set(null);
    this.colGroups.set(undefined);
    // The first column's amounts stay where they are; only the new columns start empty.
    this.figures.set(first ? { '': first } : {});
  }

  /** The amounts in the first column, wherever the stored order keeps them. */
  private firstColumn(): StepFigures | undefined {
    const f = this.figures();
    return f[''] ?? f[this.storedBranches()?.[0] ?? ''];
  }

  protected setColMode(mode: ColMode): void {
    if (mode === this.colMode()) return;
    this.remember();
    this.colMode.set(mode);
    if (this.recall()) {
      if (mode !== 'groups' && this.editorOpen() === 'col') this.editorOpen.set(null);
      return;
    }
    this.storedBranches.set(null);
    this.colGroups.set(undefined);
    this.figures.set({});
    if (mode === 'groups') void this.seedGroups('col');
    else if (this.editorOpen() === 'col') this.editorOpen.set(null);
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
    const own = this.colMode() === 'groups' ? this.colGroups() : undefined;
    const list = own
      ? own.map((g) => ({ code: g.key, label: this.groupLabel(g) }))
      : this.colMode() === 'groups'
        ? c.groups
        : c.options;
    return this.branches().map((code, i) => ({
      code: i === 0 ? '' : code,
      label: list.find((o) => o.code === code)?.label ?? code,
    }));
  });

  private branches(): string[] {
    const own = this.colMode() === 'groups' ? this.colGroups() : undefined;
    if (own) return own.map((g) => g.key);
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
      const own = this.rowGroups();
      return own ? own.map((g) => ({ code: g.key, label: this.groupLabel(g) })) : f.groups;
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
    const own = this.rowGroups();
    const cols = this.colMode() === 'groups' ? this.colGroups() : undefined;
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
              ...(cols ? { groups: cols } : {}),
            },
          }
        : {}),
    } as TemplateMechanism;
  }

  /** Who sits in which of the method's own groups — by list row id, so products can file them. */
  private async placementsBody(): Promise<
    Record<string, Array<{ valueId: string; code: string; group: string }>>
  > {
    const out: Record<string, Array<{ valueId: string; code: string; group: string }>> = {};
    const grouped: string[] = [];
    if (this.kind() === 'classTable' && this.rowGroups()) grouped.push(this.fact());
    if (this.colMode() === 'groups' && this.colGroups()) grouped.push(this.colFact());
    for (const fact of grouped) {
      await this.ensureList(fact);
      const ids = this.valueIds()[fact] ?? {};
      const placed = this.placements()[fact] ?? {};
      out[fact] = Object.entries(placed)
        .filter(([code]) => ids[code] !== undefined)
        .map(([code, group]) => ({ valueId: ids[code]!, code, group }));
    }
    return out;
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
      nzContent: $localize`:@@rm.confirm_body2:These products get the change from the next quote: ${names}:NAMES:. They keep their own amounts; only new boxes take your default amounts. Offers already issued keep their own figures.`,
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
      placements: await this.placementsBody(),
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
      void this.router.navigate(['/surrogate-methods']);
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
        void this.router.navigate(['/surrogate-methods']);
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
      this.source.set(m.source);
      const mech = m.mechanism;
      if (mech.kind !== 'flatAmount') this.fact.set(mech.fact);
      this.kind.set(mech.kind);
      if (mech.kind === 'classTable' && mech.groups) this.rowGroups.set(mech.groups);
      if (mech.column?.groups) this.colGroups.set(mech.column.groups);
      const placed: Record<string, Record<string, string>> = {};
      for (const [fact, list] of Object.entries(m.placements ?? {})) {
        placed[fact] = Object.fromEntries(list.map((p) => [p.code, p.group]));
      }
      this.placements.set(placed);
      this.colFact.set(mech.column?.fact ?? '');
      this.colMode.set(mech.column?.branchOn === 'parentClass' ? 'groups' : 'answer');
      this.storedBranches.set(mech.column ? [...mech.column.branches] : null);
      this.figures.set(structuredClone(m.figures ?? {}));
    } finally {
      this.loading.set(false);
    }
  }
}
