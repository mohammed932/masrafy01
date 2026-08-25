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
import {
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
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  type StatStripItem,
} from '@shared/ui';
import { LookupsApiService, type EnumerationTypeSummary } from './lookups.api.service';
import { LOOKUP_TYPES, isLookupType, lookupType } from './lookups.constants';
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
            <app-lookup-values-panel
              [type]="type"
              [title]="lookupType(type).label"
              [description]="lookupType(type).description"
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
    `,
  ],
})
export class LookupsPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly lookupType = lookupType;

  /**
   * Type counts for the rail and the stat strip. The VALUES of a type are owned by
   * `app-lookup-values-panel`, which loads and mutates them itself — this page keeps only
   * what the rail needs, plus the per-type delete permission the panel takes as an input.
   */
  private readonly summaries = signal<readonly EnumerationTypeSummary[]>([]);
  protected readonly loadingTypes = signal(true);
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

  /**
   * Whether the server will entertain a delete for a type. Absent on the summary means NOT
   * LOADED, so the button stays as it was rather than vanishing on an old backend.
   */
  protected deletableType(type: string): boolean {
    return this.summaries().find((row) => row.type === type)?.deletable ?? true;
  }

  async ngOnInit(): Promise<void> {
    await this.reloadTypes();
    const requested = this.route.snapshot.queryParamMap.get('type');
    const target = requested && isLookupType(requested) ? requested : LOOKUP_TYPES[0]?.type;
    if (target) this.selectType(target);
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
      this.summaries.set(await this.api.listTypes());
    } finally {
      if (!opts.silent) this.loadingTypes.set(false);
    }
  }
}
