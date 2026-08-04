import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

/** Mirrors the backend `SupportChannel` enum (support/dto/enums.ts). */
export const SUPPORT_CHANNELS = ['chat', 'call', 'whatsapp', 'email'] as const;
export type SupportChannel = (typeof SUPPORT_CHANNELS)[number];

/** Mirrors the backend `SupportStatus` enum. `resolved` is terminal. */
export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export interface SupportRequestRow {
  id: string;
  channel: SupportChannel;
  status: SupportStatus;
  createdAt: string;
  resolvedAt?: string;
  applicationId?: string;
  customerId?: string;
  assignedStaffId?: string;
  note?: string;
}

/** Contact details the mobile app shows customers. Every field is a plain string. */
export interface SupportConfig {
  phone: string;
  email: string;
  whatsappUrl: string;
  hoursAr: string;
  hoursEn: string;
}

export interface SupportRequestPage {
  data: SupportRequestRow[];
  pagination: { pageIndex: number; pageSize: number; total: number };
}

/**
 * Admin adapter for `/api/admin/support/*`. The backend has carried this surface
 * since the support feature landed; the admin app never grew a screen for it, so
 * the operations desk is its first consumer.
 *
 * List is `createdAt desc` server-side, so page one is the newest slice.
 */
@Injectable({ providedIn: 'root' })
export class SupportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/support`;

  async list(query: {
    status?: SupportStatus;
    channel?: SupportChannel;
    assignedStaffId?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Promise<SupportRequestPage> {
    let params = new HttpParams()
      .set('pageIndex', String(query.pageIndex ?? 0))
      .set('pageSize', String(query.pageSize ?? 25));
    if (query.status) params = params.set('status', query.status);
    if (query.channel) params = params.set('channel', query.channel);
    if (query.assignedStaffId) params = params.set('assignedStaffId', query.assignedStaffId);
    return firstValueFrom(this.http.get<SupportRequestPage>(`${this.base}/requests`, { params }));
  }

  /** The contact singleton the mobile app renders. Readable by every staff role. */
  async config(): Promise<SupportConfig> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<SupportConfig>>(`${this.base}/config`),
    );
    return res.data;
  }

  async detail(id: string): Promise<SupportRequestRow> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<SupportRequestRow>>(
        `${this.base}/requests/${encodeURIComponent(id)}`,
      ),
    );
    return res.data;
  }

  /** Assigning also moves the request to `in_progress` server-side. */
  async assign(id: string, staffId: string): Promise<SupportRequestRow> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<SupportRequestRow>>(
        `${this.base}/requests/${encodeURIComponent(id)}/assign`,
        { staffId },
      ),
    );
    return res.data;
  }

  async resolve(id: string): Promise<SupportRequestRow> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<SupportRequestRow>>(
        `${this.base}/requests/${encodeURIComponent(id)}/resolve`,
        {},
      ),
    );
    return res.data;
  }
}
