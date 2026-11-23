/**
 * Step 1 of the no-payslip product wizard — "Name" (v33.3.0), as a full page.
 *
 * It replaced the New product side sheet: creating a product used to open a sheet and THEN a
 * page, two surfaces for one job. Now the wizard is one flow — this page shows the whole rail
 * with only its first step open, and "Create and continue" creates the product (OFF) and moves
 * on to "Questions" on the product's own page, which carries the rest of the steps.
 *
 * It wears that page's frame (`PRODUCT_FLOW_STYLES`): the same header, step rail, blocks,
 * buttons and footer, so pressing Create changes what is on the page and not the page itself.
 *
 * The product has to exist before step 2: every later step saves against its key (the
 * questions it reads, its calculation, its figures). So this step is the one write that
 * happens on Next; everything after it is held until the product page's one Save.
 *
 * Two starts, because each one is a different amount of work afterwards:
 *   Blank — nothing but the name.
 *   Copy  — an existing product's questions, calculation, figures and defaults
 *           (what "Duplicate" opens, via `?copy=`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ArrowRightOutline, CopyOutline, FileAddOutline } from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import type { SurrogateProductSummary } from '../bank-programs/bank-programs.types';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';
import { FIRST_BUILD_STEP_PARAM, productStepLabels } from './product-steps';
import { PRODUCT_FLOW_STYLES } from './product-flow.styles';
import { WizardStepsComponent, type WizardStepItem } from '@shared/ui';

type Start = 'blank' | 'copy';
import { LoanTypePickerComponent } from './loan-type-picker.component';
import type { LoanCategory } from '@core/loan-category';

@Component({
  selector: 'app-new-product-page',
  standalone: true,
  imports: [
    LoanTypePickerComponent,
    ReactiveFormsModule,
    RouterLink,
    NzSelectModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    WizardStepsComponent,
  ],
  providers: [provideNzIconsPatch([ArrowRightOutline, CopyOutline, FileAddOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flow-page">
      <a class="back" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
        <svg class="back-i" viewBox="64 64 896 896" fill="currentColor" aria-hidden="true">
          <path
            d="M872 474H286.9l350.2-304c5.6-4.9 2.2-14-5.2-14h-88.5c-3.9 0-7.6 1.4-10.5 3.9L155 487.8a31.96 31.96 0 000 48.3L535.1 866c1.5 1.3 3.3 2 5.2 2h91.5c7.4 0 10.8-9.2 5.2-14L286.9 550H872c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z"
          />
        </svg>
        <span i18n="@@spd.back">All surrogate products</span>
      </a>

      <header class="ph">
        <div class="ph-names">
          <h1>{{ title }}</h1>
          <p class="lede">{{ subtitle }}</p>
        </div>
      </header>

      <!-- The whole road, so the operator sees where this goes. Only this step is open:
           the rest save against a product that does not exist until Create. -->
      <app-wizard-steps
        [steps]="wizardSteps"
        [activeIndex]="0"
        [ariaLabel]="stepsAria"
        [caption]="lockedCaption"
      />

      <form [formGroup]="form" (ngSubmit)="submit()" class="body" novalidate>
        <section class="blk" aria-labelledby="np-called">
          <h2 id="np-called" i18n="@@ps.called">What is it called?</h2>
          <div class="names">
            <nz-form-item>
              <nz-form-label nzFor="np-name-en" nzRequired i18n="@@ps.name_en"
                >Name in English</nz-form-label
              >
              <nz-form-control [nzErrorTip]="nameErr">
                <input
                  nz-input
                  id="np-name-en"
                  formControlName="labelEn"
                  dir="ltr"
                  autocomplete="off"
                />
                <ng-template #nameErr>
                  @if (form.controls.labelEn.hasError('duplicate')) {
                    <span i18n="@@pform.name_taken"
                      >A product with this name already exists. Pick another name.</span
                    >
                  } @else {
                    <span i18n="@@pform.name_required">Enter a name.</span>
                  }
                </ng-template>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="np-name-ar" nzRequired i18n="@@ps.name_ar"
                >Name in Arabic</nz-form-label
              >
              <nz-form-control [nzErrorTip]="nameArErr">
                <input
                  nz-input
                  id="np-name-ar"
                  formControlName="labelAr"
                  dir="rtl"
                  autocomplete="off"
                />
                <ng-template #nameArErr>
                  <span i18n="@@pform.name_required">Enter a name.</span>
                </ng-template>
              </nz-form-control>
            </nz-form-item>
          </div>
        </section>

        <section class="blk" aria-labelledby="np-loan-type">
          <h2 id="np-loan-type" i18n="@@np.loan_type_title">What loan is it for?</h2>
          <app-loan-type-picker
            name="np-loan-type"
            labelledBy="np-loan-type"
            [value]="loanType() ?? picked()?.loanCategory ?? null"
            (valueChange)="pickLoanType($event)"
          />
          @if (loanTypeMissing()) {
            <p class="lt-err" role="alert" i18n="@@np.loan_type_required">Choose the loan type.</p>
          } @else {
            <p class="lt-hint" i18n="@@np.loan_type_hint">
              Where the catalog lists it. Auto products also set the money most banks lend on.
            </p>
          }
        </section>

        <section class="blk" aria-labelledby="np-start">
          <h2 id="np-start" i18n="@@np.start_title">How do you want to start?</h2>

          <!-- Native radios under the cards: arrow keys move between them for free. -->
          <div class="starts" role="radiogroup" aria-labelledby="np-start">
            @for (s of starts; track s.key) {
              <label class="start" [class.is-on]="start() === s.key">
                <input
                  type="radio"
                  class="start-input"
                  name="np-start"
                  [value]="s.key"
                  [checked]="start() === s.key"
                  (change)="pickStart(s.key)"
                />
                <span class="start-icon" aria-hidden="true">
                  <span nz-icon [nzType]="s.icon" nzTheme="outline"></span>
                </span>
                <span class="start-text">
                  <span class="start-name">{{ s.name }}</span>
                  <span class="start-note">{{ s.note }}</span>
                </span>
                <span class="dot" aria-hidden="true"></span>
              </label>
            }
          </div>

          @if (start() === 'copy') {
            <div class="copy">
              <nz-form-item class="copy-pick">
                <nz-form-label nzFor="np-copy" nzRequired i18n="@@np.which_product"
                  >Which product?</nz-form-label
                >
                <nz-form-control [nzErrorTip]="copyErr">
                  <nz-select
                    nzId="np-copy"
                    nzShowSearch
                    [nzPlaceHolder]="pickPlaceholder"
                    [nzLoading]="loadingLists()"
                    formControlName="copyKey"
                  >
                    @for (p of sortedProducts(); track p.key) {
                      <nz-option [nzValue]="p.key" [nzLabel]="productName(p)" />
                    }
                  </nz-select>
                  <ng-template #copyErr>
                    <span i18n="@@np.copy_required">Choose the product to copy.</span>
                  </ng-template>
                </nz-form-control>
              </nz-form-item>

              <!-- What the copy brings, so the pick is checked before it is made. -->
              @if (picked(); as p) {
                <dl class="facts">
                  <div>
                    <dt i18n="@@np.f_works">Works out</dt>
                    <dd>
                      @switch (p.outputKind) {
                        @case ('monthlyIncome') {
                          <span i18n="@@ps.means_income">Monthly income</span>
                        }
                        @case ('maxAmount') {
                          <span i18n="@@ps.means_limit">Maximum loan</span>
                        }
                        @default {
                          <span i18n="@@np.f_nothing">Nothing yet</span>
                        }
                      }
                    </dd>
                  </div>
                  <div>
                    <dt i18n="@@np.f_status">Status now</dt>
                    <dd>
                      @if (p.active) {
                        <span class="pill live" i18n="@@ps.live">Live</span>
                      } @else {
                        <span class="pill" i18n="@@ps.draft">Draft</span>
                      }
                    </dd>
                  </div>
                  <div>
                    <dt i18n="@@np.f_sold">Programs selling it</dt>
                    <dd class="num-v">{{ p.usedBy.length }}</dd>
                  </div>
                </dl>
                <p class="note" i18n="@@np.copy_note">
                  The copy is its own product: changing it later leaves this one as it is.
                </p>
              }
            </div>
          }
        </section>
      </form>

      <div class="foot">
        <a class="btn" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
          <span i18n="@@np.cancel">Cancel</span>
        </a>
        <div class="foot-end">
          <p class="foot-hint" i18n="@@np.hint3">
            It is created switched off. Nothing reaches a customer until you press Go live.
          </p>
          <button
            type="button"
            class="btn primary"
            [disabled]="saving()"
            [attr.aria-busy]="saving()"
            (click)="submit()"
          >
            @if (saving()) {
              <span i18n="@@np.creating">Creating…</span>
            } @else {
              <span i18n="@@np.next">Create and continue</span>
              <span
                class="next-i"
                nz-icon
                nzType="arrow-right"
                nzTheme="outline"
                aria-hidden="true"
              ></span>
            }
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    PRODUCT_FLOW_STYLES,
    `
      :host {
        display: block;
      }
      /* The product page's own frame (full width, same rhythm): step 2 must not jump. */
      .flow-page {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block: var(--space-4) var(--space-8);
      }
      .lede {
        margin: var(--space-1) 0 0;
        max-inline-size: 60ch;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .names {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
        gap: 0 var(--space-4);
        inline-size: 100%;
      }
      .names nz-form-item {
        margin-block-end: 0;
      }

      /* --- How to start ------------------------------------------------------ */
      .starts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
        gap: var(--space-3);
        inline-size: 100%;
      }
      .start {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: start;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .start:hover {
        border-color: var(--color-border-strong);
      }
      .start.is-on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
      }
      .start:has(.start-input:focus-visible) {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* The radio itself is the dot drawn below; it stays in the tab order and the a11y tree. */
      .start-input {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .start-icon {
        display: grid;
        place-items: center;
        inline-size: 2.5rem;
        block-size: 2.5rem;
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-lg);
        transition:
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .start.is-on .start-icon {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .start-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .start-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .start.is-on .start-name {
        color: var(--color-tonal-accent-ink);
      }
      .start-note {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .dot {
        inline-size: 1.125rem;
        block-size: 1.125rem;
        margin-block-start: var(--space-0-5);
        border-radius: var(--radius-pill);
        border: 1.5px solid var(--color-border-strong);
        background: var(--color-surface-default);
      }
      .start.is-on .dot {
        border-color: var(--color-brand-primary);
        box-shadow: inset 0 0 0 4px var(--color-brand-primary);
      }

      .lt-hint,
      .lt-err {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .lt-err {
        color: var(--color-error);
      }

      /* --- The product to copy ------------------------------------------------ */
      .copy {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        inline-size: 100%;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .copy-pick {
        margin-block-end: 0;
        max-inline-size: 36rem;
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-8);
        margin: 0;
      }
      .facts div {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .facts dt {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .facts dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .num-v {
        font-variant-numeric: tabular-nums;
      }
      .note {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      /* --- Footer ------------------------------------------------------------- */
      .foot {
        flex-wrap: wrap;
      }
      .foot-end {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: var(--space-3) var(--space-4);
        margin-inline-start: auto;
      }
      .foot-hint {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        text-align: end;
      }
      :host-context([dir='rtl']) .next-i {
        transform: scaleX(-1);
      }

      @media (prefers-reduced-motion: reduce) {
        .start,
        .start-icon {
          transition: none;
        }
      }
    `,
  ],
})
export class NewProductPageComponent {
  private readonly api = inject(BankProgramsApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly backLink = surrogateBoardLink();
  protected readonly saving = signal(false);
  protected readonly loadingLists = signal(false);
  protected readonly products = signal<SurrogateProductSummary[]>([]);

  /** "Duplicate" opens this page with `?copy=<key>`: the copy start, that product picked. */
  protected readonly copyOf = this.route.snapshot.queryParamMap.get('copy');

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    labelAr: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    /** The product to copy, when starting from one. Required only then (`pickStart`). */
    copyKey: new FormControl<string>(this.copyOf ?? '', { nonNullable: true }),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The loan type it is for (v36.5.0) — required; a copy starts from its source's. */
  protected readonly loanType = signal<LoanCategory | null>(null);
  protected readonly loanTypeMissing = signal(false);

  protected pickLoanType(c: LoanCategory): void {
    this.loanType.set(c);
    this.loanTypeMissing.set(false);
  }

  /** Blank, or a copy of the product picked below ("Duplicate" opens it on that product). */
  protected readonly start = signal<Start>(this.copyOf ? 'copy' : 'blank');

  protected readonly starts: ReadonlyArray<{
    key: Start;
    icon: string;
    name: string;
    note: string;
  }> = [
    {
      key: 'blank',
      icon: 'file-add',
      name: $localize`:@@np.start_blank:Blank`,
      note: $localize`:@@np.start_blank_note:An empty product. You add the questions and the amounts.`,
    },
    {
      key: 'copy',
      icon: 'copy',
      name: $localize`:@@np.start_copy:Copy a product like it`,
      note: $localize`:@@np.start_copy_note:Its questions, amounts and rules come with it. You change what is different.`,
    },
  ];

  protected readonly pickPlaceholder = $localize`:@@np.pick_product:Choose a product…`;

  /** The product the copy start would copy, once the list has it. */
  protected readonly picked = computed(() => {
    const key = this.value().copyKey;
    return key ? (this.products().find((p) => p.key === key) ?? null) : null;
  });

  /** Every product, by name. */
  protected readonly sortedProducts = computed(() =>
    [...this.products()].sort((a, b) => this.productName(a).localeCompare(this.productName(b))),
  );

  protected productName(p: SurrogateProductSummary): string {
    return this.isAr ? p.labelAr : p.labelEn;
  }

  /** The whole rail, so the operator sees where this goes; only this step is open. */
  protected readonly wizardSteps: WizardStepItem[] = productStepLabels().map((label, i) => ({
    id: String(i),
    label,
    disabled: i > 0,
  }));
  protected readonly lockedCaption = $localize`:@@np.steps_locked_cap:The other steps open once the product is created.`;
  protected readonly stepsAria = $localize`:@@spd.steps_aria:Surrogate product setup`;
  protected readonly title = $localize`:@@pform.title_new:New no-payslip product`;
  protected readonly subtitle = $localize`:@@pform.sub_new:A way to lend to someone who has no payslip — by a grade, an amount they own, or anything else they can show.`;

  constructor() {
    this.syncCopyRequired();
    void this.loadLists();
  }

  protected pickStart(start: Start): void {
    this.start.set(start);
    this.syncCopyRequired();
  }

  /** The copy picker is required on the copy start and nowhere else. */
  private syncCopyRequired(): void {
    const c = this.form.controls.copyKey;
    if (this.start() === 'copy') c.setValidators(Validators.required);
    else c.clearValidators();
    c.updateValueAndValidity();
  }

  private async loadLists(): Promise<void> {
    this.loadingLists.set(true);
    try {
      this.products.set((await this.api.listSurrogateProducts()).data);
    } catch {
      // The interceptor has said why; the picker stays empty and Create says what is missing.
    } finally {
      this.loadingLists.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    const loanType = this.loanType() ?? this.picked()?.loanCategory ?? null;
    if (loanType === null) {
      this.loanTypeMissing.set(true);
      document.querySelector<HTMLInputElement>('input[name="np-loan-type"]')?.focus();
      return;
    }
    // The button stays pressable: a press on an incomplete form names what is missing,
    // where a silently disabled button left the operator guessing.
    if (this.form.invalid) {
      for (const c of Object.values(this.form.controls)) {
        c.markAsDirty();
        c.updateValueAndValidity();
      }
      this.focusFirstInvalid();
      return;
    }
    const v = this.form.getRawValue();
    const labelEn = v.labelEn.trim();
    const labelAr = v.labelAr.trim();
    if (!labelEn || !labelAr) {
      // Spaces only: required passes, the server would refuse it.
      if (!labelEn) this.form.controls.labelEn.setErrors({ required: true });
      if (!labelAr) this.form.controls.labelAr.setErrors({ required: true });
      this.form.controls.labelEn.markAsDirty();
      this.form.controls.labelAr.markAsDirty();
      this.focusFirstInvalid();
      return;
    }
    this.saving.set(true);
    try {
      const res = await this.api.createSurrogateProduct({
        labelEn,
        labelAr,
        loanCategory: loanType,
        ...(this.start() === 'copy'
          ? { startFrom: 'copy' as const, sourceKey: v.copyKey }
          : { startFrom: 'blank' as const }),
      });
      this.message.success(
        $localize`:@@pform.created:Product created — switched off until it is ready.`,
      );
      // replaceUrl: Back from step 2 must not land on a form for a product that now exists.
      void this.router.navigate([PRODUCT_BASE, res.data.key], {
        queryParams: { step: FIRST_BUILD_STEP_PARAM },
        replaceUrl: true,
      });
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
      if (envelope?.code === 'ENUMERATION_KEY_DUPLICATE') {
        this.form.controls.labelEn.setErrors({ duplicate: true });
        this.form.controls.labelEn.markAsDirty();
        this.focusFirstInvalid();
      } else if (envelope?.code === 'VALIDATION_FAILED') {
        // Silent in the toast interceptor, so said here.
        this.message.error(this.errors.toLocalizedMessage('VALIDATION_FAILED', envelope.meta));
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Puts the caret on the first field that needs the operator, in page order. */
  private focusFirstInvalid(): void {
    const order: Array<['labelEn' | 'labelAr' | 'copyKey', string]> = [
      ['labelEn', 'np-name-en'],
      ['labelAr', 'np-name-ar'],
      ['copyKey', 'np-copy'],
    ];
    const hit = order.find(([k]) => this.form.controls[k].invalid);
    if (!hit) return;
    // After this change-detection pass, so a just-shown error tip does not shift it.
    queueMicrotask(() => document.getElementById(hit[1])?.focus());
  }
}
