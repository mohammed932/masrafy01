import { chromium } from 'playwright';
const ADMIN='http://localhost:5173';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000}});
const p=await ctx.newPage();
const hits=[];
p.on('response',async r=>{ if(/\.js(\?|$)/.test(r.url())){ try{const t=await r.text(); if(t.includes('Search program names')) hits.push([r.url(), t.includes('is-name'), t.includes('card is-product')]);}catch{} } });
p.on('pageerror',e=>console.log('PAGEERROR',String(e).slice(0,200)));
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,200)); });
await p.goto(`${ADMIN}/auth/login`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const e=p.locator('input[type="email"]').first();
if(await e.count()){await e.fill('ops@masrafy.local');await p.locator('input[type="password"]').first().fill(process.env.SEED_ADMIN_PASSWORD);await p.locator('button[type="submit"]').first().click();await p.waitForTimeout(3000);}
await p.goto(`${ADMIN}/program-catalog?basis=payslip`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
console.log('chunks carrying page:', hits);
await b.close();
