import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { AuthService } from '@core/auth/auth.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { categoryLabel, isLoanCategory } from '@core/loan-category';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { PRODUCT_BASE, CATALOG_BASE } from '@features/program-catalog/program-catalog.paths';
import {
  QuestionnaireApiService,
  type QuestionFactCandidate,
  type QuestionFactSurface,
  type QuestionType,
  type QuestionUsageClass,
  type QuestionUsageDetail,
  type QuestionUsageReader,
  type QuestionUsageReaderKind,
} from './questionnaire.api.service';

/**
 * The eight things an operator can make a linked question AFFECT.
 *
 * Choosing one stores NOTHING: it only opens the table editor where the bank's figures are
 * typed (a bank programme's card, or a product's plan table), with the figure named on the
 * URL. Storing the choice would be a claim no table carries — the v16.3.0 lesson.
 */
type EffectId =
  | 'rate'
  | 'cap'
  | 'financed_share'
  | 'min_amount'
  | 'min_term'
  | 'max_term'
  | 'extra_income'
  | 'condition';

/** A product plan table (`?plan=`), or `rule` for the product's own calculation. */
type ProductTarget =
  | 'rateByFact'
  | 'maxMonthsByFact'
  | 'minMonthsByFact'
  | 'ltvCeilingByFact'
  | 'minAmountByFact'
  | 'rule';

interface EffectDef {
  id: EffectId;
  title: string;
  hint: string;
  product: ProductTarget | null;
  /** The bank-programme wizard step + card the table lives on. */
  bank: { step: string; card?: string } | null;
}

interface TargetOption {
  value: string;
  label: string;
}

type PendingChoice = 'none' | 'create' | 'existing';
type FailedAction = 'load' | 'link' | 'unlink';

/**
 * Feature 012 — "Use in calculation" on a question, and the "Used by" readout.
 *
 * Three sections: ① the link to a calculation figure (create one from the question, or answer
 * an existing one), ② what it should affect — tiles that only NAVIGATE to the real table
 * editor — and ③ everything that reads it today, classified the way the audit classified it.
 *
 * `deferred` is the new-question page: there is no question yet, so the link choice is HELD
 * and the page calls `commitPending(code)` once the question exists. A failed link leaves the
 * question in place and turns this panel live on it, with the error and a Retry.
 */
