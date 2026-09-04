import { chromium } from 'playwright';
const ADMIN='http://localhost:5173';
const b=await chromium.launch();
for(const theme of ['light','dark']){
  const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme:theme});
  const p=await ctx.newPage();
  await p.goto(`${ADMIN}/auth/login`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const e=p.locator('input[type="email"]').first();
  if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(2500);}
  await p.goto(`${ADMIN}/program-catalog?basis=payslip`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2200);
  const t=await p.evaluate(()=>{
    const cs=getComputedStyle(document.documentElement);
    const names=['--color-brand-primary','--color-income-surrogate','--color-surface-default','--color-border-default','--color-text-tertiary'];
    const out={}; names.forEach(n=>out[n]=cs.getPropertyValue(n).trim());
    // does the rule even exist / what does it compute standalone?
    const d=document.createElement('div');
    d.style.borderInlineStart='3px solid color-mix(in srgb, var(--color-brand-primary) 70%, var(--color-surface-default))';
    document.body.appendChild(d);
    const mix=getComputedStyle(d).borderInlineStartColor; d.remove();
    const card=document.querySelector('li.card.is-name');
    const rules=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return[]}})
      .filter(r=>r.cssText&&/is-name|\.go /.test(r.cssText)).map(r=>r.cssText.slice(0,220));
    return {theme:document.documentElement.getAttribute('data-theme'), tokens:out, mixStandalone:mix,
      cardEdge:card?getComputedStyle(card).borderInlineStartColor:null, rules};
  });
  console.log(theme, JSON.stringify(t,null,1).slice(0,1600));
  await ctx.close();
}
await b.close();
