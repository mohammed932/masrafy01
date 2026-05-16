import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ClockCircleOutline } from '@ant-design/icons-angular/icons';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApplicationsApiService } from '../applications/api/applications.api.service';
import type { SuccessEnvelope } from '@core/auth/auth.types';

interface ReminderRow {
  activityId: string;
  applicationId: string;
  followUpAt: string;
  applicationSummary: { requestedAmountEGP: string; loanPurpose: string };
}

@Component({
  selector: 'app-reminders-widget',
  standalone: true,
  imports: [CommonModule, DatePipe, NzButtonModule, NzIconModule, NzSpinModule],
  providers: [provideNzIconsPatch([ClockCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="widget">
      <header class="header">
        <span nz-icon nzType="clock-circle" nzTheme="outline" aria-hidden="true"></span>
        <h2 i18n="@@reminders.heading">Reminders due today</h2>
      </header>
      @if (loading()) {
        <nz-spin nzSimple />
      } @else if (rows().length === 0) {
        <p class="empty" i18n="@@reminders.empty">No pending follow-ups in the next 24 hours.</p>
      } @else {
        <ul class="list">
          @for (r of rows(); track r.activityId) {
            <li class="row">
              <button
                type="button"
                class="row-link"
                (click)="open(r)"
                [attr.aria-label]="openLabel(r)"
              >
                <span class="row-purpose">{{ r.applicationSummary.loanPurpose }}</span>
                <span class="row-amount">{{ r.applicationSummary.requestedAmountEGP }} EGP</span>
                <time class="row-time" [dateTime]="r.followUpAt">{{
                  r.followUpAt | date: 'short'
                }}</time>
              </button>
              <div class="row-actions">
                <button
                  nz-button
                  type="button"
                  (click)="markCompleted(r)"
                  [attr.aria-label]="completeLabel"
                  i18n="@@reminders.markCompleted"
                >
                  Completed
                </button>
                <button
                  nz-button
                  type="button"
                  (click)="snooze(r)"
                  [attr.aria-label]="snoozeLabel"
                  i18n="@@reminders.snooze"
                >
                  Snooze
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .widget {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .header {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      h2 {
        margin: 0;
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .empty {
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        margin: 0;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--space-3);
        align-items: center;
        padding: var(--space-2);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
      }
      .row-link {
        appearance: none;
        background: transparent;
        border: 0;
        text-align: start;
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: var(--space-3);
        align-items: baseline;
        cursor: pointer;
      }
      .row-link:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }
      .row-purpose {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .row-amount {
        font-variant-numeric: tabular-nums;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .row-time {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .row-actions {
        display: inline-flex;
        gap: var(--space-2);
      }
    `,
  ],
})
export class RemindersWidgetComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApplicationsApiService);
  private readonly router = inject(Router);

  protected readonly rows = signal<ReminderRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly completeLabel = $localize`:@@reminders.markCompleted.aria:Mark reminder completed`;
  protected readonly snoozeLabel = $localize`:@@reminders.snooze.aria:Snooze reminder for 24 hours`;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  openLabel(r: ReminderRow): string {
    return $localize`:@@reminders.open.aria:Open application ${r.applicationId}`;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<SuccessEnvelope<{ reminders: ReminderRow[] }>>(
          `${environment.apiBaseUrl}/staff/me/reminders?windowHours=24`,
        ),
      );
      this.rows.set(res.data.reminders);
    } finally {
      this.loading.set(false);
    }
  }

  open(r: ReminderRow): void {
    void this.router.navigate(['/applications', r.applicationId]);
  }

  async markCompleted(r: ReminderRow): Promise<void> {
    await this.logFollowUp(r, 'FOLLOWUP_COMPLETED');
  }

  async snooze(r: ReminderRow): Promise<void> {
    await this.logFollowUp(r, 'FOLLOWUP_SNOOZED');
  }

  private async logFollowUp(r: ReminderRow, reason: string): Promise<void> {
    try {
      await this.api.createActivity(r.applicationId, {
        activityType: 'INTERNAL_NOTE',
        reason,
        meta: { sourceActivityId: r.activityId },
      });
      await this.reload();
    } catch {
      // toast surfaced via global error interceptor
    }
  }
}
