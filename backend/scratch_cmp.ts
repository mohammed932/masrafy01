import { productBlueprint, productBlueprints } from './src/bank-programs/blueprints/product-blueprints';
import { compileTemplate, validateTemplate, waysOf } from './src/matching/pipeline/product-template';
import { waysOfRule } from './src/matching/pipeline/product-rule-ways';
import * as fs from 'fs';

const bp = productBlueprint('compound_owner')!;
console.log('validate:', JSON.stringify(validateTemplate(bp.template as any)));
const compiled = compileTemplate(bp.template as any);
const sql = fs.readFileSync('prisma/migrations/20260909120100_compound_column_is_other_product/migration.sql','utf8');
const m = sql.match(/"incomeRule" = '(\{.*\})'::jsonb \|\|/s)!;
const pasted = JSON.parse(m[1].replace(/''/g, "'"));
const a = JSON.stringify(compiled), b = JSON.stringify(pasted);
console.log('incomeRule identical:', a === b);
if (a !== b) { console.log('COMPILED:', a); console.log('PASTED  :', b); }
const ts = sql.match(/"templateSpec" = '(\{.*?\})'::jsonb,/s)!;
const spec = JSON.parse(ts[1].replace(/''/g,"'"));
console.log('templateSpec == blueprint template:', JSON.stringify(spec) === JSON.stringify(bp.template) ? 'exact' : 'differs');
console.log('spec compiles identically:', JSON.stringify(compileTemplate(spec)) === a);
console.log('ways:', JSON.stringify(waysOfRule(compiled).map(w=>({id:w.id,slots:w.slots}))));

// every blueprint validates + compiles
for (const b2 of productBlueprints()) {
  const v = validateTemplate(b2.template as any);
  if (v) console.log('INVALID', b2.key, JSON.stringify(v));
}
