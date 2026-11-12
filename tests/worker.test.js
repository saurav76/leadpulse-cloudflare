import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../src/index.js';
const env={PREVIEW_ONLY:'true',ENABLE_SIGNUPS:'false',ENABLE_MONITORING:'false',BILLING_ENABLED:'false',
 DB:{prepare:(sql)=>({first:async()=>({1:1})})},ASSETS:{fetch:async()=>new Response('body',{status:200})}};
async function fetchPath(path,method='GET') {return worker.fetch(new Request('https://leadpulse.example'+path,{method}),env,{waitUntil:()=>{}})}
test('public landing page renders preview',async()=>{const r=await fetchPath('/');assert.equal(r.status,200);const body=await r.text();assert.match(body,/Stop losing leads/);assert.match(body,/Free trial launching soon/)});
test('pricing is public but checkout disabled',async()=>{const r=await fetchPath('/pricing');assert.equal(r.status,200);const b=await r.text();assert.match(b,/Checkout activation pending/);assert.doesNotMatch(b,/PAYPAL_CLIENT_SECRET/)});
test('signup is closed in preview',async()=>assert.equal((await fetchPath('/signup')).status,404));
test('dashboard is closed in preview',async()=>assert.equal((await fetchPath('/dashboard')).status,404));
test('billing is closed in preview',async()=>assert.equal((await fetchPath('/billing')).status,404));
test('preview health checks bound database',async()=>{const r=await fetchPath('/health');assert.equal(r.status,200);const d=await r.json();assert.equal(d.preview,true);assert.equal(d.checkout_enabled,false);});
test('static asset served by assets binding',async()=>assert.equal((await fetchPath('/styles.css')).status,200));

test('admin analytics stays closed without password secret',async()=>{assert.equal((await fetchPath('/admin')).status,404);});

test('password recovery routes remain closed in preview',async()=>{assert.equal((await fetchPath('/forgot-password')).status,404);assert.equal((await fetchPath('/reset-password')).status,404);});

test('marketing pages are public and accurately scoped',async()=>{for(const p of ['/contact-form-monitoring','/agency-form-monitoring','/guides/form-visibility-checklist']) {const r=await fetchPath(p);assert.equal(r.status,200);assert.match(await r.text(),/LeadPulse|form/i);}});
test('sitemap includes marketing content and omits signup checkout',async()=>{const r=await fetchPath('/sitemap.xml');assert.equal(r.status,200);const s=await r.text();assert.match(s,/agency-form-monitoring/);assert.doesNotMatch(s,/<loc>[^<]*\/signup<\/loc>/);});
