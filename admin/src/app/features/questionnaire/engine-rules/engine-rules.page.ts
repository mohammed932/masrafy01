import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  BranchesOutline,
  CalendarOutline,
  DashboardOutline,
  DownOutline,
  EditOutline,
  PercentageOutline,
  SearchOutline,
  SendOutline,
  WalletOutline,
} from '@ant-design/icons-angular/icons';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { CanDirective } from '@shared/can.directive';
import { EmptyStateComponent } from '@shared/empty-state.component';
import {
  RailTabsComponent,
  SkeletonRowsComponent,
  StatusPillComponent,
  openFormDrawer,
  type RailTabItem,
} from '@shared/ui';
import { AnswerMeaningsComponent } from './answer-meanings.component';
import {
  AnswerWordingDrawerComponent,
  type AnswerWordingDrawerData,
} from './answer-wording.drawer';
import { EngineRulesApiService } from './engine-rules.api.service';
import {
  areaLabel,
  impactWhyText,
  labelOf,
  lockBaseLabel,
  lockEngineLabel,
  lockPills,
  lockProgramLabel,
  numericRuleParts,
  readerText,
  textRuleText,
  wordingOf,
} from './engine-rules.labels';
import {
  IMPACT_AREAS,
  WHO_FILTERS,
  areaCounts,
  filterRules,
  impactOf,
  isImpactArea,
  isWhoFilter,
  whoCounts,
  type ImpactArea,
  type WhoFilter,
} from './engine-rules.rules';
import type { EngineRuleOption, EngineRuleQuestion, LabelledKey } from './engine-rules.types';

/** Answers shown before "Show all" — enough for every band list, short of the long lists. */
const ANSWERS_SHOWN = 6;

const AREA_ICONS: Record<ImpactArea, string> = {
  amount: 'wallet',
  rate: 'percentage',
  term: 'calendar',
  debt_limit: 'dashboard',
  questions: 'branches',
  application: 'send',
};

/** One part of the quote a question moves, worded, for one card. */
interface ImpactCell {
  area: ImpactArea;
  label: string;
  icon: string;
  why: string[];
}

interface QuestionImpactView {
  on: ImpactCell[];
  /** The areas it leaves alone, as one quiet line — absence is information too. */
  off: string;
}

/**
 * LOAN ENGINE RULES — the third Questionnaire tab (v30.12.0).
 *
 * Every question the loan engine reads, with who reads it and what each answer means to it,
 * and ONE thing an admin can change: the wording of an answer, in a side sheet. Nothing here
 * adds, removes, reorders or retypes anything — the server refuses those on every screen —
 * and a reword keeps the quantities it states ("Less than 6 months" may become "Under 6
 * months", never "Under 12 months"): the engine reads the answer's code, the applicant picks
 * by its words.
 *
 * A question whose answers ARE a Manage-values list (compounds, club branches, grades) is shown
 * read-only with the list named: the list owns those labels and re-syncs them on every write,
 * so a reword made here would be overwritten.
 */
