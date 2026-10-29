import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  LOCALE_ID,
  type OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  CloseCircleOutline,
  DeleteOutline,
  DownOutline,
  ExclamationCircleOutline,
} from '@ant-design/icons-angular/icons';
import { SkeletonRowsComponent } from '@shared/ui';
import {
  QuestionnaireApiService,
  type FixedServedOn,
  type QuestionDeleteImpact,
} from './questionnaire.api.service';
import { servedOnLabel } from './question-pool-view';

export interface DeleteFixedQuestionData {
  id: string;
  code: string;
  questionEn: string;
  questionAr: string;
}

/**
 * DELETE A FIXED QUESTION — the one write that may stop the loan engine getting an answer, so
 * it is said twice: the admin reads what the delete does, then types the question's code back.
 *
 * Modelled on the bank program's delete (`delete-program.dialog.ts`), with what that one lacks
 * here: the impact is READ first (`GET …/delete-impact`) and the confirm field is offered only
 * once it is in. A failed read fails CLOSED — Retry, and Delete stays off — because a delete
 * nobody could size is the one this dialog exists to stop. Questions shown only after this
 * one's answer have to go first, so with any of them the field is not offered at all.
 *
 * Opened by `NzModalService.create` (a full-viewport mask, A34), super admins only — the
 * server refuses anyone else, and a wrong code (`QUESTION_FIXED_DELETE_CONFIRM_REQUIRED`).
 * A refusal is the interceptor's toast; the dialog stays open on what was typed.
 */
