import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { EyeOutline, FileImageOutline } from '@ant-design/icons-angular/icons';
import { StatusPillComponent, SkeletonRowsComponent, type StatusTone } from '@shared/ui';
import {
  ApplicationsApiService,
  type ApplicantDocuments,
  type ApplicantDocumentSide,
} from '../../api/applications.api.service';

interface SideView {
  labelKey: 'front' | 'back';
  label: string;
  doc: ApplicantDocumentSide | null;
}

/**
 * Applicant document binaries for the detail page: profile photo (shown inline
 * from a short-lived presigned URL) + National ID front/back. The NID number is
 * shown masked (last 4) by default; each image is revealed on demand via an
 * audited presigned URL (Constitution Principle VI). Only rendered for roles
 * allowed to view binaries — the parent gates this section with `*can`.
 */
@Component({
  selector: 'app-applicant-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NzButtonModule, NzIconModule, StatusPillComponent, SkeletonRowsComponent],
  providers: [provideNzIconsPatch([EyeOutline, FileImageOutline])],
  template: `
    <section class="documents">
      <h2 i18n="@@applications.documents.title">Documents</h2>

      @if (loading()) {
        <app-skeleton-rows
          [rows]="2"
          [cols]="[2, 3]"
          ariaLabel="Loading documents"
          i18n-ariaLabel="@@applications.documents.loading"
        />
      } @else if (docs()) {
        @let d = docs()!;
        <div class="doc-grid">
          <!-- Profile photo -->
          <article class="doc-tile">
            <span class="doc-label" i18n="@@applications.documents.photo">Profile photo</span>
            @if (d.profilePhoto; as photo) {
              <img class="photo" [src]="photo.url" alt="" />
            } @else {
              <div class="doc-placeholder" aria-hidden="true">
                <span nz-icon nzType="file-image" nzTheme="outline"></span>
              </div>
              <span class="doc-none" i18n="@@applications.documents.none">Not uploaded</span>
            }
          </article>

          <!-- National ID -->
          <article class="doc-tile doc-tile--id">
            <span class="doc-label" i18n="@@applications.documents.nationalId">National ID</span>
            @if (maskedNationalId()) {
              <code class="nid-number">{{ maskedNationalId() }}</code>
            }
            <div class="sides">
              @for (side of sides(); track side.labelKey) {
                <div class="side">
                  <span class="side-name">{{ side.label }}</span>
                  @if (side.doc) {
                    <app-status-pill
                      [tone]="statusTone(side.doc.status)"
                      [label]="humanize(side.doc.status)"
                    />
                    <button
                      nz-button
                      nzType="default"
                      nzSize="small"
                      [nzLoading]="revealing() === side.doc.id"
                      (click)="reveal(side.doc.id)"
                    >
                      <span nz-icon nzType="eye" nzTheme="outline"></span>
                      <span i18n="@@applications.documents.reveal">Reveal</span>
                    </button>
                  } @else {
                    <span class="doc-none" i18n="@@applications.documents.none">Not uploaded</span>
                  }
                </div>
              }
            </div>
          </article>
        </div>
      } @else {
        <p class="doc-empty" i18n="@@applications.documents.empty">
          No documents are available for this applicant.
        </p>
      }
    </section>
  `,
  styles: [
    `
      .documents {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      h2 {
        margin: 0;
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
      .doc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: var(--space-3);
      }
      .doc-tile {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .doc-label {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .photo {
        inline-size: 100%;
        max-block-size: 200px;
        object-fit: contain;
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }
      .doc-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        block-size: 96px;
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: 28px;
      }
      .nid-number {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: var(--text-sm);
        letter-spacing: 0.08em;
        color: var(--color-text-primary);
      }
      .sides {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .side {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .side-name {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        min-inline-size: 44px;
      }
      .side button {
        margin-inline-start: auto;
      }
      .doc-none {
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }
      .doc-empty {
        margin: 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class ApplicantDocumentsComponent implements OnInit {
  private readonly api = inject(ApplicationsApiService);

  readonly applicationId = input.required<string>();
  /** Masked National ID number (last 4) from the applicant profile, if declared. */
  readonly maskedNationalId = input<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly docs = signal<ApplicantDocuments | null>(null);
  protected readonly revealing = signal<string | null>(null);

  protected readonly sides = computed<SideView[]>(() => {
    const d = this.docs();
    return [
      {
        labelKey: 'front',
        label: $localize`:@@applications.documents.front:Front`,
        doc: d?.nationalId.front ?? null,
      },
      {
        labelKey: 'back',
        label: $localize`:@@applications.documents.back:Back`,
        doc: d?.nationalId.back ?? null,
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    try {
      this.docs.set(await this.api.getApplicantDocuments(this.applicationId()));
    } catch {
      // The HTTP error interceptor surfaces the typed toast; leave docs null so
      // the empty state renders.
    } finally {
      this.loading.set(false);
    }
  }

  /** Fetch a fresh presigned URL (audited server-side) and open the image. */
  protected async reveal(documentId: string): Promise<void> {
    if (this.revealing()) return;
    this.revealing.set(documentId);
    try {
      const { url } = await this.api.revealApplicantDocument(this.applicationId(), documentId);
      window.open(url, '_blank', 'noopener');
    } catch {
      // Interceptor handles the toast.
    } finally {
      this.revealing.set(null);
    }
  }

  protected statusTone(status: string): StatusTone {
    const s = status.toLowerCase();
    if (s.includes('verif')) return 'success';
    if (s.includes('reject')) return 'error';
    if (s.includes('upload')) return 'info';
    return 'neutral';
  }

  protected humanize(code: string): string {
    const s = code.replace(/_/g, ' ').trim();
    return s.length === 0 ? '—' : s.charAt(0).toUpperCase() + s.slice(1);
  }
}