@Component({
  selector: 'app-question-calculation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzSelectModule,
    NzToolTipModule,
  ],
  template: `
    <section class="qcalc" aria-labelledby="qcalc-title">
      <header class="qcalc-head">
        <h3 class="qcalc-title" id="qcalc-title" i18n="@@qcalc.title">Use in calculation</h3>
        @if (detail(); as d) {
          <span class="class-badge" [attr.data-class]="d.class">{{ classLabel(d.class) }}</span>
        }
      </header>

      @if (error(); as message) {
        <div class="err" role="alert">
          <span>{{ message }}</span>
          @if (canRetry()) {
            <button
              type="button"
              nz-button
              nzSize="small"
              (click)="retry()"
              [nzLoading]="busy()"
              i18n="@@qcalc.retry"
            >
              Retry
            </button>
          }
        </div>
      }

      <!-- 1 — the link -->
      <div class="part">
        <h4 class="part-title">
          <span class="part-n" aria-hidden="true">1</span>
          <span i18n="@@qcalc.link_h">Does its answer feed a figure?</span>
        </h4>

        @if (!isLive()) {
          @if (pendingType() === 'TEXT') {
            <p class="hint" i18n="@@qcalc.text_no_link">
              A typed-in answer cannot feed a figure. It can still show or hide other questions.
            </p>
          } @else {
            <div class="choices" role="radiogroup" [attr.aria-label]="linkGroupAria">
              <label class="choice">
                <input type="radio" [formControl]="pendingCtrl" value="none" />
                <span class="choice-text">
                  <span class="choice-title" i18n="@@qcalc.pending_none">Not now</span>
                </span>
              </label>
              <label class="choice">
                <input type="radio" [formControl]="pendingCtrl" value="create" />
                <span class="choice-text">
                  <span class="choice-title" i18n="@@qcalc.create"
                    >Create a calculation figure from this question</span
                  >
                  <span class="choice-hint"
                    >{{ keyLabel }} <code dir="ltr">{{ pendingKey() || '—' }}</code></span
                  >
                </span>
              </label>
              <label class="choice">
                <input type="radio" [formControl]="pendingCtrl" value="existing" />
                <span class="choice-text">
                  <span class="choice-title" i18n="@@qcalc.existing"
                    >This answers an existing figure</span
                  >
                </span>
              </label>
            </div>
            @if (pendingValue() === 'existing') {
              <ng-container [ngTemplateOutlet]="candidatePicker" />
            }
            <p class="hint" i18n="@@qcalc.pending_note">
              Nothing is linked until the question is created.
            </p>
          }
        } @else if (loading() && !detail()) {
          <p class="hint" i18n="@@qcalc.loading">Loading…</p>
        } @else {
          @if (detail(); as d) {
            @if (d.factKey) {
              <div class="linked">
                <p class="linked-line">
                  <span i18n="@@qcalc.linked_to">Answers the figure</span>
                  <code dir="ltr">{{ d.factKey }}</code>
                  @if (d.factLocked) {
                    <span class="tag" i18n="@@qcalc.platform_owned">platform</span>
                  }
                </p>
                @if (canWrite()) {
                  <span nz-tooltip [nzTooltipTitle]="unlinkBlockReason(d)" class="unlink-wrap">
                    <button
                      type="button"
                      nz-button
                      nzSize="small"
                      nzDanger
                      [disabled]="unlinkBlockReason(d) !== null || busy()"
                      (click)="confirmUnlink(d)"
                      i18n="@@qcalc.unlink"
                    >
                      Unlink
                    </button>
                  </span>
                }
              </div>
              @if (unlinkBlockReason(d); as why) {
                @if (canWrite()) {
                  <p class="hint">{{ why }}</p>
                }
              }
            } @else if (d.type === 'TEXT') {
              <p class="hint" i18n="@@qcalc.text_no_link">
                A typed-in answer cannot feed a figure. It can still show or hide other questions.
              </p>
            } @else if (!canWrite()) {
              <p class="hint" i18n="@@qcalc.not_linked_ro">Not linked to any figure.</p>
            } @else {
              @if (d.engineInput) {
                <p class="hint" i18n="@@qcalc.engine_note">
                  The engine already reads this answer directly; a figure is only needed for a bank
                  table.
                </p>
              }
              <div class="action-row">
                <div class="action-text">
                  <span class="choice-title" i18n="@@qcalc.create"
                    >Create a calculation figure from this question</span
                  >
                  <span class="choice-hint"
                    >{{ keyLabel }} <code dir="ltr">{{ d.createKey }}</code></span
                  >
                </div>
                <button
                  type="button"
                  nz-button
                  nzType="primary"
                  nzSize="small"
                  [nzLoading]="busy() && lastAction() === 'link'"
                  [disabled]="busy()"
                  (click)="link(null)"
                  i18n="@@qcalc.create_btn"
                >
                  Create figure
                </button>
              </div>
              <div class="action-row">
                <div class="action-text grow">
                  <span class="choice-title" i18n="@@qcalc.existing"
                    >This answers an existing figure</span
                  >
                  <ng-container [ngTemplateOutlet]="candidatePicker" />
                </div>
                <button
                  type="button"
                  nz-button
                  nzSize="small"
                  [disabled]="busy() || !existingValue()"
                  (click)="link(existingValue())"
                  i18n="@@qcalc.link_btn"
                >
                  Link
                </button>
              </div>
            }
          }
        }
      </div>

      <!-- 2 — what it should affect: navigation only -->
      @if (canWrite()) {
        <div class="part">
          <h4 class="part-title">
            <span class="part-n" aria-hidden="true">2</span>
            <span i18n="@@qcalc.affect_h">What should it affect?</span>
          </h4>
          <p class="hint" i18n="@@qcalc.affect_hint">
            Opens the table where the bank's figures are typed. Nothing is saved here.
          </p>
          @if (!linkedKey()) {
            <p class="hint" i18n="@@qcalc.affect_locked">Link it to a figure first.</p>
          }
          @if (isLive()) {
            <div class="tiles">
              @for (e of effects; track e.id) {
                <button
                  type="button"
                  class="tile"
                  [class.is-on]="openEffect() === e.id"
                  [attr.aria-pressed]="openEffect() === e.id"
                  [disabled]="effectBlock(e) !== null"
                  [attr.title]="effectBlock(e)"
                  (click)="toggleEffect(e)"
                >
                  <span class="tile-title">{{ e.title }}</span>
                  <span class="tile-hint">{{ e.hint }}</span>
                </button>
              }
            </div>
          }
          @if (openEffectDef(); as e) {
            <div class="picker">
              <label class="field" for="qcalc-target">
                <span class="field-label" i18n="@@qcalc.target_label"
                  >Where are its figures typed?</span
                >
                <nz-select
                  nzId="qcalc-target"
                  nzShowSearch
                  [nzLoading]="targetsLoading()"
                  [formControl]="targetCtrl"
                  nzPlaceHolder="Pick a programme or product"
                  i18n-nzPlaceHolder="@@qcalc.target_ph"
                >
                  @if (e.product !== null && productOptions().length > 0) {
                    <nz-option-group [nzLabel]="productsGroupLabel">
                      @for (o of productOptions(); track o.value) {
                        <nz-option [nzValue]="o.value" [nzLabel]="o.label" />
                      }
                    </nz-option-group>
                  }
                  @if (e.bank !== null && programOptions().length > 0) {
                    <nz-option-group [nzLabel]="programsGroupLabel">
                      @for (o of programOptions(); track o.value) {
                        <nz-option [nzValue]="o.value" [nzLabel]="o.label" />
                      }
                    </nz-option-group>
                  }
                </nz-select>
              </label>
              <button
                type="button"
                nz-button
                nzType="primary"
                [disabled]="!targetValue()"
                (click)="openTarget(e)"
                i18n="@@qcalc.open_btn"
              >
                Open the table
              </button>
            </div>
          }
        </div>
      }

      <!-- 3 — used by -->
      @if (detail(); as d) {
        <div class="part">
          <h4 class="part-title">
            <span class="part-n" aria-hidden="true">3</span>
            <span i18n="@@qusage.title">Used by</span>
          </h4>

          @if (d.blankRefuses.length > 0) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              [nzMessage]="blankRefusesTitle(d.blankRefuses.length)"
              [nzDescription]="d.blankRefuses.join(' · ')"
            />
          }

          <p class="hint">{{ classHint(d.class) }}</p>

          @for (g of readerGroups(); track g.kind) {
            <div class="group">
              <p class="group-title">{{ kindLabel(g.kind) }} · {{ g.readers.length }}</p>
              <ul class="readers" role="list">
                @for (r of g.readers; track r.ref) {
                  <li class="reader">
                    <span class="reader-main">
                      @if (readerLink(r); as link) {
                        <a [routerLink]="link" class="reader-name">{{ readerName(r) }}</a>
                      } @else {
                        <span class="reader-name">{{ readerName(r) }}</span>
                      }
                      @if (r.bankName) {
                        <span class="reader-meta">{{ r.bankName }}</span>
                      }
                      @if (r.category) {
                        <span class="reader-meta">{{ catLabel(r.category) }}</span>
                      }
                      @if (r.inherited) {
                        <span class="tag" i18n="@@qusage.inherited">from its product</span>
                      }
                      @if (r.refusesWhenUnanswered) {
                        <span class="tag warn" i18n="@@qusage.refuses_blank">blank refuses</span>
                      }
                    </span>
                    <span class="surfaces">
                      @for (s of r.surfaces; track s) {
                        <span class="surface">{{ surfaceLabel(s) }}</span>
                      }
                    </span>
                  </li>
                }
              </ul>
            </div>
          }

          @if (d.askedByProducts.length > 0) {
            <p class="line">
              <span class="line-k" i18n="@@qusage.asked_by">Asked by products</span>
              <span>{{ d.askedByProducts.join(' · ') }}</span>
            </p>
          }
          @if (d.gates.length > 0) {
            <p class="line">
              <span class="line-k" i18n="@@qusage.gates">Shows or hides</span>
              <span dir="ltr">{{ d.gates.join(' · ') }}</span>
            </p>
          }
        </div>
      }
    </section>

    <ng-template #candidatePicker>
      <nz-select
        class="cand"
        nzShowSearch
        nzAllowClear
        [nzLoading]="candidatesLoading()"
        [formControl]="existingCtrl"
        nzPlaceHolder="Pick a figure"
        i18n-nzPlaceHolder="@@qcalc.existing_ph"
        [attr.aria-label]="existingAria"
      >
        @for (c of candidateList(); track c.factKey) {
          <nz-option
            [nzValue]="c.factKey"
            [nzLabel]="candidateLabel(c)"
            [nzDisabled]="candidateMismatch(c)"
          />
        }
      </nz-select>
      @if (!candidatesLoading() && candidateList().length === 0) {
        <span class="choice-hint" i18n="@@qcalc.no_candidates"
          >No unlinked figure is waiting for a question.</span
        >
      }
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .qcalc {
        display: grid;
        gap: var(--space-4);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        min-inline-size: 0;
      }
      .qcalc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .qcalc-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .class-badge {
        display: inline-flex;
        align-items: center;
        padding-block: var(--space-0-5);
        padding-inline: var(--space-2);
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .class-badge[data-class='engine'],
      .class-badge[data-class='calculation'] {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .class-badge[data-class='linked_unread'] {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .class-badge[data-class='gate_only'] {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .part {
        display: grid;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .part + .part {
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .part-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .part-n {
        display: inline-grid;
        place-items: center;
        inline-size: var(--space-5);
        block-size: var(--space-5);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-tertiary);
        max-inline-size: 62ch;
      }
      code {
        font-size: var(--text-xs);
        padding-inline: var(--space-1);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .choices {
        display: grid;
        gap: var(--space-2);
      }
      .choice {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        cursor: pointer;
      }
      .choice input {
        margin-block-start: var(--space-1);
        accent-color: var(--color-brand-primary);
      }
      .choice input:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .choice-text {
        display: grid;
        gap: var(--space-0-5);
      }
      .choice-title {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .choice-hint {
        display: block;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .cand {
        inline-size: 100%;
        max-inline-size: 28rem;
        margin-block-start: var(--space-1);
      }
      .action-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        flex-wrap: wrap;
      }
      .action-text {
        display: grid;
        gap: var(--space-0-5);
        min-inline-size: 0;
      }
      .action-text.grow {
        flex: 1 1 16rem;
      }
      .linked {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .linked-line {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        flex-wrap: wrap;
      }
      .unlink-wrap {
        display: inline-flex;
      }
      .tag {
        display: inline-flex;
        padding-inline: var(--space-1-5);
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .tag.warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
        gap: var(--space-2);
      }
      .tile {
        display: grid;
        gap: var(--space-0-5);
        text-align: start;
        padding: var(--space-2-5) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tile:hover:not(:disabled) {
        border-color: var(--color-border-strong);
      }
      .tile:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .tile.is-on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
      }
      .tile:disabled {
        cursor: not-allowed;
        color: var(--color-text-disabled);
        background: var(--color-surface-muted);
      }
      .tile-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      .tile-hint {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .tile:disabled .tile-hint {
        color: var(--color-text-disabled);
      }
      .picker {
        display: flex;
        align-items: flex-end;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .field {
        display: grid;
        gap: var(--space-1);
        flex: 1 1 18rem;
        min-inline-size: 0;
      }
      .field-label {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
      }
      .group {
        display: grid;
        gap: var(--space-1);
      }
      .group-title {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }
      .readers {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-1);
      }
      .reader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-2);
        padding-block: var(--space-1-5);
        padding-inline: var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
        flex-wrap: wrap;
      }
      .reader-main {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        min-inline-size: 0;
      }
      .reader-name {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      a.reader-name {
        color: var(--color-text-link);
      }
      a.reader-name:hover {
        color: var(--color-text-link-hover);
      }
      a.reader-name:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .reader-meta {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .surfaces {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .surface {
        font-size: var(--text-xs);
        padding-inline: var(--space-1-5);
        border-radius: var(--radius-pill);
        border: 1px solid var(--color-border-default);
        color: var(--color-text-secondary);
      }
      .line {
        display: flex;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        flex-wrap: wrap;
      }
      .line-k {
        font-weight: var(--font-weight-semibold);
      }
      .err {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
        flex-wrap: wrap;
      }
    `,
  ],
})
export class QuestionCalculationComponent {
  private readonly api = inject(QuestionnaireApiService);
  private readonly programsApi = inject(BankProgramsApiService);
  private readonly auth = inject(AuthService);
  private readonly errors = inject(ErrorCodeService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** The question this panel reads and links. `null` with `deferred` = not created yet. */
  readonly questionCode = input<string | null>(null);
  /** The new-question page: hold the link choice until the question exists. */
  readonly deferred = input(false);
  /** Deferred only — the code the question WILL get, which is also the figure key. */
  readonly pendingKey = input('');
  /** Deferred only — the type picked on the form, for the type rules. */
  readonly pendingType = input<QuestionType | null>(null);

  /** After every successful link / unlink — the editor refreshes its row chip from it. */
  readonly changed = output<QuestionUsageDetail>();

  protected readonly canWrite = computed(() => this.auth.role() === 'super_admin');

  private readonly adoptedCode = signal<string | null>(null);
  private readonly code = computed(() => this.questionCode() ?? this.adoptedCode());
  protected readonly isLive = computed(() => this.code() !== null);

  protected readonly detail = signal<QuestionUsageDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly lastAction = signal<FailedAction | null>(null);
  private lastLinkKey: string | null = null;
  private adoptingCode: string | null = null;
  /** Each request takes a ticket; only the latest one may write the state. */
  private seq = 0;

  protected readonly pendingCtrl = new FormControl<PendingChoice>('none', { nonNullable: true });
  protected readonly pendingValue = toSignal(this.pendingCtrl.valueChanges, {
    initialValue: 'none' as PendingChoice,
  });
  protected readonly existingCtrl = new FormControl<string | null>(null);
  protected readonly existingValue = toSignal(this.existingCtrl.valueChanges, {
    initialValue: null,
  });
  protected readonly targetCtrl = new FormControl<string | null>(null);
  protected readonly targetValue = toSignal(this.targetCtrl.valueChanges, { initialValue: null });

  /** Deferred mode has no question to ask for candidates; they are read once, on demand. */
  private readonly deferredCandidates = signal<QuestionFactCandidate[] | null>(null);
  protected readonly candidatesLoading = signal(false);
  protected readonly candidateList = computed<QuestionFactCandidate[]>(
    () => this.detail()?.candidates ?? this.deferredCandidates() ?? [],
  );

  protected readonly linkGroupAria = $localize`:@@qcalc.link_h:Does its answer feed a figure?`;
  protected readonly keyLabel = $localize`:@@qcalc.key_label:Figure key:`;
  protected readonly existingAria = $localize`:@@qcalc.existing:This answers an existing figure`;
  protected readonly productsGroupLabel = $localize`:@@qcalc.group_products:No-payslip products`;
  protected readonly programsGroupLabel = $localize`:@@qcalc.group_programs:Bank programmes`;

  protected readonly effects: readonly EffectDef[] = [
    {
      id: 'rate',
      title: $localize`:@@qcalc.eff_rate:Rate table`,
      hint: $localize`:@@qcalc.eff_rate_hint:A rate per answer`,
      product: 'rateByFact',
      bank: { step: 'money', card: 'card-pricing' },
    },
    {
      id: 'cap',
      title: $localize`:@@qcalc.eff_cap:Loan cap`,
      hint: $localize`:@@qcalc.eff_cap_hint:The most it lends per answer`,
      product: null,
      bank: { step: 'money', card: 'card-amount' },
    },
    {
      id: 'financed_share',
      title: $localize`:@@qcalc.eff_ltv:Financed share`,
      hint: $localize`:@@qcalc.eff_ltv_hint:Share of the price financed`,
      product: 'ltvCeilingByFact',
      bank: null,
    },
    {
      id: 'min_amount',
      title: $localize`:@@qcalc.eff_floor:Smallest loan`,
      hint: $localize`:@@qcalc.eff_floor_hint:The least it lends per answer`,
      product: 'minAmountByFact',
      bank: null,
    },
    {
      id: 'min_term',
      title: $localize`:@@qcalc.eff_min_term:Shortest term`,
      hint: $localize`:@@qcalc.eff_min_term_hint:Fewest months per answer`,
      product: 'minMonthsByFact',
      bank: null,
    },
    {
      id: 'max_term',
      title: $localize`:@@qcalc.eff_max_term:Longest term`,
      hint: $localize`:@@qcalc.eff_max_term_hint:Most months per answer`,
      product: 'maxMonthsByFact',
      bank: { step: 'money', card: 'card-tenor' },
    },
    {
      id: 'extra_income',
      title: $localize`:@@qcalc.eff_extra:Extra income`,
      hint: $localize`:@@qcalc.eff_extra_hint:Money added to the income`,
      product: null,
      bank: { step: 'calculation' },
    },
    {
      id: 'condition',
      title: $localize`:@@qcalc.eff_rule:Condition / income rule`,
      hint: $localize`:@@qcalc.eff_rule_hint:How a product works the income out`,
      product: 'rule',
      bank: null,
    },
  ];

  protected readonly openEffect = signal<EffectId | null>(null);
  protected readonly openEffectDef = computed(
    () => this.effects.find((e) => e.id === this.openEffect()) ?? null,
  );
  protected readonly targetsLoading = signal(false);
  private readonly programs = signal<TargetOption[] | null>(null);
  private readonly products = signal<TargetOption[] | null>(null);
  protected readonly programOptions = computed(() => this.programs() ?? []);
  protected readonly productOptions = computed(() => this.products() ?? []);

  protected readonly linkedKey = computed(() => this.detail()?.factKey ?? null);
  private readonly effectiveType = computed<string | null>(
    () => this.detail()?.type ?? this.pendingType(),
  );

  protected readonly readerGroups = computed(() => {
    const readers = this.detail()?.readers ?? [];
    const order: QuestionUsageReaderKind[] = [
      'program',
      'product_rule',
      'program_name_rule',
      'platform_iscore',
    ];
    return order
      .map((kind) => ({ kind, readers: readers.filter((r) => r.kind === kind) }))
      .filter((g) => g.readers.length > 0);
  });

  protected readonly canRetry = computed(() => this.lastAction() !== null && this.code() !== null);

  constructor() {
    effect(
      () => {
        const code = this.code();
        untracked(() => {
          // `commitPending` adopted this code and is writing it right now — a read racing
          // that write could land second and show the state from before the link.
          if (code !== null && code === this.adoptingCode) {
            this.adoptingCode = null;
            return;
          }
          this.error.set(null);
          this.lastAction.set(null);
          this.openEffect.set(null);
          this.existingCtrl.setValue(null);
          if (code === null) {
            this.detail.set(null);
            return;
          }
          void this.load(code);
        });
      },
      { allowSignalWrites: true },
    );
    // The figures an existing-figure pick may name, read only when that choice is made.
    this.pendingCtrl.valueChanges.subscribe((v) => {
      if (v === 'existing') void this.loadDeferredCandidates();
    });
  }

  // ---- public, for the new-question page -----------------------------------
  /** True when the deferred panel holds a link the page must carry out after creating. */
  hasPendingLink(): boolean {
    const v = this.pendingCtrl.value;
    return v === 'create' || (v === 'existing' && this.existingCtrl.value !== null);
  }

  /**
   * The question now exists: become live on it and carry out the held choice. Resolves
   * `false` when the link failed — the panel then shows why, with a Retry, and the question
   * stays created.
   */
  async commitPending(code: string): Promise<boolean> {
    const choice = this.pendingCtrl.value;
    const key = this.existingCtrl.value;
    const factKey = choice === 'create' ? null : choice === 'existing' ? key : undefined;
    if (factKey === undefined || (choice === 'existing' && key === null)) {
      this.adoptedCode.set(code);
      return true;
    }
    this.adoptingCode = code;
    this.adoptedCode.set(code);
    return this.runLink(code, factKey);
  }

  // ---- 1 -------------------------------------------------------------------
  protected link(factKey: string | null): void {
    const code = this.code();
    if (code === null) return;
    void this.runLink(code, factKey);
  }

  protected unlinkBlockReason(d: QuestionUsageDetail): string | null {
    if (d.factLocked) {
      return $localize`:@@qcalc.unlink_locked:The platform owns this figure, so it cannot be unlinked here.`;
    }
    const n = d.readers.length + d.askedByProducts.length;
    if (n > 0) {
      return $localize`:@@qcalc.unlink_read:Still read in ${n}:count: place(s). Remove those tables or asks first.`;
    }
    return null;
  }

  protected confirmUnlink(d: QuestionUsageDetail): void {
    const code = this.code();
    if (code === null || d.factKey === null) return;
    const key = d.factKey;
    this.modal.confirm({
      nzTitle: $localize`:@@qcalc.unlink_title:Unlink this question from “${key}:key:”?`,
      nzContent: $localize`:@@qcalc.unlink_body:A figure this question created is deleted with the link. Bank tables can no longer be keyed by its answer until it is linked again.`,
      nzOkText: $localize`:@@qcalc.unlink_ok:Unlink`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qcalc.unlink_cancel:Keep it`,
      nzOnOk: () => {
        void this.runUnlink(code);
        return true;
      },
    });
  }

  protected retry(): void {
    const code = this.code();
    if (code === null) return;
    switch (this.lastAction()) {
      case 'link':
        void this.runLink(code, this.lastLinkKey);
        break;
      case 'unlink':
        void this.runUnlink(code);
        break;
      case 'load':
        void this.load(code);
        break;
      default:
        break;
    }
  }

  protected candidateLabel(c: QuestionFactCandidate): string {
    const label = this.isAr ? c.labelAr : c.labelEn;
    const base = label && label !== c.factKey ? `${label} (${c.factKey})` : c.factKey;
    if (this.candidateMismatch(c)) {
      return $localize`:@@qcalc.cand_mismatch:${base}:figure: — read by a different kind of answer`;
    }
    if (c.readerCount > 0) {
      return $localize`:@@qcalc.cand_read:${base}:figure: — read by ${c.readerCount}:count:`;
    }
    return base;
  }

  /** The server refuses these anyway (SURROGATE_FACT_SHAPE_MISMATCH); say so before. */
  protected candidateMismatch(c: QuestionFactCandidate): boolean {
    const type = this.effectiveType();
    if (type === null) return false;
    if (c.shape === 'number') return type !== 'NUMERIC';
    if (c.shape === 'choice') return type === 'NUMERIC' || type === 'TEXT';
    return false;
  }

  // ---- 2 -------------------------------------------------------------------
  protected effectBlock(e: EffectDef): string | null {
    if (this.linkedKey() === null) {
      return $localize`:@@qcalc.affect_locked:Link it to a figure first.`;
    }
    const type = this.effectiveType();
    if (type === 'TEXT' && e.id !== 'condition') {
      return $localize`:@@qcalc.eff_text_only:A typed-in answer can only be a condition.`;
    }
    if (e.id === 'extra_income' && type !== 'NUMERIC') {
      return $localize`:@@qcalc.eff_numeric_only:Only a number answer can be added to the income.`;
    }
    return null;
  }

  protected toggleEffect(e: EffectDef): void {
    if (this.effectBlock(e) !== null) return;
    this.targetCtrl.setValue(null);
    this.openEffect.set(this.openEffect() === e.id ? null : e.id);
    if (this.openEffect() !== null) void this.loadTargets();
  }

  protected openTarget(e: EffectDef): void {
    const target = this.targetCtrl.value;
    const axis = this.linkedKey();
    if (target === null || axis === null) return;
    const [kind, ref] = [target.slice(0, 2), target.slice(2)];
    if (kind === 'p:' && e.bank !== null) {
      void this.router.navigate(['/banks/programs', ref, 'edit'], {
        queryParams: { step: e.bank.step, card: e.bank.card ?? null, axis },
      });
    } else if (kind === 's:' && e.product !== null) {
      void this.router.navigate([PRODUCT_BASE, ref], {
        queryParams: { step: 2, plan: e.product === 'rule' ? null : e.product, axis },
      });
    }
  }

  // ---- 3 -------------------------------------------------------------------
  protected classLabel(c: QuestionUsageClass): string {
    switch (c) {
      case 'engine':
        return $localize`:@@qusage.class_engine:Engine input`;
      case 'calculation':
        return $localize`:@@qusage.class_calculation:Used in calculation`;
      case 'linked_unread':
        return $localize`:@@qusage.class_linked_unread:Linked, nothing reads it`;
      case 'gate_only':
        return $localize`:@@qusage.class_gate_only:Only shows or hides questions`;
      case 'none':
        return $localize`:@@qusage.class_none:Affects no figure`;
    }
  }

  protected classHint(c: QuestionUsageClass): string {
    switch (c) {
      case 'engine':
        return $localize`:@@qusage.hint_engine:The engine reads this answer directly — the amount, debts, employment and the like.`;
      case 'calculation':
        return $localize`:@@qusage.hint_calculation:Its figure is read by the tables below.`;
      case 'linked_unread':
        return $localize`:@@qusage.hint_linked_unread:It answers a figure, but no table reads that figure yet.`;
      case 'gate_only':
        return $localize`:@@qusage.hint_gate_only:Its answer only decides whether other questions are asked.`;
      case 'none':
        return $localize`:@@qusage.hint_none:Its answer changes no figure and hides no question.`;
    }
  }

  protected blankRefusesTitle(n: number): string {
    return $localize`:@@qusage.blank_refuses:Leaving this blank refuses the quote on ${n}:count: programme(s)`;
  }

  protected kindLabel(k: QuestionUsageReaderKind): string {
    switch (k) {
      case 'program':
        return $localize`:@@qusage.kind_program:Bank programmes`;
      case 'product_rule':
        return $localize`:@@qusage.kind_product:No-payslip products`;
      case 'program_name_rule':
        return $localize`:@@qusage.kind_name:Program names`;
      case 'platform_iscore':
        return $localize`:@@qusage.kind_iscore:Platform I-Score table`;
    }
  }

  protected surfaceLabel(s: QuestionFactSurface): string {
    switch (s) {
      case 'income_rule':
        return $localize`:@@qusage.s_income_rule:Income rule`;
      case 'additional_income':
        return $localize`:@@qusage.s_additional_income:Extra income`;
      case 'cap':
        return $localize`:@@qusage.s_cap:Loan cap`;
      case 'cap_adjustment':
        return $localize`:@@qusage.s_cap_adjustment:Cap adjustment`;
      case 'financed_share':
        return $localize`:@@qusage.s_financed_share:Financed share`;
      case 'min_amount':
        return $localize`:@@qusage.s_min_amount:Smallest loan`;
      case 'rate_grid':
        return $localize`:@@qusage.s_rate_grid:Rate table`;
      case 'max_term':
        return $localize`:@@qusage.s_max_term:Longest term`;
      case 'min_term':
        return $localize`:@@qusage.s_min_term:Shortest term`;
      case 'vehicle_age':
        return $localize`:@@qusage.s_vehicle_age:Car age limit`;
      case 'car_cover':
        return $localize`:@@qusage.s_car_cover:Car insurance`;
    }
  }

  protected readerName(r: QuestionUsageReader): string {
    return r.programName ?? r.ref;
  }

  protected readerLink(r: QuestionUsageReader): string[] | null {
    switch (r.kind) {
      case 'program':
        return ['/banks/programs', r.ref];
      case 'product_rule':
        return [PRODUCT_BASE, r.ref];
      case 'program_name_rule':
        return [CATALOG_BASE, r.ref];
      default:
        return null;
    }
  }

  protected catLabel(c: string): string {
    return isLoanCategory(c) ? categoryLabel(c) : c;
  }

  // ---- I/O -----------------------------------------------------------------
  private async load(code: string): Promise<void> {
    const ticket = ++this.seq;
    this.loading.set(true);
    try {
      const d = await this.api.questionUsageDetail(code);
      if (ticket !== this.seq) return;
      this.detail.set(d);
    } catch (err) {
      if (ticket !== this.seq) return;
      this.fail(err, 'load');
    } finally {
      if (ticket === this.seq) this.loading.set(false);
    }
  }

  private async runLink(code: string, factKey: string | null): Promise<boolean> {
    const ticket = ++this.seq;
    this.busy.set(true);
    this.error.set(null);
    this.lastAction.set(null);
    this.lastLinkKey = factKey;
    try {
      const res = await this.api.linkQuestionFact(code, factKey, { silent: true });
      if (ticket === this.seq) this.detail.set(res.state);
      this.existingCtrl.setValue(null);
      this.changed.emit(res.state);
      return true;
    } catch (err) {
      if (ticket === this.seq) {
        this.fail(err, 'link');
        // The question may exist even though the link failed — show what it is now.
        void this.refreshQuietly(code);
      }
      return false;
    } finally {
      this.busy.set(false);
      this.loading.set(false);
    }
  }

  private async runUnlink(code: string): Promise<void> {
    const ticket = ++this.seq;
    this.busy.set(true);
    this.error.set(null);
    this.lastAction.set(null);
    try {
      const res = await this.api.unlinkQuestionFact(code, { silent: true });
      if (ticket === this.seq) this.detail.set(res.state);
      this.openEffect.set(null);
      this.changed.emit(res.state);
    } catch (err) {
      if (ticket === this.seq) this.fail(err, 'unlink');
    } finally {
      this.busy.set(false);
    }
  }

  /** A read after a failed write, which must not wipe the write's error. */
  private async refreshQuietly(code: string): Promise<void> {
    if (this.detail()?.questionCode === code) return;
    try {
      const d = await this.api.questionUsageDetail(code);
      if (this.code() === code) this.detail.set(d);
    } catch {
      // The write's error is already on screen; a failed read adds nothing to it.
    }
  }

  /**
   * Candidates are the same for every question (unbound, unreserved figures), but the
   * endpoint that lists them is per question. With no question yet, any active one answers
   * for it — read once, on demand.
   */
  private async loadDeferredCandidates(): Promise<void> {
    if (this.deferredCandidates() !== null || this.candidatesLoading()) return;
    this.candidatesLoading.set(true);
    try {
      const all = await this.api.questionUsage();
      const first = all[0];
      if (first === undefined) {
        this.deferredCandidates.set([]);
        return;
      }
      const d = await this.api.questionUsageDetail(first.questionCode);
      this.deferredCandidates.set(d.candidates);
    } catch {
      this.deferredCandidates.set([]);
    } finally {
      this.candidatesLoading.set(false);
    }
  }

  private async loadTargets(): Promise<void> {
    if (this.programs() !== null && this.products() !== null) return;
    this.targetsLoading.set(true);
    try {
      const cats = new Set<string>(this.detail()?.categories ?? []);
      const rows: {
        programCode: string;
        friendlyName: string;
        bankName: string;
        productCategory: string;
      }[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await this.programsApi.list({ page, pageSize: 100, active: true });
        rows.push(...res.data);
        if (rows.length >= res.pagination.total || res.data.length === 0) break;
      }
      this.programs.set(
        rows
          .filter((r) => cats.size === 0 || cats.has(r.productCategory))
          .sort((a, b) =>
            `${a.bankName} ${a.friendlyName}`.localeCompare(`${b.bankName} ${b.friendlyName}`),
          )
          .map((r) => ({
            value: `p:${r.programCode}`,
            label: `${r.bankName} — ${r.friendlyName} (${this.catLabel(r.productCategory)})`,
          })),
      );
      const products = (await this.programsApi.listSurrogateProducts()).data;
      this.products.set(
        products
          .filter((p) => p.active)
          .map((p) => ({ value: `s:${p.key}`, label: this.isAr ? p.labelAr : p.labelEn }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
    } catch {
      // The toast interceptor said why; the picker stays empty.
      if (this.programs() === null) this.programs.set([]);
      if (this.products() === null) this.products.set([]);
    } finally {
      this.targetsLoading.set(false);
    }
  }

  private fail(err: unknown, action: FailedAction): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })?.error;
    this.error.set(
      this.errors.toLocalizedMessage(
        (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
        envelope?.meta,
      ),
    );
    this.lastAction.set(action);
  }
}
