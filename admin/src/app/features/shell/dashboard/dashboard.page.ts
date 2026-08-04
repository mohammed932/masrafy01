import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  AppstoreOutline,
  BankOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  FileTextOutline,
  MessageOutline,
  ReloadOutline,
  SyncOutline,
  TeamOutline,
} from '@ant-design/icons-angular/icons';
import { StatStripComponent, type StatStripItem } from '@shared/ui';
import { AuthService } from '@core/auth/auth.service';
import { DashboardDataService, type DashboardSnapshot } from './dashboard.data.service';
import { pipelineCounts, supportCounts } from './dashboard.metrics';

/**
 * The dashboard is a scoreboard, not a workspace: where the platform stands,
 * in counts, in two groups — what it can sell, and what is moving through it.
 * Working a lead, fixing coverage and answering a request all happen on their
 * own pages; nothing is duplicated here and nothing here is interactive beyond
 * a refresh.
 *
 * Every number is derived client-side from endpoints the admin already calls
 * (`dashboard.data.service.ts`), so nothing here waits on a new API surface. A
 * source the role cannot read (or that failed) drops its cards rather than
 * rendering them as zeroes.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [NzButtonModule, NzIconModule, StatStripComponent],
  providers: [
    provideNzIconsPatch([
      AppstoreOutline,
      BankOutline,
      CheckCircleOutline,
      ClockCircleOutline,
      FileTextOutline,
      MessageOutline,
      ReloadOutline,
      SyncOutline,
      TeamOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="desk" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="brief">
        <div class="brief-text">
          <p class="eyebrow">{{ kicker() }}</p>
          <h1 class="greeting">{{ greeting() }}</h1>
          <p class="subtitle">{{ subtitle }}</p>
        </div>

        <div class="brief-side">
          <button
            nz-button
            nzType="default"
            nzSize="small"
            [disabled]="loading()"
            (click)="reload()"
          >
            <span nz-icon nzType="reload" nzTheme="outline"></span>
            {{ refreshLabel }}
          </button>
          @if (updatedLabel(); as updated) {
            <p class="updated">{{ updated }}</p>
          }
        </div>
      </header>

      @if (error()) {
        <div class="error" role="alert">
          <p>{{ errorText }}</p>
          <button nz-button nzType="primary" nzSize="small" (click)="reload()">
            {{ retryLabel }}
          </button>
        </div>
      }

      @if (loading() && !snapshot()) {
        <div class="placeholder" aria-hidden="true">
          @for (i of skeletonCells; track i) {
            <div class="skeleton"></div>
          }
        </div>
      } @else if (snapshot()) {
        <!-- Two groups, because the two answer different questions: what the
             platform can offer, and what is currently moving through it. -->
        @if (platformStats().length > 0) {
          <section class="group">
            <h2 class="group-title">{{ platformLabel }}</h2>
            <app-stat-strip
              [items]="platformStats()"
              columnMin="220px"
              [ariaLabel]="platformLabel"
            />
          </section>
        }

        @if (pipelineStats().length > 0) {
          <section class="group">
            <h2 class="group-title">{{ pipelineLabel }}</h2>
            <app-stat-strip
              [items]="pipelineStats()"
              columnMin="220px"
              [ariaLabel]="pipelineLabel"
            />
          </section>
        }
      }

      @if (windowNote(); as note) {
        <p class="window-note">{{ note }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .desk {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }

      /* ---------- brief ---------- */
      .brief {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: var(--space-5);
        /* A single brand rule instead of a coloured slab — the greeting carries
           the page, the rule carries the brand. */
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--primary);
      }
      .eyebrow {
        margin: 0 0 var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-bold);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .greeting {
        margin: 0 0 var(--space-2);
        font-family: var(--font-display);
        font-size: var(--text-4xl);
        font-weight: var(--font-semibold);
        line-height: var(--leading-tight);
        letter-spacing: -0.01em;
        color: var(--text-primary);
      }
      .subtitle {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .brief-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-2);
      }
      .updated {
        margin: 0;
        font-size: var(--text-xxs);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }

      /* ---------- groups ---------- */
      /* The heading is the only separator: a wrapper card around cards would be
         a container on a container for no added meaning. */
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        animation: rise var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .group + .group {
        animation-delay: var(--motion-stagger);
      }
      .group-title {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      /* ---------- states ---------- */
      .placeholder {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
      }
      .skeleton {
        min-block-size: 116px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-subtle);
        background: linear-gradient(
          90deg,
          var(--bg-surface) 0%,
          var(--bg-subtle) 50%,
          var(--bg-surface) 100%
        );
        background-size: 200% 100%;
        animation: sweep var(--motion-ambient) ease-in-out infinite;
      }
      @keyframes sweep {
        from {
          background-position: 200% 0;
        }
        to {
          background-position: -200% 0;
        }
      }
      .error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: color-mix(in oklab, var(--error) 8%, transparent);
        border: 1px solid color-mix(in oklab, var(--error) 30%, transparent);
      }
      .error p {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .window-note {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }

      /* ---------- responsive ---------- */
      @media (max-width: 720px) {
        .desk {
          gap: var(--space-5);
        }
        .brief {
          grid-template-columns: minmax(0, 1fr);
        }
        .brief-side {
          align-items: flex-start;
        }
        .greeting {
          font-size: var(--text-3xl);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .group,
        .skeleton {
          animation: none;
        }
      }
    `,
  ],
})
export class DashboardPage {
  private readonly data = inject(DashboardDataService);
  private readonly auth = inject(AuthService);

  protected readonly snapshot = signal<DashboardSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  /** Fixed cell count for the loading grid — never rendered with real data. */
  protected readonly skeletonCells = [0, 1, 2, 3, 4, 5];

  protected readonly refreshLabel = $localize`:@@dash.refresh:Refresh`;
  protected readonly retryLabel = $localize`:@@dash.retry:Try again`;
  protected readonly errorText = $localize`:@@dash.error:The desk could not load its numbers. Nothing is lost — try again.`;
  protected readonly subtitle = $localize`:@@dash.subtitle:Where the platform stands right now.`;
  protected readonly platformLabel = $localize`:@@dash.section.platform:Platform`;
  protected readonly pipelineLabel = $localize`:@@dash.section.pipeline:Pipeline`;

  constructor() {
    void this.reload();
  }

  // ---- derived readings ----------------------------------------------------

  private readonly rows = computed(() => this.snapshot()?.applications ?? []);
  private readonly pipeline = computed(() => pipelineCounts(this.rows()));
  private readonly support = computed(() => {
    const rows = this.snapshot()?.support;
    return rows ? supportCounts(rows) : null;
  });

  protected readonly kicker = computed(() => {
    switch (this.auth.role()) {
      case 'super_admin':
        return $localize`:@@dash.kicker.super:Super-admin console`;
      case 'sales_manager':
        return $localize`:@@dash.kicker.manager:Sales manager console`;
      case 'sales_agent':
        return $localize`:@@dash.kicker.agent:Sales agent console`;
      default:
        return $localize`:@@dash.kicker.analyst:Analyst console`;
    }
  });

  protected readonly greeting = computed(() => {
    const name = this.auth.currentUser()?.name ?? '';
    const firstName = name.split(/\s+/)[0] ?? '';
    return firstName
      ? $localize`:@@dash.greeting:Welcome back, ${firstName}.`
      : $localize`:@@dash.greetingAnon:Welcome to Masrafy.`;
  });

  protected readonly updatedLabel = computed(() => {
    const at = this.snapshot()?.generatedAt;
    if (at === undefined) return '';
    const time = new Date(at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return $localize`:@@dash.updated:Updated ${time}`;
  });

  /** What the platform can offer — coverage + audience, whichever it could read. */
  protected readonly platformStats = computed<StatStripItem[]>(() => {
    const snap = this.snapshot();
    if (snap === null) return [];
    const items: StatStripItem[] = [];
    if (snap.coverage) {
      const { banksActive, banksTotal, programs } = snap.coverage;
      items.push({
        label: $localize`:@@dash.stat.banks:Active banks`,
        value: banksActive,
        icon: 'bank',
        hint: $localize`:@@dash.stat.banksHint:of ${banksTotal} on the registry`,
      });
      items.push({
        label: $localize`:@@dash.stat.programs:Loan programs`,
        value: programs,
        icon: 'appstore',
        hint: $localize`:@@dash.stat.programsHint:across all banks`,
      });
    }
    if (snap.audience) {
      const fresh = snap.audience.newLast7Days;
      items.push({
        label: $localize`:@@dash.stat.customers:Customers`,
        value: snap.audience.total,
        icon: 'team',
        hint:
          fresh > 0
            ? $localize`:@@dash.stat.signupsHint:${fresh} joined this week`
            : $localize`:@@dash.stat.signupsNone:none joined this week`,
      });
    }
    return items;
  });

  /** What is moving — lead states plus the requests waiting on an answer. */
  protected readonly pipelineStats = computed<StatStripItem[]>(() => {
    const snap = this.snapshot();
    if (snap === null) return [];
    const p = this.pipeline();
    const worked = p.pending + p.in_progress + p.done;
    const items: StatStripItem[] = [
      {
        label: $localize`:@@dash.stat.applications:Applications`,
        value: p.total,
        icon: 'file-text',
        hint:
          p.closeRate === null
            ? $localize`:@@dash.stat.applicationsNone:nothing closed yet`
            : $localize`:@@dash.stat.applicationsClosed:${Math.round(p.closeRate * 100)}% closed`,
      },
      {
        label: $localize`:@@dash.stat.pending:Awaiting action`,
        value: p.pending,
        // Tone is the reading, not decoration: a lead nobody has picked up is
        // the only count on this page that is bad news at any size.
        tone: p.pending > 0 ? 'warning' : 'muted',
        icon: 'clock-circle',
        hint: $localize`:@@dash.stat.pendingHint:not picked up yet`,
      },
      {
        label: $localize`:@@dash.stat.working:In progress`,
        value: p.in_progress,
        icon: 'sync',
        hint: $localize`:@@dash.stat.workingHint:being worked now`,
      },
      {
        label: $localize`:@@dash.stat.done:Completed`,
        value: p.done,
        tone: p.done > 0 ? 'success' : 'muted',
        icon: 'check-circle',
        hint: $localize`:@@dash.stat.doneHint:of ${worked} worked leads`,
      },
    ];

    const support = this.support();
    if (support !== null) {
      items.push({
        label: $localize`:@@dash.stat.support:Open requests`,
        value: support.total,
        tone: support.open > 0 ? 'warning' : 'muted',
        icon: 'message',
        hint:
          support.inProgress > 0
            ? $localize`:@@dash.stat.supportHint:${support.inProgress} being handled`
            : $localize`:@@dash.stat.supportNone:none being handled`,
      });
    }
    return items;
  });

  protected readonly windowNote = computed(() => {
    const snap = this.snapshot();
    if (snap === null) return '';
    const count = snap.applications.length;
    if (count === 0) return '';
    return snap.applicationsTruncated
      ? $localize`:@@dash.window.truncated:Readings cover the ${count} most recent applications.`
      : $localize`:@@dash.window.all:Readings cover all ${count} applications.`;
  });

  // ---- actions -------------------------------------------------------------

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.snapshot.set(await this.data.load());
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
