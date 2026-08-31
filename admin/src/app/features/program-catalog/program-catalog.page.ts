import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  PlusOutline,
  EditOutline,
  DeleteOutline,
  SearchOutline,
  HistoryOutline,
  InboxOutline,
  AppstoreOutline,
  CheckCircleOutline,
  PoweroffOutline,
  WarningOutline,
  FunctionOutline,
  ArrowRightOutline,
  ExclamationCircleOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  StatStripComponent,
  openFormDrawer,
  type StatStripItem,
} from '@shared/ui';
import {
  LOAN_CATEGORIES,
  canonicalCategories,
  categoryLabel,
  type LoanCategory,
} from '@core/loan-category';
import { incomeBasisLabel } from '@core/income-basis';
import { LookupsApiService, type EnumerationRow } from '../lookups/lookups.api.service';
import {
  EnumerationEditDrawerComponent,
  type EnumerationEditDrawerData,
} from '@shared/lookups/enumeration-edit.drawer';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  incomeMethodLabel,
  registryFacts,
  type IncomeAssumptionStrategy,
  type SurrogateProductSummary,
} from '@features/bank-programs/bank-programs.types';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import {
  buildBoard,
  isNoPayslip as isNoPayslipName,
  type BasisFilter,
  type ProductCard,
} from './catalog-board';
import { CATALOG_BASE, PRODUCT_BASE } from './program-catalog.paths';

const ENUM_TYPE = 'program_name';

/** How many parked names the health panel names before it stops listing. */
const PARKED_NAMES_SHOWN = 6;

/**
 * Program catalog — the predefined loan program names that feed the bank-program
 * builder's "Program name" picker. A name is JUST A NAME: it carries no lending
 * values of its own — every bank program authors its own specs. Names are DATA
 * (Principle II).
 *
 * One flat list, not per-category lanes: a name can be offered under several loan
 * types, so it has no single lane to sit in. Each card OPENS the name, where the
 * two per-category facts are configured together — which loan types may offer it,
 * and what each of those types scores on. The card shows the summary of both, so
 * the list answers "what is left to set up?" without opening anything.
 *
 * SURROGATE PRODUCTS ARE ON THIS BOARD, behind the Surrogate chip — they were their own
 * top-level section, two clicks from the names they are sold under. A product is the
 * CALCULATION a no-payslip name quotes off, so it is not a peer of a name and cannot share
 * a grid with one: a name and its product frequently share a key (`compound_owner` is
 * both), and one merged list prints that key twice. Products are containers here — a
 * product card lists the names taking their calculation from it, each one a link.
 *
 * WHICH LEAVES A HOLE, and the third group closes it: a name may be sold surrogate and
 * link to NO product. Rendered only inside product cards, those names would be reachable
 * from nowhere. See `catalog-board.ts`, which owns every join on this screen and is where
 * the cases that only fail silently are tested.
 *
 * The health panel is inherited from the assignment board this list replaced. It
 * watches the one failure the list cannot show per row: a loan CATEGORY with no
 * names at all leaves the builder's picker empty, and nothing on a name's own
 * card can reveal that.
 *
 * Super-admin only (route-guarded).
 */
