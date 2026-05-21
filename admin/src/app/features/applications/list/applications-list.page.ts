import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  RightOutline,
  UnorderedListOutline,
  AppstoreOutline,
  SearchOutline,
  FireOutline,
  ClockCircleOutline,
  UserOutline,
  AlertOutline,
  FilterOutline,
} from '@ant-design/icons-angular/icons';
import { ApplicationsKanbanComponent, type KanbanTransition } from './components/applications-kanban.component';
import { AddActivityDialog, type AddActivityDialogData } from '../detail/components/add-activity.dialog';
import { ACTIVITY_REASONS } from '../activity-reasons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  type StatStripItem,
} from '@shared/ui';
import {
  ApplicationsApiService,
  type AdminApplicationRow,
  type LeadStatus,
} from '../api/applications.api.service';
import { ApprovalPillComponent, type ApprovalTier } from './components/approval-pill.component';
import {
  TierFilterChipsComponent,
  type TierFilter,
} from './components/tier-filter-chips.component';
import { type LeadFilter } from './components/lead-filter-chips.component';

interface StageDef {
  key: LeadStatus | 'all';
  label: string;
  helper: string;
}

const STAGE_FUNNEL: readonly StageDef[] = [
  { key: 'all', label: $localize`:@@apps.stage.all:All stages`, helper: $localize`:@@apps.stage.all.h:Every lead in view` },
  { key: 'needs_first_contact', label: $localize`:@@apps.stage.first:First contact`, helper: $localize`:@@apps.stage.first.h:Awaiting agent call` },
  { key: 'document_collection', label: $localize`:@@apps.stage.docs:Documents`, helper: $localize`:@@apps.stage.docs.h:Collecting paperwork` },
  { key: 'ready_for_submission', label: $localize`:@@apps.stage.ready:Ready for bank`, helper: $localize`:@@apps.stage.ready.h:Reviewed, awaiting send` },
  { key: 'submitted_to_bank', label: $localize`:@@apps.stage.submitted:With bank`, helper: $localize`:@@apps.stage.submitted.h:Bank decision pending` },
  { key: 'bank_decided', label: $localize`:@@apps.stage.decided:Bank decided`, helper: $localize`:@@apps.stage.decided.h:Outcome recorded` },
];