@Component({
  selector: 'app-delete-fixed-question-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    SkeletonRowsComponent,
  ],
  providers: [
    provideNzIconsPatch([CloseCircleOutline, DeleteOutline, DownOutline, ExclamationCircleOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <span class="medallion" aria-hidden="true">
        <span nz-icon nzType="delete" nzTheme="outline"></span>
      </span>
      <div class="head-text">
        <h2 class="title" id="qfixdel-title" i18n="@@qfixdel.title">Delete this fixed question?</h2>
        <p class="wording">{{ wording }}</p>
      </div>
    </header>

    <div class="body" [attr.aria-busy]="loading()">
      @if (loading()) {
        <app-skeleton-rows [rows]="3" [cols]="[1, 3]" [ariaLabel]="loadingAria" />
      } @else if (failed()) {
        <div class="callout neutral">
          <p class="callout-text" i18n="@@qfixdel.load_failed">
            Couldn't check what this question is used for, so it can't be deleted yet.
          </p>
          <button nz-button type="button" (click)="load()" i18n="@@qfixdel.retry">Try again</button>
        </div>
      } @else {
        @if (impact(); as i) {
          <!-- First, and loud: the one consequence the admin cannot see from the question. -->
          @if (i.engineReads) {
            <div class="callout danger" role="alert">
              <span
                class="callout-icon"
                nz-icon
                nzType="close-circle"
                nzTheme="outline"
                aria-hidden="true"
              ></span>
              <p class="callout-text" i18n="@@qfixdel.engine_warn">
                The loan engine uses this answer to work out offers. Deleting it can stop offers or
                make them wrong (too high or too low).
              </p>
            </div>
          }
          <p class="lede" i18n="@@qfixdel.lede">Every program stops asking it right away.</p>

          <dl class="facts">
            @if (i.fixedServedOn; as servedOn) {
              <div class="fact">
                <dt i18n="@@qfixdel.asked_on">Asked on</dt>
                <dd>{{ servedOnText(servedOn) }}</dd>
              </div>
            }
            <div class="fact">
              <dt i18n="@@qfixdel.answers_label">Answers so far</dt>
              <dd>
                <span class="num" i18n="@@qfixdel.answers">{i.answersStored, plural,
                  =0 {None yet}
                  =1 {1 answer. It stays on its application.}
                  other {{{ i.answersStored }} answers. They stay on their applications.}
                }</span>
              </dd>
            </div>
            @if (i.programNames.length > 0) {
              <div class="fact">
                <dt i18n="@@qfixdel.read_by">Read by</dt>
                <dd>
                  <span class="num" i18n="@@qfixdel.programs">{i.programNames.length, plural,
                    =1 {1 program}
                    other {{{ i.programNames.length }} programs}
                  }</span>
                  <span class="names">{{ joined(i.programNames) }}</span>
                </dd>
              </div>
            }
            @if (i.productAsks.length > 0) {
              <div class="fact">
                <dt i18n="@@qfixdel.asked_by">Asked by</dt>
                <dd>
                  <span class="num" i18n="@@qfixdel.products">{i.productAsks.length, plural,
                    =1 {1 surrogate product}
                    other {{{ i.productAsks.length }} surrogate products}
                  }</span>
                  <span class="names">{{ joined(i.productAsks) }}</span>
                </dd>
              </div>
            }
          </dl>

          <!-- The server's own names for what would stop working: identifiers, so they are shown
               as code, one fold down, for whoever needs to look them up. -->
          @if (i.wouldBreak.length > 0) {
            <details class="tech">
              <summary>
                <span i18n="@@qfixdel.would_break">What stops working</span>
                <span
                  class="tech-chevron"
                  nz-icon
                  nzType="down"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
              </summary>
              <ul class="codes">
                @for (w of i.wouldBreak; track w) {
                  <li>
                    <bdi class="mono">{{ w }}</bdi>
                  </li>
                }
              </ul>
            </details>
          }

          @if (i.blockedBy.length > 0) {
            <div class="callout warn">
              <span
                class="callout-icon"
                nz-icon
                nzType="exclamation-circle"
                nzTheme="outline"
                aria-hidden="true"
              ></span>
              <div class="callout-text">
                <p class="callout-title" i18n="@@qfixdel.blocked_title">Delete these first</p>
                <p i18n="@@qfixdel.blocked_body">
                  They are only asked after this question's answer, so they have to go first:
                </p>
                <ul class="blocked">
                  @for (b of i.blockedBy; track b.code) {
                    <li>{{ isAr ? b.questionAr : b.questionEn }}</li>
                  }
                </ul>
              </div>
            </div>
          } @else if (i.confirmationRequired) {
            <div class="confirm">
              <label class="confirm-label" for="qfixdel-confirm" i18n="@@qfixdel.confirm_label"
                >Type <bdi class="mono code">{{ data.code }}</bdi> to confirm</label
              >
              <input
                #confirmInput
                nz-input
                id="qfixdel-confirm"
                class="mono"
                dir="ltr"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                [formControl]="confirmCtrl"
                (keydown.enter)="submit()"
              />
            </div>
          }
        }
      }
    </div>

    <footer class="foot">
      <button
        nz-button
        type="button"
        [disabled]="busy()"
        (click)="cancel()"
        i18n="@@qfixdel.cancel"
      >
        Cancel
      </button>
      <button
        nz-button
        nzType="primary"
        nzDanger
        type="button"
        [disabled]="!canDelete()"
        [nzLoading]="busy()"
        (click)="submit()"
        i18n="@@qfixdel.cta"
      >
        Delete question
      </button>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--bg-surface);
      }
      /* The end padding keeps the title off nz-modal's close button in either direction. */
      .head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding-block: var(--space-5) var(--space-3);
        padding-inline: var(--space-5) var(--space-8);
      }
      .medallion {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: var(--size-sheet-head-box);
        block-size: var(--size-sheet-head-box);
        border-radius: var(--radius-pill);
        background: var(--color-error-bg);
        color: var(--error-strong);
        font-size: var(--text-lg);
      }
      .head-text {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        padding-block-start: var(--space-1-5);
      }
      /* Red heading in the STRONG error ink: --error itself is a state colour and measures
         3.81:1 as text on this surface in light mode. */
      .title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--leading-tight);
        color: var(--error-strong);
      }
      .wording {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .body {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-1) var(--space-5) var(--space-5);
      }

      .callout {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        color: var(--text-primary);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .callout.danger {
        border-color: color-mix(in srgb, var(--error) 40%, transparent);
        background: var(--color-error-bg);
      }
      .callout.warn {
        border-color: color-mix(in srgb, var(--warning) 45%, transparent);
        background: var(--color-warning-bg);
      }
      .callout.neutral {
        flex-direction: column;
        gap: var(--space-3);
      }
      /* On the text's first line, at any font size. */
      .callout-icon {
        flex: none;
        margin-block-start: 0.2em;
      }
      .callout.danger .callout-icon {
        color: var(--error-strong);
      }
      .callout.warn .callout-icon {
        color: var(--warning);
      }
      .callout-text {
        display: grid;
        gap: var(--space-1);
        min-inline-size: 0;
        margin: 0;
      }
      .callout-text p {
        margin: 0;
      }
      .callout-title {
        font-weight: var(--font-weight-semibold);
      }
      .blocked {
        margin: 0;
        padding-inline-start: var(--space-4);
      }
      .lede {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-primary);
      }

      .facts {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-2) var(--space-4);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .fact {
        display: contents;
      }
      .facts dt {
        padding-block-start: var(--space-0-5);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
      }
      .facts dd {
        display: grid;
        gap: var(--space-0-5);
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .num {
        font-variant-numeric: tabular-nums lining-nums;
      }
      .names {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .cats {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .cat {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        font-size: var(--text-xs);
        color: var(--text-primary);
      }
      .cat::before {
        content: '';
        inline-size: var(--space-2);
        block-size: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--cat, var(--border-strong));
      }

      /* A disclosure that looks like one: the chevron turns when it opens. */
      .tech summary {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        min-block-size: var(--size-field);
        border-radius: var(--radius-md);
        list-style: none;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        cursor: pointer;
      }
      .tech summary::-webkit-details-marker {
        display: none;
      }
      .tech-chevron {
        font-size: var(--text-xs);
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .tech[open] .tech-chevron {
        transform: rotate(180deg);
      }
      .tech .codes {
        margin-block-start: var(--space-1);
      }
      @media (prefers-reduced-motion: reduce) {
        .tech-chevron {
          transition: none;
        }
      }
      .tech summary:hover {
        color: var(--text-primary);
      }
      .codes {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .codes .mono {
        padding: var(--space-0-5) var(--space-1-5);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        color: var(--text-primary);
      }

      .mono {
        font-family: var(--font-mono);
      }
      .confirm {
        display: grid;
        gap: var(--space-1-5);
        padding-block-start: var(--space-1);
      }
      .confirm-label {
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-primary);
      }
      /* The code to type, as a selectable chip: one click selects the whole of it. */
      .confirm-label .code {
        padding: var(--space-0-5) var(--space-1-5);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        user-select: all;
      }

      .foot {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        border-block-start: 1px solid var(--border-default);
      }
      .tech summary:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      @media (max-width: 480px) {
        .head,
        .body,
        .foot {
          padding-inline-start: var(--space-4);
        }
        .body,
        .foot {
          padding-inline-end: var(--space-4);
        }
        .facts {
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-1);
        }
        .facts dd + dt {
          margin-block-start: var(--space-2);
        }
      }
    `,
  ],
})
export class DeleteFixedQuestionDialog implements OnInit {
  private readonly ref = inject<NzModalRef<DeleteFixedQuestionDialog, boolean>>(NzModalRef);
  private readonly api = inject(QuestionnaireApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly data = inject<DeleteFixedQuestionData>(NZ_MODAL_DATA);

  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');
  protected readonly wording = this.isAr ? this.data.questionAr : this.data.questionEn;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly impact = signal<QuestionDeleteImpact | null>(null);
  /** A delete in flight. Read by the opener to keep Escape and the close button from closing. */
  readonly busy = signal(false);

  protected readonly confirmCtrl = new FormControl('', { nonNullable: true });
  private readonly typed = toSignal(this.confirmCtrl.valueChanges, { initialValue: '' });
  private readonly confirmInput = viewChild<ElementRef<HTMLInputElement>>('confirmInput');

  /** Exactly the code, as the server checks it — no trimming, no case folding. */
  protected readonly canDelete = computed(() => {
    const impact = this.impact();
    if (impact === null || this.busy() || impact.blockedBy.length > 0) return false;
    return !impact.confirmationRequired || this.typed() === this.data.code;
  });

  protected readonly loadingAria = $localize`:@@qfixdel.loading_aria:Checking what this question is used for`;

  constructor() {
    // nz-modal names its dialog after nzTitle, and this one has none: point it at the heading.
    afterNextRender(() => {
      this.host.nativeElement
        .closest('[role="dialog"]')
        ?.setAttribute('aria-labelledby', 'qfixdel-title');
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const impact = await this.api.deleteImpact(this.data.id);
      this.impact.set(impact);
      if (impact.confirmationRequired && impact.blockedBy.length === 0) {
        afterNextRender(() => this.confirmInput()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    } catch {
      // Fail closed: nothing is offered until the impact is known.
      this.impact.set(null);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected cancel(): void {
    if (this.busy()) return;
    this.ref.close(false);
  }

  protected async submit(): Promise<void> {
    const impact = this.impact();
    if (impact === null || !this.canDelete()) return;
    this.busy.set(true);
    try {
      await this.api.deleteQuestion(
        this.data.id,
        impact.confirmationRequired ? this.confirmCtrl.value : undefined,
      );
      this.ref.close(true);
    } catch {
      // The interceptor's toast says why; the dialog stays open on what was typed.
    } finally {
      this.busy.set(false);
    }
  }

  protected servedOnText(servedOn: FixedServedOn): string {
    return servedOnLabel(servedOn);
  }

  protected joined(items: readonly string[]): string {
    return items.join(this.isAr ? '، ' : ', ');
  }
}