@Component({
  selector: 'app-program-catalog-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
    NzToolTipModule,
    NgTemplateOutlet,
    PageHeaderComponent,
    StatStripComponent,
  ],
  providers: [
    provideNzIconsPatch([
      PlusOutline,
      EditOutline,
      DeleteOutline,
      SearchOutline,
      HistoryOutline,
      InboxOutline,
      AppstoreOutline,
      CheckCircleOutline,
      PoweroffOutline,
      WarningOutline,
      FunctionOutline,
      ArrowRightOutline,
      ExclamationCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Reference data"
        i18n-eyebrow="@@program_catalog.eyebrow"
        title="Program catalog"
        i18n-title="@@program_catalog.title"
        subtitle="Curated loan program names — Doctor, Military, New Car. Pick these in the bank-program builder instead of free-typing. Open a name to set which loan types offer it and what each one scores on."
        i18n-subtitle="@@program_catalog.subtitle"
      >
        @if (gaps().length > 0 || parked().length > 0) {
          <button
            type="button"
            class="health-toggle"
            [attr.aria-expanded]="healthOpen()"
            aria-controls="pcl-health"
            (click)="healthOpen.set(!healthOpen())"
          >
            <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@program_catalog.health"
              >{{ gaps().length + parked().length }} to look at</span
            >
          </button>
        }
      </app-page-header>

      @if (healthOpen() && (gaps().length > 0 || parked().length > 0)) {
        <div class="health" id="pcl-health">
          @if (gaps().length > 0) {
            <p class="hp-line">
              <span i18n="@@program_catalog.health.gaps"
                >No name is offered under {{ labels(gaps()) }}, so the bank-program builder has
                nothing to pick there. Open a name and turn that loan type on.</span
              >
            </p>
          }
          @if (parked().length > 0) {
            <p class="hp-line">
              <span i18n="@@program_catalog.health.parked"
                >Offered under no loan type, so nobody can pick them: {{ names(parked()) }}.</span
              >
            </p>
          }
        </div>
      }

      @if (!loading()) {
        <app-stat-strip
          [items]="stats()"
          ariaLabel="Program catalog statistics"
          i18n-ariaLabel="@@program_catalog.stats.aria"
        />
      }

      <div class="toolbar">
        <nz-input-group [nzPrefix]="searchIcon" class="search">
          <input
            nz-input
            [formControl]="searchControl"
            placeholder="Search program names…"
            i18n-placeholder="@@program_catalog.search"
            aria-label="Search program names"
            i18n-aria-label="@@program_catalog.search"
          />
        </nz-input-group>
        <ng-template #searchIcon>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
        </ng-template>
        <span class="toolbar-spacer"></span>
        <!-- The button matches the list under it. On the Surrogate side "Add program name"
             would open a form for the OTHER kind of object on the screen, which is the one
             mistake this merge could introduce. -->
        @if (basisFilter() === 'no_payslip') {
          <a nz-button nzType="primary" class="add-btn" [routerLink]="newProductLink">
            <span nz-icon nzType="plus" nzTheme="outline"></span>
            <span i18n="@@sp.new2">New surrogate product</span>
          </a>
        } @else {
          <button nz-button nzType="primary" class="add-btn" (click)="add()">
            <span nz-icon nzType="plus" nzTheme="outline"></span>
            <span i18n="@@program_catalog.add">Add program</span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="cards" aria-hidden="true">
          @for (c of skeletonCards; track c) {
            <span class="sk sk-card"></span>
          }
        </div>
      } @else if (isEmpty()) {
        @if (search().trim()) {
          <div class="board-empty">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.no_matches">No programs match “{{ search() }}”.</p>
          </div>
        } @else {
          <div class="board-empty">
            <span nz-icon nzType="inbox" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.empty">No programs here yet — add the first one.</p>
          </div>
        }
      } @else {
        <!-- ONE grid. Income basis is a facet of a name, not a class of name: the same
             "Doctors — Practice" is sold against a payslip by one bank and against a
             years-in-practice table by another, so a lane split printed it twice and
             each copy told half the truth. The chips filter; the card states both. -->
        <div class="basis-bar" role="group" [attr.aria-label]="basisFilterAria">
          @for (c of basisChips(); track c.id) {
            <button
              type="button"
              class="basis-chip"
              [class.on]="basisFilter() === c.id"
              [attr.aria-pressed]="basisFilter() === c.id"
              (click)="setBasis(c.id)"
            >
              <span class="basis-label">{{ c.label }}</span>
              <span class="basis-n">{{ c.n }}</span>
            </button>
          }
        </div>

        <!-- On All the two sides are headed, because they hold different objects and a
             single unheaded run of mixed cards would read as one list that changes shape
             halfway down. On a single chip the chip is the heading. -->
        @if (showProof()) {
          <section class="lane-group">
            @if (grouped()) {
              <h2 class="lane-head">
                <span nz-icon nzType="appstore" nzTheme="outline" aria-hidden="true"></span>
                <span>{{ proofHead }}</span>
                <span class="lane-n">{{ proofNames().length }}</span>
              </h2>
            }
            @if (proofNames().length > 0) {
              <ul class="cards" role="list">
                @for (r of proofNames(); track r.id) {
                  <ng-container
                    [ngTemplateOutlet]="nameCard"
                    [ngTemplateOutletContext]="{ r: r }"
                  />
                }
              </ul>
            } @else {
              <div class="board-empty">
                <span nz-icon nzType="inbox" nzTheme="outline" aria-hidden="true"></span>
                <p i18n="@@program_catalog.proof.empty">
                  No name is sold against a payslip yet. Add a program name and it starts here.
                </p>
              </div>
            }
          </section>
        }

        @if (showSurrogate()) {
          <section class="lane-group">
            @if (grouped()) {
              <h2 class="lane-head">
                <span nz-icon nzType="function" nzTheme="outline" aria-hidden="true"></span>
                <span>{{ surrogateHead }}</span>
                <span class="lane-n">{{ products().length }}</span>
              </h2>
            }
            @if (products().length > 0) {
              <ul class="cards" role="list">
                @for (c of products(); track c.product.key) {
                  <ng-container
                    [ngTemplateOutlet]="productCard"
                    [ngTemplateOutletContext]="{ c: c }"
                  />
                }
              </ul>
            } @else {
              <div class="board-empty">
                <span nz-icon nzType="function" nzTheme="outline" aria-hidden="true"></span>
                <p i18n="@@program_catalog.surrogate.empty">
                  No calculation for a customer with no payslip yet. Start one from a shape and the
                  questions it asks are built with it.
                </p>
              </div>
            }
          </section>

          @if (unlinked().length > 0) {
            <section class="lane-group">
              <h2 class="lane-head">
                <span
                  nz-icon
                  nzType="exclamation-circle"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
                <span i18n="@@program_catalog.unlinked.head"
                  >Not taking a product's calculation</span
                >
                <span class="lane-n">{{ unlinked().length }}</span>
              </h2>
              <p class="lane-note" i18n="@@program_catalog.unlinked.note">
                Sold without a payslip, but not pointed at one of the calculations above. Open a
                name to see how it works its income out.
              </p>
              <ul class="cards" role="list">
                @for (u of unlinked(); track u.row.id) {
                  <ng-container
                    [ngTemplateOutlet]="nameCard"
                    [ngTemplateOutletContext]="{ r: u.row, unlinked: u.state }"
                  />
                }
              </ul>
            </section>
          }
        }

        @if (deprecated().length > 0) {
          <section class="lane-group">
            <h2 class="lane-head muted">
              <span nz-icon nzType="history" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@program_catalog.deprecated">Deprecated</span>
              <span class="lane-n">{{ deprecated().length }}</span>
            </h2>
            <ul class="cards" role="list">
              @for (r of deprecated(); track r.id) {
                <li class="card deprecated">
                  <div class="card-head">
                    <span class="chip" data-tone="warning" aria-hidden="true">
                      <span nz-icon nzType="history" nzTheme="outline"></span>
                    </span>
                    <span class="name">{{ nameOf(r) }}</span>
                  </div>
                  <div class="card-foot">
                    <span class="tag warn">{{ deprecatedLabel }}</span>
                    <span class="foot-spacer"></span>
                    <div class="row-actions">
                      <button
                        class="icon-action"
                        type="button"
                        (click)="edit(r)"
                        nz-tooltip
                        nzTooltipTitle="Edit"
                        i18n-nzTooltipTitle="@@program_catalog.edit"
                        [attr.aria-label]="editLabel"
                      >
                        <span nz-icon nzType="edit" nzTheme="outline"></span>
                      </button>
                      <!-- Delete belongs here most of all: a deprecated name is one
                           somebody already decided is finished, and the row only stays
                           to explain keys old programs carry. When nothing carries it,
                           the tombstone is noise. -->
                      <button
                        class="icon-action danger"
                        type="button"
                        (click)="confirmDelete(r)"
                        nz-tooltip
                        nzTooltipTitle="Delete"
                        i18n-nzTooltipTitle="@@program_catalog.delete"
                        [attr.aria-label]="deleteLabel"
                      >
                        <span nz-icon nzType="delete" nzTheme="outline"></span>
                      </button>
                    </div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      }

      <ng-template #nameCard let-r="r" let-unlinked="unlinked">
        <li class="card" [class.muted]="!r.active" [class.is-surrogate]="isNoPayslip(r)">
          <!-- The whole card opens the name: one anchor, stretched over the card by
               ::after, with the action row lifted above it. A row of small
               "configure" links instead would give every card three competing
               targets and still leave the biggest one dead. -->
          <a class="open" [routerLink]="[r.key]" [attr.aria-label]="openLabel(r)">
            <span class="card-head">
              <span class="chip" [attr.data-tone]="r.active ? 'brand' : 'muted'" aria-hidden="true">
                <span
                  nz-icon
                  [nzType]="r.active ? 'appstore' : 'poweroff'"
                  nzTheme="outline"
                ></span>
              </span>
              <span class="name">{{ nameOf(r) }}</span>
            </span>

            <span class="config">
              @if (categoriesOf(r).length === 0) {
                <span class="cat-none" i18n="@@program_catalog.card.parked">No loan types yet</span>
              } @else {
                <span class="cats">
                  @for (c of categoriesOf(r); track c) {
                    <span class="cat" [style.--cat-accent]="'var(--color-cat-' + c + ')'">
                      <span class="cat-dot" aria-hidden="true"></span>
                      {{ label(c) }}
                    </span>
                  }
                </span>
                @if (questionCount(r) === 0) {
                  <span class="q-none" i18n="@@program_catalog.card.no_questions"
                    >No questions picked</span
                  >
                } @else {
                  <span class="q-count">{{ questionLabel(r) }}</span>
                }
                <!-- WHICH figure a bank works the income out from is the BANK's answer,
                     entered on its own program. The board says only how this name may be
                     sold; naming a fact here was a second, weaker claim that no quote
                     ever read. -->
                @if (!isNoPayslip(r) && noPayslipPrograms(r) > 0) {
                  <!-- The contradiction worth colour: banks ARE selling this name without a
                       payslip, on a name the catalog says is payslip-only. One of the two
                       is wrong, and only a human knows which. -->
                  <span class="q-none" i18n="@@program_catalog.card.unmarked_no_payslip"
                    >Banks sell this on a surrogate basis, but the name is not marked for it</span
                  >
                }
              }
            </span>
          </a>

          <div class="card-foot">
            <!-- Does any bank actually sell this name? The row actions are
                 hover-only, so the board has to answer it at rest. -->
            <span class="usage" [class.zero]="usageOf(r).programs === 0">
              @if (usageOf(r).programs === 0) {
                <span i18n="@@program_catalog.usage.none">Not offered yet</span>
              } @else {
                {{ usageLabel(r) }}
              }
            </span>
            <!-- The one badge worth a colour on this board: a program typed "no
                 payslip" whose bank never entered a table produces NO income and
                 says nothing to the customer. Gated on the COUNT alone now — the
                 lane flag it used to also require is gone, and the count is the
                 fact. -->
            @if (missingTables(r) > 0) {
              <span class="tag warn">{{ missingTableLabel(r) }}</span>
            }
            <!-- Only the half of this group that is actually broken. A name stating its own
                 calculation quotes perfectly well, and badging those too put a tag on nine
                 cards out of eleven — at which point the row of colour says nothing and the
                 two that need a human are the hardest to find. Same rule the Inactive pill
                 on this board already follows: only the exception is badged. -->
            @if (unlinked === 'nothing') {
              <span class="tag warn" i18n="@@program_catalog.card.no_calculation"
                >Works out no income</span
              >
            }
            <!-- Only the EXCEPTION is badged. Nearly every name is active, so an
                 ACTIVE pill on all sixteen cards said nothing and cost a row of
                 colour; absence now means active. -->
            @if (!r.active) {
              <span class="tag">{{ inactiveLabel }}</span>
            }
            <span class="foot-spacer"></span>
            <div class="row-actions">
              <button
                class="icon-action"
                type="button"
                (click)="edit(r)"
                nz-tooltip
                nzTooltipTitle="Edit"
                i18n-nzTooltipTitle="@@program_catalog.edit"
                [attr.aria-label]="editLabel"
              >
                <span nz-icon nzType="edit" nzTheme="outline"></span>
              </button>
              <button
                class="icon-action"
                type="button"
                (click)="toggleActive(r, !r.active)"
                nz-tooltip
                [nzTooltipTitle]="r.active ? deactivateLabel : activateLabel"
                [attr.aria-label]="r.active ? deactivateLabel : activateLabel"
              >
                <span nz-icon nzType="poweroff" nzTheme="outline"></span>
              </button>
              <!-- Delete, with no deprecate beside it. Two ways to retire a name
                   read as a choice the operator has to understand, and the safe one
                   left a tombstone card nobody could ever clear. This board now
                   offers deactivate (reversible, keeps the name pickable-later) and
                   delete (permanent, refused while anything points at the key) —
                   deprecation stays a stored state the tail section still renders,
                   it is simply no longer something this screen creates. -->
              <button
                class="icon-action danger"
                type="button"
                (click)="confirmDelete(r)"
                nz-tooltip
                nzTooltipTitle="Delete"
                i18n-nzTooltipTitle="@@program_catalog.delete"
                [attr.aria-label]="deleteLabel"
              >
                <span nz-icon nzType="delete" nzTheme="outline"></span>
              </button>
            </div>
          </div>
        </li>
      </ng-template>

      <!-- NOT one big anchor. The names inside are links, and an <a> inside an <a> is
           invalid HTML — the browser closes the outer one and the inner link silently
           becomes the whole card's target. So the title is a stretched link and the name
           chips are SIBLINGS lifted above its overlay, exactly how the action row escapes
           the same overlay on the name card. -->
      <ng-template #productCard let-c="c">
        <li class="card is-product" [class.muted]="!c.product.active">
          <a
            class="open"
            [routerLink]="[productBase, c.product.key]"
            [attr.aria-label]="openProductLabel(c)"
          >
            <span class="card-head">
              <span class="chip" data-tone="surrogate" aria-hidden="true">
                <span nz-icon nzType="function" nzTheme="outline"></span>
              </span>
              <span class="name">{{ productName(c) }}</span>
            </span>
            <span class="config">
              <span class="q-count">{{ reads(c.product) }}</span>
            </span>
          </a>

          <div class="sold-as">
            @if (c.names.length === 0) {
              <!-- The actionable state, so a warn tag rather than the disabled-ink metadata
                   line it shipped as: a calculation nothing sells quotes for nobody, and the
                   disabled ink token sits under 4.5:1 for a sentence somebody must read. -->
              <span class="tag warn" i18n="@@sp.unused">No catalog name sells this yet</span>
            } @else {
              <span class="sold-as-label" i18n="@@program_catalog.product.sold_as">Sold as</span>
              @for (n of c.names; track n.id) {
                <a class="name-chip" [routerLink]="[catalogBase, n.key]">{{ nameOf(n) }}</a>
              }
            }
            <!-- A stored link with no name behind it. Rendering one chip fewer would hide
                 exactly the case worth seeing. -->
            @for (k of c.orphanNameKeys; track k) {
              <span class="name-chip is-orphan" [attr.title]="orphanTitle">{{ k }}</span>
            }
          </div>

          <div class="card-foot">
            <span class="usage" [class.zero]="c.programs === 0">
              @if (c.programs === 0) {
                <!-- Not the name card's "Not offered yet": a product is not offered to
                     anybody, it is what a bank program quotes FROM. Borrowing the name's
                     wording here would have the card claim the wrong thing about itself. -->
                <span i18n="@@program_catalog.product.unquoted">No bank quotes from it yet</span>
              } @else {
                {{ productUsageLabel(c) }}
              }
            </span>
            @if (c.missingTables > 0) {
              <span class="tag warn">{{ productMissingLabel(c) }}</span>
            }
            @if (!c.product.active) {
              <span class="tag" i18n="@@sp.retired">Retired</span>
            }
            <span class="foot-spacer"></span>
            <span class="go" aria-hidden="true">
              <span nz-icon nzType="arrow-right" nzTheme="outline"></span>
            </span>
          </div>
        </li>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }
      .toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .search {
        max-inline-size: 420px;
        inline-size: 100%;
        flex: 1 1 240px;
      }
      .toolbar-spacer {
        flex: 1;
      }
      .add-btn [nz-icon] {
        margin-inline-end: var(--space-1);
      }
      .health-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-block-size: 32px;
        padding-inline: var(--space-3);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-pill);
        background: var(--color-warning-bg);
        color: var(--color-warning);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .health-toggle:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .health {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
      }
      .hp-line {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      /* --- Lane groups ------------------------------------------------------ */
      /* Section HEADINGS, not cards. The cards are the page's card layer; wrapping
         each group in a panel would put cards inside cards for no gain, and the
         heading plus its count already separates the two lists. */
      .lane-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .lane-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .lane-head.muted {
        color: var(--color-text-tertiary);
      }
      .lane-n {
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        letter-spacing: 0;
        color: var(--color-text-tertiary);
      }
      /* --- Income-basis filter ---------------------------------------------- */
      /* Toggle buttons with aria-pressed, NOT a tablist: one grid is being filtered,
         not swapped for another panel, and a role the widget does not honour is worse
         for a screen reader than the plain button it really is. Tab order is the
         reading order, so no roving tabindex is needed either. */
      .basis-bar {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .basis-chip {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-xs);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-chip:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text-primary);
      }
      .basis-chip:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .basis-chip.on {
        border-color: var(--color-brand-primary);
        background: color-mix(in srgb, var(--color-brand-primary) 8%, transparent);
        color: var(--color-text-primary);
        font-weight: var(--font-weight-semibold);
      }
      .basis-n {
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        color: var(--color-text-tertiary);
      }
      .basis-chip.on .basis-n {
        color: var(--color-brand-primary);
      }

      /* A note under a group heading, when the heading alone cannot say why the group
         exists. Secondary, not tertiary: it is read, not decoration. */
      .lane-note {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--leading-relaxed, 1.6);
      }

      /* --- Surrogate product card ------------------------------------------ */
      /* Shell tokens are the name card's, one for one — it IS a .card, and any divergence
         between two grids ten pixels apart reads as two different products. What tells them
         apart is the medallion's hue and the row of names, which is content. */
      .chip[data-tone='surrogate'] {
        background: color-mix(in srgb, var(--color-income-surrogate) 14%, transparent);
        color: var(--color-income-surrogate);
      }
      .card.is-product {
        border-inline-start: 3px solid
          color-mix(in srgb, var(--color-income-surrogate) 70%, var(--color-surface-default));
      }
      /* Lifted above the stretched .open::after overlay, or every chip in here is
         unclickable — it covers them. Same escape the action row uses. */
      .sold-as {
        position: relative;
        z-index: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1) var(--space-2);
        min-inline-size: 0;
      }
      .sold-as-label {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }
      /* A LINK, so it cannot ship on the .tag ink — tertiary sits under 4.5:1 at this
         size, and this is text somebody is meant to read and click. */
      .name-chip {
        display: inline-flex;
        align-items: center;
        min-block-size: 24px;
        padding-inline: var(--space-2);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-default);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        text-decoration: none;
        white-space: nowrap;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .name-chip:hover {
        border-color: var(--color-brand-primary);
        color: var(--color-text-primary);
      }
      .name-chip:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      /* A key with no name behind it: not a link, and not quietly dropped either. */
      .name-chip.is-orphan {
        border-style: dashed;
        border-color: var(--color-warning);
        color: var(--color-warning);
        font-family: var(--font-family-mono, monospace);
      }
      /* The arrow points along the reading direction, so it mirrors in Arabic. */
      .card.is-product .go {
        color: var(--color-text-tertiary);
        display: inline-flex;
      }
      :host-context([dir='rtl']) .card.is-product .go {
        transform: scaleX(-1);
      }

      /* The no-payslip card's identity is a leading edge, not a fill: a tinted card
         would compete with the "inactive" muted state and with the warn tag it also
         has to carry. Plum, the hue this concept already owns — not the brand azure,
         which every active card's chip is already using. */
      .card.is-surrogate {
        border-inline-start: 3px solid
          color-mix(in srgb, var(--color-income-surrogate) 70%, var(--color-surface-default));
      }
      .board-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-6);
        color: var(--color-text-tertiary);
        text-align: center;
      }
      .board-empty [nz-icon] {
        font-size: 32px;
        opacity: 0.6;
      }
      .board-empty p {
        margin: 0;
        font-size: var(--text-sm);
      }
      .sk {
        display: block;
        border-radius: var(--radius-sm);
        background: linear-gradient(
          90deg,
          var(--color-surface-elevated) 0%,
          var(--color-surface-muted) 50%,
          var(--color-surface-elevated) 100%
        );
        background-size: 200% 100%;
        animation: catalog-shimmer 1.2s ease-in-out infinite;
      }
      /* Matches the real card: 36px chip/name head + 12px gap + 30px action
         floor + 2×16px padding. */
      .sk-card {
        block-size: 110px;
        border-radius: var(--radius-lg);
      }
      @keyframes catalog-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk {
          animation: none;
          background: var(--color-surface-muted);
        }
      }
      .cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
        /* Same gap as the stat strip above, so at 1120px both grids land on
           three columns whose edges line up. */
        gap: var(--space-4);
      }
      /* Two rows: a chip/name head, then a meta/action floor. Column layout so
         the name owns the card's full width — the status pill + hover actions
         used to reserve ~130px inline and squeeze longer names ("Government
         Employees") into an ellipsis.

         Shell tokens are the stat card's, one for one — radius-lg, the DEFAULT
         border, resting shadow-sm, shadow-md + brand edge on hover — because the
         two grids sit ten pixels apart and any divergence reads as two different
         products. Surface-DEFAULT, not -elevated: on this palette "elevated"
         (#F5F3F0) is a shade DARKER than the page (#F8F6F4), and a name board of
         nine recessed tiles reads as one flat grey field. */
      .card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-brand-primary);
      }
      /* Recessed instead of faded: the "Inactive" tag already carries the state,
         and dimming the whole card only cost the name its contrast. */
      .card.muted {
        background: var(--color-surface-elevated);
      }
      .card.muted .name {
        color: var(--color-text-secondary);
      }
      /* Dashed is reserved for deprecated — the one destructive state here.
         A retired name is not a resting object, so it drops the shadow too. */
      .card.deprecated {
        background: var(--color-surface-elevated);
        border-style: dashed;
        border-color: var(--color-border-default);
        box-shadow: none;
      }
      /* Declared after .card.deprecated, which ties on specificity and would
         otherwise pin the border back to default on the hover it is meant to
         answer. Warning, not brand: the only action left here is Edit. */
      .card.deprecated:hover {
        border-color: var(--color-warning);
        box-shadow: var(--shadow-sm);
      }
      /* The open link owns the card's body, and its ::after stretches the hit area
         over the whole card so the target is the card, not the text — while the
         anchor itself stays a normal flow element, which is what keeps the name
         selectable and the focus ring tight around the content. */
      .open {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        min-inline-size: 0;
        color: inherit;
        text-decoration: none;
        border-radius: var(--radius-sm);
      }
      .open::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
      }
      .open:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .card-head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      /* Config summary: which loan types, then how many questions. Two lines of
         metadata, not a card of its own — nesting a panel inside a card to hold
         two facts is hierarchy for its own sake. */
      .config {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .cats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      /* A dot, not a coloured pill: four filled pills per card across a 16-card
         grid is a confetti field, and the label already carries the meaning. The
         dot only has to make the set countable at a glance. */
      .cat-dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--cat-accent, var(--color-cat-other));
      }
      .cat-none,
      .q-none {
        font-size: var(--text-xs);
        color: var(--color-text-disabled);
      }
      .q-count {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* The stat strip's 36px tonal chip, same size and radius. It is decoration
         with a job: it gives every card a fixed optical anchor so a three-column
         grid of ragged, wrapping names still scans down a straight edge. */
      .chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
        font-size: var(--text-lg);
        background: color-mix(in srgb, var(--color-brand-primary) 12%, transparent);
        color: var(--color-brand-primary);
      }
      .chip[data-tone='muted'] {
        background: color-mix(in srgb, var(--color-text-tertiary) 14%, transparent);
        color: var(--color-text-tertiary);
      }
      .chip[data-tone='warning'] {
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
        color: var(--color-warning);
      }
      /* Names wrap in full — never truncated (they are the card's whole point).
         text-lg is the system's card-title size; a name IS this card's title. */
      .name {
        min-inline-size: 0;
        padding-block-start: 2px;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        text-wrap: balance;
        overflow-wrap: break-word;
      }
      /* Usage line: whether any bank actually sells this program. */
      /* text-xs, the system's metadata floor — xxs (11px) sat below it. */
      .usage {
        min-inline-size: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* No italics — Arabic has no italic tradition and synthesised slant is ugly
         at this size (Principle IV). Tone alone carries the "unused" signal, and
         the card border stays solid: dashed is reserved for deprecated, the one
         destructive state on this board. */
      .usage.zero {
        color: var(--color-text-disabled);
      }
      /* Pinned to the card floor so the meta + action rows align across a grid
         row regardless of how many lines each name takes. */
      .card-foot {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: auto;
      }
      .foot-spacer {
        flex: 1;
      }
      .tag {
        flex: none;
        padding-inline: var(--space-2);
        padding-block: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        /* Matches .usage — the two share the foot row and any size gap between
           them reads as a mistake at this scale. */
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        white-space: nowrap;
      }
      .tag.warn {
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        color: var(--color-warning);
      }
      /* Lifted above the stretched open-link, or the buttons would be unclickable
         — the overlay covers them. */
      .row-actions {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover .row-actions,
      .card:focus-within .row-actions {
        opacity: 1;
      }
      .icon-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 30px;
        block-size: 30px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .icon-action:hover {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
      }
      .icon-action.danger:hover {
        color: var(--color-error);
      }
      .icon-action:active {
        background: var(--color-tonal-accent-bg);
      }
      .icon-action:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 1px;
      }
      .cards-divider {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      @media (hover: none) {
        .row-actions {
          opacity: 1;
        }
        .icon-action {
          inline-size: 40px;
          block-size: 40px;
        }
        /* Links, so they need a real target where there is no cursor to aim with. */
        .name-chip {
          min-block-size: 44px;
          padding-inline: var(--space-3);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card,
        .row-actions,
        .name-chip {
          transition: none;
        }
        .card:hover {
          transform: none;
        }
      }
      @media (max-width: 720px) {
        .page {
          padding: var(--space-4);
        }
        .cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProgramCatalogPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly programs = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly modal = inject(NzModalService);
  private readonly drawer = inject(NzDrawerService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly loading = signal(true);
  protected readonly healthOpen = signal(false);
  private readonly rows = signal<EnumerationRow[]>([]);
  private readonly productRows = signal<readonly SurrogateProductSummary[]>([]);

  protected readonly catalogBase = CATALOG_BASE;
  protected readonly productBase = PRODUCT_BASE;
  protected readonly newProductLink = `${PRODUCT_BASE}/new`;

  /** Fixed-length placeholders for the shape-matched loading skeleton. */
  protected readonly skeletonCards = [0, 1, 2, 3, 4, 5];

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly search = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  // Localized action labels reused across tooltips + aria.
  protected readonly inactiveLabel = $localize`:@@program_catalog.status.inactive:Inactive`;
  protected readonly deprecatedLabel = $localize`:@@program_catalog.status.deprecated:Deprecated`;
  protected readonly editLabel = $localize`:@@program_catalog.edit:Edit`;
  protected readonly activateLabel = $localize`:@@program_catalog.activate:Activate`;
  protected readonly deactivateLabel = $localize`:@@program_catalog.deactivate:Deactivate`;
  protected readonly deleteLabel = $localize`:@@program_catalog.delete:Delete`;
  protected readonly basisFilterAria = $localize`:@@program_catalog.basis.aria:Filter by how the bank reads the income`;

  /**
   * Everything the grid renders, from the two lists this page loads.
   *
   * ONE derivation, in a pure module with its own spec — this used to be six computeds and
   * two private methods on this class, none of which could be exercised, and the case that
   * matters (a name reachable from no group at all) fails silently.
   */
  private readonly board = computed(() =>
    buildBoard({
      names: this.rows(),
      products: this.productRows(),
      search: this.search(),
      isAr: this.isAr,
    }),
  );

  protected readonly proofNames = computed(() => this.board().proofNames);
  protected readonly products = computed(() => this.board().products);
  protected readonly unlinked = computed(() => this.board().unlinked);
  protected readonly deprecated = computed(() => this.board().deprecated);

  /**
   * Income basis is a FACET, not a taxonomy — hence a filter over one board rather than the
   * headed lanes this page used to carry per loan category.
   *
   * What the facet now switches is the KIND of object on screen: names sold against a
   * payslip, or the calculations a no-payslip name quotes off. It lives in `?basis=` so a
   * pasted link and a reload land where the operator was, and so `/program-catalog/products`
   * has somewhere to redirect to. Same posture as `?step=` and `?loan=` on the two detail
   * pages: the signal is the source of truth and the URL mirrors it with `replaceUrl`, so
   * flipping a chip does not fill the back button with filter states.
   */
  protected readonly basisFilter = signal<BasisFilter>(this.initialBasis());

  protected setBasis(next: BasisFilter): void {
    this.basisFilter.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      // `null` REMOVES the param, so the default view has a clean URL and a bookmark of it
      // does not pin a filter that was never chosen.
      queryParams: { basis: next === 'all' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private initialBasis(): BasisFilter {
    const raw = this.route.snapshot.queryParamMap.get('basis');
    return raw === 'payslip' || raw === 'no_payslip' ? raw : 'all';
  }

  protected readonly grouped = computed(() => this.basisFilter() === 'all');
  protected readonly showProof = computed(() => this.basisFilter() !== 'no_payslip');
  protected readonly showSurrogate = computed(() => this.basisFilter() !== 'payslip');

  /** Nothing loaded at all — distinct from "nothing matches the chip", which is per group. */
  protected readonly isEmpty = computed(
    () => this.rows().length === 0 && this.productRows().length === 0,
  );

  /** Still used by the name card's accent and by the health panel below. */
  protected isNoPayslip(row: EnumerationRow): boolean {
    return isNoPayslipName(row);
  }

  protected readonly basisChips = computed<Array<{ id: BasisFilter; label: string; n: number }>>(
    () => {
      const c = this.board().counts;
      return [
        { id: 'all', label: $localize`:@@program_catalog.basis.all:All`, n: c.all },
        { id: 'payslip', label: incomeBasisLabel('payslip'), n: c.payslip },
        { id: 'no_payslip', label: incomeBasisLabel('no_payslip'), n: c.no_payslip },
      ];
    },
  );

  protected readonly stats = computed<StatStripItem[]>(() => {
    const all = this.rows();
    const active = all.filter((r) => r.active && !r.deprecatedAt).length;
    return [
      {
        label: $localize`:@@program_catalog.stat.total:Programs`,
        value: all.length,
        icon: 'appstore',
        hint: $localize`:@@program_catalog.stat.total.hint:across all loan types`,
      },
      {
        label: $localize`:@@program_catalog.stat.active:Active`,
        value: active,
        tone: 'success',
        icon: 'check-circle',
      },
      // The products, not the deprecated names: this board lists both kinds of object now,
      // and a strip that counted only one of them under-reported the section by a third.
      // Nothing is lost — the deprecated tail section carries its own count in its heading,
      // which is where somebody looking for it already is.
      {
        label: $localize`:@@program_catalog.stat.products:Surrogate calculations`,
        value: this.productRows().length,
        icon: 'function',
        hint: $localize`:@@program_catalog.stat.products.hint:ways to work an income out with no payslip`,
      },
    ];
  });

  /**
   * Loan categories no live name is offered under. The builder's Program name
   * picker is EMPTY for these, which is a hard stop for whoever is trying to add
   * a car loan — and the one failure a per-name card cannot show, since every
   * card looks fine.
   *
   * Inactive names count as offered: reactivating one is a single click and its
   * assignment survives, so a category served only by an inactive name is not a
   * gap, it is a switch someone has to flip.
   */
  protected readonly gaps = computed<LoanCategory[]>(() => {
    const offered = new Set<LoanCategory>();
    for (const r of this.rows()) {
      if (r.deprecatedAt) continue;
      for (const c of this.categoriesOf(r)) offered.add(c);
    }
    return LOAN_CATEGORIES.filter((c) => !offered.has(c));
  });

  /** Live names offered under nothing — kept and editable, pickable nowhere. */
  protected readonly parked = computed<EnumerationRow[]>(() =>
    this.rows().filter((r) => !r.deprecatedAt && this.categoriesOf(r).length === 0),
  );

  ngOnInit(): void {
    // The fact registry backs `reads()` for a `fact:<key>` product, so it names the fact
    // rather than printing a raw key. Lazily cached — nothing fetches it unless a screen
    // asks, and this is now one of them.
    void this.enums.load('surrogate_fact');
    void this.reload();
  }

  add(): void {
    this.openDrawer({ mode: 'create', type: ENUM_TYPE });
  }

  edit(row: EnumerationRow): void {
    this.openDrawer({ mode: 'edit', type: ENUM_TYPE, row });
  }

  // --- Card meta ------------------------------------------------------------

  /**
   * ONE name per card, in the reading locale — not the en/ar pair the board used
   * to stack. Both labels are still authored in the edit dialog and both are
   * still searchable; showing them together only doubled every card's height for
   * a translation the operator can already read. Locale-aware rather than
   * hardcoded English so the ar-EG build stays Arabic-first (Principle IV).
   */
  nameOf(row: EnumerationRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  /** Server omits `usage` for non-`program_name` types; treat that as unused. */
  usageOf(row: EnumerationRow): {
    programs: number;
    banks: number;
    noPayslipPrograms: number;
    noPayslipProgramsWithoutTable: number;
  } {
    return (
      row.usage ?? {
        programs: 0,
        banks: 0,
        noPayslipPrograms: 0,
        noPayslipProgramsWithoutTable: 0,
      }
    );
  }

  /** How many bank programs behind this name are sold with no payslip. */
  protected noPayslipPrograms(row: EnumerationRow): number {
    return this.usageOf(row).noPayslipPrograms;
  }

  protected missingTables(row: EnumerationRow): number {
    return this.usageOf(row).noPayslipProgramsWithoutTable;
  }

  protected missingTableLabel(row: EnumerationRow): string {
    const count = this.missingTables(row);
    return $localize`:@@program_catalog.card.no_table:${count}:COUNT: with no table yet`;
  }

  usageLabel(row: EnumerationRow): string {
    const u = this.usageOf(row);
    return $localize`:@@program_catalog.usage.value:${u.programs}:PROGRAMS: programs · ${u.banks}:BANKS: banks`;
  }

  /**
   * Loan categories this name may be offered under, in canonical order.
   *
   * `categories` is absent on a backend that has not deployed the assignment
   * endpoints; that reads as "unknown", not as parked, so the card falls back to
   * an empty list and the health panel counts it — an operator seeing "no loan
   * types" on every card will look, which is the correct outcome for a version
   * skew.
   */
  protected categoriesOf(row: EnumerationRow): LoanCategory[] {
    return canonicalCategories(row.categories ?? []);
  }

  protected label(category: LoanCategory): string {
    return categoryLabel(category);
  }

  protected labels(categories: readonly LoanCategory[]): string {
    return categories.map((c) => categoryLabel(c)).join(this.isAr ? '، ' : ', ');
  }

  protected names(rows: readonly EnumerationRow[]): string {
    const shown = rows.slice(0, PARKED_NAMES_SHOWN).map((r) => this.nameOf(r));
    const rest = rows.length - shown.length;
    const list = shown.join(this.isAr ? '، ' : ', ');
    return rest > 0
      ? $localize`:@@program_catalog.health.more:${list}:NAMES: and ${rest}:REST: more`
      : list;
  }

  /**
   * Suggested questions across the loan types this name is actually OFFERED
   * under. Deliberately not the sum over all four: a set left behind under a
   * withdrawn loan type is kept on purpose (nothing prunes it), and counting it
   * here would tell an operator their name is configured when the questions it
   * points at are inert.
   */
  protected questionCount(row: EnumerationRow): number {
    const byCategory = row.questionsByCategory;
    if (!byCategory) return 0;
    return this.categoriesOf(row).reduce((n, c) => n + (byCategory[c]?.length ?? 0), 0);
  }

  protected questionLabel(row: EnumerationRow): string {
    const count = this.questionCount(row);
    return $localize`:@@program_catalog.card.questions:${count}:COUNT: questions scored`;
  }

  protected openLabel(row: EnumerationRow): string {
    return $localize`:@@program_catalog.card.open:Set up ${this.nameOf(row)}:NAME:`;
  }

  async toggleActive(row: EnumerationRow, next: boolean): Promise<void> {
    this.patchRow(row.id, { active: next });
    try {
      await this.api.update(row.id, { active: next });
    } catch {
      this.patchRow(row.id, { active: !next });
    }
  }

  /**
   * Delete, behind a confirmation popup — the one irreversible action on this
   * board.
   *
   * Two different popups, because the two outcomes are not the same conversation:
   * a name bank programs are using cannot be deleted at all, and offering a
   * "Delete" button that always fails would teach operators to distrust the
   * dialog. So a used name gets an explanation and the way out that is still on
   * this board (switch it off — same disappearance from the picker, reversible),
   * and a free one gets a danger confirm that names what is about to go.
   *
   * The count is only a shortcut. The server re-checks — including applications,
   * which this board does not count — and refuses with `ENUMERATION_IN_USE`; the
   * toast interceptor renders that, so a stale board cannot delete anything.
   *
   * NOT optimistic, unlike `toggleActive` above. That is one boolean that can be
   * flipped back; a card that vanishes and then reappears reads as a bug, and the
   * operator has just been told the action is permanent.
   */
  protected confirmDelete(row: EnumerationRow): void {
    const inUse = this.usageOf(row).programs;
    if (inUse > 0) {
      this.modal.info({
        nzTitle: $localize`:@@program_catalog.delete.blocked.title:This name is still in use`,
        nzContent: $localize`:@@program_catalog.delete.blocked.body:${inUse}:PROGRAMS: bank programs use ${this.nameOf(row)}:NAME:, so it cannot be deleted. Switch it off instead — it leaves the picker and every saved program keeps working.`,
        nzOkText: $localize`:@@program_catalog.delete.blocked.ok:Got it`,
      });
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@program_catalog.delete.title:Delete this program name?`,
      nzContent: $localize`:@@program_catalog.delete.body:${this.nameOf(row)}:NAME: is removed for good, along with its loan types and picked questions. This cannot be undone.`,
      nzOkText: this.deleteLabel,
      nzOkDanger: true,
      nzOnOk: () => this.remove(row),
    });
  }

  private async remove(row: EnumerationRow): Promise<void> {
    try {
      await this.api.remove(row.id);
      this.rows.update((list) => list.filter((r) => r.id !== row.id));
      this.message.success($localize`:@@program_catalog.delete.success:Program name deleted.`);
    } catch {
      // Refused — almost always `ENUMERATION_IN_USE`, which the toast interceptor
      // has already explained. Reload instead of leaving the board untouched: a
      // refusal means these counts are stale, and without the refresh the next
      // click would ask the same question and get the same surprise.
      void this.reload({ silent: true });
    }
  }

  private patchRow(id: string, patch: Partial<EnumerationRow>): void {
    this.rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** Side sheet: the board keeps its counts on screen while a name is written. */
  private openDrawer(data: EnumerationEditDrawerData): void {
    const ref = openFormDrawer<EnumerationEditDrawerComponent, EnumerationEditDrawerData, boolean>(
      this.drawer,
      {
        content: EnumerationEditDrawerComponent,
        data: {
          ...data,
          title:
            data.mode === 'create'
              ? $localize`:@@program_catalog.dialog.add:Add program name`
              : $localize`:@@program_catalog.dialog.edit:Edit program name`,
          submitLabel:
            data.mode === 'create'
              ? $localize`:@@program_catalog.dialog.add_cta:Add program name`
              : $localize`:@@lookups.dialog.save:Save`,
          subtitle:
            data.mode === 'create'
              ? $localize`:@@program_catalog.dialog.add_sub:A catalog name banks file their programs under. It starts offered under no loan type — pick those on its own page.`
              : $localize`:@@program_catalog.dialog.edit_sub:Renames the name everywhere banks already use it, and restates what it is sold against.`,
        },
      },
    );
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.reload({ silent: true });
    });
  }

  /** Silent reload keeps the board on screen (no skeleton flash) after a save. */
  private async reload(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      // Concurrent: the two lists are independent, and the board cannot render either half
      // correctly without both — a product card's names and counts are joined from the name
      // rows, so showing the products first would print every card as "not offered yet".
      const [names, products] = await Promise.all([
        this.api.list(ENUM_TYPE),
        this.programs.listSurrogateProducts(),
      ]);
      this.rows.set(names);
      this.productRows.set(products.data);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  // --- Surrogate product cards ---------------------------------------------

  protected readonly proofHead = $localize`:@@program_catalog.proof.head:Sold against a payslip`;
  protected readonly surrogateHead = $localize`:@@program_catalog.surrogate.head:Worked out without a payslip`;
  protected readonly orphanTitle = $localize`:@@program_catalog.product.orphan:A name points at this calculation, but that name is no longer on the board.`;

  /**
   * The fact registry, so a `fact:<key>` product names its fact rather than rendering the
   * raw key.
   */
  private readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );

  protected productName(c: ProductCard): string {
    return this.isAr ? c.product.labelAr : c.product.labelEn;
  }

  /**
   * What the calculation reads, in the operator's words.
   *
   * `incomeMethodLabel` is the same mapper the bank wizard and the name pages use, so a
   * method is named identically wherever it appears — including `steps`, which reads as a
   * multi-step product rather than as a blank.
   */
  protected reads(p: ProductCard['product']): string {
    if (p.strategy === null) {
      return $localize`:@@sp.reads_none:No calculation stated yet`;
    }

    // A pipeline product's generic label is the same sentence for every one of them, so a
    // list of them says nothing about what tells them apart — which is how two products that
    // are really one read as duplicates. What DOES tell them apart is what the calculation
    // arrives at and how many ways it offers of getting there, so the card says that.
    const ways = p.wayCount;
    if (ways !== null && ways > 0 && p.outputKind !== null) {
      return p.outputKind === 'maxAmount'
        ? $localize`:@@sp.reads_ceiling:A borrowing ceiling, worked out ${this.waysWord(ways)}:ways:`
        : $localize`:@@sp.reads_income:An assumed income, worked out ${this.waysWord(ways)}:ways:`;
    }

    // The label is already a complete phrase, so it stands alone — "Reads By Academic rank"
    // reads as a typo.
    return incomeMethodLabel(p.strategy as IncomeAssumptionStrategy, this.facts());
  }

  /**
   * "one way" / "two ways" / "4 ways".
   *
   * Spelled out to three because a numeral inside a sentence at that size reads as a figure
   * the bank stated, and this is a count of shapes; past three the numeral is the clearer
   * half. Arabic has its own plural rules and its own translation of each of these, which is
   * why each is a separate message rather than a number substituted into one.
   */
  protected waysWord(count: number): string {
    if (count === 1) return $localize`:@@sp.ways_1:one way`;
    if (count === 2) return $localize`:@@sp.ways_2:two ways`;
    if (count === 3) return $localize`:@@sp.ways_3:three ways`;
    return $localize`:@@sp.ways_n:${count}:count: ways`;
  }

  /**
   * Programs only, never banks. A program is filed under a NAME and reaches the product
   * through it, so the sum is exact; banks are not, because one bank selling two names under
   * one product would be counted twice and there is no per-bank identity here to fold on.
   */
  protected productUsageLabel(c: ProductCard): string {
    return $localize`:@@program_catalog.product.usage:${c.programs}:PROGRAMS: programs quote from this`;
  }

  protected productMissingLabel(c: ProductCard): string {
    return $localize`:@@program_catalog.card.no_table:${c.missingTables}:COUNT: with no table yet`;
  }

  protected openProductLabel(c: ProductCard): string {
    return $localize`:@@program_catalog.product.open:Set up ${this.productName(c)}:NAME:`;
  }
}
