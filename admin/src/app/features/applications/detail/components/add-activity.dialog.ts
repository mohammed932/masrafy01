import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatChipsModule } from '@angular/material/chips';
import { provideNativeDateAdapter } from '@angular/material/core';
import { ApplicationsApiService } from '../../api/applications.api.service';
import {
  ActivityAttachmentsUploaderComponent,
  type UploadedAttachmentPayload,
} from './activity-attachments-uploader.component';

interface AddActivityDialogData {
  applicationId: string;
  defaultActivityType?: string;
  defaultUploadedBySource?: string;
  reasonsByType: Record<string, readonly string[]>;
}

const ALL_ACTIVITY_TYPES = [
  'CALLED_USER',
  'SENT_WHATSAPP',
  'SENT_EMAIL',
  'RECEIVED_DOCUMENTS',
  'REVIEWED_DOCUMENTS',
  'REQUESTED_MORE_DOCS',
  'UPDATED_APPLICANT_INFO',
  'MARKED_AS_REVIEWED',
  'INTERNAL_NOTE',
  'SUBMITTED_TO_BANK',
  'BANK_RESPONDED',
] as const;

const TYPES_REQUIRING_DURATION = ['CALLED_USER'] as const;
const TYPES_ALLOWING_ATTACHMENTS = [
  'RECEIVED_DOCUMENTS',
  'REVIEWED_DOCUMENTS',
  'REQUESTED_MORE_DOCS',
] as const;

const OUTCOME_FLAG_OPTIONS = [
  'USER_CONFIRMED',
  'USER_REQUESTED_RESCHEDULE',
  'USER_UNREACHABLE',
  'INFORMATION_CAPTURED',
  'NEEDS_MANAGER',
] as const;

@Component({
  selector: 'app-add-activity-dialog',
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
    MatDatepickerModule,
    MatChipsModule,
    ActivityAttachmentsUploaderComponent,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@activity.add.title">Add Activity</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@activity.add.type">Activity type</mat-label>
          <mat-select formControlName="activityType">
            @for (t of activityTypes; track t) {
              <mat-option [value]="t">{{ labelFor(t) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@activity.add.reason">Reason</mat-label>
          <mat-select formControlName="reason">
            @for (r of reasonsForType(); track r) {
              <mat-option [value]="r">{{ labelFor(r) }}</mat-option>
            }
          </mat-select>
          @if (reasonsForType().length === 0) {
            <mat-hint i18n="@@activity.add.noReasons"
              >No static reasons for this type yet.</mat-hint
            >
          }
        </mat-form-field>

        @if (showDuration()) {
          <mat-form-field appearance="outline">
            <mat-label i18n="@@activity.add.duration">Duration (minutes)</mat-label>
            <input matInput type="number" formControlName="durationMinutes" min="1" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label i18n="@@activity.add.note">Note</mat-label>
          <textarea matInput formControlName="note" rows="4" maxlength="2000"></textarea>
          <mat-hint align="end"> {{ form.controls.note.value?.length ?? 0 }} / 2000 </mat-hint>
        </mat-form-field>

        <fieldset class="outcome-fieldset">
          <legend i18n="@@activity.add.outcomeFlags">Outcome flags (max 3)</legend>
          <mat-chip-listbox formControlName="outcomeFlags" multiple>
            @for (flag of outcomeFlags; track flag) {
              <mat-chip-option [value]="flag">{{ labelFor(flag) }}</mat-chip-option>
            }
          </mat-chip-listbox>
        </fieldset>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@activity.add.followUp">Follow-up</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="followUpAt" />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        @if (showAttachments()) {
          <app-activity-attachments-uploader #uploader />
        }

        @if (errorCode()) {
          <p class="error" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="actions">
      <button mat-button type="button" (click)="cancel()" i18n="@@activity.add.cancel">
        Cancel
      </button>
      <button
        mat-stroked-button
        type="button"
        (click)="save(true)"
        [disabled]="!form.valid || submitting()"
        i18n="@@activity.add.saveAdd"
      >
        Save & Add Another
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="save(false)"
        [disabled]="!form.valid || submitting()"
        [attr.aria-busy]="submitting()"
        i18n="@@activity.add.save"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        min-inline-size: 480px;
        max-inline-size: 720px;
      }
      .outcome-fieldset {
        border: 0;
        padding: 0;
        margin: 0;
      }
      .outcome-fieldset legend {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-block-end: var(--space-2);
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
      .actions {
        padding: var(--space-3) var(--space-4);
        gap: var(--space-2);
      }
    `,
  ],
})
export class AddActivityDialog {
  private readonly api = inject(ApplicationsApiService);
  private readonly dialogRef = inject<MatDialogRef<AddActivityDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<AddActivityDialogData>(MAT_DIALOG_DATA);

  protected readonly activityTypes = [...ALL_ACTIVITY_TYPES];
  protected readonly outcomeFlags = [...OUTCOME_FLAG_OPTIONS];

  protected readonly form = new FormGroup({
    activityType: new FormControl<string>(this.data.defaultActivityType ?? ALL_ACTIVITY_TYPES[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl<string>('', { nonNullable: true }),
    durationMinutes: new FormControl<number | null>(null),
    outcomeFlags: new FormControl<string[]>([], { nonNullable: true }),
    followUpAt: new FormControl<Date | null>(null),
  });

  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<string | null>(null);
  protected readonly currentType = signal<string>(
    this.data.defaultActivityType ?? ALL_ACTIVITY_TYPES[0],
  );

  protected readonly showDuration = computed(() =>
    (TYPES_REQUIRING_DURATION as readonly string[]).includes(this.currentType()),
  );
  protected readonly showAttachments = computed(() =>
    (TYPES_ALLOWING_ATTACHMENTS as readonly string[]).includes(this.currentType()),
  );

  protected reasonsForType(): readonly string[] {
    return this.data.reasonsByType[this.currentType()] ?? [];
  }

  @ViewChild('uploader')
  private readonly uploader?: ActivityAttachmentsUploaderComponent;

  constructor() {
    this.form.controls.activityType.valueChanges.subscribe((t) => {
      if (!t) return;
      this.currentType.set(t);
      this.form.controls.reason.setValue('');
      if (!(TYPES_REQUIRING_DURATION as readonly string[]).includes(t)) {
        this.form.controls.durationMinutes.setValue(null);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async save(keepOpen: boolean): Promise<void> {
    this.errorCode.set(null);
    this.submitting.set(true);
    try {
      let attachments: UploadedAttachmentPayload[] = [];
      if (this.showAttachments() && this.uploader && this.uploader.hasFiles()) {
        this.uploader.setApplicationId(this.data.applicationId);
        attachments = await this.uploader.uploadAll();
      }

      const v = this.form.value;
      await this.api.createActivity(this.data.applicationId, {
        activityType: v.activityType!,
        reason: v.reason!,
        note: v.note?.trim() || undefined,
        durationMinutes: v.durationMinutes ?? undefined,
        outcomeFlags: v.outcomeFlags && v.outcomeFlags.length > 0 ? v.outcomeFlags : undefined,
        followUpAt: v.followUpAt ? new Date(v.followUpAt).toISOString() : undefined,
        attachedDocuments: attachments.length > 0 ? attachments : undefined,
      });

      if (keepOpen) {
        this.form.reset({
          activityType: this.currentType(),
          reason: '',
          note: '',
          durationMinutes: null,
          outcomeFlags: [],
          followUpAt: null,
        });
        this.uploader?.reset();
      } else {
        this.dialogRef.close(true);
      }
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

export { AddActivityDialogData };
