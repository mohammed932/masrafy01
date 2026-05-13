import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScoringVersionsApiService,
  type FactorCatalogEntry,
  type ScoringVersion,
} from '../../../scoring-versions/scoring-versions.api.service';
import type { ApprovalProbability, FactorImpact } from '../../api/applications.api.service';

interface RenderedFactor {
  code: string;
  impact: number;
  label: string;
  deprecated: boolean;
}

/**
 * "Why this score?" expander. Renders positive + negative factor rows with localized
 * sentences sourced from the OFFER'S engine version factor catalog (FR-020). Codes
 * removed in a later engine version render with a "Deprecated in v<active>" badge
 * (FR-020a). Legacy offers (engineVersion='1.0.0-legacy') render the legacy notice.
 *
 * See specs/004-approval-probability-display/design/promax-detail-panel.md.
 */
@Component({
  selector: 'app-why-this-score-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (probability(); as p) {
      <details class="panel" (toggle)="onToggle($event)">
        <summary class="summary">
          <span i18n="@@applications.detail.whyTitle">Why this score?</span>
          <span class="engine-version">v{{ p.engineVersion }}</span>
        </summary>

        @if (p.factors.legacy) {
          <p class="legacy" i18n="@@applications.detail.legacyNotice">
            Detailed factors unavailable for offers produced before engine version 1.1.0.
          </p>
        } @else {
          @if (loading()) {
            <p class="muted" i18n="@@applications.detail.loadingFactors">Loading factor labels…</p>
          } @else {
            @if (positive().length > 0) {
              <div class="group positive">
                <h4 i18n="@@applications.detail.positive">What helped</h4>
                <ul>
                  @for (f of positive(); track f.code) {
                    <li>
                      <span class="indicator" aria-hidden="true">↑</span>
                      <span class="factor-label">{{ f.label }}</span>
                      @if (f.deprecated) {
                        <span class="deprecated-badge" [attr.title]="deprecatedTitle()">
                          <ng-container i18n="@@applications.detail.deprecatedBadge">Deprecated</ng-container>
                        </span>
                      }
                      <span class="impact">+{{ f.impact }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (negative().length > 0) {
              <div class="group negative">
                <h4 i18n="@@applications.detail.negative">What hurt</h4>
                <ul>
                  @for (f of negative(); track f.code) {
                    <li>
                      <span class="indicator" aria-hidden="true">↓</span>
                      <span class="factor-label">{{ f.label }}</span>
                      @if (f.deprecated) {
                        <span class="deprecated-badge" [attr.title]="deprecatedTitle()">
                          <ng-container i18n="@@applications.detail.deprecatedBadge">Deprecated</ng-container>
                        </span>
                      }
                      <span class="impact">{{ f.impact }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
            @if (positive().length === 0 && negative().length === 0) {
              <p class="muted" i18n="@@applications.detail.noFactors">
                Score reflects the base model only — no profile-specific adjustments applied.
              </p>
            }
          }
        }

        @if (activeEngineVersion() && activeEngineVersion() !== p.engineVersion) {
          <p class="engine-mismatch">
            <span>{{ scoredUnderLabel(p.engineVersion) }}</span>
          </p>
        }
      </details>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .panel {
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md, 8px);
        padding: var(--space-3) var(--space-4);
      }
      .summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        font-size: 13px;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        list-style: none;
      }
      .summary::-webkit-details-marker {
        display: none;
      }
      .engine-version {
        font-size: 11px;
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .group {
        margin-block-start: var(--space-3);
      }
      .group h4 {
        margin: 0 0 var(--space-2);
        font-size: 11px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .group ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .group li {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding-block: 4px;
        font-size: 13px;
      }
      .indicator {
        width: 14px;
        text-align: center;
      }
      .group.positive .indicator {
        color: var(--color-success);
      }
      .group.negative .indicator {
        color: var(--color-error);
      }
      .factor-label {
        flex: 1;
        color: var(--color-text-primary);
      }
      .deprecated-badge {
        font-size: 10px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 2px 6px;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-default));
        color: var(--color-warning);
        white-space: nowrap;
      }
      .impact {
        font-variant-numeric: tabular-nums lining-nums;
        font-weight: var(--font-weight-semibold);
      }
      .group.positive .impact {
        color: var(--color-success);
      }
      .group.negative .impact {
        color: var(--color-error);
      }
      .legacy,
      .muted {
        margin: var(--space-3) 0 0;
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-muted);
        border-radius: var(--radius-sm);
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .engine-mismatch {
        margin: var(--space-3) 0 0;
        font-size: 11px;
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class WhyThisScorePanelComponent {
  readonly probability = input<ApprovalProbability | null>(null);
  readonly activeEngineVersion = input<string | null>(null);

  private readonly versionsApi = inject(ScoringVersionsApiService);
  protected readonly catalog = signal<ScoringVersion | null>(null);
  protected readonly loading = signal(false);
  protected readonly opened = signal(false);
  protected readonly positive = signal<RenderedFactor[]>([]);
  protected readonly negative = signal<RenderedFactor[]>([]);

  constructor() {
    // Fetch the catalog lazily — only after the operator expands the panel.
    effect(async () => {
      const p = this.probability();
      const isOpen = this.opened();
      if (!p || p.factors.legacy || !isOpen) return;
      if (this.catalog()?.version === p.engineVersion) {
        this.applyRenderedFactors(p, this.catalog()!);
        return;
      }
      this.loading.set(true);
      try {
        const cat = await this.versionsApi.getByVersion(p.engineVersion);
        this.catalog.set(cat);
        this.applyRenderedFactors(p, cat);
      } finally {
        this.loading.set(false);
      }
    });
  }

  protected onToggle(ev: Event): void {
    const t = ev.target as HTMLDetailsElement;
    this.opened.set(t.open);
  }

  protected deprecatedTitle(): string {
    const v = this.activeEngineVersion();
    return v
      ? $localize`:@@applications.detail.deprecatedTooltip:Deprecated in v${v}`
      : $localize`:@@applications.detail.deprecatedGeneric:Deprecated in the active engine`;
  }

  protected scoredUnderLabel(version: string): string {
    return $localize`:@@applications.detail.scoredUnder:Scored under engine v${version}`;
  }

  private applyRenderedFactors(p: ApprovalProbability, cat: ScoringVersion): void {
    const renderRow = (f: FactorImpact): RenderedFactor => ({
      code: f.code,
      impact: f.impact,
      label: this.resolveLabel(f.code, cat.factorCatalog),
      deprecated: this.isDeprecated(f.code, cat),
    });
    this.positive.set(p.factors.positive.map(renderRow));
    this.negative.set(p.factors.negative.map(renderRow));
  }

  private resolveLabel(
    code: string,
    catalog: Record<string, FactorCatalogEntry>,
  ): string {
    const entry = catalog[code];
    if (!entry) return code;
    // Trust the document `dir` attribute (set by @angular/localize at boot per locale).
    const isAr = document?.documentElement?.dir === 'rtl';
    return isAr ? entry.labelAr : entry.labelEn;
  }

  private isDeprecated(code: string, offerCat: ScoringVersion): boolean {
    const active = this.activeEngineVersion();
    if (!active || active === offerCat.version) return false;
    // If the offer's engine version has the code but the active version doesn't,
    // it's deprecated. We only know the offer's catalog here, so we approximate:
    // when active version differs AND the factor's code is missing from the
    // active catalog cache, mark deprecated. Cache miss = unknown = don't mark.
    const activeCat = this.versionsApi['cache'].get(active);
    return activeCat ? !(code in activeCat.factorCatalog) : false;
  }
}
