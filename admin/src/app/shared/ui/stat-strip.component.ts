import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

export interface StatStripItem {
  label: string;
  value: number | string;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'error';
  /** ng-zorro icon nzType rendered in the tonal chip, e.g. 'team'. */
  icon?: string;
  /** Small supporting line under the number, e.g. 'staff accounts' or '86% live'. */
  hint?: string;
}

const COUNT_UP_DURATION_MS = 600;

@Component({
  selector: 'app-stat-strip',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="strip" [attr.data-layout]="layout()" [attr.aria-label]="ariaLabel()">
      @for (s of items(); track s.label; let i = $index) {
        <div class="card" [attr.data-tone]="s.tone ?? 'default'">
          <div class="head">
            <dt>{{ s.label }}</dt>
            @if (s.icon) {
              <span class="chip" [attr.data-tone]="s.tone ?? 'default'" aria-hidden="true">
                <span nz-icon [nzType]="s.icon" nzTheme="outline"></span>
              </span>
            }
          </div>
          <dd [attr.data-tone]="s.tone ?? 'default'" class="numeric">{{ render(s, i) }}</dd>
          @if (s.hint) {
            <span class="hint">{{ s.hint }}</span>
          }
        </div>
      }
    </dl>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-4);
        margin: 0;
      }
      /* Single row of content-sized cards — for narrow slots (e.g. a page-header
         aside) where auto-fit would collapse the cards into a stack. */
      .strip[data-layout='row'] {
        grid-auto-flow: column;
        grid-auto-columns: minmax(140px, max-content);
        grid-template-columns: none;
      }
      @media (max-width: 540px) {
        .strip,
        .strip[data-layout='row'] {
          grid-auto-flow: row;
          grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
          gap: var(--space-3);
        }
      }
      .card {
        display: flex;
        flex-direction: column;
        padding: var(--space-4) var(--space-5);
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-brand-primary);
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-3);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
        font-size: var(--text-lg);
        background: color-mix(in srgb, var(--color-brand-primary) 12%, transparent);
        color: var(--color-brand-primary);
        flex-shrink: 0;
      }
      .chip[data-tone='success'] {
        background: color-mix(in srgb, var(--color-success) 12%, transparent);
        color: var(--color-success);
      }
      .chip[data-tone='warning'] {
        background: color-mix(in srgb, var(--color-warning) 12%, transparent);
        color: var(--color-warning);
      }
      .chip[data-tone='error'] {
        background: color-mix(in srgb, var(--color-error) 12%, transparent);
        color: var(--color-error);
      }
      .chip[data-tone='muted'] {
        background: color-mix(in srgb, var(--color-text-tertiary) 14%, transparent);
        color: var(--color-text-tertiary);
      }
      dt {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      dd {
        margin: 0;
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: 1;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums lining-nums;
      }
      dd[data-tone='muted'] {
        color: var(--color-text-tertiary);
      }
      dd[data-tone='success'] {
        color: var(--color-success);
      }
      dd[data-tone='warning'] {
        color: var(--color-warning);
      }
      dd[data-tone='error'] {
        color: var(--color-error);
      }
      .hint {
        margin-block-start: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        line-height: 1.3;
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
        .card:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class StatStripComponent {
  readonly items = input.required<readonly StatStripItem[]>();
  readonly ariaLabel = input<string>('Statistics');
  /** `auto` fills the available width; `row` keeps one horizontal line of cards. */
  readonly layout = input<'auto' | 'row'>('auto');

  private readonly zone = inject(NgZone);
  private readonly displayed = signal<readonly number[]>([]);
  private rafId: number | null = null;
  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(
      () => {
        const targets = this.items().map((s) => (typeof s.value === 'number' ? s.value : null));
        this.animateTo(targets);
      },
      { allowSignalWrites: true },
    );
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  /** Rendered cell value — animated integer for numbers, verbatim for strings. */
  protected render(item: StatStripItem, index: number): number | string {
    if (typeof item.value !== 'number') {
      return item.value;
    }
    return this.displayed()[index] ?? item.value;
  }

  private animateTo(targets: readonly (number | null)[]): void {
    this.cancel();
    // Read untracked: this method runs inside `effect`, and `displayed` is also
    // written every animation frame. Tracking the read would re-trigger the
    // effect each frame, cancel the in-flight rAF, and pin the tween at frame 0.
    const current = untracked(() => this.displayed());
    const startVals = targets.map((t, i) => (t === null ? 0 : (current[i] ?? 0)));
    const finals = targets.map((t) => t ?? 0);

    if (this.reduceMotion || typeof requestAnimationFrame === 'undefined') {
      this.displayed.set(finals);
      return;
    }

    const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
    let startTs: number | null = null;

    const step = (ts: number): void => {
      startTs ??= ts;
      const progress = Math.min(1, (ts - startTs) / COUNT_UP_DURATION_MS);
      const eased = easeOutCubic(progress);
      const next = targets.map((t, i) =>
        t === null ? 0 : Math.round(startVals[i]! + (t - startVals[i]!) * eased),
      );
      this.zone.run(() => this.displayed.set(next));
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = null;
      }
    };

    this.zone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(step);
    });
  }

  private cancel(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }
}
