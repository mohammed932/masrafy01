/**
 * Step 4 of a no-payslip product — "Who uses it" (v33.1.0, split out of the product page).
 *
 * Every catalog name selling this product and the bank programs under each, plus the one
 * action this step owns: selling the product as a new program name. A pure view over the
 * product the page already holds — it reads nothing and writes nothing itself.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { InfoCircleOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import type {
  ProgramUnderName,
  SurrogateProductDetail,
} from '@features/bank-programs/bank-programs.types';

@Component({
  selector: 'app-product-uses-step',
  standalone: true,
  imports: [RouterLink, NzButtonModule, NzIconModule],
  providers: [provideNzIconsPatch([InfoCircleOutline, PlusOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (product(); as p) {
      <!-- SELL IT (v33.1.0): the product's own way to a program name customers pick.
           The server refuses a product that is off or cap-only, so the button says why
           before anyone presses it. -->
      <div class="sell-row">
        @if (p.capOnly) {
          <p class="sell-note" i18n="@@spd.sell.cap_only">
            A cap-only product is not sold as a program: a bank caps its own program by the answer
            instead.
          </p>
        } @else if (!p.active) {
          <p class="sell-note" i18n="@@spd.sell.off">Switch it on to sell it as a program.</p>
        }
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="p.capOnly || !p.active"
          (click)="openSell()"
        >
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@spd.sell.cta">Sell it as a program</span>
        </button>
      </div>
      @if (p.names.length === 0) {
        <p class="notice">
          <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@spd.uses_none"
            >No catalog program name takes its calculation from this product yet. Link one from the
            program catalog, and every bank filing a program under that name quotes from here.</span
          >
        </p>
      } @else {
        <ul class="names" role="list">
          @for (n of p.names; track n.key) {
            <li class="name">
              <!-- The NAME, not the slug. This rendered n.key — the operator read
                   a slug on a product called Doctors and concluded the
                   clinic-owner half had never been built. The key still shows, as a
                   chip beside it, because it is what every other surface addresses
                   this row by and an operator does need to see it. -->
              <a
                class="name-link"
                [id]="'spd-name-' + n.key"
                [routerLink]="['/program-catalog', n.key]"
                >{{ nameLabel(n) }}</a
              >
              @if (n.programs.length === 0) {
                <span class="muted" i18n="@@spd.no_programs">No bank offers this name yet</span>
              } @else {
                <!-- Named, not coded. One product is deliberately sold as several
                     programmes off one mechanism, so a column of bare codes is the
                     one thing this list must not be: ABK files the clinic-owner
                     table and the half-figure in-practice one under the same name,
                     and the code alone says which is which to nobody. The bank's
                     own name leads, the bank and the code follow it, and the row
                     opens the programme where its figures actually live — one
                     authority on those, not a copy of them here. -->
                <ul class="programs" role="list" [attr.aria-labelledby]="'spd-name-' + n.key">
                  @for (prog of n.programs; track prog.programCode) {
                    <li class="prog-row">
                      <!-- One explicit accessible name. Left to the DOM it would be
                           the concatenation of name + bank + code + tag with no
                           separators, which is how a screen reader ends up reading a
                           programme code aloud one character class at a time. -->
                      <a
                        class="prog"
                        [routerLink]="['/banks/programs', prog.programCode]"
                        [attr.aria-label]="progAria(prog)"
                      >
                        <span class="prog-name">{{ programLabel(prog) }}</span>
                        <span class="prog-meta" aria-hidden="true">
                          @if (bankLabel(prog); as bank) {
                            <span class="prog-bank">{{ bank }}</span>
                          }
                          <!-- Isolated: an LTR code sits directly beside an RTL bank
                               name here, and without a bidi boundary the two reorder
                               into each other in the Arabic build. -->
                          <span class="code"
                            ><bdi>{{ prog.programCode }}</bdi></span
                          >
                          @if (!prog.ownAmounts) {
                            <span class="tag" i18n="@@spd.takes_catalog">takes these amounts</span>
                          }
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .notice {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .tag {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      .muted {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .sell-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .sell-note {
        margin: 0;
        margin-inline-end: auto;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .names {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      /* A grid, so the name and its key sit on ONE optical line with the programme list
         below spanning both — as a flex column the key became a line of its own and the
         two-level list read as three levels. */
      .name {
        display: grid;
        grid-template-columns: minmax(0, auto) minmax(0, 1fr);
        align-items: baseline;
        column-gap: var(--space-2);
        row-gap: var(--space-2);
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--border-default);
      }

      .name > .programs,
      .name > .muted {
        grid-column: 1 / -1;
      }

      /* Renamed from .name-key with the thing it renders: it carried mono type because it
         printed a slug, and a proper name set in mono reads as an identifier. It is also the
         PARENT of the programme rows below it, so it sits a step above their --text-sm.
         No align-self — the grid's baseline alignment is what puts it on one optical line
         with the key chip beside it. */
      .name-link {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--primary-visible);
        text-decoration: none;
        cursor: pointer;
      }

      .name-link:hover {
        text-decoration: underline;
      }

      .name-link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      /* Rows on a hairline, matching .asks / .ask in step ① of this same screen rather
         than inventing a third row style — each programme carries a name, a bank and a code,
         and as a chip row those wrapped mid-name into one run-on line. */
      .programs {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .prog-row {
        border-block-end: 1px solid var(--border-subtle);
      }

      .prog-row:last-child {
        border-block-end: 0;
      }

      .prog {
        display: grid;
        gap: var(--space-0-5);
        padding-block: var(--space-2);
        padding-inline: var(--space-2);
        border-radius: var(--radius-sm);
        color: inherit;
        text-decoration: none;
      }

      /* --bg-subtle, never --bg-muted: muted is the chip ground (DESIGN_SYSTEM.md), so a
         muted row hover painted the .code pill out of existence under the cursor. */
      .prog:hover {
        background: var(--bg-subtle);
      }

      /* An OPAQUE ring. The translucent halo alone measures 1.24:1 in light against the
         surface it sits on, under SC 1.4.11's 3:1 — the same pattern .prog-hit on the bank
         detail page already uses for these very rows. */
      .prog:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .prog-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }

      /* No hover to reveal the row means it is tapped: a real target under the finger. */
      @media (hover: none) {
        .prog {
          min-block-size: var(--size-field);
          align-content: center;
        }
      }

      .prog-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }

      /* Secondary, never tertiary: the bank is the other half of "which programme is this",
         and tertiary ink sits under 4.5:1 at this size. */
      .prog-bank {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      /* A BORDER, and the STRONG token. Measured, the fill alone is 1.08:1 against a hovered
         row and 1.17:1 against the resting card, so moving the hover ground off --bg-muted
         stopped the chip vanishing without ever making it read AS a chip; --border-default
         then only reached 1.38:1. The edge is DECORATION and not held to SC 1.4.11's 3:1 —
         the chip's own text carries 5.29:1 and is what conveys the content — so the target
         here is perceptible, not compliant-in-its-own-right. */
      /* The programme code, as plain secondary text beside its bank (v36.1.0). */
      .code {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
    `,
  ],
})
export class ProductUsesStepComponent {
  readonly product = input.required<SurrogateProductDetail>();
  /** "Sell it as a program" — the page owns the sheet. */
  readonly sell = output<void>();

  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected openSell(): void {
    this.sell.emit();
  }

  protected programLabel(prog: ProgramUnderName): string {
    return (this.isAr ? prog.friendlyNameAr : prog.friendlyName) || prog.friendlyName;
  }

  protected nameLabel(n: { key: string; labelEn: string; labelAr: string }): string {
    return (this.isAr ? n.labelAr : n.labelEn) || n.labelEn || n.key;
  }

  protected bankLabel(prog: ProgramUnderName): string | null {
    return (this.isAr ? prog.bankNameAr : prog.bankNameEn) ?? prog.bankNameEn ?? null;
  }

  /** The row's accessible name: every fact in it, separated rather than run together. */
  protected progAria(prog: ProgramUnderName): string {
    const parts = [this.programLabel(prog)];
    const bank = this.bankLabel(prog);
    if (bank !== null) parts.push(bank);
    if (!prog.ownAmounts) {
      parts.push($localize`:@@spd.takes_catalog_aria:takes the catalog amounts`);
    }
    parts.push(prog.programCode);
    return parts.join(' — ');
  }
}
