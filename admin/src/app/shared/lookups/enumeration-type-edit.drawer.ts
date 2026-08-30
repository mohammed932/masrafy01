/**
 * Create or edit a KIND of list — the registry one level up from a value.
 *
 * A SEPARATE dialog from `EnumerationEditDrawerComponent`, which edits a VALUE. The two look
 * alike and are not: this one asks for a key that becomes `platform_enumeration.type` and a
 * parent AXIS ("values of this kind are filed under a value of that kind"), while that one
 * asks for a key inside one type and a parent VALUE. Folding them together would mean one
 * form whose every field means two things depending on a mode flag.
 *
 * THE KEY IS IMMUTABLE after create, and the field says so rather than being silently
 * dropped: every value carries the string, so a rename strands all of them and leaves any
 * code path reading that type by name asking for a key nothing answers to.
 *
 * WHAT IT DOES NOT ASK. `systemOnly` — a fact about the codebase, not a property an operator
 * may claim — and the customer-readable / categorised / question-bound axes, each of which
 * names a behaviour only a builtin has.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { LoadingOutline, UnorderedListOutline } from '@ant-design/icons-angular/icons';
import { FormDrawerComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  LookupsApiService,
  type EnumerationTypeDefinition,
} from '@features/lookups/lookups.api.service';
import { EnumerationTypesService } from './enumeration-types.service';

export type EnumerationTypeDrawerData =
  | { mode: 'create' }
  | { mode: 'edit'; definition: EnumerationTypeDefinition };

/** The key an operator may type: the same shape the server's `KEY_PATTERN` accepts. */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