@Component({
  standalone: true,
  selector: 'app-engine-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
    CanDirective,
    EmptyStateComponent,
    RailTabsComponent,
    SkeletonRowsComponent,
    StatusPillComponent,
    AnswerMeaningsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      BranchesOutline,
      CalendarOutline,
      DashboardOutline,
      DownOutline,
      EditOutline,
      PercentageOutline,
      SearchOutline,
      SendOutline,
      WalletOutline,
    ]),
  ],
  template: `
    <section class="page">
      <p class="sr-only" role="status" aria-live="polite">{{ status() }}</p>
      <header class="bar">
        <div class="bar-lead">
          <p class="eyebrow" i18n="@@qcat.eyebrow">Matching engine</p>
          <h1 i18n="@@qrules.title">Loan engine rules</h1>
          <p class="sub" i18n="@@qrules.sub">
            The questions the loan engine reads, who reads each one and what each answer means. The
            engine reads an answer's code, not its words — reword an answer freely, but keep its
            numbers.
          </p>
        </div>
        <span class="autosave" i18n="@@qcat.autosave">Saves &amp; publishes automatically</span>
      </header>

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[3, 2, 2]" [ariaLabel]="loadingAria" />
      } @else if (loadFailed()) {
        <app-empty-state [title]="loadFailedTitle" [subtitle]="loadFailedSub">
          <button nz-button nzType="primary" type="button" (click)="retry()" i18n="@@qrules.retry">
            Try again
          </button>
        </app-empty-state>
      } @else {
        <div class="toolbar">
          <div class="search" role="search">
            <label class="sr-only" for="qrules-search" i18n="@@qrules.search_label"
              >Search the rules</label
            >
            <nz-input-group [nzPrefix]="searchIcon">
              <input
                nz-input
                id="qrules-search"
                type="search"
                autocomplete="off"
                [value]="search()"
                [placeholder]="searchPlaceholder"
                (input)="onSearch($event)"
              />
            </nz-input-group>
            <ng-template #searchIcon>
              <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            </ng-template>
          </div>
          <label class="numbers-only">
            <input type="checkbox" [checked]="numbersOnly()" (change)="onNumbersOnly($event)" />
            <span i18n="@@qrules.only_numbers">Only answers with numbers</span>
          </label>
        </div>

        <app-rail-tabs
          appearance="pill"
          idPrefix="qrules-who"
          [items]="whoItems()"
          [activeId]="who()"
          [ariaLabel]="whoAria"
          (select)="setWho($event)"
        />

        <div class="areas" role="group" [attr.aria-label]="areaAria">
          <span class="areas-label" aria-hidden="true" i18n="@@qrules.areas_label"
            >What it affects</span
          >
          @for (a of areaItems(); track a.id) {
            <button
              type="button"
              class="area-chip"
              [class.on]="area() === a.id"
              [attr.aria-pressed]="area() === a.id"
              [disabled]="a.count === 0 && area() !== a.id"
              (click)="setArea(a.id)"
            >
              <span nz-icon [nzType]="a.icon" nzTheme="outline" aria-hidden="true"></span>
              <span>{{ a.label }}</span>
              <span class="area-count">{{ a.count }}</span>
            </button>
          }
        </div>

        <div
          class="panel"
          role="tabpanel"
          [id]="'qrules-who-panel-' + who()"
          [attr.aria-labelledby]="'qrules-who-tab-' + who()"
        >
          <div class="showing-row">
            <p class="showing">{{ showing() }}</p>
            @if (collapsibleCount() > 0 && !searching()) {
              <button type="button" class="open-all" (click)="setAllOpen(!allOpen())">
                {{ allOpen() ? collapseAllText : expandAllText }}
              </button>
            }
          </div>
          @if (visible().length === 0) {
            @if (questions().length === 0) {
              <app-empty-state [title]="emptyTitle" />
            } @else {
              <app-empty-state [title]="noMatchTitle" [subtitle]="noMatchSub">
                <button nz-button type="button" (click)="clearFilters()" i18n="@@qrules.clear">
                  Clear filters
                </button>
              </app-empty-state>
            }
          } @else {
            <ol class="rules">
              @for (q of visible(); track q.id) {
                <li class="rule" [attr.aria-labelledby]="'qr-q-' + q.id">
                  <div class="rule-head">
                    <div class="rule-title">
                      <h2 class="q" [id]="'qr-q-' + q.id">{{ wording(q) }}</h2>
                      <!-- The other language, isolated inline: its own direction for its own
                           letters, the page's direction for where the line starts. -->
                      <p class="q-alt">
                        <bdi [attr.lang]="altLang">{{ altWording(q) }}</bdi>
                      </p>
                    </div>
                    <div class="rule-meta">
                      @for (p of pills(q); track p.label) {
                        <app-status-pill [label]="p.label" [tone]="p.tone" />
                      }
                      <bdi class="code">{{ q.code }}</bdi>
                    </div>
                  </div>

                  <section class="impact" [attr.aria-labelledby]="'qr-impact-' + q.id">
                    <h3
                      class="section-title"
                      [id]="'qr-impact-' + q.id"
                      i18n="@@qrules.impact_title"
                    >
                      What it affects
                    </h3>
                    @if (impact(q); as view) {
                      @if (view.on.length > 0) {
                        <ul class="impact-list">
                          @for (c of view.on; track c.area) {
                            <li class="impact-cell" [class.match]="area() === c.area">
                              <span class="impact-icon" aria-hidden="true">
                                <span nz-icon [nzType]="c.icon" nzTheme="outline"></span>
                              </span>
                              <div class="impact-body">
                                <p class="impact-name">{{ c.label }}</p>
                                <ul class="impact-why">
                                  @for (w of c.why; track $index) {
                                    <li>{{ w }}</li>
                                  }
                                </ul>
                              </div>
                            </li>
                          }
                        </ul>
                      } @else {
                        <p class="impact-none" i18n="@@qrules.impact_none">
                          Moves no part of the quote by itself — it is asked as part of the fixed
                          set.
                        </p>
                      }
                      @if (view.off !== '') {
                        <p class="impact-off">{{ view.off }}</p>
                      }
                    }
                  </section>

                  <dl class="facts">
                    <div class="fact">
                      <dt i18n="@@qrules.asked_in">Asked in</dt>
                      <dd>
                        <ul class="cats">
                          @for (c of q.categories; track c) {
                            <li class="cat" [style.--cat]="catColor(c)">{{ catLabel(c) }}</li>
                          }
                          @for (c of q.optInCategories; track c) {
                            <li class="cat opt-in" [style.--cat]="catColor(c)">
                              {{ optInLabel(c) }}
                            </li>
                          }
                          @if (q.categories.length + q.optInCategories.length === 0) {
                            <li class="cat none" i18n="@@qrules.asked_nowhere">
                              Not asked in any loan type
                            </li>
                          }
                        </ul>
                      </dd>
                    </div>
                    <div class="fact">
                      <dt i18n="@@qrules.readers_title">Who reads it</dt>
                      <dd>
                        <ul class="readers">
                          @for (line of readers(q); track $index) {
                            <li>{{ line }}</li>
                          }
                        </ul>
                      </dd>
                    </div>
                    @if (q.type === 'NUMERIC' || q.type === 'TEXT') {
                      <div class="fact">
                        <dt i18n="@@qrules.rule_title">Fixed rule</dt>
                        <dd>{{ ruleText(q) }}</dd>
                      </div>
                    }
                  </dl>

                  @if (q.options.length > 0) {
                    <div class="answers" [class.open]="isOpen(q)">
                      <h3 class="answers-title">
                        <button
                          type="button"
                          class="disclose"
                          [id]="'qr-disclose-' + q.id"
                          [attr.aria-expanded]="isOpen(q)"
                          [attr.aria-controls]="'qr-answers-body-' + q.id"
                          [disabled]="searching()"
                          (click)="toggleOpen(q)"
                        >
                          <span class="disclose-label" i18n="@@qrules.answers_title">Answers</span>
                          <span class="disclose-count">{{ q.options.length }}</span>
                          <span class="disclose-preview" aria-hidden="true">{{ preview(q) }}</span>
                          <span
                            class="chevron"
                            nz-icon
                            nzType="down"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                        </button>
                      </h3>
                      @if (isOpen(q)) {
                        <div
                          class="answers-body"
                          role="region"
                          [id]="'qr-answers-body-' + q.id"
                          [attr.aria-labelledby]="'qr-disclose-' + q.id"
                        >
                          <div class="answers-head">
                            @if (q.mirroredList; as list) {
                              <p class="note">
                                {{ mirroredNote(list) }}
                                <a
                                  *can="['super_admin']"
                                  [routerLink]="['/lookups']"
                                  [queryParams]="{ type: list.key }"
                                  i18n="@@qrules.mirrored_link"
                                  >Open the list</a
                                >
                              </p>
                            } @else {
                              <p class="note" i18n="@@qrules.no_add_note">
                                Answers can't be added or removed here: each one means something to
                                the loan engine.
                              </p>
                            }
                          </div>
                          <ul class="answer-list" [id]="'qr-answers-' + q.id">
                            @for (o of shownOptions(q); track o.id) {
                              <li class="answer" [class.editable]="q.mirroredList === null">
                                <div class="answer-text">
                                  <span class="label">{{ isAr ? o.labelAr : o.labelEn }}</span>
                                  <span class="label-alt"
                                    ><bdi [attr.lang]="altLang">{{
                                      isAr ? o.labelEn : o.labelAr
                                    }}</bdi></span
                                  >
                                  <app-answer-meanings [meanings]="o.meanings" [isAr]="isAr" />
                                </div>
                                @if (q.mirroredList === null) {
                                  <button
                                    type="button"
                                    class="edit"
                                    [id]="'qr-edit-' + o.id"
                                    [attr.aria-label]="editAria(o)"
                                    nz-tooltip
                                    [nzTooltipTitle]="editTip"
                                    (click)="edit(q, o)"
                                  >
                                    <span
                                      nz-icon
                                      nzType="edit"
                                      nzTheme="outline"
                                      aria-hidden="true"
                                    ></span>
                                  </button>
                                }
                              </li>
                            }
                          </ul>
                          @if (q.options.length > answersShown) {
                            <button
                              type="button"
                              class="show-all"
                              [attr.aria-expanded]="isExpanded(q)"
                              [attr.aria-controls]="'qr-answers-' + q.id"
                              (click)="toggle(q)"
                            >
                              {{ isExpanded(q) ? showLess : showAll(q) }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </li>
              }
            </ol>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        inline-size: 100%;
        min-block-size: 100%;
        padding: var(--space-6);
        background: var(--bg-base);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        margin-block-end: var(--space-5);
      }
      .bar-lead {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        max-inline-size: 72ch;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-tonal-accent);
      }
      h1 {
        margin: 0;
        font-family: var(--heading-font);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        letter-spacing: -0.015em;
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .sub {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .autosave {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3) var(--space-5);
        margin-block-end: var(--space-3);
      }
      .search {
        flex: 1 1 18rem;
        max-inline-size: 30rem;
      }
      .numbers-only {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        font-size: var(--text-sm);
        color: var(--text-primary);
        cursor: pointer;
      }
      .numbers-only input {
        inline-size: var(--space-4);
        block-size: var(--space-4);
        accent-color: var(--primary);
        cursor: pointer;
      }
      .numbers-only input:focus-visible,
      .edit:focus-visible,
      .show-all:focus-visible,
      .note a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .areas {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }
      .areas-label {
        margin-inline-end: var(--space-1);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
      }
      .area-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        min-block-size: var(--space-6);
        padding: 0 var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        color: var(--text-primary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .area-chip [nz-icon] {
        color: var(--primary-visible);
      }
      .area-chip:hover:not(:disabled) {
        border-color: var(--primary);
      }
      .area-chip.on {
        border-color: var(--primary);
        background: var(--primary-subtle);
        color: var(--primary-visible);
        font-weight: var(--font-weight-semibold);
      }
      .area-chip:disabled {
        color: var(--text-secondary);
        cursor: not-allowed;
        opacity: 0.6;
      }
      .area-chip:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .area-count {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .area-chip.on .area-count {
        color: inherit;
      }
      .panel {
        margin-block-start: var(--space-4);
      }
      .section-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }
      .impact {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .impact-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
        gap: var(--space-4) var(--space-5);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .impact-cell {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .impact-icon {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: var(--space-6);
        block-size: var(--space-6);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        box-shadow: inset 0 0 0 1px var(--primary-subtle);
        color: var(--primary-visible);
        font-size: var(--text-base);
      }
      .impact-cell.match .impact-icon {
        background: var(--primary);
        color: var(--bg-surface);
      }
      .impact-body {
        display: grid;
        gap: var(--space-0-5);
        min-inline-size: 0;
      }
      .impact-name {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .impact-why {
        display: grid;
        gap: var(--space-0-5);
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .impact-none,
      .impact-off {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .showing-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-4);
        margin-block-end: var(--space-3);
      }
      .showing {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .open-all {
        min-block-size: var(--space-6);
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--primary-visible);
        font: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .open-all:hover {
        background: var(--bg-subtle);
      }
      .rules {
        display: grid;
        gap: var(--space-4);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .rule {
        display: grid;
        gap: var(--space-4);
        padding: var(--space-5);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        min-inline-size: 0;
      }
      .rule-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .rule-title {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        flex: 1 1 20rem;
      }
      .q {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .q-alt,
      .label-alt {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .rule-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .facts {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-2) var(--space-5);
        margin: 0;
      }
      .fact {
        display: contents;
      }
      .facts dt {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        padding-block-start: var(--space-0-5);
      }
      .facts dd {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
        min-inline-size: 0;
      }
      .cats,
      .readers {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .readers {
        display: grid;
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        font-size: var(--text-xs);
        color: var(--text-primary);
      }
      .cat::before {
        content: '';
        inline-size: var(--space-2);
        block-size: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--cat, var(--border-strong));
      }
      .cat.opt-in {
        background: transparent;
        border: 1px dashed var(--border-default);
      }
      .cat.none::before {
        display: none;
      }
      .answers {
        display: grid;
        gap: var(--space-2);
        border-block-start: 1px solid var(--border-subtle);
        padding-block-start: var(--space-3);
        min-inline-size: 0;
      }
      .answers-title {
        margin: 0;
      }
      /* The whole row is the target, not just the arrow: the count and the first answers sit
         on it so a closed card still says what is inside. */
      .disclose {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        inline-size: 100%;
        min-block-size: var(--size-field);
        margin-inline: calc(-1 * var(--space-2));
        padding: 0 var(--space-2);
        box-sizing: content-box;
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-primary);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .disclose:hover:not(:disabled) {
        background: var(--bg-subtle);
      }
      .disclose:disabled {
        cursor: default;
      }
      .disclose:focus-visible,
      .open-all:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .disclose-label {
        flex: none;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
      }
      .disclose-count {
        flex: none;
        min-inline-size: var(--space-5);
        padding: 0 var(--space-1-5);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        font-size: var(--text-xs);
        line-height: var(--space-5);
        text-align: center;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* Sized by the row, never by its own text: a long list must not widen the card. */
      .disclose-preview {
        flex: 1 1 auto;
        min-inline-size: 0;
        contain: inline-size;
        overflow: hidden;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        white-space: nowrap;
        text-overflow: ellipsis;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .answers.open .disclose-preview {
        opacity: 0;
      }
      .chevron {
        flex: none;
        margin-inline-start: auto;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .answers.open .chevron {
        transform: rotate(180deg);
      }
      .disclose:disabled .chevron {
        visibility: hidden;
      }
      .answers-body {
        display: grid;
        gap: var(--space-2);
      }
      .answers-head {
        display: grid;
        gap: var(--space-1);
      }
      .note {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .note a {
        color: var(--primary-visible);
        font-weight: var(--font-weight-semibold);
      }
      .answer-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .answer {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-2);
        border-radius: var(--radius-md);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .answer + .answer {
        border-block-start: 1px solid var(--border-subtle);
      }
      /* A reading aid, not an affordance: only a row with a pencil lights up, so the eye can
         follow a label across to its pencil on a wide screen. */
      .answer.editable:hover {
        background: var(--bg-subtle);
      }
      .answer-text {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .edit {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: var(--size-field);
        block-size: var(--size-field);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .edit:hover {
        background: var(--bg-muted);
        color: var(--primary-visible);
      }
      .edit:active {
        transform: translateY(1px);
      }
      .show-all {
        justify-self: start;
        min-block-size: var(--size-field);
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--primary-visible);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .show-all:hover {
        background: var(--bg-subtle);
      }
      @media (max-width: 768px) {
        .page {
          padding: var(--space-4);
        }
        .rule {
          padding: var(--space-4);
        }
        .facts {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-1);
        }
        .facts dd + dt {
          margin-block-start: var(--space-2);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .answer,
        .edit,
        .area-chip,
        .disclose,
        .disclose-preview,
        .chevron {
          transition: none;
        }
        .edit:active {
          transform: none;
        }
      }
    `,
  ],
})
export class EngineRulesPageComponent implements OnInit {
  private readonly api = inject(EngineRulesApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Arabic primary (Principle IV): wording and names in the UI language, the other beneath. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly altLang = this.isAr ? 'en' : 'ar';
  protected readonly answersShown = ANSWERS_SHOWN;

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly questions = signal<readonly EngineRuleQuestion[]>([]);
  protected readonly who = signal<WhoFilter>('all');
  protected readonly search = signal('');
  protected readonly numbersOnly = signal(false);
  protected readonly area = signal<ImpactArea | null>(null);
  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** Cards whose answers are open. Closed by default: the answers are the long part. */
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  /** A search may have matched an answer, so every answer list stays open while one is typed. */
  protected readonly searching = computed(() => this.search().trim() !== '');

  protected readonly visible = computed(() =>
    filterRules(this.questions(), {
      who: this.who(),
      area: this.area(),
      search: this.search(),
      numbersOnly: this.numbersOnly(),
    }),
  );
  private readonly counts = computed(() =>
    whoCounts(this.questions(), {
      area: this.area(),
      search: this.search(),
      numbersOnly: this.numbersOnly(),
    }),
  );
  protected readonly areaItems = computed(() => {
    const counts = areaCounts(this.questions(), {
      who: this.who(),
      search: this.search(),
      numbersOnly: this.numbersOnly(),
    });
    return IMPACT_AREAS.map((id) => ({
      id,
      label: areaLabel(id),
      icon: AREA_ICONS[id],
      count: counts[id],
    }));
  });
  /** Worded once per load, not once per change-detection pass. */
  private readonly impacts = computed(() => {
    const out = new Map<string, QuestionImpactView>();
    for (const q of this.questions()) out.set(q.id, this.impactView(q));
    return out;
  });
  protected readonly whoItems = computed<RailTabItem[]>(() => {
    const counts = this.counts();
    return WHO_FILTERS.map((id) => {
      const n = counts[id];
      return {
        id,
        label: this.whoLabel(id),
        count: n,
        countLabel: $localize`:@@qrules.count_label:${n}:count: questions`,
      };
    });
  });
  protected readonly showing = computed(() => {
    const shown = this.visible().length;
    const total = this.questions().length;
    return $localize`:@@qrules.showing:${shown}:shown: of ${total}:total: questions`;
  });
  private readonly collapsible = computed(() => this.visible().filter((q) => q.options.length > 0));
  protected readonly collapsibleCount = computed(() => this.collapsible().length);
  protected readonly allOpen = computed(() => {
    const opened = this.opened();
    return this.collapsible().every((q) => opened.has(q.id));
  });
  protected readonly status = computed(() => (this.loading() ? '' : this.showing()));

  protected readonly loadingAria = $localize`:@@qrules.loading_aria:Loading the loan engine rules`;
  protected readonly loadFailedTitle = $localize`:@@qrules.load_failed:Couldn't load the loan engine rules`;
  protected readonly loadFailedSub = $localize`:@@qrules.load_failed_sub:Check your connection and try again.`;
  protected readonly emptyTitle = $localize`:@@qrules.empty_title:The loan engine reads no question yet`;
  protected readonly noMatchTitle = $localize`:@@qrules.no_match_title:No question matches these filters`;
  protected readonly noMatchSub = $localize`:@@qrules.no_match_sub:Try removing one, or clear them all.`;
  protected readonly searchPlaceholder = $localize`:@@qrules.search_ph:Search questions, answers or codes`;
  protected readonly whoAria = $localize`:@@qrules.who_aria:Filter by who reads it`;
  protected readonly areaAria = $localize`:@@qrules.area_aria:Filter by what it affects`;
  protected readonly showLess = $localize`:@@qrules.show_less:Show fewer answers`;
  protected readonly expandAllText = $localize`:@@qrules.expand_all:Open all answers`;
  protected readonly collapseAllText = $localize`:@@qrules.collapse_all:Close all answers`;
  protected readonly editTip = $localize`:@@qrules.edit_tip:Edit wording`;
  private readonly savedText = $localize`:@@qrules.saved:Answer wording saved and published`;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const who = params.get('who');
    if (isWhoFilter(who)) this.who.set(who);
    this.search.set(params.get('search') ?? '');
    this.numbersOnly.set(params.get('numbers') === '1');
    const area = params.get('area');
    if (isImpactArea(area)) this.area.set(area);
    void this.load(true);
  }

