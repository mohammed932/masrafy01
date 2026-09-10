import { productBlueprint } from './src/bank-programs/blueprints/product-blueprints';
import { templateParamKeys, type ProductTemplate } from './src/matching/pipeline/product-template';

const nw = productBlueprint('compound_owner')!.template as ProductTemplate;
// reconstruct the OLD shape: product-level secondColumn, no per-way columns
const old = JSON.parse(JSON.stringify(nw)) as any;
delete old.primary.column;
for (const a of old.alternatives) delete a.column;
old.secondColumn = { fact: 'loan_is_topup', branches: ['new_loan', 'top_up'] };
// old conditions: without the two new ones
old.conditions = old.conditions.filter((c: any) => !['businessoldenough','selfemployedpapers'].includes(c.id));

const o = new Set(templateParamKeys(old));
const n = new Set(templateParamKeys(nw));
console.log('RETIRED (in old, not new):', [...o].filter(k => !n.has(k)).sort());
console.log('NEW     (in new, not old):', [...n].filter(k => !o.has(k)).sort());
