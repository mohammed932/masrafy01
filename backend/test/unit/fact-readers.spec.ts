/**
 * WHAT READS A FACT — one answer, over every surface a fact key can live in.
 *
 * Three of the four were uncounted until this module existed. `countReferences` matched
 * `incomeAssumption.strategy === 'fact:<key>'` and nothing else — but every one of the
 * eleven predefined products compiles to a PIPELINE, whose strategy is the constant
 * `'steps'`, so for every product the platform actually sells the count was zero and the
 * delete guard was decoration. Each `it` below is one surface, and the three marked as such
 * are the ones that returned nothing before.
 */
import { describe, expect, it } from 'vitest';
import {
  factReaders,
  factsReadByIncomeRule,
  factsReadByLoanLimits,
  factsReadByProgram,
} from '@/matching/pipeline/fact-readers';

describe('factsReadByIncomeRule', () => {
  it('reads the single-fact strategy token', () => {
    expect([...factsReadByIncomeRule({ strategy: 'fact:military_grade' })]).toEqual([
      'military_grade',
    ]);
  });

  it("reads a built-in method's own fact", () => {
    // A frozen method names its fact through the spec table, not through the token, and live
    // offers still carry those tokens.
    expect([...factsReadByIncomeRule({ strategy: 'byMilitaryGrade' })]).toEqual(['military_grade']);
  });

  it('reads a PIPELINE step — the surface every predefined product uses', () => {
    const rule = {
      strategy: 'steps',
      steps: [
        { id: 'src', op: 'factChoiceTable', fact: 'compound_name' },
        { id: 'primary', op: 'percentOf', of: [{ step: 'src' }, { const: '70' }] },
      ],
    };
    expect([...factsReadByIncomeRule(rule)]).toEqual(['compound_name']);
  });

  it('reads a fact a GATE alone names', () => {
    // A fact reachable only through a gate would otherwise slip every check.
    const rule = {
      strategy: 'steps',
      steps: [],
      gates: [{ id: 'dp', kind: 'choice', fact: 'unit_joint_ownership', expect: ['no'] }],
    };
    expect([...factsReadByIncomeRule(rule)]).toEqual(['unit_joint_ownership']);
  });

  it('reads a weighted additional-income source', () => {
    const rule = {
      strategy: 'steps',
      steps: [],
      additionalIncome: {
        sources: [{ factKey: 'rental_income_monthly', countPercent: '50' }],
      },
    };
    expect([...factsReadByIncomeRule(rule)]).toContain('rental_income_monthly');
  });

  it('counts an unreadable blob as NO reader rather than throwing', () => {
    // These are `Json` columns: anything could be in one, and a list read that throws is a
    // screen that cannot render at all.
    for (const junk of [null, undefined, 'a string', 42, [], { strategy: 'steps', steps: 7 }]) {
      expect([...factsReadByIncomeRule(junk)]).toEqual([]);
    }
  });
});

describe('factsReadByLoanLimits', () => {
  it("reads a cap table's row axis", () => {
    expect([
      ...factsReadByLoanLimits({
        maxLoanByFact: { factKey: 'school_type', rows: [], onNoMatch: 'reject' },
      }),
    ]).toEqual(['school_type']);
  });

  it("reads a cap table's COLUMN axis — the entire reader set of a cap-only product", () => {
    const keys = factsReadByLoanLimits({
      maxLoanByFact: {
        factKey: 'school_stage',
        columnFactKey: 'school_type',
        rows: [],
        onNoMatch: 'reject',
      },
    });
    expect([...keys].sort()).toEqual(['school_stage', 'school_type']);
  });

  it('reads a cap adjustment', () => {
    expect([
      ...factsReadByLoanLimits({
        maxLoanAdjustments: [
          { kind: 'sharePercent', percent: '50', whenFactKey: 'unit_joint_ownership', whenOptionCode: 'yes' },
        ],
      }),
    ]).toEqual(['unit_joint_ownership']);
  });

  it('ignores a blank axis rather than counting an empty key', () => {
    expect([
      ...factsReadByLoanLimits({ maxLoanByFact: { factKey: '', columnFactKey: '' } }),
    ]).toEqual([]);
  });
});

describe('factsReadByProgram', () => {
  it('unions the income rule and the cap side', () => {
    const keys = factsReadByProgram({
      incomeAssumption: { strategy: 'fact:military_grade' },
      loanLimits: { maxLoanByFact: { factKey: 'club_branch', rows: [], onNoMatch: 'reject' } },
    });
    expect([...keys].sort()).toEqual(['club_branch', 'military_grade']);
  });
});

describe('factReaders', () => {
  const rows = {
    programs: [
      {
        programCode: 'PIPE-1',
        incomeAssumption: {
          strategy: 'steps',
          steps: [{ id: 'src', op: 'factNumber', fact: 'unit_paid_to_date' }],
        },
        loanLimits: null,
      },
      {
        programCode: 'CAP-1',
        incomeAssumption: null,
        loanLimits: {
          maxLoanByFact: { factKey: 'x', columnFactKey: 'unit_paid_to_date', rows: [] },
        },
      },
    ],
    rules: [
      {
        type: 'surrogate_product',
        key: 'compound_owner',
        incomeRule: { strategy: 'steps', steps: [{ id: 's', op: 'factNumber', fact: 'unit_paid_to_date' }] },
      },
      {
        type: 'program_name',
        key: 'doctor',
        incomeRule: { strategy: 'fact:unit_paid_to_date' },
      },
    ],
  };

  it('names every reader, and which surface each one is', () => {
    // A LIST, not a count: "in use by 4" sends the operator hunting, and the two program
    // surfaces are edited on two different steps of the program's own form.
    expect(factReaders('unit_paid_to_date', rows)).toEqual([
      { source: 'bank_program', ref: 'PIPE-1' },
      { source: 'bank_program_cap', ref: 'CAP-1' },
      { source: 'surrogate_product', ref: 'compound_owner' },
      { source: 'program_name', ref: 'doctor' },
    ]);
  });

  it('reports both surfaces of one program separately', () => {
    const both = factReaders('k', {
      programs: [
        {
          programCode: 'P',
          incomeAssumption: { strategy: 'fact:k' },
          loanLimits: { maxLoanByFact: { factKey: 'k' } },
        },
      ],
      rules: [],
    });
    expect(both).toEqual([
      { source: 'bank_program', ref: 'P' },
      { source: 'bank_program_cap', ref: 'P' },
    ]);
  });

  it('finds nothing for a fact nobody reads', () => {
    expect(factReaders('nobody_reads_this', rows)).toEqual([]);
  });
});
