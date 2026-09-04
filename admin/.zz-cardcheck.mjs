import { chromium } from 'playwright';
const ADMIN='http://localhost:5173';
const b=await chromium.launch();
for(const theme of ['light','dark']){
 for(const rtl of [false,true]){
  const ctx=await b.newContext({viewport:{width:1440,height:1000},colorScheme:theme});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(`${ADMIN}/auth/login`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(1200);
  const e=p.locator('input[type="email"]').first();
  if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(2500);}
  for(const [name,path] of [['payslip','/program-catalog?basis=payslip'],['surrogate','/program-catalog?basis=no_payslip']]){
    await p.goto(`${ADMIN}${path}`,{waitUntil:'domcontentloaded'});
    if(rtl) await p.evaluate(()=>document.documentElement.setAttribute('dir','rtl'));
    await p.waitForTimeout(2200);
    const m=await p.evaluate(()=>{
      const cards=[...document.querySelectorAll('li.card')];
      const info=cards.map(c=>{const s=getComputedStyle(c);const go=c.querySelector('.go');
        return {cls:c.className, edgeStart:s.borderInlineStartColor, edgeW:s.borderInlineStartWidth,
          goT:go?getComputedStyle(go).transform:null};});
      return {overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth), info};
    });
    const kinds={};
    for(const i of m.info){const k=i.cls.replace(/\s+/g,' ')+' | '+i.edgeStart+' '+i.edgeW+' | go='+i.goT; kinds[k]=(kinds[k]||0)+1;}
    console.log(`${theme}/${rtl?'rtl':'ltr'} ${name}: overflow=${m.overflow} errors=${errs.length}`);
    for(const [k,v] of Object.entries(kinds)) console.log(`   x${v} ${k}`);
    errs.forEach(x=>console.log('   ! '+x));
  }
  await ctx.close();
 }
}
await b.close();