@Component({
  selector: 'app-enumeration-type-edit-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzIconModule, FormDrawerComponent],
  providers: [provideNzIconsPatch([LoadingOutline, UnorderedListOutline])],
  template: `
    <app-form-drawer
      [title]="drawerTitle"
      [subtitle]="drawerSubtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="form.invalid"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="submit()"
    >
      <span drawerIcon nz-icon nzType="unordered-list" nzTheme="outline"></span>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()">
        <label class="field">
          <span class="label" i18n="@@lookups.type.field.key">Key</span>
          <input
            class="input mono"
            formControlName="key"
            [attr.aria-describedby]="isCreate ? 'key-hint' : 'key-locked'"
            autocomplete="off"
          />
          @if (isCreate) {
            <span class="hint" id="key-hint" i18n="@@lookups.type.field.key.hint">
              Letters, numbers, underscore or hyphen. This is how the platform stores the list, and
              it cannot be changed later.
            </span>
          } @else {
            <span class="hint" id="key-locked" i18n="@@lookups.type.field.key.locked">
              The key cannot be changed — every value in this list carries it.
            </span>
          }
          @if (keyInvalid()) {
            <span class="hint is-bad" role="alert" i18n="@@lookups.type.field.key.invalid">
              Use letters, numbers, underscore or hyphen, starting with a letter or number.
            </span>
          }
        </label>

        <div class="row">
          <label class="field">
            <span class="label" i18n="@@lookups.type.field.labelEn">English name</span>
            <input class="input" formControlName="labelEn" autocomplete="off" />
          </label>
          <label class="field">
            <span class="label" i18n="@@lookups.type.field.labelAr">Arabic name</span>
            <input class="input" formControlName="labelAr" dir="rtl" autocomplete="off" />
          </label>
        </div>

        <div class="row">
          <label class="field">
            <span class="label" i18n="@@lookups.type.field.descriptionEn">
              English description
            </span>
            <input class="input" formControlName="descriptionEn" autocomplete="off" />
          </label>
          <label class="field">
            <span class="label" i18n="@@lookups.type.field.descriptionAr">
              Arabic description
            </span>
            <input class="input" formControlName="descriptionAr" dir="rtl" autocomplete="off" />
          </label>
        </div>

        <label class="field">
          <span class="label" i18n="@@lookups.type.field.parent">Filed under</span>
          <select class="input" formControlName="parentTypeKey">
            <option value="" i18n="@@lookups.type.field.parent.none">
              Nothing — these values stand on their own
            </option>
            @for (candidate of parentCandidates(); track candidate.key) {
              <option [value]="candidate.key">{{ label(candidate) }}</option>
            }
          </select>
          <span class="hint" i18n="@@lookups.type.field.parent.hint">
            Pick a class list when a bank prices these values by group rather than one by one — the
            way compounds are priced by their class. Every value will then have to name one.
          </span>
        </label>

        @if (isEdit()) {
          <!-- NESTED, not two flat switches. The rail shows a list when it is active AND on
               independent booleans give four states of which two look identical on the rail:
               the operator flips one, nothing happens, and nothing on screen says why. Nesting
               the second inside the first makes those combinations unreachable. -->
          <div class="field">
            <label class="switch">
              <input type="checkbox" formControlName="active" [attr.disabled]="lockedAttr()" />
              <span i18n="@@lookups.type.field.active">This list is in use</span>
            </label>
            <span class="hint" i18n="@@lookups.type.field.active.hint">
              Off, the list is retired: its values stay and everything already saved keeps working,
              but it cannot be picked anywhere new.
            </span>

            @if (form.controls.active.value && !ownedByProduct()) {
              <label class="switch is-nested">
                <input
                  type="checkbox"
                  formControlName="onValuesRail"
                  [attr.disabled]="lockedAttr()"
                />
                <span i18n="@@lookups.type.field.rail">Show it on Manage values</span>
              </label>
              <span class="hint is-nested" i18n="@@lookups.type.field.rail.hint">
                Off, the list still works — it just has a screen of its own instead of a tile here.
              </span>
            }

            @if (locked()) {
              <span class="hint" i18n="@@lookups.type.field.locked">
                A built-in list the platform reads by name, so this cannot be changed.
              </span>
            }
          </div>
        }

        @if (errorMessage(); as message) {
          <p class="notice is-bad" role="alert">{{ message }}</p>
        }
      </form>
    </app-form-drawer>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
        gap: var(--space-3);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .input {
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-primary);
        font: inherit;
      }
      .input:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      .input:disabled {
        color: var(--text-tertiary);
        cursor: not-allowed;
      }
      .mono {
        font-family: var(--font-mono, ui-monospace, monospace);
      }
      /* Native checkboxes, not nz-switch. ng-zorro renders a switch as a bare button with no
         role and no aria-checked, so a wrapping label associates with nothing and a screen
         reader hears an unlabelled button — the defect v19.1.0 measured and fixed the same
         way. A checkbox is also the honest control for a setting that is simply on or off. */
      .switch {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .switch.is-nested,
      .hint.is-nested {
        margin-inline-start: var(--space-5);
      }
      .switch input {
        inline-size: 1rem;
        block-size: 1rem;
        accent-color: var(--color-brand-primary);
        cursor: pointer;
      }

      .hint {
        color: var(--text-tertiary);
        font-size: 0.75rem;
        line-height: 1.5;
      }
      .hint.is-bad,
      .notice.is-bad {
        color: var(--error);
      }
      .notice {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.5;
      }
    `,
  ],
})
export class EnumerationTypeEditDrawerComponent {
  private readonly api = inject(LookupsApiService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly drawerRef = inject(NzDrawerRef<EnumerationTypeEditDrawerComponent, boolean>);
  private readonly data = inject<EnumerationTypeDrawerData>(NZ_DRAWER_DATA);
  private readonly locale = inject(LOCALE_ID);
  private readonly isAr = this.locale.startsWith('ar');

  protected readonly isCreate = this.data.mode === 'create';
  protected readonly drawerTitle = this.isCreate
    ? $localize`:@@lookups.type.dialog.createTitle:New list`
    : $localize`:@@lookups.type.dialog.editTitle:Edit list`;
  protected readonly drawerSubtitle = $localize`:@@lookups.type.dialog.lede:A list is a set of values an operator curates — compounds, employment types, a bank's own tiers. Create one here, then add its values.`;
  protected readonly submitLabel = this.isCreate
    ? $localize`:@@lookups.type.dialog.createCta:Create list`
    : $localize`:@@common.save:Save`;
  protected readonly submitting = signal(false);
  /** Localized through `ErrorCodeService` — no per-component message mapping (A22). */
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * The kinds this one may be filed under.
   *
   * Itself excluded — a kind filed under itself is refused by the server, and offering the
   * option would be offering a save that cannot succeed. Everything else is fair game,
   * including builtins: filing a new list under `compound_category` is a legitimate thing to
   * want, and the axis itself carries no behaviour a builtin has to opt into.
   */
  protected readonly parentCandidates = computed(() =>
    this.enumTypes.definitions().filter((d) => d.active && d.key !== this.currentKey),
  );

  private get currentKey(): string {
    return this.data.mode === 'edit' ? this.data.definition.key : '';
  }

  protected readonly form = new FormGroup({
    key: new FormControl<string>(
      { value: this.currentKey, disabled: this.data.mode === 'edit' },
      { nonNullable: true, validators: [Validators.required, Validators.pattern(KEY_PATTERN)] },
    ),
    labelEn: new FormControl<string>(
      this.data.mode === 'edit' ? this.data.definition.labelEn : '',
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] },
    ),
    labelAr: new FormControl<string>(
      this.data.mode === 'edit' ? this.data.definition.labelAr : '',
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] },
    ),
    descriptionEn: new FormControl<string>(
      this.data.mode === 'edit' ? (this.data.definition.descriptionEn ?? '') : '',
      { nonNullable: true, validators: [Validators.maxLength(400)] },
    ),
    descriptionAr: new FormControl<string>(
      this.data.mode === 'edit' ? (this.data.definition.descriptionAr ?? '') : '',
      { nonNullable: true, validators: [Validators.maxLength(400)] },
    ),
    parentTypeKey: new FormControl<string>(
      this.data.mode === 'edit' ? (this.data.definition.parentTypeKey ?? '') : '',
      { nonNullable: true },
    ),
    active: new FormControl<boolean>(
      this.data.mode === 'edit' ? this.data.definition.active : true,
      { nonNullable: true },
    ),
    onValuesRail: new FormControl<boolean>(
      this.data.mode === 'edit' ? this.data.definition.onValuesRail : true,
      { nonNullable: true },
    ),
  });

  /**
   * A builtin the code reads by name. `active` and `onValuesRail` are both in the server's
   * `SYSTEM_ONLY_LOCKED_FIELDS`, so offering them here would be offering a refusal.
   */
  protected isEdit(): boolean {
    return this.data.mode === 'edit';
  }

  protected locked(): boolean {
    return this.data.mode === 'edit' && this.data.definition.systemOnly;
  }

  protected lockedAttr(): string | null {
    return this.locked() ? '' : null;
  }

  /**
   * A list a PRODUCT authored. Putting one on the global rail would show a duplicate values
   * panel for a list that already lives on its product's own workspace — the state
   * `20260826090000` deliberately created by shipping those kinds with the rail flag off.
   */
  protected ownedByProduct(): boolean {
    return this.data.mode === 'edit' && this.data.definition.surrogateProductKey !== null;
  }

  protected keyInvalid(): boolean {
    const control = this.form.controls.key;
    return control.touched && control.invalid;
  }

  protected label(definition: EnumerationTypeDefinition): string {
    return this.isAr ? definition.labelAr : definition.labelEn;
  }

  protected cancel(): void {
    this.drawerRef.close(false);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    // `getRawValue`, not `value`: the key control is DISABLED on edit, and a disabled
    // control is absent from `value` — which would send a create-shaped body with no key.
    const raw = this.form.getRawValue();
    // `''` is the operator saying "no parent axis". Sent as `null` rather than as an empty
    // string, which the server stores and then reads back as a kind filed under a kind
    // called "" — the same trap `parentKey` closed one level down.
    const parentTypeKey = raw.parentTypeKey === '' ? null : raw.parentTypeKey;
    const body = {
      labelEn: raw.labelEn.trim(),
      labelAr: raw.labelAr.trim(),
      // Empty description means "there isn't one", not an empty sentence to render.
      descriptionEn: raw.descriptionEn.trim() || undefined,
      descriptionAr: raw.descriptionAr.trim() || undefined,
      parentTypeKey,
      // Sent ONLY when they moved. Including `active: true` on every label edit turns
      // "reactivated" into audit noise, and the audit is where an operator later looks to
      // find out when a list came back.
      ...(this.data.mode === 'edit' && raw.active !== this.data.definition.active
        ? { active: raw.active }
        : {}),
      ...(this.data.mode === 'edit' && raw.onValuesRail !== this.data.definition.onValuesRail
        ? { onValuesRail: raw.onValuesRail }
        : {}),
    };
    try {
      if (this.data.mode === 'create') {
        await this.api.createType({ key: raw.key.trim(), ...body });
      } else {
        await this.api.updateType(this.data.definition.key, body);
      }
      await this.enumTypes.refresh();
      this.drawerRef.close(true);
    } catch (err) {
      // The refusal carries `meta` the strings interpolate — `{key}` for a duplicate,
      // `{parentTypeKey}` for a bad axis — so both are passed rather than dropped.
      const body = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
      this.errorMessage.set(
        this.errorCodes.toLocalizedMessage(
          (body?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          body?.meta,
        ),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
