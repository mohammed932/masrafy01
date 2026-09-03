import { chromium } from 'playwright';

const EMAIL = 'ops@masrafy.local';
const PASS = 'J7u9TtFO3ID=';
const errors = [];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
if (p.url().includes('login')) {
  await p.fill('#email', EMAIL);
  await p.fill('#password', PASS);
  await p.click('form button[type="submit"]');
  await p.waitForTimeout(2500);
}
console.log('after login:', p.url());

async function shot(url, name, dark = false, rtl = false) {
  await p.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await p.goto(url, { waitUntil: 'networkidle' });
  if (dark) await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  if (rtl) await p.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  await p.waitForTimeout(700);
  const overflow = await p.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  const tabs = await p.$$eval('[role="tab"]', (ts) =>
    ts.map((t) => ({
      text: t.innerText.replace(/\n/g, ' | '),
      selected: t.getAttribute('aria-selected'),
      controls: t.getAttribute('aria-controls'),
      id: t.id,
      tabindex: t.getAttribute('tabindex'),
    })));
  const panels = await p.$$eval('[role="tabpanel"]', (ps) =>
    ps.map((x) => ({ id: x.id, labelledby: x.getAttribute('aria-labelledby') })));
  console.log(name, JSON.stringify({ overflow, tabs, panels }));
  await p.screenshot({ path: `/tmp/pc-${name}.png`, fullPage: false });
}

await shot('http://localhost:5173/program-catalog', 'default-light');
await shot('http://localhost:5173/program-catalog?basis=no_payslip', 'surrogate-light');
await shot('http://localhost:5173/program-catalog', 'default-dark', true);
await shot('http://localhost:5173/program-catalog?basis=no_payslip', 'surrogate-rtl', false, true);

// click through + URL mirror
await p.emulateMedia({ colorScheme: 'light' });
await p.goto('http://localhost:5173/program-catalog', { waitUntil: 'networkidle' });
await p.click('#basis-tab-no_payslip');
await p.waitForTimeout(400);
console.log('after click url:', p.url());
await p.keyboard.press('ArrowLeft');
await p.waitForTimeout(400);
console.log('after ArrowLeft url:', p.url(), 'focus:', await p.evaluate(() => document.activeElement?.id));

console.log('ERRORS', JSON.stringify(errors, null, 1));
await b.close();
