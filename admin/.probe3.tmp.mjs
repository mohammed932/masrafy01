import { chromium } from 'playwright';
const b=await chromium.launch();
const p=await (await b.newContext()).newPage();
await p.goto('http://localhost:5173/auth/login',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
const t=await p.evaluate(()=>{const o=document.querySelector('vite-error-overlay');return o?(o.shadowRoot?o.shadowRoot.textContent:o.textContent).slice(0,1500):'NO OVERLAY';});
console.log(t);
await b.close();
