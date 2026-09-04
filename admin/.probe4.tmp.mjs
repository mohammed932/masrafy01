import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const p=await ctx.newPage();
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const e=p.locator('input[type="email"]').first();
if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(2500);}
await p.goto('http://localhost:5173/program-catalog?basis=payslip',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2200);
const out=await p.evaluate(()=>{
  const card=document.querySelector('li.card.is-name');
  const hits=[];
  for(const sh of document.styleSheets){
    let rules; try{rules=[...sh.cssRules]}catch{continue}
    const walk=(rs,ctx='')=>{for(const r of rs){
      if(r.cssRules&&!r.selectorText){walk([...r.cssRules],(r.conditionText||r.media?.mediaText||'')); continue;}
      if(!r.selectorText) continue;
      try{ if(card.matches(r.selectorText) && /border/.test(r.style.cssText)) hits.push({sel:r.selectorText,ctx,css:r.style.cssText.slice(0,200)});}catch{}
    }};
    walk(rules);
  }
  return {hits, inline:card.getAttribute('style'), theme:document.documentElement.getAttribute('data-theme')};
});
console.log(JSON.stringify(out,null,1).slice(0,2500));
await b.close();
