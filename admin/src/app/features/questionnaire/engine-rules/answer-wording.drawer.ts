import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { CloseCircleOutline, EditOutline } from '@ant-design/icons-angular/icons';
import { map } from 'rxjs';
import { FormDrawerComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { AnswerMeaningsComponent } from './answer-meanings.component';
import { EngineRulesApiService } from './engine-rules.api.service';
import { keepLine, wordingOf } from './engine-rules.labels';
import type { EngineRuleOption, EngineRuleQuestion } from './engine-rules.types';

export interface AnswerWordingDrawerData {
  question: EngineRuleQuestion;
  option: EngineRuleOption;
}

/** The server's `@Length(1, 200)` on an option label. */
const LABEL_MAX = 200;

/** The hint under a label field: the quantities it states, or that it states none. */
function keepHint(written: readonly string[]): string {
  if (written.length === 0) return $localize`:@@qrules.keep_none:No numbers here — don't add any.`;
  const numbers = keepLine(written);
  return $localize`:@@qrules.keep_numbers:Keep exactly: ${numbers}:numbers:`;
}

/** Required, and not just spaces — a label of blanks is an answer with no words. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/**
 * Rewords ONE answer of a question the loan engine reads — its two labels and nothing else.
 *
 * What has to stay is said BEFORE the admin types, under each field ("Keep exactly: 1 · 3 ·
 * million"), from the same extraction the server refuses with. The server is the only judge:
 * a reword that changes a quantity comes back as `ENGINE_WORDING_NUMBERS_CHANGED` and is read
 * out here, beside the fields, with the numbers it found — the sheet stays open on it.
 */
@Component({
  selector: 'app-answer-wording-drawer',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    FormDrawerComponent,
    AnswerMeaningsComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline, EditOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="title"
      [subtitle]="questionWording"
      [hint]="hint"
      [submitLabel]="submitLabel"
      [submitDisabled]="!canSave()"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="save()"
    >
      <span drawerIcon nz-icon nzType="edit" nzTheme="outline"></span>
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form" (ngSubmit)="save()">
        <dl class="context">
          <div class="context-row">
            <dt i18n="@@qrules.sheet_code">Answer code</dt>
            <dd>
              <bdi class="code">{{ option.code }}</bdi>
            </dd>
          </div>
          @if (option.meanings.length > 0) {
            <div class="context-row">
              <dt i18n="@@qrules.sheet_meaning">What it means to the engine</dt>
              <dd><app-answer-meanings [meanings]="option.meanings" [isAr]="isAr" /></dd>
            </div>
          }
        </dl>

        <div class="field-pair">
          <nz-form-item>
            <nz-form-label nzFor="aw-label-en" nzRequired i18n="@@qrules.field_en"
              >English wording</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelErrTpl">
              <input
                nz-input
                id="aw-label-en"
                formControlName="labelEn"
                dir="ltr"
                lang="en"
                autocomplete="off"
                [attr.maxlength]="labelMax"
                aria-describedby="aw-keep-en"
              />
            </nz-form-control>
            <p class="keep" id="aw-keep-en">{{ keepEn }}</p>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="aw-label-ar" nzRequired i18n="@@qrules.field_ar"
              >Arabic wording</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelErrTpl">
              <input
                nz-input
                id="aw-label-ar"
                formControlName="labelAr"
                dir="rtl"
                lang="ar"
                autocomplete="off"
                [attr.maxlength]="labelMax"
                aria-describedby="aw-keep-ar"
              />
            </nz-form-control>
            <p class="keep" id="aw-keep-ar">{{ keepAr }}</p>
          </nz-form-item>
        </div>

        <ng-template #labelErrTpl let-control>
          @if (control.errors?.['required']) {
            <span i18n="@@qrules.err_required">Write the answer's wording.</span>
          } @else if (control.errors?.['maxlength']) {
            <span i18n="@@qrules.err_too_long">Keep it to 200 characters.</span>
          }
        </ng-template>

        @if (errorMessage(); as message) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ message }}</span>
          </p>
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
        display: grid;
        gap: var(--space-5);
        margin: 0;
      }
      .form nz-form-item {
        margin-block-end: 0;
      }
      .context {
        display: grid;
        gap: var(--space-3);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .context-row {
        display: grid;
        gap: var(--space-1);
      }
      .context dt {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
      }
      .context dd {
        margin: 0;
      }
      .code {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .field-pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      .keep {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .error {
        display: inline-flex;
        gap: var(--space-2);
        align-items: flex-start;
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .error [nz-icon] {
        margin-block-start: var(--space-1);
      }
    `,
  ],
})
export class AnswerWordingDrawerComponent {
  private readonly api = inject(EngineRulesApiService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly drawerRef = inject(NzDrawerRef<AnswerWordingDrawerComponent, boolean>);
  private readonly data = inject<AnswerWordingDrawerData>(NZ_DRAWER_DATA);

  /** Arabic primary (Principle IV) — the same document read every other surface does. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly option = this.data.option;
  protected readonly labelMax = LABEL_MAX;
  /** What each label has to keep, said before anything is typed. */
  protected readonly keepEn = keepHint(this.data.option.keep.en);
  protected readonly keepAr = keepHint(this.data.option.keep.ar);

  protected readonly title = $localize`:@@qrules.sheet_title:Edit answer wording`;
  protected readonly questionWording = wordingOf(this.data.question, this.isAr);
  protected readonly hint = $localize`:@@qrules.sheet_hint:Saving publishes a new questionnaire version right away.`;
  protected readonly submitLabel = $localize`:@@qrules.sheet_submit:Save wording`;

  protected readonly form = new FormGroup({
    labelEn: new FormControl(this.data.option.labelEn, {
      nonNullable: true,
      validators: [Validators.required, notBlank, Validators.maxLength(LABEL_MAX)],
    }),
    labelAr: new FormControl(this.data.option.labelAr, {
      nonNullable: true,
      validators: [Validators.required, notBlank, Validators.maxLength(LABEL_MAX)],
    }),
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );
  private readonly valid = toSignal(this.form.statusChanges.pipe(map(() => this.form.valid)), {
    initialValue: this.form.valid,
  });

  /** Something to save: valid, and a label that differs once trimmed — a resend is not an edit. */
  protected readonly canSave = computed(() => {
    const v = this.value();
    return (
      this.valid() &&
      (v.labelEn.trim() !== this.data.option.labelEn ||
        v.labelAr.trim() !== this.data.option.labelAr)
    );
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  cancel(): void {
    this.drawerRef.close(false);
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.submitting()) return;
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      await this.api.saveAnswerWording(this.data.option.id, {
        labelEn: v.labelEn.trim(),
        labelAr: v.labelAr.trim(),
      });
      this.drawerRef.close(true);
    } catch (err) {
      // The refusal names what was kept and what was found (`{keep}` / `{found}`), so the
      // meta goes through with the code — the sentence itself is the admin's catalog.
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
