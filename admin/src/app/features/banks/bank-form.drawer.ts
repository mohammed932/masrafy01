import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import { UploadOutline, CloseOutline, BankOutline } from '@ant-design/icons-angular/icons';
import { FormDrawerComponent } from '@shared/ui';
import { ErrorCodeService } from '../../core/errors/error-code.service';
import { BanksApiService } from './banks.api.service';
import type { BankWithProgramCount } from './banks.types';

export interface BankFormDrawerData {
  mode: 'create' | 'edit';
  bank?: BankWithProgramCount;
}
export interface BankFormDrawerResult {
  saved: boolean;
}

@Component({
  selector: 'app-bank-form-drawer',
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
    FormDrawerComponent,
  ],
  providers: [provideNzIconsPatch([UploadOutline, CloseOutline, BankOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="drawerTitle"
      [subtitle]="drawerSubtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="form.invalid"
      [submitting]="saving()"
      (cancelled)="cancel()"
      (submitted)="submit()"
    >
      <span drawerIcon nz-icon nzType="bank" nzTheme="outline"></span>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form">
        <div class="row">
          <nz-form-item>
            <nz-form-label nzRequired i18n="@@banks.field.name_en">Name (English)</nz-form-label>
            <nz-form-control [nzErrorTip]="nameEnErr">
              <input nz-input formControlName="nameEnglish" />
              <ng-template #nameEnErr i18n="@@banks.help.name_en"
                >A bank with this English name already exists.</ng-template
              >
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
              <nz-input-number
                formControlName="displayOrder"
                [nzMin]="0"
                [nzStep]="1"
                class="num-field"
              ></nz-input-number>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label i18n="@@banks.field.active">Active</nz-form-label>
            <nz-form-control>
              <label nz-checkbox formControlName="isActive" i18n="@@banks.field.active"
                >Active</label
              >
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label i18n="@@banks.field.featured">Featured partner</nz-form-label>
            <nz-form-control
              i18n-nzExtra="@@banks.field.featured.help"
              nzExtra="Boost this bank's offers in mobile ranking when ties exist"
            >
              <label nz-checkbox formControlName="isFeatured" i18n="@@banks.field.featured"
                >Featured partner</label
              >
            </nz-form-control>
          </nz-form-item>
        </div>

        @if (data.mode === 'edit') {
          <div class="logo-row">
            <label class="logo-label" i18n="@@banks.field.logo">Logo</label>
            <input
              type="file"
              #fileInput
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              (change)="onPick(fileInput)"
              hidden
            />
            <button nz-button type="button" (click)="fileInput.click()" [nzLoading]="uploading()">
              <span nz-icon nzType="upload" nzTheme="outline" aria-hidden="true"></span>
              <span>Upload logo</span>
            </button>
            @if (logoPreview()) {
              <img [src]="logoPreview()" alt="" class="preview" />
            }
          </div>
        }
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
        gap: var(--space-3);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }
      .num-field {
        inline-size: 100%;
      }
      .logo-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding-block: var(--space-2);
      }
      .logo-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .preview {
        inline-size: 48px;
        block-size: 48px;
        object-fit: contain;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
      }
    `,
  ],
})
export class BankFormDrawer {
  protected readonly data = inject<BankFormDrawerData>(NZ_DRAWER_DATA);
  private readonly ref =
    inject<NzDrawerRef<BankFormDrawer, BankFormDrawerResult | undefined>>(NzDrawerRef);

  // Was two hardcoded English strings in the template — the title read "Add bank"
  // in the Arabic build too (A20).
  protected readonly drawerTitle =
    this.data.mode === 'create'
      ? $localize`:@@banks.form.titleCreate:Add bank`
      : $localize`:@@banks.form.titleEdit:Edit bank`;
  protected readonly drawerSubtitle =
    this.data.mode === 'create'
      ? $localize`:@@banks.form.subCreate:Registers the partner. Its loan programs are added afterwards, from the bank's own page.`
      : $localize`:@@banks.form.subEdit:Updates the partner's details everywhere its programs and offers are shown.`;
  protected readonly submitLabel =
    this.data.mode === 'create'
      ? $localize`:@@banks.form.create:Create bank`
      : $localize`:@@banks.form.save:Save`;
  private readonly api = inject(BanksApiService);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);
  private readonly http = inject(HttpClient);

  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly logoPreview = signal<string | null>(null);

  protected readonly form = new FormGroup({
    nameEnglish: new FormControl<string>(this.data.bank?.nameEnglish ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    nameArabic: new FormControl<string>(this.data.bank?.nameArabic ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
    websiteUrl: new FormControl<string>(this.data.bank?.websiteUrl ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    notes: new FormControl<string>(this.data.bank?.notes ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    displayOrder: new FormControl<number>(this.data.bank?.displayOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    isActive: new FormControl<boolean>(this.data.bank?.isActive ?? true, { nonNullable: true }),
    isFeatured: new FormControl<boolean>(this.data.bank?.isFeatured ?? false, {
      nonNullable: true,
    }),
  });

  cancel(): void {
    this.ref.close({ saved: false });
  }

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
      await lastValueFrom(
        this.http.put(presigned.uploadUrl, file, {
          headers: { 'Content-Type': file.type },
        }),
      );
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
    if (code === 'BANK_NAME_DUPLICATE')
      this.form.controls.nameEnglish.setErrors({ duplicate: true });
  }
}
