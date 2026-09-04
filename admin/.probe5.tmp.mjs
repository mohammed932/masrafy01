import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000}});
const p=await ctx.newPage();
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const e=p.locator('input[type="email"]').first();
if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(2500);}
await p.goto('http://localhost:5173/program-catalog?basis=no_payslip',{waitUntil:'domcontentloaded'});
await p.waitForSelector('li.card .go',{timeout:15000});
await p.evaluate(()=>document.documentElement.setAttribute('dir','rtl'));
await p.waitForTimeout(800);
const out=await p.evaluate(()=>{
  const go=document.querySelector('li.card .go');
  const rules=[];
  for(const sh of document.styleSheets){let rs;try{rs=[...sh.cssRules]}catch{continue}
    for(const r of rs){ if(r.selectorText&&/\.go/.test(r.selectorText)) rules.push({sel:r.selectorText, css:r.style.cssText.slice(0,120), matches:(()=>{try{return go.matches(r.selectorText)}catch(e){return 'ERR '+e.message}})()}); }}
  return {dir:document.documentElement.dir, transform:getComputedStyle(go).transform, rules};
});
console.log(JSON.stringify(out,null,1).slice(0,1800));
await b.close();
