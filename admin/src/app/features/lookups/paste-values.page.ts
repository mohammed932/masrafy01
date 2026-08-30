import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { LOCALE_ID } from '@angular/core';
import { FormPageComponent } from '@shared/ui';
import { PasteValuesFormComponent, type PasteValuesDraft } from '@shared/lookups/paste-values.form';
import { EnumerationTypesService } from '@shared/lookups/enumeration-types.service';
import { slugify } from '@shared/lookups/slug';
import type { PasteClass } from '@shared/lookups/parse-pasted-values';
import {
  ENUMERATION_BULK_MAX,
  LookupsApiService,
  type EnumerationBulkProblem,
  type EnumerationRow,
} from './lookups.api.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';

/**
 * Load a list from a pasted sheet.
 *
 * ── WHY A SCREEN AND NOT A SIDE SHEET ─────────────────────────────────────────
 * The v19.1.0 rule draws the line on the SIZE of the form, not its importance. A ten-row
 * textarea, a separator control, a count strip, a token fixer and a preview table holding
 * hundreds of rows with inline edit and a filter rail is taller than a 560px sheet's whole
 * body, and a four-column table inside one 560px column is unreadable. The doc's own test —
 * "a form that needs the whole viewport and a link somebody can come back to" — is met on
 * every clause, and losing four hundred pasted lines to a stray Esc is exactly the
 * interruption `app-form-page` exists for.
 *
 * ── THE TRANSACTION IS THE SERVER'S ───────────────────────────────────────────
 * One request, all-or-nothing. A half-applied paste on a MIRRORED list publishes a
 * questionnaire snapshot whose options are a prefix of the operator's intent, and every
 * application taken between the halves carries a truncated answer set. On refusal the text
 * and every inline fix survive, each returned row index is painted onto its line, and Save
 * stays pressable so the retry is one keystroke away.
 */
