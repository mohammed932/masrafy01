import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type GroupTreeRow,
  type LoanCategory,
} from './questionnaire.api.service';

const SYSTEM_ROLES = ['SALARY', 'LOAN_AMOUNT', 'CURRENT_INSTALLMENTS', 'AGE', 'DOWN_PAYMENT', 'TENOR'];
type Mode = null | 'group' | 'question' | 'option';

/**
 * Questionnaire authoring (Constitution V v4.1.0 — questions are admin DATA).
 * Codes are auto-generated server-side (read-only here, A33). Tree on the left,
 * a contextual inspector on the right; Publish snapshots the active draft.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    NzSpinModule,
    NzEmptyModule,
  ],
  template: `
    <section class="page">
      <!-- Hero -->
      <header class="hero">
        <span class="hero-accent" aria-hidden="true"></span>
        <div class="hero-inner">
          <div class="hero-lead">
            <a routerLink="/questionnaire" class="back" i18n="@@qedit.back">‹ Questionnaires</a>
            <div class="title-row">
              <span class="cat-badge">{{ category }}</span>
              <h1 i18n="@@qedit.title">Questionnaire builder</h1>
            </div>
            <p class="stats">
              <strong>{{ groups().length }}</strong> <span i18n="@@qedit.stat_groups">groups</span>
              <span class="dot">·</span>
              <strong>{{ totalQuestions() }}</strong> <span i18n="@@qedit.stat_questions">questions</span>
              <span class="dot">·</span>
              <span class="muted" i18n="@@qedit.stat_autosave">changes saved server-side, then publish</span>
            </p>
          </div>
          <div class="hero-actions">
            <button nz-button nzSize="large" (click)="startGroup()">
              <span i18n="@@qedit.add_group">＋ Group</span>
            </button>
            <button nz-button nzType="primary" nzSize="large" (click)="publish()">
              <span i18n="@@qedit.publish">Publish version</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Tree (full width) -->
      <div class="tree">
        @if (loading()) {
          <div class="center"><nz-spin nzSimple /></div>
        } @else if (groups().length === 0) {
          <div class="empty-card">
            <nz-empty
              nzNotFoundContent="No groups yet — add your first group to start building"
              i18n-nzNotFoundContent="@@qedit.empty"
            />
            <button nz-button nzType="primary" (click)="startGroup()" i18n="@@qedit.empty_cta">Add a group</button>
          </div>
        } @else {
          @for (g of groups(); track g.id) {
            <article class="group-card">
              <header class="group-head">
                <div class="ghead-left">
                  <span class="drag" aria-hidden="true">⠿</span>
                  <div class="gtitle">
                    <h2>{{ g.titleEn }}</h2>
                    <span class="ar" dir="rtl">{{ g.titleAr }}</span>
                  </div>
                  <span class="count-pill">{{ g.questions.length }}</span>
                  <code class="code-chip">{{ g.code }}</code>
                </div>
                <button nz-button nzSize="small" (click)="startQuestion(g)" i18n="@@qedit.add_question">
                  ＋ Question
                </button>
              </header>

              @if (g.questions.length === 0) {
                <p class="empty-line" i18n="@@qedit.group_empty">No questions yet — add the first one.</p>
              }

              <div class="q-grid">
                @for (q of g.questions; track q.id) {
                  <div class="q-card">
                    <div class="q-top">
                      <span class="q-text">{{ q.questionEn }}</span>
                      @if (q.isRequired) {
                        <span class="req" i18n="@@qedit.required_chip">required</span>
                      }
                    </div>
                    @if (q.questionAr) { <div class="q-ar" dir="rtl">{{ q.questionAr }}</div> }
                    <div class="chips">
                      <code class="code-chip">{{ q.code }}</code>
                      @if (q.systemRole) { <nz-tag nzColor="geekblue">⚙ {{ q.systemRole }}</nz-tag> }
                      @if (q.scoringFactorCode) { <nz-tag nzColor="purple">★ {{ q.scoringFactorCode }}</nz-tag> }
                      @if (q.profileField) { <nz-tag nzColor="cyan">↪ {{ q.profileField }}</nz-tag> }
                    </div>
                    @if (q.options.length > 0) {
                      <ul class="opts">
                        @for (o of q.options; track o.id) {
                          <li class="opt">
                            <span class="opt-label">{{ o.labelEn }}</span>
                            <span class="opt-metrics">
                              @if (o.numericPoint) { <span class="metric">pt {{ o.numericPoint }}</span> }
                              @if (o.scoreValue) { <span class="metric score">s {{ o.scoreValue }}</span> }
                              @if (o.profileValue) { <span class="metric">{{ o.profileValue }}</span> }
                            </span>
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="empty-line tiny" i18n="@@qedit.q_empty">No options.</p>
                    }
                    <button class="add-opt" nz-button nzSize="small" nzType="text" (click)="startOption(q.id)" i18n="@@qedit.add_option">
                      ＋ option
                    </button>
                  </div>
                }
              </div>
            </article>
          }
        }
      </div>

      <!-- Inspector drawer -->
      @if (mode() !== null) {
        <div class="scrim" (click)="cancel()" aria-hidden="true"></div>
        <aside class="drawer" role="dialog" aria-modal="true">
            <div class="ins-card">
              <header class="ins-head">
                <h3>
                  @switch (mode()) {
                    @case ('group') { <span i18n="@@qedit.new_group">New group</span> }
                    @case ('question') { <span i18n="@@qedit.new_question">New question</span> }
                    @default { <span i18n="@@qedit.new_option">New option</span> }
                  }
                </h3>
                <button nz-button nzType="text" nzShape="circle" (click)="cancel()" aria-label="Close">✕</button>
              </header>
              <p class="ins-note" i18n="@@qedit.code_note">A stable code is generated automatically — no need to type one.</p>

              @if (mode() === 'group') {
                <form [formGroup]="groupForm" class="form" (ngSubmit)="submitGroup()">
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.title_en">Title (English)</span>
                    <input nz-input formControlName="titleEn" placeholder="e.g. Financing details" />
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.title_ar">العنوان (عربي)</span>
                    <input nz-input formControlName="titleAr" dir="rtl" placeholder="مثال: تفاصيل التمويل" />
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.order">Display order</span>
                    <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                  </label>
                  <div class="form-actions">
                    <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                    <button nz-button nzType="primary" [disabled]="groupForm.invalid" i18n="@@qedit.save">Save group</button>
                  </div>
                </form>
              } @else if (mode() === 'question') {
                <form [formGroup]="questionForm" class="form" (ngSubmit)="submitQuestion()">
                  <p class="section-lbl" i18n="@@qedit.sec_content">Content</p>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.q_en">Question (English)</span>
                    <input nz-input formControlName="questionEn" placeholder="e.g. What is your monthly income?" />
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.q_ar">السؤال (عربي)</span>
                    <input nz-input formControlName="questionAr" dir="rtl" placeholder="مثال: ما هو دخلك الشهري؟" />
                  </label>

                  <p class="section-lbl" i18n="@@qedit.sec_behaviour">Behaviour</p>
                  <div class="field-row">
                    <label class="field grow">
                      <span class="lbl" i18n="@@qedit.order">Display order</span>
                      <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                    </label>
                    <label class="switch-field">
                      <nz-switch formControlName="isRequired" />
                      <span i18n="@@qedit.required">Required</span>
                    </label>
                  </div>

                  <p class="section-lbl" i18n="@@qedit.sec_engine">Engine mapping <span class="opt-tag">optional</span></p>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.role">Arithmetic role</span>
                    <nz-select formControlName="systemRole" nzAllowClear nzPlaceHolder="— none —" i18n-nzPlaceHolder="@@qedit.role_ph">
                      @for (r of roles; track r) { <nz-option [nzValue]="r" [nzLabel]="r" /> }
                    </nz-select>
                    <span class="hlp" i18n="@@qedit.role_hlp">Feeds a number into the engine (salary, amount, tenor…).</span>
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.factor">Scoring factor code</span>
                    <input nz-input formControlName="scoringFactorCode" placeholder="e.g. salary_level" />
                    <span class="hlp" i18n="@@qedit.factor_hlp">Options carry a 0–1 score for approval probability.</span>
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.profile">Profile field</span>
                    <input nz-input formControlName="profileField" placeholder="e.g. employment.employmentType" />
                    <span class="hlp" i18n="@@qedit.profile_hlp">Maps the answer onto the eligibility profile.</span>
                  </label>

                  <div class="form-actions">
                    <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                    <button nz-button nzType="primary" [disabled]="questionForm.invalid" i18n="@@qedit.save_q">Save question</button>
                  </div>
                </form>
              } @else {
                <form [formGroup]="optionForm" class="form" (ngSubmit)="submitOption()">
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.label_en">Label (English)</span>
                    <input nz-input formControlName="labelEn" placeholder="e.g. 20,000 – 40,000" />
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.label_ar">التسمية (عربي)</span>
                    <input nz-input formControlName="labelAr" dir="rtl" placeholder="مثال: ٢٠٬٠٠٠ – ٤٠٬٠٠٠" />
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.order">Display order</span>
                    <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                  </label>

                  <p class="section-lbl" i18n="@@qedit.sec_values">Engine values <span class="opt-tag">as applicable</span></p>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.numeric">Numeric point</span>
                    <nz-input-number formControlName="numericPoint" nzPlaceHolder="e.g. 30000" />
                    <span class="hlp" i18n="@@qedit.numeric_hlp">For arithmetic questions — the representative value.</span>
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.score">Score value (0–1)</span>
                    <nz-input-number formControlName="scoreValue" [nzMin]="0" [nzMax]="1" [nzStep]="0.05" nzPlaceHolder="e.g. 0.75" />
                    <span class="hlp" i18n="@@qedit.score_hlp">For scoring questions — how good this answer is.</span>
                  </label>
                  <label class="field">
                    <span class="lbl" i18n="@@qedit.pvalue">Profile value</span>
                    <input nz-input formControlName="profileValue" placeholder="e.g. government_employee" />
                    <span class="hlp" i18n="@@qedit.pvalue_hlp">For mapped questions — the eligibility value.</span>
                  </label>

                  <div class="form-actions">
                    <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                    <button nz-button nzType="primary" [disabled]="optionForm.invalid" i18n="@@qedit.save_o">Save option</button>
                  </div>
                </form>
              }
            </div>
        </aside>
      }
    </section>
  `,
  styles: [
    `
      :host {
        --qe-line: var(--ant-border-color-split, #eceff3);
        --qe-muted: var(--ant-text-color-secondary, #6b7280);
        --qe-primary: var(--ant-primary-color, #0869c3);
        --qe-primary-soft: var(--ant-primary-color-outline, rgba(8, 105, 195, 0.12));
        --qe-surface: var(--ant-component-background, #ffffff);
        --qe-radius: var(--radius-lg, 14px);
      }
      .page { padding: var(--space-6, 24px); inline-size: 100%; }

      /* Hero */
      .hero {
        position: relative;
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius);
        overflow: hidden;
        margin-block-end: var(--space-5, 20px);
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
      }
      .hero-accent {
        position: absolute;
        inset-block-start: 0;
        inset-inline: 0;
        block-size: 4px;
        background: linear-gradient(90deg, var(--qe-primary), color-mix(in srgb, var(--qe-primary) 55%, #4aa3e0));
      }
      .hero-inner {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        flex-wrap: wrap;
        padding: var(--space-5, 22px) var(--space-6, 24px);
      }
      .back {
        display: inline-block;
        color: var(--qe-muted);
        font-size: 13px;
        margin-block-end: var(--space-2, 8px);
      }
      .back:hover { color: var(--qe-primary); }
      .title-row { display: flex; align-items: center; gap: var(--space-3, 12px); }
      .title-row h1 { margin: 0; font-size: 22px; font-weight: 700; }
      .cat-badge {
        text-transform: capitalize;
        font-weight: 700;
        font-size: 13px;
        color: var(--qe-primary);
        background: var(--qe-primary-soft);
        padding: 4px 12px;
        border-radius: 999px;
      }
      .stats { margin: var(--space-2, 8px) 0 0; color: var(--ant-text-color, #1a2433); font-size: 14px; }
      .stats strong { margin-inline-end: 4px; }
      .stats .dot { margin-inline: 8px; color: var(--qe-line); }
      .stats .muted { color: var(--qe-muted); }
      .hero-actions { display: flex; gap: var(--space-3, 12px); }

      /* Layout — tree spans full width; inspector is a drawer */
      .tree { display: flex; flex-direction: column; gap: var(--space-4, 16px); min-inline-size: 0; }
      .center { display: flex; justify-content: center; padding: var(--space-7, 40px); }
      .empty-card {
        display: flex; flex-direction: column; align-items: center; gap: var(--space-3, 12px);
        padding: var(--space-7, 40px); background: var(--qe-surface);
        border: 1px dashed var(--qe-line); border-radius: var(--qe-radius);
      }

      /* Group card */
      .group-card {
        background: var(--qe-surface);
        border: 1px solid var(--qe-line);
        border-radius: var(--qe-radius);
        padding: var(--space-4, 16px) var(--space-5, 20px);
        transition: box-shadow 180ms ease, border-color 180ms ease;
      }
      .group-card:hover { box-shadow: 0 4px 16px rgba(16, 24, 40, 0.06); border-color: color-mix(in srgb, var(--qe-primary) 25%, var(--qe-line)); }
      .group-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3, 12px); }
      .ghead-left { display: flex; align-items: center; gap: var(--space-3, 12px); min-inline-size: 0; flex-wrap: wrap; }
      .drag { color: var(--qe-muted); cursor: grab; font-size: 16px; line-height: 1; opacity: 0.5; }
      .gtitle h2 { margin: 0; font-size: 16px; font-weight: 600; }
      .gtitle .ar { font-size: 12px; color: var(--qe-muted); }
      .count-pill {
        min-inline-size: 24px; text-align: center; font-size: 12px; font-weight: 700;
        color: var(--qe-primary); background: var(--qe-primary-soft);
        padding: 2px 8px; border-radius: 999px;
      }
      .code-chip {
        font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
        font-size: 11px; color: var(--qe-muted);
        background: var(--ant-background-color-light, #f6f8fa);
        padding: 2px 6px; border-radius: 6px;
      }

      /* Question card grid — uses the full width */
      .q-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: var(--space-4, 16px);
        margin-block-start: var(--space-4, 16px);
      }
      .q-card {
        position: relative;
        border: 1px solid var(--qe-line);
        border-radius: var(--radius-md, 10px);
        padding: var(--space-4, 16px);
        background: var(--ant-background-color-light, #fbfcfe);
        border-inline-start: 3px solid var(--qe-primary-soft);
        transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }
      .q-card:hover {
        border-inline-start-color: var(--qe-primary);
        box-shadow: 0 4px 14px rgba(16, 24, 40, 0.06);
        transform: translateY(-1px);
      }
      .q-top { display: flex; align-items: center; gap: var(--space-2, 8px); }
      .q-text { font-weight: 600; font-size: 14px; flex: 1; min-inline-size: 0; }
      .add-opt { margin-block-start: var(--space-2, 8px); padding-inline: 0; }
      .q-ar { font-size: 12px; color: var(--qe-muted); margin-block-start: 2px; }
      .req {
        font-size: 11px; font-weight: 600; color: var(--ant-warning-color, #c8893d);
        background: color-mix(in srgb, var(--ant-warning-color, #c8893d) 12%, transparent);
        padding: 1px 7px; border-radius: 999px;
      }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block: 6px; }
      .opts { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .opt {
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3, 12px);
        font-size: 13px; padding: 4px 8px; border-radius: 8px;
      }
      .opt:hover { background: var(--ant-background-color-light, #f6f8fa); }
      .opt-label { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .opt-metrics { display: flex; gap: 6px; flex-shrink: 0; }
      .metric {
        font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
        font-size: 11px; color: var(--qe-muted);
      }
      .metric.score { color: var(--ant-primary-color, #0869c3); }
      .empty-line { color: var(--qe-muted); font-style: italic; font-size: 13px; margin: var(--space-2, 8px) 0 0; }
      .empty-line.tiny { font-size: 12px; margin-block-start: 4px; }

      /* Inspector drawer */
      .scrim {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(16, 24, 40, 0.38);
        animation: qe-fade 160ms ease;
      }
      .drawer {
        position: fixed; z-index: 1001;
        inset-block: 0; inset-inline-end: 0;
        inline-size: clamp(340px, 32vw, 480px);
        background: var(--qe-surface);
        border-inline-start: 1px solid var(--qe-line);
        box-shadow: -16px 0 40px rgba(16, 24, 40, 0.12);
        overflow-y: auto;
        animation: qe-slide 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes qe-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes qe-slide { from { transform: translateX(8%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .scrim, .drawer { animation: none; }
      }
      .ins-card { padding: var(--space-5, 20px); }
      .ins-head { display: flex; align-items: center; justify-content: space-between; }
      .ins-head h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .ins-note {
        font-size: 12px; color: var(--qe-muted); margin: var(--space-2, 8px) 0 var(--space-4, 16px);
        padding: var(--space-2, 8px) var(--space-3, 12px);
        background: var(--qe-primary-soft); border-radius: 8px;
      }
      .form { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .field.grow { flex: 1; }
      .field-row { display: flex; gap: var(--space-3, 12px); align-items: flex-end; }
      .lbl { font-size: 12px; font-weight: 600; color: var(--ant-text-color, #1a2433); }
      .hlp { font-size: 11px; color: var(--qe-muted); }
      .switch-field { display: flex; align-items: center; gap: var(--space-2, 8px); padding-block-end: 6px; font-size: 13px; }
      .section-lbl {
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--qe-muted); margin: var(--space-3, 12px) 0 0;
        display: flex; align-items: center; gap: 8px;
      }
      .opt-tag {
        text-transform: none; letter-spacing: 0; font-weight: 500; font-size: 10px;
        color: var(--qe-muted); background: var(--ant-background-color-light, #f6f8fa);
        padding: 1px 6px; border-radius: 999px;
      }
      .form-actions { display: flex; justify-content: flex-end; gap: var(--space-2, 8px); margin-block-start: var(--space-3, 12px); }
      nz-input-number, nz-select { inline-size: 100%; }
    `,
  ],
})
export class QuestionnaireEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);

  readonly roles = SYSTEM_ROLES;
  readonly category = this.route.snapshot.paramMap.get('category') as LoanCategory;
  readonly groups = signal<GroupTreeRow[]>([]);
  readonly loading = signal(true);
  readonly mode = signal<Mode>(null);
  readonly totalQuestions = computed(() =>
    this.groups().reduce((sum, g) => sum + g.questions.length, 0),
  );

  private activeGroupId = '';
  private activeQuestionId = '';

  readonly groupForm = new FormGroup({
    titleEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    titleAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
  });
  readonly questionForm = new FormGroup({
    questionEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    questionAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
    systemRole: new FormControl<string | null>(null),
    scoringFactorCode: new FormControl('', { nonNullable: true }),
    profileField: new FormControl('', { nonNullable: true }),
    isRequired: new FormControl(true, { nonNullable: true }),
  });
  readonly optionForm = new FormGroup({
    labelEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    labelAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
    numericPoint: new FormControl<number | null>(null),
    scoreValue: new FormControl<number | null>(null),
    profileValue: new FormControl('', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  cancel(): void {
    this.mode.set(null);
  }

  startGroup(): void {
    this.groupForm.reset({ titleEn: '', titleAr: '', displayOrder: this.groups().length });
    this.mode.set('group');
  }
  startQuestion(g: GroupTreeRow): void {
    this.activeGroupId = g.id;
    this.questionForm.reset({ displayOrder: g.questions.length, isRequired: true } as never);
    this.mode.set('question');
  }
  startOption(questionId: string): void {
    this.activeQuestionId = questionId;
    this.optionForm.reset({ displayOrder: 0 } as never);
    this.mode.set('option');
  }

  async submitGroup(): Promise<void> {
    if (this.groupForm.invalid) return;
    const v = this.groupForm.getRawValue();
    await this.api.createGroup({ category: this.category, ...v });
    this.message.success($localize`:@@qedit.group_added:Group added`);
    this.mode.set(null);
    await this.reload();
  }

  async submitQuestion(): Promise<void> {
    if (this.questionForm.invalid) return;
    const v = this.questionForm.getRawValue();
    await this.api.createQuestion({
      groupId: this.activeGroupId,
      category: this.category,
      questionEn: v.questionEn,
      questionAr: v.questionAr,
      displayOrder: v.displayOrder,
      isRequired: v.isRequired,
      systemRole: v.systemRole ?? undefined,
      scoringFactorCode: v.scoringFactorCode || undefined,
      profileField: v.profileField || undefined,
    });
    this.message.success($localize`:@@qedit.question_added:Question added`);
    this.mode.set(null);
    await this.reload();
  }

  async submitOption(): Promise<void> {
    if (this.optionForm.invalid) return;
    const v = this.optionForm.getRawValue();
    await this.api.createOption(this.activeQuestionId, {
      labelEn: v.labelEn,
      labelAr: v.labelAr,
      displayOrder: v.displayOrder,
      numericPoint: v.numericPoint ?? undefined,
      scoreValue: v.scoreValue ?? undefined,
      profileValue: v.profileValue || undefined,
    });
    this.message.success($localize`:@@qedit.option_added:Option added`);
    this.mode.set(null);
    await this.reload();
  }

  async publish(): Promise<void> {
    const v = await this.api.publish(this.category);
    this.message.success($localize`:@@qedit.published:Published version #${v.versionNumber}`);
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.groups.set(await this.api.tree(this.category));
    } finally {
      this.loading.set(false);
    }
  }
}