@Component({
  selector: 'app-applications-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    NzTableModule,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
    ApprovalPillComponent,
    TierFilterChipsComponent,
    PageHeaderComponent,
    StatStripComponent,
    SkeletonRowsComponent,
    ApplicationsKanbanComponent,
  ],
  providers: [
    provideNzIconsPatch([
      RightOutline,
      UnorderedListOutline,
      AppstoreOutline,
      SearchOutline,
      FireOutline,
      ClockCircleOutline,
      UserOutline,
      AlertOutline,
      FilterOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      <div class="toolbar">
        <div class="search">
          <span nz-icon nzType="search" nzTheme="outline" class="search-icon" aria-hidden="true"></span>
          <input
            nz-input
            type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            [placeholder]="searchPlaceholder"
            [attr.aria-label]="searchPlaceholder"
          />
        </div>

        <div class="toolbar-end">
          <button
            type="button"
            class="attention"
            [class.active]="attentionOn()"
            [attr.aria-pressed]="attentionOn()"
            (click)="toggleAttention()"
          >
            <span nz-icon nzType="fire" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@apps.attention.toggle">Needs attention</span>
            <span class="attention-count tabular">{{ attentionCount() }}</span>
          </button>

          <div class="view-toggle" role="radiogroup" [attr.aria-label]="viewToggleAria">
            <button
              type="button"
              class="view-seg"
              role="radio"
              [class.active]="view() === 'list'"
              [attr.aria-checked]="view() === 'list'"
              (click)="view.set('list')"
              [attr.aria-label]="listViewLabel"
            >
              <span nz-icon nzType="unordered-list" nzTheme="outline" aria-hidden="true"></span>
            </button>
            <button
              type="button"
              class="view-seg"
              role="radio"
              [class.active]="view() === 'kanban'"
              [attr.aria-checked]="view() === 'kanban'"
              (click)="view.set('kanban')"
              [attr.aria-label]="kanbanViewLabel"
            >
              <span nz-icon nzType="appstore" nzTheme="outline" aria-hidden="true"></span>
            </button>
          </div>
        </div>
      </div>

      <app-tier-filter-chips
        [selected]="selectedTier()"
        [counts]="counts()"
        (filterChange)="onTierFilterChange($event)"
      />

      <nav class="funnel" [attr.aria-label]="funnelAria">
        @for (s of stages; track s.key; let last = $last) {
          <button
            type="button"
            class="funnel-step"
            [class.active]="effectiveStage() === s.key"
            [attr.aria-pressed]="effectiveStage() === s.key"
            (click)="onStageClick(s.key)"
          >
            <span class="funnel-label">{{ s.label }}</span>
            <span class="funnel-count tabular">{{ stageCount(s.key) }}</span>
          </button>
          @if (!last) {
            <span class="funnel-arrow" aria-hidden="true">›</span>
          }
        }
      </nav>

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[2, 1, 1, 1, 1]" />
      }

      @if (!loading() && filteredRows().length === 0) {
        <div class="empty">
          <p i18n="@@applications.empty.title">No leads match your filters</p>
          <p class="muted" i18n="@@applications.empty.subtitle">
            Clear a filter or wait for new applications.
          </p>
        </div>
      } @else if (view() === 'kanban') {
        <app-applications-kanban
          [rows]="filteredRowsArray()"
          (transitionRequested)="onTransition($event)"
        />
      } @else {
        <div class="table-wrap">
          <nz-table
            #t
            [nzData]="filteredRowsArray()"
            [nzShowPagination]="false"
            [nzFrontPagination]="false"
            class="applications-table"
            nzSize="middle"
          >
            <thead>
              <tr>
                <th i18n="@@applications.col.applicant">Applicant</th>
                <th i18n="@@applications.col.loan">Loan</th>
                <th i18n="@@applications.col.probability">Probability</th>
                <th i18n="@@applications.col.stage">Stage · Age</th>
                <th i18n="@@applications.col.owner">Owner</th>
                <th class="actions-th" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of t.data; track row.id) {
                <tr
                  class="applications-row"
                  tabindex="0"
                  role="link"
                  [attr.data-urgency]="urgencyFor(row)"
                  [attr.aria-label]="detailAriaLabel(row.id)"
                  (click)="openDetail(row.id)"
                  (keydown.enter)="openDetail(row.id)"
                  (keydown.space)="openDetail(row.id, $event)"
                >
                  <td>
                    <div class="applicant">
                      <span class="avatar" aria-hidden="true">{{ initials(row) }}</span>
                      <div class="applicant-meta">
                        <span class="applicant-name">{{ applicantName(row) }}</span>
                        <span class="applicant-id tabular">#{{ shortId(row.id) }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="loan">
                      <span class="loan-amount tabular">{{ formatAmount(row.requestedAmountEGP) }}</span>
                      <span class="loan-purpose">{{ purposeLabel(row.loanPurpose) }}</span>
                    </div>
                  </td>
                  <td>
                    <app-approval-pill [bestOffer]="row.bestOffer" />
                  </td>
                  <td>
                    <div class="stage">
                      <span class="stage-chip" [attr.data-stage]="stageDataAttr(row)">
                        {{ stageLabel(row.leadStatus, row.selectedOfferDecision ?? null) }}
                      </span>
                      <span class="stage-age" [attr.data-tone]="ageToneFor(row)">
                        <span nz-icon nzType="clock-circle" nzTheme="outline" aria-hidden="true"></span>
                        {{ relativeAge(row) }}
                      </span>
                    </div>
                  </td>
                  <td>
                    @if (row.assignedAgent; as a) {
                      <div class="owner">
                        <span class="owner-avatar" aria-hidden="true">{{ agentInitials(a.name) }}</span>
                        <span class="owner-name">{{ a.name }}</span>
                      </div>
                    } @else {
                      <span class="owner-unassigned" i18n="@@apps.owner.unassigned">
                        <span nz-icon nzType="alert" nzTheme="outline" aria-hidden="true"></span>
                        Unassigned
                      </span>
                    }
                  </td>
                  <td class="actions-cell">
                    <a
                      nz-button
                      nzType="text"
                      nzShape="circle"
                      [routerLink]="['/applications', row.id]"
                      [attr.aria-label]="detailAriaLabel(row.id)"
                      (click)="$event.stopPropagation()"
                    >
                      <span nz-icon nzType="right" nzTheme="outline"></span>
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-5) var(--space-6);
      }

      /* ---------- toolbar ---------- */
      .toolbar {
        display: flex;
        gap: var(--space-3);
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      .search {
        position: relative;
        flex: 1 1 280px;
        max-inline-size: 360px;
        display: flex;
        align-items: center;
      }
      .search input {
        padding-inline-start: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
      }
      .search-icon {
        position: absolute;
        inset-inline-start: 12px;
        color: var(--text-tertiary);
        pointer-events: none;
      }

      .toolbar-end {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .attention {
        appearance: none;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        color: var(--text-secondary);
        cursor: pointer;
        padding: 7px 14px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font: 600 13px/1 var(--font-sans);
        transition: background 140ms cubic-bezier(0.4, 0, 0.2, 1),
                    color 140ms cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .attention:hover:not(.active) {
        color: var(--text-primary);
        border-color: var(--border-strong, var(--border-default));
      }
      .attention.active {
        background: color-mix(in oklab, var(--error) 12%, transparent);
        color: var(--error);
        border-color: color-mix(in oklab, var(--error) 35%, transparent);
      }
      .attention-count {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: var(--radius-pill);
        background: var(--bg-subtle);
        color: var(--text-secondary);
      }
      .attention.active .attention-count {
        background: var(--error);
        color: var(--text-on-primary, #fff);
      }

      .view-toggle {
        display: inline-flex;
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        padding: 3px;
        border-radius: var(--radius-pill);
        gap: 2px;
      }
      .view-seg {
        appearance: none;
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 6px 12px;
        font-size: 13px;
        color: var(--text-secondary);
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        transition: background 140ms cubic-bezier(0.4, 0, 0.2, 1),
                    color 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .view-seg:hover:not(.active) { color: var(--text-primary); }
      .view-seg.active {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .view-seg:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }

      /* ---------- stage funnel ---------- */
      .funnel {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        padding: 6px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        align-self: flex-start;
      }
      .funnel-step {
        appearance: none;
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--text-secondary);
        font: 600 12px/1 var(--font-sans);
        letter-spacing: 0.01em;
        transition: background 140ms cubic-bezier(0.4, 0, 0.2, 1),
                    color 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .funnel-step:hover:not(.active) { color: var(--text-primary); }
      .funnel-step.active {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .funnel-step:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      .funnel-count {
        font-size: 11px;
        font-weight: 700;
        padding: 1px 7px;
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .funnel-step.active .funnel-count {
        background: color-mix(in oklab, var(--text-on-primary, #fff) 22%, transparent);
        color: var(--text-on-primary, #fff);
      }
      .funnel-arrow {
        color: var(--text-tertiary);
        font-size: 14px;
        line-height: 1;
        padding-inline: 2px;
        user-select: none;
      }

      /* ---------- table ---------- */
      .table-wrap {
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
        overflow: hidden;
      }
      .applications-table {
        width: 100%;
      }
      .applications-table :where(th) {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-tertiary);
      }
      .actions-th { inline-size: 48px; }
      .tabular {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }
      .muted { color: var(--text-tertiary); }

      .applications-row {
        cursor: pointer;
        position: relative;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .applications-row > td:first-child {
        border-inline-start: 3px solid transparent;
        padding-inline-start: 12px;
      }
      .applications-row[data-urgency='stale'] > td:first-child {
        border-inline-start-color: var(--error);
      }
      .applications-row[data-urgency='overdue'] > td:first-child {
        border-inline-start-color: var(--warning);
      }
      .applications-row[data-urgency='cold'] > td:first-child {
        border-inline-start-color: color-mix(in oklab, var(--warning) 60%, transparent);
      }
      .applications-row[data-urgency='hot'] > td:first-child {
        border-inline-start-color: var(--success);
      }
      .applications-row:hover {
        background: var(--bg-subtle);
      }
      .applications-row:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
      }

      /* applicant cell */
      .applicant {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .avatar {
        inline-size: 32px;
        block-size: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        background: color-mix(in oklab, var(--primary) 12%, transparent);
        color: var(--primary);
        letter-spacing: 0.04em;
        flex-shrink: 0;
      }
      .applicant-meta { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
      .applicant-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .applicant-id {
        font-size: 11px;
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
        font-family: var(--font-mono, var(--font-sans));
      }

      /* loan cell */
      .loan { display: flex; flex-direction: column; gap: 2px; }
      .loan-amount {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.005em;
      }
      .loan-purpose {
        font-size: 11px;
        color: var(--text-tertiary);
        text-transform: capitalize;
      }

      /* stage cell */
      .stage { display: flex; flex-direction: column; gap: 4px; }
      .stage-chip {
        display: inline-flex;
        align-items: center;
        padding: 3px 9px;
        border-radius: var(--radius-pill);
        font: 700 10px/1 var(--font-sans);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: var(--bg-subtle);
        color: var(--text-secondary);
        align-self: flex-start;
        white-space: nowrap;
      }
      .stage-chip[data-stage='needs_first_contact'] {
        background: color-mix(in oklab, var(--warning) 14%, transparent);
        color: var(--warning);
      }
      .stage-chip[data-stage='document_collection'] {
        background: color-mix(in oklab, var(--info, var(--accent)) 14%, transparent);
        color: var(--info, var(--accent));
      }
      .stage-chip[data-stage='ready_for_submission'] {
        background: color-mix(in oklab, var(--primary) 12%, transparent);
        color: var(--primary);
      }
      .stage-chip[data-stage='submitted_to_bank'] {
        background: color-mix(in oklab, var(--accent) 16%, transparent);
        color: var(--accent);
      }
      .stage-chip[data-stage='bank_decided'],
      .stage-chip[data-stage='approved'] {
        background: color-mix(in oklab, var(--success) 14%, transparent);
        color: var(--success);
      }
      .stage-chip[data-stage='rejected'] {
        background: color-mix(in oklab, var(--error) 14%, transparent);
        color: var(--error);
      }
      .stage-chip[data-stage='withdrawn'] {
        background: color-mix(in oklab, var(--text-tertiary) 16%, transparent);
        color: var(--text-secondary);
      }

      .stage-age {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .stage-age[data-tone='stale'] { color: var(--error); font-weight: 600; }
      .stage-age[data-tone='cold']  { color: var(--warning); font-weight: 600; }

      /* owner cell */
      .owner { display: inline-flex; align-items: center; gap: 8px; }
      .owner-avatar {
        inline-size: 24px;
        block-size: 24px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in oklab, var(--accent) 16%, transparent);
        color: var(--accent);
        font-size: 10px;
        font-weight: 700;
      }
      .owner-name {
        font-size: 12px;
        color: var(--text-primary);
      }
      .owner-unassigned {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 600;
        color: var(--warning);
      }

      .actions-cell { text-align: end; }

      .empty {
        padding: var(--space-8) var(--space-6);
        text-align: center;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        border: 1px dashed var(--border-default);
      }
      .empty p { margin: 0 0 var(--space-2); font-size: 15px; color: var(--text-primary); }
      .empty .muted { font-size: 13px; }

      @media (prefers-reduced-motion: reduce) {
        .attention, .view-seg, .funnel-step, .applications-row { transition: none !important; }
      }

      @media (max-width: 720px) {
        .toolbar { flex-direction: column; align-items: stretch; }
        .toolbar-end { justify-content: space-between; }
        .search { max-inline-size: 100%; }
      }
    `,
  ],
})
export class ApplicationsListPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modal = inject(NzModalService);

  protected readonly titleText = $localize`:@@applications.title:Applications`;
  protected readonly subtitleText = $localize`:@@applications.subtitle:Triage leads by approval probability, workflow stage, and urgency.`;
  protected readonly statAriaLabel = $localize`:@@applications.stat.aria:Application totals`;
  protected readonly viewToggleAria = $localize`:@@applications.view.aria:Switch between list and Kanban view`;
  protected readonly listViewLabel = $localize`:@@applications.view.list:List`;
  protected readonly kanbanViewLabel = $localize`:@@applications.view.kanban:Kanban`;
  protected readonly searchPlaceholder = $localize`:@@apps.search.placeholder:Search by applicant or ID`;
  protected readonly funnelAria = $localize`:@@apps.funnel.aria:Filter by workflow stage`;

  protected readonly stages = STAGE_FUNNEL;

  protected readonly rows = signal<readonly AdminApplicationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedTier = signal<TierFilter>(null);
  protected readonly selectedStage = signal<LeadStatus | 'all'>('all');
  protected readonly attentionOn = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly view = signal<'list' | 'kanban'>('list');

  protected readonly effectiveStage = computed<LeadStatus | 'all'>(() =>
    this.attentionOn() ? 'all' : this.selectedStage(),
  );

  protected readonly filteredRows = computed<readonly AdminApplicationRow[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const stage = this.selectedStage();
    const attention = this.attentionOn();
    return this.rows().filter((r) => {
      if (attention) {
        const urgent =
          r.isStale === true ||
          r.hasOverdueFollowUp === true ||
          r.leadStatus === 'needs_first_contact';
        if (!urgent) return false;
      } else if (stage !== 'all') {
        if (r.leadStatus !== stage) return false;
      }
      if (q.length > 0) {
        const name = this.applicantName(r).toLowerCase();
        if (!name.includes(q) && !r.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  });

  protected filteredRowsArray(): AdminApplicationRow[] {
    return [...this.filteredRows()];
  }

  protected readonly counts = computed(() => {
    const r = this.rows();
    return {
      high: r.filter((x) => x.bestOffer?.tier === 'excellent').length,
      medium: r.filter((x) => x.bestOffer?.tier === 'good').length,
      needs_coaching: r.filter(
        (x) =>
          x.status === 'no_match' ||
          (x.bestOffer &&
            (['moderate', 'low', 'very_low'] as ApprovalTier[]).includes(x.bestOffer.tier)),
      ).length,
    };
  });

  protected readonly attentionCount = computed(() => {
    return this.rows().filter(
      (r) =>
        r.isStale === true ||
        r.hasOverdueFollowUp === true ||
        r.leadStatus === 'needs_first_contact',
    ).length;
  });

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const r = this.rows();
    const unassigned = r.filter((x) => !x.assignedAgent).length;
    const stale = r.filter((x) => x.isStale === true).length;
    const withBank = r.filter((x) => x.leadStatus === 'submitted_to_bank').length;
    return [
      { label: $localize`:@@applications.stat.total:Total in view`, value: r.length },
      { label: $localize`:@@applications.stat.unassigned:Unassigned`, value: unassigned, tone: unassigned > 0 ? 'warning' : 'muted' },
      { label: $localize`:@@applications.stat.stale:Stale (no activity >7d)`, value: stale, tone: stale > 0 ? 'error' : 'muted' },
      { label: $localize`:@@applications.stat.withBank:With bank`, value: withBank, tone: withBank > 0 ? 'success' : 'muted' },
    ];
  });

  protected stageCount(key: LeadStatus | 'all'): number {
    if (key === 'all') return this.rows().length;
    return this.rows().filter((r) => r.leadStatus === key).length;
  }

  async ngOnInit(): Promise<void> {
    const tierParam = this.route.snapshot.queryParamMap.get('tier');
    if (tierParam === 'high' || tierParam === 'medium' || tierParam === 'needs_coaching') {
      this.selectedTier.set(tierParam);
    }
    const stageParam = this.route.snapshot.queryParamMap.get('stage');
    if (this.isValidStage(stageParam)) {
      this.selectedStage.set(stageParam);
    }
    if (this.route.snapshot.queryParamMap.get('attention') === '1') {
      this.attentionOn.set(true);
    }
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.searchQuery.set(q);
    await this.reload();
  }

  protected onTierFilterChange(next: TierFilter): void {
    this.selectedTier.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tier: next ?? null },
      queryParamsHandling: 'merge',
    });
    void this.reload();
  }

  protected onStageClick(key: LeadStatus | 'all'): void {
    if (this.attentionOn()) this.attentionOn.set(false);
    const next = this.selectedStage() === key ? 'all' : key;
    this.selectedStage.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { stage: next === 'all' ? null : next, attention: null },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleAttention(): void {
    const next = !this.attentionOn();
    this.attentionOn.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { attention: next ? '1' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected detailAriaLabel(id: string): string {
    return $localize`:@@applications.action.detail:Open application ${id}`;
  }

  protected openDetail(id: string, ev?: Event): void {
    if (ev) ev.preventDefault();
    void this.router.navigate(['/applications', id]);
  }

  protected applicantName(row: AdminApplicationRow): string {
    const masked = row.maskedApplicant as { alias?: string; nationalId?: string };
    if (masked.alias) return masked.alias;
    return $localize`:@@apps.applicant.anonymous:Applicant`;
  }

  protected initials(row: AdminApplicationRow): string {
    const name = this.applicantName(row);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }

  protected agentInitials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }

  protected shortId(id: string): string {
    return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
  }

  protected formatAmount(raw: string): string {
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return `${raw} EGP`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M EGP`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
    return `${n.toFixed(0)} EGP`;
  }

  protected purposeLabel(p: string): string {
    // Constitution v1.6.0 / Principle II scope-lock: 3 categories only.
    switch (p) {
      case 'personal':
        return $localize`:@@apps.purpose.personal:Personal`;
      case 'car':
        return $localize`:@@apps.purpose.car:Car`;
      case 'mortgage':
        return $localize`:@@apps.purpose.mortgage:Mortgage`;
      default:
        return p.replace(/_/g, ' ');
    }
  }

  protected stageLabel(
    s: LeadStatus | undefined,
    decision: 'approved' | 'rejected' | 'withdrawn' | null,
  ): string {
    switch (s) {
      case 'needs_first_contact':
        return $localize`:@@apps.stage.first.short:First contact`;
      case 'document_collection':
        return $localize`:@@apps.stage.docs.short:Documents`;
      case 'ready_for_submission':
        return $localize`:@@apps.stage.ready.short:Ready`;
      case 'submitted_to_bank':
        return $localize`:@@apps.stage.submitted.short:With bank`;
      case 'bank_decided':
        if (decision === 'approved') return $localize`:@@apps.stage.decided.approved:Approved`;
        if (decision === 'rejected') return $localize`:@@apps.stage.decided.rejected:Rejected`;
        if (decision === 'withdrawn') return $localize`:@@apps.stage.decided.withdrawn:Withdrawn`;
        return $localize`:@@apps.stage.decided.short:Decided`;
      default:
        return $localize`:@@apps.stage.unknown:Unknown`;
    }
  }

  protected stageDataAttr(row: AdminApplicationRow): string {
    if (row.leadStatus === 'bank_decided' && row.selectedOfferDecision) {
      return row.selectedOfferDecision;
    }
    return row.leadStatus ?? 'unknown';
  }

  protected relativeAge(row: AdminApplicationRow): string {
    const ref = row.lastActivity?.occurredAt ?? row.createdAt;
    const ms = Date.now() - new Date(ref).getTime();
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.floor(ms / 60_000);
    if (days >= 1) return $localize`:@@apps.age.days:${days}d ago`;
    if (hours >= 1) return $localize`:@@apps.age.hours:${hours}h ago`;
    if (mins >= 1) return $localize`:@@apps.age.mins:${mins}m ago`;
    return $localize`:@@apps.age.now:just now`;
  }

  protected ageToneFor(row: AdminApplicationRow): 'stale' | 'cold' | 'warm' {
    if (row.isStale === true) return 'stale';
    const ref = row.lastActivity?.occurredAt ?? row.createdAt;
    const days = (Date.now() - new Date(ref).getTime()) / 86_400_000;
    if (days >= 3) return 'cold';
    return 'warm';
  }

  protected urgencyFor(row: AdminApplicationRow): 'stale' | 'overdue' | 'cold' | 'hot' | 'none' {
    if (row.isStale === true) return 'stale';
    if (row.hasOverdueFollowUp === true) return 'overdue';
    if (row.leadStatus === 'bank_decided') return 'hot';
    const ref = row.lastActivity?.occurredAt ?? row.createdAt;
    const days = (Date.now() - new Date(ref).getTime()) / 86_400_000;
    if (days >= 3 && row.leadStatus !== 'submitted_to_bank') return 'cold';
    return 'none';
  }

  protected onTransition(t: KanbanTransition): void {
    const seed = this.activityForTransition(t.to);
    if (!seed) return;
    const ref = this.modal.create<AddActivityDialog, AddActivityDialogData, boolean>({
      nzContent: AddActivityDialog,
      nzData: {
        applicationId: t.application.id,
        defaultActivityType: seed,
        reasonsByType: ACTIVITY_REASONS,
      },
      nzFooter: null,
      nzWidth: 720,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((saved) => {
      if (saved) void this.reload();
    });
  }

  private activityForTransition(to: AdminApplicationRow['leadStatus']): string | null {
    switch (to) {
      case 'document_collection':
        return 'CALLED_USER';
      case 'ready_for_submission':
        return 'MARKED_AS_REVIEWED';
      case 'submitted_to_bank':
        return 'SUBMITTED_TO_BANK';
      case 'bank_decided':
        return 'BANK_RESPONDED';
      default:
        return null;
    }
  }

  private isValidStage(v: string | null): v is LeadStatus | 'all' {
    return (
      v === 'all' ||
      v === 'needs_first_contact' ||
      v === 'document_collection' ||
      v === 'ready_for_submission' ||
      v === 'submitted_to_bank' ||
      v === 'bank_decided'
    );
  }

  private legacyLeadFilter(): LeadFilter {
    // Kept to preserve backend filter semantics on /applications?filter=...
    const stage = this.selectedStage();
    if (stage === 'all') return null;
    if (stage === 'needs_first_contact') return 'needs_first_contact';
    if (stage === 'document_collection') return 'docs_in_progress';
    if (stage === 'ready_for_submission') return 'ready_for_submission';
    if (stage === 'submitted_to_bank') return 'submitted_to_bank';
    return null;
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const { rows } = await this.api.list({
        tier: this.selectedTier(),
        leadFilter: this.legacyLeadFilter(),
        limit: 100,
      });
      this.rows.set(rows);
    } finally {
      this.loading.set(false);
    }
  }
}
