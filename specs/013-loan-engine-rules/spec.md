# Feature Specification: Loan Engine rules tab

**Feature Branch**: `013-loan-engine-rules` (work continues on `hotfixes/new-calculations`; `SPECIFY_FEATURE` set explicitly)
**Created**: 2026-10-04
**Status**: Draft
**Input**: User description: "In the question's 'What should it affect?' section I believe I should add a new tab, like Questionnaire, called Loan Engine, to add the criteria or rules that affect the engine's calculation. For a NUMBER input I should be able to add a range (e.g. 1–100), or a criterion when the input is less or more than a number, or equal to a number. The same for TEXT input. For a multiple choice, a criterion for each choice — what each choice affects. And if a dynamic question's answer would not let the applicant apply in the first place, I want a rule that sets whether the applicant is eligible to apply."

Builds on feature 012 (`specs/012-question-calculation-link/`): a question must be linked to a calculation figure before a rule can read it. Today's 012 panel only *navigates* to the table editors ("Nothing is saved here"); this feature makes the rules authorable in one place.

## Clarifications

### Session 2026-10-04

- Q: When a rule says "if the answer is X, then Y", whose rule is it? → A: **Per bank program.** Each bank states its own figure per answer range / choice. The Loan Engine tab is a question-centric editor that writes into each program's own tables (Principle II, Banks Are Data). There is no platform-wide rule that applies to every bank.
- Q: When an answer fails an eligibility rule, what happens? → A: **The program is shown as refused, with a translated reason.** It stays in the results (Principle V: programs are never hidden). This reuses the existing product-gate refusal (`PRODUCT_RULE_GATE_FAILED` + `gateReasonCode`).

## User Scenarios & Testing

### User Story 1 — Per-answer effects for one question (Priority: P1)

An operator opens **Loan Engine**, picks a question that is linked to a figure, and sees every active bank program in the question's loan types. For one program, they pick an effect (rate, loan cap, financed share, smallest loan, shortest term, longest term, extra income) and type one row per answer criterion with the bank's figure. On save, that program's quote reads the new rows.

**Acceptance Scenarios**:
1. **Given** a NUMERIC question linked to a figure, **When** the operator adds the rows "1 to 100 → 22%" and "more than 100 → 19%" to Program X's rate, **Then** a preview with answer 50 quotes 22% on Program X, answer 150 quotes 19%, and no other program changes.
2. **Given** a SINGLE_SELECT or MULTI_SELECT question, **When** the operator opens a program's effect, **Then** there is exactly one row per option, plus an "anything else" row. Each row takes a figure or is left blank.
3. **Given** a TEXT question, **When** the operator opens an effect, **Then** the only criteria offered are "answered" and "not answered".
4. **Given** an effect table that is inherited from a no-payslip product's plan, or that has more than one axis, **When** it is shown, **Then** it is read-only with a link to where it is edited.

### User Story 2 — Eligibility conditions on any program (Priority: P1)

An operator adds a **condition** to a program: "this program quotes only when the answer to Q matches …". A condition is passed if ANY of its criteria match, and each criterion may read a different question. That OR is how an exemption is written ("years in business ≥ 2 OR has a guarantor"). Every condition on a program must pass. A failed condition shows the program as refused with the reason code the operator picked.

**Acceptance Scenarios**:
1. **Given** Program X has the condition "years_in_business ≥ 2" with reason `BUSINESS_TOO_NEW`, **When** an applicant answers 1, **Then** Program X is listed as refused with that reason in preview AND apply, and the other programs are unaffected.
2. **Given** the same condition plus a second criterion "OR has_guarantor = yes", **When** an applicant answers 1 and yes, **Then** Program X quotes.
3. **Given** a condition reads question Q, **When** Q is served for a program name under which Program X is quoted, **Then** Q is REQUIRED there. This is the 012 C3 rule extended to conditions; a blank answer never silently refuses.
4. **Given** an operator tries to make a condition read a money / engine input (amount, term, income, debts, employment type, age), **Then** the save is refused (A33: no salary / age / DBR / amount gates).

### User Story 3 — Try an answer (Priority: P2)

On the Loan Engine page, the operator types a sample answer and sees, per program, the figure each effect yields or the refusal reason, before and after their unsaved edits.

### Edge Cases

- **Number boundaries:** "less than", "at most", "at least", "more than", "between A and B (inclusive)" and "equals" must each match exactly what they say at the boundary value.
- **Overlapping number rows:** the first row in the operator's order wins. The editor shows the order and warns about overlap; it does not refuse it.
- **Multi-select with several picks:** the first row in the operator's order that matches any picked option wins. Effects of several picks are NOT added together.
- **Unlinked question:** shown with a "Link it first" action (feature 012 endpoint).
- **Two operators editing the same program:** the second save gets 409 `CONFLICT_STALE_DATA`.
- **sales_manager:** read-only.

## Requirements

### Functional Requirements
- **FR-001**: The admin MUST have a top-level **Loan Engine** screen (a sidebar entry next to Questionnaire) that lists questions linked to a figure, grouped by loan type, each showing the programs that read it.
- **FR-002**: For one (question, program, effect), the operator MUST be able to read and replace that effect's rows for that question's figure. The write goes into the same column the engine already reads.
- **FR-003**: Numeric criteria MUST support: less than, at most, at least, more than, between (inclusive) and equals.
- **FR-004**: Choice criteria MUST be one row per option, plus a fallback row (`onNoMatch`: use the program default, or refuse).
- **FR-005**: Text criteria MUST be limited to answered / not answered. The text itself is never compared (Principle VI: free text may hold PII).
- **FR-006**: Any bank program, payslip or no-payslip, MUST be able to carry conditions (FR in Story 2). A failed condition yields `PRODUCT_RULE_GATE_FAILED` with the condition's `gateReasonCode`, from the existing closed `GATE_REASON_CODES` list.
- **FR-007**: A condition MUST NOT read an engine input (`questionLockReason === 'engine'`, I-Score, platform car facts).
- **FR-008**: A question that a condition reads MUST count as must-answer for every program name under which that program is quoted (`mustAnswerQuestionCodes`), and `check:question-scope` MUST guard it.
- **FR-009**: Every write MUST be audited per program (`BANK_PROGRAM_UPDATED`, a diff of the changed path), and MUST carry the program's `version` for optimistic concurrency (the existing FR-021 compare-and-swap).
- **FR-010**: Preview and apply MUST read conditions and rows through the same engine path (`quoteProgram`). Nothing is derived differently between them (A33).

### Key Entities
- **Effect row**: one criterion, plus the bank's figure for one effect of one program.
- **Condition**: one or more criteria (OR), plus a reason code, on one program. All conditions on a program must pass (AND).

## Success Criteria
- **SC-001**: An operator can state "1–100 → X%, above 100 → Y%" for one program without leaving the Loan Engine screen.
- **SC-002**: Before/after quotes for every active program are byte-identical for every program the operator did not edit (`quote-preview-apply-parity.ts`).
- **SC-003**: Preview and apply agree on every condition outcome for each sample applicant (parity script: 0 differences).
- **SC-004**: `seed:blueprints` and `seed:sheet-figures` report 0 written / 0 refused after the migration.

## Out of Scope
- A platform-wide rule shared by every bank (decision: rules are per program).
- Hiding refused programs, or blocking the applicant before matching (decision: show as refused).
- Matching on free-text content.
- Adding together the effects of several picks on one multi-select.
- Authoring the STRUCTURE of a no-payslip product's income rule (it stays seed-owned; only its figures are editable, as today).
