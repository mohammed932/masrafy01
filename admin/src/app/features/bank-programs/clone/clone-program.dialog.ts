import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { CopyOutline } from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs.api.service';

export interface CloneProgramDialogData {
  sourceProgramCode: string;
  sourceFriendlyName: string;
}

export interface CloneProgramDialogResult {
  newProgramCode?: string;
}

@Component({
  selector: 'app-clone-program-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzSpinModule,
  ],
  providers: [provideNzIconsPatch([CopyOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 class="dialog-title" i18n="@@bank_programs.clone.title">Clone bank program</h2>
    </header>
    <div class="dialog-body">
      <p class="source">
        <span class="source-icon" nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@bank_programs.clone.source">Cloning from</span>
        <strong>{{ data.sourceProgramCode }}</strong>
        <em>· {{ data.sourceFriendlyName }}</em>
      </p>

      <nz-form-item class="full">
        <nz-form-label [nzFor]="'newCode'" i18n="@@bank_programs.clone.new_code"
          >New program code</nz-form-label
        >
        <nz-form-control [nzErrorTip]="codeErrTpl" [nzExtra]="codeHint">
          <input
            nz-input
            id="newCode"
            [formControl]="codeCtrl"
            placeholder="ABK-AUTO-V2"
          />
          <ng-template #codeHint>
            <span i18n="@@bank_programs.hint.program_code"
              >A–Z, 0–9, _, − (3–32 chars).</span
            >
          </ng-template>
          <ng-template #codeErrTpl let-control>
            @if (control.errors?.['duplicate']) {
              <span i18n="@@bank_programs.clone.duplicate"
                >This program code is already in use.</span
              >
            }
          </ng-template>
        </nz-form-control>
      </nz-form-item>
    </div>
    <footer class="dialog-footer">
      <button
        nz-button
        type="button"
        (click)="cancel()"
        [disabled]="busy()"
        i18n="@@bank_programs.form.cancel"
      >
        Cancel
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="submit()"
        [disabled]="codeCtrl.invalid || busy()"
        [nzLoading]="busy()"
      >
        <span *ngIf="!busy()" i18n="@@bank_programs.clone.cta">Clone program</span>
        <span *ngIf="busy()" i18n="@@bank_programs.clone.cloning">Cloning…</span>
      </button>
    </footer>
  `,
  styles: [
    `
      .dialog-header {
        padding: var(--space-4) var(--space-4) 0;
      }
      .dialog-title {
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }
      .dialog-body {
        padding: var(--space-3) var(--space-4) var(--space-4);
      }
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--color-border-default);
      }
      .source {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3) 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .source .source-icon {
        color: var(--color-tonal-accent);
      }
      .source strong {
        color: var(--color-text-primary);
        font-family: var(--font-family-mono, monospace);
      }
      .full {
        width: 100%;
      }
    `,
  ],
})
export class CloneProgramDialog {
  private readonly dialogRef = inject(NzModalRef<CloneProgramDialog, CloneProgramDialogResult>);
  private readonly api = inject(BankProgramsApiService);
  private readonly notification = inject(NzNotificationService);
  private readonly errors = inject(ErrorCodeService);
  readonly data = inject<CloneProgramDialogData>(NZ_MODAL_DATA);

  readonly codeCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Z0-9_-]{3,32}$/)],
  });
  readonly busy = signal(false);

  cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close({});
  }

  async submit(): Promise<void> {
    if (this.codeCtrl.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.api.clone(this.data.sourceProgramCode, this.codeCtrl.value);
      this.dialogRef.close({ newProgramCode: res.data.programCode });
    } catch (err: unknown) {
      const envelope = (err as { error?: { code?: string } }).error;
      if (envelope?.code === 'PROGRAM_CODE_ALREADY_IN_USE') {
        this.codeCtrl.setErrors({ duplicate: true });
      } else {
        this.notification.error(
          $localize`:@@bank_programs.form.dismiss:Dismiss`,
          this.errors.toLocalizedMessage((envelope?.code ?? 'INTERNAL_ERROR') as never),
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
}
