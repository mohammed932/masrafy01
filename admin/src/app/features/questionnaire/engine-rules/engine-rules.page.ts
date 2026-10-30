import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ArrowLeftOutline,
  BranchesOutline,
  CalendarOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  DashboardOutline,
  DownOutline,
  EditOutline,
  InfoCircleOutline,
  LineChartOutline,
  PercentageOutline,
  SearchOutline,
  SendOutline,
  SwapOutline,
  WalletOutline,
} from '@ant-design/icons-angular/icons';
import { incomeBasisLabel, type IncomeBasis } from '@core/income-basis';
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
  askedWhenText,
  followUpTag,
  impactWhyText,
  labelOf,
  lockPills,
  numericRuleParts,
  pickMeta,
  readerText,
  textRuleText,
  usageNotes,
  wordingOf,
} from './engine-rules.labels';
import {
  IMPACT_AREAS,
  changesOffer,
  filterRules,
  groupOf,
  impactOf,
  numberedAnswerCount,
  type ImpactArea,
  type RuleGroup,
} from './engine-rules.rules';
import type { EngineRuleOption, EngineRuleQuestion, LabelledKey } from './engine-rules.types';
import { rangeText, type AnswerEffectLevers } from '../answer-effect';
import { EffectChipsComponent } from '../effect-chips.component';

const AREA_ICONS: Record<ImpactArea, string> = {
  amount: 'wallet',
  rate: 'percentage',
  term: 'calendar',
  debt_limit: 'dashboard',
  questions: 'branches',
  application: 'send',
};

/** One question in the picker. */
interface PickItem {
  q: EngineRuleQuestion;
  /** Its place in the asked order, from 1 — kept while a search narrows the list. */
  n: number;
  meta: string;
  /** Its answer changes the offer today; otherwise it is asked and saved, and nothing reads it. */
  onOffer: boolean;
}

/** One answer row of the selected question. */
interface AnswerRow {
  option: EngineRuleOption;
  label: string;
  alt: string;
  /** The quantities its wording has to keep, in the UI language when it states any. */
  keep: string[];
}

/** One range of a Number question's offer effects: the range in words, and its levers. */
interface RangeRow {
  text: string;
  levers: AnswerEffectLevers;
}

/** Everything the right-hand pane shows about the selected question, worded once. */
interface DetailView {
  q: EngineRuleQuestion;
  group: RuleGroup;
  /** "Question 5 of 18" — its place in the tab's asked order. */
  position: string;
  followUp: boolean;
  onOffer: boolean;
  wording: string;
  alt: string;
  /** "Always", or which answer opens it — when, never whether: every question here is asked. */
  askedWhen: string;
  /** The program questions asked in its place where a program asks one (its wording). */
  answeredBy: string[];
  impact: { area: ImpactArea; label: string; icon: string }[];
  /** "How it changes the offer", one line per area, for the technical details. */
  impactWhy: string[];
  readers: string[];
  rows: AnswerRow[];
  /** At least one answer carries a meaning the server owns. */
  hasMeanings: boolean;
  /** When none does: who turns the answer into something, in plain words. */
  usage: string[];
  /** At least one answer states a number its wording has to keep. */
  hasNumbers: boolean;
  typedParts: string[];
  /** A Number question's offer ranges, one row each (v31.3.0). */
  ranges: RangeRow[];
}

