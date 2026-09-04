import { chromium } from 'playwright';
const OUT=process.argv[2];
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000}});
const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const e=p.locator('input[type="email"]').first();
if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(3000);}
await p.goto('http://localhost:5173/program-catalog?basis=payslip',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
console.log('url',p.url(),'cards',await p.locator('li.card').count(),'errors',errs);
await p.screenshot({path:`${OUT}/state.png`});
await b.close();
