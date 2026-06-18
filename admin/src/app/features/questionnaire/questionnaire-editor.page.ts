import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { EditOutline, DeleteOutline, EllipsisOutline } from '@ant-design/icons-angular/icons';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  categoryLabel,
  type GroupTreeRow,
  type OptionRow,
  type QuestionRow,
  type LoanCategory,
} from './questionnaire.api.service';

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
    NzSwitchModule,
    NzSpinModule,
    NzEmptyModule,
    NzIconModule,
    NzDropDownModule,
    NzTabsModule,
  ],
  providers: [provideNzIconsPatch([EditOutline, DeleteOutline, EllipsisOutline])],
  template: `
    <section class="page">
      <!-- Hero -->
      <header class="hero">
        <span class="hero-accent" aria-hidden="true"></span>
        <div class="hero-inner">
          <div class="hero-lead">
            <a routerLink="/questionnaire" class="back" i18n="@@qedit.back">‹ Questionnaires</a>
            <div class="title-row">
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

      <!-- Category tab strip — flip categories in place; URL stays /edit/:category
           (link-router → deep-linkable + keyboard a11y + animated ink bar). -->
      <nav class="cat-tabs" aria-label="Loan categories" i18n-aria-label="@@qedit.tabs_aria">
        <nz-tabset nzLinkRouter [nzAnimated]="true">
          @for (cat of categories; track cat) {
            <nz-tab>
              <a *nzTabLink nz-tab-link [routerLink]="['/questionnaire/edit', cat]" class="cat-tab">
                <span class="cat-name">{{ label(cat) }}</span>
                @if (tabMeta()[cat].live) {
                  <span class="live-dot" title="Live" i18n-title="@@qedit.tab_live" aria-hidden="true"></span>
                }
                <span class="cat-count">{{ tabMeta()[cat].count }}</span>
              </a>
            </nz-tab>
          }
        </nz-tabset>
      </nav>

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
          <!-- Keyed by category so the list re-creates on tab switch → re-fires the
               fade (qe-fade); cheap because all four trees are cached client-side. -->
          @for (activeCat of [category()]; track activeCat) {
          <div class="tree-list">
          @for (g of groups(); track g.id) {
            <article class="group-card">
              <header class="group-head">
                <div class="ghead-left">
                  <span class="drag" aria-hidden="true">⠿</span>
                  <div class="gtitle">
                    <h2 [dir]="isAr ? 'rtl' : 'ltr'">{{ isAr ? g.titleAr : g.titleEn }}</h2>
                  </div>
                  <span class="count-pill">{{ g.questions.length }}</span>
                  <code class="code-chip">{{ g.code }}</code>
                </div>
                <div class="ghead-actions">
                  <button nz-button nzSize="small" (click)="startQuestion(g)" i18n="@@qedit.add_question">
                    ＋ Question
                  </button>
                  <button
                    type="button"
                    class="kebab"
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    nz-dropdown
                    [nzDropdownMenu]="gMenu"
                    nzTrigger="click"
                    nzPlacement="bottomRight"
                    aria-label="Group actions"
                    i18n-aria-label="@@qedit.group_actions_aria"
                  >
                    <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                  </button>
                  <nz-dropdown-menu #gMenu="nzDropdownMenu">
                    <ul nz-menu class="row-menu">
                      <li nz-menu-item (click)="editGroup(g)">
                        <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                        <span i18n="@@qedit.menu_edit">Edit</span>
                      </li>
                      <li nz-menu-item (click)="confirmDeleteGroup(g)">
                        <span nz-icon nzType="delete" nzTheme="outline" style="margin-inline-end: 8px; color: var(--ant-error-color, #d4380d)"></span>
                        <span style="color: var(--ant-error-color, #d4380d)" i18n="@@qedit.menu_delete">Delete</span>
                      </li>
                    </ul>
                  </nz-dropdown-menu>
                </div>
              </header>

              @if (g.questions.length === 0) {
                <p class="empty-line" i18n="@@qedit.group_empty">No questions yet — add the first one.</p>
              }

              <div class="q-grid">
                @for (q of g.questions; track q.id) {
                  <div class="q-card">
                    <div class="q-top">
                      <span class="q-text" [dir]="isAr ? 'rtl' : 'ltr'">{{ isAr ? q.questionAr : q.questionEn }}</span>
                      @if (q.isRequired) {
                        <span class="req" i18n="@@qedit.required_chip">required</span>
                      }
                      <button
                        type="button"
                        class="kebab"
                        nz-button
                        nzType="text"
                        nzShape="circle"
                        nz-dropdown
                        [nzDropdownMenu]="qMenu"
                        nzTrigger="click"
                        nzPlacement="bottomRight"
                        aria-label="Question actions"
                        i18n-aria-label="@@qedit.question_actions_aria"
                      >
                        <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                      </button>
                      <nz-dropdown-menu #qMenu="nzDropdownMenu">
                        <ul nz-menu class="row-menu">
                          <li nz-menu-item (click)="editQuestion(q)">
                            <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                            <span i18n="@@qedit.menu_edit">Edit</span>
                          </li>
                          <li nz-menu-item (click)="confirmDeleteQuestion(q)">
                            <span nz-icon nzType="delete" nzTheme="outline" style="margin-inline-end: 8px; color: var(--ant-error-color, #d4380d)"></span>
                            <span style="color: var(--ant-error-color, #d4380d)" i18n="@@qedit.menu_delete">Delete</span>
                          </li>
                        </ul>
                      </nz-dropdown-menu>
                    </div>
                    <div class="meta">
                      <code class="code-chip">{{ q.code }}</code>
                    </div>
                    @if (q.options.length > 0) {
                      <ul class="opts">
                        @for (o of q.options; track o.id) {
                          <li class="opt">
                            <span class="opt-label" [dir]="isAr ? 'rtl' : 'ltr'">{{ isAr ? o.labelAr : o.labelEn }}</span>
                            <button
                              type="button"
                              class="kebab"
                              nz-button
                              nzType="text"
                              nzShape="circle"
                              nzSize="small"
                              nz-dropdown
                              [nzDropdownMenu]="oMenu"
                              nzTrigger="click"
                              nzPlacement="bottomRight"
                              aria-label="Option actions"
                              i18n-aria-label="@@qedit.option_actions_aria"
                            >
                              <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                            </button>
                            <nz-dropdown-menu #oMenu="nzDropdownMenu">
                              <ul nz-menu class="row-menu">
                                <li nz-menu-item (click)="editOption(o)">
                                  <span nz-icon nzType="edit" nzTheme="outline" style="margin-inline-end: 8px"></span>
                                  <span i18n="@@qedit.menu_edit">Edit</span>
                                </li>
                                <li nz-menu-item (click)="confirmDeleteOption(o)">
                                  <span nz-icon nzType="delete" nzTheme="outline" style="margin-inline-end: 8px; color: var(--ant-error-color, #d4380d)"></span>
                                  <span style="color: var(--ant-error-color, #d4380d)" i18n="@@qedit.menu_delete">Delete</span>
                                </li>
                              </ul>
                            </nz-dropdown-menu>
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
          </div>
          }
        }
      </div>

    </section>

    <!-- Inspector drawer — rendered OUTSIDE section.page so position:fixed
         resolves against the viewport. section.page runs the app-page-rise
         transform, which makes it the containing block for fixed descendants
         and would otherwise trap the scrim/blur inside the content area. -->
    @if (mode() !== null) {
        <div class="scrim" (click)="cancel()" aria-hidden="true"></div>
        <aside class="drawer" role="dialog" aria-modal="true">
            <div class="ins-card">
              <header class="ins-head">
                <h3>
                  @switch (mode()) {
                    @case ('group') {
                      @if (editing()) { <span i18n="@@qedit.edit_group">Edit group</span> }
                      @else { <span i18n="@@qedit.new_group">New group</span> }
                    }
                    @case ('question') {
                      @if (editing()) { <span i18n="@@qedit.edit_question">Edit question</span> }
                      @else { <span i18n="@@qedit.new_question">New question</span> }
                    }
                    @default {
                      @if (editing()) { <span i18n="@@qedit.edit_option">Edit option</span> }
                      @else { <span i18n="@@qedit.new_option">New option</span> }
                    }
                  }
                </h3>
                <button nz-button nzType="text" nzShape="circle" (click)="cancel()" aria-label="Close">✕</button>
              </header>
              @if (!editing()) {
                <p class="ins-note" i18n="@@qedit.code_note">A stable code is generated automatically — no need to type one.</p>
              }

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

                  <div class="form-actions">
                    <button type="button" nz-button (click)="cancel()" i18n="@@qedit.cancel">Cancel</button>
                    <button nz-button nzType="primary" [disabled]="optionForm.invalid" i18n="@@qedit.save_o">Save option</button>
                  </div>
                </form>
              }
            </div>
        </aside>
      }
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
      .stats { margin: var(--space-2, 8px) 0 0; color: var(--ant-text-color, #1a2433); font-size: 14px; }
      .stats strong { margin-inline-end: 4px; }
      .stats .dot { margin-inline: 8px; color: var(--qe-line); }
      .stats .muted { color: var(--qe-muted); }
      .hero-actions { display: flex; gap: var(--space-3, 12px); }

      /* Category tab strip — segmented nav over the four loan categories.
         Built on nz-tabset (link-router) so a11y + ink bar come for free;
         restyled with brand tokens for an impec segmented feel. */
      .cat-tabs { margin-block-end: var(--space-5, 20px); }
      .cat-tabs ::ng-deep .ant-tabs-nav { margin: 0; }
      .cat-tabs ::ng-deep .ant-tabs-nav::before { border-block-end-color: var(--qe-line); }
      .cat-tabs ::ng-deep .ant-tabs-ink-bar {
        background: var(--gradient-primary, linear-gradient(90deg, var(--qe-primary), color-mix(in srgb, var(--qe-primary) 55%, #4aa3e0)));
        block-size: 3px;
        border-radius: var(--radius-pill, 999px);
      }
      .cat-tab {
        display: inline-flex; align-items: center; gap: var(--space-2, 8px);
        font-size: 14px; font-weight: 600; color: var(--qe-muted);
        transition: color 160ms ease;
      }
      .cat-tabs ::ng-deep .ant-tabs-tab:hover .cat-tab { color: var(--qe-primary); }
      .cat-tabs ::ng-deep .ant-tabs-tab-active .cat-tab { color: var(--qe-primary); }
      .live-dot {
        inline-size: 8px; block-size: 8px; border-radius: var(--radius-pill, 999px);
        background: var(--success, #2d5f3f);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--success, #2d5f3f) 18%, transparent);
      }
      .cat-count {
        min-inline-size: 22px; text-align: center; font-size: 12px; font-weight: 700;
        color: var(--qe-primary); background: var(--qe-primary-soft);
        padding: 1px 8px; border-radius: var(--radius-pill, 999px);
      }
      .cat-tabs ::ng-deep .ant-tabs-tab:not(.ant-tabs-tab-active) .cat-count {
        color: var(--qe-muted); background: var(--ant-background-color-light, #f6f8fa);
      }

      /* Layout — tree spans full width; inspector is a drawer */
      .tree { min-inline-size: 0; }
      .tree-list {
        display: flex; flex-direction: column; gap: var(--space-4, 16px); min-inline-size: 0;
        animation: qe-fade var(--motion-duration-base, 180ms) var(--motion-easing-standard, ease);
      }
      @media (prefers-reduced-motion: reduce) { .tree-list { animation: none; } }
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
      .ghead-actions { display: flex; align-items: center; gap: var(--space-2, 8px); flex-shrink: 0; }

      /* Overflow kebab (⋮) — always visible, one per group / question / option
         row, inline beside the row content. Quiet muted dot; azure on hover.
         Opens a small Edit · Delete menu. */
      .kebab {
        flex-shrink: 0;
        color: var(--qe-muted);
        transition: color 120ms ease;
      }
      .kebab:hover, .kebab:focus-visible { color: var(--qe-primary); }
      /* ellipsis is horizontal by default → rotate to a vertical kebab */
      .kebab span[nz-icon] { transform: rotate(90deg); }
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4, 16px);
        margin-block-start: var(--space-4, 16px);
      }
      @media (max-width: 760px) { .q-grid { grid-template-columns: 1fr; } }
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
      /* Metadata strip — the question's stable code chip */
      .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block: 8px; }
      .opts { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
      .opt {
        position: relative;
        display: flex; align-items: center; justify-content: space-between; gap: var(--space-3, 12px);
        font-size: 13px; padding: 4px 8px; border-radius: 8px;
      }
      .opt:hover { background: var(--ant-background-color-light, #f6f8fa); }
      .opt-label { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .empty-line { color: var(--qe-muted); font-style: italic; font-size: 13px; margin: var(--space-2, 8px) 0 0; }
      .empty-line.tiny { font-size: 12px; margin-block-start: 4px; }

      /* Inspector drawer */
      /* Match ng-zorro nz-modal (Edit value dialog): same backdrop + surface tokens. */
      .scrim {
        position: fixed; inset: 0; z-index: 1000;
        background: var(--color-overlay-backdrop, rgba(16, 24, 40, 0.45));
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        animation: qe-fade 160ms ease;
      }
      /* Top-aligned + horizontally centered to match nz-modal default position
         (~100px from viewport top, RTL-safe via inset-inline:0 + margin-inline:auto). */
      .drawer {
        position: fixed; z-index: 1001;
        inset-block-start: 100px;
        inset-inline: 0;
        margin-inline: auto;
        inline-size: min(640px, calc(100vw - 48px));
        block-size: fit-content;
        max-block-size: calc(100vh - 148px);
        background: var(--bg-surface, var(--qe-surface));
        border-radius: var(--radius-lg, 14px);
        box-shadow: var(--shadow-xl, 0 24px 64px rgba(16, 24, 40, 0.24));
        overflow-y: auto;
        animation: qe-pop 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes qe-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes qe-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      @media (prefers-reduced-motion: reduce) {
        .scrim, .drawer { animation: none; }
      }
      .ins-card { display: flex; flex-direction: column; gap: var(--space-4, 16px); padding: var(--space-5, 24px); }
      .ins-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-2, 8px);
      }
      .ins-head h3 {
        margin: 0;
        font-size: var(--text-lg, 18px); font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text-primary, #1a2433);
      }
      .ins-note {
        font-size: 12px; color: var(--qe-muted); margin: 0;
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
      .form-actions {
        display: flex; justify-content: flex-end; gap: var(--space-2, 8px);
        margin-block-start: var(--space-2, 8px);
        padding-block-start: var(--space-3, 12px);
        border-block-start: 1px solid var(--color-border-default, var(--qe-line));
      }
      nz-input-number, nz-select { inline-size: 100%; }
    `,
  ],
})
export class QuestionnaireEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  /** Active admin locale drives label language (ar build → Arabic, else English). */
  readonly isAr = inject(LOCALE_ID).startsWith('ar');
  readonly categories = LOAN_CATEGORIES;
  /** Friendly localized category name for the tab strip ("car" → "Auto Loan"). */
  readonly label = categoryLabel;
  /** Active category — reactive so routed tab switches re-render in place. */
  readonly category = toSignal(
    this.route.paramMap.pipe(map((p) => (p.get('category') ?? 'personal') as LoanCategory)),
    { initialValue: (this.route.snapshot.paramMap.get('category') ?? 'personal') as LoanCategory },
  );
  /** All four trees cached client-side → instant, spinner-free tab switching. */
  private readonly treesByCat = signal<Partial<Record<LoanCategory, GroupTreeRow[]>>>({});
  /** Per-tab badge data: LIVE (published version) + question count. */
  readonly tabMeta = signal<Record<LoanCategory, { live: boolean; count: number }>>(
    LOAN_CATEGORIES.reduce(
      (acc, c) => ({ ...acc, [c]: { live: false, count: 0 } }),
      {} as Record<LoanCategory, { live: boolean; count: number }>,
    ),
  );
  readonly groups = computed<GroupTreeRow[]>(() => this.treesByCat()[this.category()] ?? []);
  readonly loading = signal(true);
  readonly mode = signal<Mode>(null);
  /** true → drawer is editing an existing node; false → creating a new one. */
  readonly editing = signal(false);
  readonly totalQuestions = computed(() =>
    this.groups().reduce((sum, g) => sum + g.questions.length, 0),
  );

  private activeGroupId = '';
  private activeQuestionId = '';
  /** Id of the node being edited (empty in create mode). */
  private editingId = '';

  readonly groupForm = new FormGroup({
    titleEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    titleAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
  });
  readonly questionForm = new FormGroup({
    questionEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    questionAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
    isRequired: new FormControl(true, { nonNullable: true }),
  });
  readonly optionForm = new FormGroup({
    labelEn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    labelAr: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayOrder: new FormControl(0, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  cancel(): void {
    this.mode.set(null);
  }

  startGroup(): void {
    this.editingId = '';
    this.editing.set(false);
    this.groupForm.reset({ titleEn: '', titleAr: '', displayOrder: this.groups().length });
    this.mode.set('group');
  }
  editGroup(g: GroupTreeRow): void {
    this.editingId = g.id;
    this.editing.set(true);
    this.groupForm.reset({ titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: g.displayOrder });
    this.mode.set('group');
  }

  startQuestion(g: GroupTreeRow): void {
    this.activeGroupId = g.id;
    this.editingId = '';
    this.editing.set(false);
    this.questionForm.reset({ displayOrder: g.questions.length, isRequired: true } as never);
    this.mode.set('question');
  }
  editQuestion(q: QuestionRow): void {
    this.editingId = q.id;
    this.editing.set(true);
    this.questionForm.reset({
      questionEn: q.questionEn,
      questionAr: q.questionAr,
      displayOrder: q.displayOrder,
      isRequired: q.isRequired,
    } as never);
    this.mode.set('question');
  }

  startOption(questionId: string): void {
    this.activeQuestionId = questionId;
    this.editingId = '';
    this.editing.set(false);
    this.optionForm.reset({ displayOrder: 0 } as never);
    this.mode.set('option');
  }
  editOption(o: OptionRow): void {
    this.editingId = o.id;
    this.editing.set(true);
    this.optionForm.reset({
      labelEn: o.labelEn,
      labelAr: o.labelAr,
      displayOrder: o.displayOrder,
    } as never);
    this.mode.set('option');
  }

  async submitGroup(): Promise<void> {
    if (this.groupForm.invalid) return;
    const v = this.groupForm.getRawValue();
    if (this.editing()) {
      await this.api.updateGroup(this.editingId, {
        titleEn: v.titleEn,
        titleAr: v.titleAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.group_saved:Group saved`);
    } else {
      await this.api.createGroup({ category: this.category(), ...v });
      this.message.success($localize`:@@qedit.group_added:Group added`);
    }
    this.mode.set(null);
    await this.refreshActive();
  }

  async submitQuestion(): Promise<void> {
    if (this.questionForm.invalid) return;
    const v = this.questionForm.getRawValue();
    if (this.editing()) {
      // `code` and `category` are immutable (A33) — never sent.
      await this.api.updateQuestion(this.editingId, {
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        displayOrder: v.displayOrder,
        isRequired: v.isRequired,
      });
      this.message.success($localize`:@@qedit.question_saved:Question saved`);
    } else {
      await this.api.createQuestion({
        groupId: this.activeGroupId,
        category: this.category(),
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        displayOrder: v.displayOrder,
        isRequired: v.isRequired,
      });
      this.message.success($localize`:@@qedit.question_added:Question added`);
    }
    this.mode.set(null);
    await this.refreshActive();
  }

  async submitOption(): Promise<void> {
    if (this.optionForm.invalid) return;
    const v = this.optionForm.getRawValue();
    if (this.editing()) {
      await this.api.updateOption(this.editingId, {
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.option_saved:Option saved`);
    } else {
      await this.api.createOption(this.activeQuestionId, {
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        displayOrder: v.displayOrder,
      });
      this.message.success($localize`:@@qedit.option_added:Option added`);
    }
    this.mode.set(null);
    await this.refreshActive();
  }

  // ---- Deletes (soft-delete server-side; typed-error toasts via interceptor) --
  confirmDeleteGroup(g: GroupTreeRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_group_title:Delete this group?`,
      nzContent: this.isAr ? g.titleAr : g.titleEn,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteGroup(g.id);
          this.message.success($localize`:@@qedit.group_deleted:Group deleted`);
          await this.refreshActive();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  confirmDeleteQuestion(q: QuestionRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_question_title:Delete this question?`,
      nzContent: this.isAr ? q.questionAr : q.questionEn,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteQuestion(q.id);
          this.message.success($localize`:@@qedit.question_deleted:Question deleted`);
          await this.refreshActive();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  confirmDeleteOption(o: OptionRow): void {
    this.modal.confirm({
      nzTitle: $localize`:@@qedit.del_option_title:Delete this option?`,
      nzContent: this.isAr ? o.labelAr : o.labelEn,
      nzCentered: true,
      nzIconType: 'delete',
      nzOkText: $localize`:@@qedit.del_ok:Delete`,
      nzOkDanger: true,
      nzCancelText: $localize`:@@qedit.del_cancel:Cancel`,
      nzOnOk: async () => {
        try {
          await this.api.deleteOption(o.id);
          this.message.success($localize`:@@qedit.option_deleted:Option deleted`);
          await this.refreshActive();
        } catch {
          /* blocked / failed — localized toast already shown by the interceptor */
        }
      },
    });
  }

  async publish(): Promise<void> {
    const cat = this.category();
    const v = await this.api.publish(cat);
    this.message.success($localize`:@@qedit.published:Published version #${v.versionNumber}`);
    // Publishing creates the active version → reflect LIVE on the tab immediately.
    this.tabMeta.update((m) => ({ ...m, [cat]: { ...m[cat], live: true } }));
  }

  /** First load: fetch all four trees + version histories in parallel so tab
   *  switching is instant (cache) and every tab shows its LIVE badge + count. */
  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const [trees, histories] = await Promise.all([
        Promise.all(LOAN_CATEGORIES.map((c) => this.api.tree(c))),
        Promise.all(LOAN_CATEGORIES.map((c) => this.api.versionHistory(c))),
      ]);
      const byCat: Partial<Record<LoanCategory, GroupTreeRow[]>> = {};
      const meta = {} as Record<LoanCategory, { live: boolean; count: number }>;
      LOAN_CATEGORIES.forEach((c, i) => {
        const tree = trees[i] ?? [];
        byCat[c] = tree;
        meta[c] = { live: (histories[i] ?? []).some((v) => v.isActive), count: questionCount(tree) };
      });
      this.treesByCat.set(byCat);
      this.tabMeta.set(meta);
    } finally {
      this.loading.set(false);
    }
  }

  /** After a mutation, re-fetch only the active category's tree + count. */
  private async refreshActive(): Promise<void> {
    const cat = this.category();
    const tree = await this.api.tree(cat);
    this.treesByCat.update((m) => ({ ...m, [cat]: tree }));
    this.tabMeta.update((m) => ({ ...m, [cat]: { ...m[cat], count: questionCount(tree) } }));
  }
}

/** Sum of active questions across a category's groups. */
function questionCount(tree: GroupTreeRow[]): number {
  return tree.reduce((sum, g) => sum + g.questions.length, 0);
}