  protected retry(): void {
    void this.load(true);
  }

  protected setWho(id: string): void {
    if (!isWhoFilter(id)) return;
    this.who.set(id);
    this.syncUrl();
  }

  /** Pressing the active area again lets go of it. */
  protected setArea(id: ImpactArea): void {
    this.area.set(this.area() === id ? null : id);
    this.syncUrl();
  }

  protected impact(q: EngineRuleQuestion): QuestionImpactView | undefined {
    return this.impacts().get(q.id);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.syncUrl();
  }

  protected onNumbersOnly(event: Event): void {
    this.numbersOnly.set((event.target as HTMLInputElement).checked);
    this.syncUrl();
  }

  protected clearFilters(): void {
    this.who.set('all');
    this.area.set(null);
    this.search.set('');
    this.numbersOnly.set(false);
    this.syncUrl();
  }

  protected edit(q: EngineRuleQuestion, o: EngineRuleOption): void {
    if (q.mirroredList !== null) return;
    const ref = openFormDrawer<AnswerWordingDrawerComponent, AnswerWordingDrawerData, boolean>(
      this.drawer,
      { content: AnswerWordingDrawerComponent, data: { question: q, option: o } },
    );
    ref.afterClose.subscribe((saved) => {
      if (saved !== true) {
        this.focusEdit(o.id);
        return;
      }
      this.message.success(this.savedText);
      void this.load(false).then(() => this.focusEdit(o.id));
    });
  }

