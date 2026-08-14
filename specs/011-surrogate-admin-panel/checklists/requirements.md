# Specification Quality Checklist: Income-Surrogate Rule Builder (Admin)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes

**Iteration 1 findings and fixes:**

1. *Implementation leakage* — first draft named files, components and type names (`income-resolver`, `tier-key-picker`, `incomeAssumption`). Removed from the requirements and success criteria; concrete findings are confined to the "Context: What Exists Today" table, which exists to record what was read and is written in plain terms.
2. *Untestable requirement* — "the UI must follow the soul of the admin" was unverifiable. Replaced with FR-040 to FR-048, each checkable by inspection (no new tokens, one nesting level, visible labels, five control states, validate on blur, direction-neutral spacing, keyboard operation, reduced motion).
3. *Unbounded scope* — the source design document listed eight methods across three families. Scope decision narrowed it to the income-producing family; FR-003 states the exclusion explicitly and the Assumptions section records why the stored shape still admits the others later.
4. *Ambiguous lifecycle* — the source document assumed four program states. Reconciled against the single on/off switch that exists; FR-039 states the decision so a planner does not reintroduce it.
5. *Silent-failure risk* — several scenarios could have resolved to a zero income. FR-020, FR-031, SC-008 and four edge cases now require a stated reason instead, and forbid a substituted default.

**Open risks carried into planning (not spec defects):**

- The customer-side questionnaire work (User Story 2) touches the mobile app. It is required for the feature to change any customer's result, and must not be deferred behind the admin work without accepting that Story 1 alone ships zero customer-visible change.
- Value source markers apply to numbers across the whole bank program, not only the surrogate rule. The migration posture for pre-existing programs (marked bank-stated, surfaced once for review) is stated in Assumptions and should be confirmed with the product owner before implementation.

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- All items passed on iteration 2.
