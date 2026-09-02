/**
 * One enumeration type's values, self-contained: loads them, renders them, and owns every
 * mutation.
 *
 * Extracted from `lookups.page.ts`, which owned the reload / optimistic-toggle / delete /
 * open-dialog quartet in page-level signals. That was fine while Manage values was the only
 * host and showed ONE type at a time. A surrogate product's workspace shows N types at once
 * — every list its calculation reads — and page-level signals cannot express N.
 *
 * A SMART PANEL, not a store. A store would have to be keyed by type and every consumer
 * would have to remember to scope its reads; one panel per type composes by construction,
 * and two panels on one screen cannot read each other's rows by accident.
 *
 * `app-lookup-value-list` stays purely presentational underneath (inputs, outputs, zero
 * injections) — this component is the half that talks to the server.
 */
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import {
  DownloadOutline,
  PlusOutline,
  UnorderedListOutline,
} from '@ant-design/icons-angular/icons';
import { Router } from '@angular/router';
import { SkeletonRowsComponent, openFormDrawer } from '@shared/ui';
import { LookupsApiService, type EnumerationRow } from '@features/lookups/lookups.api.service';
import { LookupValueListComponent, type LookupActiveToggle } from './lookup-value-list.component';
import {
  EnumerationEditDrawerComponent,
  type EnumerationEditDrawerData,
} from './enumeration-edit.drawer';
import { EnumerationTypesService } from './enumeration-types.service';
import { CATALOG_NEW } from '@features/program-catalog/program-catalog.paths';

/** The catalog names' own type — created on their own screen, never in this panel. */
const PROGRAM_NAME_TYPE = 'program_name';

