import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  Bank,
  BankCreatePayload,
  BankPresignedLogo,
  BankProgramSummary,
  BankToggle,
  BankUpdatePayload,
  BankWithProgramCount,
} from './banks.types';

interface SuccessEnvelope<T> { success: true; data: T }
interface PaginatedEnvelope<T> { success: true; data: T[]; pagination: { page: number; pageSize: number; total: number } }

@Injectable({ providedIn: 'root' })
export class BanksApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/banks`;

  async list(opts: { page?: number; pageSize?: number; search?: string; active?: boolean } = {}): Promise<PaginatedEnvelope<BankWithProgramCount>> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', String(opts.page));
    if (opts.pageSize) params = params.set('pageSize', String(opts.pageSize));
    if (opts.search) params = params.set('search', opts.search);
    if (opts.active !== undefined) params = params.set('active', String(opts.active));
    return firstValueFrom(this.http.get<PaginatedEnvelope<BankWithProgramCount>>(this.base, { params }));
  }

  async getById(id: string): Promise<SuccessEnvelope<BankWithProgramCount>> {
    return firstValueFrom(this.http.get<SuccessEnvelope<BankWithProgramCount>>(`${this.base}/${encodeURIComponent(id)}`));
  }

  async listPrograms(id: string): Promise<SuccessEnvelope<BankProgramSummary[]>> {
    return firstValueFrom(this.http.get<SuccessEnvelope<BankProgramSummary[]>>(`${this.base}/${encodeURIComponent(id)}/programs`));
  }

  async create(payload: BankCreatePayload): Promise<SuccessEnvelope<Bank>> {
    return firstValueFrom(this.http.post<SuccessEnvelope<Bank>>(this.base, payload));
  }

  async update(id: string, payload: BankUpdatePayload): Promise<SuccessEnvelope<Bank>> {
    return firstValueFrom(this.http.patch<SuccessEnvelope<Bank>>(`${this.base}/${encodeURIComponent(id)}`, payload));
  }

  async toggle(id: string, payload: BankToggle): Promise<SuccessEnvelope<Bank>> {
    return firstValueFrom(this.http.patch<SuccessEnvelope<Bank>>(`${this.base}/${encodeURIComponent(id)}/toggle`, payload));
  }

  async remove(id: string): Promise<SuccessEnvelope<{ id: string }>> {
    return firstValueFrom(this.http.delete<SuccessEnvelope<{ id: string }>>(`${this.base}/${encodeURIComponent(id)}`));
  }

  async requestLogoUpload(id: string, contentType: string): Promise<SuccessEnvelope<BankPresignedLogo>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<BankPresignedLogo>>(`${this.base}/${encodeURIComponent(id)}/logo/request-upload`, { contentType }),
    );
  }

  async confirmLogoUpload(id: string, key: string): Promise<SuccessEnvelope<Bank>> {
    return firstValueFrom(
      this.http.post<SuccessEnvelope<Bank>>(`${this.base}/${encodeURIComponent(id)}/logo/confirm-upload`, { key }),
    );
  }
}
