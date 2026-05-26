import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { UploadOutline, CloseOutline } from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '../../core/errors/error-code.service';
import { BanksApiService } from './banks.api.service';
import type { BankWithProgramCount } from './banks.types';

export interface BankFormDialogData {
  mode: 'create' | 'edit';
  bank?: BankWithProgramCount;
}
export interface BankFormDialogResult {
  saved: boolean;
}

@Component({
  selector: 'app-bank-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
  ],
  providers: [provideNzIconsPatch([UploadOutline, CloseOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="form">
      <h2 class="title">{{ data.mode === 'create' ? 'Add bank' : 'Edit bank' }}</h2>

      <nz-form-item>
        <nz-form-label nzRequired i18n="@@banks.field.code">Code</nz-form-label>
        <nz-form-control [nzErrorTip]="codeErr">
          <input nz-input formControlName="code" placeholder="ABK_EGYPT" [readonly]="data.mode === 'edit'" />
          <ng-template #codeErr i18n="@@banks.help.code">A–Z, 0–9, _ — 2 to 40 chars. Immutable after save.</ng-template>
        </nz-form-control>
      </nz-form-item>

      <div class="row">
        <nz-form-item>
          <nz-form-label nzRequired i18n="@@banks.field.name_en">Name (English)</nz-form-label>
          <nz-form-control>
            <input nz-input formControlName="nameEnglish" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired i18n="@@banks.field.name_ar">Name (Arabic)</nz-form-label>
          <nz-form-control>
            <input nz-input formControlName="nameArabic" dir="rtl" />
          </nz-form-control>
        </nz-form-item>
      </div>

      <nz-form-item>
        <nz-form-label i18n="@@banks.field.website">Website</nz-form-label>
        <nz-form-control>
          <input nz-input formControlName="websiteUrl" placeholder="https://" />
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label i18n="@@banks.field.notes">Notes</nz-form-label>
        <nz-form-control>
          <textarea nz-input formControlName="notes" rows="2"></textarea>
        </nz-form-control>
      </nz-form-item>

      <div class="row">
        <nz-form-item>
          <nz-form-label i18n="@@banks.field.display_order">Display order</nz-form-label>
          <nz-form-control>
            <nz-input-number formControlName="displayOrder" [nzMin]="0" [nzStep]="1" class="num-field"></nz-input-number>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label i18n="@@banks.field.active">Active</nz-form-label>
          <nz-form-control>
            <label nz-checkbox formControlName="isActive" i18n="@@banks.field.active">Active</label>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label i18n="@@banks.field.featured">Featured partner</nz-form-label>
          <nz-form-control
            i18n-nzExtra="@@banks.field.featured.help"
            nzExtra="Boost this bank's offers in mobile ranking when ties exist"
          >
            <label nz-checkbox formControlName="isFeatured" i18n="@@banks.field.featured">Featured partner</label>
          </nz-form-control>
        </nz-form-item>
      </div>

      @if (data.mode === 'edit') {
        <div class="logo-row">
          <label class="logo-label" i18n="@@banks.field.logo">Logo</label>
          <input type="file" #fileInput accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="onPick(fileInput)" hidden />
          <button nz-button type="button" (click)="fileInput.click()" [nzLoading]="uploading()">
            <span nz-icon nzType="upload" nzTheme="outline" aria-hidden="true"></span>
            <span>Upload logo</span>
          </button>
          @if (logoPreview()) {
            <img [src]="logoPreview()" alt="" class="preview" />
          }
        </div>
      }

      <footer class="footer">
        <button nz-button type="button" (click)="cancel()" [disabled]="saving()">
          <span i18n="@@banks.form.cancel">Cancel</span>
        </button>
        <button nz-button nzType="primary" type="submit" [disabled]="form.invalid || saving()" [nzLoading]="saving()">
          <span i18n="@@banks.form.save">{{ data.mode === 'create' ? 'Create' : 'Save' }}</span>
        </button>
      </footer>
    </form>
  `,
  styles: [
    `
      :host { display: block; }
      .form { display: flex; flex-direction: column; gap: var(--space-3); }
      .title { font-size: var(--text-lg); font-weight: 700; margin: 0 0 var(--space-2); color: var(--text-primary); }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
      .num-field { inline-size: 100%; }
      .logo-row { display: flex; align-items: center; gap: var(--space-3); padding-block: var(--space-2); }
      .logo-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
      .preview { inline-size: 48px; block-size: 48px; object-fit: contain; border: 1px solid var(--border-default); border-radius: var(--radius-sm); }
      .footer { display: flex; justify-content: flex-end; gap: var(--space-2); margin-block-start: var(--space-3); }
    `,
  ],
})
export class BankFormDialog {
  protected readonly data = inject<BankFormDialogData>(NZ_MODAL_DATA);
  private readonly ref = inject<NzModalRef<BankFormDialog, BankFormDialogResult | undefined>>(NzModalRef);
  private readonly api = inject(BanksApiService);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);

  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly logoPreview = signal<string | null>(null);

  protected readonly form = new FormGroup({
    code: new FormControl<string>(this.data.bank?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]{1,39}$/)],
    }),
    nameEnglish: new FormControl<string>(this.data.bank?.nameEnglish ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    nameArabic: new FormControl<string>(this.data.bank?.nameArabic ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    websiteUrl: new FormControl<string>(this.data.bank?.websiteUrl ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    notes: new FormControl<string>(this.data.bank?.notes ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    displayOrder: new FormControl<number>(this.data.bank?.displayOrder ?? 0, { nonNullable: true, validators: [Validators.min(0)] }),
    isActive: new FormControl<boolean>(this.data.bank?.isActive ?? true, { nonNullable: true }),
    isFeatured: new FormControl<boolean>(this.data.bank?.isFeatured ?? false, { nonNullable: true }),
  });

  constructor() {
    if (this.data.mode === 'edit') this.form.controls.code.disable();
  }

  cancel(): void { this.ref.close({ saved: false }); }

  async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      if (this.data.mode === 'create') {
        const v = this.form.getRawValue();
        await this.api.create({
          code: v.code,
          nameArabic: v.nameArabic,
          nameEnglish: v.nameEnglish,
          websiteUrl: v.websiteUrl || undefined,
          notes: v.notes || undefined,
          displayOrder: v.displayOrder,
          isActive: v.isActive,
          isFeatured: v.isFeatured,
        });
        this.message.success($localize`:@@banks.create.success:Bank created.`);
        this.ref.close({ saved: true });
      } else {
        const v = this.form.getRawValue();
        await this.api.update(this.data.bank!.id, {
          version: this.data.bank!.version,
          nameArabic: v.nameArabic,
          nameEnglish: v.nameEnglish,
          websiteUrl: v.websiteUrl || null,
          notes: v.notes || null,
          displayOrder: v.displayOrder,
          isActive: v.isActive,
          isFeatured: v.isFeatured,
        });
        this.message.success($localize`:@@banks.update.success:Bank updated.`);
        this.ref.close({ saved: true });
      }
    } catch (err) {
      this.handleError(err);
    } finally {
      this.saving.set(false);
    }
  }

  async onPick(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file || !this.data.bank) return;
    this.uploading.set(true);
    try {
      const { data: presigned } = await this.api.requestLogoUpload(this.data.bank.id, file.type);
      const put = await fetch(presigned.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload-failed');
      await this.api.confirmLogoUpload(this.data.bank.id, presigned.key);
      const reader = new FileReader();
      reader.onload = () => this.logoPreview.set(reader.result as string);
      reader.readAsDataURL(file);
      this.message.success($localize`:@@banks.logo.success:Logo uploaded.`);
    } catch (err) {
      this.handleError(err);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  private handleError(err: unknown): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = envelope?.code ?? 'INTERNAL_ERROR';
    this.message.error(this.errors.toLocalizedMessage(code as never, envelope?.meta));
    if (code === 'BANK_CODE_DUPLICATE') this.form.controls.code.setErrors({ duplicate: true });
    if (code === 'BANK_CODE_INVALID_FORMAT') this.form.controls.code.setErrors({ format: true });
  }
}