/**
 * FIXED QUESTIONS — the third Questionnaire tab (route `engine-rules`).
 *
 * The FIXED questions (`question.fixedServedOn` — the admin's since v31.0.0, marked on the
 * Questions tab), numbered in the order they are asked, and what each of their answers means to
 * the loan engine — on two tabs, by who asks them (`?basis=`, the Program catalog's own Income
 * proof / Surrogate switch). Each question is asked on one side or both (its "Asked on",
 * v32.1.0): an income-proof program asks every one but the surrogate-only ones
 * (`fixedServedOn`); a surrogate program asks the `every_name` and surrogate-only ones
 * (`noPayslip`), the loan amount only where it does not work it out from the car figures. They
 * are MANDATORY and none can be skipped, so nothing here ticks, toggles or unticks a question.
 * Each says only WHEN it is asked (always, or once another answer opens it). Programs add their
 * own questions in the Program catalog. A question asked on both sides is listed on both tabs,
 * so a reworded answer changes on both.
 *
 * ONE thing changes here: an answer's wording, in a side sheet, keeping the numbers it states
 * (the engine prices the answer, the customer picks it by its words — the server refuses a
 * reword that changes a number, `ENGINE_WORDING_NUMBERS_CHANGED`). Everything else about a fixed
 * question is changed on the Questions tab, linked from every question here.
 *
 * A master–detail inspector: the numbered list on the start side (each row two lines — the
 * question, then a dot that is filled when its answer changes the offer and hollow when it is
 * only saved, explained once in a legend under the search), the opened question on the end
 * side. The question reads top to bottom as identity (its place in the order, its tags, its
 * wording, Edit), a band of facts (when it is asked, what it changes), then its answers — or,
 * for a question the customer types into, the rule the number keeps and the ranges that move
 * the offer. Both panes pin under the top bar and scroll on their own, one question on screen
 * at a time. One whose answers ARE a Manage-values list is read-only (the list re-syncs them on
 * every write). Who reads a question and why it is locked are kept, folded under "Technical
 * details".
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
    CanDirective,
    EmptyStateComponent,
    SkeletonRowsComponent,
    StatusPillComponent,
    RailTabsComponent,
    AnswerMeaningsComponent,
    EffectChipsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      BranchesOutline,
      CalendarOutline,
      CheckCircleOutline,
      ClockCircleOutline,
      DashboardOutline,
      DownOutline,
      EditOutline,
      InfoCircleOutline,
      LineChartOutline,
      PercentageOutline,
      SearchOutline,
      SendOutline,
      SwapOutline,
      WalletOutline,
    ]),
  ],
  template: `
    <section class="page">
      <p class="sr-only" role="status" aria-live="polite">{{ status() }}</p>
      <header class="bar">
        <div class="bar-lead">
          <p class="eyebrow" i18n="@@qedit.eyebrow">Matching engine</p>
          <h1 i18n="@@qrules.title">Fixed questions</h1>
          <p class="sub" i18n="@@qrules.sub4">
            Every program on a question's side asks it, in this order, and none can skip it. Reword
            an answer here, keeping its numbers; change anything else on the Questions tab.
          </p>
        </div>
        <span class="autosave">
          <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@qcat.autosave">Saves &amp; publishes automatically</span>
        </span>
      </header>

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[2, 3]" [ariaLabel]="loadingAria" />
      } @else if (loadFailed()) {
        <app-empty-state [title]="loadFailedTitle" [subtitle]="loadFailedSub">
          <button nz-button nzType="primary" type="button" (click)="retry()" i18n="@@qrules.retry">
            Try again
          </button>
        </app-empty-state>
      } @else if (questions().length === 0) {
        <app-empty-state [title]="emptyTitle" />
      } @else {
        <!-- Who asks them: the Program catalog's own switch, so the two words mean one thing. -->
        <app-rail-tabs
          class="basis-rail"
          appearance="segmented"
          [uniform]="true"
          idPrefix="qrules-basis"
          [items]="basisTabs()"
          [activeId]="basis()"
          [ariaLabel]="basisAria"
          (select)="setBasis($event)"
        />
        <div
          class="basis-panel"
          role="tabpanel"
          [id]="'qrules-basis-panel-' + basis()"
          [attr.aria-labelledby]="'qrules-basis-tab-' + basis()"
        >
          @if (basis() === 'no_payslip') {
            <p class="catalog-note">
              <span
                class="catalog-note-icon"
                nz-icon
                nzType="info-circle"
                nzTheme="outline"
                aria-hidden="true"
              ></span>
              <span class="catalog-note-body">
                <span i18n="@@qrules.surrogate_note2"
                  >Surrogate programs skip the fixed questions asked on income-proof programs only:
                  they work the income out another way. Each program also asks its own questions,
                  set in the Program catalog. A question asked on both sides is on both tabs, so a
                  reworded answer changes on both.</span
                >
                <a
                  *can="['super_admin']"
                  [routerLink]="['/program-catalog']"
                  [queryParams]="{ basis: 'no_payslip' }"
                  i18n="@@qrules.catalog_link"
                  >Open the Program catalog</a
                >
              </span>
            </p>
          }
          <div class="workspace" [attr.data-view]="narrowView()">
            <!-- The list. Opening is all it does: nothing here ticks or unticks a question. -->
            <nav class="pane pane-pick" [attr.aria-label]="pickAria">
              <div class="pick-head">
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
                <!-- Said once here instead of on every row; each row's dot carries it for a screen reader. -->
                <p class="legend" aria-hidden="true">
                  <span class="legend-item">
                    <span class="dot"></span>
                    <span i18n="@@qrules.use_offer">Changes the offer</span>
                  </span>
                  <span class="legend-item">
                    <span class="dot off"></span>
                    <span i18n="@@qrules.use_none">Doesn't change the offer</span>
                  </span>
                </p>
              </div>

              @if (picks().length === 0) {
                <div class="no-match">
                  <p class="no-match-title" i18n="@@qrules.no_match_title">
                    No question matches your search
                  </p>
                  <button nz-button type="button" (click)="clearSearch()" i18n="@@qrules.clear">
                    Clear search
                  </button>
                </div>
              } @else {
                <!-- In the order they are asked, numbered per tab; a question keeps its number while a search narrows the list. -->
                <ol class="picks">
                  @for (it of picks(); track it.q.id) {
                    <li>
                      <button
                        type="button"
                        class="pick"
                        [id]="'qr-pick-' + it.q.id"
                        [class.on]="selected()?.id === it.q.id"
                        [attr.aria-current]="selected()?.id === it.q.id ? 'true' : null"
                        (click)="select(it.q)"
                      >
                        <span class="pick-n" aria-hidden="true">{{ it.n }}</span>
                        <span class="pick-body">
                          <span class="pick-q">{{ wordingOf(it.q) }}</span>
                          <span class="pick-meta">
                            <span class="dot" [class.off]="!it.onOffer" aria-hidden="true"></span>
                            @if (it.onOffer) {
                              <span class="sr-only" i18n="@@qrules.use_offer"
                                >Changes the offer</span
                              >
                            } @else {
                              <span class="sr-only" i18n="@@qrules.use_none"
                                >Doesn't change the offer</span
                              >
                            }
                            <span class="pick-meta-text">{{ it.meta }}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  }
                </ol>
              }
            </nav>

            <!-- The opened question. -->
            <article class="pane pane-rule" #rulePane [attr.aria-labelledby]="'qr-rule-title'">
              @if (detail(); as d) {
                <button type="button" class="back" (click)="backToList()">
                  <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@qrules.back">All questions</span>
                </button>

                <header class="rule-head">
                  <div class="rule-id">
                    <p class="rule-tags">
                      <span class="position">{{ d.position }}</span>
                      <span class="tag" [class.tag-on]="d.onOffer">
                        <span class="dot" [class.off]="!d.onOffer" aria-hidden="true"></span>
                        @if (d.onOffer) {
                          <span i18n="@@qrules.use_offer">Changes the offer</span>
                        } @else {
                          <span i18n="@@qrules.use_none">Doesn't change the offer</span>
                        }
                      </span>
                      @if (d.followUp) {
                        <span class="tag">
                          <span
                            nz-icon
                            nzType="branches"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                          <span i18n="@@qrules.tag_follow_up">Follow-up</span>
                        </span>
                      }
                    </p>
                    <h2 class="q" id="qr-rule-title" tabindex="-1" #ruleTitle>{{ d.wording }}</h2>
                    <p class="q-alt">
                      <bdi [attr.lang]="altLang">{{ d.alt }}</bdi>
                    </p>
                  </div>
                  <a
                    nz-button
                    class="edit-btn"
                    [routerLink]="['../questions']"
                    [queryParams]="{ q: d.q.code }"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@qrules.edit_link">Edit this question</span>
                  </a>
                </header>

                <dl class="facts">
                  <div class="fact">
                    <dt>
                      <span
                        nz-icon
                        nzType="clock-circle"
                        nzTheme="outline"
                        aria-hidden="true"
                      ></span>
                      <span i18n="@@qrules.asked_when">When it is asked</span>
                    </dt>
                    <dd>{{ d.askedWhen }}</dd>
                  </div>
                  <div class="fact">
                    <dt>
                      <span nz-icon nzType="line-chart" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@qrules.changes">Changes the customer's</span>
                    </dt>
                    <dd>
                      @if (d.impact.length > 0) {
                        <ul class="impacts">
                          @for (c of d.impact; track c.area) {
                            <li class="impact">
                              <span
                                nz-icon
                                [nzType]="c.icon"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
                              {{ c.label }}
                            </li>
                          }
                        </ul>
                      } @else {
                        <span class="quiet" i18n="@@qrules.impact_none">
                          Nothing — the answer is saved and shown on the application, but no program
                          uses it to work out an offer.
                        </span>
                      }
                    </dd>
                  </div>
                  @if (d.answeredBy.length > 0) {
                    <div class="fact fact-wide">
                      <dt>
                        <span nz-icon nzType="swap" nzTheme="outline" aria-hidden="true"></span>
                        <span i18n="@@qrules.answered_by">Asked instead</span>
                      </dt>
                      <dd class="instead">
                        <span class="quiet" i18n="@@qrules.answered_by_hint"
                          >Where a program asks its own version:</span
                        >
                        <ul class="impacts">
                          @for (w of d.answeredBy; track w) {
                            <li class="impact">{{ w }}</li>
                          }
                        </ul>
                      </dd>
                    </div>
                  }
                </dl>

                @switch (d.group) {
                  @case ('typed') {
                    <section class="block" aria-labelledby="qr-typed-h">
                      <div class="block-head">
                        <h3 class="block-title" id="qr-typed-h" i18n="@@qrules.typed_title">
                          What the customer types
                        </h3>
                      </div>
                      <div class="spec">
                        <p class="spec-lead">
                          @if (d.q.type === 'TEXT') {
                            <span i18n="@@qrules.typed_text">The customer types text.</span>
                          } @else {
                            <span i18n="@@qrules.typed_number">The customer types a number.</span>
                          }
                        </p>
                        @if (d.typedParts.length > 0) {
                          <ul class="spec-parts">
                            @for (part of d.typedParts; track $index) {
                              <li>{{ part }}</li>
                            }
                          </ul>
                        }
                      </div>
                      @if (d.ranges.length > 0) {
                        <div class="frame">
                          <table class="grid ranges">
                            <caption class="frame-caption" i18n="@@qrules.ranges_title">
                              What the number does to the offer
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col" i18n="@@qrules.col_range">When the number is</th>
                                <th scope="col" i18n="@@qrules.use_offer">Changes the offer</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (r of d.ranges; track $index) {
                                <tr>
                                  <td class="cell-range">{{ r.text }}</td>
                                  <td [attr.data-label]="colOffer">
                                    <app-effect-chips [levers]="r.levers" />
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                      <p class="block-foot">
                        <span i18n="@@qrules.typed_note">There are no answers to reword here.</span>
                        <a
                          [routerLink]="['../questions']"
                          [queryParams]="{ q: d.q.code }"
                          i18n="@@qrules.typed_link"
                          >Change the question's wording</a
                        >
                      </p>
                    </section>
                  }
                  @default {
                    <section class="block" aria-labelledby="qr-answers-h">
                      <div class="block-head">
                        <h3 class="block-title" id="qr-answers-h">
                          <span i18n="@@qrules.answers_title">Answers</span>
                          <span class="count">{{ d.rows.length }}</span>
                        </h3>
                        <p class="block-note">
                          @if (d.q.lock !== null) {
                            <span i18n="@@qrules.no_add_note">
                              Answers can't be added or removed here: each one means something to
                              the loan engine.
                            </span>
                          } @else {
                            <span i18n="@@qrules.no_add_note_pool">
                              Add or remove answers on the Questions tab.
                            </span>
                          }
                        </p>
                      </div>
                      @if (d.q.mirroredList; as list) {
                        <p class="banner">
                          <span
                            class="banner-icon"
                            nz-icon
                            nzType="info-circle"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                          <span>
                            {{ mirroredNote(list) }}
                            <a
                              *can="['super_admin']"
                              [routerLink]="['/lookups']"
                              [queryParams]="{ type: list.key }"
                              i18n="@@qrules.mirrored_link"
                              >Open the list</a
                            >
                          </span>
                        </p>
                      }
                      @if (!d.hasMeanings) {
                        <ul class="usage">
                          @for (line of d.usage; track $index) {
                            <li>{{ line }}</li>
                          }
                        </ul>
                      }

                      <div class="frame">
                        <table class="grid answers" aria-labelledby="qr-answers-h">
                          <thead>
                            <tr>
                              <th scope="col" i18n="@@qrules.col_sees">The customer sees</th>
                              @if (d.hasMeanings) {
                                <th scope="col" i18n="@@qrules.col_means">
                                  The loan engine understands
                                </th>
                              }
                              @if (d.hasNumbers) {
                                <th scope="col" i18n="@@qrules.col_keep">Numbers to keep</th>
                              }
                              @if (d.group === 'reword') {
                                <th scope="col" class="col-act">
                                  <span class="sr-only" i18n="@@qrules.col_reword">Reword</span>
                                </th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (r of d.rows; track r.option.id) {
                              <tr>
                                <td class="cell-sees">
                                  <span class="label">{{ r.label }}</span>
                                  <span class="label-alt"
                                    ><bdi [attr.lang]="altLang">{{ r.alt }}</bdi></span
                                  >
                                </td>
                                @if (d.hasMeanings) {
                                  <td class="cell-means" [attr.data-label]="colMeans">
                                    @if (r.option.meanings.length > 0) {
                                      <app-answer-meanings
                                        [meanings]="r.option.meanings"
                                        [isAr]="isAr"
                                      />
                                    } @else {
                                      <span class="dash" aria-hidden="true">—</span>
                                    }
                                  </td>
                                }
                                @if (d.hasNumbers) {
                                  <td class="cell-keep" [attr.data-label]="colKeep">
                                    @if (r.keep.length > 0) {
                                      <ul class="keep">
                                        @for (k of r.keep; track $index) {
                                          <li>
                                            <bdi>{{ k }}</bdi>
                                          </li>
                                        }
                                      </ul>
                                    } @else {
                                      <span class="dash" aria-hidden="true">—</span>
                                      <span class="sr-only" i18n="@@qrules.keep_cell_none"
                                        >No numbers</span
                                      >
                                    }
                                  </td>
                                }
                                @if (d.group === 'reword') {
                                  <td class="cell-act">
                                    <button
                                      nz-button
                                      nzType="text"
                                      type="button"
                                      class="reword"
                                      [id]="'qr-edit-' + r.option.id"
                                      [attr.aria-label]="editAria(r.label)"
                                      (click)="edit(d.q, r.option)"
                                    >
                                      <span
                                        nz-icon
                                        nzType="edit"
                                        nzTheme="outline"
                                        aria-hidden="true"
                                      ></span>
                                      <span i18n="@@qrules.col_reword">Reword</span>
                                    </button>
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </section>
                  }
                }

                <details class="tech">
                  <summary>
                    <span i18n="@@qrules.details">Technical details</span>
                    <span
                      class="tech-chevron"
                      nz-icon
                      nzType="down"
                      nzTheme="outline"
                      aria-hidden="true"
                    ></span>
                  </summary>
                  <dl class="tech-list">
                    <div class="tech-row">
                      <dt i18n="@@qrules.details_code">Question code</dt>
                      <dd>
                        <bdi class="code">{{ d.q.code }}</bdi>
                      </dd>
                    </div>
                    <div class="tech-row">
                      <dt i18n="@@qrules.details_why">Why it is locked</dt>
                      <dd class="pills">
                        @for (p of pills(d.q); track p.label) {
                          <app-status-pill [label]="p.label" [tone]="p.tone" />
                        }
                      </dd>
                    </div>
                    <div class="tech-row">
                      <dt i18n="@@qrules.readers_title">Who uses it</dt>
                      <dd>
                        <ul class="lines">
                          @for (line of d.readers; track $index) {
                            <li>{{ line }}</li>
                          }
                        </ul>
                      </dd>
                    </div>
                    @if (d.impactWhy.length > 0) {
                      <div class="tech-row">
                        <dt i18n="@@qrules.details_how">How it changes the offer</dt>
                        <dd>
                          <ul class="lines">
                            @for (line of d.impactWhy; track $index) {
                              <li>{{ line }}</li>
                            }
                          </ul>
                        </dd>
                      </div>
                    }
                  </dl>
                </details>
              }
            </article>
          </div>
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
        padding: var(--space-5) var(--space-6);
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

      /* ---- Header: the Questions tab's command bar, so the two tabs read as one section ---- */
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-2) var(--space-4);
        margin-block-end: var(--space-4);
      }
      .bar-lead {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        max-inline-size: 68ch;
      }
      /* The ink, not the plain accent: the plain one is under AA at this size in light mode. */
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-tonal-accent-ink);
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
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .autosave [nz-icon] {
        color: var(--color-success);
      }
      .basis-rail {
        display: block;
        margin-block-end: var(--space-3);
      }
      .basis-panel {
        display: grid;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .catalog-note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2-5) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-primary);
      }
      .catalog-note-icon {
        flex: none;
        margin-block-start: var(--space-0-5);
        color: var(--color-info);
      }
      .catalog-note-body {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        max-inline-size: 96ch;
      }
      .catalog-note a,
      .block-foot a,
      .banner a {
        color: var(--primary-visible);
        font-weight: var(--font-weight-semibold);
      }

      /* ---- The two panes ------------------------------------------------------------------
         Both pin under the top bar and scroll on their own, so the page itself only ever
         scrolls the header away: one question on screen, never the whole pool. */
      .workspace {
        --pane-max: calc(100dvh - var(--topbar-height) - var(--space-6) * 2);
        display: grid;
        grid-template-columns: minmax(17rem, 23rem) minmax(0, 1fr);
        align-items: start;
        gap: var(--space-4);
      }
      .pane {
        position: sticky;
        inset-block-start: 0;
        max-block-size: var(--pane-max);
        overflow-y: auto;
        overscroll-behavior: contain;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        min-inline-size: 0;
      }
      .pane-pick {
        display: grid;
        align-content: start;
      }
      .pane-rule {
        display: grid;
        align-content: start;
        gap: var(--space-5);
        padding: var(--space-5) var(--space-6) var(--space-6);
        container-type: inline-size;
      }

      /* ---- The list ------------------------------------------------------------------------ */
      /* Search and legend stay put while the list scrolls under them. */
      .pick-head {
        position: sticky;
        inset-block-start: 0;
        z-index: 1;
        display: grid;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-3) var(--space-2);
        border-block-end: 1px solid var(--border-subtle);
        background: var(--bg-surface);
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-3);
        margin: 0;
        padding-inline: var(--space-1);
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
      }
      /* Filled: the answer changes the offer. Hollow: it is only saved on the application. */
      .dot {
        flex: none;
        display: inline-block;
        inline-size: var(--space-2);
        block-size: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-success-dot);
      }
      .dot.off {
        background: transparent;
        box-shadow: inset 0 0 0 1px var(--border-strong);
      }
      .no-match {
        display: grid;
        justify-items: start;
        gap: var(--space-2);
        padding: var(--space-4);
      }
      .no-match-title {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .picks {
        display: grid;
        gap: var(--space-0-5);
        margin: 0;
        padding: var(--space-2);
        list-style: none;
      }
      .pick {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        inline-size: 100%;
        padding: var(--space-2) var(--space-2-5);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-primary);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pick:hover {
        background: var(--bg-subtle);
      }
      .pick.on {
        background: var(--primary-subtle);
      }
      /* The question's place in the asked order: the number the Questions tab prints too. */
      .pick-n {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: var(--space-6);
        block-size: var(--space-6);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pick.on .pick-n {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .pick-body {
        display: grid;
        gap: var(--space-0-5);
        min-inline-size: 0;
        padding-block-start: var(--space-0-5);
      }
      .pick-q {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
      }
      .pick.on .pick-q {
        font-weight: var(--font-weight-semibold);
        color: var(--primary-visible);
      }
      .pick-meta {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
        min-inline-size: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .pick-meta-text {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ---- The opened question: identity ---------------------------------------------------- */
      .back {
        display: none;
        justify-self: start;
        align-items: center;
        gap: var(--space-1-5);
        min-block-size: var(--size-field);
        padding: 0 var(--space-2);
        margin-inline-start: calc(-1 * var(--space-2));
        margin-block-end: calc(-1 * var(--space-3));
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--primary-visible);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .back:hover {
        background: var(--bg-subtle);
      }
      :host-context([dir='rtl']) .back [nz-icon] {
        transform: scaleX(-1);
      }
      .rule-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3) var(--space-4);
      }
      .rule-id {
        flex: 999 1 20rem;
        display: grid;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .rule-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1-5) var(--space-2);
        margin: 0;
      }
      .position {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        padding: var(--space-0-5) var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--text-secondary);
      }
      .tag-on {
        border-color: transparent;
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .q {
        margin: 0;
        font-family: var(--heading-font);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        letter-spacing: -0.01em;
        line-height: var(--leading-tight);
        color: var(--text-primary);
      }
      .q:focus {
        outline: none;
      }
      .q-alt {
        margin: calc(-1 * var(--space-1)) 0 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .edit-btn {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
      }

      /* ---- Facts: one tinted band, a column per fact ---------------------------------------- */
      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: var(--space-3) var(--space-5);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .fact {
        display: grid;
        align-content: start;
        gap: var(--space-1-5);
        min-inline-size: 0;
      }
      .fact-wide {
        grid-column: 1 / -1;
      }
      .fact dt {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
      }
      .fact dd {
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-primary);
      }
      .quiet {
        color: var(--text-secondary);
      }
      .impacts {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-1-5);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .impact {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0-5) var(--space-2);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
      }
      .impact [nz-icon] {
        color: var(--primary-visible);
      }
      .instead {
        display: grid;
        justify-items: start;
        gap: var(--space-1-5);
      }

      /* ---- A section: the answers, or what the customer types ------------------------------- */
      .block {
        display: grid;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .block-head {
        display: grid;
        gap: var(--space-1);
      }
      .block-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
      }
      .count {
        display: inline-grid;
        place-items: center;
        min-inline-size: var(--space-5);
        padding: 0 var(--space-1-5);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .block-note {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .block-foot {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .spec {
        display: grid;
        gap: var(--space-2);
      }
      .spec-lead {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .spec-parts {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      /* Read-only facts, so tinted and borderless: a bordered box here read as a button. */
      .spec-parts li {
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .banner {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2-5) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        color: var(--text-primary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .banner-icon {
        flex: none;
        margin-block-start: var(--space-0-5);
        color: var(--color-info);
      }
      .usage {
        display: grid;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }

      /* ---- Tables: the answers and the number ranges ---------------------------------------- */
      .frame {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .grid {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      .frame-caption {
        caption-side: top;
        padding: var(--space-2-5) var(--space-3);
        border-block-end: 1px solid var(--border-subtle);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        text-align: start;
        color: var(--text-primary);
      }
      .grid th {
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--border-default);
        background: var(--bg-subtle);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        text-align: start;
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .grid th.col-act {
        inline-size: 1%;
      }
      .grid td {
        padding: var(--space-3);
        border-block-end: 1px solid var(--border-subtle);
        vertical-align: top;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .grid tbody tr:last-child td {
        border-block-end: 0;
      }
      .grid tbody tr:hover td {
        background: var(--bg-subtle);
      }
      .cell-range {
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        white-space: nowrap;
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* Blocks inside the cell, never a grid ON it: a td that is not a table-cell drops out of
         the row, and its rule stops short of a tall neighbour. */
      .label {
        display: block;
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .label-alt {
        display: block;
        margin-block-start: var(--space-0-5);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .keep {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .keep li {
        padding: var(--space-0-5) var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-primary);
      }
      .dash {
        color: var(--text-tertiary);
      }
      .cell-act {
        text-align: end;
        white-space: nowrap;
        vertical-align: middle;
      }
      .reword {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        color: var(--primary-visible);
      }

      /* A narrow pane stacks each row: words, then meaning, then numbers, then Reword. */
      @container (max-width: 34rem) {
        .grid thead {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip-path: inset(50%);
        }
        .grid tr {
          display: grid;
          gap: var(--space-2);
          padding: var(--space-3);
          border-block-end: 1px solid var(--border-subtle);
        }
        .grid tbody tr:last-child {
          border-block-end: 0;
        }
        .grid td {
          display: block;
          padding: 0;
          border: 0;
        }
        .grid tbody tr:hover td {
          background: transparent;
        }
        .grid td[data-label]::before {
          content: attr(data-label);
          display: block;
          margin-block-end: var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--text-secondary);
        }
        .cell-act {
          text-align: start;
        }
        .reword {
          margin-inline-start: calc(-1 * var(--space-2));
        }
      }

      /* ---- Technical details --------------------------------------------------------------- */
      .tech {
        border-block-start: 1px solid var(--border-subtle);
        padding-block-start: var(--space-3);
      }
      .tech summary {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        list-style: none;
        min-block-size: var(--size-field);
        padding: 0 var(--space-2);
        margin-inline-start: calc(-1 * var(--space-2));
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .tech summary::-webkit-details-marker {
        display: none;
      }
      .tech-chevron {
        font-size: var(--text-xs);
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .tech[open] .tech-chevron {
        transform: rotate(180deg);
      }
      .tech summary:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .tech-list {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-2-5) var(--space-5);
        margin: var(--space-3) 0 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .tech-row {
        display: contents;
      }
      .tech-list dt {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        padding-block-start: var(--space-0-5);
      }
      .tech-list dd {
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .lines {
        display: grid;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
        line-height: var(--leading-normal);
      }
      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }

      /* ---- Focus ----------------------------------------------------------------------------- */
      .catalog-note a:focus-visible,
      .block-foot a:focus-visible,
      .banner a:focus-visible,
      .pick:focus-visible,
      .back:focus-visible,
      .q:focus-visible,
      .tech summary:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      /* ---- Narrow screens: one pane at a time ---------------------------------------------- */
      @media (max-width: 900px) {
        .workspace {
          grid-template-columns: minmax(0, 1fr);
        }
        .pane {
          position: static;
          max-block-size: none;
          overflow: visible;
        }
        .pick-head {
          position: static;
        }
        .workspace[data-view='list'] .pane-rule,
        .workspace[data-view='detail'] .pane-pick {
          display: none;
        }
        .back {
          display: inline-flex;
        }
        /* A finger, not a pointer: every action a full touch target tall. */
        .edit-btn,
        .reword {
          min-block-size: var(--size-field);
        }
        .page {
          padding: var(--space-4);
        }
        .pane-rule {
          gap: var(--space-4);
          padding: var(--space-4);
        }
        .tech-list {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-1);
        }
        .tech-list dd + dt {
          margin-block-start: var(--space-2);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pick,
        .pick-n,
        .back,
        .grid td,
        .tech summary,
        .tech-chevron {
          transition: none;
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

  private readonly rulePane = viewChild<ElementRef<HTMLElement>>('rulePane');
  private readonly ruleTitle = viewChild<ElementRef<HTMLElement>>('ruleTitle');

  /** Arabic primary (Principle IV): wording and names in the UI language, the other beneath. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly altLang = this.isAr ? 'en' : 'ar';

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly questions = signal<readonly EngineRuleQuestion[]>([]);
  protected readonly search = signal('');
  /** Which programs' questions are on screen: `payslip` = Income proof, `no_payslip` = Surrogate. */
  protected readonly basis = signal<IncomeBasis>('payslip');
  /** The opened question's code; `null` = the first in the list. */
  private readonly selectedCode = signal<string | null>(null);
  /** On a narrow screen only one pane shows: the list, or the opened question. */
  protected readonly narrowView = signal<'list' | 'detail'>('list');
  protected readonly searching = computed(() => this.search().trim() !== '');

  /** The questions the tab's programs ask, in the order they are asked. */
  private readonly shown = computed<readonly EngineRuleQuestion[]>(() =>
    this.questions().filter(this.basis() === 'payslip' ? asksWithPayslip : asksWithoutPayslip),
  );

  protected readonly basisTabs = computed<RailTabItem[]>(() => {
    const all = this.questions();
    return [
      {
        id: 'payslip',
        label: incomeBasisLabel('payslip'),
        note: this.proofNote,
        count: all.filter(asksWithPayslip).length,
        countLabel: this.countLabel,
        accent: 'var(--color-brand-primary)',
      },
      {
        id: 'no_payslip',
        label: incomeBasisLabel('no_payslip'),
        note: this.surrogateNote,
        count: all.filter(asksWithoutPayslip).length,
        countLabel: this.countLabel,
        accent: 'var(--color-income-surrogate)',
      },
    ];
  });

  /** Every question on the tab with its number in the asked order, worded once per load. */
  private readonly numbered = computed<PickItem[]>(() => {
    const byCode = new Map(this.questions().map((q) => [q.code, q]));
    return this.shown().map((q, index) => {
      const meta = pickMeta(q, numberedAnswerCount(q), this.isAr);
      return {
        q,
        n: index + 1,
        meta: q.askedWhen === null ? meta : `${meta} · ${followUpTag()}`,
        onOffer: changesOffer(q, byCode),
      };
    });
  });

  /** The list as searched — in the asked order, each question keeping its own number. */
  protected readonly picks = computed<PickItem[]>(() => {
    const matching = new Set(filterRules(this.shown(), this.search()).map((q) => q.id));
    return this.numbered().filter((it) => matching.has(it.q.id));
  });

  protected readonly selected = computed<EngineRuleQuestion | null>(() => {
    const all = this.shown();
    const code = this.selectedCode();
    const picked = code === null ? undefined : all.find((q) => q.code === code);
    return picked ?? all[0] ?? null;
  });

  protected readonly detail = computed<DetailView | null>(() => {
    const q = this.selected();
    if (q === null) return null;
    const all = this.numbered();
    const it = all.find((p) => p.q.id === q.id);
    return this.detailOf(q, it?.n ?? 1, all.length, it?.onOffer ?? false);
  });

  protected readonly status = computed(() => {
    if (this.loading() || !this.searching()) return '';
    const shown = this.picks().length;
    const total = this.shown().length;
    return $localize`:@@qrules.showing:${shown}:shown: of ${total}:total: questions`;
  });

  protected readonly loadingAria = $localize`:@@qrules.loading_aria:Loading the fixed questions`;
  protected readonly loadFailedTitle = $localize`:@@qrules.load_failed:Couldn't load the fixed questions`;
  protected readonly loadFailedSub = $localize`:@@qrules.load_failed_sub:Check your connection and try again.`;
  protected readonly emptyTitle = $localize`:@@qrules.empty_title:No fixed question is switched on`;
  protected readonly searchPlaceholder = $localize`:@@qrules.search_ph:Search questions or answers`;
  protected readonly pickAria = $localize`:@@qrules.pick_aria:Fixed questions, in the order they are asked`;
  protected readonly basisAria = $localize`:@@qrules.basis_aria:Which programs ask them`;
  private readonly proofNote = $localize`:@@qrules.basis_proof_note:Asked on every income-proof program`;
  private readonly surrogateNote = $localize`:@@qrules.basis_surrogate_note:Asked on every surrogate program`;
  private readonly countLabel = $localize`:@@qrules.basis_count:questions`;
  private readonly unlessDerivedText = $localize`:@@qrules.asked_unless_derived:Always, unless the program works the amount out from the car price and down payment`;
  protected readonly colMeans = $localize`:@@qrules.col_means:The loan engine understands`;
  protected readonly colKeep = $localize`:@@qrules.col_keep:Numbers to keep`;
  protected readonly colOffer = $localize`:@@qrules.use_offer:Changes the offer`;
  private readonly savedText = $localize`:@@qrules.saved:Answer wording saved and published`;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.search.set(params.get('search') ?? '');
    if (params.get('basis') === 'no_payslip') this.basis.set('no_payslip');
    const code = params.get('q');
    if (code !== null && code !== '') {
      this.selectedCode.set(code);
      this.narrowView.set('detail');
    }
    void this.load(true);
  }

  protected retry(): void {
    void this.load(true);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.syncUrl();
  }

  /** Switch tab. A question the other tab does not show is let go, and a narrow screen shows the list. */
  protected setBasis(id: string): void {
    const next: IncomeBasis = id === 'no_payslip' ? 'no_payslip' : 'payslip';
    if (next === this.basis()) return;
    this.basis.set(next);
    const code = this.selectedCode();
    if (code !== null && !this.shown().some((q) => q.code === code)) this.selectedCode.set(null);
    this.narrowView.set('list');
    this.syncUrl();
  }

  protected clearSearch(): void {
    this.search.set('');
    this.syncUrl();
    requestAnimationFrame(() => document.getElementById('qrules-search')?.focus());
  }

  /** Step 1 → 2: show the question, from its top; on a narrow screen, in place of the list. */
  protected select(q: EngineRuleQuestion): void {
    const narrow = this.narrowView() === 'list' && this.isNarrow();
    this.selectedCode.set(q.code);
    this.narrowView.set('detail');
    this.syncUrl();
    requestAnimationFrame(() => {
      this.rulePane()?.nativeElement.scrollTo({ top: 0 });
      if (narrow) this.ruleTitle()?.nativeElement.focus();
    });
  }

  protected backToList(): void {
    const id = this.selected()?.id;
    this.narrowView.set('list');
    requestAnimationFrame(() => {
      if (id !== undefined) document.getElementById('qr-pick-' + id)?.focus();
    });
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

  protected wordingOf(q: EngineRuleQuestion): string {
    return wordingOf(q, this.isAr);
  }

  protected pills(q: EngineRuleQuestion) {
    return lockPills(q);
  }

  protected mirroredNote(list: LabelledKey): string {
    const name = labelOf(list, this.isAr);
    return $localize`:@@qrules.mirrored_note:These answers come from the list “${name}:list:”. Reword them on Manage values, not here.`;
  }

  protected editAria(label: string): string {
    return $localize`:@@qrules.edit_aria:Edit the wording of “${label}:label:”`;
  }

  private detailOf(q: EngineRuleQuestion, n: number, total: number, onOffer: boolean): DetailView {
    const surrogate = this.basis() === 'no_payslip';
    const unit = (this.isAr ? q.numeric?.unitAr : q.numeric?.unitEn) ?? null;
    const impact = impactOf(q);
    const areas = IMPACT_AREAS.filter((a) => impact.has(a));
    const rows: AnswerRow[] = q.options.map((o) => {
      const mine = this.isAr ? o.keep.ar : o.keep.en;
      const other = this.isAr ? o.keep.en : o.keep.ar;
      return {
        option: o,
        label: this.isAr ? o.labelAr : o.labelEn,
        alt: this.isAr ? o.labelEn : o.labelAr,
        keep: mine.length > 0 ? mine : other,
      };
    });
    const hasMeanings = q.options.some((o) => o.meanings.length > 0);
    return {
      q,
      group: groupOf(q),
      position: $localize`:@@qrules.position:Question ${n}:n: of ${total}:total:`,
      followUp: q.askedWhen !== null,
      onOffer,
      wording: wordingOf(q, this.isAr),
      alt: wordingOf(q, !this.isAr),
      askedWhen:
        surrogate && q.noPayslip === 'unless_derived'
          ? this.unlessDerivedText
          : askedWhenText(q, this.isAr),
      // A program's own stand-in is a surrogate program's question: said on that tab only.
      answeredBy: surrogate
        ? (q.answeredBy ?? []).map((r) => (this.isAr ? r.questionAr : r.questionEn))
        : [],
      impact: areas.map((area) => ({ area, label: areaLabel(area), icon: AREA_ICONS[area] })),
      impactWhy: areas.flatMap((area) =>
        (impact.get(area) ?? []).map(
          (why) => `${areaLabel(area)}: ${impactWhyText(area, why, this.isAr)}`,
        ),
      ),
      readers: q.readers.map((r) => readerText(r, this.isAr)),
      rows,
      hasMeanings,
      usage: hasMeanings ? [] : usageNotes(q, this.isAr),
      hasNumbers: rows.some((r) => r.keep.length > 0),
      typedParts:
        q.type === 'TEXT'
          ? [textRuleText(q)]
          : q.options.length === 0
            ? numericRuleParts(q, this.isAr)
            : [],
      ranges: (q.numberEffects ?? []).map((r) => ({ text: rangeText(r, unit), levers: r })),
    };
  }

  private isNarrow(): boolean {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  /** First load shows the skeleton; a reload after a save keeps the picked question and focus. */
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
    if (first) this.revealPick();
  }

  /**
   * A question opened from a link (`?q=`) may sit far down the list: bring its row into view
   * beside it. "Nearest" moves nothing when the row already shows; otherwise it scrolls the list
   * pane and, for a row near the end, the page too — until the header scrolls away the pane runs
   * past the bottom of the window, and its last rows can only be shown by moving the page.
   */
  private revealPick(): void {
    const id = this.selected()?.id;
    if (id === undefined || this.isNarrow()) return;
    requestAnimationFrame(() =>
      document.getElementById('qr-pick-' + id)?.scrollIntoView({ block: 'nearest' }),
    );
  }

  private syncUrl(): void {
    const search = this.search().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.selectedCode(),
        search: search === '' ? null : search,
        basis: this.basis() === 'payslip' ? null : this.basis(),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private focusEdit(optionId: string): void {
    requestAnimationFrame(() => document.getElementById('qr-edit-' + optionId)?.focus());
  }
}

/**
 * An income-proof program asks it: every fixed question but the surrogate-only ones (v32.1.0).
 * A server too old to send `fixedServedOn` had no surrogate-only question, so every one is.
 */
function asksWithPayslip(q: EngineRuleQuestion): boolean {
  return q.fixedServedOn !== 'income_surrogate';
}

/**
 * A surrogate program asks it — the loan amount too, wherever it is not worked out. Only on the
 * server's word: a server too old to send `noPayslip` must not list every question as asked.
 */
function asksWithoutPayslip(q: EngineRuleQuestion): boolean {
  return q.noPayslip === 'always' || q.noPayslip === 'unless_derived';
}