  protected toggle(q: EngineRuleQuestion): void {
    const next = new Set(this.expanded());
    if (next.has(q.id)) next.delete(q.id);
    else next.add(q.id);
    this.expanded.set(next);
  }

  protected isOpen(q: EngineRuleQuestion): boolean {
    return this.searching() || this.opened().has(q.id);
  }

  protected toggleOpen(q: EngineRuleQuestion): void {
    const next = new Set(this.opened());
    if (next.has(q.id)) next.delete(q.id);
    else next.add(q.id);
    this.opened.set(next);
  }

  /** Opens or closes every answer list in view; cards filtered out keep their state. */
  protected setAllOpen(open: boolean): void {
    const next = new Set(this.opened());
    for (const q of this.collapsible()) {
      if (open) next.add(q.id);
      else next.delete(q.id);
    }
    this.opened.set(next);
  }

  /** The first answers, in the UI language, as one line on the closed row. */
  protected preview(q: EngineRuleQuestion): string {
    return q.options.map((o) => (this.isAr ? o.labelAr : o.labelEn)).join(this.isAr ? '، ' : ' · ');
  }

  protected isExpanded(q: EngineRuleQuestion): boolean {
    return this.expanded().has(q.id);
  }

  protected shownOptions(q: EngineRuleQuestion): readonly EngineRuleOption[] {
    return this.isExpanded(q) ? q.options : q.options.slice(0, ANSWERS_SHOWN);
  }

