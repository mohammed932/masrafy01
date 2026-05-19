import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import {
  AppstoreOutline,
  PhoneOutline,
  MessageOutline,
  PaperClipOutline,
  SettingOutline,
  MailOutline,
  CheckCircleOutline,
  EditOutline,
  SendOutline,
  InboxOutline,
  SnippetsOutline,
  FileDoneOutline,
  FileTextOutline,
  WarningOutline,
  SyncOutline,
  UserSwitchOutline,
  CalendarOutline,
  ClockCircleOutline,
} from '@ant-design/icons-angular/icons';
import { ApplicationsApiService, type ActivityRow } from '../../api/applications.api.service';

type FilterKey = 'all' | 'calls' | 'messages' | 'documents' | 'workflow' | 'notes';

const ICON_BY_TYPE: Record<string, string> = {
  CALLED_USER: 'phone',
  SENT_WHATSAPP: 'message',
  SENT_EMAIL: 'mail',
  RECEIVED_DOCUMENTS: 'paper-clip',
  REVIEWED_DOCUMENTS: 'file-done',
  REQUESTED_MORE_DOCS: 'snippets',
  UPDATED_APPLICANT_INFO: 'edit',
  MARKED_AS_REVIEWED: 'check-circle',
  INTERNAL_NOTE: 'file-text',
  STATUS_CHANGE: 'sync',
  SUBMITTED_TO_BANK: 'send',
  BANK_RESPONDED: 'inbox',
  LEAD_REASSIGNED: 'user-switch',
  STALE_LEAD_FLAGGED: 'warning',
};

