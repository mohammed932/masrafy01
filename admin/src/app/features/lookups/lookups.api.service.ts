import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import type { ProgramDefaults } from '../bank-programs/bank-programs.types';

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
  /** Feature 010 — per-category prefill defaults; `{}` for non-`program_name` members. */
  defaults: Record<string, ProgramDefaults>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Response of the catalog-defaults endpoints (FR-001). */
export interface CatalogDefaultsResponse {
  defaults: Record<string, ProgramDefaults>;
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
  parentKey?: string;
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

  // --- Feature 010: predefined-program catalog defaults (FR-001 … FR-004) ---

  async getCatalogDefaults(key: string): Promise<CatalogDefaultsResponse> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<CatalogDefaultsResponse>>(
        `${this.base}/program_name/${encodeURIComponent(key)}/defaults`,
      ),
    );
    return res.data;
  }

  /**
   * FULL REPLACE (not a patch) so clearing a category or a leaf is expressible.
   * Prefill only — saved bank programs are never touched (FR-007, FR-009).
   */
  async updateCatalogDefaults(
    key: string,
    defaults: Record<string, ProgramDefaults>,
  ): Promise<CatalogDefaultsResponse> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<CatalogDefaultsResponse>>(
        `${this.base}/program_name/${encodeURIComponent(key)}/defaults`,
        { defaults },
      ),
    );
    return res.data;
  }
}
