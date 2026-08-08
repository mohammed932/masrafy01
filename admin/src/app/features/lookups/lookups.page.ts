import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  IdcardOutline,
  SwapOutline,
  SolutionOutline,
  FlagOutline,
  AppstoreOutline,
  FileTextOutline,
  EnvironmentOutline,
  UnorderedListOutline,
  HistoryOutline,
  LockOutline,
  EditOutline,
  MinusCircleOutline,
  PoweroffOutline,
  PlusOutline,
  CloseCircleOutline,
  SearchOutline,
  TagsOutline,
  CheckCircleOutline,
  InboxOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  type StatStripItem,
} from '@shared/ui';
import {
  LookupsApiService,
  type EnumerationRow,
  type EnumerationTypeSummary,
} from './lookups.api.service';
import { LOOKUP_TYPES, isLookupType, lookupType } from './lookups.constants';
import {
  LookupTypeRailComponent,
  type LookupTypeCard,
} from './components/lookup-type-rail.component';
import {
  LookupValueListComponent,
  type LookupActiveToggle,
} from './components/lookup-value-list.component';
import {
  EnumerationEditDialogComponent,
  type EnumerationEditDialogData,
} from './components/enumeration-edit.dialog';

/**
 * Lookups — the operator-curated dropdown values every surface reads (matching,
 * bank programs, the document pipeline, the mobile wizard). Values are DATA
 * (Principle II): add / rename / retire without a deploy. The selected category
 * is mirrored into `?type=` so a screen like `?type=required_document` is
 * linkable straight from a program or a runbook.
 */
