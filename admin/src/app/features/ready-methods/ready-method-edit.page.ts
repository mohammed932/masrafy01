/**
 * Add or change one ready method (v37.0.0): its name, the question that decides the amount,
 * how, an optional second question for the columns, and the default figures.
 *
 * The same building blocks as a product's Amount step, for ONE method, with no product behind
 * it: the boxes are drawn from the questions' own answers, not from a compiled product.
 */
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { GroupBoardComponent } from '@shared/groups/group-board.component';
import {
  composePlacements,
  guessMap,
  unmapped,
  valueGroups,
  type ListValue,
  type ValueMapping,
} from '@shared/groups/value-map';
import {
  FormPageComponent,
  SearchSelectComponent,
  WizardStepsComponent,
  type SearchSelectOption,
  type WizardStepItem,
  type WizardStepStatus,
} from '@shared/ui';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  CheckOutline,
  CloseOutline,
  DeleteOutline,
  EditOutline,
  ExclamationCircleOutline,
  LinkOutline,
  PlusOutline,
  UnorderedListOutline,
} from '@ant-design/icons-angular/icons';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  registryFacts,
  type IncomeBand,
  type MethodQuestion,
  type MethodTemplate,
  type StepFigures,
  type TemplateGroup,
  type TemplateMechanism,
  type TemplateMechanismKind,
} from '@features/bank-programs/bank-programs.types';
import { howLabel, methodFacts, type MethodFact, type MethodOption } from './method-facts';

type ColMode = 'answer' | 'groups';

/** The prefix a question with no fact yet is offered under. */
const UNBOUND = 'q:';

const SCALAR_KINDS: readonly TemplateMechanismKind[] = ['shareOf', 'multipleOf', 'dividedBy'];

const NUMBER_KINDS: readonly TemplateMechanismKind[] = [
  'numberBand',
  'shareOf',
  'multipleOf',
  'dividedBy',
];

