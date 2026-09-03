import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
if (p.url().includes('login')) {
  await p.fill('#email', 'ops@masrafy.local');
  await p.fill('#password', 'J7u9TtFO3ID=');
  await p.click('form button[type="submit"]');
  await p.waitForTimeout(2500);
}
const probe = async (dark) => {
  await p.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await p.goto('http://localhost:5173/program-catalog', { waitUntil: 'networkidle' });
  if (dark) await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await p.waitForTimeout(600);
  return p.evaluate(() => {
    const px = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0,0,1,1);
      const d = x.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255]; };
    const over = (fg, bg) => fg[3] >= 1 ? fg : [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat([1]);
    const lum = (c) => { const f = c.slice(0,3).map(v => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; });
      return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; };
    const ratio = (a,b2) => { const [x,y]=[lum(a),lum(b2)].sort((m,n)=>n-m); return +((x+0.05)/(y+0.05)).toFixed(2); };
    const groundOf = (el) => { let n = el; while (n) { const bgc = px(getComputedStyle(n).backgroundColor);
        if (bgc[3] > 0) { const parent = n.parentElement ? groundOf(n.parentElement) : [255,255,255,1];
          return over(bgc, parent); } n = n.parentElement; } return [255,255,255,1]; };
    const out = [];
    for (const t of document.querySelectorAll('[role="tab"]')) {
      const on = t.getAttribute('aria-selected') === 'true';
      const ground = groundOf(t);
      for (const sel of ['.tab-label', '.tab-note', '.tab-count']) {
        const e = t.querySelector(sel); if (!e) continue;
        const cs = getComputedStyle(e);
        const g = sel === '.tab-count' ? over(px(cs.backgroundColor), ground) : ground;
        out.push({ tab: on ? 'on' : 'off', sel, size: cs.fontSize, weight: cs.fontWeight, ratio: ratio(px(cs.color), g) });
      }
      const cs = getComputedStyle(t);
      out.push({ tab: on ? 'on' : 'off', sel: 'border', ratio: ratio(px(cs.borderTopColor), ground), bg: cs.backgroundColor, border: cs.borderTopColor });
    }
    return out;
  });
};
console.log('LIGHT'); console.table(await probe(false));
console.log('DARK'); console.table(await probe(true));
await b.close();
