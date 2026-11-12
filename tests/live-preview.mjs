import assert from 'node:assert/strict';

const base = process.env.LEADPULSE_PREVIEW_URL || 'https://leadpulse-saas.sauravbasu76.workers.dev';

async function request(path, options = {}) {
  const url = base + path;
  let last;
  for (let n=0;n<4;n++) {
    try {
      const res=await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      // A new Workers deployment may take a few moments to propagate.
      if (res.status >= 500 && n < 3) {last=Error(`HTTP ${res.status} at ${path}`);}
      else return res;
    } catch (e) {last=e;}
    await new Promise(r => setTimeout(r, (n+1)*1500));
  }
  throw last;
}

const health = await request('/health');
assert.equal(health.status, 200, '/health must be HTTP 200');
assert.match(health.headers.get('content-type')||'', /application\/json/);
const state = await health.json();
assert.equal(state.service, 'leadpulse');
assert.equal(state.database, 'ok', 'D1 binding must be responding');
assert.equal(state.preview, true, 'Preview-only mode must be enabled');
assert.equal(state.checkout_enabled, false, 'Checkout must remain unavailable');
console.log('PASS /health: D1 OK, preview only, checkout off');

for(const route of ['/', '/pricing', '/help', '/privacy', '/terms']) {
  const r = await request(route);
  assert.equal(r.status, 200, `${route} should load`);
  assert.match(await r.text(), /LeadPulse/i, `${route} should render LeadPulse`);
  console.log(`PASS ${route}: HTTP 200`);
}
for(const route of ['/signup', '/dashboard', '/billing', '/login', '/sites/add']) {
  const r = await request(route);
  assert.equal(r.status, 404, `${route} must be disabled in preview`);
  console.log(`PASS ${route}: blocked (404)`);
}
const post = await request('/signup', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'email=nope%40example.org'});
assert.equal(post.status, 404, 'POST signup must be disabled in preview');
console.log('PASS POST /signup: blocked');
const css = await request('/styles.css');
assert.equal(css.status, 200, 'Stylesheet must load');
assert.match(css.headers.get('content-type')||'', /css/);
console.log('PASS /styles.css');
const favicon = await request('/favicon.svg');
assert.equal(favicon.status, 200, 'Favicon must load');
console.log('PASS /favicon.svg');
console.log('Live preview HTTP smoke test passed:',base);
