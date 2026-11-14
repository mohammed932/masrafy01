/**
 * Step 1 of the no-payslip product wizard — "Name and start" (v33.3.0), as a full page.
 *
 * It replaced the New product side sheet: creating a product used to open a sheet and THEN a
 * page, two surfaces for one job. Now the wizard is one flow — this page shows the whole rail
 * with only its first step open, and "Create and continue" creates the product (OFF) and moves
 * on to "What it asks" on the product's own page, which carries the rest of the steps.
 *
 * The product has to exist before step 2: every later step saves against its key (the
 * questions it reads, its calculation, its figures). So this step is the one write that
 * happens on Next; everything after it is held until the product page's one Save.
 *
 * Four starts, as cards, because each one is a different amount of work afterwards:
 *   Blank     — nothing but the name.
 *   Starter   — one of the library's income / ceiling products, under this name.
 *   Copy      — an existing product's questions, calculation, figures and defaults
 *               (what "Duplicate" opens, via `?copy=`).
 *   Cap       — cap-only: no calculation; it asks one answer each bank caps by.
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
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ArrowLeftOutline } from '@ant-design/icons-angular/icons';
import { PageHeaderComponent, WizardStepsComponent, type WizardStepItem } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import type { SurrogateProductSummary } from '../bank-programs/bank-programs.types';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';
import { FIRST_BUILD_STEP_PARAM, productStepLabels } from './product-steps';

@Component({
  selector: 'app-new-product-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzSelectModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    PageHeaderComponent,
    WizardStepsComponent,
  ],
  providers: [provideNzIconsPatch([ArrowLeftOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a class="back" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@spd.back">All surrogate products</span>
      </a>

      <app-page-header [title]="title" [subtitle]="subtitle" />

      <app-wizard-steps
        [steps]="steps"
        [activeIndex]="0"
        [ariaLabel]="stepsAria"
        [caption]="caption"
      />

      <section class="panel" [attr.aria-label]="steps[0]?.label ?? ''">
        <form [formGroup]="form" (ngSubmit)="submit()" class="form">
          <!-- How to start: from nothing, or from the product most like this one. -->
          <div class="starts" role="radiogroup" [attr.aria-label]="startAria">
            <button
              type="button"
              role="radio"
              class="start"
              [class.is-on]="start() === 'blank'"
              [attr.aria-checked]="start() === 'blank'"
              (click)="start.set('blank')"
            >
              <span class="dot" aria-hidden="true"></span>
              <span class="start-text">
                <span class="start-name" i18n="@@np.start_blank">Blank</span>
                <span class="start-note" i18n="@@np.start_blank_note"
                  >An empty product. You add the questions and the amounts.</span
                >
              </span>
            </button>
            <button
              type="button"
              role="radio"
              class="start"
              [class.is-on]="start() === 'copy'"
              [attr.aria-checked]="start() === 'copy'"
              (click)="start.set('copy')"
            >
              <span class="dot" aria-hidden="true"></span>
              <span class="start-text">
                <span class="start-name" i18n="@@np.start_copy">Copy a product like it</span>
                <span class="start-note" i18n="@@np.start_copy_note"
                  >Its questions, amounts and rules come with it. You change what is
                  different.</span
                >
              </span>
            </button>
            <button
              type="button"
              role="radio"
              class="start"
              [class.is-on]="start() === 'cap'"
              [attr.aria-checked]="start() === 'cap'"
              (click)="start.set('cap')"
            >
              <span class="dot" aria-hidden="true"></span>
              <span class="start-text">
                <span class="start-name" i18n="@@np.start_cap">A cap on a payslip loan</span>
                <span class="start-note" i18n="@@np.start_cap_note"
                  >No amount is worked out. It asks one question, and each bank sets the biggest
                  loan for each answer.</span
                >
              </span>
            </button>
          </div>

          @if (start() === 'copy') {
            <nz-form-item>
              <nz-form-label nzFor="np-copy" nzRequired i18n="@@np.which_product"
                >Which product?</nz-form-label
              >
              <nz-form-control>
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
              </nz-form-control>
            </nz-form-item>
          }

          <div class="names">
            <nz-form-item>
              <nz-form-label nzFor="np-name-en" nzRequired i18n="@@pform.name_en"
                >Name (English)</nz-form-label
              >
              <nz-form-control [nzErrorTip]="nameErr">
                <input nz-input id="np-name-en" formControlName="labelEn" autocomplete="off" />
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
              <nz-form-label nzFor="np-name-ar" nzRequired i18n="@@pform.name_ar"
                >Name (Arabic)</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="np-name-ar"
                  formControlName="labelAr"
                  dir="rtl"
                  autocomplete="off"
                />
              </nz-form-control>
            </nz-form-item>
          </div>

          <p class="hint" i18n="@@np.hint2">
            Next creates the product, switched off. Nothing reaches a customer until you go live on
            the last step.
          </p>
        </form>
      </section>

      <nav class="stepnav" [attr.aria-label]="stepsAria">
        <a nz-button [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
          <span i18n="@@np.cancel">Cancel</span>
        </a>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!canSubmit()"
          [nzLoading]="saving()"
          (click)="submit()"
        >
          <span i18n="@@np.next">Create and continue</span>
        </button>
      </nav>
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
        gap: var(--space-6);
        /* The Program catalog's frame, the same on every page of the section. */
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        inline-size: fit-content;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        text-decoration: none;
      }
      .back:hover {
        color: var(--text-primary);
      }
      .panel {
        padding: var(--space-6);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .starts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
        gap: var(--space-3);
      }
      .start {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .start:hover {
        border-color: var(--border-strong);
      }
      .start:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .start.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
      }
      .dot {
        flex: none;
        inline-size: 16px;
        block-size: 16px;
        margin-block-start: 2px;
        border-radius: var(--radius-pill);
        border: 1.5px solid var(--border-strong);
      }
      .start.is-on .dot {
        border-color: var(--primary);
        box-shadow: inset 0 0 0 4px var(--primary);
      }
      .start-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .start-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .start-note {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      @media (prefers-reduced-motion: reduce) {
        .start {
          transition: none;
        }
      }
      .names {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
        gap: 0 var(--space-4);
      }
      .hint {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .stepnav {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
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
    /** The product to copy, when starting from one. */
    copyKey: new FormControl<string>(this.copyOf ?? '', { nonNullable: true }),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Blank, or a copy of the product picked below ("Duplicate" opens it on that product). */
  protected readonly start = signal<'blank' | 'copy' | 'cap'>(this.copyOf ? 'copy' : 'blank');
  protected readonly startAria = $localize`:@@np.start_aria:How to start`;
  protected readonly pickPlaceholder = $localize`:@@np.pick_product:Choose a product…`;

  protected readonly canSubmit = computed(() => {
    const v = this.value();
    if (this.start() === 'copy' && !v.copyKey) return false;
    return !this.saving() && !!v.labelEn?.trim() && !!v.labelAr?.trim();
  });

  /** Every product, by name. */
  protected readonly sortedProducts = computed(() =>
    [...this.products()].sort((a, b) => this.productName(a).localeCompare(this.productName(b))),
  );

  protected productName(p: SurrogateProductSummary): string {
    return this.isAr ? p.labelAr : p.labelEn;
  }

  /** The whole rail, so the operator sees where this goes; only this step is open. */
  protected readonly steps: WizardStepItem[] = productStepLabels().map((label, i) => ({
    id: `step-${i}`,
    label,
    ...(i === 0 ? {} : { disabled: true }),
  }));
  protected readonly stepsAria = $localize`:@@spd.steps_aria:Surrogate product setup`;
  protected readonly caption = $localize`:@@np.caption3:Start from nothing or from a product like it, and name it.`;
  protected readonly title = $localize`:@@pform.title_new:New no-payslip product`;
  protected readonly subtitle = $localize`:@@pform.sub_new:A way to lend to someone who has no payslip — by a grade, an amount they own, or anything else they can show.`;
  constructor() {
    void this.loadLists();
  }

  private async loadLists(): Promise<void> {
    this.loadingLists.set(true);
    try {
      this.products.set((await this.api.listSurrogateProducts()).data);
    } catch {
      // The interceptor has said why; the pickers stay empty and Next stays disabled.
    } finally {
      this.loadingLists.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    try {
      const res = await this.api.createSurrogateProduct({
        labelEn: v.labelEn.trim(),
        labelAr: v.labelAr.trim(),
        ...(this.start() === 'copy'
          ? { startFrom: 'copy' as const, sourceKey: v.copyKey }
          : { startFrom: this.start() === 'cap' ? ('cap' as const) : ('blank' as const) }),
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
        this.form.controls.labelEn.markAsTouched();
      } else if (envelope?.code === 'VALIDATION_FAILED') {
        // Silent in the toast interceptor, so said here.
        this.message.error(this.errors.toLocalizedMessage('VALIDATION_FAILED', envelope.meta));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
