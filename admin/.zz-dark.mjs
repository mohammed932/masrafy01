import { chromium } from 'playwright';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1100},colorScheme:'dark'});
const p=await ctx.newPage();
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const e=p.locator('input[type="email"]').first();
if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(3500);}
for(const [name,path] of [['dark-payslip','/program-catalog?basis=payslip'],['dark-surrogate','/program-catalog?basis=no_payslip']]){
  await p.goto(`http://localhost:5173${path}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  const m=await p.evaluate(()=>{
    const cs=[...document.querySelectorAll('li.card')];
    const seen={};
    for(const c of cs){const s=getComputedStyle(c);const k=c.className.replace(/ng-star-inserted/,'').trim()+' | '+s.borderInlineStartColor+' / '+s.borderInlineStartWidth+' | top='+s.borderBlockStartColor;seen[k]=(seen[k]||0)+1;}
    return {n:cs.length,seen,overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)};
  });
  console.log(name,'cards='+m.n,'overflow='+m.overflow);
  for(const [k,v] of Object.entries(m.seen)) console.log('   x'+v+' '+k);
  await p.screenshot({path:`${process.argv[2]}/${name}.png`});
}
await b.close();