@Component({
  selector: 'app-lookup-values-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, NzIconModule, SkeletonRowsComponent, LookupValueListComponent],
  providers: [provideNzIconsPatch([DownloadOutline, PlusOutline, UnorderedListOutline])],
  template: `
    <section class="panel">
      <header class="head">
        <div class="titles">
          <h3>{{ title() }}</h3>
          @if (description(); as text) {
            <p>{{ text }}</p>
          }
        </div>
        <div class="acts">
          <!-- Two peers of equal weight is a hierarchy failure: side by side and identically
               drawn, neither says which is the everyday case. Adding one value is; a paste is
               the load, done once and then rarely. So the paste is drawn as a LINK and the add
               keeps the button — one glance, one obvious default, and the rarer action still
               one click away and named in full. -->
          <button type="button" class="paste-link" (click)="openPaste()">
            <span nz-icon nzType="unordered-list" nzTheme="outline" aria-hidden="true"></span>
            {{ pasteLabel }}
          </button>
          <!-- The other half of the round trip, and drawn at the same weight as the paste it
               feeds: what comes out opens straight back into the paste screen, so an operator
               can fix a hundred Arabic labels in a sheet instead of a hundred drawers. Hidden
               while the list is empty — an export of nothing is a file that teaches the
               operator the button is broken. -->
          @if (rows().length > 0) {
            <button type="button" class="paste-link" (click)="exportCsv()">
              <span nz-icon nzType="download" nzTheme="outline" aria-hidden="true"></span>
              {{ exportLabel }}
            </button>
          }
          <button nz-button nzType="default" type="button" (click)="openCreate()">
            <span nz-icon nzType="plus" nzTheme="outline"></span>
            {{ addLabel }}
          </button>
        </div>
      </header>

      @if (loading()) {
        <app-skeleton-rows [rows]="4" [cols]="[3, 1, 1]" [ariaLabel]="loadingLabel" />
      } @else {
        <app-lookup-value-list
          [rows]="rows()"
          [parents]="parentRows()"
          [deletable]="deletable()"
          (edit)="openEdit($event)"
          (toggleActive)="setActive($event)"
          (remove)="remove($event)"
        />
      }
    </section>
  `,
  styles: [
    `
      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .acts {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .paste-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-link);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .paste-link:hover {
        color: var(--color-text-link-hover);
      }
      .paste-link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      @media (prefers-reduced-motion: reduce) {
        .paste-link {
          transition: none;
        }
      }

      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }

      .titles {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        /* Lets the description wrap instead of pushing the button off the row. */
        min-inline-size: 0;
        flex: 1 1 22rem;
      }

      h3 {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      p {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.5;
      }
    `,
  ],
})
export class LookupValuesPanelComponent {
  private readonly api = inject(LookupsApiService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly drawer = inject(NzDrawerService);
  private readonly router = inject(Router);

  /** The enumeration type this panel renders. Changing it reloads. */
  readonly type = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  /**
   * Whether the server will entertain a DELETE for this type.
   *
   * An INPUT, not something this panel reads for itself. It is a static per-type fact that
   * only `GET /enumerations/types` knows — an endpoint that counts active, deprecated and
   * referenced rows for EVERY registry type. Fetching it here meant one such aggregate per
   * mounted panel (two on a product page) plus two more on every write. The host already
   * knows, or can ask once for all its panels.
   */
  readonly deletable = input<boolean>(true);

  /**
   * Raised after any write that changed the rows.
   *
   * The panel cannot know what else on the host depends on this list — a product page
   * shows a class board fed by the same values — so it reports rather than guesses.
   */
  readonly changed = output<void>();

  protected readonly rows = signal<readonly EnumerationRow[]>([]);
  /**
   * The list THIS type's values are filed under, when it has one.
   *
   * Loaded beside the rows, not inside the list component: the class badge on a row and the
   * class picker in the edit dialog have to name the same set, and two fetches could
   * disagree about which classes are live.
   */
  protected readonly parentRows = signal<readonly EnumerationRow[]>([]);
  protected readonly loading = signal(true);

  protected readonly addLabel = $localize`:@@lookups.addValue:Add value`;
  protected readonly pasteLabel = $localize`:@@pv.open:Paste a list`;
  protected readonly exportLabel = $localize`:@@pv.export:Download as CSV`;
  protected readonly loadingLabel = $localize`:@@lookups.loading.values:Loading values`;

  constructor() {
    // Reloads whenever `type` changes, so a host may swap the panel's subject without
    // reaching in.
    //
    // `allowSignalWrites` because `reload` sets `loading` SYNCHRONOUSLY before its first
    // await — writing state in response to an input change is exactly what this effect is
    // for, and Angular's default guard exists to catch the accidental version of that.
    effect(
      () => {
        const type = this.type();
        void this.reload(type);
      },
      { allowSignalWrites: true },
    );
  }

  /** Re-read from the server. Public so a host can refresh after its own write. */
  async reload(type = this.type(), opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      this.rows.set(await this.api.list(type));
      const parentType = this.enumTypes.parentTypeOf(type);
      this.parentRows.set(parentType ? await this.api.list(parentType) : []);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  /**
   * Off to the paste screen, carrying where to come back to.
   *
   * A navigation and not a drawer: see `PasteValuesPage` for the size argument. `from` is a
   * fixed token rather than a return URL — an arbitrary path in a query parameter is an
   * open-redirect surface for no gain.
   */
  protected openPaste(): void {
    void this.router.navigate(['/lookups/paste'], {
      queryParams: { type: this.type(), from: 'lookups' },
    });
  }

  /**
   * Write the list out in the shape the paste screen reads back: `labelEn,labelAr,class`.
   *
   * NOT quoted, and that is the round trip rather than a shortcut: `parse-pasted-values.ts`
   * deliberately ships no CSV quoter and splits from the END, so `Mivida, Phase 2,ميفيدا,AA`
   * already parses correctly while a quoted `"Mivida, Phase 2"` would come back WITH its
   * quotes as part of the name. Writing what the reader reads is the whole point; a quoter
   * here would need one there, which is the rule that file exists to avoid.
   *
   * The class column carries the class's own LABEL rather than its key, because the parser
   * matches either and a label is what an operator can check in a spreadsheet. A row with no
   * class writes an empty third column, which reads back as the catch-all — the same answer
   * the server gives it.
   *
   * The BOM is what makes Excel open Arabic labels as Arabic rather than mojibake.
   */
  protected exportCsv(): void {
    const parents = new Map(this.parentRows().map((p) => [p.key, p]));
    // A separator inside the Arabic label or the class name WOULD mis-split on the way back,
    // because only the English head may hold one. Replaced with a space rather than quoted:
    // an operator can see a changed label in the preview, and cannot see a quoting rule.
    const cell = (value: string): string => value.replace(/,/g, ' ').trim();
    const lines = this.rows().map((row) => {
      const parent = row.parentKey ? parents.get(row.parentKey) : undefined;
      const className = parent ? parent.labelEn : (row.parentKey ?? '');
      return [row.labelEn.trim(), cell(row.labelAr), cell(className)].join(',');
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n') + '\n'], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.type()}.csv`;
    link.click();
    // Revoked on the next frame rather than immediately: Safari has not started the download
    // when `click()` returns, and revoking first hands it an empty file.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  protected openCreate(): void {
    // A catalog program name is not a value with a label: it states how its income is proved
    // and, on one of those two answers, which calculation it quotes from — which is a screen,
    // not a sheet, and it is `/program-catalog/new`.
    //
    // This panel can genuinely reach `program_name`: it is off the values rail
    // (`onValuesRail: false`), but `retiredDefs()` is deliberately "retired OR off the rail",
    // so "Show retired lists" surfaces it. Without this branch that door opens a form with no
    // basis question at all and silently mints a payslip name.
    if (this.type() === PROGRAM_NAME_TYPE) {
      void this.router.navigate([CATALOG_NEW]);
      return;
    }
    this.openDrawer({ mode: 'create', type: this.type() });
  }

  protected openEdit(row: EnumerationRow): void {
    this.openDrawer({ mode: 'edit', type: row.type, row });
  }

  /** Optimistic flip — the global error interceptor surfaces the toast on failure. */
  protected async setActive({ row, next }: LookupActiveToggle): Promise<void> {
    this.patchRow(row.id, { active: next });
    try {
      await this.api.update(row.id, { active: next });
      await this.afterMutation({ silent: true });
    } catch {
      this.patchRow(row.id, { active: row.active });
    }
  }

  /**
   * Hard delete. NOT optimistic, unlike the toggle above: dropping the row locally and
   * putting it back on failure would flash the one state the operator must not doubt — a
   * value that is still there reading as gone. So the list only changes once the server has
   * agreed, and the refusal (`ENUMERATION_IN_USE`, which names how many places still use
   * it) arrives as the interceptor's toast.
   */
  protected async remove(row: EnumerationRow): Promise<void> {
    try {
      await this.api.remove(row.id);
    } catch {
      // Swallowed deliberately: the toast interceptor has already said why, and an
      // unhandled rejection out of a template handler is noise on top of it.
      return;
    }
    await this.afterMutation({ silent: true });
  }

  private patchRow(id: string, patch: Partial<EnumerationRow>): void {
    this.rows.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  private async afterMutation(opts: { silent?: boolean } = {}): Promise<void> {
    await this.reload(this.type(), opts);
    this.changed.emit();
  }

  /** Side sheet, not a modal: the list this value joins stays on screen beside the form. */
  private openDrawer(data: EnumerationEditDrawerData): void {
    const ref = openFormDrawer<EnumerationEditDrawerComponent, EnumerationEditDrawerData, boolean>(
      this.drawer,
      { content: EnumerationEditDrawerComponent, data },
    );
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.afterMutation();
    });
  }
}
