import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  AppstoreOutline,
  CheckCircleOutline,
  EditOutline,
  EnvironmentOutline,
  FileTextOutline,
  FlagOutline,
  IdcardOutline,
  InboxOutline,
  PlusOutline,
  SolutionOutline,
  SwapOutline,
  TagsOutline,
  UnorderedListOutline,
  BankOutline,
  HomeOutline,
  GoldOutline,
  SafetyOutline,
  ReadOutline,
  BuildOutline,
  FunctionOutline,
  CalculatorOutline,
  HistoryOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  openFormDrawer,
  type StatStripItem,
} from '@shared/ui';
import type { EnumerationTypeDefinition, EnumerationTypeSummary } from './lookups.api.service';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { EnumerationTypesService } from '@shared/lookups/enumeration-types.service';
import {
  EnumerationTypeEditDrawerComponent,
  type EnumerationTypeDrawerData,
} from '@shared/lookups/enumeration-type-edit.drawer';
import {
  LookupTypeRailComponent,
  type LookupTypeCard,
} from './components/lookup-type-rail.component';
import { LookupValuesPanelComponent } from '@shared/lookups/lookup-values-panel.component';

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
    PageHeaderComponent,
    StatStripComponent,
    SkeletonRowsComponent,
    LookupTypeRailComponent,
    LookupValuesPanelComponent,
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
      TagsOutline,
      CheckCircleOutline,
      InboxOutline,
      // The rail head's New list and the panel's Edit this list. Registered HERE because
      // this component renders them; a host that patched them by accident would make the
      // icons order-dependent the moment a second host existed.
      PlusOutline,
      EditOutline,
      // Every icon the KIND REGISTRY can name, not only the ones on the rail today.
      //
      // The rail draws `enumeration_type_def.icon`, which is data — so the set of glyphs this
      // screen can be asked for is the registry's, and it changes without a release. Before
      // this it was the five kinds that happened to be railed: turning a retired list back on
      // asked for `gold`, ng-zorro threw, and the tile rendered as a console error rather than
      // as the blank the schema's own comment promises. Registering the seeded set means the
      // next reactivation cannot do it again.
      BankOutline,
      HomeOutline,
      GoldOutline,
      SafetyOutline,
      ReadOutline,
      BuildOutline,
      FunctionOutline,
      CalculatorOutline,
      // The deprecated count on a tile, and the retired banner.
      HistoryOutline,
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
        <div class="rail-head">
          <p class="section-label" i18n="@@lookups.categoriesLabel">Categories</p>
          <div class="rail-acts">
            <!-- Hidden entirely at zero. A toggle over an empty set teaches the operator that
                 the feature is broken. -->
            @if (retiredDefs().length > 0) {
              <label class="retired-toggle">
                <input
                  type="checkbox"
                  [checked]="showRetired()"
                  (change)="showRetired.set(!showRetired())"
                />
                <span>{{ retiredToggleLabel() }}</span>
              </label>
            }
            <button type="button" class="new-type" (click)="openCreateType()">
              <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@lookups.type.new">New list</span>
            </button>
          </div>
        </div>
        <app-lookup-type-rail
          [cards]="typeCards()"
          [selected]="selectedType()"
          (select)="selectType($event)"
        />

        @if (selectedType(); as type) {
          <section class="detail" [attr.aria-label]="label(type)">
            @if (isRetired(type)) {
              <p class="retired-banner" role="status">
                <span nz-icon nzType="history" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@lookups.retired.banner"
                  >This list is retired. Its values are not offered anywhere.</span
                >
                @if (!systemOnlyType(type)) {
                  <button
                    nz-button
                    nzType="primary"
                    nzSize="small"
                    type="button"
                    (click)="openEditType(type)"
                  >
                    <span i18n="@@lookups.retired.turn_on">Turn it back on</span>
                  </button>
                }
              </p>
            }
            @if (!systemOnlyType(type)) {
              <div class="type-actions">
                <button type="button" class="type-edit" (click)="openEditType(type)">
                  <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@lookups.type.edit">Edit this list</span>
                </button>
              </div>
            }
            <app-lookup-values-panel
              [type]="type"
              [title]="label(type)"
              [description]="description(type)"
              [deletable]="deletableType(type)"
              (changed)="reloadTypes({ silent: true })"
            />
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
      .retired-banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .retired-banner button {
        margin-inline-start: auto;
      }

      .rail-acts {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .retired-toggle {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        cursor: pointer;
      }
      .retired-toggle input {
        inline-size: 0.875rem;
        block-size: 0.875rem;
        accent-color: var(--color-brand-primary);
        cursor: pointer;
      }

      .rail-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .rail-head .section-label {
        margin: 0;
      }
      .new-type,
      .type-edit {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
        font: inherit;
        font-size: 0.8125rem;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          color 120ms ease;
      }
      .new-type:hover,
      .type-edit:hover {
        border-color: var(--accent);
        color: var(--text-primary);
      }
      .new-type:focus-visible,
      .type-edit:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .type-actions {
        display: flex;
        justify-content: flex-end;
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
        color: var(--text-secondary);
      }
      .detail {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding-block-start: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class LookupsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly drawer = inject(NzDrawerService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly locale = inject(LOCALE_ID);
  private readonly isAr = String(this.locale).startsWith('ar');

  protected label(type: string): string {
    return this.enumTypes.label(type, this.isAr);
  }

  protected description(type: string): string {
    return this.enumTypes.description(type, this.isAr);
  }

  /**
   * Type counts for the rail and the stat strip. The VALUES of a type are owned by
   * `app-lookup-values-panel`, which loads and mutates them itself — this page keeps only
   * what the rail needs, plus the per-type delete permission the panel takes as an input.
   */
  private readonly summaries = computed<readonly EnumerationTypeSummary[]>(() =>
    this.enumTypes.all(),
  );
  protected readonly loadingTypes = signal(true);
  protected readonly selectedType = signal<string | null>(null);

  /**
   * One tile per rail KIND, in the server's `sortOrder`, with its counts.
   *
   * Derived from `enumeration_type_def` rather than from a hardcoded `LOOKUP_TYPES`, which
   * is what lets a list an operator invents appear here without a release. A kind whose
   * values live on a screen of its own (`program_name`, `surrogate_product`, and the two
   * the compound product owns) carries `onValuesRail: false` and stays off — the same five
   * tiles as before, now for a stated reason rather than by omission from an array.
   */
  protected readonly typeCards = computed<LookupTypeCard[]>(() => {
    const byType = new Map(this.summaries().map((s) => [s.type, s]));
    const card = (def: EnumerationTypeDefinition, retired: boolean): LookupTypeCard => ({
      type: def.key,
      label: this.isAr ? def.labelAr : def.labelEn,
      description: (this.isAr ? def.descriptionAr : def.descriptionEn) ?? '',
      icon: def.icon ?? 'unordered-list',
      active: byType.get(def.key)?.active ?? 0,
      deprecated: byType.get(def.key)?.deprecated ?? 0,
      ...(retired ? { retired: true } : {}),
    });
    const live = this.enumTypes.railTypes().map((def) => card(def, false));
    // Appended, never mixed in: a retired list is a different kind of thing from a live one,
    // and an operator scanning the rail for a list they use should not have to read past
    // three retired ones to find it.
    return this.showRetired()
      ? [...live, ...this.retiredDefs().map((def) => card(def, true))]
      : live;
  });

  /**
   * Lists that are off the rail: retired, or living on a screen of their own.
   *
   * Both, and deliberately: `railTypes()` is `active && onValuesRail`, so a list can be
   * missing from the rail for either reason and the operator cannot tell which from outside.
   * Showing both under one toggle is what makes the rail's absence explicable.
   */
  protected readonly retiredDefs = computed(() =>
    this.enumTypes.definitions().filter((d) => !d.active || !d.onValuesRail),
  );

  protected readonly showRetired = signal(false);

  protected retiredToggleLabel(): string {
    return $localize`:@@lookups.retired.toggle:Show retired lists (${this.retiredDefs().length}:COUNT:)`;
  }

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

  /**
   * Whether the server will entertain a delete for a type. Absent on the summary means NOT
   * LOADED, so the button stays as it was rather than vanishing on an old backend.
   */
  protected deletableType(type: string): boolean {
    return this.enumTypes.deletable(type);
  }

  /** A builtin cannot be renamed or deleted, so the screen offers neither. */
  protected systemOnlyType(type: string): boolean {
    return this.enumTypes.definition(type)?.systemOnly ?? false;
  }

  protected openCreateType(): void {
    this.openTypeDrawer({ mode: 'create' });
  }

  protected openEditType(type: string): void {
    const definition = this.enumTypes.definition(type);
    if (definition) this.openTypeDrawer({ mode: 'edit', definition });
  }

  /**
   * A side sheet (`NzDrawerService`), not a locally rendered panel: it is portaled to the
   * body, so the scrim covers the viewport — a `position: fixed` backdrop inside
   * `section.page` is trapped by that element's own `app-page-rise` animation and dims the
   * panel only (A34). The rail of kinds stays readable beside the form.
   */
  private openTypeDrawer(data: EnumerationTypeDrawerData): void {
    const ref = openFormDrawer<
      EnumerationTypeEditDrawerComponent,
      EnumerationTypeDrawerData,
      boolean
    >(this.drawer, { content: EnumerationTypeEditDrawerComponent, data });
    ref.afterClose.subscribe(async (saved: boolean | undefined) => {
      if (!saved) return;
      await this.reloadTypes({ silent: true });
      // A newly created kind is where the operator wants to be: they made it to put values
      // in it, and leaving them on the previous tile makes the create look like it failed.
      const created = data.mode === 'create' ? this.enumTypes.railTypes().at(-1) : null;
      if (created) this.selectType(created.key);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.reloadTypes();
    const requested = this.route.snapshot.queryParamMap.get('type');
    const rail = this.enumTypes.railTypes();
    // A `?type=` naming a kind that is not on the rail falls back to the first tile rather
    // than rendering an empty panel — the same behaviour `isLookupType` used to give, now
    // measured against the rail as it actually is rather than against a frozen array.
    const known = rail.some((d) => d.key === requested);
    if (known && requested) {
      this.selectType(requested);
      return;
    }
    // A pasted link naming a RETIRED list used to fall silently to the first tile, which is
    // the one case where the fallback is wrong: the list exists, the operator asked for it by
    // name, and landing somewhere else reads as a broken link. Open the retired group and go.
    const retired = this.retiredDefs().some((d) => d.key === requested);
    if (retired && requested) {
      this.showRetired.set(true);
      this.selectType(requested);
      return;
    }
    const target = rail[0]?.key;
    if (target) this.selectType(target);
  }

  protected isRetired(type: string): boolean {
    return this.retiredDefs().some((d) => d.key === type);
  }

  protected selectType(type: string): void {
    this.selectedType.set(type);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected async reloadTypes(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loadingTypes.set(true);
    try {
      await this.enumTypes.refresh();
    } finally {
      if (!opts.silent) this.loadingTypes.set(false);
    }
  }
}
