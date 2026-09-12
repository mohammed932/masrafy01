import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { validateFactGrid } from '../../src/bank-programs/validation/fact-grid.validator';
import { resolveFactGrid } from '../../src/matching/pipeline/fact-grid';
import type { SurrogateFactBinding } from '../../src/matching/pipeline/surrogate-fact-registry';

const registry: SurrogateFactBinding[] = [
  { key: 'car_origin', questionCode: 'car_origin', type: 'SINGLE_SELECT' },
  { key: 'car_model_year', questionCode: 'car_model_year', type: 'NUMERIC' },
];

describe('probe', () => {
  it('(a) typo key on a choice axis', () => {
    const config = {
      axes: [{ factKey: 'car_origin' }],
      cells: [{ keys: [{ key: 'germny' }], value: '22.5' }],
      onNoMatch: 'useFallback' as const,
    };
    const v = validateFactGrid({ config, fieldPath: 'pricing.rateByFact', valueKind: 'ratePercent', registry });
    console.log('(a) violation =', v);
    const r = resolveFactGrid({ config, facts: { car_origin: { kind: 'choice', optionCode: 'germany' } } });
    console.log('(a) resolution =', JSON.stringify(r));
  });

  it('(b) band key on a CHOICE axis', () => {
    const config = {
      axes: [{ factKey: 'car_origin' }],
      cells: [{ keys: [{ fromInclusive: '2015' }], value: '22.5' }],
      onNoMatch: 'useFallback' as const,
    };
    const v = validateFactGrid({ config, fieldPath: 'pricing.rateByFact', valueKind: 'ratePercent', registry });
    console.log('(b) violation =', v);
    const r = resolveFactGrid({ config, facts: { car_origin: { kind: 'choice', optionCode: 'germany' } } });
    console.log('(b) resolution =', JSON.stringify(r));
  });

  it('(c) key on a NUMERIC axis', () => {
    const config = {
      axes: [{ factKey: 'car_model_year' }],
      cells: [{ keys: [{ key: '2015' }], value: '22.5' }],
      onNoMatch: 'useFallback' as const,
    };
    const v = validateFactGrid({ config, fieldPath: 'pricing.rateByFact', valueKind: 'ratePercent', registry });
    console.log('(c) violation =', v);
    const r = resolveFactGrid({ config, facts: { car_model_year: { kind: 'numeric', value: new Decimal(2015) } } });
    console.log('(c) resolution =', JSON.stringify(r));
  });
});
