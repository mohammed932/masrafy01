/**
 * What the registry's KINDS are, fetched once and shared.
 *
 * REPLACES THREE HARDCODED MAPS that each stated part of the same thing and disagreed about
 * which types they covered:
 *
 *   · `LOOKUP_TYPES`            rail label + description + icon, 5 of 14 types
 *   · `ENUMERATION_TYPE_LABELS` the label again, for 6 types the rail does not show
 *   · `EXAMPLES`                the add dialog's placeholder, 6 types
 *   · `PARENT_TYPE_BY_TYPE`     a client mirror of a server constant, 1 entry
 *
 * Between them, 11 of 14 types had a label somewhere and a kind an operator invented had
 * none — it rendered as its raw key, sat on no rail, could not be deep-linked, and could not
 * be filed under a class because both write paths refused it. All four are now one server
 * read (`GET admin/enumerations/types`, which already carried the counts this screen needs).
 *
 * A SIGNAL CACHE, loaded once per session, for the reason the panel is a panel and not a
 * store: several screens want the same answer at the same moment — the values panel asks
 * for a parent axis, the edit dialog asks for an example, the product page asks for two
 * labels — and each fetching for itself was the 2N+1 shape a previous review already
 * removed once from this feature.
 *
 * READS ARE SYNCHRONOUS AND TOTAL. Every accessor answers before the fetch resolves, with
 * the honest fallback the maps already used: the raw key for a label, `null` for an axis.
 * A template that binds one of these must not have to care whether the load has landed.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  LookupsApiService,
  type EnumerationTypeDefinition,
  type EnumerationTypeSummary,
} from '@features/lookups/lookups.api.service';

@Injectable({ providedIn: 'root' })
export class EnumerationTypesService {
  private readonly api = inject(LookupsApiService);

  private readonly summaries = signal<readonly EnumerationTypeSummary[]>([]);
  private readonly loaded = signal(false);
  /** In flight, so N screens mounting together issue ONE request rather than N. */
  private inFlight: Promise<void> | null = null;

  /** Every KIND with a definition, in the server's order. */
  readonly definitions = computed<readonly EnumerationTypeDefinition[]>(() =>
    this.summaries()
      .map((s) => s.definition)
      .filter((d): d is EnumerationTypeDefinition => Boolean(d)),
  );

  /** Summaries as fetched — definition plus the value counts. */
  readonly all = computed(() => this.summaries());

  readonly isLoaded = computed(() => this.loaded());

  private readonly byKey = computed(() => {
    const map = new Map<string, EnumerationTypeDefinition>();
    for (const def of this.definitions()) map.set(def.key, def);
    return map;
  });

  /**
   * The kinds the Manage-values rail shows: active, flagged for the rail, in `sortOrder`.
   *
   * Derived from data, so a kind an operator creates appears on the rail without a release —
   * which is the whole point. `onValuesRail` is off for kinds that have a screen of their
   * own (`program_name`, `surrogate_product`) and for the two the compound product owns.
   */
  readonly railTypes = computed(() => this.definitions().filter((d) => d.active && d.onValuesRail));

  constructor() {
    // FETCHED ON INJECTION, not on the first screen that remembers to ask.
    //
    // The first cut left `load()` reachable only from `refresh()`, whose only callers are on
    // `/lookups` — so on a surrogate product's own page the cache was empty for the life of
    // the session and every accessor answered with its fallback. That is the worst kind of
    // failure this class can have: `parentTypeOf` returned `null`, so the values panel and
    // the edit dialog silently dropped the "Filed under" control, and the screen looked
    // finished. Root-provided, one request per session, and every screen that injects it
    // needs the answer.
    void this.load();
  }

  async load(): Promise<void> {
    if (this.loaded()) return;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.api
      .listTypes()
      .then((rows) => {
        this.summaries.set(rows);
        this.loaded.set(true);
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  /** After any KIND or VALUE write — the counts move as well as the definitions. */
  async refresh(): Promise<void> {
    this.loaded.set(false);
    this.inFlight = null;
    await this.load();
  }

  definition(type: string): EnumerationTypeDefinition | null {
    return this.byKey().get(type) ?? null;
  }

  /**
   * A kind's name, falling back to the raw key.
   *
   * The fallback is the honest answer rather than a failure — the same posture
   * `enumerationTypeLabel` took — and it now also covers the window before the fetch lands.
   */
  label(type: string, isAr: boolean): string {
    const def = this.byKey().get(type);
    if (!def) return type;
    return isAr ? def.labelAr : def.labelEn;
  }

  description(type: string, isAr: boolean): string {
    const def = this.byKey().get(type);
    if (!def) return '';
    return (isAr ? def.descriptionAr : def.descriptionEn) ?? '';
  }

  icon(type: string): string {
    return this.byKey().get(type)?.icon ?? 'unordered-list';
  }

  /** The add dialog's placeholder for this kind, or `null` when nobody has written one. */
  example(type: string, isAr: boolean): string | null {
    const def = this.byKey().get(type);
    if (!def) return null;
    return (isAr ? def.exampleAr : def.exampleEn) ?? null;
  }

  /** The kind whose values these are filed under, or `null` when there is no parent axis. */
  parentTypeOf(type: string): string | null {
    return this.byKey().get(type)?.parentTypeKey ?? null;
  }

  /** The kinds filed under `parentType`. */
  childTypesOf(parentType: string): string[] {
    return this.definitions()
      .filter((d) => d.parentTypeKey === parentType)
      .map((d) => d.key);
  }

  /**
   * The lists a surrogate product AUTHORED, in the server's order.
   *
   * Not the same question as "which lists does its calculation read" — that one is derived
   * from the rule (`optionsEnumerationType`) and is unanswerable while the product is being
   * built, which is exactly when this screen needs an answer.
   */
  listsOwnedBy(productKey: string): readonly EnumerationTypeDefinition[] {
    return this.definitions().filter((d) => d.surrogateProductKey === productKey);
  }

  /**
   * Whether a VALUE of this kind may be hard-deleted.
   *
   * `true` when nothing is loaded, deliberately: the old contract was that an absent
   * `deletable` means NOT LOADED and must leave the button as it was, rather than hide an
   * action that still works. The server refuses in words either way.
   */
  deletable(type: string): boolean {
    const def = this.byKey().get(type);
    return def ? def.deletable : true;
  }
}
