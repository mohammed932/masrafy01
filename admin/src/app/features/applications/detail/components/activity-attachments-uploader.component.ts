import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
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

interface PendingFile {
  file: File;
  documentType: string;
  uploadedBySource: string;
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
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
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
          mat-stroked-button
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
              <mat-icon class="file-icon">attach_file</mat-icon>
              <div class="file-info">
                <span class="file-name">{{ entry.file.name }}</span>
                <span class="file-size">{{ formatSize(entry.file.size) }}</span>
              </div>
              <mat-form-field appearance="outline" class="field-type">
                <mat-label i18n="@@activity.upload.docType">Document type</mat-label>
                <mat-select
                  [value]="entry.documentType"
                  (selectionChange)="setDocType(entry, $event.value)"
                >
                  @for (t of docTypes; track t) {
                    <mat-option [value]="t">{{ t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="field-source">
                <mat-label i18n="@@activity.upload.source">Source</mat-label>
                <mat-select
                  [value]="entry.uploadedBySource"
                  (selectionChange)="setSource(entry, $event.value)"
                >
                  @for (s of sources; track s) {
                    <mat-option [value]="s">{{ s }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <span class="status" [attr.data-status]="entry.status">
                @switch (entry.status) {
                  @case ('pending') {
                    <span i18n="@@activity.upload.pending">Pending</span>
                  }
                  @case ('uploading') {
                    <span i18n="@@activity.upload.uploading">Uploading…</span>
                  }
                  @case ('done') {
                    <mat-icon class="ok">check_circle</mat-icon>
                  }
                  @case ('error') {
                    <mat-icon class="err">error</mat-icon>
                  }
                }
              </span>
              <button
                mat-icon-button
                type="button"
                (click)="remove(entry)"
                [attr.aria-label]="removeLabel"
              >
                <mat-icon>close</mat-icon>
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
        transition: background var(--motion-duration-fast) var(--motion-easing-standard),
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
      .status mat-icon.ok {
        color: var(--color-success);
      }
      .status mat-icon.err {
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

  setApplicationId(id: string): void {
    this.applicationId = id;
  }

  defaultSource(s: string): void {
    this.files.update((rows) =>
      rows.map((r) => (r.status === 'pending' ? { ...r, uploadedBySource: s } : r)),
    );
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
      documentType: DOCUMENT_TYPE_OPTIONS[0],
      uploadedBySource: SOURCE_OPTIONS[0],
      status: 'pending',
    }));
    this.files.update((prev) => [...prev, ...entries]);
  }

  setDocType(entry: PendingFile, value: string): void {
    this.files.update((rows) => rows.map((r) => (r === entry ? { ...r, documentType: value } : r)));
  }

  setSource(entry: PendingFile, value: string): void {
    this.files.update((rows) =>
      rows.map((r) => (r === entry ? { ...r, uploadedBySource: value } : r)),
    );
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
        const resp = await this.api.requestUploadUrl({
          applicationId: this.applicationId,
          documentType: entry.documentType,
          mimeType: entry.file.type,
          sizeBytes: entry.file.size,
          originalFilename: entry.file.name,
          uploadedBySource: entry.uploadedBySource,
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
    return {
      documentId: entry.uploaded!.documentId,
      documentType: entry.documentType,
      s3Key: entry.uploaded!.s3Key,
      mimeType: entry.file.type,
      sizeBytes: entry.file.size,
      originalFilename: entry.file.name,
      uploadedBySource: entry.uploadedBySource,
    };
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
