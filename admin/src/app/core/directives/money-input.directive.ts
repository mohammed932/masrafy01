import { Directive, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { displayValue, formatGroupedNumber, toRaw } from './money-format';

// Re-exported so every existing importer keeps working after the pure half moved out.
export { displayValue, formatGroupedNumber };

/**
 * The characters that carry the number — digits, the decimal point, the sign. The caret goes
 * back with as many of them AFTER it as before the reformat. Counting digits from the start
 * parked it before a just-typed "." (after "12." it sat after the "2"), so "12.5" typed key
 * by key came out as "125."; counting from the end also survives a "0" the format adds in
 * front (".5" shown as "0.5").
 */
const MEANINGFUL = /[\d.-]/;

function meaningfulCount(text: string): number {
  let n = 0;
  for (const c of text) if (MEANINGFUL.test(c)) n += 1;
  return n;
}

/** The caret position in `formatted` that leaves `after` meaningful characters after it. */
function caretBefore(formatted: string, after: number): number {
  if (after <= 0) return formatted.length;
  let seen = 0;
  for (let i = formatted.length - 1; i >= 0; i--) {
    if (MEANINGFUL.test(formatted.charAt(i)) && ++seen === after) return i;
  }
  return 0;
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
    this.el.value = displayValue(this.el.value, this.grouping, this.signed);
  }

  /**
   * Keep a leading minus. Off by default: every money, percentage and month field in the
   * admin states a non-negative figure, and only a signed DELTA needs this.
   */
  @Input() set appMoneyInputSigned(value: boolean | '' | undefined) {
    this.signed = value !== false && value !== undefined;
    this.el.value = displayValue(this.el.value, this.grouping, this.signed);
  }

  private grouping = true;
  private signed = false;
  private readonly elRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private get el(): HTMLInputElement {
    return this.elRef.nativeElement;
  }

  writeValue(value: string | null): void {
    this.el.value = displayValue(value ?? '', this.grouping, this.signed);
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
    const after = meaningfulCount(previous.slice(caret));
    const formatted = displayValue(previous, this.grouping, this.signed);
    this.el.value = formatted;
    const next = Math.min(caretBefore(formatted, after), formatted.length);
    this.el.setSelectionRange(next, next);
    this.onChange(toRaw(previous, this.signed));
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }
}
