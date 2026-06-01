import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
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
 * contextual add-form on the right; Publish snapshots the active draft.
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
    NzCardModule,
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
      <header class="page-head row between">
        <div>
          <a routerLink="/questionnaire" class="back" i18n="@@qedit.back">← Questionnaires</a>
          <h1><span class="cat">{{ category }}</span> <span i18n="@@qedit.title">questionnaire</span></h1>
        </div>
        <div class="row gap">
          <button nz-button (click)="startGroup()" i18n="@@qedit.add_group">Add group</button>
          <button nz-button nzType="primary" (click)="publish()" i18n="@@qedit.publish">Publish</button>
        </div>
      </header>

      <div class="cols">
        <div class="tree">
          @if (loading()) {
            <nz-spin nzSimple />
          } @else if (groups().length === 0) {
            <nz-empty nzNotFoundContent="No groups yet — add one to start" i18n-nzNotFoundContent="@@qedit.empty" />
          } @else {
            @for (g of groups(); track g.id) {
              <nz-card class="group">
                <div class="row between">
                  <strong>{{ g.titleEn }}</strong>
                  <button nz-button nzSize="small" (click)="startQuestion(g)" i18n="@@qedit.add_question">+ question</button>
                </div>
                <span class="mono code">{{ g.code }}</span>
                @for (q of g.questions; track q.id) {
                  <div class="q">
                    <div class="row between">
                      <span>{{ q.questionEn }}</span>
                      <button nz-button nzSize="small" nzType="text" (click)="startOption(q.id)" i18n="@@qedit.add_option">+ option</button>
                    </div>
                    <div class="row gap wrap meta">
                      <span class="mono code">{{ q.code }}</span>
                      @if (q.systemRole) { <nz-tag nzColor="blue">{{ q.systemRole }}</nz-tag> }
                      @if (q.scoringFactorCode) { <nz-tag nzColor="purple">score:{{ q.scoringFactorCode }}</nz-tag> }
                      @if (q.profileField) { <nz-tag>map:{{ q.profileField }}</nz-tag> }
                    </div>
                    <ul class="opts">
                      @for (o of q.options; track o.id) {
                        <li>
                          <span>{{ o.labelEn }}</span>
                          <span class="mono dim">
                            @if (o.numericPoint) { pt {{ o.numericPoint }} }
                            @if (o.scoreValue) { · s {{ o.scoreValue }} }
                            @if (o.profileValue) { · {{ o.profileValue }} }
                          </span>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </nz-card>
            }
          }
        </div>

        <aside class="panel">
          @if (mode() === null) {
            <p class="muted" i18n="@@qedit.hint">Select an action to add a group, question, or option.</p>
          } @else if (mode() === 'group') {
            <nz-card nzTitle="New group" i18n-nzTitle="@@qedit.new_group">
              <form [formGroup]="groupForm" class="form" (ngSubmit)="submitGroup()">
                <input nz-input formControlName="titleEn" placeholder="Title (English)" i18n-placeholder="@@qedit.title_en" />
                <input nz-input formControlName="titleAr" placeholder="العنوان (عربي)" />
                <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                <button nz-button nzType="primary" [disabled]="groupForm.invalid" i18n="@@qedit.save">Save</button>
              </form>
            </nz-card>
          } @else if (mode() === 'question') {
            <nz-card nzTitle="New question" i18n-nzTitle="@@qedit.new_question">
              <form [formGroup]="questionForm" class="form" (ngSubmit)="submitQuestion()">
                <input nz-input formControlName="questionEn" placeholder="Question (English)" i18n-placeholder="@@qedit.q_en" />
                <input nz-input formControlName="questionAr" placeholder="السؤال (عربي)" />
                <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                <nz-select formControlName="systemRole" nzAllowClear nzPlaceHolder="System role (arithmetic)" i18n-nzPlaceHolder="@@qedit.role">
                  @for (r of roles; track r) { <nz-option [nzValue]="r" [nzLabel]="r" /> }
                </nz-select>
                <input nz-input formControlName="scoringFactorCode" placeholder="Scoring factor code (optional)" i18n-placeholder="@@qedit.factor" />
                <input nz-input formControlName="profileField" placeholder="Profile field e.g. employment.employmentType" i18n-placeholder="@@qedit.profile" />
                <label class="row gap"><nz-switch formControlName="isRequired" /> <span i18n="@@qedit.required">Required</span></label>
                <button nz-button nzType="primary" [disabled]="questionForm.invalid" i18n="@@qedit.save">Save</button>
              </form>
            </nz-card>
          } @else {
            <nz-card nzTitle="New option" i18n-nzTitle="@@qedit.new_option">
              <form [formGroup]="optionForm" class="form" (ngSubmit)="submitOption()">
                <input nz-input formControlName="labelEn" placeholder="Label (English)" i18n-placeholder="@@qedit.label_en" />
                <input nz-input formControlName="labelAr" placeholder="التسمية (عربي)" />
                <nz-input-number formControlName="displayOrder" [nzMin]="0" />
                <nz-input-number formControlName="numericPoint" nzPlaceHolder="numericPoint (arithmetic)" />
                <nz-input-number formControlName="scoreValue" [nzMin]="0" [nzMax]="1" [nzStep]="0.05" nzPlaceHolder="scoreValue 0–1" />
                <input nz-input formControlName="profileValue" placeholder="profileValue (categorical)" i18n-placeholder="@@qedit.pvalue" />
                <button nz-button nzType="primary" [disabled]="optionForm.invalid" i18n="@@qedit.save">Save</button>
              </form>
            </nz-card>
          }
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .page { padding: var(--space-6, 24px); }
      .page-head { margin-block-end: var(--space-5, 20px); align-items: flex-start; }
      .back { display: inline-block; margin-block-end: var(--space-2, 8px); }
      .cat { text-transform: capitalize; }
      .cols { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-5, 20px); align-items: start; }
      .tree { display: flex; flex-direction: column; gap: var(--space-4, 16px); }
      .group { }
      .q { margin-block-start: var(--space-3, 12px); padding-inline-start: var(--space-3, 12px); border-inline-start: 2px solid var(--ant-border-color-split, #f0f0f0); }
      .opts { list-style: none; margin: var(--space-2, 8px) 0 0; padding: 0; }
      .opts li { display: flex; justify-content: space-between; font-size: 13px; padding-block: 2px; }
      .row { display: flex; align-items: center; }
      .between { justify-content: space-between; }
      .gap { gap: var(--space-2, 8px); }
      .wrap { flex-wrap: wrap; }
      .meta { margin-block: 4px; }
      .mono { font-family: var(--font-family-mono, 'JetBrains Mono', monospace); }
      .code { font-size: 12px; color: var(--ant-text-color-secondary, #6b7280); }
      .dim { color: var(--ant-text-color-secondary, #9aa3af); }
      .muted { color: var(--ant-text-color-secondary, #6b7280); }
      .panel { position: sticky; inset-block-start: var(--space-4, 16px); }
      .form { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
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
