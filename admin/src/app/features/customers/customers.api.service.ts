import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export interface CustomerListRow {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  locale: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
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
  leadStatus: string;
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

export interface CustomerDetail extends CustomerListRow {
  applications: CustomerApplicationSnapshot[];
  supportRequests: CustomerSupportRequestSnapshot[];
}

@Injectable({ providedIn: 'root' })
export class CustomersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/customers`;

  async list(query: { q?: string; pageIndex: number; pageSize: number }): Promise<CustomerListResponse> {
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
}
