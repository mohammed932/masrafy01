import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export interface FactorCatalogEntry {
  labelAr: string;
  labelEn: string;
}

export interface ScoringVersion {
  version: string;
  thresholds: { excellent: number; good: number; moderate: number; low: number };
  factorCatalog: Record<string, FactorCatalogEntry>;
  legacy: boolean;
}

@Injectable({ providedIn: 'root' })
export class ScoringVersionsApiService {
  private readonly http = inject(HttpClient);
  /** In-memory cache. Versions rarely change; one fetch per version per session is plenty. */
  private readonly cache = new Map<string, ScoringVersion>();
  /** Signal exposes the active engine version once the first read happens. */
  readonly activeVersion = signal<string | null>(null);

  private base(): string {
    return environment.apiBaseUrl;
  }

  async getByVersion(version: string): Promise<ScoringVersion> {
    const hit = this.cache.get(version);
    if (hit) return hit;
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<ScoringVersion>>(`${this.base()}/scoring-versions/${version}`),
    );
    this.cache.set(version, res.data);
    return res.data;
  }

  rememberActive(version: string): void {
    this.activeVersion.set(version);
  }
}
