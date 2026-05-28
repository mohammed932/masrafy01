import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  PaperClipOutline,
  CheckCircleOutline,
  CloseCircleOutline,
  CloseOutline,
} from '@ant-design/icons-angular/icons';
import {
  ApplicationsApiService,
  type PresignedUploadResponse,
} from '../../api/applications.api.service';

export interface UploadedAttachmentPayload {
  documentId: string;
  documentType: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  uploadedBySource: string;
}

type PendingFileFormGroup = FormGroup<{
  documentType: FormControl<string>;
  uploadedBySource: FormControl<string>;
}>;

interface PendingFile {
  file: File;
  form: PendingFileFormGroup;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorCode?: string;
  uploaded?: PresignedUploadResponse;
}

const DOCUMENT_TYPE_OPTIONS = [
  'passport',
  'national_id',
  'bank_statement',
  'salary_slip',
  'utility_bill',
  'employment_letter',
  'tax_return',
  'cd_certificate',
  'other_document',
] as const;

const SOURCE_OPTIONS = [
  'whatsapp',
  'email',
  'in_person',
  'mobile_app',
  'courier',
  'other',
] as const;

@Component({
  selector: 'app-activity-attachments-uploader',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
  ],
  providers: [
    provideNzIconsPatch([PaperClipOutline, CheckCircleOutline, CloseCircleOutline, CloseOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="uploader">
      <div
        class="dropzone"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        [class.is-active]="dragActive()"
      >
        <input
          #fileInput
          type="file"
          multiple
          [accept]="acceptList"
          (change)="onFilesPicked($event)"
          class="visually-hidden"
        />
        <button
          nz-button
          nzType="default"
          type="button"
          (click)="fileInput.click()"
          i18n="@@activity.upload.browse"
        >
          Browse files
        </button>
        <p class="hint" i18n="@@activity.upload.hint">
          Drop JPG / PNG / HEIC / PDF here · max 10 MB each
        </p>
      </div>

      @if (files().length > 0) {
        <ul class="file-list">
          @for (entry of files(); track entry.file.name + entry.file.size) {
            <li class="file-row">
              <span nz-icon nzType="paper-clip" nzTheme="outline" class="file-icon"></span>
              <div class="file-info">
                <span class="file-name">{{ entry.file.name }}</span>
                <span class="file-size">{{ formatSize(entry.file.size) }}</span>
              </div>
              <nz-select
                class="field-type"
                [formControl]="entry.form.controls.documentType"
                [nzPlaceHolder]="docTypeLabel"
              >
                @for (t of docTypes; track t) {
                  <nz-option [nzValue]="t" [nzLabel]="t"></nz-option>
                }
              </nz-select>
              <nz-select
                class="field-source"
                [formControl]="entry.form.controls.uploadedBySource"
                [nzPlaceHolder]="sourceLabel"
              >
                @for (s of sources; track s) {
                  <nz-option [nzValue]="s" [nzLabel]="s"></nz-option>
                }
              </nz-select>
              <span class="status" [attr.data-status]="entry.status">
                @switch (entry.status) {
                  @case ('pending') {
                    <span i18n="@@activity.upload.pending">Pending</span>
                  }
                  @case ('uploading') {
                    <span i18n="@@activity.upload.uploading">Uploading…</span>
                  }
                  @case ('done') {
                    <span nz-icon nzType="check-circle" nzTheme="outline" class="ok"></span>
                  }
                  @case ('error') {
                    <span nz-icon nzType="close-circle" nzTheme="outline" class="err"></span>
                  }
                }
              </span>
              <button
                nz-button
                nzType="text"
                nzShape="circle"
                type="button"
                (click)="remove(entry)"
                [attr.aria-label]="removeLabel"
              >
                <span nz-icon nzType="close" nzTheme="outline"></span>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .uploader {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .dropzone {
        border: 2px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        padding: var(--space-5);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .dropzone.is-active {
        background: color-mix(in srgb, var(--color-tonal-accent) 8%, transparent);
        border-color: var(--color-tonal-accent);
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .visually-hidden {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
      .file-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .file-row {
        display: grid;
        grid-template-columns: 24px 1fr 160px 140px 28px 32px;
        gap: var(--space-3);
        align-items: center;
        padding: var(--space-2);
        background: var(--color-surface-elevated);
        border-radius: var(--radius-md);
      }
      .file-icon {
        color: var(--color-text-tertiary);
      }
      .file-info {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      .file-name {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-size {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
      }
      .status {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        display: inline-flex;
        align-items: center;
      }
      .status .ok {
        color: var(--color-success);
      }
      .status .err {
        color: var(--color-error);
      }
    `,
  ],
})
export class ActivityAttachmentsUploaderComponent {
  private readonly api = inject(ApplicationsApiService);

  @Output() applicationIdRequested = new EventEmitter<void>();
  @Output() uploadsCompleted = new EventEmitter<UploadedAttachmentPayload[]>();

  applicationId: string | null = null;

  protected readonly files = signal<PendingFile[]>([]);
  protected readonly dragActive = signal(false);
  protected readonly docTypes = [...DOCUMENT_TYPE_OPTIONS];
  protected readonly sources = [...SOURCE_OPTIONS];
  protected readonly acceptList = 'image/jpeg,image/png,image/heic,application/pdf';
  protected readonly removeLabel = $localize`:@@activity.upload.remove:Remove file`;
  protected readonly docTypeLabel = $localize`:@@activity.upload.docType:Document type`;
  protected readonly sourceLabel = $localize`:@@activity.upload.source:Source`;

  setApplicationId(id: string): void {
    this.applicationId = id;
  }

  defaultSource(s: string): void {
    for (const r of this.files()) {
      if (r.status === 'pending') {
        r.form.controls.uploadedBySource.setValue(s);
      }
    }
  }

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.dragActive.set(false);
    const dropped = ev.dataTransfer?.files;
    if (dropped) this.addFiles(Array.from(dropped));
  }

  onFilesPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  addFiles(list: File[]): void {
    const entries: PendingFile[] = list.map((f) => ({
      file: f,
      form: new FormGroup({
        documentType: new FormControl<string>(DOCUMENT_TYPE_OPTIONS[0], { nonNullable: true }),
        uploadedBySource: new FormControl<string>(SOURCE_OPTIONS[0], { nonNullable: true }),
      }),
      status: 'pending',
    }));
    this.files.update((prev) => [...prev, ...entries]);
  }

  remove(entry: PendingFile): void {
    this.files.update((rows) => rows.filter((r) => r !== entry));
  }

  hasFiles(): boolean {
    return this.files().length > 0;
  }

  async uploadAll(): Promise<UploadedAttachmentPayload[]> {
    if (!this.applicationId) return [];
    const entries = this.files();
    const payloads: UploadedAttachmentPayload[] = [];
    for (const entry of entries) {
      if (entry.status === 'done' && entry.uploaded) {
        payloads.push(this.toPayload(entry));
        continue;
      }
      this.updateStatus(entry, 'uploading');
      try {
        const { documentType, uploadedBySource } = entry.form.getRawValue();
        const resp = await this.api.requestUploadUrl({
          applicationId: this.applicationId,
          documentType,
          mimeType: entry.file.type,
          sizeBytes: entry.file.size,
          originalFilename: entry.file.name,
          uploadedBySource,
        });
        await this.api.putToS3(resp.uploadUrl, entry.file);
        const next = { ...entry, status: 'done' as const, uploaded: resp };
        this.files.update((rows) => rows.map((r) => (r === entry ? next : r)));
        payloads.push(this.toPayload(next));
      } catch {
        this.updateStatus(entry, 'error');
      }
    }
    this.uploadsCompleted.emit(payloads);
    return payloads;
  }

  reset(): void {
    this.files.set([]);
  }

  private updateStatus(entry: PendingFile, status: PendingFile['status']): void {
    this.files.update((rows) => rows.map((r) => (r === entry ? { ...r, status } : r)));
  }

  private toPayload(entry: PendingFile): UploadedAttachmentPayload {
    const { documentType, uploadedBySource } = entry.form.getRawValue();
    return {
      documentId: entry.uploaded!.documentId,
      documentType,
      s3Key: entry.uploaded!.s3Key,
      mimeType: entry.file.type,
      sizeBytes: entry.file.size,
      originalFilename: entry.file.name,
      uploadedBySource,
    };
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
