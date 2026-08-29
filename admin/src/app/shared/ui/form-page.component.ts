import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { PageHeaderComponent } from './page-header.component';

/**
 * The shell for a form that is too big to be a side sheet — its own screen, with a
 * URL, a back arrow and an action bar that stays put while the form scrolls.
 *
 * The line between this and `app-form-drawer` is the SIZE of the form, not its
 * importance: a bounded set of fields belongs in a sheet, where the list it edits
 * stays visible beside it. A form that asks twenty questions, branches on a type
 * choice, or grows a `FormArray` needs the whole viewport and a link somebody can
 * come back to — squeezed into a sheet it becomes a scrolling column with its own
 * inner scrollbar, and any interruption loses the work because there is no URL to
 * return to.
 *
 * Both shells present the same three parts in the same order (title block, body,
 * action bar carrying the outcome on the start side), so moving a form between them
 * is a change of container and not of vocabulary — including drawing their own glyphs as
 * inline SVG rather than `nz-icon`. See `FormDrawerComponent` for the measurement: an
 * `NzIconPatchService` on a shell is the nearest one to every icon the hosted form
 * projects into it, and `NzIconDirective` patches only the nearest one's set.
 */
@Component({
  selector: 'app-form-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzButtonModule, PageHeaderComponent],
  template: `
    <section class="page fp">
      <button class="fp__back" type="button" (click)="cancelled.emit()">
        <svg
          class="fp__glyph fp__glyph--back"
          viewBox="64 64 896 896"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M872 474H286.9l350.2-304c5.6-4.9 2.2-14-5.2-14h-88.5c-3.9 0-7.6 1.4-10.5 3.9L155 487.8a31.96 31.96 0 000 48.3L535.1 866c1.5 1.3 3.3 2 5.2 2h91.5c7.4 0 10.8-9.2 5.2-14L286.9 550H872c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z"
          />
        </svg>
        <span>{{ backLabel() }}</span>
      </button>

      <app-page-header [eyebrow]="eyebrow() ?? ''" [title]="title()" [subtitle]="subtitle() ?? ''">
        <ng-content select="[formPageAside]" />
      </app-page-header>

      <div class="fp__body">
        <ng-content />
      </div>

      <!-- Sticky, not fixed: fixed would need the sidebar's width hardcoded here,
           and would sit over the page on short forms that do not scroll at all. -->
      <footer class="fp__bar">
        <p class="fp__outcome">
          @if (blockReason(); as reason) {
            <span class="fp__blocked">
              <svg class="fp__glyph" viewBox="64 64 896 896" fill="currentColor" aria-hidden="true">
                <path
                  d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"
                />
                <path
                  d="M464 688a48 48 0 1096 0 48 48 0 10-96 0zm24-112h48c4.4 0 8-3.6 8-8V296c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8z"
                />
              </svg>
              <span>{{ reason }}</span>
            </span>
          } @else {
            <span>{{ hint() }}</span>
          }
        </p>
        <div class="fp__acts">
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
            [disabled]="submitDisabled() || submitting() || blockReason() !== null"
            [nzLoading]="submitting()"
            (click)="submitted.emit()"
          >
            <ng-content select="[formPageSubmitIcon]" />
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
      }
      .fp {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      /* A quiet link, not a button: it leaves without saving, and giving it a
         button's weight puts it in competition with the action bar's own Cancel. */
      .fp__back {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
        margin-inline-start: calc(var(--space-2) * -1);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .fp__back:hover {
        background: var(--bg-subtle);
        color: var(--color-text-primary);
      }
      .fp__back:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* Capped at a readable column. A form field stretched across a 1280px page
         puts its label and its value at opposite ends of the screen. */
      .fp__body,
      .fp__bar {
        max-inline-size: 60rem;
      }
      /* Room for the sticky bar to float over. Without it the bar covers the foot of the
         form permanently — the last field can be scrolled to but never out from under it. */
      .fp__body {
        padding-block-end: var(--space-7);
      }
      .fp__bar {
        position: sticky;
        inset-block-end: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        /* No shadow. Every shadow token in this theme casts DOWNWARD, and a bar
           pinned to the bottom edge needs the lift above it — the border and the
           opaque surface already separate it from the form scrolling underneath. */
      }
      /* Same reason as the sheet's hint: this sentence is the outcome of the form,
         so it takes secondary ink rather than tertiary. */
      .fp__outcome {
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .fp__blocked {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-warning);
      }
      .fp__acts {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-inline-start: auto;
      }
      .fp__acts ::ng-deep [nz-icon] {
        margin-inline-end: var(--space-1);
      }
      .fp__glyph {
        inline-size: 1em;
        block-size: 1em;
        flex: 0 0 auto;
      }
      /* One arrow, mirrored by direction — the way back is the trailing edge in
         Arabic, and a second path would be the same glyph maintained twice. */
      :host-context([dir='rtl']) .fp__glyph--back {
        transform: scaleX(-1);
      }
    `,
  ],
})
export class FormPageComponent {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Neutral line on the start side of the action bar — what Save will do next. */
  readonly hint = input<string | null>(null);
  /**
   * Why Save is refused, in the operator's words. Takes the hint's place and
   * disables Save: a greyed button with the reason elsewhere on a long form is a
   * reason nobody scrolls back to find.
   */
  readonly blockReason = input<string | null>(null);
  readonly backLabel = input<string>($localize`:@@fp.back:Back`);
  readonly cancelLabel = input<string>($localize`:@@fd.cancel:Cancel`);
  readonly submitLabel = input.required<string>();
  readonly submitDisabled = input(false, { transform: booleanAttribute });
  readonly submitting = input(false, { transform: booleanAttribute });

  readonly cancelled = output<void>();
  readonly submitted = output<void>();
}
