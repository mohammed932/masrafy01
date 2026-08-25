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
  computed,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { PlusOutline } from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent } from '@shared/ui';
import {
  LookupsApiService,
  type EnumerationRow,
  type EnumerationTypeSummary,
} from '@features/lookups/lookups.api.service';
import { LookupValueListComponent, type LookupActiveToggle } from './lookup-value-list.component';
import {
  EnumerationEditDialogComponent,
  type EnumerationEditDialogData,
} from './enumeration-edit.dialog';
import { PARENT_TYPE_BY_TYPE } from './lookup-constants';

@Component({
  selector: 'app-lookup-values-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, NzIconModule, SkeletonRowsComponent, LookupValueListComponent],
  providers: [provideNzIconsPatch([PlusOutline])],
  template: `
    <section class="panel">
      <header class="head">
        <div class="titles">
          <h3>{{ title() }}</h3>
          @if (description(); as text) {
            <p>{{ text }}</p>
          }
        </div>
        <button nz-button nzType="default" type="button" (click)="openCreate()">
          <span nz-icon nzType="plus" nzTheme="outline"></span>
          {{ addLabel }}
        </button>
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
  private readonly modal = inject(NzModalService);

  /** The enumeration type this panel renders. Changing it reloads. */
  readonly type = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);

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
  private readonly summaries = signal<readonly EnumerationTypeSummary[]>([]);

  /**
   * Whether the server will entertain a delete for this type. Absent on the summary means
   * NOT LOADED, so the button stays as it was rather than vanishing on an old backend.
   */
  protected readonly deletable = computed(
    () => this.summaries().find((s) => s.type === this.type())?.deletable ?? true,
  );

  protected readonly addLabel = $localize`:@@lookups.addValue:Add value`;
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
      const [rows, summaries] = await Promise.all([this.api.list(type), this.api.listTypes()]);
      this.rows.set(rows);
      this.summaries.set(summaries);
      const parentType = PARENT_TYPE_BY_TYPE[type];
      this.parentRows.set(parentType ? await this.api.list(parentType) : []);
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }

  protected openCreate(): void {
    this.openDialog({ mode: 'create', type: this.type() });
  }

  protected openEdit(row: EnumerationRow): void {
    this.openDialog({ mode: 'edit', type: row.type, row });
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

  private openDialog(data: EnumerationEditDialogData): void {
    const ref = this.modal.create<
      EnumerationEditDialogComponent,
      EnumerationEditDialogData,
      boolean
    >({
      nzContent: EnumerationEditDialogComponent,
      nzData: data,
      // The dialog body carries no heading of its own — the modal chrome owns the title.
      nzTitle:
        data.mode === 'create'
          ? $localize`:@@lookups.dialog.titleCreate:Add new value`
          : $localize`:@@lookups.dialog.titleEdit:Edit value`,
      nzWidth: 'min(640px, calc(100vw - 48px))',
      nzFooter: null,
      nzMaskClosable: true,
    });
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.afterMutation();
    });
  }
}
