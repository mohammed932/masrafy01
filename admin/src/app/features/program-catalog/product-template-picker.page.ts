/**
 * "Start from a shape" — creating a no-payslip product on its own, with no name to sell it yet.
 *
 * WHY IT EXISTS. Until the shapes existed, a product was born empty and the only way to give
 * it a calculation was the raw step editor: pick an operation, wire inputs between steps, and
 * know that step 3 has to point back at steps 1 and 2. That is programming. Nine banks across
 * five products all fit one of the shapes, so the question the operator is actually answering
 * is "how does this bank work the income out" — one pick, or several when the banks selling
 * the product reach the same figure in different ways.
 *
 * WHY IT STILL EXISTS NOW THAT `/program-catalog/new` CAN MAKE ONE. A product with no catalog
 * name is a legitimate row — the board renders it, saying no bank quotes from it yet — and
 * folding this into the name flow would delete that capability to make the menu shorter. It is
 * the SECONDARY errand, and the board draws it as a link rather than a second button.
 *
 * The cards themselves live in `product-shape-picker.component.ts`, shared with the name flow:
 * two copies of the shapes is two places for one to go stale. They are MULTI-select — see
 * that file's header — so what travels to the calculation screen is a LIST.
 *
 * NAMING HAPPENS HERE, not in a sheet over the top. It used to open the generic enumeration
 * drawer, which reports only that it saved — so this page had to read the product list before
 * opening it and diff the list afterwards to learn the key the server minted. Writing the row
 * directly returns it, key and all.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { FormPageComponent } from '@shared/ui';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { slugify, uniqueSlug } from '@shared/lookups/slug';
import { ProductShapePickerComponent } from './product-shape-picker.component';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';

const SURROGATE_PRODUCT_TYPE = 'surrogate_product';

@Component({
  selector: 'app-product-template-picker-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzInputModule, FormPageComponent, ProductShapePickerComponent],
  template: `
    <app-form-page
      [eyebrow]="eyebrow"
      [title]="title"
      [subtitle]="subtitle"
      [backLabel]="backLabel"
      [submitLabel]="submitLabel"
      [submitting]="submitting()"
      [blockReason]="blockText()"
      [hint]="hint()"
      (cancelled)="leave()"
      (submitted)="create()"
    >
      <form [formGroup]="form" class="body" (ngSubmit)="create()">
        <app-product-shape-picker
          [value]="picked()"
          [ariaLabel]="title"
          (toggled)="toggle($event)"
        />

        <!-- Revealed by the pick rather than shown alongside it: the shape is the question
             this screen asks, and two live questions at once would make the grid read as
             optional. -->
        @if (picked().length > 0) {
          <section class="naming">
            <h2 class="h" i18n="@@spt.create_title">Name this product</h2>
            <p class="lede" i18n="@@spt.create_sub">
              What the operators filing programs under it will look for. The calculation comes next.
            </p>
            <div class="pair">
              <label class="field">
                <span class="field-label" i18n="@@lookups.field.labelEnglish">English label</span>
                <input nz-input formControlName="labelEn" dir="ltr" [attr.maxlength]="labelMax" />
              </label>
              <label class="field">
                <span class="field-label" i18n="@@lookups.field.labelAr">Arabic label</span>
                <input nz-input formControlName="labelAr" dir="rtl" [attr.maxlength]="labelMax" />
              </label>
            </div>
          </section>
        }

        @if (errorMessage(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </form>
    </app-form-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .naming {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        max-inline-size: 62rem;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
        animation: naming-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes naming-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .h {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .lede {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .field-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }
      .error {
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      @media (prefers-reduced-motion: reduce) {
        .naming {
          animation: none;
        }
      }
    `,
  ],
})
export class ProductTemplatePickerPage {
  private readonly lookups = inject(LookupsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly router = inject(Router);

  /** Back to the board, with the Surrogate side already showing. */
  private readonly backTo = surrogateBoardLink();

  /** A product answers to no column of its own, unlike a program name's 120. */
  protected readonly labelMax = 160;

  /** Every way this product offers, in the order it was picked — the order decides slot ids. */
  protected readonly picked = signal<readonly string[]>([]);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>('', { nonNullable: true }),
    labelAr: new FormControl<string>('', { nonNullable: true }),
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly eyebrow = $localize`:@@spt.eyebrow:New surrogate product`;
  protected readonly title = $localize`:@@spt.title:How does the bank work the income out?`;
  protected readonly subtitle = $localize`:@@spt.subtitle:Pick every way banks work this product's figure out. Each of them fills in its own figures later — the shapes are what they have in common.`;
  protected readonly backLabel = $localize`:@@spt.back:Surrogate products`;
  protected readonly submitLabel = $localize`:@@spt.create_cta:Create product`;

  protected readonly blockText = computed<string | null>(() => {
    if (this.picked().length === 0) {
      return $localize`:@@spt.pick_first:Pick at least one way the income is worked out to carry on.`;
    }
    const v = this.formValue();
    if ((v.labelEn ?? '').trim() === '' || (v.labelAr ?? '').trim() === '') {
      return $localize`:@@spt.block_name:Name it in both languages.`;
    }
    if (slugify(v.labelEn ?? '') === '') {
      return $localize`:@@pcn.block_name_latin:The English name needs at least one letter or digit — it becomes the key.`;
    }
    return null;
  });

  protected readonly hint = computed<string | null>(() =>
    this.blockText() === null
      ? $localize`:@@spt.hint_next:Creates the product, then opens its figures to fill in.`
      : null,
  );

  /**
   * Tick or untick one way, keeping pick ORDER.
   *
   * Appended, never sorted: the first way becomes `primary` and the second `alt`, and those
   * slot ids are what a bank's figures are keyed by (`waySlot`). Re-sorting the list would
   * rename a slot the operator can see no reason to have moved.
   */
  protected toggle(key: string): void {
    this.picked.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
  }

  protected leave(): void {
    void this.router.navigate(this.backTo.commands, { queryParams: this.backTo.queryParams });
  }

  /** Fire-and-forget for the template: Angular's parser has no `void` operator. */
  protected create(): void {
    void this.doCreate();
  }

  private async doCreate(): Promise<void> {
    const shapes = this.picked();
    if (this.submitting() || shapes.length === 0 || this.blockText() !== null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const v = this.form.getRawValue();
      const created = await this.lookups.create({
        type: SURROGATE_PRODUCT_TYPE,
        key: await this.uniqueKey(v.labelEn),
        labelEn: v.labelEn,
        labelAr: v.labelAr,
      });
      // The shapes travel on the URL rather than in a service: a reload on the calculation
      // screen has to land on the same ones, and so does a link somebody pastes. Comma-joined
      // in pick order, which is the order the slots are named in.
      //
      // No `then`: nothing sent the operator here from a name, so the calculation screen's
      // own product is where leaving belongs.
      void this.router.navigate([PRODUCT_BASE, created.key, 'calculation'], {
        queryParams: { from: shapes.join(',') },
      });
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.errorMessage.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Free key for a derived slug. The server still enforces the unique; this only keeps two
   * products legitimately sharing an English label from surfacing as an unactionable
   * duplicate-key error on a field the operator never saw.
   */
  private async uniqueKey(label: string): Promise<string> {
    try {
      const rows = await this.lookups.list(SURROGATE_PRODUCT_TYPE);
      return uniqueSlug(label, new Set(rows.map((r) => r.key)));
    } catch {
      return slugify(label);
    }
  }
}
