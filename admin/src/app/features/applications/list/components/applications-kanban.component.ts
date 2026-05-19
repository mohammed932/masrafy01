import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  AlertOutline,
  ClockCircleOutline,
  UserOutline,
} from '@ant-design/icons-angular/icons';
import type { AdminApplicationRow, LeadStatus } from '../../api/applications.api.service';
import { ApprovalPillComponent } from './approval-pill.component';

export interface KanbanTransition {
  application: AdminApplicationRow;
  from: LeadStatus;
  to: LeadStatus;
}

interface ColumnDef {
  status: LeadStatus;
  label: string;
  helper: string;
}

const STAGES: readonly LeadStatus[] = [
  'needs_first_contact',
  'document_collection',
  'ready_for_submission',
  'submitted_to_bank',
  'bank_decided',
];

@Component({
  selector: 'app-applications-kanban',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    NzIconModule,
    ApprovalPillComponent,
  ],
  providers: [
    provideNzIconsPatch([AlertOutline, ClockCircleOutline, UserOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board" cdkDropListGroup>
      @for (col of columns; track col.status) {
        <section
          class="column"
          [attr.data-status]="col.status"
          cdkDropList
          [cdkDropListData]="rowsByStatus()[col.status]"
          [cdkDropListConnectedTo]="connectedColumnIds(col.status)"
          [id]="'col-' + col.status"
          (cdkDropListDropped)="onDrop($event, col.status)"
        >
          <header class="col-head">
            <div class="col-title">
              <span class="col-name">{{ col.label }}</span>
              <span class="col-count tabular">{{ rowsByStatus()[col.status].length }}</span>
            </div>
            <p class="col-helper">{{ col.helper }}</p>
            <span class="col-total tabular">{{ totalEgp(col.status) }}</span>
          </header>

          <ul class="cards" role="list">
            @for (app of rowsByStatus()[col.status]; track app.id) {
              <li
                class="card"
                cdkDrag
                [cdkDragData]="app"
                [class.stale]="app.isStale"
                [class.followup]="app.hasOverdueFollowUp"
              >
                <div class="card-preview" *cdkDragPreview>
                  <span class="preview-amount tabular">{{ formatEgp(app.requestedAmountEGP) }}</span>
                  <span class="preview-purpose">{{ formatPurpose(app.loanPurpose) }}</span>
                </div>
                <div class="card-placeholder" *cdkDragPlaceholder></div>

                <a
                  class="card-body"
                  [routerLink]="['/applications', app.id]"
                  (click)="$event.stopPropagation()"
                >
                  <header class="card-head">
                    <span class="amount tabular">{{ formatEgp(app.requestedAmountEGP) }}</span>
                    @if (app.bestOffer) {
                      <app-approval-pill [bestOffer]="app.bestOffer" />
                    } @else {
                      <span class="pill no-match" i18n="@@applications.noMatch">No matches</span>
                    }
                  </header>

                  <div class="meta">
                    <span class="purpose">{{ formatPurpose(app.loanPurpose) }}</span>
                    @if (app.assignedAgent) {
                      <span class="agent">
                        <span nz-icon nzType="user" nzTheme="outline" class="agent-icon"></span>
                        {{ app.assignedAgent.name }}
                      </span>
                    }
                  </div>

                  <div class="flags">
                    @if (app.isStale) {
                      <span class="flag stale-flag">
                        <span nz-icon nzType="alert" nzTheme="outline"></span>
                        <span i18n="@@applications.stale">Stale</span>
                      </span>
                    }
                    @if (app.hasOverdueFollowUp) {
                      <span class="flag followup-flag">
                        <span nz-icon nzType="clock-circle" nzTheme="outline"></span>
                        <span i18n="@@applications.followup.overdue">Follow-up due</span>
                      </span>
                    }
                  </div>

                  <footer class="card-foot">
                    <time class="created" [dateTime]="app.createdAt">
                      {{ daysInStage(app) }}
                    </time>
                  </footer>
                </a>
              </li>
            }

            @if (rowsByStatus()[col.status].length === 0) {
              <li class="empty-state">
                <p i18n="@@kanban.empty">No leads here. Drag a card to move it into this stage.</p>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .board {
        display: grid;
        grid-template-columns: repeat(5, minmax(240px, 1fr));
        gap: var(--space-3);
        overflow-x: auto;
        padding-block-end: var(--space-3);
      }

      .column {
        display: flex;
        flex-direction: column;
        min-block-size: 480px;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
        min-inline-size: 240px;
      }
      .column[data-status='bank_decided'] {
        background: color-mix(in oklab, var(--success) 4%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--success) 25%, var(--border-default));
      }
      .column[data-status='needs_first_contact'] {
        background: color-mix(in oklab, var(--warning) 4%, var(--bg-subtle));
      }

      .col-head {
        position: sticky;
        inset-block-start: 0;
        z-index: 1;
        padding: var(--space-3) var(--space-4);
        background: inherit;
        border-block-end: 1px solid var(--border-default);
      }
      .col-title {
        display: flex; align-items: baseline; gap: var(--space-2);
        justify-content: space-between;
      }
      .col-name {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-primary);
      }
      .col-count {
        display: inline-flex; align-items: center; justify-content: center;
        min-inline-size: 22px;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: 11px;
        font-weight: 700;
        background: var(--bg-surface);
        color: var(--text-secondary);
        border: 1px solid var(--border-default);
      }
      .col-helper {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--text-tertiary);
        line-height: 1.3;
      }
      .col-total {
        display: block;
        margin-block-start: 4px;
        font-size: 12px;
        font-weight: 700;
        color: var(--accent);
        letter-spacing: -0.01em;
      }

      .cards {
        list-style: none;
        margin: 0;
        padding: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        flex: 1;
        min-block-size: 100px;
      }

      .card {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        list-style: none;
        cursor: grab;
        transition: box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1),
          transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .card:active { cursor: grabbing; }
      .card:hover {
        box-shadow: 0 2px 8px color-mix(in oklab, var(--text-primary) 10%, transparent);
      }
      .card.stale { box-shadow: inset 3px 0 0 0 var(--error); }
      .card.followup:not(.stale) { box-shadow: inset 3px 0 0 0 var(--warning); }

      .card-body {
        display: block;
        padding: var(--space-3);
        color: inherit;
        text-decoration: none;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: 6px;
      }
      .amount {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }
      .pill.no-match {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-tertiary);
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
        color: var(--text-secondary);
      }
      .purpose { text-transform: capitalize; }
      .agent {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--text-tertiary);
      }
      .agent-icon { font-size: 11px; }

      .flags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-block: 6px 0;
      }
      .flag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: var(--radius-pill);
      }
      .stale-flag {
        background: color-mix(in oklab, var(--error) 14%, transparent);
        color: var(--error);
      }
      .followup-flag {
        background: color-mix(in oklab, var(--warning) 14%, transparent);
        color: var(--warning);
      }

      .card-foot {
        margin-block-start: 6px;
        padding-block-start: 6px;
        border-block-start: 1px solid var(--border-subtle, var(--border-default));
      }
      .created {
        font-size: 11px;
        color: var(--text-tertiary);
      }

      .empty-state {
        list-style: none;
        padding: var(--space-4) var(--space-3);
        text-align: center;
        font-size: 12px;
        color: var(--text-tertiary);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
      }

      .tabular { font-variant-numeric: tabular-nums lining-nums; }

      /* CDK drag preview / placeholder */
      .card-preview {
        padding: var(--space-2) var(--space-3);
        background: var(--bg-surface);
        border: 1px solid var(--primary);
        border-radius: var(--radius-md);
        box-shadow: 0 6px 18px color-mix(in oklab, var(--primary) 24%, transparent);
        display: inline-flex; align-items: center; gap: var(--space-2);
        font-size: 13px;
        font-weight: 700;
      }
      .preview-amount { color: var(--text-primary); }
      .preview-purpose { color: var(--text-tertiary); font-weight: 500; }
      .card-placeholder {
        block-size: 48px;
        background: color-mix(in oklab, var(--primary) 8%, transparent);
        border: 1px dashed color-mix(in oklab, var(--primary) 50%, transparent);
        border-radius: var(--radius-md);
        margin: 0;
      }

      :host ::ng-deep .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host ::ng-deep .cdk-drop-list-dragging .card:not(.cdk-drag-placeholder) {
        transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      @media (max-width: 1200px) {
        .board { grid-template-columns: repeat(5, 280px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .card, :host ::ng-deep .cdk-drag-animating { transition: none !important; }
      }
    `,
  ],
})
export class ApplicationsKanbanComponent {
  readonly rows = input.required<readonly AdminApplicationRow[]>();

  readonly transitionRequested = output<KanbanTransition>();

  protected readonly columns: readonly ColumnDef[] = [
    {
      status: 'needs_first_contact',
      label: $localize`:@@kanban.col.needsFirstContact:Needs first contact`,
      helper: $localize`:@@kanban.col.needsFirstContact.helper:Brand new leads. Call within 5 minutes.`,
    },
    {
      status: 'document_collection',
      label: $localize`:@@kanban.col.docCollection:Document collection`,
      helper: $localize`:@@kanban.col.docCollection.helper:Gathering salary slip, ID, bank statements.`,
    },
    {
      status: 'ready_for_submission',
      label: $localize`:@@kanban.col.readyForSubmission:Ready for submission`,
      helper: $localize`:@@kanban.col.readyForSubmission.helper:Docs reviewed. Pick a bank to submit.`,
    },
    {
      status: 'submitted_to_bank',
      label: $localize`:@@kanban.col.submittedToBank:Submitted to bank`,
      helper: $localize`:@@kanban.col.submittedToBank.helper:Bank package out. Waiting on decision.`,
    },
    {
      status: 'bank_decided',
      label: $localize`:@@kanban.col.bankDecided:Bank decided`,
      helper: $localize`:@@kanban.col.bankDecided.helper:Approved, rejected, or counter-offered.`,
    },
  ];

  protected readonly rowsByStatus = computed<Record<LeadStatus, AdminApplicationRow[]>>(() => {
    const empty: Record<LeadStatus, AdminApplicationRow[]> = {
      needs_first_contact: [],
      document_collection: [],
      ready_for_submission: [],
      submitted_to_bank: [],
      bank_decided: [],
    };
    for (const r of this.rows()) {
      const s = r.leadStatus ?? 'needs_first_contact';
      empty[s].push(r);
    }
    return empty;
  });

  protected connectedColumnIds(status: LeadStatus): string[] {
    const idx = STAGES.indexOf(status);
    if (idx < 0) return [];
    const next = STAGES[idx + 1];
    return next ? [`col-${next}`] : [];
  }

  protected onDrop(event: CdkDragDrop<AdminApplicationRow[]>, toStatus: LeadStatus): void {
    if (event.previousContainer === event.container) return;
    const app = event.item.data as AdminApplicationRow;
    const from = app.leadStatus ?? 'needs_first_contact';
    if (from === toStatus) return;
    const fromIdx = STAGES.indexOf(from);
    const toIdx = STAGES.indexOf(toStatus);
    // forward-only
    if (toIdx !== fromIdx + 1) return;
    this.transitionRequested.emit({ application: app, from, to: toStatus });
  }

  protected totalEgp(status: LeadStatus): string {
    const total = this.rowsByStatus()[status].reduce(
      (acc, r) => acc + Number(r.requestedAmountEGP || 0),
      0,
    );
    return this.formatEgp(total.toString());
  }

  protected formatEgp(v: string): string {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.0+$/, '')}M EGP`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
    return `${Math.round(n)} EGP`;
  }

  protected formatPurpose(p: string): string {
    return p.replace(/_/g, ' ');
  }

  protected daysInStage(app: AdminApplicationRow): string {
    const ref = app.lastActivity?.occurredAt ?? app.createdAt;
    const days = Math.floor((Date.now() - Date.parse(ref)) / (1000 * 60 * 60 * 24));
    if (days <= 0) return $localize`:@@kanban.card.today:today`;
    if (days === 1) return $localize`:@@kanban.card.dayAgo:1 day ago`;
    return $localize`:@@kanban.card.daysAgo:${days} days ago`;
  }
}
