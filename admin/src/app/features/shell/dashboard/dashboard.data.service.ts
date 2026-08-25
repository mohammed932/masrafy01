import { Injectable, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import type { StaffRole } from '@core/auth/auth.types';
import {
  ApplicationsApiService,
  type AdminApplicationRow,
} from '@features/applications/api/applications.api.service';
import { BanksApiService } from '@features/banks/banks.api.service';
import { CustomersApiService } from '@features/customers/customers.api.service';
import { SupportApiService, type SupportRequestRow } from '@features/support/support.api.service';

/** Banks + program coverage, or `null` when the call failed. */
export interface CoverageSnapshot {
  readonly banksTotal: number;
  readonly banksActive: number;
  readonly programs: number;
}

export interface AudienceSnapshot {
  readonly total: number;
  readonly newLast7Days: number;
}

export interface DashboardSnapshot {
  readonly applications: readonly AdminApplicationRow[];
  /** True when the sweep hit its page cap — the numbers describe a window, not everything. */
  readonly applicationsTruncated: boolean;
  readonly coverage: CoverageSnapshot | null;
  readonly audience: AudienceSnapshot | null;
  /** Live support requests (open + in progress), or `null` when unreadable. */
  readonly support: readonly SupportRequestRow[] | null;
  readonly generatedAt: number;
}

/** Roles allowed through the `/people` gate — the only ones that may read customers. */
const CUSTOMER_READERS: readonly StaffRole[] = ['super_admin', 'sales_manager', 'analyst'];

const APPLICATION_PAGE_LIMIT = 100;
const APPLICATION_MAX_PAGES = 3;
const CUSTOMER_SAMPLE_SIZE = 50;
/** Per status — the desk only counts them, so one page each is enough. */
const SUPPORT_PAGE_SIZE = 100;
const DAY_MS = 86_400_000;

/**
 * One aggregate read for the dashboard, composed from the endpoints the admin
 * already owns — no dashboard-specific backend surface. Each source is settled
 * independently so a 403 or a slow call degrades one card instead of the page.
 *
 * Deliberately narrow: the desk shows counts, so it reads only what a count
 * needs. Configuration readiness, the engine dry run and the program catalogue
 * live on their own pages and are not paid for here.
 */
@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private readonly applicationsApi = inject(ApplicationsApiService);
  private readonly banksApi = inject(BanksApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly supportApi = inject(SupportApiService);
  private readonly auth = inject(AuthService);

  async load(): Promise<DashboardSnapshot> {
    const role = this.auth.role();
    const mayReadCustomers = role !== null && CUSTOMER_READERS.includes(role);

    const [applications, coverage, audience, support] = await Promise.all([
      this.loadApplications(),
      this.loadCoverage(),
      mayReadCustomers ? this.loadAudience() : Promise.resolve(null),
      this.loadSupport(),
    ]);

    return {
      applications: applications.rows,
      applicationsTruncated: applications.truncated,
      coverage,
      audience,
      support,
      generatedAt: Date.now(),
    };
  }

  /**
   * Cursor sweep with a hard page cap. The dashboard needs a recent window, not
   * the archive: three pages bounds the worst case at three round trips and the
   * page states the window it read rather than implying it read everything.
   */
  private async loadApplications(): Promise<{
    rows: readonly AdminApplicationRow[];
    truncated: boolean;
  }> {
    const all: AdminApplicationRow[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const { rows, nextCursor } = await this.applicationsApi.list({
        cursor,
        limit: APPLICATION_PAGE_LIMIT,
      });
      all.push(...rows);
      cursor = nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < APPLICATION_MAX_PAGES);
    return { rows: all, truncated: cursor !== undefined };
  }

  private async loadCoverage(): Promise<CoverageSnapshot | null> {
    try {
      const res = await this.banksApi.list({ page: 1, pageSize: 100 });
      return {
        banksTotal: res.pagination.total,
        banksActive: res.data.filter((b) => b.isActive).length,
        programs: res.data.reduce((sum, b) => sum + b.programCount, 0),
      };
    } catch {
      return null;
    }
  }

  /** Customer list is `createdAt desc`, so page one doubles as the signup trend. */
  private async loadAudience(): Promise<AudienceSnapshot | null> {
    try {
      // pageIndex is 0-based server-side (`skip = pageIndex * pageSize`): asking
      // for 1 skips the newest 50 customers.
      const res = await this.customersApi.list({ pageIndex: 0, pageSize: CUSTOMER_SAMPLE_SIZE });
      const cutoff = Date.now() - 7 * DAY_MS;
      return {
        total: res.pagination.total,
        newLast7Days: res.data.filter((c) => new Date(c.createdAt).getTime() >= cutoff).length,
      };
    } catch {
      return null;
    }
  }

  /**
   * The live queue, in two status-filtered reads rather than one unfiltered
   * page: a long archive of resolved tickets would otherwise crowd the open ones
   * out of the window. Every staff role may read it.
   */
  private async loadSupport(): Promise<readonly SupportRequestRow[] | null> {
    try {
      const [open, working] = await Promise.all([
        this.supportApi.list({ status: 'open', pageSize: SUPPORT_PAGE_SIZE }),
        this.supportApi.list({ status: 'in_progress', pageSize: SUPPORT_PAGE_SIZE }),
      ]);
      return [...open.data, ...working.data];
    } catch {
      return null;
    }
  }
}
