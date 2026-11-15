import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';

export interface SearchSelectOption {
  value: string;
  label: string;
}

/**
 * A one-value dropdown you can type into to find an option — for lists a signal owns
 * (the caller keeps the value; every pick is an output). An empty value shows the
 * placeholder; `clearLabel`, when given, is a first option that picks ''.
 */
@Component({
  selector: 'app-search-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzSelectModule],
  template: `
    <nz-select
      class="ss"
      nzShowSearch
      [formControl]="ctl"
      [nzPlaceHolder]="placeholder()"
      [nzNotFoundContent]="noneFound"
      [attr.aria-label]="ariaLabel()"
    >
      @if (clearLabel(); as c) {
        <nz-option nzValue="" [nzLabel]="c"></nz-option>
      }
      @for (o of options(); track o.value) {
        <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
      }
    </nz-select>
  `,
  styles: [
    `
      :host {
        display: block;
        inline-size: 100%;
        max-inline-size: 32rem;
      }
      .ss {
        inline-size: 100%;
      }
    `,
  ],
})
export class SearchSelectComponent {
  readonly options = input.required<readonly SearchSelectOption[]>();
  readonly value = input<string>('');
  readonly placeholder = input<string>($localize`:@@ps.choose:Choose…`);
  readonly clearLabel = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly changed = output<string>();

  protected readonly noneFound = $localize`:@@ss.none:Nothing matches.`;
  protected readonly ctl = new FormControl<string | null>(null);

  constructor() {
    this.ctl.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((v) => this.pick(v));
    effect(() => {
      const v = this.value();
      const shown = v === '' && this.clearLabel() === null ? null : v;
      if (this.ctl.value !== shown) this.ctl.setValue(shown, { emitEvent: false });
    });
  }

  private pick(v: string | null): void {
    if ((v ?? '') !== this.value()) this.changed.emit(v ?? '');
  }
}
