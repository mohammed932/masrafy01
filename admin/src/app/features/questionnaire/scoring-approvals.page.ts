import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { QuestionnaireApiService, type ScoringWeightSet } from './questionnaire.api.service';

/**
 * Scoring approvals inbox (Constitution V v4.1.0 maker-checker — checker side).
 * Lists PENDING_APPROVAL weight sets; a DIFFERENT admin approves (atomic
 * activate+archive server-side) or rejects with a reason. The approver≠maker
 * rule is enforced server-side; the global error interceptor surfaces
 * APPROVER_MUST_DIFFER_FROM_MAKER if violated.
 */
@Component({
  standalone: true,
  selector: 'mf-scoring-approvals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzTagModule,
    NzModalModule,
    NzInputModule,
    NzSpinModule,
  ],
  template: `
    <section class="page">
      <header class="page-head">
        <h1 i18n="@@scoring.approvals.title">Scoring weight approvals</h1>
        <p class="muted" i18n="@@scoring.approvals.subtitle">
          Review pending per-bank weight changes. A different admin than the maker must approve.
        </p>
      </header>

      @if (loading()) {
        <nz-spin nzSimple />
      } @else if (rows().length === 0) {
        <nz-empty nzNotFoundContent="No weight changes awaiting approval" i18n-nzNotFoundContent="@@scoring.approvals.empty" />
      } @else {
        <div class="cards">
          @for (set of rows(); track set.id) {
            <nz-card class="set-card">
              <div class="row between">
                <span class="mono prog">{{ set.bankProgramId }}</span>
                <nz-tag nzColor="warning" i18n="@@scoring.status.pending">PENDING</nz-tag>
              </div>
              <p class="muted small">
                <span i18n="@@scoring.approvals.version">Version</span>
                <span class="mono">#{{ set.versionNumber }}</span> ·
                <span i18n="@@scoring.approvals.maker">maker</span>
                <span class="mono">{{ set.createdBy }}</span>
              </p>
              <ul class="weights">
                @for (w of weightRows(set); track w.code) {
                  <li><span>{{ w.code }}</span><span class="mono">{{ w.points }}</span></li>
                }
                <li class="total">
                  <span i18n="@@scoring.approvals.total">Total</span>
                  <span class="mono">{{ total(set) }}</span>
                </li>
              </ul>
              <div class="row gap actions">
                <button nz-button nzType="primary" (click)="approve(set)" i18n="@@scoring.approvals.approve">
                  Approve
                </button>
                <button nz-button nzDanger (click)="openReject(set)" i18n="@@scoring.approvals.reject">
                  Reject
                </button>
              </div>
            </nz-card>
          }
        </div>
      }

      <nz-modal
        [nzVisible]="rejecting() !== null"
        nzTitle="Reject weight change"
        i18n-nzTitle="@@scoring.approvals.reject_title"
        (nzOnCancel)="rejecting.set(null)"
        (nzOnOk)="confirmReject()"
        [nzOkDisabled]="reason.invalid"
        nzOkDanger
      >
        <ng-container *nzModalContent>
          <textarea
            nz-input
            [formControl]="reason"
            rows="3"
            placeholder="Reason (shown to the maker)"
            i18n-placeholder="@@scoring.approvals.reason_ph"
          ></textarea>
        </ng-container>
      </nz-modal>
    </section>
  `,
  styles: [
    `
      .page { padding: var(--space-6, 24px); }
      .page-head { margin-block-end: var(--space-5, 20px); }
      .muted { color: var(--ant-text-color-secondary, #6b7280); }
      .small { font-size: 13px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4, 16px); }
      .row { display: flex; align-items: center; }
      .between { justify-content: space-between; }
      .gap { gap: var(--space-3, 12px); }
      .actions { margin-block-start: var(--space-4, 16px); }
      .prog { font-size: 13px; }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
      .weights { list-style: none; margin: var(--space-3, 12px) 0 0; padding: 0; }
      .weights li { display: flex; justify-content: space-between; padding-block: 4px; border-block-end: 1px solid var(--ant-border-color-split, #f0f0f0); }
      .weights .total { font-weight: 600; border-block-end: none; }
    `,
  ],
})
export class ScoringApprovalsPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);

  readonly rows = signal<ScoringWeightSet[]>([]);
  readonly loading = signal(true);
  readonly rejecting = signal<ScoringWeightSet | null>(null);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  weightRows(set: ScoringWeightSet): { code: string; points: number }[] {
    return Object.entries(set.weights ?? {}).map(([code, points]) => ({ code, points }));
  }

  total(set: ScoringWeightSet): number {
    return Object.values(set.weights ?? {}).reduce((a, b) => a + Number(b), 0);
  }

  async approve(set: ScoringWeightSet): Promise<void> {
    await this.api.approveWeights(set.id);
    this.message.success($localize`:@@scoring.approvals.approved:Weight set activated`);
    await this.reload();
  }

  openReject(set: ScoringWeightSet): void {
    this.reason.reset('');
    this.rejecting.set(set);
  }

  async confirmReject(): Promise<void> {
    const set = this.rejecting();
    if (!set || this.reason.invalid) return;
    await this.api.rejectWeights(set.id, this.reason.value);
    this.rejecting.set(null);
    this.message.success($localize`:@@scoring.approvals.rejected:Weight set rejected`);
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.rows.set(await this.api.pendingInbox());
    } finally {
      this.loading.set(false);
    }
  }
}
