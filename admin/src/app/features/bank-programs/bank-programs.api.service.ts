import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  BankProgramCreatePayload,
  BankProgramListRow,
  BankProgramResponse,
  BankProgramUpdatePayload,
  ListBankProgramsQuery,
} from './bank-programs.types';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface PaginatedEnvelope<T> {
  success: true;
  data: T[];
  pagination: { page: number; pageSize: number; total: number };
}

/**
 * Admin HttpClient adapter for /api/admin/bank-programs/* endpoints.
 * Auth + correlation + error + toast handled by global interceptors from feature 001.
 */
@Injectable({ providedIn: 'root' })
export class BankProgramsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bank-programs`;

  async list(query: ListBankProgramsQuery): Promise<PaginatedEnvelope<BankProgramListRow>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') {
        continue;
      }
      params = params.set(k, String(v));
    }
    return firstValueFrom(this.http.get<PaginatedEnvelope<BankProgramListRow>>(this.base, { params }));
  }

  async getByCode(programCode: string): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.get<SuccessEnvelope<BankProgramResponse>>(`${this.base}/${encodeURIComponent(programCode)}`),
    );
  }

  async create(payload: BankProgramCreatePayload): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(this.http.post<SuccessEnvelope<BankProgramResponse>>(this.base, payload));
  }

  async update(
    programCode: string,
    payload: BankProgramUpdatePayload,
  ): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}`,
        payload,
      ),
    );
  }

  async toggle(programCode: string, body: { active: boolean; version: number }): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(programCode)}/toggle`,
        body,
      ),
    );
  }

  async clone(sourceProgramCode: string, newProgramCode: string): Promise<SuccessEnvelope<BankProgramResponse>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankProgramResponse>>(
        `${this.base}/${encodeURIComponent(sourceProgramCode)}/clone`,
        { newProgramCode },
      ),
    );
  }

  async delete(programCode: string, confirmHeader: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.base}/${encodeURIComponent(programCode)}`, {
        headers: { 'X-Confirm-Program-Code': confirmHeader },
      }),
    );
  }
}
