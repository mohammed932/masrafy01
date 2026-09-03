import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
const r = await p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const g = (n) => cs.getPropertyValue(n).trim();
  return { ink: g('--color-text-primary'), lineStrong: g('--border-default'), brand: g('--color-brand-primary'), sur: g('--color-income-surrogate') };
});
console.log(r);
await b.close();
