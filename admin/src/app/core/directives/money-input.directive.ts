import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Strip to a canonical numeric string: digits with at most one decimal point, no separators. */
function toRaw(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot) + '.' + cleaned.slice(dot + 1).replace(/\./g, '');
}

/** "1000000" → "1,000,000"; keeps any decimal part intact. */
function group(value: string): string {
  const raw = toRaw(value);
  if (raw === '') return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const fracPart = dot === -1 ? null : raw.slice(dot + 1);
  const intGrouped = intPart === '' ? '0' : Number(intPart).toLocaleString('en-US');
  return fracPart === null ? intGrouped : `${intGrouped}.${fracPart}`;
}

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
  private readonly elRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private get el(): HTMLInputElement {
    return this.elRef.nativeElement;
  }

  writeValue(value: string | null): void {
    this.el.value = group(value ?? '');
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
    const formatted = group(previous);
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
