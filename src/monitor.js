import {now,publicUrl} from './lib.js';
import {publicHostResolves} from './publicDns.js';

export function verifyTagInHtml(html,token) {
  // HTML can contain harmless whitespace or reversed attribute order.
  const metas=String(html).match(/<meta\b[^>]*>/gi)||[];
  return metas.some(tag=>{
    const attrs={};
    for(const match of tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[match[1].toLowerCase()]=match[2]??match[3];
    return attrs.name==='leadpulse-verification' && attrs.content===token;
  });
}
export async function verifyOwnership(site,env) {
  const origin=new URL(publicUrl(site.url)).origin;
  if(!(await publicHostResolves(new URL(origin).hostname)))return false;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(origin+'/',{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'LeadPulse-Verification/1.0'}});
    if(!response.ok || response.status>=300 || !((response.headers.get('content-type')||'').includes('text/html'))) return false;
    const body=(await response.text()).slice(0,256000);
    return verifyTagInHtml(body,site.verify_token);
  } finally {clearTimeout(timer);}
}
export async function browserPresenceCheck(site,env) {
  const url=publicUrl(site.url),expectedOrigin=new URL(url).origin;
  if(!(await publicHostResolves(new URL(url).hostname)))return {status:'skipped',detail:'Domain did not pass public DNS security check.'};
  let browser, page;
  try {
    const {launch}=await import('@cloudflare/playwright');
    browser=await launch(env.BROWSER);
    page=await browser.newPage();
    // Conservative origin-only policy; this may block third-party scripts, captchas, and CDN-loaded forms.
    await page.route('**/*', route=>{
      let dest;try{dest=new URL(route.request().url());}catch{return route.abort();}
      return dest.origin===expectedOrigin && dest.protocol==='https:'?route.continue():route.abort();
    });
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:12000});
    if(!response || !response.ok()) return {status:'failed',detail:`Website returned HTTP ${response?.status()||'unknown'}`};
    if(new URL(page.url()).origin!==expectedOrigin) return {status:'failed',detail:'Unexpected cross-origin redirect'};
    const loc=page.locator(site.form_selector||'form').first();
    const visible=await loc.isVisible({timeout:3500});
    return visible ? {status:'healthy',detail:'Configured form is visibly present. Submission and inbox delivery not verified.'} : {status:'failed',detail:'Configured form was not visibly present.'};
  } finally {await page?.close().catch(()=>{});await browser?.close().catch(()=>{});}
}
export async function checkOne(site,env, source='manual') {
  const n=now();
  const budget=Math.max(0,Math.min(600000,Number(env.MAX_DAILY_BROWSER_MS||300000)));
  const day=n.slice(0,10);
  const used=await env.DB.prepare('SELECT COALESCE(SUM(reserved_ms),0) AS ms FROM usage_reservations WHERE started_at>=? AND started_at<?').bind(day+'T00:00:00.000Z',day+'T23:59:59.999Z').first();
  if ((used?.ms||0)+30000>budget) return {status:'skipped',detail:'Daily browser allowance reserved. Retry tomorrow.'};
  const valid=await verifyOwnership(site,env).catch(()=>false);
  if(!valid) return {status:'skipped',detail:'Ownership verification tag is missing or inaccessible. No browser check performed.'};
  await env.DB.prepare('INSERT INTO usage_reservations(site_id,started_at,reserved_ms) VALUES(?,?,30000)').bind(site.id,n).run();
  const start=Date.now();
  let result;
  try { result=await browserPresenceCheck(site,env); }
  catch(err){result={status:'failed',detail:`Browser check could not complete: ${String(err?.message||'unknown error').slice(0,150)}`};}
  const duration=Math.min(Date.now()-start,60000);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO checks(site_id,user_id,status,detail,checked_at,duration_ms) VALUES(?,?,?,?,?,?)').bind(site.id,site.user_id,result.status,result.detail,n,duration),
    env.DB.prepare('UPDATE sites SET last_status=?,last_checked=? WHERE id=?').bind(result.status,n,site.id)
  ]);
  if(result.status==='failed' && site.last_status!=='failed' && env.RESEND_API_KEY && env.EMAIL_FROM && site.owner_email){
    await sendEmail(env,site.owner_email,'LeadPulse: website form check failed',`The form at ${site.url} failed its authorized visibility check.\n\n${result.detail}\n\nPlease verify the result in LeadPulse. This does not diagnose inbox delivery.`).catch(()=>{});
  }
  return {...result,duration_ms:duration,source};
}
export async function sendEmail(env,to,subject,text){
 if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw Error('Mail provider not configured');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[to],subject,text})});
 if(!r.ok) throw Error(`Email provider rejected message (${r.status})`);
 return r.json();
}
export async function scheduledCheck(env){
 if(env.PREVIEW_ONLY==='true' || env.ENABLE_MONITORING!=='true') return {skipped:'Monitoring disabled'};
 const threshold=new Date(Date.now()-24*3600000).toISOString();
 const site=await env.DB.prepare(`SELECT s.*,u.email owner_email,u.verified,u.billing_status,u.trial_until,u.paid_until,u.plan,u.paid_verified_at FROM sites s JOIN users u ON u.id=s.user_id
 WHERE s.active=1 AND s.verified_at IS NOT NULL AND u.verified=1
 AND (s.last_checked IS NULL OR s.last_checked<?)
 AND ((u.billing_status='trial' AND u.trial_until>?) OR (u.billing_status='prepaid' AND u.paid_until>? AND u.paid_verified_at IS NOT NULL))
 ORDER BY COALESCE(s.last_checked,'') ASC LIMIT 1`).bind(threshold,now(),now()).first();
 if(!site) return {skipped:'No due checks'};
 const {accessValid}=await import('./lib.js');
 if(!accessValid(site)) return {skipped:'No eligible customer in scheduling slot'};
 return await checkOne(site,env,'cron');
}
