import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CreateStaffRequest,
  PaginatedEnvelope,
  ResetPasswordRequest,
  StaffAccountSummary,
  SuccessEnvelope,
  UpdateStaffRequest,
} from '@core/auth/auth.types';

export interface ListPage {
  rows: readonly StaffAccountSummary[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  private url(suffix = ''): string {
    return `${environment.apiBaseUrl}/users${suffix}`;
  }

  async list(page: number, pageSize: number): Promise<ListPage> {
    const res = await firstValueFrom(
      this.http.get<PaginatedEnvelope<StaffAccountSummary>>(this.url(), {
        params: { page, pageSize },
        withCredentials: true,
      }),
    );
    return {
      rows: res.data,
      page: res.pagination.page,
      pageSize: res.pagination.pageSize,
      total: res.pagination.total,
    };
  }

  async create(body: CreateStaffRequest): Promise<StaffAccountSummary> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<StaffAccountSummary>>(this.url(), body, {
        withCredentials: true,
      }),
    );
    return res.data;
  }

  async getById(id: string): Promise<StaffAccountSummary> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<StaffAccountSummary>>(this.url(`/${id}`), {
        withCredentials: true,
      }),
    );
    return res.data;
  }

  async update(id: string, patch: UpdateStaffRequest): Promise<StaffAccountSummary> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<StaffAccountSummary>>(this.url(`/${id}`), patch, {
        withCredentials: true,
      }),
    );
    return res.data;
  }

  async resetPassword(id: string, body: ResetPasswordRequest): Promise<void> {
    await firstValueFrom(
      this.http.patch(this.url(`/${id}/password`), body, { withCredentials: true }),
    );
  }
}
