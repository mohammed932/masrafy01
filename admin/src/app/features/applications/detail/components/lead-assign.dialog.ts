import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
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

interface LeadAssignDialogData {
  applicationId: string;
  currentAgentId?: string | null;
}

@Component({
  selector: 'app-lead-assign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@lead.assign.title">Assign / Reassign Lead</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@lead.assign.agent">Assign to agent</mat-label>
          <mat-select formControlName="toAgentStaffId">
            @for (a of eligibleAgents(); track a.id) {
              <mat-option [value]="a.id">{{ a.name }} ({{ a.role }})</mat-option>
            }
          </mat-select>
          @if (loadingAgents()) {
            <mat-hint i18n="@@lead.assign.loading">Loading…</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@lead.assign.reason">Reason</mat-label>
          <mat-select formControlName="reason">
            @for (r of reasons; track r) {
              <mat-option [value]="r">{{ labelFor(r) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@lead.assign.notes">Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="3" maxlength="500"></textarea>
          <mat-hint align="end">{{ form.controls.notes.value.length }} / 500</mat-hint>
        </mat-form-field>

        @if (errorCode()) {
          <p class="error" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()" i18n="@@lead.assign.cancel">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="submit()"
        [disabled]="!form.valid || submitting()"
        [attr.aria-busy]="submitting()"
        i18n="@@lead.assign.submit"
      >
        Assign
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        min-inline-size: 420px;
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
    `,
  ],
})
export class LeadAssignDialog implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly users = inject(UsersService);
  private readonly dialogRef = inject<MatDialogRef<LeadAssignDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<LeadAssignDialogData>(MAT_DIALOG_DATA);

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