  protected wording(q: EngineRuleQuestion): string {
    return wordingOf(q, this.isAr);
  }

  protected altWording(q: EngineRuleQuestion): string {
    return wordingOf(q, !this.isAr);
  }

  protected pills(q: EngineRuleQuestion) {
    return lockPills(q);
  }

  protected readers(q: EngineRuleQuestion): string[] {
    return q.readers.map((r) => readerText(r, this.isAr));
  }

  protected ruleText(q: EngineRuleQuestion): string {
    return q.type === 'TEXT'
      ? textRuleText(q)
      : numericRuleParts(q, this.isAr).join(this.isAr ? '، ' : ' · ');
  }

  protected catLabel(c: LoanCategory): string {
    return categoryLabel(c);
  }

  protected catColor(c: LoanCategory): string {
    return `var(--color-cat-${c})`;
  }

  protected optInLabel(c: LoanCategory): string {
    const category = categoryLabel(c);
    return $localize`:@@qrules.opt_in:${category}:category: · some names`;
  }

  protected mirroredNote(list: LabelledKey): string {
    const name = labelOf(list, this.isAr);
    return $localize`:@@qrules.mirrored_note:These answers are the values of the list “${name}:list:” and are reworded there.`;
  }

  protected editAria(o: EngineRuleOption): string {
    const label = this.isAr ? o.labelAr : o.labelEn;
    return $localize`:@@qrules.edit_aria:Edit the wording of “${label}:label:”`;
  }

