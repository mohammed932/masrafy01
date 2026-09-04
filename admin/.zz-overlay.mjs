import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await (await b.newContext()).newPage();
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
const t=await p.evaluate(()=>{const o=document.querySelector('vite-error-overlay');if(!o)return 'NO OVERLAY';const r=o.shadowRoot;return (r?r.textContent:o.textContent).replace(/\s+/g,' ').slice(0,900);});
console.log(t); await b.close();