const CATEGORY_BY_TYPE: Record<string, FilterKey> = {
  CALLED_USER: 'calls',
  SENT_WHATSAPP: 'messages',
  SENT_EMAIL: 'messages',
  RECEIVED_DOCUMENTS: 'documents',
  REVIEWED_DOCUMENTS: 'documents',
  REQUESTED_MORE_DOCS: 'documents',
  UPDATED_APPLICANT_INFO: 'workflow',
  MARKED_AS_REVIEWED: 'workflow',
  STATUS_CHANGE: 'workflow',
  SUBMITTED_TO_BANK: 'workflow',
  BANK_RESPONDED: 'workflow',
  LEAD_REASSIGNED: 'workflow',
  STALE_LEAD_FLAGGED: 'workflow',
  INTERNAL_NOTE: 'notes',
};

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [CommonModule, DatePipe, NzIconModule, NzButtonModule, NzSpinModule],
  providers: [
    provideNzIconsPatch([
      AppstoreOutline,
      PhoneOutline,
      MessageOutline,
      PaperClipOutline,
      SettingOutline,
      MailOutline,
      CheckCircleOutline,
      EditOutline,
      SendOutline,
      InboxOutline,
      SnippetsOutline,
      FileDoneOutline,
      FileTextOutline,
      WarningOutline,
      SyncOutline,
      UserSwitchOutline,
      CalendarOutline,
      ClockCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="timeline-root">
      <header class="filter-row" role="tablist" aria-label="Activity filter">
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'all'"
          [attr.aria-selected]="filter() === 'all'"
          (click)="setFilter('all')"
        >
          <span nz-icon nzType="appstore" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.all">All</span>
          <span class="filter-count">{{ countFor('all') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'calls'"
          [attr.aria-selected]="filter() === 'calls'"
          (click)="setFilter('calls')"
        >
          <span nz-icon nzType="phone" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.calls">Calls</span>
          <span class="filter-count">{{ countFor('calls') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'messages'"
          [attr.aria-selected]="filter() === 'messages'"
          (click)="setFilter('messages')"
        >
          <span nz-icon nzType="message" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.messages">Messages</span>
          <span class="filter-count">{{ countFor('messages') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'documents'"
          [attr.aria-selected]="filter() === 'documents'"
          (click)="setFilter('documents')"
        >
          <span nz-icon nzType="paper-clip" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.documents">Documents</span>
          <span class="filter-count">{{ countFor('documents') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'workflow'"
          [attr.aria-selected]="filter() === 'workflow'"
          (click)="setFilter('workflow')"
        >
          <span nz-icon nzType="sync" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.workflow">Workflow</span>
          <span class="filter-count">{{ countFor('workflow') }}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.is-active]="filter() === 'notes'"
          [attr.aria-selected]="filter() === 'notes'"
          (click)="setFilter('notes')"
        >
          <span nz-icon nzType="file-text" nzTheme="outline" class="filter-icon" aria-hidden="true"></span>
          <span i18n="@@activity.timeline.filter.notes">Notes</span>
          <span class="filter-count">{{ countFor('notes') }}</span>
        </button>
      </header>

      @if (loading()) {
        <nz-spin nzSimple [nzSize]="'small'"></nz-spin>
      } @else if (visibleRows().length === 0) {
        <p class="empty" i18n="@@activity.timeline.empty">No activity yet.</p>
      } @else {
        <ol class="timeline">
          @for (row of visibleRows(); track row.id) {
            <li class="row" [class.expanded]="expandedId() === row.id">
              <span class="dot" aria-hidden="true" [attr.data-category]="categoryOf(row)">
                <span nz-icon [nzType]="iconFor(row.activityType)" nzTheme="outline"></span>
              </span>
              <button
                type="button"
                class="row-body"
                (click)="toggleExpanded(row.id)"
                [attr.aria-expanded]="expandedId() === row.id"
              >
                <div class="row-head">
                  <span class="row-title">
                    <span class="type-label">{{ labelForType(row.activityType) }}</span>
                    <span aria-hidden="true">·</span>
                    <span class="reason-label">{{ labelForReason(row.reason) }}</span>
                  </span>
                  <time class="row-time" [dateTime]="row.occurredAt">{{
                    row.occurredAt | date: 'short'
                  }}</time>
                </div>
                @if (row.note) {
                  <p class="row-note">{{ row.note }}</p>
                }
                @if (row.outcomeFlags.length > 0) {
                  <ul class="flag-strip" role="list">
                    @for (flag of row.outcomeFlags; track flag) {
                      <li class="flag-pill">{{ labelForReason(flag) }}</li>
                    }
                  </ul>
                }
                <p class="row-meta">
                  @if (row.durationMinutes !== null) {
                    <span class="meta-item">
                      <span nz-icon nzType="clock-circle" nzTheme="outline" class="meta-icon"></span>
                      <span i18n="@@activity.timeline.duration">{{ row.durationMinutes }} min</span>
                    </span>
                  }
                  @if (row.followUpAt) {
                    @if (row.durationMinutes !== null) {
                      <span class="meta-sep" aria-hidden="true">·</span>
                    }
                    <span class="meta-item">
                      <span nz-icon nzType="calendar" nzTheme="outline" class="meta-icon"></span>
                      <span i18n="@@activity.timeline.followUp"
                        >Follow-up {{ row.followUpAt | date: 'short' }}</span>
                    </span>
                  }
                  @if (row.attachedDocuments?.length) {
                    @if (row.durationMinutes !== null || row.followUpAt) {
                      <span class="meta-sep" aria-hidden="true">·</span>
                    }
                    <span class="meta-item">
                      <span nz-icon nzType="paper-clip" nzTheme="outline" class="meta-icon"></span>
                      <span i18n="@@activity.timeline.attachments"
                        >{{ row.attachedDocuments?.length }} attachment(s)</span>
                    </span>
                  }
                </p>
              </button>
            </li>
          }
        </ol>

        @if (nextCursor()) {
          <button nz-button nzType="default" (click)="loadMore()" class="load-more">
            <span i18n="@@activity.timeline.loadMore">Load older activity</span>
          </button>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .timeline-root {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .filter-row {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 4px;
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        align-self: flex-start;
      }
      .filter-tab {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding-inline: var(--space-3);
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        font-family: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.02em;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .filter-tab .filter-icon {
        font-size: 16px;
        opacity: 0.85;
      }
      .filter-tab:hover {
        color: var(--color-text-primary);
        background: var(--color-surface-row-hover);
      }
      .filter-tab.is-active {
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        box-shadow:
          0 1px 2px rgba(6, 21, 45, 0.08),
          inset 0 0 0 1px var(--color-border-default);
      }
      .filter-tab:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .filter-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 20px;
        block-size: 18px;
        padding-inline: 6px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums;
      }
      .filter-tab.is-active .filter-count {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      .empty {
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        padding-block: var(--space-4);
      }
      .timeline {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .timeline::before {
        content: '';
        position: absolute;
        inset-block: 12px;
        inset-inline-start: 15px;
        inline-size: 1px;
        background: var(--color-border-default);
        pointer-events: none;
      }
      .row {
        display: grid;
        grid-template-columns: 32px 1fr;
        gap: var(--space-3);
        padding-block: var(--space-3);
        position: relative;
      }
      .dot {
        inline-size: 32px;
        block-size: 32px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        border: 1px solid var(--color-border-default);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        color: var(--color-text-secondary);
      }
      .dot[data-category='calls'] {
        background: var(--color-info-bg);
        border-color: var(--color-info-bg);
        color: var(--color-info);
      }
      .dot[data-category='messages'] {
        background: var(--color-tonal-accent-bg);
        border-color: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      .dot[data-category='documents'] {
        background: var(--color-success-bg);
        border-color: var(--color-success-bg);
        color: var(--color-success);
      }
      .dot[data-category='workflow'],
      .dot[data-category='notes'] {
        background: var(--color-surface-muted);
        border-color: var(--color-border-default);
        color: var(--color-text-secondary);
      }
      .dot [nz-icon] {
        font-size: 18px;
      }
      .row-body {
        appearance: none;
        background: transparent;
        border: 0;
        padding: var(--space-2) var(--space-3);
        text-align: start;
        cursor: pointer;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .row-body:hover {
        background: var(--color-surface-row-hover);
      }
      .row-body:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .row-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-3);
      }
      .row-title {
        display: inline-flex;
        gap: 6px;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .type-label {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .reason-label {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .row-time {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .row-note {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .row.expanded .row-note {
        -webkit-line-clamp: unset;
        display: block;
      }
      .row-meta {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .meta-sep { opacity: 0.5; }
      .meta-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .meta-icon { font-size: 11px; opacity: 0.7; }
      .flag-strip {
        list-style: none;
        margin: 0;
        padding: 0;
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .flag-pill {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        background: color-mix(in oklab, var(--warning) 10%, var(--bg-subtle));
        color: var(--warning);
        border: 1px solid color-mix(in oklab, var(--warning) 25%, transparent);
        white-space: nowrap;
      }
      .load-more {
        align-self: flex-start;
      }
    `,
  ],
})
export class ActivityTimelineComponent implements OnInit {
  readonly applicationId = input.required<string>();
  readonly refreshToken = input<number>(0);

  private readonly api = inject(ApplicationsApiService);

  protected readonly rows = signal<ActivityRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly filter = signal<FilterKey>('all');
  protected readonly expandedId = signal<string | null>(null);

  protected readonly visibleRows = (): ActivityRow[] => {
    const all = this.rows();
    const f = this.filter();
    if (f === 'all') return all;
    return all.filter((r) => CATEGORY_BY_TYPE[r.activityType] === f);
  };

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const id = this.applicationId();
    if (!id) return;
    this.loading.set(true);
    try {
      const { rows, nextCursor } = await this.api.listActivities(id, { limit: 25 });
      this.rows.set(rows);
      this.nextCursor.set(nextCursor);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const id = this.applicationId();
    const cursor = this.nextCursor();
    if (!id || !cursor) return;
    const { rows, nextCursor } = await this.api.listActivities(id, { cursor, limit: 25 });
    this.rows.update((prev) => [...prev, ...rows]);
    this.nextCursor.set(nextCursor);
  }

  setFilter(f: FilterKey): void {
    this.filter.set(f);
  }

  toggleExpanded(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }

  iconFor(activityType: string): string {
    return ICON_BY_TYPE[activityType] ?? 'calendar';
  }

  countFor(key: FilterKey): number {
    const all = this.rows();
    if (key === 'all') return all.length;
    return all.filter((r) => CATEGORY_BY_TYPE[r.activityType] === key).length;
  }

  categoryOf(row: ActivityRow): FilterKey {
    return CATEGORY_BY_TYPE[row.activityType] ?? 'workflow';
  }

  labelForType(activityType: string): string {
    return activityType
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  labelForReason(reason: string): string {
    return reason
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