@Component({
  selector: 'app-paste-values-page',
  standalone: true,
  imports: [FormPageComponent, PasteValuesFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-page
      [eyebrow]="eyebrow"
      [title]="title"
      [subtitle]="subtitle()"
      [hint]="hint()"
      [blockReason]="blockReason()"
      [submitLabel]="submitLabel()"
      [submitDisabled]="blockReason() !== null"
      [submitting]="saving()"
      (cancelled)="back()"
      (submitted)="save()"
    >
      @if (failure(); as reason) {
        <p class="pvp__fail" role="alert">{{ reason }}</p>
      }
      <app-paste-values
        [classes]="classes()"
        [fallbackKey]="fallbackKey()"
        [existingSlugs]="existingSlugs()"
        [serverProblems]="serverProblems()"
        (draft)="onDraft($event)"
      />
    </app-form-page>
  `,
  styles: [
    `
      .pvp__fail {
        margin: 0 0 var(--space-4);
        padding: var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-error) 35%, transparent);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class PasteValuesPage {
  private readonly api = inject(LookupsApiService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly errors = inject(ErrorCodeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly eyebrow = $localize`:@@pv.eyebrow:Manage values`;
  protected readonly title = $localize`:@@pv.title:Paste a list of values`;

  private readonly params = toSignal(this.route.queryParamMap.pipe(map((p) => p)), {
    initialValue: null,
  });

  /** The list being loaded. Required — there is nothing to paste into without it. */
  protected readonly type = computed(() => this.params()?.get('type') ?? '');
  /**
   * Where Cancel and a successful save return to, built from `from` + `key`.
   *
   * NOT a raw `return` URL from the query string: an arbitrary path in a parameter is an
   * open-redirect surface, and this screen has exactly two callers.
   */
  private readonly from = computed(() => this.params()?.get('from') ?? 'lookups');
  private readonly productKey = computed(() => this.params()?.get('key') ?? '');

  protected readonly rows = signal<readonly EnumerationRow[]>([]);
  protected readonly parentRows = signal<readonly EnumerationRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly serverProblems = signal<ReadonlyMap<number, string>>(new Map());
  private readonly draft = signal<PasteValuesDraft>({ rows: [], blocked: 0 });

  protected readonly classes = computed<readonly PasteClass[]>(() =>
    this.parentRows()
      .filter((r) => r.active)
      .map((r) => ({ key: r.key, labelEn: r.labelEn, labelAr: r.labelAr })),
  );

  protected readonly fallbackKey = computed<string | null>(
    () =>
      this.enumTypes.definitions().find((d) => d.key === this.type())?.fallbackParentKey ?? null,
  );

  /**
   * Keys the list already holds, as SLUGS.
   *
   * Every key, not only the active ones: a retired value still holds its `(type, key)` unique,
   * so treating it as absent would preview a clean row and then take a `duplicate_existing`
   * from the server.
   */
  protected readonly existingSlugs = computed(
    () => new Set(this.rows().map((r) => slugify(r.key))),
  );

  protected readonly typeLabel = computed(() => {
    const def = this.enumTypes.definitions().find((d) => d.key === this.type());
    if (!def) return this.type();
    return this.isAr ? def.labelAr : def.labelEn;
  });

  protected readonly subtitle = computed(() => {
    const list = this.typeLabel();
    return this.classes().length > 0
      ? $localize`:@@pv.subtitle_classed:Every line becomes one value in ${list}:LIST:, filed under a class.`
      : $localize`:@@pv.subtitle:Every line becomes one value in ${list}:LIST:.`;
  });

  protected readonly hint = computed(() => {
    const n = this.draft().rows.length;
    return $localize`:@@pv.hint:Adds ${n}:COUNT: value(s) to ${this.typeLabel()}:LIST:. Nothing is written until you press Add.`;
  });

  protected readonly blockReason = computed<string | null>(() => {
    const n = this.draft().rows.length;
    if (this.type() === '') return $localize`:@@pv.block.no_type:No list was named.`;
    // Broken lines FIRST, and before the "nothing to add" case: a sheet where every line is
    // broken should say what is wrong with them, not that it is empty.
    const blocked = this.draft().blocked;
    if (blocked > 0) {
      return $localize`:@@pv.block.errors:${blocked}:COUNT: line(s) still need fixing.`;
    }
    if (n === 0) return $localize`:@@pv.block.none:Paste at least one line that can be added.`;
    if (n > ENUMERATION_BULK_MAX) {
      return $localize`:@@pv.block.limit:This is ${n}:COUNT: lines. Paste at most ${ENUMERATION_BULK_MAX}:MAX: at a time.`;
    }
    return null;
  });

  protected readonly submitLabel = computed(() => {
    const n = this.draft().rows.length;
    return $localize`:@@pv.submit:Add ${n}:COUNT: value(s)`;
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const type = this.type();
    if (type === '') return;
    await this.enumTypes.refresh();
    const parentType =
      this.enumTypes.definitions().find((d) => d.key === type)?.parentTypeKey ?? null;
    const [rows, parents] = await Promise.all([
      this.api.list(type),
      parentType === null ? Promise.resolve([]) : this.api.list(parentType),
    ]);
    this.rows.set(rows);
    this.parentRows.set(parents);
  }

  protected onDraft(draft: PasteValuesDraft): void {
    this.draft.set(draft);
  }

  protected back(): void {
    if (this.from() === 'product' && this.productKey() !== '') {
      void this.router.navigate(['/surrogate-products', this.productKey()]);
      return;
    }
    void this.router.navigate(['/lookups'], { queryParams: { type: this.type() } });
  }

  protected async save(): Promise<void> {
    if (this.blockReason() !== null || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.serverProblems.set(new Map());
    try {
      await this.api.createValuesBulk({
        type: this.type(),
        // `line` is client-only — it exists so a server refusal can be painted back onto the
        // line the operator can see. Stripped here rather than never carried, because the
        // alternative is guessing which sent row an index refers to.
        rows: this.draft().rows.map((row) => ({
          labelEn: row.labelEn,
          labelAr: row.labelAr,
          ...(row.parentKey !== undefined ? { parentKey: row.parentKey } : {}),
        })),
      });
      this.back();
    } catch (err: unknown) {
      this.paintFailure(err);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Put the server's refusal where the operator is looking.
   *
   * Per-row problems are painted onto their own lines and the message is the SERVER's, through
   * `ErrorCodeService` — never a sentence written here (A22). A failure the server did not
   * attribute to rows paints nothing: a red line the server never named is a lie.
   *
   * `problems[].index` is ZERO-BASED into what was SENT. The rows sent are the importable ones,
   * so the index has to be walked back through the draft to the line the operator can see —
   * getting that wrong points at the wrong line, which is worse than pointing at none.
   */
  private paintFailure(err: unknown): void {
    const body = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = body?.code;
    if (code === undefined) {
      this.failure.set($localize`:@@pv.fail.other:Nothing was added. Try again.`);
      return;
    }
    this.failure.set(this.errors.toLocalizedMessage(code as ErrorCode, body?.meta));
    const problems = (body?.meta?.['problems'] as EnumerationBulkProblem[] | undefined) ?? [];
    if (problems.length === 0) return;
    const painted = new Map<number, string>();
    for (const p of problems) {
      const line = this.lineOfSentRow(p.index);
      if (line !== null) painted.set(line, rowProblemLabel(p));
    }
    this.serverProblems.set(painted);
  }

  /** Which visible LINE the nth sent row came from. Carried, never inferred. */
  private lineOfSentRow(index: number): number | null {
    return this.draft().rows[index]?.line ?? null;
  }
}

/**
 * What went wrong with ONE row, in the row's own words.
 *
 * Deliberately not the envelope's message: `ENUMERATION_BULK_INVALID` says "N lines could not
 * be added", which is the PAGE's sentence and is already shown above the table. Repeating it
 * on every red line would tell the operator the count they can already see and not the reason
 * for the line they are looking at.
 *
 * A reason the client does not know about falls back to the generic line rather than printing
 * a raw token: a server that grew a new reason should read as unexplained, not as broken.
 */
function rowProblemLabel(problem: {
  reason: string;
  parentKey?: string;
  firstIndex?: number;
}): string {
  switch (problem.reason) {
    case 'parent_required':
      return $localize`:@@pv.srv.parent_required:No class named.`;
    case 'parent_unknown':
      return $localize`:@@pv.srv.parent_unknown:No class is called “${problem.parentKey ?? ''}:TOKEN:”.`;
    case 'parent_not_applicable':
      return $localize`:@@pv.srv.parent_not_applicable:This list has no classes.`;
    case 'duplicate_in_batch':
      return $localize`:@@pv.srv.duplicate_in_batch:Repeated earlier in this list.`;
    case 'duplicate_existing':
      return $localize`:@@pv.srv.duplicate_existing:Already in the list.`;
    case 'label_unsluggable':
      return $localize`:@@pv.srv.label_unsluggable:The English name needs a latin letter or digit.`;
    default:
      return $localize`:@@pv.srv.other:This line was refused.`;
  }
}
