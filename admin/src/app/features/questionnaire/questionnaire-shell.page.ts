import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabShellComponent, type TabShellTab } from '@shared/ui';

/**
 * Tab shell over the GLOBAL question pool. Three jobs, one pool:
 *
 * - **Questions** — author the pool: wording, answer type, options, order.
 * - **Loan categories** — decide which categories ask each question. A question
 *   may serve several, so this is an assignment view, not a per-category
 *   questionnaire: there is still ONE pool and ONE published version
 *   (Principle V / A33).
 * - **Fixed questions** (route `engine-rules`) — the owner's fixed, mandatory
 *   questions in the owner's order, split by who asks them (Income proof /
 *   Surrogate), and what each answer means; only answers' wording is edited
 *   there (v30.12.0, narrowed v30.13.0, split v30.16.0).
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
    { link: 'categories', label: $localize`:@@qtabs.categories:Loan categories` },
    { link: 'engine-rules', label: $localize`:@@qtabs.engine_rules:Fixed questions` },
  ];
}
