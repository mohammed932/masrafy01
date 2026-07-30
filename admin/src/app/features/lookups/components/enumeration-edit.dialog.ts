import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { CloseCircleOutline } from '@ant-design/icons-angular/icons';
import { LOAN_CATEGORIES, categoryLabel } from '@core/loan-category';
import { LookupsApiService, type EnumerationRow } from '../lookups.api.service';

/**
 * Enumeration type whose members are scoped to one or more loan categories via
 * `categories`. For this type the dialog swaps the machine-key field for a
 * multi-select "Loan types" picker (a predefined program like Doctor/Pharmacy may
 * serve several categories) and auto-derives the key from the English label.
 */
const CATEGORY_SCOPED_TYPE = 'program_name';

export interface EnumerationEditDialogData {
  mode: 'create' | 'edit';
  type: string;
  row?: EnumerationRow;
  /**
   * Preselected loan categories for category-scoped types — e.g. the program
   * catalog's per-lane "Add program" action passes the lane's category.
   */
  categories?: string[];
}

@Component({
  selector: 'app-enumeration-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-body">
      <h2 class="dialog-title">
        @if (data.mode === 'create') {
          <span i18n="@@lookups.dialog.titleCreate">Add new value</span>
        } @else {
          <span i18n="@@lookups.dialog.titleEdit">Edit value</span>
        }
        <span class="type-chip">{{ data.type }}</span>
      </h2>

      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        @if (categoryScoped) {
          <nz-form-item>
            <nz-form-label nzFor="lk-categories" nzRequired i18n="@@lookups.field.loanTypes"
              >Loan types</nz-form-label
            >
            <nz-form-control [nzErrorTip]="categoriesErrTpl" [nzExtra]="categoriesHintTpl">
              <nz-select
                id="lk-categories"
                nzMode="multiple"
                formControlName="categories"
                nzPlaceHolder="Select one or more loan types"
                i18n-nzPlaceHolder="@@lookups.field.loanTypes.placeholder"
              >
                @for (opt of categoryOptions; track opt.value) {
                  <nz-option [nzValue]="opt.value" [nzLabel]="opt.label"></nz-option>
                }
              </nz-select>
              <ng-template #categoriesErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.loanTypes.required">Select at least one</span>
                }
              </ng-template>
              <ng-template #categoriesHintTpl>
                <span i18n="@@lookups.field.loanTypesHint"
                  >the program appears under every loan type you pick</span
                >
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        } @else {
          <nz-form-item>
            <nz-form-label nzFor="lk-key" nzRequired i18n="@@lookups.field.key"
              >Key (machine-readable)</nz-form-label
            >
            <nz-form-control [nzErrorTip]="keyErrTpl" [nzExtra]="keyHintTpl">
              <input nz-input id="lk-key" formControlName="key" [readOnly]="data.mode === 'edit'" />
              <ng-template #keyErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.key.required">Required</span>
                } @else if (control.errors?.['pattern']) {
                  <span i18n="@@lookups.field.key.pattern">Invalid format</span>
                }
              </ng-template>
              <ng-template #keyHintTpl>
                <span i18n="@@lookups.field.keyHint"
                  >letters, digits, underscore or hyphen only — used in API + database</span
                >
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        }

        <nz-form-item>
          <nz-form-label nzFor="lk-label" nzRequired i18n="@@lookups.field.labelEn"
            >Label</nz-form-label
          >
          <nz-form-control [nzErrorTip]="labelErrTpl">
            <input nz-input id="lk-label" formControlName="labelEn" [attr.maxlength]="labelMax" />
            <ng-template #labelErrTpl let-control>
              @if (control.errors?.['required']) {
                <span i18n="@@lookups.field.label.required">Required</span>
              }
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label nzFor="lk-label-ar" nzRequired i18n="@@lookups.field.labelAr"
            >Arabic label</nz-form-label
          >
          <nz-form-control [nzErrorTip]="labelArErrTpl">
            <input
              nz-input
              id="lk-label-ar"
              formControlName="labelAr"
              dir="rtl"
              [attr.maxlength]="labelMax"
            />
            <ng-template #labelArErrTpl let-control>
              @if (control.errors?.['required']) {
                <span i18n="@@lookups.field.labelAr.required">Required</span>
              }
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label nzFor="lk-sort" i18n="@@lookups.field.sortOrder">Sort order</nz-form-label>
          <nz-form-control [nzExtra]="sortHintTpl">
            <input nz-input id="lk-sort" type="number" formControlName="sortOrder" min="0" />
            <ng-template #sortHintTpl>
              <span i18n="@@lookups.field.sortOrderHint">controls the order in dropdowns</span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        @if (errorCode()) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline"></span>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>

      <div class="dialog-actions">
        <button
          nz-button
          nzType="default"
          type="button"
          (click)="cancel()"
          i18n="@@lookups.dialog.cancel"
        >
          Cancel
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          (click)="save()"
          [disabled]="!form.valid || submitting()"
          [nzLoading]="submitting()"
          i18n="@@lookups.dialog.save"
        >
          Save
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .dialog-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .dialog-title {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .type-chip {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        padding: 2px 10px;
        border-radius: var(--radius-pill);
      }
      .form {
        margin: 0;
      }
      .error {
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
        margin: 0;
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding-block-start: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class EnumerationEditDialogComponent {
  private readonly api = inject(LookupsApiService);
  private readonly dialogRef = inject(NzModalRef<EnumerationEditDialogComponent, boolean>);
  protected readonly data = inject<EnumerationEditDialogData>(NZ_MODAL_DATA);

  /** True for category-scoped types (program_name): loan-type picker + auto-derived key. */
  protected readonly categoryScoped = this.data.type === CATEGORY_SCOPED_TYPE;
  /** Label length cap — scoped names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.categoryScoped ? 120 : 160;
  protected readonly categoryOptions = LOAN_CATEGORIES.map((c) => ({
    value: c as string,
    label: categoryLabel(c),
  }));

  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly form = new FormGroup({
    key: new FormControl<string>(this.data.row?.key ?? '', {
      nonNullable: true,
      validators: this.categoryScoped
        ? []
        : [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)],
    }),
    labelEn: new FormControl<string>(this.data.row?.labelEn ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.categoryScoped ? 120 : 160)],
    }),
    labelAr: new FormControl<string>(this.data.row?.labelAr ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.categoryScoped ? 120 : 160)],
    }),
    categories: new FormControl<string[]>(
      this.data.row?.categories ?? this.data.categories ?? [],
      {
        nonNullable: true,
        validators: this.categoryScoped ? [Validators.required] : [],
      },
    ),
    sortOrder: new FormControl<number>(this.data.row?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
  });

  cancel(): void {
    this.dialogRef.close(false);
  }

  async save(): Promise<void> {
    this.errorCode.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      const categories = this.categoryScoped ? v.categories : undefined;
      if (this.data.mode === 'create') {
        const key = this.categoryScoped ? this.slugify(v.labelEn) : v.key;
        if (!key) {
          this.errorCode.set('INVALID_KEY');
          return;
        }
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          categories,
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          categories,
          sortOrder: v.sortOrder,
        });
      }
      this.dialogRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  /** Machine key derived from an English label — lowercase, non-alnum → `_`, trimmed, ≤64. */
  private slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
  }
}
