import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { DistributionBucket } from '../scoring-analytics.api.service';

interface Bar {
  bucket: number;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  tooltip: string;
}

/**
 * Single-pass inline SVG histogram of approval-score distribution.
 * No charting library — Plan §Primary Dependencies forbids new packages.
 */
@Component({
  selector: 'app-score-distribution-histogram',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bars().length === 0) {
      <p class="empty" i18n="@@analytics.dist.empty">No matched offers in this window.</p>
    } @else {
      <svg
        viewBox="0 0 800 240"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <g class="bars">
          @for (b of bars(); track b.bucket) {
            <g class="bar">
              <rect
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.width"
                [attr.height]="b.height"
                rx="4"
              >
                <title>{{ b.tooltip }}</title>
              </rect>
              <text [attr.x]="b.x + b.width / 2" y="232" text-anchor="middle">{{ b.label }}</text>
            </g>
          }
        </g>
      </svg>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      svg {
        width: 100%;
        height: 240px;
      }
      rect {
        fill: var(--color-tonal-accent);
        opacity: 0.78;
      }
      rect:hover {
        opacity: 1;
      }
      text {
        font-size: 10px;
        fill: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .empty {
        padding: var(--space-6);
        text-align: center;
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class ScoreDistributionHistogramComponent {
  readonly buckets = input<DistributionBucket[]>([]);

  protected readonly bars = computed<Bar[]>(() => {
    const buckets = this.buckets();
    if (buckets.length === 0) return [];
    // Always render exactly 10 buckets — fill zeros for missing ones.
    const counts = Array.from({ length: 10 }, (_, i) => {
      const found = buckets.find((b) => b.bucket === i);
      return found?.count ?? 0;
    });
    // Bucket 10 (score === 100) merges into bucket 9.
    const tenBucket = buckets.find((b) => b.bucket === 10);
    if (tenBucket) counts[9] = (counts[9] ?? 0) + tenBucket.count;
    const max = Math.max(1, ...counts);
    const barWidth = 800 / 10 - 12;
    return counts.map((count, bucket) => {
      const heightPct = count / max;
      const height = Math.max(2, 200 * heightPct);
      return {
        bucket,
        count,
        x: bucket * 80 + 6,
        y: 220 - height,
        width: barWidth,
        height,
        label: `${bucket * 10}–${bucket * 10 + 9}`,
        tooltip: $localize`:@@analytics.dist.tooltip:Score ${bucket * 10}–${bucket * 10 + 9} — ${count} offers`,
      };
    });
  });

  protected readonly ariaLabel = computed(
    () =>
      $localize`:@@analytics.dist.aria:Approval score distribution histogram with 10 ten-point buckets`,
  );
}
