import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  signal,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface BrandSelectOption {
  value: string;
  label: string;
  secondary?: string;
}

/**
 * Branded dropdown that ALWAYS opens directly below its trigger.
 * No CDK overlay — panel is absolutely positioned inside the component host.
 * Form-binding via ControlValueAccessor (single + multi modes).
 *
 * Usage:
 *   <app-brand-select formControlName="programType" [options]="..." [multiple]="false"
 *                     label="Program type" />
 */
@Component({
  selector: 'app-brand-select',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BrandSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="bs-wrap" [class.bs-open]="open()" [class.bs-disabled]="disabled()">
      @if (label) {
        <label class="bs-label" (click)="toggle()">{{ label }}</label>
      }

      <button
        #trigger
        type="button"
        class="bs-trigger"
        [class.bs-empty]="isEmpty()"
        [disabled]="disabled()"
        [attr.aria-expanded]="open()"
        [attr.aria-haspopup]="'listbox'"
        (click)="toggle()"
        (keydown)="onTriggerKey($event)"
      >
        <span class="bs-value">{{ displayValue() || placeholder }}</span>
        <svg
          class="bs-chevron"
          width="10"
          height="6"
          viewBox="0 0 10 6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>

      @if (open()) {
        <ul class="bs-panel" role="listbox" [attr.aria-multiselectable]="multiple">
          @for (opt of options; track opt.value; let i = $index) {
            <li
              class="bs-option"
              [class.bs-multi]="multiple"
              role="option"
              [class.bs-selected]="isSelected(opt.value)"
              [class.bs-active]="i === activeIndex()"
              [attr.aria-selected]="isSelected(opt.value)"
              (click)="select(opt.value); $event.stopPropagation()"
              (mouseenter)="activeIndex.set(i)"
            >
              @if (multiple) {
                <span
                  class="bs-checkbox"
                  [class.bs-checkbox-on]="isSelected(opt.value)"
                  aria-hidden="true"
                >
                  @if (isSelected(opt.value)) {
                    <svg width="12" height="12" viewBox="0 0 14 14">
                      <path
                        d="M2 7l3 3 7-7"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  }
                </span>
              }
              <span class="bs-option-label">{{ opt.label }}</span>
              @if (opt.secondary) {
                <span class="bs-option-secondary">{{ opt.secondary }}</span>
              }
              @if (!multiple && isSelected(opt.value)) {
                <svg class="bs-check" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M2 7l3 3 7-7"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              }
            </li>
          }
          @if (options.length === 0) {
            <li class="bs-empty-state">No options available</li>
          }
        </ul>
      }

      @if (hint) {
        <p class="bs-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .bs-wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        row-gap: 6px;
        margin: 0;
      }
      .bs-label {
        display: block;
        box-sizing: content-box;
        height: 18px;
        line-height: 18px;
        padding: 0 0 4px;
        min-block-size: 22px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--text-secondary, var(--color-text-secondary));
        cursor: pointer;
      }
      .bs-trigger {
        appearance: none;
        box-sizing: border-box;
        width: 100%;
        height: 44px;
        padding-inline: 14px 36px;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: 10px;
        font-family: var(--font-family-base);
        font-size: 14px;
        color: var(--color-text-primary);
        text-align: start;
        cursor: pointer;
        position: relative;
        transition:
          border-color 200ms ease,
          box-shadow 200ms ease;
      }
      [dir='rtl'] .bs-trigger {
        padding-inline: 36px 14px;
      }
      .bs-trigger:hover:not(:disabled) {
        border-color: var(--color-border-strong);
      }
      .bs-trigger:focus,
      .bs-trigger:focus-visible {
        outline: none;
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: 0 0 0 3px rgba(92, 6, 50, 0.15);
      }
      .bs-open .bs-trigger {
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: 0 0 0 3px rgba(92, 6, 50, 0.15);
      }
      .bs-trigger:hover:not(:disabled):not(:focus) {
        border-color: var(--primary, var(--color-brand-primary));
      }
      .bs-trigger:disabled {
        background: var(--color-surface-elevated);
        color: var(--color-text-tertiary);
        cursor: not-allowed;
      }
      .bs-empty .bs-value {
        color: var(--color-text-tertiary);
      }
      .bs-value {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bs-chevron {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-end: 14px;
        transform: translateY(-50%);
        color: var(--color-tonal-accent);
        transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
      }
      .bs-open .bs-chevron {
        transform: translateY(-50%) rotate(180deg);
      }
      .bs-panel {
        position: absolute;
        inset-inline-start: 0;
        inset-inline-end: 0;
        inset-block-start: calc(100% + 4px);
        margin: 0;
        padding: 6px;
        list-style: none;
        background: var(--color-surface-default);
        border: 1px solid
          color-mix(in srgb, var(--color-tonal-accent) 20%, var(--color-border-default));
        border-radius: 10px;
        box-shadow:
          0 1px 0 rgba(6, 21, 45, 0.02),
          0 12px 28px -8px rgba(6, 21, 45, 0.18),
          0 4px 10px -2px rgba(6, 21, 45, 0.08);
        z-index: 50;
        max-height: 280px;
        overflow-y: auto;
        animation: bs-fade 140ms cubic-bezier(0.2, 0, 0, 1);
      }
      @keyframes bs-fade {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .bs-panel {
          animation: none;
        }
      }
      .bs-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: background-color 80ms cubic-bezier(0.2, 0, 0, 1);
        position: relative;
      }
      .bs-option:hover,
      .bs-option.bs-active {
        background: color-mix(in srgb, var(--color-tonal-accent) 7%, transparent);
      }
      .bs-option.bs-selected {
        background: color-mix(in srgb, var(--color-tonal-accent) 11%, transparent);
        color: var(--color-brand-primary);
        font-weight: var(--font-weight-semibold);
      }
      .bs-option.bs-selected:hover,
      .bs-option.bs-selected.bs-active {
        background: color-mix(in srgb, var(--color-tonal-accent) 16%, transparent);
      }
      .bs-option-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bs-option-secondary {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-weight: var(--font-weight-regular);
      }
      .bs-check {
        color: var(--color-tonal-accent);
        flex-shrink: 0;
      }
      .bs-checkbox {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 3px;
        border: 1.5px solid var(--color-border-strong);
        background: var(--color-surface-default);
        color: transparent;
        transition:
          background 80ms cubic-bezier(0.2, 0, 0, 1),
          border-color 80ms cubic-bezier(0.2, 0, 0, 1);
      }
      .bs-checkbox-on {
        background: var(--color-tonal-accent);
        border-color: var(--color-tonal-accent);
        color: var(--color-surface-default);
      }
      .bs-option.bs-multi.bs-selected {
        background: transparent;
        color: var(--color-text-primary);
        font-weight: var(--font-weight-regular);
      }
      .bs-option.bs-multi.bs-selected:hover,
      .bs-option.bs-multi.bs-selected.bs-active {
        background: color-mix(in srgb, var(--color-tonal-accent) 6%, transparent);
      }
      .bs-empty-state {
        padding: 16px;
        font-size: var(--text-sm);
        font-style: italic;
        color: var(--color-text-tertiary);
        text-align: center;
      }
      .bs-hint {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        margin: 0;
        padding-inline: 2px;
      }
      .bs-panel::-webkit-scrollbar {
        width: 8px;
      }
      .bs-panel::-webkit-scrollbar-thumb {
        background: var(--color-border-default);
        border-radius: 999px;
        border: 2px solid var(--color-surface-default);
      }
    `,
  ],
})
export class BrandSelectComponent implements ControlValueAccessor {
  @ViewChild('trigger') triggerRef?: ElementRef<HTMLButtonElement>;

  @Input() options: BrandSelectOption[] = [];
  @Input() label?: string;
  @Input() hint?: string;
  @Input() placeholder = '';
  @Input() multiple = false;

  /** Optional non-CVA value input (useful when binding to a FormArray). */
  @Input()
  set value(v: string | string[] | null) {
    this.writeValue(v);
  }
  get value(): string | string[] | null {
    return this._value();
  }

  @Output() valueChange = new EventEmitter<string | string[]>();

  readonly open = signal(false);
  readonly disabled = signal(false);
  readonly activeIndex = signal(0);

  private readonly _value = signal<string | string[] | null>(null);
  private onChange: (v: string | string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  // --- ControlValueAccessor ---

  writeValue(v: string | string[] | null): void {
    this._value.set(v);
  }
  registerOnChange(fn: (v: string | string[] | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  // --- Public actions ---

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (this.open()) {
      const idx = this.options.findIndex((o) => this.isSelected(o.value));
      this.activeIndex.set(idx >= 0 ? idx : 0);
    } else {
      this.onTouched();
    }
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
    }
  }

  select(value: string): void {
    if (this.multiple) {
      const current = Array.isArray(this._value()) ? [...(this._value() as string[])] : [];
      const i = current.indexOf(value);
      if (i >= 0) current.splice(i, 1);
      else current.push(value);
      this._value.set(current);
      this.onChange(current);
      this.valueChange.emit(current);
    } else {
      this._value.set(value);
      this.onChange(value);
      this.valueChange.emit(value);
      this.close();
    }
  }

  isSelected(value: string): boolean {
    const v = this._value();
    if (this.multiple && Array.isArray(v)) return v.includes(value);
    return v === value;
  }

  isEmpty(): boolean {
    const v = this._value();
    if (this.multiple) return !Array.isArray(v) || v.length === 0;
    return v === null || v === undefined || v === '';
  }

  displayValue(): string {
    const v = this._value();
    if (this.multiple && Array.isArray(v)) {
      const labels = v
        .map((vv) => this.options.find((o) => o.value === vv)?.label ?? vv)
        .filter(Boolean);
      return labels.join(', ');
    }
    if (typeof v === 'string') {
      return this.options.find((o) => o.value === v)?.label ?? v;
    }
    return '';
  }

  onTriggerKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (!this.open()) this.toggle();
    } else if (ev.key === 'Escape' && this.open()) {
      this.close();
    } else if (this.open()) {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        this.activeIndex.update((i) => Math.min(i + 1, this.options.length - 1));
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.activeIndex.update((i) => Math.max(i - 1, 0));
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const opt = this.options[this.activeIndex()];
        if (opt) this.select(opt.value);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as Node;
    if (!this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }
}
