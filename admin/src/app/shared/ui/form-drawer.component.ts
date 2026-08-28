import {
  ChangeDetectionStrategy,
  Component,
  type Type,
  booleanAttribute,
  input,
  output,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService, type NzDrawerRef } from 'ng-zorro-antd/drawer';

/**
 * The ONE shell every add / edit form is rendered in — a side sheet, not a modal.
 *
 * Why a sheet: an add/edit form is read against the list it edits. A centred modal
 * covers that list and dims it, so the operator loses the row they were comparing
 * against the moment they open the form; a sheet keeps the page on screen beside
 * the fields. It also gives a form its natural axis — a column that can grow
 * downward and scroll — where a modal grows toward both edges of the viewport and
 * has to be capped by hand at every call site (`nzWidth: 'min(640px, …)'`, six
 * different numbers across this app).
 *
 * It owns the three parts a form drawer always has, so no caller re-states them:
 * a header (medallion + title + subtitle + close), a scrolling body, and a footer
 * pinned to the bottom edge carrying the hint and the two actions. The body is
 * the ONLY scrolling region — a footer that scrolls away is a Save button an
 * operator has to hunt for at the end of a long form.
 *
 * The medallion icon is PROJECTED rather than named by an input: icons are registered
 * per feature with `provideNzIconsPatch`, so a name passed in would resolve against
 * this component's registry rather than the caller's.
 * Projected content resolves against the injector it is INSERTED into first, which is
 * why this shell draws its own two glyphs as inline SVG instead of using `nz-icon`:
 * `NzIconDirective` injects the nearest `NzIconPatchService` and patches only that
 * one's set, so a patch here would shadow the patch of every form rendered inside it.
 * Measured, with a patch here: 7 blank icons on the new-question screen, 1 on the
 * product-fact screen, and a blank medallion on two of the four sheets. No patch
 * here, nothing to shadow.
 *
 * A form too big for a sheet does not belong in one. Many inputs, a wizard, or a
 * FormArray → give it a route and a page; this shell is for the bounded case.
 */
@Component({
  selector: 'app-form-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule],
  template: `
    <section class="fd">
      <header class="fd__head">
        <span class="fd__medallion" aria-hidden="true">
          <ng-content select="[drawerIcon]" />
        </span>
        <div class="fd__head-text">
          <h2 class="fd__title">{{ title() }}</h2>
          @if (subtitle(); as s) {
            <p class="fd__sub">{{ s }}</p>
          }
        </div>
        <button
          class="fd__close"
          type="button"
          [attr.aria-label]="closeLabel()"
          [disabled]="submitting()"
          (click)="cancelled.emit()"
        >
          <svg class="fd__glyph" viewBox="64 64 896 896" fill="currentColor" aria-hidden="true">
            <path
              d="M563.8 512l262.5-312.9c4.4-5.2.7-13.1-6.1-13.1h-79.8c-4.7 0-9.2 2.1-12.3 5.7L511.6 449.8 295.1 191.7c-3-3.6-7.5-5.7-12.3-5.7H203c-6.8 0-10.5 7.9-6.1 13.1L459.4 512 196.9 824.9A7.95 7.95 0 00203 838h79.8c4.7 0 9.2-2.1 12.3-5.7l216.5-258.1 216.5 258.1c3 3.6 7.5 5.7 12.3 5.7h79.8c6.8 0 10.5-7.9 6.1-13.1L563.8 512z"
            />
          </svg>
        </button>
      </header>

      <div class="fd__body">
        <ng-content />
      </div>

      <footer class="fd__foot">
        @if (hint(); as h) {
          <p class="fd__hint">
            <svg class="fd__glyph" viewBox="64 64 896 896" fill="currentColor" aria-hidden="true">
              <path
                d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"
              />
              <path
                d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"
              />
            </svg>
            <span>{{ h }}</span>
          </p>
        }
        <div class="fd__acts">
          <button
            nz-button
            nzType="default"
            type="button"
            [disabled]="submitting()"
            (click)="cancelled.emit()"
          >
            {{ cancelLabel() }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="submitDisabled() || submitting()"
            [nzLoading]="submitting()"
            (click)="submitted.emit()"
          >
            <ng-content select="[drawerSubmitIcon]" />
            {{ submitLabel() }}
          </button>
        </div>
      </footer>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        block-size: 100%;
      }
      /* Three rows: header and footer at their content height, body taking the
         rest. a zero min-block-size on the body is what lets it scroll instead of
         pushing the footer off the bottom of a grid track. */
      .fd {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        block-size: 100%;
        background: var(--bg-surface);
      }

      .fd__head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-5);
        border-block-end: 1px solid var(--border-default);
      }
      /* The medallion is the one piece of colour up here — it names the object the
         form is about before the title is read. Tonal, never solid: a filled accent
         square at this size reads as a button. */
      .fd__medallion {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--size-sheet-head-box);
        block-size: var(--size-sheet-head-box);
        flex: 0 0 auto;
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
        background: var(--accent-subtle);
        color: var(--accent);
        font-size: var(--text-lg);
      }
      .fd__medallion:empty {
        display: none;
      }
      .fd__head-text {
        flex: 1 1 auto;
        min-inline-size: 0;
        display: grid;
        gap: var(--space-1);
      }
      .fd__title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--text-primary);
      }
      .fd__sub {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--text-secondary);
      }

      .fd__close {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--size-sheet-head-box);
        block-size: var(--size-sheet-head-box);
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-tertiary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .fd__close:hover:not(:disabled) {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .fd__close:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .fd__close:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .fd__body {
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: var(--space-5);
      }

      /* Pinned, and it says so with a hairline rather than a shadow: the body ends
         on a scroll edge and a second soft edge under it read as two rules. */
      .fd__foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding: var(--space-4) var(--space-5);
        border-block-start: 1px solid var(--border-default);
        background: var(--bg-surface);
      }
      /* Secondary, not tertiary: this line is read — it says what Save will do — and
         tertiary ink on the surface lands under 4.5:1 at this size. */
      .fd__hint {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .fd__acts {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-inline-start: auto;
      }
      .fd__acts ::ng-deep [nz-icon] {
        margin-inline-end: var(--space-1);
      }
      .fd__glyph {
        inline-size: 1em;
        block-size: 1em;
        flex: 0 0 auto;
      }
    `,
  ],
})
export class FormDrawerComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Footer line on the start side — what happens after Save, or what is optional. */
  readonly hint = input<string | null>(null);
  readonly submitLabel = input.required<string>();
  readonly cancelLabel = input<string>($localize`:@@fd.cancel:Cancel`);
  readonly closeLabel = input<string>($localize`:@@fd.close:Close`);
  readonly submitDisabled = input(false, { transform: booleanAttribute });
  readonly submitting = input(false, { transform: booleanAttribute });

  readonly cancelled = output<void>();
  readonly submitted = output<void>();
}

