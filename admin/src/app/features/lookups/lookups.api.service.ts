import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export interface EnumerationRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  deprecatedAt: string | null;
  systemOnly: boolean;
  parentKey: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnumerationTypeSummary {
  type: string;
  total: number;
  active: number;
  deprecated: number;
}

export interface CreateEnumerationRequest {
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  parentKey?: string;
  sortOrder?: number;
}

export interface UpdateEnumerationRequest {
  labelAr?: string;
  labelEn?: string;
  active?: boolean;
  deprecate?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class LookupsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/enumerations`;

  async listTypes(): Promise<EnumerationTypeSummary[]> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<EnumerationTypeSummary[]>>(`${this.base}/types`),
    );
    return res.data;
  }

  async list(type?: string): Promise<EnumerationRow[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<EnumerationRow[]>>(this.base, { params }),
    );
    return res.data;
  }

  async create(body: CreateEnumerationRequest): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<EnumerationRow>>(this.base, body),
    );
    return res.data;
  }

  async update(id: string, body: UpdateEnumerationRequest): Promise<EnumerationRow> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<EnumerationRow>>(`${this.base}/${id}`, body),
    );
    return res.data;
  }
}
