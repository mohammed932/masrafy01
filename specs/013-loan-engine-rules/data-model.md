# Data model — 013 Loan Engine rules

There is one schema change: the new `bank_program.conditions` column. Everything else is a backwards-compatible widening of a JSON shape the engine already reads.

## 1. `FactGridKey` (widened, JSON only — `matching/pipeline/fact-grid.ts`)

```ts
export type FactGridKey =
  | { key: string }                       // option code, or 'answered' for TEXT
  | {
      fromInclusive?: string;  fromExclusive?: string;   // at most ONE per edge
      toExclusive?: string | null;  toInclusive?: string; // at most ONE per edge
    }
  | null;                                 // explicit wildcard (unchanged)
```

- All values are Decimal strings (Principle I).
- `keyMatchesAnswer` evaluates `from ≤ / < value` and `value < / ≤ to` per the edge given.
- **Validation** (`validateFactGrid` plus the condition validator):
  - Two keys on one edge → `LOAN_ENGINE_RULE_INVALID {problem: 'both_edges'}`.
  - No edge at all → `empty_band`. Stored rows keep today's "matches nothing" reading; a *write* refuses it.
  - `from > to`, or `from = to` unless both edges are inclusive → `empty_band`.
- **Readers that share the predicate** (all must accept the new edges):
  - `fact-grid.ts`;
  - `max-loan-by-fact.ts`;
  - the 012 shape collector `product-needed-facts.ts`, where a band is a `number` read;
  - the condition evaluator.
- **Existing rows:** none carries `fromExclusive` or `toInclusive`, so every stored cell matches exactly as before. The proof is the before/after capture in quickstart §2.

## 2. `bank_program.conditions` (NEW column)

Prisma:

```prisma
/// Feature 013 — program-level eligibility conditions. NULL or [] = none.
/// Evaluated in quoteProgram; a failure is a stated refusal (PRODUCT_RULE_GATE_FAILED +
/// gateReasonCode), never a hidden program (Principle V).
conditions          Json?
```

Migration: `YYYYMMDDHHMMSS_bank_program_conditions`. It only adds the column (nullable, no default backfill), and moves no money.

JSON shape:

```ts
interface ProgramCondition {
  id: string;                 // stable slug, unique within the program; gateId = `condition:${id}`
  anyOf: ConditionCriterion[];// ≥1; passes if ANY matches
  reasonCode: GateReasonCode; // closed list GATE_REASON_CODES (product-rule.ts:285)
}
interface ConditionCriterion {
  factKey: string;            // a surrogate_fact bound to an active question
  key: Exclude<FactGridKey, null>; // no wildcard: a criterion that always passes is a no-op
}
type ProgramConditions = ProgramCondition[];   // ALL must pass
```

**Rules:**
- `factKey` must be an active `surrogate_fact`:
  - bound to a question (it must not be `isReservedFactKey`);
  - and its question must not be an engine input (`questionLockReason === 'engine'`).
  
  If it fails either check → `engine_input`.
- Key kind must fit the question type:

  | Question type | Allowed key |
  |---|---|
  | NUMERIC | band |
  | SINGLE / MULTI select | `{key}` ∈ option codes |
  | TEXT | `{key: 'answered'}` |

  Anything else → `shape` / `unknown_option`.
- An unanswered criterion does not match. A condition whose criteria are all unanswered fails.
- Evaluation order is the stored order; the first failing condition is reported.

**Readers that must learn the column** (A25, all in one change):
- `FactReaderProgramRow.conditions`: REQUIRED, as for `pricing` / `tenor` / `fees`, so every SELECT names it.
- `factSurfacesOfProgram`: new surface `'condition'`, `refusesWhenUnanswered: true` → flows into `factsRefusingWhenUnanswered` → `mustAnswerQuestionCodes` (FR-008) and the 012 "Used by" panel. The delete guard (`factReaders`) must count it too, or deleting a fact would silently disable a condition.
- `quoteProgram` (`quote.ts`) evaluates it before the income / amount steps. It runs in BOTH preview and apply through the same call (FR-010).
- `check:question-scope`: a fact read by a condition is never optional where the program is quoted (extends `OPTIONAL_REFUSAL`).
- The 012 question-usage class: a condition read makes the question `calculation`, with `blankRefuses` populated.

## 3. Effect write (no new storage)

| `effect` id | Path written | Allowed question types |
|---|---|---|
| `rate` | `pricing.rateByFact` | all (TEXT: answered only) |
| `cap` | `loanLimits.maxLoanByFact` | all |
| `financed_share` | `loanLimits.ltvCeilingByFact` | all |
| `min_amount` | `loanLimits.minAmountByFact` | all |
| `min_term` | `tenor.minMonthsByFact` | all |
| `max_term` | `tenor.maxMonthsByFact` | all |
| `extra_income` | `incomeAssumption.additionalIncome.sources[factKey]` | NUMERIC only |

**Write semantics:**
- The write replaces only the rows for THIS question's fact in a single-axis grid. If the column holds a grid on a different fact, the write is refused (`read_only_surface`): a column holds one grid, and changing which fact it reads is a program-form decision.
- An empty row list deletes the grid, so the program falls back to its scalar setting.

## 4. Read model (API DTOs, not storage)

- `LoanEngineQuestionSummary`: `{questionCode, type, labelAr, labelEn, categories, factKey|null, class, programCount}`.
- `LoanEngineQuestionDetail`: the question, plus `options[]`, plus `programs[]`. Each program is `{programCode, bankName, category, version, effects: Record<effect, EffectState>, conditions: ProgramCondition[] (only those reading this fact)}`.
- `EffectState`: `{editable: boolean, readOnlyReason?: 'multi_axis'|'other_fact'|'inherited_plan'|'two_axis_cap', rows: EffectRow[], onNoMatch}`.
- `EffectRow`: `{criterion: Criterion, value: string}`.
- `Criterion` is the admin-side mirror of the operator vocabulary: `{op: 'lt'|'lte'|'gte'|'gt'|'between'|'eq', a, b?}`, or `{option: code}`, or `{answered: true}`. The server converts it to and from `FactGridKey` (R1 table), so the client never builds storage shapes.