/**
 * A labelled break inside a drawer body — the sheet equivalent of a fieldset legend.
 *
 * Used when a form has a second, optional half ("also move students in now"): the
 * rule plus a small-caps label say the fields below are a different decision from
 * the ones above, without the boxed card that would read as a nested surface.
 */
@Component({
  selector: 'app-drawer-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ds">
      <p class="ds__legend">
        <span class="ds__label">{{ label() }}</span>
        @if (optionalLabel(); as o) {
          <span class="ds__optional">· {{ o }}</span>
        }
        <span class="ds__rule" aria-hidden="true"></span>
      </p>
      @if (hint(); as h) {
        <p class="ds__hint">{{ h }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .ds {
        display: grid;
        gap: var(--space-3);
      }
      .ds__legend {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .ds__optional {
        color: var(--text-muted);
        font-weight: var(--font-weight-medium);
      }
      .ds__rule {
        flex: 1 1 auto;
        block-size: 1px;
        background: var(--border-default);
      }
      .ds__hint {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--text-secondary);
      }
    `,
  ],
})
export class DrawerSectionComponent {
  readonly label = input.required<string>();
  /** Rendered after the label as "· Optional" — omit for a required section. */
  readonly optionalLabel = input<string | null>(null);
  readonly hint = input<string | null>(null);
}

export interface FormDrawerOptions<D> {
  /** The form component rendered inside the sheet. It hosts its own app-form-drawer. */
  content: Type<unknown>;
  data: D;
  /** Override only when the form is genuinely wider than one column of fields. */
  width?: string;
}

/** One column of fields plus its gutters; never wider than the viewport on a laptop. */
const DEFAULT_DRAWER_WIDTH = 'min(560px, calc(100vw - 32px))';

/** Hook for the one global rule this shell needs — see `styles.scss`. */
export const FORM_DRAWER_WRAP_CLASS = 'app-form-drawer-wrap';

/**
 * Opens a form component as a side sheet with the house configuration.
 *
 * `nzPlacement` is resolved from the document's own direction rather than left to
 * the CDK: the Arabic build sets `dir` on `<html>` at runtime (AppComponent), and a
 * hardcoded 'right' would put the sheet on the start side there — the sheet must
 * open from the END edge in both directions.
 *
 * Mask clicks do NOT close it. Everything opened this way holds unsaved input, and
 * a stray click on the dimmed list behind it is not a decision to discard that.
 * Esc still closes (a deliberate, unmistakable gesture).
 */
export function openFormDrawer<C extends object, D extends object, R>(
  drawer: NzDrawerService,
  options: FormDrawerOptions<D>,
): NzDrawerRef<C, R> {
  const rtl = document.documentElement.dir === 'rtl';
  // `object` rather than D on the antd generic: its nzData is a conditional type
  // (`D extends undefined ? {} : D`) that TypeScript cannot resolve while D is
  // unbound. The caller's own typing is kept by FormDrawerOptions<D> above, and by
  // the content component's `inject<D>(NZ_DRAWER_DATA)`.
  const ref = drawer.create<C, object, R>({
    nzContent: options.content as Type<C>,
    nzData: options.data,
    nzPlacement: rtl ? 'left' : 'right',
    nzWidth: options.width ?? DEFAULT_DRAWER_WIDTH,
    nzClosable: false,
    nzMaskClosable: false,
    // The shell owns the header, the footer AND the scroll: antd's own body
    // padding would double the header's, and its overflow would scroll the
    // footer out of view.
    nzBodyStyle: { padding: '0', overflow: 'hidden' },
    // Styled globally (styles.scss): the form component sits BETWEEN antd's body and
    // this shell, and a `block-size: 100%` cannot see through a `display: block`
    // ancestor of automatic height — without the rule the sheet stops at its content
    // and the footer floats mid-viewport.
    nzWrapClassName: FORM_DRAWER_WRAP_CLASS,
  });
  // Land the caret in the first text field once the sheet has finished opening.
  // antd focuses the first focusable node it finds, which in this layout is the
  // close button — someone who opened "Add bank" to type a name would tab past a
  // Close to reach the first box. Done here rather than in the shell's
  // `ngAfterViewInit` because that runs BEFORE the open animation, and antd's own
  // focus call lands after it and wins.
  //
  // Text fields only: focusing an ng-zorro picker is one keystroke away from
  // opening a list over the form the operator has not read yet.
  ref.afterOpen.subscribe(() => {
    const bodies = document.querySelectorAll<HTMLElement>('.ant-drawer-open .fd__body');
    const body = bodies[bodies.length - 1];
    body
      ?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled])',
      )
      ?.focus();
  });
  return ref;
}