@Component({
  selector: 'app-ready-method-edit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyInputDirective, 
    RouterLink,
    ReactiveFormsModule,
    NgTemplateOutlet,
    GroupBoardComponent,
    FormPageComponent,
    SearchSelectComponent,
    WizardStepsComponent,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzToolTipModule,
  ],
  providers: [
    provideNzIconsPatch([
      DeleteOutline,
      PlusOutline,
      CloseOutline,
      CheckOutline,
      EditOutline,
      UnorderedListOutline,
      LinkOutline,
      ExclamationCircleOutline,
    ]),
  ],
  template: `
    <app-form-page
      wide
      stepped
      [title]="pageTitle()"
      [subtitle]="pageLede"
      [backLabel]="backLabel"
      [cancelLabel]="cancelLabel"
      [showPrev]="isNew && stepIdx() > 0"
      [submitLabel]="primaryLabel()"
      [submitting]="saving()"
      [blockReason]="barBlock()"
      [hint]="barHint()"
      (cancelled)="leave()"
      (prev)="goToStep(stepIdx() - 1)"
      (submitted)="primary()"
    >
      @if (!isNew && !loading()) {
        <div formPageAside class="aside">
          <span class="src" [class.own]="source() !== 'seed'">
            @if (source() === 'seed') {
              <span i18n="@@rm.shipped">Shipped</span>
            } @else {
              <span i18n="@@rm.added">Added</span>
            }
          </span>
          <span nz-tooltip [nzTooltipTitle]="usedBy().length > 0 ? deleteBlocked() : null">
            <button
              nz-button
              nzType="default"
              nzDanger
              type="button"
              class="ibtn"
              [disabled]="usedBy().length > 0"
              (click)="confirmDelete()"
            >
              <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@rm.delete">Delete</span>
            </button>
          </span>
        </div>
      }

      @if (loading()) {
        <div class="stack" aria-busy="true">
          @for (n of [1, 2, 3]; track n) {
            <div class="card skel">
              <span class="bar w40"></span><span class="bar w70"></span
              ><span class="bar w55"></span>
            </div>
          }
        </div>
      } @else {
        <div class="stack">
          @if (usedBy().length > 0) {
            <div class="callout info" role="status">
              <span
                nz-icon
                nzType="link"
                nzTheme="outline"
                class="callout-i"
                aria-hidden="true"
              ></span>
              <div class="callout-b">
                <p i18n="@@rm.used_note3">
                  Saving changes the questions, how and groups of these products. Each keeps its own
                  amounts.
                </p>
                <ul class="chips" role="list">
                  @for (p of usedBy(); track p.key) {
                    <li>
                      <a
                        [routerLink]="['/program-catalog/products', p.key]"
                        [queryParams]="{ step: 3 }"
                        >{{ isAr ? p.labelAr : p.labelEn }}</a
                      >
                    </li>
                  }
                </ul>
              </div>
            </div>
          }

          <app-wizard-steps
            [steps]="steps()"
            [activeIndex]="stepIdx()"
            [ariaLabel]="stepsAria"
            (stepSelect)="goToStep($event)"
          />

          @switch (stepIdx()) {
            @case (0) {
              <section class="card" aria-labelledby="rm-s1">
                <header class="sec-h">
                  <div class="sec-t">
                    <h2 id="rm-s1" i18n="@@ps.called">What is it called?</h2>
                  </div>
                </header>
                <div class="grid2" [formGroup]="nameForm">
                  <label class="fl"
                    ><span class="fl-l" i18n="@@ps.name_en">Name in English</span
                    ><input nz-input formControlName="labelEn"
                  /></label>
                  <label class="fl"
                    ><span class="fl-l" i18n="@@ps.name_ar">Name in Arabic</span
                    ><input nz-input formControlName="labelAr" dir="rtl"
                  /></label>
                </div>
              </section>
            }
            @case (1) {
              <section class="card" aria-labelledby="rm-s2">
                <header class="sec-h">
                  <div class="sec-t">
                    <h2 id="rm-s2" i18n="@@rm.s2_title">Which question sets the loan amount?</h2>
                    <p class="lede" i18n="@@rm.s2_lede">
                      The loan amount depends on how the customer answers this question. After you
                      pick it, choose how each answer turns into an amount. Example: “Which club are
                      you a member of?” — Club A up to 300,000, Club B up to 200,000.
                    </p>
                  </div>
                </header>
                <div class="grid2">
                  <div class="fl">
                    <span class="fl-l" i18n="@@rm.q1">Question</span>
                    <app-search-select
                      [options]="askableOpts()"
                      [value]="fact()"
                      [ariaLabel]="q1Aria"
                      (changed)="pickQuestion('row', $event)"
                    />
                  </div>
                  <ng-container *ngTemplateOutlet="valuesFrom; context: { axis: 'row' }" />
                </div>

                @if (factOf(fact()); as f) {
                  <div class="how">
                    <span class="how-l" i18n="@@rm.how_set">How the amount is set</span>
                    <div class="how-row">
                      <div class="seg" role="radiogroup" [attr.aria-label]="howAria">
                        @for (k of kindsFor(f); track k) {
                          <button
                            type="button"
                            role="radio"
                            [attr.aria-checked]="kind() === k"
                            (click)="setKind(k)"
                          >
                            {{ howFor('row', k) }}
                          </button>
                        }
                      </div>
                      @if (kind() === 'classTable') {
                        <ng-container *ngTemplateOutlet="groupsToggle; context: { axis: 'row' }" />
                      }
                    </div>
                  </div>
                  @if (kind() === 'classTable' && editorOpen() === 'row') {
                    <ng-container *ngTemplateOutlet="groupsEd; context: { axis: 'row' }" />
                  }
                }
              </section>
            }
            @case (2) {
              @if (factOf(fact())) {
                <section class="card" aria-labelledby="rm-s3">
                  <header class="sec-h">
                    <div class="sec-t">
                      <h2 id="rm-s3" i18n="@@rm.s3_title">
                        Does the amount also depend on another question?
                      </h2>
                      <p class="lede" i18n="@@rm.s3_lede">
                        Use this when one row needs different amounts for different customers.
                        Example: Group A gets 60,000 for new customers and 70,000 for bank
                        customers. If each row has one amount, leave it as “No second question”.
                      </p>
                    </div>
                    <span class="opt" i18n="@@qedit.sec_optional">Optional</span>
                  </header>
                  <div class="grid2">
                    <div class="fl">
                      <span class="fl-l" i18n="@@rm.q2_label">Second question</span>
                      <app-search-select
                        [options]="columnOpts()"
                        [value]="colFact()"
                        [clearLabel]="noColumns"
                        [ariaLabel]="q2Aria"
                        (changed)="pickQuestion('col', $event)"
                      />
                    </div>
                    <ng-container *ngTemplateOutlet="valuesFrom; context: { axis: 'col' }" />
                  </div>

                  @if (factOf(colFact()); as c) {
                    @if (groupable(c)) {
                      <div class="how">
                        <span class="how-l" i18n="@@rm.cols_label"
                          >Columns in the amounts table</span
                        >
                        <div class="how-row">
                          <div class="seg" role="radiogroup" [attr.aria-label]="colAria">
                            <button
                              type="button"
                              role="radio"
                              [attr.aria-checked]="colMode() === 'answer'"
                              (click)="setColMode('answer')"
                            >
                              @if (mapOf('col')) {
                                <span i18n="@@rm.per_value_short">one per list value</span>
                              } @else {
                                <span i18n="@@ps.col_answer">one per answer</span>
                              }
                            </button>
                            <button
                              type="button"
                              role="radio"
                              [attr.aria-checked]="colMode() === 'groups'"
                              (click)="setColMode('groups')"
                              i18n="@@ps.col_groups"
                            >
                              one per group
                            </button>
                          </div>
                          @if (colMode() === 'groups') {
                            <ng-container
                              *ngTemplateOutlet="groupsToggle; context: { axis: 'col' }"
                            />
                          }
                        </div>
                      </div>
                      @if (colMode() === 'groups' && editorOpen() === 'col') {
                        <ng-container *ngTemplateOutlet="groupsEd; context: { axis: 'col' }" />
                      }
                    }
                  }
                </section>
              } @else {
                <ng-container *ngTemplateOutlet="needQuestion" />
              }
            }
            @case (3) {
              @if (factOf(fact()); as f) {
                <section class="card" aria-labelledby="rm-s4">
                  <header class="sec-h">
                    <div class="sec-t">
                      <h2 id="rm-s4" i18n="@@rm.s4_title">Default amounts</h2>
                      <p class="lede" i18n="@@rm.s4_lede">
                        A product that picks this method starts from these, then sets its own. A box
                        left empty is filled in by each bank.
                      </p>
                    </div>
                  </header>
                  @switch (shape()) {
                    @case ('table') {
                      <div class="sheet">
                        <table>
                          <thead>
                            <tr>
                              <th scope="col" class="corner">{{ f.label }}</th>
                              @for (c of cols(); track c.code) {
                                <th scope="col" class="n">{{ c.label }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (r of rows(); track r.code) {
                              <tr>
                                <th scope="row">{{ r.label }}</th>
                                @for (c of cols(); track c.code) {
                                  <td class="n">
                                    <input
                                      appMoneyInput
                                      class="amt"
                                      inputmode="decimal"
                                      [value]="cell(c.code, r.code)"
                                      (change)="setCell(c.code, r.code, val($event))"
                                      [placeholder]="bankSets"
                                      [attr.aria-label]="r.label + ' — ' + c.label"
                                    />
                                  </td>
                                }
                              </tr>
                            } @empty {
                              @if (kind() === 'classTable') {
                                <tr>
                                  <td
                                    class="empty"
                                    [attr.colspan]="cols().length + 1"
                                    i18n="@@rm.no_rows"
                                  >
                                    No groups yet. Add one in step 2: each group gets a row.
                                  </td>
                                </tr>
                              }
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                    @case ('ranges') {
                      <div class="sheet">
                        <table>
                          <thead>
                            <tr>
                              <th scope="col" class="corner">{{ f.label }}</th>
                              @for (c of cols(); track c.code) {
                                <th scope="col" class="n">{{ c.label }}</th>
                              }
                              <th scope="col" class="x-col">
                                <span class="sr-only">{{ removeAria }}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (b of ranges(); track $index; let k = $index) {
                              <tr>
                                <td>
                                  <div class="rng">
                                    <input
                                      appMoneyInput
                                      class="edge"
                                      inputmode="decimal"
                                      [value]="fmt(b.fromInclusive ?? '')"
                                      (change)="setEdge(k, 'fromInclusive', val($event))"
                                      [attr.aria-label]="fromAria"
                                    />
                                    <span class="rng-to" i18n="@@ps.to">to</span>
                                    <input
                                      appMoneyInput
                                      class="edge"
                                      inputmode="decimal"
                                      [value]="fmt(b.toExclusive ?? '')"
                                      (change)="setEdge(k, 'toExclusive', val($event))"
                                      [placeholder]="andUp"
                                      [attr.aria-label]="toAria"
                                    />
                                  </div>
                                </td>
                                @for (c of cols(); track c.code) {
                                  <td class="n">
                                    <input
                                      appMoneyInput
                                      class="amt"
                                      inputmode="decimal"
                                      [value]="bandAmount(c.code, k)"
                                      (change)="setBandAmount(c.code, k, val($event))"
                                      [placeholder]="bankSets"
                                      [attr.aria-label]="c.label"
                                    />
                                  </td>
                                }
                                <td class="x-col">
                                  <button
                                    nz-button
                                    nzType="text"
                                    nzShape="circle"
                                    type="button"
                                    class="rm"
                                    [attr.aria-label]="removeAria"
                                    (click)="removeRange(k)"
                                  >
                                    <span
                                      nz-icon
                                      nzType="close"
                                      nzTheme="outline"
                                      aria-hidden="true"
                                    ></span>
                                  </button>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      <button
                        nz-button
                        nzType="dashed"
                        type="button"
                        class="add"
                        (click)="addRange()"
                      >
                        <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                        <span i18n="@@rm.add_range">Add a range</span>
                      </button>
                    }
                    @case ('scalar') {
                      @if (cols().length > 1) {
                        <!-- One figure per column: the formula said once, a row per column. -->
                        <div class="sheet">
                          <table>
                            <thead>
                              <tr>
                                <th scope="col" class="corner">{{ factOf(colFact())?.label }}</th>
                                <th scope="col">
                                  <span class="fhead">
                                    {{ f.label }}
                                    <span class="op">{{ kind() === 'dividedBy' ? '÷' : '×' }}</span>
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (c of cols(); track c.code) {
                                <tr>
                                  <th scope="row">{{ c.label }}</th>
                                  <td>
                                    <ng-container
                                      *ngTemplateOutlet="scalarBox; context: { col: c }"
                                    />
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      } @else {
                        @for (c of cols(); track c.code) {
                          <div class="frow">
                            <span class="fq">{{ f.label }}</span>
                            <span class="op">{{ kind() === 'dividedBy' ? '÷' : '×' }}</span>
                            <ng-container *ngTemplateOutlet="scalarBox; context: { col: c }" />
                          </div>
                        }
                      }
                    }
                  }
                </section>
              } @else {
                <ng-container *ngTemplateOutlet="needQuestion" />
              }
            }
          }

          @if (error(); as e) {
            <p class="callout danger" role="alert">
              <span
                nz-icon
                nzType="exclamation-circle"
                nzTheme="outline"
                class="callout-i"
                aria-hidden="true"
              ></span>
              <span>{{ e }}</span>
            </p>
          }
        </div>
      }
    </app-form-page>

    <ng-template #valuesFrom let-axis="axis">
      @if (factOf(axisFact(axis)); as f) {
        @if (f.type === 'choice') {
          <div class="fl">
            <span class="fl-h">
              <span class="fl-l" i18n="@@rm.values_from">Values from</span>
              @if (!f.derived) {
                @if (axisList(axis); as t) {
                  <a
                    class="vlink"
                    [routerLink]="['/lookups']"
                    [queryParams]="{ type: t }"
                    i18n="@@rm.open_list"
                    >Open the list in Manage values</a
                  >
                }
              }
            </span>
            @if (f.derived) {
              <p class="vnote" i18n="@@rm.src_derived_note">Worked out by the platform: no list.</p>
            } @else {
              <app-search-select
                [options]="allListOpts(axis)"
                [value]="axisList(axis) ?? ''"
                [placeholder]="choosePh"
                [ariaLabel]="valuesFromAria"
                (changed)="setList(axis, $event)"
              />
              @if (mismatch(axis); as n) {
                <p class="callout warn sm" role="status">
                  <span
                    nz-icon
                    nzType="exclamation-circle"
                    nzTheme="outline"
                    class="callout-i"
                    aria-hidden="true"
                  ></span>
                  <span>{{ mismatchLabel(n) }}</span>
                </p>
              }
            }
          </div>
        }
      }
    </ng-template>

    <ng-template #needQuestion>
      <section class="card">
        <p class="callout sm" role="status">
          <span
            nz-icon
            nzType="exclamation-circle"
            nzTheme="outline"
            class="callout-i"
            aria-hidden="true"
          ></span>
          <span>
            <span i18n="@@rm.need_q">Pick the question that decides the amount.</span>
            <button type="button" class="link" (click)="goToStep(1)" i18n="@@rm.go_q">
              Go to Question
            </button>
          </span>
        </p>
      </section>
    </ng-template>

    <ng-template #scalarBox let-c="col">
      <span class="unit-box">
        <input
          appMoneyInput
          class="amt sm"
          inputmode="decimal"
          [value]="scalar(c.code)"
          (change)="setScalar(c.code, val($event))"
          [placeholder]="bankSets"
          [attr.aria-label]="c.label"
        />
        @if (kind() === 'shareOf') {
          <span class="unit">%</span>
        }
      </span>
    </ng-template>

    <ng-template #groupsToggle let-axis="axis">
      <button
        nz-button
        nzType="default"
        type="button"
        class="ibtn gbtn"
        [class.on]="editorOpen() === axis"
        [attr.aria-expanded]="editorOpen() === axis"
        (click)="toggleEditor(axis)"
      >
        @if (editorOpen() === axis) {
          <span nz-icon nzType="check" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@ps.groups_done">Done with groups</span>
        } @else {
          <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@ps.groups_edit">Edit groups</span>
        }
      </button>
    </ng-template>

    <ng-template #groupsEd let-axis="axis">
      <div class="groups">
        <p class="hint" i18n="@@rm.groups_own">
          These groups belong to this method, and are copied to every product that uses it.
        </p>
        <app-group-board
          [groups]="groupsOf(axis)"
          [answers]="axisOptions(axis)"
          [placements]="placementsOf(axis)"
          [minGroups]="0"
          [question]="mismatch(axis) > 0 ? null : (factOf(axisFact(axis))?.label ?? null)"
          [listType]="axisList(axis)"
          [isAr]="isAr"
          (renamed)="renameGroup(axis, $event.key, $event.labelEn, $event.labelAr)"
          (added)="addGroup(axis)"
          (removed)="removeGroup(axis, $event)"
          (placed)="place(axis, $event.code, $event.group)"
        />
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      /* Header aside: where it came from, and Delete. */
      .aside {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .src {
        padding: var(--space-0-5) var(--space-2-5);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }
      .src.own {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent-ink);
      }

      /* The page: a column of numbered cards. */
      .stack {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-inline-size: 0;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-inline-size: 0;
        padding: var(--space-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .sec-h {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
      }
      .sec-t {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5);
      }
      /* Card title = --text-lg (DESIGN_SYSTEM), one step above the 14px field labels. */
      h2 {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
        text-wrap: balance;
      }
      .lede,
      .hint {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        text-wrap: pretty;
      }
      .link {
        padding: 0;
        margin-inline-start: var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: none;
        color: var(--color-text-link);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .link:hover {
        color: var(--color-text-link-hover);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .opt {
        flex: none;
        margin-block-start: var(--space-1);
        padding: var(--space-0-5) var(--space-2-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
      }

      /* Fields */
      .grid2 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      .fl {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
        min-inline-size: 0;
      }
      .fl-h {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-1) var(--space-3);
      }
      .fl-l {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .vlink {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-link);
        text-decoration: none;
        border-radius: var(--radius-sm);
      }
      .vlink:hover {
        color: var(--color-text-link-hover);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .vnote {
        margin: 0;
        padding: var(--space-2-5) var(--space-3);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-field);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      /* Callouts: info (who it changes), warn (answers not in the list), danger (save error). */
      .callout {
        margin: 0;
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--callout-line, var(--color-border-default));
        border-radius: var(--radius-lg);
        background: var(--callout-bg, var(--color-surface-muted));
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        text-wrap: pretty;
      }
      /* Under a field: tighter box, same 14px text — a warning that matters stays readable. */
      .callout.sm {
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
      }
      .callout-i {
        flex: none;
        margin-block-start: var(--space-0-5);
        color: var(--callout-ink, var(--color-brand-primary));
      }
      .callout-b {
        min-inline-size: 0;
      }
      .callout-b p {
        margin: 0;
      }
      .callout.info {
        --callout-bg: var(--color-info-bg);
        --callout-line: color-mix(in srgb, var(--color-info) 30%, transparent);
        --callout-ink: var(--color-info);
      }
      .callout.warn {
        --callout-bg: var(--color-warning-bg);
        --callout-line: color-mix(in srgb, var(--color-warning) 35%, transparent);
        --callout-ink: var(--color-warning);
      }
      .callout.danger {
        --callout-bg: var(--color-error-bg);
        --callout-line: color-mix(in srgb, var(--color-error) 35%, transparent);
        --callout-ink: var(--color-error);
      }
      .chips {
        list-style: none;
        margin: var(--space-2) 0 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .chips a {
        display: inline-block;
        padding: var(--space-0-5) var(--space-2-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-link);
        font-weight: var(--font-weight-semibold);
        text-decoration: none;
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .chips a:hover {
        border-color: var(--color-brand-primary);
      }

      /* "How" row: a label over one segmented control (+ the groups button). */
      .how {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .how-l {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .how-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
      }
      /* Segmented: an inset track, the live option raised on it (same pair as app-rail-tabs). */
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        max-inline-size: 100%;
        padding: var(--space-1);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-page);
      }
      .seg button {
        padding: var(--space-1-5) var(--space-3);
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Shared labels come lower-case from the product page; on a control they start capital. */
      .seg button::first-letter {
        text-transform: uppercase;
      }
      .seg button:not([aria-checked='true']):active {
        background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
      }
      .seg button:not([aria-checked='true']):hover {
        background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
        color: var(--color-text-primary);
      }
      .seg button[aria-checked='true'] {
        border-color: color-mix(
          in srgb,
          var(--color-brand-primary) 55%,
          var(--color-border-strong)
        );
        background: var(--color-surface-default);
        color: var(--color-text-link);
        font-weight: var(--font-weight-semibold);
        box-shadow:
          var(--shadow-sm),
          0 1px 2px color-mix(in srgb, var(--color-brand-primary) 22%, transparent);
      }
      /* Icon + label buttons: a logical gap, so the icon keeps its space in RTL too. */
      .ibtn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
      }
      .ibtn > span + span {
        margin: 0;
      }
      /* Edit groups sits beside the segmented track: same surfaces, both themes. */
      .gbtn {
        /* As tall and as round as the track beside it, so the row reads as one control. */
        align-self: stretch;
        block-size: auto;
        padding-inline: var(--space-4);
        border-radius: var(--radius-lg);
        border-color: var(--color-border-default);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .gbtn:hover,
      .gbtn.on {
        border-color: var(--color-brand-primary);
        background: var(--color-surface-default);
        color: var(--color-text-link);
      }
      /* No frame of its own: the group board draws its panels, the card is the container. */
      .groups {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      /* The amounts sheet */
      .sheet {
        max-inline-size: 100%;
        overflow-x: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: var(--space-2) var(--space-3);
        text-align: start;
        vertical-align: middle;
        border-block-end: 1px solid var(--color-border-default);
        color: var(--color-text-primary);
      }
      tbody tr:last-child > * {
        border-block-end: 0;
      }
      tbody tr {
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      tbody tr:hover {
        background: var(--color-surface-row-hover);
      }
      thead th {
        background: var(--color-surface-muted);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
      }
      thead th.n {
        white-space: nowrap;
      }
      thead th.corner {
        min-inline-size: 12rem;
      }
      tbody th {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      td.n {
        min-inline-size: 9rem;
      }
      .x-col {
        inline-size: 1%;
        white-space: nowrap;
      }
      td.empty {
        padding: var(--space-4);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        text-align: center;
      }

      /* Number boxes: the field look of nz-input, in a table's size. */
      input:not([nz-input]) {
        box-sizing: border-box;
        max-inline-size: 100%;
        padding: var(--space-1-5) var(--space-2-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-regular);
        font-feature-settings: var(--font-feature-tabular);
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      input:not([nz-input]):hover {
        border-color: var(--color-border-strong);
      }
      input:not([nz-input]):focus {
        border-color: var(--color-border-focus);
      }
      .amt {
        inline-size: 100%;
        min-inline-size: 8rem;
      }
      .amt.sm {
        inline-size: 9rem;
        min-inline-size: 0;
      }
      .edge {
        inline-size: 8rem;
      }
      .amt::placeholder,
      .edge::placeholder {
        color: var(--color-text-tertiary);
      }
      .rng {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
      }
      .rng-to {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .rm {
        color: var(--color-text-secondary);
      }
      .rm:hover {
        color: var(--color-error);
      }
      .add {
        align-self: flex-start;
      }

      /* One figure: "question × [ 50 ] %" (a sheet when there are columns). */
      .fhead {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .frow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
      }
      .fq {
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .op {
        display: inline-grid;
        place-items: center;
        inline-size: var(--space-5);
        block-size: var(--space-5);
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-semibold);
      }
      .unit-box {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
      }
      .unit {
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-semibold);
      }

      /* Loading */
      .skel {
        gap: var(--space-3);
      }
      .bar {
        display: block;
        block-size: var(--space-3);
        border-radius: var(--radius-sm);
        background: var(--color-surface-muted);
      }
      .w40 {
        inline-size: 40%;
      }
      .w55 {
        inline-size: 55%;
      }
      .w70 {
        inline-size: 70%;
      }

      input:focus-visible,
      button:focus-visible,
      a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      @media (prefers-reduced-motion: reduce) {
        .seg button,
        .chips a,
        .gbtn,
        tbody tr,
        input:not([nz-input]) {
          transition: none;
        }
      }
      @media (max-width: 600px) {
        .card {
          padding: var(--space-4);
        }
        .seg {
          display: flex;
        }
        .seg button {
          flex: 1 1 auto;
          min-block-size: var(--size-field);
        }
        .gbtn {
          min-block-size: var(--size-field);
        }
        thead th.corner {
          min-inline-size: 8rem;
        }
        td.n {
          min-inline-size: 7rem;
        }
        .amt {
          min-inline-size: 6rem;
        }
      }
    `,
  ],
})
export class ReadyMethodEditPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly errors = inject(ErrorCodeService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupsApiService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  private readonly route = inject(ActivatedRoute);
  protected readonly key = this.route.snapshot.paramMap.get('key') ?? 'new';
  protected readonly isNew = this.key === 'new';

  protected readonly loading = signal(!this.isNew);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly nameForm = this.fb.nonNullable.group({ labelEn: '', labelAr: '' });
  private readonly nameRev = signal(0);

  protected readonly fact = signal('');
  protected readonly kind = signal<TemplateMechanismKind>('choiceTable');
  protected readonly colFact = signal('');
  protected readonly colMode = signal<ColMode>('answer');
  /** The column order a stored method was saved with — its first column keys as ''. */
  private readonly storedBranches = signal<string[] | null>(null);
  protected readonly figures = signal<Record<string, StepFigures>>({});
  /** The products linked to it — what a save changes. */
  protected readonly usedBy = signal<MethodTemplate['usedBy']>([]);
  protected usedByNames(): string {
    return this.usedBy()
      .map((p) => (this.isAr ? p.labelAr : p.labelEn))
      .join(', ');
  }

  /** The method's own groups: its rows (per group), its columns (one per group). */
  protected readonly rowGroups = signal<TemplateGroup[] | undefined>(undefined);
  protected readonly colGroups = signal<TemplateGroup[] | undefined>(undefined);
  /** Per question: answer code → group key. */
  private readonly placements = signal<Record<string, Record<string, string>>>({});
  /** Per question: answer code → list row id (what a product's groups are filed by). */
  private readonly valueIds = signal<Record<string, Record<string, string>>>({});
  /** Per question: the group each answer sits in on the shared list. */
  private readonly shared = signal<Record<string, Record<string, string>>>({});
  protected readonly editorOpen = signal<'row' | 'col' | null>(null);

  protected readonly bankSets = $localize`:@@ps.bank_sets:bank sets`;
  protected readonly andUp = $localize`:@@ps.and_up:and up`;
  protected readonly fromAria = $localize`:@@spt.v2.from_col:From`;
  protected readonly toAria = $localize`:@@spt.v2.to_col:Up to`;
  protected readonly removeAria = $localize`:@@ps.remove:Remove`;
  protected readonly howAria = $localize`:@@rm.how:How`;
  protected readonly colAria = $localize`:@@spt.v2.col_mode_aria:A column per answer or per group`;

  private readonly facts = computed(() =>
    methodFacts(registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr), this.isAr),
  );
  /** A worked-out answer can only split columns, never be the question itself. */
  protected readonly askable = computed(() => this.facts().filter((f) => !f.derived));
  protected readonly columnFacts = computed(() =>
    this.facts().filter((f) => f.type === 'choice' && f.key !== this.fact()),
  );
  /** Manage values list names, by key — what "Values: the … list" names. */
  private readonly listNames = signal<Record<string, string>>({});
  protected listName(type: string): string {
    return this.listNames()[type] ?? type;
  }

  /** Every number or one-choice question in the system (v37.0.0), bound or not. */
  private readonly questions = signal<MethodQuestion[]>([]);
  /** A question with no fact yet is offered by its code, prefixed; picking it binds one. */
  private questionOpts(type: 'NUMERIC' | 'SINGLE_SELECT' | null, skip: string) {
    const seen = new Set<string>();
    const out: SearchSelectOption[] = [];
    for (const f of type === 'SINGLE_SELECT' ? this.columnFacts() : this.askable()) {
      seen.add(f.key);
      out.push({ value: f.key, label: f.label });
    }
    for (const q of this.questions()) {
      if (q.type !== 'NUMERIC' && q.type !== 'SINGLE_SELECT') continue;
      if (type !== null && q.type !== type) continue;
      if (q.factKey !== null && (seen.has(q.factKey) || q.factKey === skip)) continue;
      out.push({
        value: q.factKey ?? UNBOUND + q.code,
        label: (this.isAr ? q.labelAr : q.labelEn).trim() || q.labelEn,
      });
    }
    return out;
  }
  protected readonly askableOpts = computed(() => this.questionOpts(null, ''));

  /**
   * The list each axis's answers are read from (v37.0.0): any Manage values list whose values
   * cover ALL of the question's answers. The picked one is saved on the method; unpicked, the
   * first that covers. Its values are the rows (per answer) or what is filed into groups.
   */
  private readonly rowListPick = signal<string | null>(null);
  private readonly colListPick = signal<string | null>(null);
  /** Manage values lists by key: their names and the class list each is filed under. */
  private readonly typeDefs = signal<
    Record<string, { name: string; parent: string | null; rail: boolean }>
  >({});

  /**
   * Per axis: answers read through a list that is NOT the question's own (v37.0.0) — each
   * answer mapped to one of its values. null = the question's own list, nothing to map.
   */
  protected readonly maps = signal<{ row: ValueMapping | null; col: ValueMapping | null }>({
    row: null,
    col: null,
  });
  private readonly listValues = signal<Record<string, ListValue[]>>({});

  protected mapOf(axis: 'row' | 'col'): ValueMapping | null {
    return this.maps()[axis];
  }

  private setMap(axis: 'row' | 'col', m: ValueMapping | null): void {
    this.maps.set({ ...this.maps(), [axis]: m });
  }

  protected valuesOf(type: string): ListValue[] {
    return this.listValues()[type] ?? [];
  }

  private async loadValues(type: string): Promise<ListValue[]> {
    const have = this.listValues()[type];
    if (have) return have;
    const rows = await this.lookups.list(type);
    const values = rows
      .filter((r) => r.active && r.deprecatedAt === null)
      .map((r) => ({ code: r.key, labelEn: r.labelEn, labelAr: r.labelAr }));
    this.listValues.set({ ...this.listValues(), [type]: values });
    return values;
  }

  /**
   * "Values from" (v37.0.0): a Manage values list — its values ARE the answers the customer
   * picks from, through the list's own question (found, or created and linked) — or a
   * number, or a question with its own answers, or what the platform works out.
   */
  private readonly srcPick = signal<{ row: string | null; col: string | null }>({
    row: null,
    col: null,
  });
  protected readonly creatingQuestion = signal(false);
  protected readonly choosePh = $localize`:@@ps.choose:Choose…`;
  protected readonly rowsFromAria = $localize`:@@rm.rows_from:Rows: values from`;
  protected readonly colsFromAria = $localize`:@@rm.cols_from:Columns (optional): values from`;
  protected readonly askedAria = $localize`:@@rm.asked_as:Asked as`;
  protected readonly noColumns = $localize`:@@rm.no_columns:No second question`;

  /** Every question a method can read, with where its values come from. */
  private readonly entries = computed(() => {
    const out: { value: string; label: string; kind: 'number' | 'choice' | 'derived'; lists: string[] }[] = [];
    const seen = new Set<string>();
    for (const f of this.facts()) {
      seen.add(f.key);
      out.push({
        value: f.key,
        label: f.label,
        kind: f.type === 'number' ? 'number' : f.derived ? 'derived' : 'choice',
        lists: this.listsOf(f.key),
      });
    }
    for (const q of this.questions()) {
      if (q.type !== 'NUMERIC' && q.type !== 'SINGLE_SELECT') continue;
      if (q.factKey !== null && seen.has(q.factKey)) continue;
      out.push({
        value: q.factKey ?? UNBOUND + q.code,
        label: (this.isAr ? q.labelAr : q.labelEn).trim() || q.labelEn,
        kind: q.type === 'NUMERIC' ? 'number' : 'choice',
        lists: q.listTypes ?? [],
      });
    }
    return out;
  });

  protected listKey(source: string): string | null {
    return source.startsWith('list:') ? source.slice(5) : null;
  }

  private sourceOfFact(axis: 'row' | 'col', value: string): string {
    const e = this.entries().find((x) => x.value === value);
    if (!e) return '';
    if (e.kind !== 'choice') return e.kind;
    const picked = axis === 'row' ? this.rowListPick() : this.colListPick();
    if (picked !== null && e.lists.includes(picked)) return `list:${picked}`;
    return e.lists[0] ? `list:${e.lists[0]}` : 'own';
  }

  protected srcOf(axis: 'row' | 'col'): string {
    return this.srcPick()[axis] ?? this.sourceOfFact(axis, this.axisFact(axis));
  }

  protected sourceOpts(axis: 'row' | 'col'): SearchSelectOption[] {
    const kinds = new Set(this.entries().map((e) => e.kind));
    const hasOwn = this.entries().some((e) => e.kind === 'choice' && e.lists.length === 0);
    const lists = Object.entries(this.typeDefs())
      .filter(([, d]) => d.rail)
      .map(([t, d]) => ({ value: `list:${t}`, label: d.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [
      ...lists,
      ...(axis === 'row' && kinds.has('number')
        ? [{ value: 'number', label: $localize`:@@rm.src_number:A number the customer types` }]
        : []),
      ...(hasOwn ? [{ value: 'own', label: $localize`:@@rm.src_own_opt:A question's own answers` }] : []),
      ...(axis === 'col' && kinds.has('derived')
        ? [{ value: 'derived', label: $localize`:@@rm.src_derived_opt:Worked out by the platform` }]
        : []),
    ];
  }

  /** The questions that ask for this source's values. */
  protected askedOpts(axis: 'row' | 'col'): SearchSelectOption[] {
    const src = this.srcOf(axis);
    const list = this.listKey(src);
    return this.entries()
      .filter((e) =>
        list !== null
          ? e.kind === 'choice' && e.lists.includes(list)
          : src === 'own'
            ? e.kind === 'choice' && e.lists.length === 0
            : e.kind === src,
      )
      .filter((e) => axis === 'row' || e.value !== this.fact())
      .filter((e) => axis === 'col' || e.kind !== 'derived')
      .map((e) => ({ value: e.value, label: e.label }));
  }

  /** A new source: its question is picked for the operator when there is only one. */
  protected async setSource(axis: 'row' | 'col', source: string): Promise<void> {
    if (axis === 'col' && source === '') {
      this.srcPick.set({ ...this.srcPick(), col: '' });
      this.setColumn('');
      return;
    }
    this.srcPick.set({ ...this.srcPick(), [axis]: source });
    const list = this.listKey(source);
    (axis === 'row' ? this.rowListPick : this.colListPick).set(list);
    const options = this.askedOpts(axis);
    if (options.some((o) => o.value === this.axisFact(axis))) return;
    if (axis === 'row') this.setFact('');
    else this.setColumn('');
    if (options.length === 1) {
      await this.pickQuestion(axis, options[0]!.value);
    } else if (options.length === 0 && list !== null) {
      // A list nothing asks yet: its own question is created, its answers the list's values.
      this.creatingQuestion.set(true);
      try {
        const made = (await this.api.ensureMethodListQuestion(list)).data;
        await this.enums.refresh('surrogate_fact');
        this.questions.set((await this.api.listMethodQuestions()).data);
        await this.pickQuestion(axis, made.factKey);
        this.srcPick.set({ ...this.srcPick(), [axis]: source });
      } catch (err) {
        const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
          ?.error;
        this.error.set(
          this.errors.toLocalizedMessage(
            (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
            envelope?.meta,
          ),
        );
      } finally {
        this.creatingQuestion.set(false);
      }
    }
  }

  /** One answer mapped to a list value ('' = unmapped). */
  protected setMapping(axis: 'row' | 'col', answer: string, value: string): void {
    const m = this.mapOf(axis);
    if (!m) return;
    const map = { ...m.map };
    if (value === '') delete map[answer];
    else map[answer] = value;
    this.setMap(axis, { ...m, map });
    if (axis === 'col') this.storedBranches.set(null);
  }

  /** The row "how" choices, named for a mapped list: per list value, or per group of them. */
  protected howFor(axis: 'row' | 'col', k: TemplateMechanismKind): string {
    if (this.mapOf(axis) && k === 'choiceTable') {
      return $localize`:@@rm.per_value:One amount per list value`;
    }
    return howLabel(k);
  }

  protected listsOf(fact: string): string[] {
    if (fact === '') return [];
    const q = this.questions().find((x) =>
      fact.startsWith(UNBOUND) ? x.code === fact.slice(UNBOUND.length) : x.factKey === fact,
    );
    return q?.listTypes ?? [];
  }

  /** The list an axis's values come from: the one picked (any list), else the one that fits. */
  protected axisList(axis: 'row' | 'col'): string | null {
    const pick = axis === 'row' ? this.rowListPick() : this.colListPick();
    if (pick !== null) return pick;
    return this.listsOf(this.axisFact(axis))[0] ?? null;
  }

  /** Every list in Manage values, the ones that fit the question's answers first. */
  protected allListOpts(axis: 'row' | 'col' = 'row'): SearchSelectOption[] {
    const own = new Set(this.listsOf(this.axisFact(axis)));
    return Object.entries(this.typeDefs())
      .filter(([t, d]) => d.rail || own.has(t))
      .map(([t, d]) => ({ value: t, label: d.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /** The values an axis's rows / columns / groups are made of: the list's, else the answers. */
  private axisValues(axis: 'row' | 'col'): MethodOption[] | null {
    const list = this.axisList(axis);
    const values = list !== null ? this.listValues()[list] : undefined;
    if (!values) return null;
    return values.map((v) => ({
      code: v.code,
      label: (this.isAr ? v.labelAr : v.labelEn) || v.labelEn || v.code,
    }));
  }

  /** How many of the question's answers the list does not have (0 = none missing). */
  protected mismatch(axis: 'row' | 'col'): number {
    const values = this.axisValues(axis);
    if (values === null) return 0;
    const have = new Set(values.map((v) => v.code));
    const answers = this.factOf(this.axisFact(axis))?.options ?? [];
    return answers.filter((a) => !have.has(a.code)).length;
  }

  protected mismatchLabel(n: number): string {
    return $localize`:@@rm.list_mismatch:${n}:N: of the question's answers are not in this list: customers who give them get no amount.`;
  }

  /** The list whose rows the ANSWERS are filed by: the chosen one, or under a mapping the question's own. */
  private listFor(fact: string): string | null {
    if (fact === this.fact()) return this.axisList('row');
    if (fact === this.colFact()) return this.axisList('col');
    return this.listsOf(fact)[0] ?? null;
  }

  /** The lists that hold every answer first, then every other list (its answers get mapped). */
  protected listOpts(axis: 'row' | 'col'): SearchSelectOption[] {
    const covering = this.listsOf(this.axisFact(axis));
    const others = Object.entries(this.typeDefs())
      .filter(([t, d]) => d.rail && !covering.includes(t))
      .map(([t, d]) => ({ value: t, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      ...covering.map((t) => ({ value: t, label: this.listName(t) })),
      ...others.map((o) => ({
        value: o.value,
        label: $localize`:@@rm.list_map_opt:${o.name}:LIST: — map the answers`,
      })),
    ];
  }

  /** Another list: its values are now the ones placed, so the groups start over from it. */
  protected async setList(axis: 'row' | 'col', type: string): Promise<void> {
    if (type === this.axisList(axis)) return;
    const fact = this.axisFact(axis);
    // What this list had (groups, who is in them, amounts), for when the operator comes back.
    this.remember();
    (axis === 'row' ? this.rowListPick : this.colListPick).set(type);
    await this.loadValues(type);
    this.setMap(axis, null);
    const drop = <T>(m: Record<string, T>): Record<string, T> => {
      const { [fact]: _gone, ...rest } = m;
      return rest;
    };
    // The list's row ids are read again for the new list.
    this.valueIds.set(drop(this.valueIds()));
    this.shared.set(drop(this.shared()));
    // A list tried before comes back as it was left.
    if (this.recall()) return;
    if (axis === 'col') this.storedBranches.set(null);
    this.placements.set(drop(this.placements()));
    const grouped = axis === 'row' ? this.kind() === 'classTable' : this.colMode() === 'groups';
    if (grouped) void this.seedGroups(axis);
  }
  protected readonly valuesFromAria = $localize`:@@rm.values_from:Values from`;
  protected readonly columnOpts = computed(() => this.questionOpts('SINGLE_SELECT', this.fact()));

  protected readonly binding = signal(false);

  /** A pick from the list: a question with no fact gets one first, then is read as usual. */
  protected async pickQuestion(axis: 'row' | 'col', value: string): Promise<void> {
    let key = value;
    if (value.startsWith(UNBOUND)) {
      this.binding.set(true);
      try {
        key = (await this.api.ensureMethodFact(value.slice(UNBOUND.length))).data.factKey;
        await this.enums.refresh('surrogate_fact');
        this.questions.set((await this.api.listMethodQuestions()).data);
      } catch (err) {
        const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
          ?.error;
        this.error.set(
          this.errors.toLocalizedMessage(
            (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
            envelope?.meta,
          ),
        );
        return;
      } finally {
        this.binding.set(false);
      }
    }
    if (axis === 'row') this.setFact(key);
    else this.setColumn(key);
  }
  protected readonly source = signal<MethodTemplate['source']>('operator');
  protected readonly pageTitle = computed(() => {
    this.nameRev();
    if (this.isNew) return $localize`:@@rm.new_title:New surrogate method`;
    const v = this.nameForm.controls;
    return (this.isAr ? v.labelAr.value : v.labelEn.value) || v.labelEn.value || this.key;
  });
  protected readonly pageLede = $localize`:@@rm.page_lede:Name it, pick the question that decides the amount, and set the default amounts a product starts from.`;
  protected readonly backLabel = $localize`:@@rm.back:All surrogate methods`;
  protected readonly cancelLabel = $localize`:@@rm.cancel:Cancel`;
  protected readonly saveLabel = $localize`:@@rm.save:Save method`;
  protected readonly q1Aria = $localize`:@@rm.axis_rows:Rows`;
  protected readonly q2Aria = $localize`:@@rm.q2_label:Second question`;
  protected readonly noSecond = $localize`:@@rm.q2_none:No`;
  protected usedHint(): string {
    const n = this.usedBy().length;
    return n === 1
      ? $localize`:@@rm.used_hint_one:Saving changes 1 product.`
      : $localize`:@@rm.used_hint:Saving changes ${n}:N: products.`;
  }
  protected deleteBlocked(): string {
    return $localize`:@@rm.delete_blocked:A product uses it. Pick another method on that product first.`;
  }
  protected leave(): void {
    void this.router.navigateByUrl('/surrogate-methods');
  }

  constructor() {
    effect(() => {
      for (const axis of ['row', 'col'] as const) {
        const list = this.axisList(axis);
        if (list !== null) void untracked(() => this.loadValues(list));
      }
    });
    this.nameForm.valueChanges.subscribe(() => this.nameRev.update((n) => n + 1));
    void this.enums.load('surrogate_fact');
    void this.api.listMethodQuestions().then((r) => this.questions.set(r.data));
    void this.lookups.listTypes().then((rows) => {
      this.listNames.set(
        Object.fromEntries(
          rows.map((r) => [
            r.type,
            (this.isAr ? r.definition?.labelAr : r.definition?.labelEn) ?? r.type,
          ]),
        ),
      );
      this.typeDefs.set(
        Object.fromEntries(
          rows.map((r) => [
            r.type,
            {
              name: (this.isAr ? r.definition?.labelAr : r.definition?.labelEn) ?? r.type,
              parent: r.definition?.parentTypeKey ?? null,
              rail: (r.definition?.onValuesRail ?? false) && (r.definition?.active ?? true),
            },
          ]),
        ),
      );
    });
    if (!this.isNew) void this.load();
    // Editing opens on the step a link names (?step=2); a new method always starts at the name.
    const asked = Number(this.route.snapshot.queryParamMap.get('step'));
    if (!this.isNew && Number.isInteger(asked) && asked >= 1 && asked <= this.lastStep + 1) {
      this.stepIdx.set(asked - 1);
    }
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected how(k: TemplateMechanismKind): string {
    return howLabel(k);
  }

  protected factOf(key: string): MethodFact | undefined {
    return key === '' ? undefined : this.facts().find((f) => f.key === key);
  }

  protected kindsFor(f: MethodFact): readonly TemplateMechanismKind[] {
    if (f.type === 'number') return NUMBER_KINDS;
    if (this.mapOf('row') && f.key === this.fact()) return ['choiceTable', 'classTable'];
    return this.groupable(f) ? ['choiceTable', 'classTable'] : ['choiceTable'];
  }

  /** Its answers come from a list long enough to group, or already grouped. */
  protected groupable(f: MethodFact): boolean {
    if (f.type !== 'choice' || f.derived) return false;
    const axis = f.key === this.colFact() ? 'col' : 'row';
    return this.axisList(axis) !== null && (this.axisValues(axis)?.length ?? f.options.length) >= 2;
  }

  protected toggleEditor(axis: 'row' | 'col'): void {
    if (this.editorOpen() === axis) {
      this.editorOpen.set(null);
      return;
    }
    if ((axis === 'row' ? this.rowGroups() : this.colGroups()) === undefined) {
      void this.seedGroups(axis, true);
      return;
    }
    this.editorOpen.set(axis);
  }

  protected axisFact(axis: 'row' | 'col'): string {
    return axis === 'row' ? this.fact() : this.colFact();
  }

  protected axisOptions(axis: 'row' | 'col'): readonly MethodOption[] {
    const fromList = this.axisValues(axis);
    if (fromList !== null && !this.mapOf(axis)) return fromList;
    const m = this.mapOf(axis);
    if (m) {
      const used = new Set(Object.values(m.map));
      return this.valuesOf(m.listType)
        .filter((v) => used.has(v.code))
        .map((v) => ({ code: v.code, label: (this.isAr ? v.labelAr : v.labelEn) || v.labelEn }));
    }
    return this.factOf(this.axisFact(axis))?.options ?? [];
  }

  protected groupsOf(axis: 'row' | 'col'): TemplateGroup[] {
    return (axis === 'row' ? this.rowGroups() : this.colGroups()) ?? [];
  }

  private setGroups(axis: 'row' | 'col', groups: TemplateGroup[]): void {
    if (axis === 'row') this.rowGroups.set(groups);
    else {
      this.colGroups.set(groups);
      this.storedBranches.set(null);
    }
  }

  protected groupLabel(g: TemplateGroup): string {
    return (this.isAr ? g.labelAr : g.labelEn).trim() || g.labelEn || g.labelAr;
  }

  /** The list's row ids and where each answer sits on the shared list, read once per question. */
  private async ensureList(fact: string): Promise<void> {
    const list = this.listFor(fact);
    if (list === null || this.valueIds()[fact] !== undefined) return;
    const rows = await this.lookups.list(list);
    this.valueIds.set({
      ...this.valueIds(),
      [fact]: Object.fromEntries(rows.map((r) => [r.key, r.id])),
    });
    this.shared.set({
      ...this.shared(),
      [fact]: Object.fromEntries(
        rows.filter((r) => r.parentKey).map((r) => [r.key, r.parentKey as string]),
      ),
    });
  }

  /**
   * Make the groups the method's own: a list that has groups is copied as it stands (same keys,
   * each answer where it sits today); any other list starts with none.
   */
  /**
   * Groups start EMPTY: the operator creates them in the method (v37.0.0). `fromClasses` only
   * for a stored method already priced by its list's classes, so its amounts keep their rows.
   */
  private async seedGroups(axis: 'row' | 'col', fromClasses = false): Promise<void> {
    const fact = this.axisFact(axis);
    const f = this.factOf(fact);
    if (!f) return;
    const mapped = this.mapOf(axis);
    if (mapped) {
      // Groups of the LIST VALUES: the list's own classes to start from, or none.
      const parent = this.typeDefs()[mapped.listType]?.parent ?? null;
      const valueGroups: Record<string, string> = {};
      let groups: TemplateGroup[] = [];
      if (parent !== null) {
        const used = new Set(Object.values(mapped.map));
        for (const r of await this.lookups.list(mapped.listType)) {
          if (r.parentKey && used.has(r.key)) valueGroups[r.key] = r.parentKey;
        }
        const keys = new Set(Object.values(valueGroups));
        groups = (await this.lookups.list(parent))
          .filter((r) => r.active && keys.has(r.key))
          .map((r) => ({ key: r.key, labelEn: r.labelEn, labelAr: r.labelAr }));
      }
      this.setMap(axis, { ...mapped, mappedAs: 'group', valueGroups });
      this.setGroups(axis, groups);
      this.editorOpen.set(axis);
      return;
    }
    await this.ensureList(fact);
    // The chosen list's own classes, in their order; a list with none starts with none.
    const list = this.listFor(fact);
    const parentType =
      fromClasses && list !== null ? (this.typeDefs()[list]?.parent ?? null) : null;
    const used = new Set(Object.values(this.shared()[fact] ?? {}));
    const groups: TemplateGroup[] =
      parentType === null
        ? []
        : (await this.lookups.list(parentType))
            .filter((r) => r.active && used.has(r.key))
            .map((r) => ({ key: r.key, labelEn: r.labelEn, labelAr: r.labelAr }));
    const keys = new Set(groups.map((g) => g.key));
    const now = this.shared()[fact] ?? {};
    this.placements.set({
      ...this.placements(),
      [fact]: Object.fromEntries(
        this.axisOptions(axis).flatMap((o) => {
          const at = now[o.code];
          return at !== undefined && keys.has(at) ? [[o.code, at]] : [];
        }),
      ),
    });
    this.setGroups(axis, groups);
    this.editorOpen.set(axis);
  }

  protected renameGroup(
    axis: 'row' | 'col',
    key: string,
    en: string | null,
    ar: string | null,
  ): void {
    this.setGroups(
      axis,
      this.groupsOf(axis).map((g) =>
        g.key === key ? { ...g, labelEn: en ?? g.labelEn, labelAr: ar ?? g.labelAr } : g,
      ),
    );
  }

  protected addGroup(axis: 'row' | 'col'): void {
    const groups = this.groupsOf(axis);
    const taken = new Set(groups.map((g) => g.key));
    let n = groups.length + 1;
    while (taken.has(`g${n}`)) n += 1;
    this.setGroups(axis, [
      ...groups,
      { key: `g${n}`, labelEn: `Group ${n}`, labelAr: `المجموعة ${n}` },
    ]);
  }

  protected removeGroup(axis: 'row' | 'col', key: string): void {
    const fact = this.axisFact(axis);
    this.setGroups(
      axis,
      this.groupsOf(axis).filter((g) => g.key !== key),
    );
    const mine = { ...(this.placements()[fact] ?? {}) };
    for (const [code, g] of Object.entries(mine)) if (g === key) delete mine[code];
    this.placements.set({ ...this.placements(), [fact]: mine });
    const next = { ...this.figures() };
    if (axis === 'row') {
      for (const [col, f] of Object.entries(next)) {
        if (f.keyTable) next[col] = { ...f, keyTable: f.keyTable.filter((r) => r.key !== key) };
      }
    } else {
      delete next[key];
    }
    this.figures.set(next);
  }

  protected placementsOf(axis: 'row' | 'col'): Record<string, string> {
    const m = this.mapOf(axis);
    if (m) return m.valueGroups ?? {};
    return this.placements()[this.axisFact(axis)] ?? {};
  }

  protected place(axis: 'row' | 'col', code: string, group: string): void {
    const m = this.mapOf(axis);
    if (m) {
      const valueGroups = { ...(m.valueGroups ?? {}) };
      if (group === '') delete valueGroups[code];
      else valueGroups[code] = group;
      this.setMap(axis, { ...m, valueGroups });
      return;
    }
    const fact = this.axisFact(axis);
    const mine = { ...(this.placements()[fact] ?? {}) };
    if (group === '') delete mine[code];
    else mine[code] = group;
    this.placements.set({ ...this.placements(), [fact]: mine });
  }

  /**
   * Every setup tried while the page is open, so switching back (per answer ↔ per group, one
   * way of working it out ↔ another, a second question on ↔ off) restores its amounts and
   * groups instead of starting empty.
   */
  private readonly tried = new Map<
    string,
    {
      figures: Record<string, StepFigures>;
      rowGroups: TemplateGroup[] | undefined;
      colGroups: TemplateGroup[] | undefined;
      storedBranches: string[] | null;
      placements: Record<string, Record<string, string>>;
    }
  >();

  private setupKey(): string {
    // The list each axis reads is part of the setup: going back to a list brings back its groups.
    return [
      this.fact(),
      this.kind(),
      this.colFact(),
      this.colMode(),
      this.axisList('row') ?? '',
      this.axisList('col') ?? '',
    ].join('|');
  }

  private remember(): void {
    this.tried.set(this.setupKey(), {
      figures: structuredClone(this.figures()),
      rowGroups: structuredClone(this.rowGroups()),
      colGroups: structuredClone(this.colGroups()),
      storedBranches: this.storedBranches() ? [...this.storedBranches()!] : null,
      placements: structuredClone(this.placements()),
    });
  }

  /** Bring back the setup now selected, if it was tried before. Says whether it did. */
  private recall(): boolean {
    const was = this.tried.get(this.setupKey());
    if (!was) return false;
    this.figures.set(structuredClone(was.figures));
    this.rowGroups.set(structuredClone(was.rowGroups));
    this.colGroups.set(structuredClone(was.colGroups));
    this.storedBranches.set(was.storedBranches ? [...was.storedBranches] : null);
    this.placements.set(structuredClone(was.placements));
    return true;
  }

  protected setFact(key: string): void {
    if (key !== this.fact()) {
      this.setMap('row', null);
      this.rowListPick.set(null);
    }
    if (key === this.fact()) return;
    this.remember();
    const before = this.factOf(this.fact());
    const was = this.figures();
    const wasKind = this.kind();
    this.fact.set(key);
    const f = this.factOf(key);
    // Same kind of answer, same way of working it out: the amounts carry over.
    const sameShape = before !== undefined && f !== undefined && before.type === f.type;
    this.kind.set(sameShape && wasKind !== 'classTable' ? wasKind : f?.type === 'number' ? 'numberBand' : 'choiceTable');
    if (this.colFact() === key) this.colFact.set('');
    this.editorOpen.set(null);
    if (this.recall()) return;
    if (this.colFact() === '') {
      this.storedBranches.set(null);
      this.colGroups.set(undefined);
    }
    this.rowGroups.set(undefined);
    this.figures.set(sameShape ? this.carried(was, f!) : {});
  }

  /**
   * What of the amounts survives a new question: ranges and single figures as they are, and a
   * per-answer table's rows for the answers the new question shares.
   */
  private carried(was: Record<string, StepFigures>, f: MethodFact): Record<string, StepFigures> {
    if (this.kind() !== 'choiceTable') return structuredClone(was);
    const codes = new Set(f.options.map((o) => o.code));
    const out: Record<string, StepFigures> = {};
    for (const [col, fig] of Object.entries(was)) {
      const rows = (fig.keyTable ?? []).filter((r) => codes.has(r.key));
      if (rows.length > 0) out[col] = { ...fig, keyTable: rows };
    }
    return out;
  }

  protected setKind(k: TemplateMechanismKind): void {
    if (k === this.kind()) return;
    this.remember();
    const wasScalar = SCALAR_KINDS.includes(this.kind());
    const was = this.figures();
    this.kind.set(k);
    if (this.recall()) {
      if (k !== 'classTable' && this.editorOpen() === 'row') this.editorOpen.set(null);
      return;
    }
    this.rowGroups.set(undefined);
    // One figure per column either way (% of it ↔ multiplied ↔ divided): it stays.
    this.figures.set(wasScalar && SCALAR_KINDS.includes(k) ? structuredClone(was) : {});
    if (k === 'classTable') void this.seedGroups('row');
    else this.editorOpen.set(null);
  }

  protected setColumn(key: string): void {
    if (key !== this.colFact()) {
      this.setMap('col', null);
      this.colListPick.set(null);
    }
    if (key === this.colFact()) return;
    this.remember();
    const first = this.firstColumn();
    this.colFact.set(key);
    this.colMode.set('answer');
    if (this.editorOpen() === 'col') this.editorOpen.set(null);
    if (this.recall()) return;
    this.storedBranches.set(null);
    this.colGroups.set(undefined);
    // The first column's amounts stay where they are; only the new columns start empty.
    this.figures.set(first ? { '': first } : {});
  }

  /** The amounts in the first column, wherever the stored order keeps them. */
  private firstColumn(): StepFigures | undefined {
    const f = this.figures();
    return f[''] ?? f[this.storedBranches()?.[0] ?? ''];
  }

  protected setColMode(mode: ColMode): void {
    if (mode === this.colMode()) return;
    this.remember();
    this.colMode.set(mode);
    if (this.recall()) {
      if (mode !== 'groups' && this.editorOpen() === 'col') this.editorOpen.set(null);
      return;
    }
    this.storedBranches.set(null);
    this.colGroups.set(undefined);
    this.figures.set({});
    if (mode === 'groups') void this.seedGroups('col');
    else if (this.editorOpen() === 'col') this.editorOpen.set(null);
  }

  protected readonly shape = computed<'table' | 'ranges' | 'scalar'>(() => {
    const k = this.kind();
    if (k === 'numberBand') return 'ranges';
    if (k === 'choiceTable' || k === 'classTable') return 'table';
    return 'scalar';
  });

  /** One column per answer (or group) of the second question; the first keys as ''. */
  protected readonly cols = computed<MethodOption[]>(() => {
    const c = this.factOf(this.colFact());
    const amount =
      this.kind() === 'shareOf'
        ? $localize`:@@rm.col_value:Value`
        : $localize`:@@rm.col_amount:Amount`;
    if (!c) return [{ code: '', label: amount }];
    const own = this.colMode() === 'groups' ? this.colGroups() : undefined;
    const vm = this.maps().col;
    const list = vm && this.colMode() !== 'groups'
      ? valueGroups(this.valuesOf(vm.listType), vm).map((g) => ({
          code: g.key,
          label: this.groupLabel(g),
        }))
      : own
      ? own.map((g) => ({ code: g.key, label: this.groupLabel(g) }))
      : this.colMode() === 'groups'
        ? c.groups
        : (this.axisValues('col') ?? c.options);
    return this.branches().map((code, i) => ({
      code: i === 0 ? '' : code,
      label: list.find((o) => o.code === code)?.label ?? code,
    }));
  });

  private branches(): string[] {
    const m = this.maps().col;
    if (m && this.colMode() !== 'groups') {
      return (
        this.storedBranches() ?? valueGroups(this.valuesOf(m.listType), m).map((g) => g.key)
      );
    }
    const own = this.colMode() === 'groups' ? this.colGroups() : undefined;
    if (own) return own.map((g) => g.key);
    const stored = this.storedBranches();
    if (stored) return stored;
    const c = this.factOf(this.colFact());
    if (!c) return [];
    if (this.colMode() !== 'groups') {
      const fromList = this.axisValues('col');
      if (fromList !== null) return fromList.map((o) => o.code);
    }
    return (this.colMode() === 'groups' ? c.groups : c.options).map((o) => o.code);
  }

  protected readonly rows = computed<readonly MethodOption[]>(() => {
    const f = this.factOf(this.fact());
    if (!f) return [];
    const m = this.maps().row;
    if (m && this.kind() !== 'classTable') {
      return valueGroups(this.valuesOf(m.listType), m).map((g) => ({
        code: g.key,
        label: this.groupLabel(g),
      }));
    }
    if (this.kind() !== 'classTable' && f.type === 'choice') {
      const fromList = this.axisValues('row');
      if (fromList !== null) return fromList;
    }
    if (this.kind() === 'classTable') {
      const own = this.rowGroups();
      return own ? own.map((g) => ({ code: g.key, label: this.groupLabel(g) })) : f.groups;
    }
    return f.options;
  });

  // --- figures -----------------------------------------------------------------

  private update(col: string, change: (f: StepFigures) => StepFigures): void {
    this.figures.set({ ...this.figures(), [col]: change({ ...(this.figures()[col] ?? {}) }) });
  }

  protected fmt(raw: string): string {
    return /^\d+(\.\d+)?$/.test(raw)
      ? Number(raw).toLocaleString('en-US', { maximumFractionDigits: 4 })
      : raw;
  }

  private clean(raw: string): string {
    return raw.replace(/,/g, '').trim();
  }

  protected cell(col: string, row: string): string {
    return this.fmt(this.figures()[col]?.keyTable?.find((r) => r.key === row)?.incomeEGP ?? '');
  }

  protected setCell(col: string, row: string, raw: string): void {
    const value = this.clean(raw);
    this.update(col, (f) => {
      const rows = (f.keyTable ?? []).filter((r) => r.key !== row);
      if (value !== '') rows.push({ key: row, incomeEGP: value });
      return { ...f, keyTable: rows };
    });
  }

  /** The ranges, read off the first column; every column shares them. */
  protected ranges(): readonly IncomeBand[] {
    const first = this.figures()['']?.bands ?? [];
    return first.length > 0 ? first : [{ fromInclusive: '0', toExclusive: null, incomeEGP: '' }];
  }

  private eachColumn(change: (bands: IncomeBand[], col: string) => IncomeBand[]): void {
    const edges = this.ranges();
    const next = { ...this.figures() };
    for (const { code } of this.cols()) {
      const own = next[code]?.bands ?? [];
      const aligned = edges.map((e, k) => ({
        fromInclusive: e.fromInclusive,
        toExclusive: e.toExclusive,
        incomeEGP: own[k]?.incomeEGP ?? '',
      }));
      next[code] = { ...(next[code] ?? {}), bands: change(aligned, code) };
    }
    this.figures.set(next);
  }

  protected setEdge(k: number, edge: 'fromInclusive' | 'toExclusive', raw: string): void {
    const value = this.clean(raw);
    this.eachColumn((bands) =>
      bands.map((b, i) =>
        i === k ? { ...b, [edge]: edge === 'toExclusive' && value === '' ? null : value } : b,
      ),
    );
  }

  protected bandAmount(col: string, k: number): string {
    return this.fmt(this.figures()[col]?.bands?.[k]?.incomeEGP ?? '');
  }

  protected setBandAmount(col: string, k: number, raw: string): void {
    const value = this.clean(raw);
    this.eachColumn((bands, c) =>
      c === col ? bands.map((b, i) => (i === k ? { ...b, incomeEGP: value } : b)) : bands,
    );
  }

  protected addRange(): void {
    const last = this.ranges().at(-1);
    const start = last?.toExclusive ?? '';
    this.eachColumn((bands) => [
      ...bands,
      { fromInclusive: start, toExclusive: null, incomeEGP: '' },
    ]);
  }

  protected removeRange(k: number): void {
    this.eachColumn((bands) => bands.filter((_, i) => i !== k));
  }

  protected scalar(col: string): string {
    return this.fmt(this.figures()[col]?.scalar?.value ?? '');
  }

  protected setScalar(col: string, raw: string): void {
    const value = this.clean(raw);
    const unit = this.kind() === 'shareOf' ? 'percent' : 'multiplier';
    this.update(col, (f) => {
      const next = { ...f };
      if (value === '') delete next.scalar;
      else next.scalar = { value, unit };
      return next;
    });
  }

  // --- save ----------------------------------------------------------------------

  /**
   * Every reason the method cannot be saved yet, each with the step it belongs to (0 name,
   * 1 question, 2 second question), in the order they are checked. The first one is `block()`
   * — what Save refuses on; the stepper reads the rest to say which step needs attention.
   */
  private readonly blocks = computed<Array<{ step: number; reason: string }>>(() => {
    this.nameRev();
    const out: Array<{ step: number; reason: string }> = [];
    const v = this.nameForm.getRawValue();
    if (v.labelEn.trim() === '' || v.labelAr.trim() === '') {
      out.push({
        step: 0,
        reason: $localize`:@@rm.need_names:Give the method a name in English and Arabic.`,
      });
    }
    if (this.fact() === '') {
      out.push({
        step: 1,
        reason: $localize`:@@rm.need_q:Pick the question that decides the amount.`,
      });
    }
    if (this.kind() === 'classTable' && (this.rowGroups()?.length ?? 1) === 0) {
      out.push({ step: 1, reason: $localize`:@@ps.block_no_group:Add at least one group.` });
    }
    for (const axis of ['row', 'col'] as const) {
      const m = this.maps()[axis];
      if (!m) continue;
      const step = axis === 'row' ? 1 : 2;
      const answers = this.factOf(this.axisFact(axis))?.options ?? [];
      if (unmapped(answers, m).length > 0) {
        out.push({ step, reason: $localize`:@@rm.need_map:Map every answer to a list value.` });
        continue;
      }
      const grouped = axis === 'row' ? this.kind() === 'classTable' : this.colMode() === 'groups';
      if (grouped && Object.values(m.map).some((v) => !m.valueGroups?.[v])) {
        out.push({
          step,
          reason: $localize`:@@rm.need_value_groups:Put every list value in use into a group.`,
        });
      }
    }
    if (this.colFact() !== '' && this.branches().length < 2) {
      out.push({
        step: 2,
        reason: $localize`:@@rm.need_cols:The second question needs at least two answers.`,
      });
    }
    return out;
  });

  protected readonly block = computed<string | null>(() => this.blocks()[0]?.reason ?? null);

  // --- stepper -------------------------------------------------------------------

  /** The step on stage: 0 name, 1 question, 2 second question, 3 default amounts. */
  protected readonly stepIdx = signal(0);
  /** The furthest step a NEW method has reached — what the rail marks done. */
  private readonly furthest = signal(0);
  protected readonly lastStep = 3;
  private readonly stepLabels = [
    $localize`:@@rm.step_name:Name`,
    $localize`:@@rm.q1:Question`,
    $localize`:@@rm.q2_label:Second question`,
    $localize`:@@rm.s4_title:Default amounts`,
  ];
  protected readonly stepsAria = $localize`:@@rm.steps_aria:Setting up this method`;
  private readonly nextLabel = $localize`:@@pcn.next:Next`;

  /**
   * New: in order — a step opens once every step before it passes. Edit: any step, any time.
   * A step with a reason to fix says "Needs attention" (on a new method, once reached).
   */
  protected readonly steps = computed<WizardStepItem[]>(() => {
    const blocked = new Set(this.blocks().map((b) => b.step));
    const first = this.blocks()[0]?.step ?? -1;
    return this.stepLabels.map((label, i) => {
      const reached = !this.isNew || i <= this.furthest();
      const status: WizardStepStatus = blocked.has(i)
        ? reached
          ? 'invalid'
          : 'todo'
        : reached
          ? 'done'
          : 'todo';
      return {
        id: String(i),
        label,
        status,
        disabled: this.isNew && first !== -1 && i > first,
        // Step 3 "Second question" may be left as "No second question".
        optional: i === 2,
      };
    });
  });

  protected goToStep(i: number): void {
    if (i < 0 || i > this.lastStep) return;
    this.stepIdx.set(i);
    if (i > this.furthest()) this.furthest.set(i);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: i + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** New method, before the last step: the bar's button moves on. Otherwise it saves. */
  protected readonly moving = computed(() => this.isNew && this.stepIdx() < this.lastStep);

  protected readonly primaryLabel = computed(() =>
    this.moving() ? this.nextLabel : this.saveLabel,
  );

  protected primary(): void {
    if (this.moving()) {
      this.goToStep(this.stepIdx() + 1);
      return;
    }
    this.save();
  }

  /** Moving: why THIS step cannot be left. Saving: why the method cannot be saved. */
  protected readonly barBlock = computed<string | null>(() => {
    if (this.loading()) return null;
    if (this.moving()) {
      return this.blocks().find((b) => b.step === this.stepIdx())?.reason ?? null;
    }
    return this.block();
  });

  protected barHint(): string | null {
    if (this.moving()) {
      const label = this.stepLabels[this.stepIdx() + 1] ?? '';
      return $localize`:@@pcn.next_hint:Next: ${label}:STEP:`;
    }
    return this.usedBy().length > 0 ? this.usedHint() : null;
  }

  private mechanism(): TemplateMechanism {
    const base = this.plainMechanism();
    const rm = this.maps().row;
    const cm = this.maps().col;
    if (!rm && !cm) return base;
    const out = structuredClone(base) as TemplateMechanism & Record<string, unknown>;
    // Under a mapping the rows are classes: one per list value (or per group of values), the
    // answers filed in them as the product's own groups — what the engine already reads.
    if (rm && out.kind !== 'flatAmount') {
      const perGroup = this.kind() === 'classTable';
      Object.assign(out, {
        kind: 'classTable',
        groups: perGroup ? (this.rowGroups() ?? []) : valueGroups(this.valuesOf(rm.listType), rm),
        listType: rm.listType,
        valueMap: rm.map,
        mappedAs: perGroup ? 'group' : 'value',
        ...(perGroup ? { valueGroups: rm.valueGroups ?? {} } : {}),
      });
      if (!perGroup) delete out['valueGroups'];
    }
    if (cm && out.column) {
      const perGroup = this.colMode() === 'groups';
      out.column = {
        ...out.column,
        branchOn: 'parentClass',
        groups: perGroup ? (this.colGroups() ?? []) : valueGroups(this.valuesOf(cm.listType), cm),
        listType: cm.listType,
        valueMap: cm.map,
        mappedAs: perGroup ? 'group' : 'value',
        ...(perGroup ? { valueGroups: cm.valueGroups ?? {} } : {}),
      };
    }
    return out;
  }

  private plainMechanism(): TemplateMechanism {
    const branches = this.branches();
    const own = this.rowGroups();
    const cols = this.colMode() === 'groups' ? this.colGroups() : undefined;
    return {
      kind: this.kind(),
      fact: this.fact(),
      ...(this.kind() === 'classTable' && own ? { groups: own } : {}),
      ...this.listField('row'),
      ...(this.colFact() !== ''
        ? {
            column: {
              fact: this.colFact(),
              branches,
              ...(this.colMode() === 'groups' ? { branchOn: 'parentClass' as const } : {}),
              ...(cols ? { groups: cols } : {}),
              ...this.listField('col'),
            },
          }
        : {}),
    } as TemplateMechanism;
  }

  /** Who sits in which of the method's own groups — by list row id, so products can file them. */
  private async placementsBody(): Promise<
    Record<string, Array<{ valueId: string; code: string; group: string }>>
  > {
    const out: Record<string, Array<{ valueId: string; code: string; group: string }>> = {};
    const grouped: string[] = [];
    if (this.kind() === 'classTable' && this.rowGroups() && !this.mapOf('row')) {
      grouped.push(this.fact());
    }
    if (this.colMode() === 'groups' && this.colGroups() && !this.mapOf('col')) {
      grouped.push(this.colFact());
    }
    // Under a mapping, each answer is filed in its list value's group (or the value itself).
    for (const axis of ['row', 'col'] as const) {
      const m = this.mapOf(axis);
      const fact = this.axisFact(axis);
      if (!m || fact === '') continue;
      await this.ensureList(fact);
      const ids = this.valueIds()[fact] ?? {};
      const grouped2 = axis === 'row' ? this.kind() === 'classTable' : this.colMode() === 'groups';
      const placed = composePlacements({ ...m, mappedAs: grouped2 ? 'group' : 'value' });
      out[fact] = Object.entries(placed)
        .filter(([code]) => ids[code] !== undefined)
        .map(([code, group]) => ({ valueId: ids[code]!, code, group }));
    }
    for (const fact of grouped) {
      await this.ensureList(fact);
      const ids = this.valueIds()[fact] ?? {};
      const placed = this.placements()[fact] ?? {};
      out[fact] = Object.entries(placed)
        .filter(([code]) => ids[code] !== undefined)
        .map(([code, group]) => ({ valueId: ids[code]!, code, group }));
    }
    return out;
  }

  /** The list an axis is read from, when the operator chose one other than the default. */
  private listField(axis: 'row' | 'col'): { listType?: string } {
    const picked = axis === 'row' ? this.rowListPick() : this.colListPick();
    return picked !== null ? { listType: picked } : {};
  }

  /** Blank rows out, and only the columns the method has. */
  private cleanFigures(): Record<string, StepFigures> {
    const keep = new Set(this.cols().map((c) => c.code));
    const out: Record<string, StepFigures> = {};
    for (const [col, f] of Object.entries(this.figures())) {
      if (!keep.has(col)) continue;
      const copy: StepFigures = { ...f };
      if (copy.keyTable) {
        copy.keyTable = copy.keyTable.filter((r) => String(r.incomeEGP ?? '').trim() !== '');
        if (copy.keyTable.length === 0) delete copy.keyTable;
      }
      if (copy.bands) {
        copy.bands = copy.bands.filter((b) => String(b.incomeEGP ?? '').trim() !== '');
        if (copy.bands.length === 0) delete copy.bands;
      }
      if (Object.keys(copy).length > 0) out[col] = copy;
    }
    return out;
  }

  /** A method products use asks first, naming them: the save changes their amounts. */
  protected save(): void {
    if (this.block() !== null || this.saving()) return;
    if (this.isNew || this.usedBy().length === 0) {
      void this.doSave();
      return;
    }
    const names = this.usedByNames();
    this.modal.confirm({
      nzTitle: $localize`:@@rm.confirm_title:Change it on every product that uses it?`,
      nzContent: $localize`:@@rm.confirm_body2:These products get the change from the next quote: ${names}:NAMES:. They keep their own amounts; only new boxes take your default amounts. Offers already issued keep their own figures.`,
      nzOkText: $localize`:@@rm.save:Save method`,
      nzOnOk: () => this.doSave(),
    });
  }

  private async doSave(): Promise<void> {
    if (this.block() !== null || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const v = this.nameForm.getRawValue();
    const body = {
      labelEn: v.labelEn.trim(),
      labelAr: v.labelAr.trim(),
      mechanism: this.mechanism(),
      figures: this.cleanFigures(),
      placements: await this.placementsBody(),
    };
    try {
      if (this.isNew) {
        await this.api.createMethodTemplate(body);
        this.message.success($localize`:@@rm.saved:Method saved.`);
      } else {
        const res = await this.api.updateMethodTemplate(this.key, body);
        const { updated, refused } = res.data.propagation;
        if (refused.length > 0) {
          const names = refused.map((r) => r.key).join(', ');
          this.error.set(
            $localize`:@@rm.refused:Saved, but these products could not take the change and kept their old copy: ${names}:NAMES:.`,
          );
          return;
        }
        const n = updated.length;
        this.message.success(
          n > 0
            ? $localize`:@@rm.saved_n:Method saved and ${n}:N: product(s) updated.`
            : $localize`:@@rm.saved:Method saved.`,
        );
      }
      void this.router.navigate(['/surrogate-methods']);
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.error.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDelete(): void {
    const name = this.nameForm.controls.labelEn.value;
    this.modal.confirm({
      nzTitle: $localize`:@@rm.delete_title:Delete “${name}:NAME:”?`,
      nzContent: $localize`:@@rm.delete_body:It leaves the list. Products that already use it keep their own copy.`,
      nzOkText: $localize`:@@rm.delete:Delete`,
      nzOkDanger: true,
      nzOnOk: async () => {
        await this.api.deleteMethodTemplate(this.key);
        this.message.success($localize`:@@rm.deleted:Method deleted.`);
        void this.router.navigate(['/surrogate-methods']);
      },
    });
  }

  private async load(): Promise<void> {
    try {
      const list = (await this.api.listMethodTemplates()).data;
      const m: MethodTemplate | undefined = list.find((x) => x.key === this.key);
      if (!m) {
        this.error.set(this.errors.toLocalizedMessage('METHOD_TEMPLATE_NOT_FOUND' as ErrorCode));
        return;
      }
      this.nameForm.reset({ labelEn: m.labelEn, labelAr: m.labelAr });
      this.usedBy.set(m.usedBy ?? []);
      this.source.set(m.source);
      const mech = m.mechanism;
      if (mech.kind !== 'flatAmount') this.fact.set(mech.fact);
      this.rowListPick.set(mech.kind !== 'flatAmount' ? (mech.listType ?? null) : null);
      this.colListPick.set(mech.column?.listType ?? null);
      this.kind.set(mech.kind);
      if (mech.kind === 'classTable' && mech.groups) this.rowGroups.set(mech.groups);
      if (mech.column?.groups) this.colGroups.set(mech.column.groups);
      const placed: Record<string, Record<string, string>> = {};
      for (const [fact, list] of Object.entries(m.placements ?? {})) {
        placed[fact] = Object.fromEntries(list.map((p) => [p.code, p.group]));
      }
      this.placements.set(placed);
      this.colFact.set(mech.column?.fact ?? '');
      this.colMode.set(mech.column?.branchOn === 'parentClass' ? 'groups' : 'answer');
      this.storedBranches.set(mech.column ? [...mech.column.branches] : null);
      // Answers read through another list: the mapping comes back as it was saved.
      const maps: { row: ValueMapping | null; col: ValueMapping | null } = { row: null, col: null };
      if (mech.kind !== 'flatAmount' && mech.valueMap && mech.listType) {
        await this.loadValues(mech.listType);
        maps.row = {
          listType: mech.listType,
          map: { ...mech.valueMap },
          mappedAs: mech.mappedAs ?? 'value',
          ...(mech.valueGroups ? { valueGroups: { ...mech.valueGroups } } : {}),
        };
        if (mech.mappedAs !== 'group') {
          this.kind.set('choiceTable');
          this.rowGroups.set(undefined);
        }
      }
      const col = mech.column;
      if (col?.valueMap && col.listType) {
        await this.loadValues(col.listType);
        maps.col = {
          listType: col.listType,
          map: { ...col.valueMap },
          mappedAs: col.mappedAs ?? 'value',
          ...(col.valueGroups ? { valueGroups: { ...col.valueGroups } } : {}),
        };
        if (col.mappedAs !== 'group') {
          this.colMode.set('answer');
          this.colGroups.set(undefined);
        }
      }
      this.maps.set(maps);
      this.figures.set(structuredClone(m.figures ?? {}));
    } finally {
      this.loading.set(false);
    }
  }
}
