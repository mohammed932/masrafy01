import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  WarningOutline,
  CloseCircleOutline,
} from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs.api.service';

export interface DeleteProgramDialogData {
  programCode: string;
  friendlyName: string;
}

@Component({
  selector: 'app-delete-program-dialog',
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
  providers: [provideNzIconsPatch([WarningOutline, CloseCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 class="dialog-title">
        <span class="warn-icon" nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@bank_programs.delete.title">Permanently delete this program?</span>
      </h2>
    </header>
    <div class="dialog-body">
      <p i18n="@@bank_programs.delete.body">
        This action cannot be undone. Existing bank offers referencing this program will block
        deletion; in that case, deactivate the program instead.
      </p>
      <p class="row">
        <strong>{{ data.programCode }}</strong>
        <em>· {{ data.friendlyName }}</em>
      </p>

      <ng-container *ngIf="offerCount() === null">
        <nz-form-item class="full">
          <nz-form-label [nzFor]="'confirmCode'" i18n="@@bank_programs.delete.confirm_label"
            >Type the program code to confirm</nz-form-label
          >
          <nz-form-control [nzExtra]="confirmHint">
            <input nz-input id="confirmCode" [formControl]="confirmCtrl" />
            <ng-template #confirmHint>
              <span i18n="@@bank_programs.delete.confirm_hint">Must match exactly.</span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>
      </ng-container>

      <ng-container *ngIf="offerCount() !== null">
        <p class="has-offers">
          <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.delete.has_offers">
            This program has {{ offerCount() }} referencing offers. Deactivate it instead.
          </span>
        </p>
      </ng-container>
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
        *ngIf="offerCount() === null"
        nz-button
        nzType="primary"
        nzDanger
        type="button"
        (click)="submit()"
        [disabled]="confirmCtrl.value !== data.programCode || busy()"
        [nzLoading]="busy()"
      >
        <span *ngIf="!busy()" i18n="@@bank_programs.delete.cta">Delete program</span>
        <span *ngIf="busy()" i18n="@@bank_programs.delete.deleting">Deleting…</span>
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
      .warn-icon {
        color: var(--color-warning);
        margin-inline-end: var(--space-2);
        vertical-align: middle;
      }
      .row {
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
      }
      .row strong {
        font-family: var(--font-family-mono, monospace);
        color: var(--color-text-primary);
      }
      .row em {
        color: var(--color-text-secondary);
      }
      .full {
        width: 100%;
      }
      .has-offers {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-sm);
      }
    `,
  ],
})
export class DeleteProgramDialog {
  private readonly dialogRef = inject(NzModalRef<DeleteProgramDialog, boolean>);
  private readonly api = inject(BankProgramsApiService);
  private readonly message = inject(NzMessageService);
  private readonly notification = inject(NzNotificationService);
  private readonly errors = inject(ErrorCodeService);
  readonly data = inject<DeleteProgramDialogData>(NZ_MODAL_DATA);

  readonly confirmCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly busy = signal(false);
  readonly offerCount = signal<number | null>(null);

  cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  async submit(): Promise<void> {
    if (this.confirmCtrl.value !== this.data.programCode || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.delete(this.data.programCode, this.data.programCode);
      this.message.success($localize`:@@bank_programs.delete.success:Program deleted.`, {
        nzDuration: 4000,
      });
      this.dialogRef.close(true);
    } catch (err: unknown) {
      const envelope = (err as { error?: { code?: string; meta?: { offerCount?: number } } }).error;
      if (
        envelope?.code === 'BANK_PROGRAM_HAS_OFFERS' &&
        typeof envelope.meta?.offerCount === 'number'
      ) {
        this.offerCount.set(envelope.meta.offerCount);
      } else {
        this.notification.error(
          $localize`:@@bank_programs.form.dismiss:Dismiss`,
          this.errors.toLocalizedMessage(
            (envelope?.code ?? 'INTERNAL_ERROR') as never,
            envelope?.meta,
          ),
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
}
