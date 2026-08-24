import { Directive, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { displayValue, formatGroupedNumber, toRaw } from './money-format';

// Re-exported so every existing importer keeps working after the pure half moved out.
export { displayValue, formatGroupedNumber };

/** Caret position just after the Nth digit of a grouped string. */
function caretAfterDigit(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted.charAt(i)) && ++seen === digitCount) return i + 1;
  }
  return formatted.length;
}

/**
 * Thousands-grouping for money inputs. Displays a grouped value (1,000,000) while
 * reporting the raw numeric string ("1000000") to the form model, so validators,
 * payload mapping, and backend DTOs never see separators. Caret is preserved by
 * digit offset across re-grouping.
 */
@Directive({
  selector: 'input[appMoneyInput]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputDirective), multi: true },
  ],
})
export class MoneyInputDirective implements ControlValueAccessor {
  /**
   * Whether to GROUP. `true` (the bare attribute) is money; `false` keeps the same value
   * accessor and reports the same canonical raw string, without separators.
   *
   * A percentage and a multiplier are not money and must not be grouped, and before this
   * they were a whole second `<input>` branch in every caller — one that bypassed `ngModel`
   * and read its value through `$any($event.target)` (A15/XXI). One flag replaces the fork.
   */
  @Input() set appMoneyInput(value: boolean | '' | undefined) {
    this.grouping = value !== false;
    // Re-render whatever is on screen under the new setting.
    this.el.value = displayValue(this.el.value, this.grouping);
  }

  private grouping = true;
  private readonly elRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private get el(): HTMLInputElement {
    return this.elRef.nativeElement;
  }

  writeValue(value: string | null): void {
    this.el.value = displayValue(value ?? '', this.grouping);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.disabled = isDisabled;
  }

  @HostListener('input')
  onInput(): void {
    const previous = this.el.value;
    const caret = this.el.selectionStart ?? previous.length;
    const digitsBeforeCaret = previous.slice(0, caret).replace(/\D/g, '').length;
    const formatted = displayValue(previous, this.grouping);
    this.el.value = formatted;
    const next = caretAfterDigit(formatted, digitsBeforeCaret);
    this.el.setSelectionRange(next, next);
    this.onChange(toRaw(previous));
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }
}
