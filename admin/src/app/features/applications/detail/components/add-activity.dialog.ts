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
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CloseCircleOutline } from '@ant-design/icons-angular/icons';
import { ApplicationsApiService } from '../../api/applications.api.service';
import {
  ActivityAttachmentsUploaderComponent,
  type UploadedAttachmentPayload,
} from './activity-attachments-uploader.component';

export interface AddActivityDialogData {
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
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzDatePickerModule,
    NzTagModule,
    ActivityAttachmentsUploaderComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 i18n="@@activity.add.title">Add Activity</h2>
    </header>
    <div class="dialog-body">
      <form [formGroup]="form" class="form">
        <div class="row-2">
          <nz-form-item>
            <nz-form-label [nzFor]="'activityType'" nzRequired i18n="@@activity.add.type"
              >Activity type</nz-form-label
            >
            <nz-form-control>
              <nz-select id="activityType" formControlName="activityType">
                @for (t of activityTypes; track t) {
                  <nz-option [nzValue]="t" [nzLabel]="labelFor(t)"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label [nzFor]="'reason'" nzRequired i18n="@@activity.add.reason"
              >Reason</nz-form-label
            >
            <nz-form-control>
              <nz-select id="reason" formControlName="reason">
                @for (r of reasonsForType(); track r) {
                  <nz-option [nzValue]="r" [nzLabel]="labelFor(r)"></nz-option>
                }
              </nz-select>
              @if (reasonsForType().length === 0) {
                <p class="hint" i18n="@@activity.add.noReasons">
                  No static reasons for this type yet.
                </p>
              }
            </nz-form-control>
          </nz-form-item>
        </div>

        @if (showDuration()) {
          <nz-form-item>
            <nz-form-label [nzFor]="'durationMinutes'" i18n="@@activity.add.duration"
              >Duration (minutes)</nz-form-label
            >
            <nz-form-control>
              <input
                nz-input
                id="durationMinutes"
                type="number"
                formControlName="durationMinutes"
                min="1"
              />
            </nz-form-control>
          </nz-form-item>
        }

        @if (showAttachments()) {
          <section class="attachments-section">
            <p class="section-label" i18n="@@activity.add.attachLabel">Attachments</p>
            <app-activity-attachments-uploader #uploader />
          </section>
        }

        <nz-form-item>
          <nz-form-label [nzFor]="'note'" i18n="@@activity.add.note">Note</nz-form-label>
          <nz-form-control>
            <textarea
              nz-input
              id="note"
              formControlName="note"
              rows="3"
              maxlength="2000"
            ></textarea>
            <p class="hint align-end">{{ form.controls.note.value.length }} / 2000</p>
          </nz-form-control>
        </nz-form-item>

        <fieldset class="outcome-fieldset">
          <legend i18n="@@activity.add.outcomeFlags">Outcome flags (max 3)</legend>
          <div class="chip-row">
            @for (flag of outcomeFlags; track flag) {
              <nz-tag
                class="chip"
                nzMode="checkable"
                [nzChecked]="isFlagChecked(flag)"
                (nzCheckedChange)="toggleFlag(flag, $event)"
              >
                {{ labelFor(flag) }}
              </nz-tag>
            }
          </div>
        </fieldset>

        <nz-form-item>
          <nz-form-label [nzFor]="'followUpAt'" i18n="@@activity.add.followUp"
            >Follow-up</nz-form-label
          >
          <nz-form-control>
            <nz-date-picker
              id="followUpAt"
              formControlName="followUpAt"
              nzFormat="yyyy-MM-dd"
            ></nz-date-picker>
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
    <footer class="dialog-footer actions">
      <button nz-button nzType="default" type="button" (click)="cancel()" i18n="@@activity.add.cancel">
        Cancel
      </button>
      <button
        nz-button
        nzType="default"
        type="button"
        (click)="save(true)"
        [disabled]="!form.valid || submitting()"
        i18n="@@activity.add.saveAdd"
      >
        Save & Add Another
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="save(false)"
        [disabled]="!form.valid || submitting()"
        [attr.aria-busy]="submitting()"
        i18n="@@activity.add.save"
      >
        Save
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
        max-height: 70vh;
        overflow-y: auto;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        inline-size: 100%;
        padding-block-end: var(--space-2);
      }
      .row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }
      @media (max-width: 600px) {
        .row-2 {
          grid-template-columns: 1fr;
        }
      }
      .attachments-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .section-label,
      .outcome-fieldset legend {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 var(--space-2);
        padding: 0;
      }
      .outcome-fieldset {
        border: 0;
        padding: 0;
        margin: 0;
      }
      .chip-row {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .chip {
        cursor: pointer;
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
      .dialog-footer.actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class AddActivityDialog {
  private readonly api = inject(ApplicationsApiService);
  private readonly dialogRef = inject<NzModalRef<AddActivityDialog, boolean>>(NzModalRef);
  protected readonly data = inject<AddActivityDialogData>(NZ_MODAL_DATA);

  protected readonly activityTypes = [...ALL_ACTIVITY_TYPES];
  protected readonly outcomeFlags = [...OUTCOME_FLAG_OPTIONS];

  protected readonly form = new FormGroup({
    activityType: new FormControl<string>(this.data.defaultActivityType ?? ALL_ACTIVITY_TYPES[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl<string>(
      this.data.reasonsByType[this.data.defaultActivityType ?? ALL_ACTIVITY_TYPES[0]]?.[0] ?? '',
      { nonNullable: true, validators: [Validators.required] },
    ),
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

  protected isFlagChecked(flag: string): boolean {
    return (this.form.controls.outcomeFlags.value ?? []).includes(flag);
  }

  protected toggleFlag(flag: string, checked: boolean): void {
    const current = this.form.controls.outcomeFlags.value ?? [];
    if (checked) {
      if (current.includes(flag)) return;
      this.form.controls.outcomeFlags.setValue([...current, flag]);
    } else {
      this.form.controls.outcomeFlags.setValue(current.filter((f) => f !== flag));
    }
  }

  @ViewChild('uploader')
  private readonly uploader?: ActivityAttachmentsUploaderComponent;

  constructor() {
    this.form.controls.activityType.valueChanges.subscribe((t) => {
      if (!t) return;
      this.currentType.set(t);
      const reasons = this.data.reasonsByType[t] ?? [];
      this.form.controls.reason.setValue(reasons[0] ?? '');
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
