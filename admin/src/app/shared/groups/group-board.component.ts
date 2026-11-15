/**
 * Own groups, edited on one board (v37.0.0) — the class board's shape (Manage values): a rail of
 * groups with their counts, then ONE panel for the group on stage, holding its answers as cards
 * and every other answer as a card that moves in on a press.
 *
 * Unlike the class board this writes nothing: it is held state on a page with its own Save (a
 * surrogate method, a product), so every gesture is an output and the host owns the data.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  ArrowRightOutline,
  UnorderedListOutline,
  DeleteOutline,
  ExclamationCircleOutline,
  PlusOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { RouterLink } from '@angular/router';
import { RailTabsComponent, type RailTabItem } from '@shared/ui';

export interface BoardGroup {
  key: string;
  labelEn: string;
  labelAr: string;
}

export interface BoardAnswer {
  code: string;
  label: string;
}

@Component({
  selector: 'app-group-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, NzIconModule, NzInputModule, RailTabsComponent, RouterLink],
  providers: [
    provideNzIconsPatch([
      ArrowRightOutline,
      UnorderedListOutline,
      DeleteOutline,
      ExclamationCircleOutline,
      PlusOutline,
      SearchOutline,
    ]),
  ],
  template: `
    @if (question(); as q) {
      <p class="source">
        <span nz-icon nzType="unordered-list" nzTheme="outline" aria-hidden="true"></span>
        <span>
          <span i18n="@@gb.source_q">The answers are the answers to</span>{{ ' ' }}
          <b>“{{ q }}”</b>.
          @if (listType(); as t) {
            <span i18n="@@gb.source_list"
              >They come from its list in Manage values: add or rename one there and it shows up
              here.</span
            >
            <a [routerLink]="['/lookups']" [queryParams]="{ type: t }" i18n="@@gb.source_open"
              >Open the list</a
            >
          } @else {
            <span i18n="@@gb.source_own">They are set on the question itself.</span>
          }
        </span>
      </p>
    }
    @if (unplaced().length > 0) {
      <p class="notice" role="status">
        <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
        <span>{{ unplacedLabel() }}</span>
      </p>
    }

    <div class="rail">
      @if (groups().length > 0) {
        <app-rail-tabs
          [items]="tabs()"
          [activeId]="activeKey()"
          [ariaLabel]="railAria"
          idPrefix="gb"
          appearance="segmented"
          (select)="activeKey.set($event)"
        />
      } @else {
        <p class="empty" i18n="@@gb.empty">No groups yet. Add one, name it, then move answers into it.</p>
      }
      <button nz-button nzType="dashed" type="button" class="add" (click)="addGroup()">
        <span nz-icon nzType="plus" nzTheme="outline"></span>
        <span i18n="@@gb.add">Group</span>
      </button>
    </div>

    @if (active(); as g) {
      <section
        class="panel"
        role="tabpanel"
        [id]="'gb-panel-' + g.key"
        [attr.aria-labelledby]="'gb-tab-' + g.key"
        [style.--gb-accent]="accent(activeIndex())"
      >
        <header class="head">
          <span class="rank" aria-hidden="true">{{ activeIndex() + 1 }}</span>
          <label class="name">
            <span class="sr-only" i18n="@@gb.name_en">Name in English</span>
            <input
              nz-input
              [value]="g.labelEn"
              (change)="rename(g.key, val($event), null)"
              [placeholder]="enPlaceholder"
            />
          </label>
          <label class="name">
            <span class="sr-only" i18n="@@gb.name_ar">Name in Arabic</span>
            <input
              nz-input
              dir="rtl"
              [value]="g.labelAr"
              (change)="rename(g.key, null, val($event))"
              [placeholder]="arPlaceholder"
            />
          </label>
          @if (groups().length > minGroups()) {
            <button
              nz-button
              nzType="text"
              nzDanger
              type="button"
              class="drop"
              (click)="remove(g.key)"
            >
              <span nz-icon nzType="delete" nzTheme="outline"></span>
              <span i18n="@@gb.remove">Remove group</span>
            </button>
          }
        </header>
        <p class="sub">{{ summary() }}</p>

        <div class="toolbar">
          <span class="search">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <input
              nz-input
              type="search"
              [value]="query()"
              (input)="query.set(val($event))"
              [placeholder]="searchPlaceholder"
              [attr.aria-label]="searchPlaceholder"
            />
          </span>
          @if (elsewhere().length > 1) {
            <button nz-button nzType="default" type="button" class="bulk" (click)="moveAll()">
              {{ moveAllLabel() }}
            </button>
          }
        </div>

        <h3 class="group-h" i18n="@@gb.in_group">In this group</h3>
        @if (inGroup().length === 0) {
          <p class="empty" i18n="@@gb.in_group_empty">
            No answer is in this group yet. Press one below to move it in.
          </p>
        } @else {
          <ul class="grid">
            @for (a of inGroup(); track a.code) {
              <li>
                <button
                  type="button"
                  class="card is-in"
                  [attr.aria-label]="takeOutAria(a)"
                  (click)="placed.emit({ code: a.code, group: '' })"
                >
                  <span class="lead is-out" aria-hidden="true">
                    <span nz-icon nzType="arrow-right" nzTheme="outline"></span>
                  </span>
                  <span class="label">{{ a.label }}</span>
                </button>
              </li>
            }
          </ul>
        }

        @if (elsewhere().length > 0) {
          <h3 class="group-h" i18n="@@gb.elsewhere">Elsewhere</h3>
          <p class="note" i18n="@@gb.elsewhere_note">
            Press one to move it into this group. It leaves the group it is in now.
          </p>
          <ul class="grid">
            @for (a of elsewhere(); track a.code) {
              <li>
                <button
                  type="button"
                  class="card"
                  [class.is-loose]="placementOf(a.code) === ''"
                  [attr.aria-label]="moveInAria(a)"
                  (click)="placed.emit({ code: a.code, group: g.key })"
                >
                  <span class="lead" aria-hidden="true">
                    <span nz-icon nzType="arrow-right" nzTheme="outline"></span>
                  </span>
                  <span class="label">{{ a.label }}</span>
                  <span class="tag" [class.is-warn]="placementOf(a.code) === ''">{{
                    whereLabel(a.code)
                  }}</span>
                </button>
              </li>
            }
          </ul>
        }
        <p class="foot" i18n="@@gb.foot">
          Each answer is in one group at most. An answer in no group gets no amount.
        </p>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        inline-size: 100%;
      }
      .notice {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3);
        padding: var(--space-2-5) var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface-default));
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .empty {
        flex: 1 1 auto;
        margin: 0;
        padding: var(--space-4);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-lg);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .rail {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .rail app-rail-tabs {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .add {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      /* One surface: the rail above it, the two grids inside it. */
      .panel {
        margin-block-start: var(--space-3);
        padding: var(--space-4) var(--space-5) var(--space-5);
        border: 1px solid var(--color-border-default);
        border-block-start: 2px solid var(--gb-accent);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
      }
      .head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
      }
      .rank {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--gb-accent) 18%, var(--color-surface-page));
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .name {
        flex: 1 1 12rem;
        max-inline-size: 18rem;
      }
      .name input {
        font-weight: 600;
      }
      .drop {
        margin-inline-start: auto;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .sub {
        margin: var(--space-2) 0 var(--space-4);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .search {
        position: relative;
        flex: 1 1 14rem;
        max-inline-size: 22rem;
      }
      .search [nz-icon] {
        position: absolute;
        inset-inline-start: var(--space-3);
        inset-block-start: 50%;
        translate: 0 -50%;
        color: var(--color-text-tertiary);
        pointer-events: none;
      }
      .search input {
        padding-inline-start: var(--space-8);
      }
      .bulk {
        margin-inline-start: auto;
      }
      .group-h {
        margin: var(--space-5) 0 var(--space-2);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: 600;
      }
      .group-h:first-of-type {
        margin-block-start: 0;
      }
      .note,
      .empty {
        margin: 0 0 var(--space-3);
        max-inline-size: 44rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: 1.6;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
        grid-auto-rows: 1fr;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .card {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        inline-size: 100%;
        block-size: 100%;
        min-block-size: 3rem;
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition:
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          background-color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .card:hover {
        border-color: color-mix(in srgb, var(--gb-accent) 55%, var(--color-border-default));
        background: color-mix(in srgb, var(--gb-accent) 6%, var(--color-surface-default));
      }
      .card:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }
      /* In the group: the accent is earned, so it is the filled state. */
      .card.is-in {
        border-color: color-mix(in srgb, var(--gb-accent) 45%, transparent);
        background: color-mix(in srgb, var(--gb-accent) 8%, var(--color-surface-default));
      }
      .card.is-in:hover {
        border-color: color-mix(in srgb, var(--gb-accent) 70%, transparent);
        background: color-mix(in srgb, var(--gb-accent) 14%, var(--color-surface-default));
      }
      .card.is-loose {
        border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
      }
      .label {
        flex: 1 1 8rem;
        min-inline-size: 0;
      }
      .lead {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        transition: color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .card:hover .lead,
      .card:focus-visible .lead {
        color: var(--gb-accent);
      }
      /* One glyph for both verbs: "out" is the mirror of "in", and RTL mirrors both. */
      .lead.is-out [nz-icon] {
        transform: scaleX(-1);
      }
      :host-context([dir='rtl']) .lead [nz-icon] {
        transform: scaleX(-1);
      }
      :host-context([dir='rtl']) .lead.is-out [nz-icon] {
        transform: none;
      }
      .tag {
        flex: none;
        margin-inline-start: auto;
        padding: var(--space-0-5) var(--space-2);
        border-radius: 999px;
        background: var(--color-surface-page);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }
      .tag.is-warn {
        background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-page));
        color: var(--color-text-primary);
      }
      .source {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0 0 var(--space-3);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .source b {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-semibold);
      }
      .source [nz-icon] {
        margin-block-start: var(--space-1);
        color: var(--color-brand-primary);
      }
      .source a {
        margin-inline-start: var(--space-1);
        color: var(--color-text-link);
        font-weight: var(--font-weight-semibold);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }
      .source a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .foot {
        margin: var(--space-5) 0 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--color-border-default);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (max-width: 600px) {
        .panel {
          padding: var(--space-3);
        }
        .name {
          max-inline-size: none;
        }
        .bulk {
          margin-inline-start: 0;
        }
        .rail {
          flex-direction: column;
          align-items: stretch;
        }
        .add {
          align-self: flex-start;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card,
        .lead {
          transition: none;
        }
      }
    `,
  ],
})
export class GroupBoardComponent {
  readonly groups = input.required<readonly BoardGroup[]>();
  readonly answers = input.required<readonly BoardAnswer[]>();
  /** Answer code → group key; a missing code is in no group. */
  readonly placements = input.required<Readonly<Record<string, string>>>();
  /** Groups that must remain (a column split needs two). */
  readonly minGroups = input(0);
  /** The question the answers belong to, and the managed list they come from (if any). */
  readonly question = input<string | null>(null);
  readonly listType = input<string | null>(null);
  readonly isAr = input(false);

  readonly renamed = output<{ key: string; labelEn: string | null; labelAr: string | null }>();
  readonly added = output<void>();
  readonly removed = output<string>();
  readonly placed = output<{ code: string; group: string }>();

  protected readonly activeKey = signal('');
  protected readonly query = signal('');

  protected readonly railAria = $localize`:@@gb.rail:Groups`;
  protected readonly enPlaceholder = $localize`:@@gb.en:Name in English`;
  protected readonly arPlaceholder = $localize`:@@gb.ar:الاسم بالعربية`;
  protected readonly searchPlaceholder = $localize`:@@gb.search:Search answers`;

  constructor() {
    // The panel always shows a group: the first one, or the one just added.
    let seen = 0;
    effect(() => {
      const groups = this.groups();
      untracked(() => {
        if (groups.length > seen && seen > 0) this.activeKey.set(groups.at(-1)!.key);
        else if (!groups.some((g) => g.key === this.activeKey()))
          this.activeKey.set(groups[0]?.key ?? '');
        seen = groups.length;
      });
    });
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected name(g: BoardGroup): string {
    return ((this.isAr() ? g.labelAr : g.labelEn) || g.labelEn || g.labelAr).trim();
  }

  private count(key: string): number {
    const p = this.placements();
    return this.answers().filter((a) => p[a.code] === key).length;
  }

  protected readonly tabs = computed<readonly RailTabItem[]>(() =>
    this.groups().map((g) => {
      const n = this.count(g.key);
      return {
        id: g.key,
        label: this.name(g),
        note: n === 1 ? $localize`:@@gb.count_one:1 answer` : $localize`:@@gb.count:${n}:N: answers`,
        warn: n === 0,
        warnLabel: $localize`:@@gb.count_none:No answer in this group`,
      };
    }),
  );

  protected readonly active = computed(
    () => this.groups().find((g) => g.key === this.activeKey()) ?? this.groups()[0] ?? null,
  );
  protected readonly activeIndex = computed(() =>
    Math.max(
      0,
      this.groups().findIndex((g) => g.key === this.active()?.key),
    ),
  );

  /** The rank accent: strongest on the first group, as on the class board. */
  protected accent(index: number): string {
    const total = Math.max(1, this.groups().length);
    const strength = Math.round(100 - (index / total) * 45);
    return `color-mix(in srgb, var(--color-brand-primary) ${strength}%, var(--color-text-tertiary))`;
  }

  private readonly matching = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q === ''
      ? this.answers()
      : this.answers().filter((a) => a.label.toLowerCase().includes(q));
  });

  protected readonly inGroup = computed(() => {
    const key = this.active()?.key;
    const p = this.placements();
    return this.matching().filter((a) => p[a.code] === key);
  });

  /** Everything not here, the answers in no group first. */
  protected readonly elsewhere = computed(() => {
    const key = this.active()?.key;
    const p = this.placements();
    const rest = this.matching().filter((a) => p[a.code] !== key);
    return [...rest.filter((a) => !p[a.code]), ...rest.filter((a) => !!p[a.code])];
  });

  protected readonly unplaced = computed(() => {
    const p = this.placements();
    return this.answers().filter((a) => !p[a.code]);
  });

  protected unplacedLabel(): string {
    const n = this.unplaced().length;
    return $localize`:@@gb.unplaced:${n}:N: answer(s) are in no group, so they get no amount.`;
  }

  protected summary(): string {
    const n = this.count(this.active()?.key ?? '');
    const total = this.answers().length;
    return $localize`:@@gb.summary:${n}:N: of ${total}:TOTAL: answers are in this group.`;
  }

  protected placementOf(code: string): string {
    return this.placements()[code] ?? '';
  }

  protected whereLabel(code: string): string {
    const key = this.placementOf(code);
    if (key === '') return $localize`:@@gb.in_none:In no group`;
    const g = this.groups().find((x) => x.key === key);
    const name = g ? this.name(g) : key;
    return $localize`:@@gb.now_in:Now in ${name}:NAME:`;
  }

  protected moveAllLabel(): string {
    const n = this.elsewhere().length;
    return $localize`:@@gb.move_all:Move all ${n}:N: here`;
  }

  protected moveInAria(a: BoardAnswer): string {
    const name = a.label;
    return $localize`:@@gb.move_in_aria:Move ${name}:NAME: into this group`;
  }

  protected takeOutAria(a: BoardAnswer): string {
    const name = a.label;
    return $localize`:@@gb.take_out_aria:Take ${name}:NAME: out of this group`;
  }

  protected moveAll(): void {
    const key = this.active()?.key;
    if (!key) return;
    for (const a of this.elsewhere()) this.placed.emit({ code: a.code, group: key });
  }

  protected rename(key: string, en: string | null, ar: string | null): void {
    this.renamed.emit({ key, labelEn: en, labelAr: ar });
  }

  protected addGroup(): void {
    this.added.emit();
  }

  protected remove(key: string): void {
    this.removed.emit(key);
  }
}
