import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

/** Fields shared by the list row and the detail payload (see AdminCustomerAccountsController). */
export interface CustomerBase {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  nameSplitNeedsReview: boolean;
  locale: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CustomerListRow extends CustomerBase {
  applicationCount: number;
}

export interface CustomerListResponse {
  data: CustomerListRow[];
  pagination: { pageIndex: number; pageSize: number; total: number };
}

export interface CustomerApplicationSnapshot {
  id: string;
  loanPurpose: string;
  status: string;
  requestedAmountEGP: string;
  createdAt: string;
  userProceededAt: string | null;
}

export interface CustomerSupportRequestSnapshot {
  id: string;
  channel: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CustomerDetail extends CustomerBase {
  age: number | null;
  applications: CustomerApplicationSnapshot[];
  supportRequests: CustomerSupportRequestSnapshot[];
}

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/customers`;

  async list(query: {
    q?: string;
    pageIndex: number;
    pageSize: number;
  }): Promise<CustomerListResponse> {
    let params = new HttpParams()
      .set('pageIndex', String(query.pageIndex))
      .set('pageSize', String(query.pageSize));
    if (query.q && query.q.trim().length > 0) {
      params = params.set('q', query.q.trim());
    }
    const result = await firstValueFrom(
      this.http.get<CustomerListResponse & { success: true }>(this.base, { params }),
    );
    return { data: result.data, pagination: result.pagination };
  }

  async detail(id: string): Promise<CustomerDetail> {
    const result = await firstValueFrom(
      this.http.get<SuccessEnvelope<CustomerDetail>>(`${this.base}/${id}`),
    );
    return result.data;
  }

  /** Activate / deactivate a customer (super_admin). Returns the new state. */
  async setActive(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
    const result = await firstValueFrom(
      this.http.patch<SuccessEnvelope<{ id: string; isActive: boolean }>>(
        `${this.base}/${id}/status`,
        { isActive },
        { withCredentials: true },
      ),
    );
    return result.data;
  }
}
