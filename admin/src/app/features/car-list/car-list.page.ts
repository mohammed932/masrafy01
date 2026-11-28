import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  LOCALE_ID,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerRef, NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormDrawerComponent, PageHeaderComponent, openFormDrawer } from '@shared/ui';
import { LookupsApiService, type EnumerationRow } from '../lookups/lookups.api.service';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';

/**
 * The car list (v36.4.0, levels v36.6.0): a chain of linked lists — country → brand → model
 * → as many more levels as the operator adds (trim, engine, …).
 *
 * The chain is DATA: each level is a list filed under the one before it (`parentTypeKey`),
 * found by walking from `car_country`. Each list IS the answers of its question, so a value
 * added here is an answer the customer can pick, and the app shows only the answers filed
 * under the one picked a level up. A bank prices any level on its program's Cases.
 */
const ROOT_LEVEL = 'car_category';

interface Level {
  key: string;
  labelEn: string;
  labelAr: string;
  /** Has its question yet — made once the level holds two values (a choice needs two). */
  asked: boolean;
}

interface SheetData {
  /** The level a value is added to / renamed in; absent when adding a level. */
  level: string;
  mode: 'add' | 'rename' | 'paste' | 'level';
  row?: EnumerationRow;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

@Component({
  selector: 'app-car-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzSpinModule,
    NzSelectModule,
    PageHeaderComponent,
    FormDrawerComponent,
  ],
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      @if (loading()) {
        <div class="cl__loading"><nz-spin nzSimple /></div>
      } @else {
        <!-- Where the columns are, as one line: it stays readable when they scroll sideways. -->
        @if (path().length > 0) {
          <ol class="cl-path" [attr.aria-label]="pathAria">
            @for (step of path(); track step.level; let first = $first) {
              <li>
                @if (!first) {
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M6 3.5 10.5 8 6 12.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                }
                <button type="button" (click)="reveal(step.index + 1)">{{ step.name }}</button>
              </li>
            }
          </ol>
        }

        <!-- ONE panel, a column per level: a value opens what is filed under it. -->
        <div class="cl" #panel [style.--cl-n]="columns().length">
          @for (col of columns(); track col.level) {
            <section
              class="cl__col"
              [attr.data-index]="col.index"
              [attr.aria-labelledby]="'cl-h-' + col.level"
            >
              <header class="cl__head">
                <div class="cl__titles">
                  <h2 class="cl__title" [id]="'cl-h-' + col.level">{{ col.title }}</h2>
                  @if (col.context) {
                    <p class="cl__ctx">{{ col.context }}</p>
                  }
                </div>
                @if (!col.parentMissing) {
                  <span class="cl__count">{{ col.total }}</span>
                }
              </header>

              @if (!col.parentMissing) {
                <div class="cl__search">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <circle
                      cx="7"
                      cy="7"
                      r="4.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M10.5 10.5 14 14"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <input
                    type="search"
                    class="cl__search-input"
                    [attr.aria-label]="col.searchText"
                    [placeholder]="col.searchText"
                    [value]="query()[col.level] ?? ''"
                    (input)="setQuery(col.level, $any($event.target).value)"
                  />
                </div>
              }

              @if (!col.asked) {
                <p class="cl__unasked">{{ unaskedText }}</p>
              }

              <div class="cl__body">
                @if (col.parentMissing) {
                  <p class="cl__empty">{{ pickFirstText }}</p>
                } @else if (col.total === 0) {
                  <p class="cl__empty">{{ emptyText }}</p>
                } @else if (col.rows.length === 0) {
                  <p class="cl__empty">{{ noMatchText }}</p>
                } @else {
                  <ul class="cl__list" role="list">
                    @for (row of col.rows; track row.id) {
                      <li
                        class="cl__row"
                        [class.on]="!col.leaf && row.key === selectedKey(col.level)"
                      >
                        @if (col.leaf) {
                          <span class="cl__pick cl__pick--static">
                            <span class="cl__label">{{ primary(row) }}</span>
                            @if (secondary(row) !== primary(row)) {
                              <span class="cl__sub" [attr.lang]="isAr ? 'en' : 'ar'">{{
                                secondary(row)
                              }}</span>
                            }
                          </span>
                        } @else {
                          <button
                            type="button"
                            class="cl__pick"
                            [attr.aria-current]="row.key === selectedKey(col.level) ? 'true' : null"
                            (click)="select(col.index, row.key)"
                          >
                            <span class="cl__label">{{ primary(row) }}</span>
                            @if (secondary(row) !== primary(row)) {
                              <span class="cl__sub" [attr.lang]="isAr ? 'en' : 'ar'">{{
                                secondary(row)
                              }}</span>
                            }
                            <span class="cl__kids">{{ childCount(col.index, row.key) }}</span>
                            <svg class="cl__chev" viewBox="0 0 16 16" aria-hidden="true">
                              <path
                                d="M6 3.5 10.5 8 6 12.5"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                        }
                        <span class="cl__acts">
                          <button
                            type="button"
                            class="cl__act"
                            [attr.aria-label]="renameAria(row)"
                            [title]="renameText"
                            (click)="openSheet(col.level, 'rename', row)"
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path
                                d="M10.8 2.7a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.5l1-3.1z"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.4"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                          <!-- The first level is the car origin answers bank tables key on. -->
                          @if (col.index > 0) {
                            <button
                              type="button"
                              class="cl__act"
                              [attr.aria-label]="removeAria(row)"
                              [title]="removeText"
                              (click)="confirmRemove(col.index, row)"
                            >
                              <svg viewBox="0 0 16 16" aria-hidden="true">
                                <path
                                  d="M4 4l8 8M12 4l-8 8"
                                  stroke="currentColor"
                                  stroke-width="1.6"
                                  stroke-linecap="round"
                                />
                              </svg>
                            </button>
                          }
                        </span>
                      </li>
                    }
                  </ul>
                }
              </div>

              @if (col.canAdd) {
                <footer class="cl__foot">
                  <button type="button" class="cl__add" (click)="openSheet(col.level, 'add')">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M8 3.5v9M3.5 8h9"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                    </svg>
                    <span>{{ addText }}</span>
                  </button>
                  <button type="button" class="cl__link" (click)="openSheet(col.level, 'paste')">
                    {{ pasteText }}
                  </button>
                </footer>
              }
            </section>
          }

          <!-- The chain grows: one more level under the last (trim, engine, …). -->
          <div class="cl__more">
            <button type="button" class="cl__more-btn" (click)="openSheet('', 'level')">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3.5v9M3.5 8h9"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              <span>{{ addLevelText }}</span>
            </button>
            <p class="cl__more-note">{{ addLevelNote() }}</p>
          </div>
        </div>
      }
    </section>

    <ng-template #sheetTpl>
      @if (sheet(); as data) {
        <app-form-drawer
          [title]="sheetTitle(data)"
          [subtitle]="sheetSub(data)"
          [submitLabel]="data.mode === 'rename' ? saveText : addSubmitText"
          [submitDisabled]="!sheetValid(data)"
          [submitting]="saving()"
          (cancelled)="closeSheet()"
          (submitted)="submitSheet(data)"
        >
          <div class="cl-form">
            <!-- Where it is filed: any value one level up, the current pick to start with. -->
            @if (data.mode !== 'level' && parentChoices(data).length > 0) {
              <div class="cl-field">
                <label class="cl-field__label" for="clParent">{{ parentLabel(data) }}</label>
                <nz-select
                  nzId="clParent"
                  class="cl__parent"
                  nzShowSearch
                  [nzPlaceHolder]="parentPlaceholder"
                  [formControl]="parentCtl"
                >
                  @for (o of parentChoices(data); track o.key) {
                    <nz-option [nzValue]="o.key" [nzLabel]="o.label" />
                  }
                </nz-select>
                <p class="cl-field__hint">{{ parentHint }}</p>
              </div>
            }
            @if (data.mode === 'paste') {
              <div class="cl-field">
                <label class="cl-field__label" for="clPaste">{{ pasteLabel }}</label>
                <textarea
                  nz-input
                  id="clPaste"
                  rows="10"
                  [formControl]="pasteCtl"
                  [placeholder]="pastePlaceholder"
                ></textarea>
                <p class="cl-field__hint">{{ pasteHint }} {{ pasteCountText() }}</p>
              </div>
            } @else {
              <div class="cl-field">
                <label class="cl-field__label" for="clNameEn">{{ nameEnLabel }}</label>
                <input nz-input id="clNameEn" [formControl]="nameEn" />
                @if (data.mode === 'level') {
                  <p class="cl-field__hint">{{ levelHint }}</p>
                }
              </div>
              <div class="cl-field">
                <label class="cl-field__label" for="clNameAr">
                  {{ nameArLabel }}
                  <span class="cl-field__opt">{{ optionalText }}</span>
                </label>
                <input nz-input id="clNameAr" dir="rtl" lang="ar" [formControl]="nameAr" />
                <p class="cl-field__hint">{{ nameArHint }}</p>
              </div>
            }
          </div>
        </app-form-drawer>
      }
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .cl__loading {
        display: grid;
        place-items: center;
        padding: var(--space-8);
      }

      /* One surface split into three equal columns, all the same height, each scrolling on
         its own — a column that stops short read as a list with nothing more in it. */
      .cl {
        /* A level column keeps one width however many levels there are: a new level adds a
           column, it never squeezes the ones already there. */
        --cl-col: 22rem;
        display: grid;
        /* A column per level, as many as the chain holds, then the "Add a level" column. Too
           many to fit and the panel scrolls sideways inside itself; the page never does. */
        grid-template-columns: repeat(var(--cl-n), var(--cl-col)) minmax(12rem, 1fr);
        block-size: clamp(26rem, calc(100dvh - 15rem), 42rem);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-strong) transparent;
      }
      .cl__col {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
        min-block-size: 0;
      }
      .cl__col + .cl__col {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .cl-path {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1);
        margin: 0 0 var(--space-3);
        padding: 0;
        list-style: none;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
      }
      .cl-path li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .cl-path svg {
        inline-size: 0.75rem;
        block-size: 0.75rem;
      }
      :host-context([dir='rtl']) .cl-path svg {
        transform: scaleX(-1);
      }
      .cl-path button {
        border: 0;
        background: none;
        padding: var(--space-0-5) var(--space-1);
        border-radius: var(--radius-sm);
        color: var(--color-text-secondary);
        font: inherit;
        cursor: pointer;
      }
      .cl-path button:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-row-hover);
      }
      .cl-path button:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .cl-path li:last-child button {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-semibold);
      }
      .cl__titles {
        flex: 1 1 auto;
        min-inline-size: 0;
        /* Room for the "Under …" line in every column, so the search boxes line up. */
        min-block-size: calc(var(--text-base) * 1.5 + var(--text-xs) * 1.5 + var(--space-0-5));
      }
      .cl__ctx {
        margin: var(--space-0-5) 0 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        overflow-wrap: anywhere;
      }
      .cl__more {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-5) var(--space-4);
        border-inline-start: 1px solid var(--color-border-default);
        background: var(--color-surface-elevated);
      }
      .cl__more-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px dashed var(--color-border-strong);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-tonal-accent-ink);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
      }
      .cl__more-btn svg {
        inline-size: 0.875rem;
        block-size: 0.875rem;
      }
      .cl__more-btn:hover {
        border-color: var(--color-brand-primary);
        background: var(--color-surface-default);
      }
      .cl__more-btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .cl__more-note {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      .cl__head {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-4) var(--space-3);
      }
      .cl__title {
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        overflow-wrap: anywhere;
      }
      .cl__count {
        flex: none;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
      }

      .cl__unasked {
        margin: 0 var(--space-4) var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .cl__search {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 var(--space-4) var(--space-2);
        padding-inline: var(--space-3);
        block-size: 2.25rem;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
        color: var(--color-text-tertiary);
      }
      .cl__search:focus-within {
        border-color: var(--color-border-focus);
      }
      .cl__search svg {
        flex: none;
        inline-size: 0.875rem;
        block-size: 0.875rem;
      }
      .cl__search-input {
        flex: 1 1 auto;
        min-inline-size: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .cl__search-input::placeholder {
        color: var(--color-text-tertiary);
      }

      .cl__body {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        padding: 0 var(--space-2) var(--space-2);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border-strong) transparent;
      }
      .cl__empty {
        margin: 0;
        padding: var(--space-6) var(--space-3);
        text-align: center;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .cl__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .cl__row {
        display: flex;
        align-items: center;
        border-radius: var(--radius-md);
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .cl__row:hover {
        background: var(--color-surface-row-hover);
      }
      /* Selected: a tinted row, not an outline — an outline reads as a focused input. */
      .cl__row.on {
        background: var(--color-tonal-accent-bg);
      }
      .cl__row.on .cl__label {
        color: var(--color-tonal-accent-ink);
        font-weight: var(--font-weight-semibold);
      }
      .cl__pick {
        flex: 1 1 auto;
        min-inline-size: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        grid-template-areas:
          'label kids chev'
          'sub kids chev';
        align-items: center;
        column-gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
        border-radius: var(--radius-md);
      }
      .cl__pick--static {
        cursor: default;
      }
      .cl__label {
        grid-area: label;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        overflow-wrap: anywhere;
      }
      .cl__sub {
        grid-area: sub;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .cl__kids {
        grid-area: kids;
        min-inline-size: 1.5rem;
        text-align: end;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }
      .cl__chev {
        grid-area: chev;
        inline-size: 0.875rem;
        block-size: 0.875rem;
        color: var(--color-text-tertiary);
      }
      :host-context([dir='rtl']) .cl__chev {
        transform: scaleX(-1);
      }
      .cl__acts {
        display: flex;
        gap: 2px;
        padding-inline-end: var(--space-1);
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .cl__row:hover .cl__acts,
      .cl__row:focus-within .cl__acts {
        opacity: 1;
      }
      @media (hover: none) {
        .cl__acts {
          opacity: 1;
        }
      }
      .cl__act {
        display: inline-grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .cl__act svg {
        inline-size: 0.875rem;
        block-size: 0.875rem;
      }
      .cl__act:hover {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }

      .cl__foot {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .cl__add {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
      }
      .cl__add svg {
        inline-size: 0.875rem;
        block-size: 0.875rem;
        color: var(--color-brand-primary);
      }
      .cl__add:hover {
        border-color: var(--color-border-strong);
        background: var(--color-surface-row-hover);
      }
      .cl__link {
        border: 0;
        background: none;
        padding: 0;
        color: var(--color-tonal-accent-ink);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
        text-underline-offset: 3px;
      }
      .cl__link:hover {
        text-decoration: underline;
      }
      .cl__pick:focus-visible,
      .cl__act:focus-visible,
      .cl__add:focus-visible,
      .cl__link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* The side sheet's fields: label, control, hint — and a clear gap between fields. */
      .cl-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }
      .cl-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .cl-field__label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .cl-field__opt {
        margin-inline-start: var(--space-1);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
      }
      .cl-field__hint {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      .cl__parent {
        inline-size: 100%;
      }
      .cl__note {
        margin: var(--space-2) 0 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      /* Narrow: the columns stack, each a short scrolling list of its own. */
      @media (max-width: 960px) {
        .cl {
          grid-template-columns: minmax(0, 1fr);
          block-size: auto;
          overflow-x: hidden;
        }
        .cl__col + .cl__col {
          border-inline-start: 0;
          border-block-start: 1px solid var(--color-border-default);
        }
        .cl__body {
          max-block-size: 18rem;
        }
        .cl__more {
          border-inline-start: 0;
          border-block-start: 1px solid var(--color-border-default);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cl__row,
        .cl__acts {
          transition: none;
        }
      }
    `,
  ],
})
export class CarListPage {
  private readonly api = inject(LookupsApiService);
  private readonly programs = inject(BankProgramsApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  private readonly sheetTpl = viewChild.required<TemplateRef<unknown>>('sheetTpl');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  protected readonly pathAria = $localize`:@@cars.path_aria:Where you are in the list`;

  /** The picks, root first — the path line above the panel. */
  protected readonly path = computed(() => {
    const chain = this.levels();
    return chain.slice(0, -1).flatMap((level, index) => {
      const key = this.selectedKey(level.key);
      return key === null ? [] : [{ level: level.key, index, name: this.labelOf(level.key, key) }];
    });
  });

  /** Bring a column into view (after a pick, the column it opens; after a new level, it). */
  protected reveal(index: number): void {
    setTimeout(() => {
      const col = this.panel()?.nativeElement.querySelector<HTMLElement>(
        `.cl__col[data-index="${index}"]`,
      );
      col?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }
  private sheetRef: NzDrawerRef | null = null;

  protected readonly titleText = $localize`:@@cars.title:Car list`;
  protected readonly subtitleText = $localize`:@@cars.subtitle_levels:The car's details, each level filed under the one before it: country, brand, model and any level you add. The app shows only what is filed under the customer's pick, and a bank prices any of them on its program's Cases.`;
  protected readonly pasteText = $localize`:@@cars.paste:Paste a list`;
  protected readonly renameText = $localize`:@@cars.rename:Rename`;
  protected readonly removeText = $localize`:@@cars.remove:Remove`;
  protected readonly saveText = $localize`:@@cars.save:Save`;
  protected readonly addSubmitText = $localize`:@@cars.add_submit:Add`;
  protected readonly addText = $localize`:@@cars.add:Add`;
  protected readonly addLevelText = $localize`:@@cars.add_level:Add a level`;
  protected readonly nameEnLabel = $localize`:@@cars.name_en:Name in English`;
  protected readonly nameArLabel = $localize`:@@cars.name_ar:Name in Arabic`;
  protected readonly nameArHint = $localize`:@@cars.name_ar_hint:Leave it blank to use the English name.`;
  protected readonly levelHint = $localize`:@@cars.level_hint:What the level holds, e.g. Trim. Customers are asked it once it holds two values.`;
  protected readonly optionalText = $localize`:@@cars.optional:Optional`;
  protected readonly pasteLabel = $localize`:@@cars.paste_label:One per line`;
  protected readonly pasteHint = $localize`:@@cars.paste_hint:Add the Arabic name after a bar if you have it. Names already in the list are skipped.`;
  protected readonly pastePlaceholder = $localize`:@@cars.paste_placeholder_generic:Corolla\nYaris\nRAV4`;
  protected readonly pickFirstText = $localize`:@@cars.pick_first:Pick one on the left to see what is filed under it.`;
  protected readonly emptyText = $localize`:@@cars.empty:Nothing here yet. Add the first one.`;
  protected readonly noMatchText = $localize`:@@cars.no_match:Nothing matches that search.`;
  protected readonly unaskedText = $localize`:@@cars.unasked:Customers are asked this once it holds two values.`;

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** What the open side sheet is doing; read by its template. */
  protected readonly sheet = signal<SheetData | null>(null);

  /** The chain, root first. */
  private readonly levels = signal<Level[]>([]);
  private readonly rows = signal<Record<string, EnumerationRow[]>>({});
  /** The value picked in each level but the last. */
  private readonly selected = signal<Record<string, string | null>>({});
  protected readonly query = signal<Record<string, string>>({});

  protected readonly nameEn = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly nameAr = new FormControl('', { nonNullable: true });
  protected readonly pasteCtl = new FormControl('', { nonNullable: true });
  /** The value one level up the item is filed under (the sheet's "Filed under"). */
  protected readonly parentCtl = new FormControl<string | null>(null);
  private readonly parentValue = signal<string | null>(null);
  protected readonly parentHint = $localize`:@@cars.parent_hint:Customers see it only after picking this one.`;
  protected readonly parentPlaceholder = $localize`:@@cars.parent_pick:Pick one`;
  private readonly pasteValue = signal('');
  private readonly nameValue = signal('');

  constructor() {
    this.pasteCtl.valueChanges.subscribe((v) => this.pasteValue.set(v));
    this.parentCtl.valueChanges.subscribe((v) => this.parentValue.set(v));
    this.nameEn.valueChanges.subscribe((v) => this.nameValue.set(v));
    void this.load();
  }

  // --- reading --------------------------------------------------------------------

  private sorted(list: EnumerationRow[]): EnumerationRow[] {
    return list
      .filter((r) => r.active)
      .sort(
        (a, b) =>
          (a as { sortOrder?: number }).sortOrder! - (b as { sortOrder?: number }).sortOrder! ||
          a.labelEn.localeCompare(b.labelEn),
      );
  }

  private async load(): Promise<void> {
    try {
      // The chain: from the root, each level the list filed under the one before it.
      const types = await this.api.listTypes();
      const chain: Level[] = [];
      let at: string | null = ROOT_LEVEL;
      while (at !== null && !chain.some((l) => l.key === at)) {
        const def = types.find((t) => t.type === at)?.definition;
        if (!def) break;
        chain.push({
          key: def.key,
          labelEn: def.labelEn,
          labelAr: def.labelAr,
          asked: def.mirrorQuestionId !== null,
        });
        const parent: string = def.key;
        at =
          types.find((t) => t.type.startsWith('car_') && t.definition?.parentTypeKey === parent)
            ?.type ?? null;
      }
      const lists = await Promise.all(chain.map((l) => this.api.list(l.key)));
      const rows: Record<string, EnumerationRow[]> = {};
      chain.forEach((l, i) => (rows[l.key] = this.sorted(lists[i] ?? [])));
      this.levels.set(chain);
      this.rows.set(rows);
      // Keep each pick while it still exists; otherwise the first value under the pick above.
      const picked: Record<string, string | null> = {};
      for (let i = 0; i < chain.length - 1; i++) {
        const level = chain[i]!.key;
        const options = this.optionsAt(i, picked, rows);
        const was = this.selected()[level] ?? null;
        picked[level] = options.some((r) => r.key === was) ? was : (options[0]?.key ?? null);
      }
      this.selected.set(picked);
    } finally {
      this.loading.set(false);
    }
  }

  /** The values of level `i` filed under the pick one level up (all of them at the root). */
  private optionsAt(
    i: number,
    picked: Record<string, string | null> = this.selected(),
    rows: Record<string, EnumerationRow[]> = this.rows(),
  ): EnumerationRow[] {
    const level = this.levels()[i]?.key ?? Object.keys(rows)[i];
    if (level === undefined) return [];
    const all = rows[level] ?? [];
    if (i === 0) return all;
    const parentLevel = this.levels()[i - 1]?.key ?? Object.keys(rows)[i - 1];
    const parent = parentLevel === undefined ? null : (picked[parentLevel] ?? null);
    return parent === null ? [] : all.filter((r) => r.parentKey === parent);
  }

  protected primary(row: EnumerationRow): string {
    return (this.isAr ? row.labelAr : row.labelEn) || row.labelEn;
  }

  protected secondary(row: EnumerationRow): string {
    return (this.isAr ? row.labelEn : row.labelAr) || row.labelEn;
  }

  private levelName(level: Level | undefined): string {
    if (!level) return '';
    return (this.isAr ? level.labelAr : level.labelEn) || level.labelEn;
  }

  private labelOf(level: string, key: string | null): string {
    const row = (this.rows()[level] ?? []).find((r) => r.key === key);
    return row ? this.primary(row) : '';
  }

  protected selectedKey(level: string): string | null {
    return this.selected()[level] ?? null;
  }

  protected childCount(index: number, key: string): number {
    const child = this.levels()[index + 1];
    if (!child) return 0;
    return (this.rows()[child.key] ?? []).filter((r) => r.parentKey === key).length;
  }

  /** Pick a value; every level below re-opens on its first value. */
  protected select(index: number, key: string): void {
    const chain = this.levels();
    const picked = { ...this.selected(), [chain[index]!.key]: key };
    for (let i = index + 1; i < chain.length - 1; i++) {
      picked[chain[i]!.key] = this.optionsAt(i, picked)[0]?.key ?? null;
    }
    this.selected.set(picked);
    this.reveal(index + 1);
  }

  /** Open the path down to `parentKey` (one level above `level`), so what was saved is seen. */
  private showUnder(level: string, parentKey: string): void {
    const i = this.indexOf(level) - 1;
    if (i < 0) return;
    // Walk up from the parent to the root, then pick top-down.
    const keys: string[] = [parentKey];
    for (let k = i; k > 0; k--) {
      const row = (this.rows()[this.levels()[k]!.key] ?? []).find((r) => r.key === keys[0]);
      if (!row?.parentKey) break;
      keys.unshift(row.parentKey);
    }
    keys.forEach((key, n) => this.select(i - keys.length + 1 + n, key));
  }

  protected setQuery(level: string, text: string): void {
    this.query.update((q) => ({ ...q, [level]: text }));
  }

  private searched(level: string, rows: EnumerationRow[]): EnumerationRow[] {
    const q = (this.query()[level] ?? '').trim().toLowerCase();
    if (q === '') return rows;
    return rows.filter(
      (r) => r.labelEn.toLowerCase().includes(q) || r.labelAr.toLowerCase().includes(q),
    );
  }

  protected readonly columns = computed(() => {
    const chain = this.levels();
    return chain.map((level, i) => {
      const parentLevel = chain[i - 1];
      const parentKey = parentLevel ? this.selectedKey(parentLevel.key) : null;
      const all = this.optionsAt(i);
      const parentName = parentLevel ? this.labelOf(parentLevel.key, parentKey) : '';
      return {
        level: level.key,
        index: i,
        leaf: i === chain.length - 1,
        title: this.levelName(level),
        context: parentName ? $localize`:@@cars.under:Under ${parentName}:NAME:` : '',
        rows: this.searched(level.key, all),
        total: all.length,
        parentMissing: i > 0 && parentKey === null,
        searchText: $localize`:@@cars.search:Search`,
        canAdd: i === 0 || (this.rows()[chain[i - 1]!.key] ?? []).length > 0,
        asked: level.asked,
      };
    });
  });

  protected readonly addLevelNote = computed(() => {
    const last = this.levels()[this.levels().length - 1];
    const name = this.levelName(last);
    return $localize`:@@cars.add_level_note:Filed under ${name}:NAME:, e.g. a trim under each model.`;
  });

  protected renameAria(row: EnumerationRow): string {
    return $localize`:@@cars.rename_aria:Rename ${this.primary(row)}:NAME:`;
  }

  protected removeAria(row: EnumerationRow): string {
    return $localize`:@@cars.remove_aria:Remove ${this.primary(row)}:NAME:`;
  }

  // --- the side sheet ----------------------------------------------------------------

  private indexOf(level: string): number {
    return this.levels().findIndex((l) => l.key === level);
  }

  private parentOf(level: string): string | null {
    const i = this.indexOf(level);
    const parent = this.levels()[i - 1];
    return parent ? this.selectedKey(parent.key) : null;
  }

  /**
   * Every value one level up, each with what IT is filed under, so two "Sport" trims of two
   * models read apart: "C 200 · Mercedes-Benz".
   */
  protected parentChoices(data: SheetData): Array<{ key: string; label: string }> {
    const i = this.indexOf(data.level);
    const parentLevel = this.levels()[i - 1];
    if (!parentLevel) return [];
    const grand = this.levels()[i - 2];
    return (this.rows()[parentLevel.key] ?? []).map((r) => {
      const up = grand ? this.labelOf(grand.key, r.parentKey) : '';
      return { key: r.key, label: up ? `${this.primary(r)} · ${up}` : this.primary(r) };
    });
  }

  protected parentLabel(data: SheetData): string {
    const parentLevel = this.levels()[this.indexOf(data.level) - 1];
    const name = this.levelName(parentLevel);
    return $localize`:@@cars.parent_label:Filed under (${name}:LEVEL:)`;
  }

  protected sheetTitle(data: SheetData): string {
    if (data.mode === 'level') return this.addLevelText;
    const what = this.levelName(this.levels()[this.indexOf(data.level)]);
    if (data.mode === 'rename') return $localize`:@@cars.sheet_rename:Rename the ${what}:WHAT:`;
    if (data.mode === 'paste') return $localize`:@@cars.sheet_paste:Paste ${what}:WHAT: names`;
    return $localize`:@@cars.sheet_add:Add a ${what}:WHAT:`;
  }

  protected sheetSub(data: SheetData): string | null {
    if (data.mode === 'level') return this.addLevelNote();
    return null;
  }

  private parsePaste(): Array<{ labelEn: string; labelAr: string }> {
    return this.pasteValue()
      .split(/\r?\n/)
      .map((line) => line.split('|').map((x) => x.trim()))
      .filter(([en]) => en !== undefined && en !== '')
      .map(([en, ar]) => ({ labelEn: en!, labelAr: ar !== undefined && ar !== '' ? ar : en! }));
  }

  protected readonly pasteCountText = computed(() => {
    const n = this.parsePaste().length;
    return $localize`:@@cars.paste_count:${n}:N: to add`;
  });

  protected sheetValid(data: SheetData): boolean {
    if (data.mode !== 'level' && this.indexOf(data.level) > 0 && this.parentValue() === null) {
      return false;
    }
    if (data.mode === 'paste') return this.parsePaste().length > 0;
    return this.nameValue().trim() !== '';
  }

  protected openSheet(level: string, mode: SheetData['mode'], row?: EnumerationRow): void {
    this.nameEn.reset(row?.labelEn ?? '');
    this.nameAr.reset(row !== undefined && row.labelAr !== row.labelEn ? row.labelAr : '');
    this.pasteCtl.reset('');
    this.parentCtl.reset(row?.parentKey ?? (mode === 'level' ? null : this.parentOf(level)));
    this.sheet.set({ level, mode, ...(row !== undefined ? { row } : {}) });
    this.sheetRef = openFormDrawer(this.drawer, {
      content: this.sheetTpl(),
      data: { level, mode },
    });
  }

  protected closeSheet(): void {
    this.sheetRef?.close();
    this.sheetRef = null;
  }

  /**
   * A value's key: its own slug at the first two levels (the codes bank tables already use),
   * below them prefixed with its parent's, so two models' "Sport" never collide.
   */
  private keyFor(level: string, labelEn: string, parent: string | null): string {
    const own = slug(labelEn);
    return this.indexOf(level) >= 2 && parent !== null ? `${parent}_${own}`.slice(0, 64) : own;
  }

  protected async submitSheet(data: SheetData): Promise<void> {
    if (!this.sheetValid(data) || this.saving()) return;
    this.saving.set(true);
    try {
      const labelEn = this.nameEn.value.trim();
      const labelAr = this.nameAr.value.trim() || labelEn;
      if (data.mode === 'level') {
        await this.addLevel(labelEn, labelAr);
        this.reveal(this.levels().length);
      } else if (data.mode === 'paste') {
        const parent = this.parentValue();
        const res = await this.api.createValuesBulk({
          type: data.level,
          onDuplicate: 'skip',
          rows: this.parsePaste().map((r) => ({
            ...r,
            key: this.keyFor(data.level, r.labelEn, parent),
            ...(parent !== null ? { parentKey: parent } : {}),
          })),
        });
        this.message.success(
          $localize`:@@cars.pasted:${res.created}:N: added, ${res.skipped}:M: already there.`,
        );
      } else if (data.mode === 'rename' && data.row !== undefined) {
        const parent = this.parentValue();
        await this.api.update(data.row.id, {
          labelEn,
          labelAr,
          // Re-filed when another value was picked above it.
          ...(parent !== null && parent !== data.row.parentKey ? { parentKey: parent } : {}),
        });
        this.message.success($localize`:@@cars.saved:Saved.`);
      } else {
        const parent = this.parentValue();
        await this.api.create({
          type: data.level,
          key: this.keyFor(data.level, labelEn, parent),
          labelEn,
          labelAr,
          ...(parent !== null ? { parentKey: parent } : {}),
        });
        this.message.success($localize`:@@cars.saved:Saved.`);
      }
      const filedUnder = this.parentValue();
      this.closeSheet();
      await this.load();
      if (data.mode !== 'level' && filedUnder !== null) this.showUnder(data.level, filedUnder);
      if (data.mode === 'add' || data.mode === 'paste') await this.askOnceReady(data.level);
    } catch {
      // The error interceptor's toast says why (a name already in the list, a value in use).
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * One more level under the last: a list filed under it, and the question whose answers it
   * is (with a fact, so a bank's Cases can read it). The served questionnaire then makes its
   * answers follow the level above, like every other level.
   */
  private async addLevel(labelEn: string, labelAr: string): Promise<void> {
    const chain = this.levels();
    const last = chain[chain.length - 1];
    let key = `car_${slug(labelEn)}`.slice(0, 48);
    const taken = new Set((await this.api.listTypes()).map((t) => t.type));
    for (let n = 2; taken.has(key); n++) key = `car_${slug(labelEn)}_${n}`.slice(0, 48);
    await this.api.createType({
      key,
      labelEn,
      labelAr,
      ...(last ? { parentTypeKey: last.key } : {}),
      deletable: true,
      onValuesRail: false,
    });
    this.message.success(
      $localize`:@@cars.level_added:Level added. Add its values; customers are asked it once it holds two.`,
    );
  }

  /**
   * A level's question, made the moment the level can carry one: a choice question needs two
   * answers, so an empty new level waits. Made with a fact, so a bank's Cases can read it.
   */
  private async askOnceReady(levelKey: string): Promise<void> {
    const level = this.levels().find((l) => l.key === levelKey);
    if (!level || level.asked || (this.rows()[levelKey] ?? []).length < 2) return;
    await this.programs.ensureMethodListQuestion(levelKey);
    this.message.success(
      $localize`:@@cars.level_asked:Customers are now asked it. Reword the question on the Questions screen.`,
    );
    await this.load();
  }

  protected confirmRemove(index: number, row: EnumerationRow): void {
    const kids = this.childCount(index, row.key);
    const name = this.primary(row);
    this.modal.confirm({
      nzTitle: $localize`:@@cars.remove_title:Remove ${name}:NAME:?`,
      nzContent:
        kids > 0
          ? $localize`:@@cars.remove_has_kids:Move or remove the ${kids}:N: under it first.`
          : $localize`:@@cars.remove_body:Customers can no longer pick it. A bank case that names it stops matching.`,
      nzOkText: kids > 0 ? null : this.removeText,
      nzOkDanger: true,
      nzCancelText: $localize`:@@cars.cancel:Cancel`,
      nzOnOk: async () => {
        if (kids > 0) return;
        try {
          await this.api.remove(row.id);
          await this.load();
        } catch {
          // Toast from the interceptor (e.g. a bank table still keyed on it).
        }
      },
    });
  }
}