@Component({
  selector: 'app-lookups-page',
  standalone: true,
  imports: [
    NzIconModule,
    NzButtonModule,
    PageHeaderComponent,
    StatStripComponent,
    SkeletonRowsComponent,
    LookupTypeRailComponent,
    LookupValueListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideNzIconsPatch([
      IdcardOutline,
      SwapOutline,
      SolutionOutline,
      FlagOutline,
      AppstoreOutline,
      FileTextOutline,
      EnvironmentOutline,
      UnorderedListOutline,
      HistoryOutline,
      LockOutline,
      EditOutline,
      MinusCircleOutline,
      PoweroffOutline,
      PlusOutline,
      CloseCircleOutline,
      SearchOutline,
      TagsOutline,
      CheckCircleOutline,
      InboxOutline,
    ]),
  ],
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrowText" [title]="titleText" [subtitle]="subtitleText">
        @if (!loadingTypes()) {
          <app-stat-strip [items]="statItems()" layout="row" [ariaLabel]="statAriaLabel" />
        }
      </app-page-header>

      @if (loadingTypes()) {
        <app-skeleton-rows [rows]="3" [cols]="[1, 1, 1]" [ariaLabel]="loadingTypesLabel" />
      } @else {
        <p class="section-label" i18n="@@lookups.categoriesLabel">Categories</p>
        <app-lookup-type-rail
          [cards]="typeCards()"
          [selected]="selectedType()"
          (select)="selectType($event)"
        />

        @if (selectedType(); as type) {
          <section class="detail" [attr.aria-label]="lookupType(type).label">
            <header class="detail-head">
              <div class="detail-intro">
                <h2>{{ lookupType(type).label }}</h2>
                <p class="detail-desc">{{ lookupType(type).description }}</p>
              </div>
              <button nz-button nzType="primary" (click)="openCreate(type)">
                <span nz-icon nzType="plus" nzTheme="outline"></span>
                <span i18n="@@lookups.addValue">Add value</span>
              </button>
            </header>

            @if (loadingRows()) {
              <app-skeleton-rows [rows]="5" [cols]="[3, 1, 1]" [ariaLabel]="loadingRowsLabel" />
            } @else {
              <app-lookup-value-list
                [rows]="rows()"
                (edit)="openEdit($event)"
                (toggleActive)="setActive($event)"
                (deprecate)="deprecate($event)"
              />
            }
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        inline-size: 100%;
        padding: var(--space-6);
      }
      @media (max-width: 768px) {
        .page {
          padding: var(--space-4);
          gap: var(--space-5);
        }
      }
      .section-label {
        margin: 0 0 calc(var(--space-3) * -1);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .detail {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block-start: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
      }
      .detail-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .detail-intro {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .detail-head h2 {
        margin: 0 0 var(--space-1);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        line-height: 1.2;
        color: var(--color-text-primary);
      }
      .detail-desc {
        margin: 0;
        max-inline-size: 60ch;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class LookupsPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly modal = inject(NzModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly lookupType = lookupType;

  private readonly summaries = signal<readonly EnumerationTypeSummary[]>([]);
  protected readonly rows = signal<readonly EnumerationRow[]>([]);
  protected readonly loadingTypes = signal(true);
  protected readonly loadingRows = signal(false);
  protected readonly selectedType = signal<string | null>(null);

  /** One tile per supported type, in declaration order, with its API counts. */
  protected readonly typeCards = computed<LookupTypeCard[]>(() => {
    const byType = new Map(this.summaries().map((s) => [s.type, s]));
    return LOOKUP_TYPES.map((t) => ({
      ...t,
      active: byType.get(t.type)?.active ?? 0,
      deprecated: byType.get(t.type)?.deprecated ?? 0,
    }));
  });

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const cards = this.typeCards();
    return [
      {
        label: $localize`:@@lookups.stat.types:Categories`,
        value: cards.length,
        icon: 'tags',
      },
      {
        label: $localize`:@@lookups.stat.values:Active values`,
        value: cards.reduce((acc, c) => acc + c.active, 0),
        tone: 'success',
        icon: 'check-circle',
      },
      {
        label: $localize`:@@lookups.stat.deprecated:Deprecated`,
        value: cards.reduce((acc, c) => acc + c.deprecated, 0),
        tone: 'muted',
        icon: 'inbox',
      },
    ];
  });

  protected readonly eyebrowText = $localize`:@@lookups.eyebrow:Platform configuration`;
  protected readonly titleText = $localize`:@@lookups.title:Lookups`;
  protected readonly subtitleText = $localize`:@@lookups.subtitle:Every operator-curated dropdown the platform exposes. Add, rename or retire a value — the admin and the mobile wizard pick it up instantly, no deploy needed.`;
  protected readonly statAriaLabel = $localize`:@@lookups.stat.aria:Registry totals`;
  protected readonly loadingTypesLabel = $localize`:@@lookups.loading.types:Loading categories`;
  protected readonly loadingRowsLabel = $localize`:@@lookups.loading.values:Loading values`;

  async ngOnInit(): Promise<void> {
    await this.reloadTypes();
    const requested = this.route.snapshot.queryParamMap.get('type');
    const target = requested && isLookupType(requested) ? requested : LOOKUP_TYPES[0]?.type;
    if (target) await this.selectType(target);
  }

  protected async selectType(type: string): Promise<void> {
    this.selectedType.set(type);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    await this.reloadRows(type);
  }

  protected openCreate(type: string): void {
    this.openDialog({ mode: 'create', type });
  }

  protected openEdit(row: EnumerationRow): void {
    this.openDialog({ mode: 'edit', type: row.type, row });
  }

  /** Optimistic flip — the global error interceptor surfaces the toast on failure. */
  protected async setActive({ row, next }: LookupActiveToggle): Promise<void> {
    this.patchRow(row.id, { active: next });
    try {
      await this.api.update(row.id, { active: next });
      await this.reloadAfterMutation({ silent: true });
    } catch {
      this.patchRow(row.id, { active: row.active });
    }
  }

  protected async deprecate(row: EnumerationRow): Promise<void> {
    this.patchRow(row.id, { deprecatedAt: new Date().toISOString(), active: false });
    try {
      await this.api.update(row.id, { deprecate: true });
      await this.reloadAfterMutation({ silent: true });
    } catch {
      this.patchRow(row.id, { deprecatedAt: null, active: row.active });
    }
  }

  private patchRow(id: string, patch: Partial<EnumerationRow>): void {
    this.rows.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
      if (saved) void this.reloadAfterMutation();
    });
  }

  private async reloadTypes(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loadingTypes.set(true);
    try {
      this.summaries.set(await this.api.listTypes());
    } finally {
      if (!opts.silent) this.loadingTypes.set(false);
    }
  }

  private async reloadRows(type: string, opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loadingRows.set(true);
    try {
      this.rows.set(await this.api.list(type));
    } finally {
      if (!opts.silent) this.loadingRows.set(false);
    }
  }

  private async reloadAfterMutation(opts: { silent?: boolean } = {}): Promise<void> {
    const type = this.selectedType();
    await this.reloadTypes(opts);
    if (type) await this.reloadRows(type, opts);
  }
}
