import {sha256,now} from './lib.js';

export function registrationReady(env) {
 return !!(env.PREVIEW_ONLY!=='true' && env.ENABLE_SIGNUPS==='true' &&
  env.RESEND_API_KEY && env.EMAIL_FROM && env.PUBLIC_URL &&
  env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.AUTH_RATE_SECRET);
}
export function authReady(env) {
 return !!(env.PREVIEW_ONLY!=='true' && env.TURNSTILE_SITE_KEY &&
  env.TURNSTILE_SECRET_KEY && env.AUTH_RATE_SECRET);
}
export function turnstileWidget(env,action){
 if(!env.TURNSTILE_SITE_KEY || !/^[a-z]+$/.test(action))return '';
 const key=String(env.TURNSTILE_SITE_KEY);
 if(!/^[a-zA-Z0-9_-]{5,200}$/.test(key))return '';
 return `<div class="cf-turnstile" data-sitekey="${key}" data-action="${action}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
}
export async function verifyTurnstile(req,env,token,action,fetchImpl=fetch){
 if(!env.TURNSTILE_SECRET_KEY || typeof token!=='string' || token.length<10 || token.length>2048)return false;
 try{
  const res=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token}),
   signal:AbortSignal.timeout(8000)
  });
  if(!res.ok)return false;
  const result=await res.json();
  return result.success===true && result.action===action &&
   result.hostname===new URL(req.url).hostname;
 }catch{return false;}
}
export async function rateLimit(req,env,action,max,windowMinutes=60){
 if(!['signup','login','recover'].includes(action) || !env.AUTH_RATE_SECRET ||
    String(env.AUTH_RATE_SECRET).length<24)throw Error('Authentication rate protection is unavailable');
 const ip=req.headers.get('CF-Connecting-IP');
 if(!ip || ip.length>90)throw Error('Missing authenticated client IP');
 const key=await sha256(env.AUTH_RATE_SECRET+'|'+ip);
 const since=new Date(Date.now()-windowMinutes*60000).toISOString();
 const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_rate_events WHERE key_hash=? AND action=? AND created_at>?')
  .bind(key,action,since).first();
 if(Number(row?.n||0)>=max)return false;
 await env.DB.prepare('INSERT INTO auth_rate_events(key_hash,action,created_at) VALUES(?,?,?)')
  .bind(key,action,now()).run();
 return true;
}
