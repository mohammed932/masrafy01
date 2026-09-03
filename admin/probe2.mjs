import { chromium } from 'playwright';
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1440,height:900}}); const p = await ctx.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
if (p.url().includes('login')) { await p.fill('#email','ops@masrafy.local'); await p.fill('#password','J7u9TtFO3ID='); await p.click('form button[type="submit"]'); await p.waitForTimeout(2500);}
await p.goto('http://localhost:5173/program-catalog', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
console.log(await p.evaluate(() => {
  const rail = document.querySelector('[role="tablist"]');
  const on = document.querySelector('[role="tab"][aria-selected="true"]');
  const rules = [];
  for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) {
    if (r.cssText && r.cssText.includes('.rail.segmented') && r.cssText.includes('.on')) rules.push(r.cssText.slice(0,200)); } } catch {} }
  return { display: getComputedStyle(rail).display, accentVar: getComputedStyle(on).getPropertyValue('--rail-item-accent'), rules };
}));
await b.close();
