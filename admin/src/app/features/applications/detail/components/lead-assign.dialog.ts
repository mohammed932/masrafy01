import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CloseCircleOutline } from '@ant-design/icons-angular/icons';
import { ApplicationsApiService } from '../../api/applications.api.service';
import { UsersService } from '../../../users/users.service';
import type { StaffAccountSummary } from '@core/auth/auth.types';

const ASSIGN_REASONS = [
  'INITIAL_ASSIGNMENT',
  'WORKLOAD_REBALANCE',
  'SKILL_MATCH',
  'AGENT_DEACTIVATED',
  'MANAGER_OVERRIDE',
  'OTHER',
] as const;

export interface LeadAssignDialogData {
  applicationId: string;
  currentAgentId?: string | null;
}

@Component({
  selector: 'app-lead-assign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 i18n="@@lead.assign.title">Assign / Reassign Lead</h2>
    </header>
    <div class="dialog-body">
      <form [formGroup]="form" class="form">
        <nz-form-item>
          <nz-form-label [nzFor]="'toAgentStaffId'" nzRequired i18n="@@lead.assign.agent"
            >Assign to agent</nz-form-label
          >
          <nz-form-control>
            <nz-select id="toAgentStaffId" formControlName="toAgentStaffId">
              @for (a of eligibleAgents(); track a.id) {
                <nz-option [nzValue]="a.id" [nzLabel]="a.name + ' (' + a.role + ')'"></nz-option>
              }
            </nz-select>
            @if (loadingAgents()) {
              <p class="hint" i18n="@@lead.assign.loading">Loading…</p>
            }
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzFor]="'reason'" nzRequired i18n="@@lead.assign.reason"
            >Reason</nz-form-label
          >
          <nz-form-control>
            <nz-select id="reason" formControlName="reason">
              @for (r of reasons; track r) {
                <nz-option [nzValue]="r" [nzLabel]="labelFor(r)"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzFor]="'notes'" i18n="@@lead.assign.notes"
            >Notes (optional)</nz-form-label
          >
          <nz-form-control>
            <textarea
              nz-input
              id="notes"
              formControlName="notes"
              rows="3"
              maxlength="500"
            ></textarea>
            <p class="hint align-end">{{ form.controls.notes.value.length }} / 500</p>
          </nz-form-control>
        </nz-form-item>

        @if (errorCode()) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline"></span>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>
    </div>
    <footer class="dialog-footer">
      <button nz-button nzType="default" type="button" (click)="cancel()" i18n="@@lead.assign.cancel">
        Cancel
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="submit()"
        [disabled]="!form.valid || submitting()"
        [attr.aria-busy]="submitting()"
        i18n="@@lead.assign.submit"
      >
        Assign
      </button>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        inline-size: 100%;
      }
      .dialog-header {
        padding: var(--space-4) var(--space-5);
        border-block-end: 1px solid var(--color-border-default);
      }
      .dialog-header h2 {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .dialog-body {
        padding: var(--space-4) var(--space-5);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        min-inline-size: 420px;
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .align-end {
        text-align: end;
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
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class LeadAssignDialog implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly users = inject(UsersService);
  private readonly dialogRef = inject<NzModalRef<LeadAssignDialog, boolean>>(NzModalRef);
  protected readonly data = inject<LeadAssignDialogData>(NZ_MODAL_DATA);

  protected readonly reasons = [...ASSIGN_REASONS];
  protected readonly eligibleAgents = signal<StaffAccountSummary[]>([]);
  protected readonly loadingAgents = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly form = new FormGroup({
    toAgentStaffId: new FormControl<string>(this.data.currentAgentId ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl<string>('WORKLOAD_REBALANCE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    try {
      const page = await this.users.list(1, 100);
      this.eligibleAgents.set(page.rows.filter((u) => u.isActive && u.role !== 'analyst'));
    } finally {
      this.loadingAgents.set(false);
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async submit(): Promise<void> {
    this.errorCode.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.value;
      await this.api.assignLead(this.data.applicationId, {
        toAgentStaffId: v.toAgentStaffId!,
        reason: v.reason!,
        notes: v.notes?.trim() || undefined,
      });
      this.dialogRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  labelFor(token: string): string {
    return token
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}

export { LeadAssignDialogData };
