import {PLANS,now,addDays,randToken,sha256,hashPassword,verifyPassword,htmlEscape as e,validEmail,publicUrl,accessValid,planLimit,csrfValid,getCookie,cookie,safeSelector} from './lib.js';
import {layout,home,pricing,formPage,dashboard,sitePage,marketingPage,MARKETING_PATHS} from './web.js';
import {verifyOwnership,checkOne,scheduledCheck,sendEmail} from './monitor.js';
import {safeAttribution,safeCampaign,tryTrackActivity,isAdminAuthorized,adminDenied,readCustomerOverview,renderGrowthPage} from './growth.js';
import {verifyEmailMessage,welcomeEmailMessage} from './emailTemplates.js';
import {requestPasswordReset,finishPasswordReset,recoveryAvailable} from './recovery.js';
import {registrationReady,authReady,turnstileWidget,verifyTurnstile,rateLimit} from './launchSecurity.js';
import {publicHostResolves} from './publicDns.js';
const MAX_FORM=12000;
const CSP="default-src 'self'; style-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
function response(body,status=200,headers={}) {const h=new Headers({'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':CSP,'Strict-Transport-Security':'max-age=31536000','Cache-Control':'no-store'}); for(const [k,v] of new Headers(headers))h.append(k,v);return new Response(body,{status,headers:h});}
function redirect(path,cookieHeaders){const h=new Headers({'Location':path,'Cache-Control':'no-store'});for(const item of cookieHeaders||[])h.append('Set-Cookie',item);return new Response(null,{status:303,headers:h});}
function notFound(preview=true){return response(layout('Not found','<section class="inner page-intro"><h1>Page not found</h1><a href="/">Go home</a></section>',null,preview),404);}
async function sessionUser(req,env){
 const token=getCookie(req,'lp_session'); if(!token)return null;
 const hash=await sha256(token);
 const row=await env.DB.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(hash,now()).first();
 return row||null;
}
async function form(req){const text=await req.text();if(text.length>MAX_FORM)throw Error('Form too large');return new URLSearchParams(text);}
function textField(f,k,max=500){return String(f.get(k)||'').trim().slice(0,max);}
function setCSRF(req,headers){const existing=getCookie(req,'lp_csrf');const token=existing&&existing.length>=20&&existing.length<=128?existing:randToken(24);if(!existing)headers.append('Set-Cookie',cookie('lp_csrf',token,86400*7));return token;}
async function makePage(req,env,title,body,user=null,flash=''){
 const headers=new Headers();const csrf=setCSRF(req,headers);
 return response(layout(title,body,user,env.PREVIEW_ONLY==='true',flash,csrf),200,headers);
}
function checkPOST(req,f){if(!csrfValid(req,textField(f,'csrf',200)))throw Error('Session validation failed. Refresh and try again.');}
function requireSession(user){if(!user)throw Error('Please log in.');}
async function sendVerification(env,email,token){
 const message=verifyEmailMessage(env.PUBLIC_URL,token);
 return sendEmail(env,email,message.subject,message.text);
}
async function signup(req,env,f){
 if(!registrationReady(env))return response('Signup is not available until verified email delivery and abuse controls are configured.',503);
 checkPOST(req,f);
 if(!(await rateLimit(req,env,'signup',5)))return response('Too many attempts. Please try again later.',429);
 if(!(await verifyTurnstile(req,env,textField(f,'cf-turnstile-response',2048),'signup')))return response('Challenge could not be verified. Refresh and retry.',400);
 const email=textField(f,'email',255).toLowerCase(),pw=String(f.get('password')||'');
 if(!validEmail(email)||pw.length<12||pw.length>128)throw Error('Enter a valid email and a password of 12–128 characters.');
 const {salt,hash}=await hashPassword(pw);
 const token=randToken(),tokenHash=await sha256(token);
 const t=now(),until=addDays(7),verifyUntil=addDays(1);
 const source=safeAttribution(textField(f,'source',60)),campaign=safeCampaign(textField(f,'campaign',80));
 try {const reg=await env.DB.prepare('INSERT INTO users(email,password_salt,password_hash,verified,verify_token_hash,verify_expires_at,created_at,trial_until,plan,billing_status,acquisition_source,acquisition_campaign) VALUES (?,?,?,0,?,?,?,?,?,?,?,?)').bind(email,salt,hash,tokenHash,verifyUntil,t,until,'trial','trial',source,campaign).run();
  if(reg.meta?.last_row_id)await tryTrackActivity(env,Number(reg.meta.last_row_id),'registered');}
 catch {throw Error('Account already exists or could not be created.');}
 try {await sendVerification(env,email,token);}catch{throw Error('Account created, but verification email failed. Contact support.');}
 return redirect('/login?registered=1');
}
async function login(req,env,f){
 if(!authReady(env))return response('Sign in is temporarily unavailable.',503);
 checkPOST(req,f);
 if(!(await rateLimit(req,env,'login',12,20)))return response('Too many sign-in attempts. Please try again later.',429);
 if(!(await verifyTurnstile(req,env,textField(f,'cf-turnstile-response',2048),'login')))return response('Challenge could not be verified. Refresh and retry.',400);
 const email=textField(f,'email',255).toLowerCase(),pw=String(f.get('password')||'');
 const user=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
 // Never expose whether email exists. Set a sane PBKDF2 workload for unknown users.
 if(!user || !(await verifyPassword(pw,user.password_salt,user.password_hash)))throw Error('Invalid email or password.');
 const token=randToken(),hashed=await sha256(token);
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hashed,user.id,addDays(7)).run();
 await tryTrackActivity(env,user.id,'login');
 return redirect('/dashboard',[cookie('lp_session',token,86400*7)]);
}
async function getSites(env,userId){const r=await env.DB.prepare('SELECT * FROM sites WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();return r.results||[];}
async function getSite(env,id,userId){return await env.DB.prepare('SELECT * FROM sites WHERE id=? AND user_id=?').bind(id,userId).first();}
async function doPost(req,env,pathname,user){const f=await form(req);checkPOST(req,f);
 if(pathname==='/signup')return signup(req,env,f);
 if(pathname==='/login')return login(req,env,f);
 if(pathname==='/forgot-password'){
   if(!authReady(env)||!recoveryAvailable(env))return response('Password recovery is not configured.',503);
   if(!(await rateLimit(req,env,'recover',5)))return response('Too many requests. Please try again later.',429);
   if(!(await verifyTurnstile(req,env,textField(f,'cf-turnstile-response',2048),'recover')))return response('Challenge could not be verified. Refresh and retry.',400);
   return makePage(req,env,'Password reset',formPage('Check your email',`<p>${e(await requestPasswordReset(env,textField(f,'email',255)))}</p><p><a href="/login">Return to login</a></p>`));
 }
 if(pathname==='/reset-password'){
   if(!authReady(env))return response('Password recovery is not configured.',503);
   if(!(await rateLimit(req,env,'recover',5)))return response('Too many requests. Please try again later.',429);
   if(!(await verifyTurnstile(req,env,textField(f,'cf-turnstile-response',2048),'recover')))return response('Challenge could not be verified. Refresh and retry.',400);
   await finishPasswordReset(env,textField(f,'token',150),String(f.get('password')||''));
   return redirect('/login?reset=1');
 }
 if(pathname==='/logout'){
   const t=getCookie(req,'lp_session');if(t)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(t)).run();
   return redirect('/',[cookie('lp_session','',0,true)]);
 }
 requireSession(user);
 if(!user.verified)throw Error('Verify your email first.');
 if(pathname==='/sites/add'){
   if(!accessValid(user))throw Error('No active trial or paid period.');
   if(textField(f,'authorized')!=='yes')throw Error('Written authorization is required.');
   const url=publicUrl(textField(f,'url',600)), sites=await getSites(env,user.id);
   if(!(await publicHostResolves(new URL(url).hostname)))throw Error('Public DNS verification failed for this website.');
   if(sites.length>=planLimit(user))throw Error('Your plan website limit has been reached.');
   await env.DB.prepare('INSERT INTO sites(user_id,url,verify_token,created_at) VALUES(?,?,?,?)').bind(user.id,url,randToken(24),now()).run();
   await tryTrackActivity(env,user.id,'website_added');
   return redirect('/dashboard');
 }
 const m=pathname.match(/^\/sites\/(\d+)\/(verify|configure|check|toggle)$/);
 if(m){const id=Number(m[1]),action=m[2],site=await getSite(env,id,user.id);
   if(!site)throw Error('Site not found');
   if(action==='verify'){
     if(!(await verifyOwnership(site,env)))throw Error('Verification tag not found at HTTPS domain homepage.');
     await env.DB.prepare('UPDATE sites SET verified_at=? WHERE id=? AND user_id=?').bind(now(),id,user.id).run();await tryTrackActivity(env,user.id,'ownership_verified');return redirect(`/sites/${id}`);
   }
   if(!site.verified_at)throw Error('Verify ownership before configuring or checking.');
   if(action==='configure'){
     if(textField(f,'mode')!=='presence')throw Error('Only non-submitting presence checks are supported in this pilot.');
     const selector=safeSelector(textField(f,'form_selector',150));
     await env.DB.prepare('UPDATE sites SET mode=?,form_selector=? WHERE id=? AND user_id=?').bind('presence',selector,id,user.id).run();await tryTrackActivity(env,user.id,'website_configured');return redirect(`/sites/${id}`);
   }
   if(action==='toggle'){
     await env.DB.prepare('UPDATE sites SET active=? WHERE id=? AND user_id=?').bind(site.active?0:1,id,user.id).run();await tryTrackActivity(env,user.id,'monitoring_toggled');return redirect(`/sites/${id}`);
   }
   if(action==='check'){
     if(!accessValid(user)||!site.active||env.ENABLE_MONITORING!=='true')throw Error('Monitoring is not enabled for this account.');
     if(site.last_checked && (Date.now()-new Date(site.last_checked).getTime())<15*60*1000)throw Error('Only one manual check every 15 minutes.');
     await tryTrackActivity(env,user.id,'manual_check_requested');
     const result=await checkOne({...site,owner_email:user.email},env,'manual');
     return makePage(req,env,'Check result',formPage('Check result',`<p>${e(result.detail)}</p><p><a href="/sites/${id}">Return to site</a></p>`),user);
   }
 }
 throw Error('Unknown action');
}
async function serve(req,env){
 const u=new URL(req.url),path=u.pathname;
 // Limit all dynamic routes when running a free-tier static preview.
 if(env.PREVIEW_ONLY==='true'&&!['/','/pricing','/help','/privacy','/terms','/health','/robots.txt','/sitemap.xml','/styles.css','/favicon.svg','/admin',...MARKETING_PATHS].includes(path))return notFound(true);
 if(path==='/styles.css'||path==='/favicon.svg')return env.ASSETS.fetch(req);
 if(path==='/admin'){
   const configured=typeof env.ADMIN_DASHBOARD_PASSWORD==='string'&&env.ADMIN_DASHBOARD_PASSWORD.length>=24;
   if(req.method!=='GET')return notFound(env.PREVIEW_ONLY==='true');
   if(!isAdminAuthorized(req,env))return adminDenied(configured);
   const overview=await readCustomerOverview(env.DB);
   const r=response(layout('Customer analytics',renderGrowthPage(overview),null,true),200);
   r.headers.set('X-Robots-Tag','noindex, nofollow');
   r.headers.set('Referrer-Policy','no-referrer');
   return r;
 }

 if(path==='/health'){
   let db='unavailable';try{await env.DB.prepare('SELECT 1').first();db='ok';}catch{}
   return new Response(JSON.stringify({service:'leadpulse',database:db,preview:env.PREVIEW_ONLY==='true',checkout_enabled:false}),{status:db==='ok'?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }
 if(path==='/robots.txt')return new Response('User-agent: *\\nDisallow: /admin\\nDisallow: /dashboard\\nDisallow: /sites/\\nDisallow: /billing\\nDisallow: /signup\\nDisallow: /login\\nSitemap: https://leadpulse-saas.sauravbasu76.workers.dev/sitemap.xml\\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 if(path==='/sitemap.xml'){
  const routes=['/','/pricing','/help','/contact-form-monitoring','/agency-form-monitoring','/guides/form-visibility-checklist'];
  const body='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(p=>'<url><loc>https://leadpulse-saas.sauravbasu76.workers.dev'+p+'</loc></url>').join('')+'</urlset>';
  return new Response(body,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
 }
 const user=env.PREVIEW_ONLY==='true'?null:await sessionUser(req,env);
 if(req.method==='POST')return doPost(req,env,path,user);
 if(req.method!=='GET')return response('Method not allowed',405);
 if(path==='/')return makePage(req,env,'Know when forms break',home(env.PREVIEW_ONLY==='true'),user);
 if(path==='/pricing')return makePage(req,env,'Pricing',pricing(),user);
 if(MARKETING_PATHS.includes(path))return makePage(req,env,path==='/agency-form-monitoring'?'Agency form monitoring':path==='/contact-form-monitoring'?'Contact form monitoring':'Form visibility checklist',marketingPage(path),user);
 if(path==='/help')return makePage(req,env,'Help',formPage('How LeadPulse works','<p>LeadPulse checks the visible state of forms on authorized HTTPS websites. Owners must place a verification tag on their domain. Checks do not prove the form delivered an email. Support contact will be published before account registration opens.</p>'),user);
 if(path==='/privacy')return makePage(req,env,'Privacy',formPage('Privacy notice — draft','<p>LeadPulse stores account email addresses, hashed passwords, authorized site URLs, site verification status and check history in a Cloudflare D1 database. Email services and browser checks may process data as part of service delivery. Data retention, contact details and applicable legal obligations will be finalized before public signup.</p>'),user);
 if(path==='/terms')return makePage(req,env,'Terms',formPage('Terms — draft','<p>By requesting monitoring, you represent that you control or are expressly authorized to test the target website. The current preview does not offer uptime guarantees, checkout, or commercial service. Final legal terms and refund policies will be published before paid enrollment.</p>'),user);
 if(path==='/signup') {
   if(!registrationReady(env))return response('Registration is not ready. Please return after email and security checks.',503);
   const token=getCookie(req,'lp_csrf')||randToken(24);
   const source=safeAttribution(u.searchParams.get('utm_source')),campaign=safeCampaign(u.searchParams.get('utm_campaign'));
   const html=formPage('Create an account',`<p>Seven-day trial. No card required.</p><form method="post" action="/signup"><input type="hidden" name="source" value="${e(source)}"><input type="hidden" name="campaign" value="${e(campaign)}"><input type="hidden" name="csrf" value="${e(token)}"><label>Email</label><input name="email" type="email" required autocomplete="email"><label>Password</label><input name="password" type="password" minlength="12" required autocomplete="new-password"><div class="auth-challenge">${turnstileWidget(env,'signup')}</div><button class="btn btn-dark full">Create account</button></form>`);
   const h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));return response(layout('Sign up',html,null,false),200,h);
 }
 if(path==='/forgot-password'){
   if(!authReady(env)||!recoveryAvailable(env))return response('Password recovery is not configured.',503);
   const token=getCookie(req,'lp_csrf')||randToken(24);
   const html=formPage('Reset your password',`<p>Enter the email registered to your LeadPulse account. If eligible, you'll receive a 30-minute recovery link.</p><form action="/forgot-password" method="post"><input type="hidden" name="csrf" value="${e(token)}"><label>Email</label><input name="email" type="email" required><div class="auth-challenge">${turnstileWidget(env,'recover')}</div><button class="btn btn-dark full">Send reset link</button></form>`);
   const h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));return response(layout('Password recovery',html,null,false),200,h);
 }
 if(path==='/reset-password'){
   if(!authReady(env))return response('Password recovery is not configured.',503);
   const token=getCookie(req,'lp_csrf')||randToken(24),key=u.searchParams.get('token')||'';
   if(key.length<30||key.length>150)return response('Invalid or expired recovery link',400);
   const html=formPage('Choose a new password',`<form action="/reset-password" method="post"><input type="hidden" name="csrf" value="${e(token)}"><input type="hidden" name="token" value="${e(key)}"><label>New password (12–128 characters)</label><input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"><div class="auth-challenge">${turnstileWidget(env,'recover')}</div><button class="btn btn-dark full">Reset password</button></form>`);
   const h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));return response(layout('Reset password',html,null,false),200,h);
 }
 if(path==='/login'){
   if(!authReady(env))return response('Sign-in is not configured.',503);
   const token=getCookie(req,'lp_csrf')||randToken(24);
   const html=formPage('Sign in',`${u.searchParams.has('registered')?'<p>Account created. Verify your email, then sign in.</p>':''}<form method="post" action="/login"><input type="hidden" name="csrf" value="${e(token)}"><label>Email</label><input name="email" type="email" required autocomplete="email"><label>Password</label><input name="password" type="password" required autocomplete="current-password"><div class="auth-challenge">${turnstileWidget(env,'login')}</div><button class="btn btn-dark full">Sign in</button></form><p><a href="/forgot-password">Forgot password?</a></p>`);
   const h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));return response(layout('Log in',html,null,false),200,h);
 }
 if(path==='/verify-email'){
   const token=u.searchParams.get('token');if(!token)return response('Invalid link',400);
   const hash=await sha256(token),row=await env.DB.prepare('SELECT id FROM users WHERE verify_token_hash=? AND verify_expires_at>?').bind(hash,now()).first();
   if(!row)return response('Link expired or invalid',400);
   await env.DB.prepare('UPDATE users SET verified=1,verify_token_hash=NULL,verify_expires_at=NULL WHERE id=?').bind(row.id).run();
   await tryTrackActivity(env,row.id,'email_verified');
   if(recoveryAvailable(env)){const account=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(row.id).first();if(account?.email){const welcome=welcomeEmailMessage(env.PUBLIC_URL);await sendEmail(env,account.email,welcome.subject,welcome.text).catch(()=>{});}}
   return redirect('/login?verified=1');
 }
 if(path==='/dashboard'){
   requireSession(user);await tryTrackActivity(env,user.id,'dashboard_view');const sites=await getSites(env,user.id),token=getCookie(req,'lp_csrf')||randToken(24);
   const h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));return response(layout('Dashboard',dashboard(user,sites,token),user,false,'',token),200,h);
 }
 const m=path.match(/^\/sites\/(\d+)$/);
 if(m){requireSession(user);const site=await getSite(env,Number(m[1]),user.id);if(!site)return notFound(false);
  const rows=await env.DB.prepare('SELECT checked_at,status,detail FROM checks WHERE site_id=? AND user_id=? ORDER BY checked_at DESC LIMIT 30').bind(site.id,user.id).all();
  const token=getCookie(req,'lp_csrf')||randToken(24),h=new Headers();if(!getCookie(req,'lp_csrf'))h.append('Set-Cookie',cookie('lp_csrf',token,604800));
  return response(layout('Site detail',sitePage(site,rows.results||[],token,accessValid(user)),user,false,'',token),200,h);
 }
 if(path.startsWith('/billing'))return response('Payments are not active. No charges can be made.',503);
 return notFound(env.PREVIEW_ONLY==='true');
}
export default {
 async fetch(request,env,ctx){
  try{return await serve(request,env)}catch(err){
   const msg=String(err?.message||'Unexpected error');
   const known=/^(?:Enter |Only |Public |Invalid |No |Unknown |Site |Session |Please |Your |Trial |Verify |Verification |Account |Written |Password |Form |Monitoring |Daily |Unexpected |Not |Logged |You)/.test(msg);
   if(!known)console.error('LeadPulse request failure',err);
   return response(layout('Error',formPage('Could not complete request',`<p>${e(known?msg:'Service temporarily unavailable. Please try again.')}</p><a href="/">Return home</a>`),null,env.PREVIEW_ONLY==='true'),known?400:500);
  }
 },
 async scheduled(event,env,ctx){ctx.waitUntil(scheduledCheck(env).catch(err=>console.error('Scheduled LeadPulse check failed',String(err))));}
};
