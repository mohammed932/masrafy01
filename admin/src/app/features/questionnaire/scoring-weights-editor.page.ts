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
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type LoanCategory,
  type ProgramMeta,
  type ScoredQuestion,
} from './questionnaire.api.service';

/**
 * Scoring weights editor (Constitution V v5.0.0 — direct save, no maker-checker).
 * Each scored question gets a per-program weight; the running total must equal
 * exactly 100 before Save. Saving activates the new versioned set immediately.
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
    NzEmptyModule,
    NzSpinModule,
  ],
  template: `
    <section class="page">
      <header class="page-head">
        <a routerLink="/banks/programs" class="back" i18n="@@scoring.editor.back">← Bank programs</a>
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
      } @else if (questions().length === 0) {
        <nz-card>
          <nz-empty
            i18n-nzNotFoundContent="@@scoring.editor.no_questions"
            nzNotFoundContent="No scored questions for this category yet. Mark questions as scored in the questionnaire editor first."
          />
        </nz-card>
      } @else {
        <nz-card>
          <form [formGroup]="form" class="weights">
            @for (q of questions(); track q.code) {
              <div class="weight-row">
                <div class="labels">
                  <span class="label">{{ rowLabel(q) }}</span>
                  <span class="mono code">{{ q.code }}</span>
                </div>
                <nz-input-number
                  [formControlName]="q.code"
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
            <button
              nz-button
              nzType="primary"
              [disabled]="total() !== 100 || saving()"
              [nzLoading]="saving()"
              (click)="save()"
              i18n="@@scoring.editor.save"
            >
              Save weights
            </button>
          </div>
        </nz-card>
      }
    </section>
  `,
  styles: [
    `
      .page { padding: var(--space-6, 24px); max-inline-size: 640px; }
      .page-head { margin-block-end: var(--space-5, 20px); }
      .back { display: inline-block; margin-block-end: var(--space-2, 8px); }
      .muted { color: var(--ant-text-color-secondary); }
      .small { font-size: 13px; }
      .prog-line {
        display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2, 8px);
        margin-block: var(--space-2, 8px) var(--space-1, 4px); font-size: 15px;
      }
      .prog-line .bank { font-weight: 600; }
      .prog-line .sep { color: var(--ant-text-color-secondary); }
      .prog-line .prog { color: var(--ant-text-color); }
      .cat-chip {
        text-transform: capitalize; font-size: 12px; font-weight: 600;
        color: var(--ant-primary-color);
        background: var(--ant-primary-color-outline);
        padding: 1px 10px; border-radius: 999px;
      }
      .caption { display: flex; flex-wrap: wrap; gap: var(--space-2, 8px); align-items: center; }
      .caption .id { font-size: 11px; opacity: 0.7; }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
      .weights { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
      .weight-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4, 16px); }
      .labels { display: flex; flex-direction: column; }
      .label { font-weight: 500; }
      .code { font-size: 12px; color: var(--ant-text-color-secondary); }
      .total-bar {
        display: flex; justify-content: space-between; align-items: center;
        margin-block: var(--space-4, 16px); padding: var(--space-3, 12px);
        border-radius: var(--radius-md, 8px); background: var(--ant-primary-color-outline);
        font-weight: 600;
      }
      .total-bar.bad {
        background: color-mix(in srgb, var(--ant-error-color) 12%, transparent);
        color: var(--ant-error-color);
      }
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

  readonly questions = signal<ScoredQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly form = new FormGroup<Record<string, FormControl<number>>>({});

  private readonly value = toSignal(this.form.valueChanges, { initialValue: {} as Record<string, number> });
  readonly total = computed(() =>
    Object.values(this.value() as Record<string, number>).reduce((a, b) => a + Number(b ?? 0), 0),
  );

  async ngOnInit(): Promise<void> {
    try {
      const [questions, weights] = await Promise.all([
        this.api.listScoredQuestions(this.category),
        this.api.programWeights(this.programId),
      ]);
      this.questions.set(questions);
      this.program.set(weights.program);
      const seed = weights.active?.weights ?? {};
      for (const q of questions) {
        this.form.addControl(q.code, new FormControl<number>(Number(seed[q.code] ?? 0), { nonNullable: true }));
      }
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.total() !== 100 || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.saveWeights(this.programId, this.currentWeights());
      this.message.success($localize`:@@scoring.editor.saved:Weights saved`);
    } finally {
      this.saving.set(false);
    }
  }

  /** Program display name, Arabic-first with English fallback. */
  programName(p: ProgramMeta): string {
    return (this.isAr && p.friendlyNameAr) || p.friendlyName;
  }

  /** Row label = the scored question, Arabic-first. */
  rowLabel(q: ScoredQuestion): string {
    return (this.isAr ? q.labelAr : q.labelEn) || q.labelEn;
  }

  private currentWeights(): Record<string, number> {
    const raw = this.form.getRawValue();
    const out: Record<string, number> = {};
    for (const [code, points] of Object.entries(raw)) out[code] = Number(points ?? 0);
    return out;
  }
}
