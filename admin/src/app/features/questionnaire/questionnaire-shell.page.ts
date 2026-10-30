import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabShellComponent, type TabShellTab } from '@shared/ui';

/**
 * Tab shell over the GLOBAL question pool. Two jobs, one pool:
 *
 * - **Questions** — author the pool: wording, answer type, options, order. ONE library of
 *   every question (v32.1.0; the Income proof / Surrogate tabs of v31.8.0 are gone). A question
 *   made fixed says there which programs ask it: income-proof, surrogate, or both.
 * - **Fixed questions** (route `engine-rules`) — the owner's fixed, mandatory
 *   questions in the owner's order, split by who asks them (Income proof /
 *   Surrogate), and what each answer means; only answers' wording is edited
 *   there (v30.12.0, narrowed v30.13.0, split v30.16.0).
 *
 * Which questions a program asks — and in what order — is set on the program's own page in the
 * Program catalog (v32.0.0); a question carries no loan type.
 *
 * The tabs ARE routes (see QUESTIONNAIRE_ROUTES) — the mechanics live in the
 * shared `app-tab-shell`, which this was extracted into when the program
 * catalog grew the same two-tab shape.
 */
@Component({
  standalone: true,
  selector: 'mf-questionnaire-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TabShellComponent],
  template: `<app-tab-shell [tabs]="tabs" [ariaLabel]="tabsAria" />`,
})
export class QuestionnaireShellPage {
  protected readonly tabsAria = $localize`:@@qtabs.aria:Questionnaire sections`;
  protected readonly tabs: readonly TabShellTab[] = [
    { link: 'questions', label: $localize`:@@qtabs.pool:Questions` },
    { link: 'engine-rules', label: $localize`:@@qtabs.engine_rules:Fixed questions` },
  ];
}
