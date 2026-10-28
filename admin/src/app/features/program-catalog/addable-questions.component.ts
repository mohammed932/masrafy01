import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { PlusOutline, SearchOutline } from '@ant-design/icons-angular/icons';

/** A question this program does not ask yet, and may. */
export interface AddableRow {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly groupKey: string;
  readonly group: string;
  readonly isRequired: boolean;
  /** Questions it needs first, which an Add brings with it — named so it is said before. */
  readonly alsoAdds: readonly string[];
  /** Wording + code + answers, lower-cased. What search matches. */
  readonly haystack: string;
}

interface AddableGroup {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly AddableRow[];
}

/**
 * The questions a program name may add for its own applicants — every live question of the pool
 * that is not fixed, not read by every quote, not asked here already, and of the name's own
 * income type (income-proof or surrogate — the page picks). Grouped by the
 * questionnaire section it sits in; search narrows it. Drawn in the Add-a-question side sheet,
 * which scrolls, so every row shows — the search stays pinned above them.
 *
 * Emits the row; the page writes it (and confirms a required one).
 */
@Component({
  selector: 'app-addable-questions',
  standalone: true,
  imports: [RouterLink, NzButtonModule, NzIconModule, NzInputModule],
  providers: [provideNzIconsPatch([PlusOutline, SearchOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search" role="search">
      <label class="sr-only" for="addq-search" i18n="@@addq.search_label"
        >Search questions to add</label
      >
      <nz-input-group [nzPrefix]="searchIcon">
        <input
          nz-input
          id="addq-search"
          type="search"
          autocomplete="off"
          [value]="search()"
          placeholder="Search by wording or answer"
          i18n-placeholder="@@addq.search_placeholder"
          (input)="onSearch($event)"
        />
      </nz-input-group>
      <ng-template #searchIcon>
        <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
      </ng-template>
    </div>

    @if (rows().length === 0) {
      <p class="empty" i18n="@@addq.none">
        Every question of this program's income type is already asked here.
      </p>
    } @else if (matches().length === 0) {
      <p class="empty">
        <span i18n="@@addq.no_match">No question matches “{{ search() }}”.</span>
        <button nz-button nzType="link" type="button" class="inline-btn" (click)="clear()">
          <span i18n="@@addq.clear">Clear search</span>
        </button>
      </p>
    } @else {
      @for (group of groups(); track group.key) {
        <section class="group" [attr.aria-labelledby]="'addq-g-' + group.key">
          <h4 class="group-title" [id]="'addq-g-' + group.key">
            <span>{{ group.title }}</span>
            <span class="group-count">{{ group.rows.length }}</span>
          </h4>
          <ul class="rows">
            @for (row of group.rows; track row.id) {
              <li class="row">
                <span class="text">
                  <span class="label">{{ row.label }}</span>
                  @if (row.alsoAdds.length > 0) {
                    <span class="also">{{ alsoLabel(row) }}</span>
                  }
                </span>
                <span class="tail">
                  @if (!row.isRequired) {
                    <span class="tag" i18n="@@srvp.tag_optional">Optional</span>
                  }
                  <button
                    nz-button
                    nzType="text"
                    nzSize="small"
                    type="button"
                    class="add"
                    [nzLoading]="busy().has(row.id)"
                    [disabled]="busy().size > 0"
                    [attr.aria-label]="addLabel(row.label)"
                    (click)="add.emit(row)"
                  >
                    @if (!busy().has(row.id)) {
                      <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                    }
                    <span i18n="@@addq.add">Add</span>
                  </button>
                </span>
              </li>
            }
          </ul>
        </section>
      }
    }

    <p class="foot" i18n="@@addq.foot">
      Need a question that isn't here? Create it on
      <a routerLink="/questionnaire/questions">Questionnaire</a>.
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      /* Pinned to the top of the sheet's scrolling body, so a search is one reach away at
         row 30. The negative offset cancels the body's own padding; the surface fill keeps
         rows from showing through as they pass under it. */
      .search {
        position: sticky;
        inset-block-start: calc(-1 * var(--space-5));
        z-index: 1;
        margin-block-start: calc(-1 * var(--space-5));
        padding-block: var(--space-5) var(--space-3);
        background: var(--bg-surface);
      }
      .empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-4);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .inline-btn {
        padding-inline: 0;
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .group-title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .group-count {
        font-weight: var(--font-weight-regular);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
      }
      .rows {
        margin: 0;
        padding: 0;
        list-style: none;
        overflow: hidden;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-block-size: 48px;
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .row + .row {
        border-block-start: 1px solid var(--border-subtle);
      }
      .row:hover {
        background: var(--color-surface-row-hover);
      }
      .text {
        flex: 1 1 auto;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .label {
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .also {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .tail {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .tag {
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        line-height: 1.5;
        white-space: nowrap;
      }
      /* Text, not outlined: a column of bordered buttons down a long list is noise. Brand
         colour keeps it findable. */
      .add {
        color: var(--color-text-link);
        font-weight: var(--font-weight-medium);
      }
      .add:not([disabled]):hover {
        color: var(--color-text-link-hover);
      }
      .foot {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .foot a {
        color: var(--color-text-link);
        font-weight: var(--font-weight-medium);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .foot a:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      @media (max-width: 560px) {
        .row {
          flex-wrap: wrap;
        }
        .tail {
          flex-basis: 100%;
          justify-content: flex-end;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .row {
          transition: none;
        }
      }
    `,
  ],
})
export class AddableQuestionsComponent {
  readonly rows = input.required<readonly AddableRow[]>();
  /** Ids with a write in flight. */
  readonly busy = input<ReadonlySet<string>>(new Set<string>());

  readonly add = output<AddableRow>();

  protected readonly search = signal('');

  protected readonly matches = computed<readonly AddableRow[]>(() => {
    const needle = this.search().trim().toLowerCase();
    return needle === '' ? this.rows() : this.rows().filter((r) => r.haystack.includes(needle));
  });

  /** Keyed and merged, so a section split by a search is headed once. */
  protected readonly groups = computed<readonly AddableGroup[]>(() => {
    const order: string[] = [];
    const byKey = new Map<string, { title: string; rows: AddableRow[] }>();
    for (const row of this.matches()) {
      let entry = byKey.get(row.groupKey);
      if (entry === undefined) {
        entry = { title: row.group, rows: [] };
        byKey.set(row.groupKey, entry);
        order.push(row.groupKey);
      }
      entry.rows.push(row);
    }
    return order.map((key) => ({ key, title: byKey.get(key)!.title, rows: byKey.get(key)!.rows }));
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.search.set('');
  }

  protected addLabel(label: string): string {
    return $localize`:@@addq.add_aria:Add “${label}:QUESTION:” to this program`;
  }

  protected alsoLabel(row: AddableRow): string {
    return $localize`:@@addq.also:Also asks first: ${row.alsoAdds.join(' · ')}:QUESTIONS:`;
  }
}
