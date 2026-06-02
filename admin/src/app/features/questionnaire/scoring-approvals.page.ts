import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type PendingWeightSet,
} from './questionnaire.api.service';

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
    RouterLink,
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
          Review pending per-program weight changes. A different admin than the maker must approve.
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
                <a
                  class="prog-link"
                  [routerLink]="['/scoring-approvals', 'weights', set.program.category, set.bankProgramId]"
                >
                  <span class="bank">{{ set.program.bankName }}</span>
                  <span class="prog">{{ programName(set) }}</span>
                </a>
                <nz-tag nzColor="warning" i18n="@@scoring.status.pending">PENDING</nz-tag>
              </div>
              <p class="muted small">
                <span class="cat-chip">{{ set.program.category }}</span> ·
                <span i18n="@@scoring.approvals.version">Version</span>
                <span class="mono">#{{ set.versionNumber }}</span> ·
                <span i18n="@@scoring.approvals.maker">maker</span>
                <span class="mono">{{ set.createdBy }}</span>
              </p>
              <ul class="weights">
                @for (w of weightRows(set); track w.code) {
                  <li><span>{{ w.code }}</span><span class="mono">{{ w.points }}</span></li>
                }
                <li class="total" [class.bad]="total(set) !== 100">
                  <span i18n="@@scoring.approvals.total">Total</span>
                  <span class="mono">{{ total(set) }} / 100</span>
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
          <label for="reject-reason" class="field-label" i18n="@@scoring.approvals.reason_label">
            Reason for rejection
          </label>
          <textarea
            id="reject-reason"
            nz-input
            [formControl]="reason"
            rows="3"
            placeholder="Shown to the maker"
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
      .prog-link {
        display: flex; flex-direction: column; gap: 2px; text-decoration: none;
        color: inherit; min-inline-size: 0;
      }
      .prog-link:hover .prog { text-decoration: underline; }
      .prog-link .bank { font-weight: 600; font-size: 14px; }
      .prog-link .prog { font-size: 13px; color: var(--ant-text-color-secondary, #6b7280); }
      .cat-chip {
        text-transform: capitalize; font-size: 11px; font-weight: 600;
        color: var(--ant-primary-color, #0869c3);
        background: var(--ant-primary-color-outline, rgba(8, 105, 195, 0.12));
        padding: 1px 8px; border-radius: 999px;
      }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
      .weights { list-style: none; margin: var(--space-3, 12px) 0 0; padding: 0; }
      .weights li { display: flex; justify-content: space-between; padding-block: 4px; border-block-end: 1px solid var(--ant-border-color-split, #f0f0f0); }
      .weights .total { font-weight: 600; border-block-end: none; }
      .weights .total.bad { color: var(--ant-error-color, #c1666b); }
      .field-label { display: block; margin-block-end: var(--space-2, 8px); font-weight: 500; }
    `,
  ],
})
export class ScoringApprovalsPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);
  /** Active admin locale picks the program label language (ar build → Arabic). */
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly rows = signal<PendingWeightSet[]>([]);
  readonly loading = signal(true);
  readonly rejecting = signal<PendingWeightSet | null>(null);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  /** Program display name, Arabic-first with English fallback. */
  programName(set: PendingWeightSet): string {
    return (this.isAr && set.program.friendlyNameAr) || set.program.friendlyName;
  }

  weightRows(set: PendingWeightSet): { code: string; points: number }[] {
    return Object.entries(set.weights ?? {}).map(([code, points]) => ({ code, points }));
  }

  total(set: PendingWeightSet): number {
    return Object.values(set.weights ?? {}).reduce((a, b) => a + Number(b), 0);
  }

  async approve(set: PendingWeightSet): Promise<void> {
    await this.api.approveWeights(set.id);
    this.message.success($localize`:@@scoring.approvals.approved:Weight set activated`);
    await this.reload();
  }

  openReject(set: PendingWeightSet): void {
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
