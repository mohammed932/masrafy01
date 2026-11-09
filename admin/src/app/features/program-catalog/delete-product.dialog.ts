/**
 * Permanently delete a no-payslip product (v33.0.0).
 *
 * Typed confirmation, like every other hard delete on this dashboard. The server refuses
 * while anything still quotes from the product (`SURROGATE_PRODUCT_IN_USE`); that refusal is
 * rendered HERE, as the list of names and programs to move first, rather than as a toast that
 * is gone before it is read — and Switch off is offered as the reversible alternative.
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { CloseCircleOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';

export interface DeleteProductDialogData {
  key: string;
  /** The name in the operator's locale — what they type to confirm. */
  label: string;
}

interface InUse {
  names: string[];
  programCodes: string[];
  capPrograms: string[];
}

@Component({
  selector: 'app-delete-product-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, NzButtonModule, NzFormModule, NzIconModule, NzInputModule],
  providers: [provideNzIconsPatch([CloseCircleOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 class="dialog-title">
        <span
          class="warn-icon"
          nz-icon
          nzType="warning"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        <span i18n="@@pdel.title">Permanently delete this product?</span>
      </h2>
    </header>
    <div class="dialog-body">
      @if (inUse(); as use) {
        <div class="in-use" role="alert">
          <p class="in-use-title">
            <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@pdel.in_use">It can't be deleted while these still use it.</span>
          </p>
          @if (use.names.length > 0) {
            <p class="group-label" i18n="@@pdel.names">Catalog names</p>
            <ul class="chips">
              @for (n of use.names; track n) {
                <li>
                  <bdi>{{ n }}</bdi>
                </li>
              }
            </ul>
          }
          @if (use.programCodes.length + use.capPrograms.length > 0) {
            <p class="group-label" i18n="@@pdel.programs">Bank programs</p>
            <ul class="chips">
              @for (c of allPrograms(use); track c) {
                <li>
                  <bdi>{{ c }}</bdi>
                </li>
              }
            </ul>
          }
          <p class="in-use-body" i18n="@@pdel.in_use_body">
            Move them to another product first — or switch this one off, which stops it quoting and
            can be undone.
          </p>
        </div>
      } @else {
        <p i18n="@@pdel.body">
          This can't be undone. Its calculation, figures and the questions only it asked are
          removed. Offers already issued keep their own figures.
        </p>
        <nz-form-item class="full">
          <nz-form-label nzFor="pdel-confirm" i18n="@@pdel.confirm_label"
            >Type the product's name to confirm</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="pdel-confirm" [formControl]="confirmCtrl" autocomplete="off" />
          </nz-form-control>
        </nz-form-item>
        <p class="name">
          <bdi>{{ data.label }}</bdi>
        </p>
      }
    </div>
    <footer class="dialog-footer">
      <button nz-button type="button" (click)="cancel()" [disabled]="busy()" i18n="@@pdel.cancel">
        Cancel
      </button>
      @if (!inUse()) {
        <button
          nz-button
          nzType="primary"
          nzDanger
          type="button"
          (click)="submit()"
          [disabled]="confirmCtrl.value.trim() !== data.label || busy()"
          [nzLoading]="busy()"
          i18n="@@pdel.cta"
        >
          Delete product
        </button>
      }
    </footer>
  `,
  styles: [
    `
      .dialog-header {
        padding: var(--space-4) var(--space-4) 0;
      }
      .dialog-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        margin: 0;
        color: var(--text-primary);
      }
      .warn-icon {
        color: var(--warning);
      }
      .dialog-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4) var(--space-4);
        color: var(--text-primary);
      }
      .dialog-body p {
        margin: 0;
      }
      .full {
        inline-size: 100%;
        margin: 0;
      }
      .name {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-block-start: 1px solid var(--border-subtle);
      }
      .in-use {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
      }
      .in-use-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-weight: var(--font-semibold);
        color: var(--error-strong);
      }
      .in-use-body {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .group-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .chips li {
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
      }
    `,
  ],
})
export class DeleteProductDialogComponent {
  private readonly dialogRef = inject(NzModalRef<DeleteProductDialogComponent, boolean>);
  private readonly api = inject(BankProgramsApiService);
  private readonly message = inject(NzMessageService);
  protected readonly data = inject<DeleteProductDialogData>(NZ_MODAL_DATA);

  protected readonly confirmCtrl = new FormControl('', { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly inUse = signal<InUse | null>(null);

  protected allPrograms(use: InUse): string[] {
    return [...new Set([...use.programCodes, ...use.capPrograms])];
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  protected async submit(): Promise<void> {
    if (this.confirmCtrl.value.trim() !== this.data.label || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.deleteSurrogateProduct(this.data.key);
      this.message.success($localize`:@@pdel.done:Product deleted.`);
      this.dialogRef.close(true);
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Partial<InUse> } }).error;
      if (envelope?.code === 'SURROGATE_PRODUCT_IN_USE') {
        this.inUse.set({
          names: envelope.meta?.names ?? [],
          programCodes: envelope.meta?.programCodes ?? [],
          capPrograms: envelope.meta?.capPrograms ?? [],
        });
      }
    } finally {
      this.busy.set(false);
    }
  }
}
