import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type LoanCategory,
  type ProgramMeta,
  type ScoringFactor,
} from './questionnaire.api.service';

/**
 * Scoring weights editor (maker side, Constitution V v4.1.0). Edit per-factor
 * points for a bank program; the running total must equal exactly 100 before
 * Submit-for-approval is enabled. A DIFFERENT admin approves it in the inbox.
 */
@Component({
  standalone: true,
  selector: 'mf-scoring-weights-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzTagModule,
    NzSpinModule,
  ],
  template: `
    <section class="page">
      <header class="page-head">
        <a routerLink="/scoring-approvals" class="back" i18n="@@scoring.editor.back">← Approvals inbox</a>
        <h1 i18n="@@scoring.editor.title">Approval scoring weights</h1>
        @if (program(); as p) {
          <p class="prog-line">
            <span class="bank">{{ p.bankName }}</span>
            <span class="sep">—</span>
            <span class="prog">{{ programName(p) }}</span>
            <span class="cat-chip">{{ p.category }}</span>
          </p>
          <p class="muted small caption">
            <span i18n="@@scoring.editor.hint">Weights are specific to this program — other programs at this bank are weighted independently.</span>
            <span class="mono id">{{ programId }}</span>
          </p>
        }
      </header>

      @if (loading()) {
        <nz-spin nzSimple />
      } @else {
        <nz-card>
          <form [formGroup]="form" class="weights">
            @for (f of factors(); track f.code) {
              <div class="weight-row">
                <div class="labels">
                  <span class="label">{{ rowLabel(f) }}</span>
                  <span class="mono code">{{ f.code }}</span>
                  @if (f.kind === 'COMPUTED') {
                    <nz-tag i18n="@@scoring.editor.computed">computed</nz-tag>
                  }
                </div>
                <nz-input-number
                  [formControlName]="f.code"
                  [nzMin]="0"
                  [nzMax]="100"
                  [nzStep]="1"
                  aria-label="weight points"
                />
              </div>
            }
          </form>

          <div class="total-bar" [class.bad]="total() !== 100">
            <span i18n="@@scoring.editor.total">Total</span>
            <span class="mono">{{ total() }} / 100</span>
          </div>

          <div class="row gap actions">
            <button nz-button (click)="saveDraft()" i18n="@@scoring.editor.save">Save draft</button>
            <button
              nz-button
              nzType="primary"
              [disabled]="total() !== 100"
              (click)="submit()"
              i18n="@@scoring.editor.submit"
            >
              Submit for approval
            </button>
          </div>
          @if (pendingExists()) {
            <p class="muted small" i18n="@@scoring.editor.pending_note">
              A change is already awaiting approval for this program.
            </p>
          }
        </nz-card>
      }
    </section>
  `,
  styles: [
    `
      .page { padding: var(--space-6, 24px); max-inline-size: 640px; }
      .page-head { margin-block-end: var(--space-5, 20px); }
      .back { display: inline-block; margin-block-end: var(--space-2, 8px); }
      .muted { color: var(--ant-text-color-secondary, #6b7280); }
      .small { font-size: 13px; }
      .prog-line {
        display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2, 8px);
        margin-block: var(--space-2, 8px) var(--space-1, 4px); font-size: 15px;
      }
      .prog-line .bank { font-weight: 600; }
      .prog-line .sep { color: var(--ant-text-color-secondary, #6b7280); }
      .prog-line .prog { color: var(--ant-text-color, #1a2433); }
      .cat-chip {
        text-transform: capitalize; font-size: 12px; font-weight: 600;
        color: var(--ant-primary-color, #0869c3);
        background: var(--ant-primary-color-outline, rgba(8, 105, 195, 0.12));
        padding: 1px 10px; border-radius: 999px;
      }
      .caption { display: flex; flex-wrap: wrap; gap: var(--space-2, 8px); align-items: center; }
      .caption .id { font-size: 11px; opacity: 0.7; }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
      .weights { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
      .weight-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4, 16px); }
      .labels { display: flex; flex-direction: column; }
      .label { font-weight: 500; }
      .code { font-size: 12px; color: var(--ant-text-color-secondary, #6b7280); }
      .total-bar {
        display: flex; justify-content: space-between; align-items: center;
        margin-block: var(--space-4, 16px); padding: var(--space-3, 12px);
        border-radius: var(--radius-md, 8px); background: var(--ant-primary-color-outline, rgba(8,105,195,0.08));
        font-weight: 600;
      }
      .total-bar.bad { background: rgba(193, 102, 107, 0.12); color: var(--ant-error-color, #c1666b); }
      .row { display: flex; align-items: center; }
      .gap { gap: var(--space-3, 12px); }
    `,
  ],
})
export class ScoringWeightsEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  /** Active admin locale picks the label language (ar build → Arabic). */
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly category = this.route.snapshot.paramMap.get('category') as LoanCategory;
  readonly programId = this.route.snapshot.paramMap.get('programId') ?? '';

  readonly factors = signal<ScoringFactor[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly pendingExists = signal(false);
  readonly form = new FormGroup<Record<string, FormControl<number>>>({});

  private readonly value = toSignal(this.form.valueChanges, { initialValue: {} as Record<string, number> });
  readonly total = computed(() =>
    Object.values(this.value() as Record<string, number>).reduce((a, b) => a + Number(b ?? 0), 0),
  );

  async ngOnInit(): Promise<void> {
    try {
      const [factors, weights] = await Promise.all([
        this.api.listFactors(this.category),
        this.api.programWeights(this.programId),
      ]);
      this.factors.set(factors);
      this.program.set(weights.program);
      this.pendingExists.set(weights.pending !== null);
      const seed = (weights.draft ?? weights.active)?.weights ?? {};
      for (const f of factors) {
        this.form.addControl(f.code, new FormControl<number>(Number(seed[f.code] ?? 0), { nonNullable: true }));
      }
    } finally {
      this.loading.set(false);
    }
  }

  async saveDraft(): Promise<void> {
    await this.api.saveDraft(this.programId, this.currentWeights());
    this.message.success($localize`:@@scoring.editor.saved:Draft saved`);
  }

  async submit(): Promise<void> {
    if (this.total() !== 100) return;
    await this.api.saveDraft(this.programId, this.currentWeights());
    await this.api.submitWeights(this.programId);
    this.pendingExists.set(true);
    this.message.success($localize`:@@scoring.editor.submitted:Submitted for approval`);
  }

  /** Program display name, Arabic-first with English fallback. */
  programName(p: ProgramMeta): string {
    return (this.isAr && p.friendlyNameAr) || p.friendlyName;
  }

  /**
   * Row label = the QUESTION this factor scores (so admins weight by question),
   * Arabic-first. COMPUTED factors have no source question → use the factor label.
   */
  rowLabel(f: ScoringFactor): string {
    const q = this.isAr ? f.sourceQuestionLabelAr : f.sourceQuestionLabelEn;
    if (q) return q;
    return (this.isAr ? f.labelAr : f.labelEn) || f.labelEn;
  }

  private currentWeights(): Record<string, number> {
    const raw = this.form.getRawValue();
    const out: Record<string, number> = {};
    for (const [code, points] of Object.entries(raw)) out[code] = Number(points ?? 0);
    return out;
  }
}