  protected showAll(q: EngineRuleQuestion): string {
    const n = q.options.length;
    return $localize`:@@qrules.show_all:Show all ${n}:count: answers`;
  }

  private impactView(q: EngineRuleQuestion): QuestionImpactView {
    const impact = impactOf(q);
    const on: ImpactCell[] = [];
    const off: string[] = [];
    for (const area of IMPACT_AREAS) {
      const why = impact.get(area);
      if (why === undefined) {
        off.push(areaLabel(area));
        continue;
      }
      on.push({
        area,
        label: areaLabel(area),
        icon: AREA_ICONS[area],
        why: why.map((w) => impactWhyText(area, w, this.isAr)),
      });
    }
    const areas = off.join(this.isAr ? '، ' : ' · ');
    return {
      on,
      off:
        on.length === 0 || off.length === 0
          ? ''
          : $localize`:@@qrules.impact_off:Doesn't change: ${areas}:areas:`,
    };
  }

  private whoLabel(id: WhoFilter): string {
    switch (id) {
      case 'all':
        return $localize`:@@qrules.who_all:All`;
      case 'engine':
        return lockEngineLabel();
      case 'base':
        return lockBaseLabel();
      case 'program':
        return lockProgramLabel();
    }
  }

  /** First load shows the skeleton; a reload after a save keeps the list, filters and focus. */
  private async load(first: boolean): Promise<void> {
    if (first) {
      this.loading.set(true);
      this.loadFailed.set(false);
    }
    try {
      this.questions.set((await this.api.rules()).questions);
      this.loadFailed.set(false);
    } catch {
      if (first) this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private syncUrl(): void {
    const search = this.search().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        who: this.who() === 'all' ? null : this.who(),
        area: this.area(),
        search: search === '' ? null : search,
        numbers: this.numbersOnly() ? '1' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private focusEdit(optionId: string): void {
    requestAnimationFrame(() => document.getElementById('qr-edit-' + optionId)?.focus());
  }
}
