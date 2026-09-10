import { productBlueprint } from './src/bank-programs/blueprints/product-blueprints';
import { compileTemplate, templateParamKeys } from './src/matching/pipeline/product-template';
const bp: any = productBlueprint('compound_owner');
const nu = JSON.parse(JSON.stringify(bp.template));
console.log('NEW', JSON.stringify(templateParamKeys(nu).sort()));
// reconstruct OLD: strip per-way columns, add product secondColumn
const old = JSON.parse(JSON.stringify(nu));
delete old.primary.column;
for (const a of old.alternatives) delete a.column;
old.secondColumn = { fact: 'loan_is_topup', branches: ['new_loan', 'top_up'] };
console.log('OLD', JSON.stringify(templateParamKeys(old).sort()));
const nk = new Set(templateParamKeys(nu));
console.log('DROPPED', templateParamKeys(old).filter((k:string)=>!nk.has(k)));
