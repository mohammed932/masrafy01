/**
 * "Sell it as a program" — a no-payslip catalog program name, born linked to this product
 * (v33.1.0).
 *
 * A product is a calculation; what a customer picks and a bank files under is a PROGRAM NAME.
 * Until this sheet the link between them was written only by the seeds, so a product an
 * operator created could be built and switched on and still be sold by nothing. ONE write:
 * `POST admin/enumerations` with the name, the loan types it is offered under, the
 * `no_payslip` basis and `surrogateProductKey` — the server's own atomic create, which refuses
 * a product that is off or cap-only. Banks then file programs under the name from Banks.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import { ShopOutline } from '@ant-design/icons-angular/icons';
import { FormDrawerComponent, LoanCategorySwitchesComponent } from '@shared/ui';
import { uniqueSlug } from '@shared/lookups/slug';
import { canonicalCategories, type LoanCategory } from '@core/loan-category';
import { LookupsApiService } from '../lookups/lookups.api.service';
import { RESERVED_NAME_KEYS } from './new-program-name';

export interface SellAsProgramDrawerData {
  productKey: string;
  labelEn: string;
  labelAr: string;
}

export interface SellAsProgramDrawerResult {
  /** The new program name's key. */
  key: string;
}

const PROGRAM_NAME_TYPE = 'program_name';

@Component({
  selector: 'app-sell-as-program-drawer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    FormDrawerComponent,
    LoanCategorySwitchesComponent,
  ],
  providers: [provideNzIconsPatch([ShopOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="title"
      [subtitle]="subtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="!canSubmit()"
      [submitting]="saving()"
      (cancelled)="cancel()"
      (submitted)="submit()"
    >
      <span drawerIcon nz-icon nzType="shop" nzTheme="outline"></span>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <nz-form-item>
          <nz-form-label nzFor="sell-name-en" nzRequired i18n="@@sell.name_en"
            >Program name (English)</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="sell-name-en" formControlName="labelEn" autocomplete="off" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="sell-name-ar" nzRequired i18n="@@sell.name_ar"
            >Program name (Arabic)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="sell-name-ar"
              formControlName="labelAr"
              dir="rtl"
              autocomplete="off"
            />
          </nz-form-control>
        </nz-form-item>

        <fieldset class="cats">
          <legend class="legend" i18n="@@sell.offered">Offered under</legend>
          <!-- The same loan-type cards as a program's page and Add program. -->
          <app-loan-category-switches [value]="pickedList()" (toggled)="toggle($event)" />
        </fieldset>

        <p class="hint" i18n="@@sell.hint">
          Customers pick this name in the app, and it is worked out with this product's calculation
          — no payslip asked. Banks then add their own program under it from Banks.
        </p>
      </form>
    </app-form-drawer>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .cats {
        border: 0;
        margin: 0 0 var(--space-3);
        padding: 0;
        min-inline-size: 0;
      }
      .legend {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-block-end: var(--space-2);
      }
      .hint {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class SellAsProgramDrawerComponent {
  protected readonly data = inject<SellAsProgramDrawerData>(NZ_DRAWER_DATA);
  private readonly ref = inject(
    NzDrawerRef<SellAsProgramDrawerComponent, SellAsProgramDrawerResult | undefined>,
  );
  private readonly lookups = inject(LookupsApiService);
  private readonly message = inject(NzMessageService);

  protected readonly picked = signal<ReadonlySet<LoanCategory>>(new Set(['personal']));
  protected readonly pickedList = computed(() => canonicalCategories([...this.picked()]));
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>(this.data.labelEn, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    labelAr: new FormControl<string>(this.data.labelAr, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly canSubmit = computed(() => {
    const v = this.value();
    return !!v.labelEn?.trim() && !!v.labelAr?.trim() && this.picked().size > 0;
  });

  protected readonly title = $localize`:@@sell.title:Sell it as a program`;
  protected readonly subtitle = $localize`:@@sell.sub:A program name customers can pick, worked out with this product.`;
  protected readonly submitLabel = $localize`:@@sell.create:Create program`;

  protected toggle(cat: LoanCategory): void {
    const next = new Set(this.picked());
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    this.picked.set(next);
  }

  protected cancel(): void {
    this.ref.close(undefined);
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    try {
      const row = await this.lookups.create({
        type: PROGRAM_NAME_TYPE,
        key: await this.uniqueKey(v.labelEn),
        labelEn: v.labelEn.trim(),
        labelAr: v.labelAr.trim(),
        incomeBases: ['no_payslip'],
        categories: canonicalCategories([...this.picked()]),
        surrogateProductKey: this.data.productKey,
      });
      this.message.success(
        $localize`:@@sell.done:Program created — banks can now add their program under it.`,
      );
      this.ref.close({ key: row.key });
    } catch {
      // The interceptor has said why (a product that is off or cap-only, a taken key).
    } finally {
      this.saving.set(false);
    }
  }

  /** A free key from the English name — the same rule Add program uses. */
  private async uniqueKey(label: string): Promise<string> {
    try {
      const rows = await this.lookups.list(PROGRAM_NAME_TYPE);
      return uniqueSlug(label, new Set([...rows.map((r) => r.key), ...RESERVED_NAME_KEYS]));
    } catch {
      return uniqueSlug(label, RESERVED_NAME_KEYS);
    }
  }
}
