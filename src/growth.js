import {htmlEscape as e, now, constantTimeStringEq} from './lib.js';

// Server-derived lifecycle, not marketing guesses. Human engagement excludes cron jobs.
// Queries contain no email addresses and are safe for private GitHub Actions summaries.
export const METRICS_SQL = `
SELECT
 (SELECT COUNT(*) FROM users) AS registered,
 (SELECT COUNT(*) FROM users WHERE verified=1) AS verified,
 (SELECT COUNT(DISTINCT s.user_id) FROM sites s JOIN users u ON u.id=s.user_id WHERE u.verified=1 AND s.verified_at IS NOT NULL) AS onboarded,
 (SELECT COUNT(DISTINCT c.user_id) FROM checks c WHERE c.status='healthy') AS activated,
 (SELECT COUNT(*) FROM users WHERE verified=1 AND billing_status='trial' AND trial_until > strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS active_trials,
 (SELECT COUNT(DISTINCT a.user_id) FROM customer_activity a WHERE a.origin='customer' AND a.action IN ('login','dashboard_view','website_added','ownership_verified','website_configured','manual_check_requested') AND a.happened_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')) AS weekly_active_users,
 (SELECT COUNT(DISTINCT a.user_id) FROM customer_activity a WHERE a.origin='customer' AND a.action IN ('login','dashboard_view','website_added','ownership_verified','website_configured','manual_check_requested') AND a.happened_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')) AS monthly_active_users,
 (SELECT COUNT(DISTINCT s.user_id) FROM sites s JOIN users u ON u.id=s.user_id WHERE s.active=1 AND s.verified_at IS NOT NULL AND s.last_checked>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days') AND u.verified=1 AND ((u.billing_status='trial' AND u.trial_until>strftime('%Y-%m-%dT%H:%M:%fZ','now')) OR (u.billing_status='prepaid' AND u.paid_until>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND u.paid_verified_at IS NOT NULL))) AS active_monitoring_customers,
 (SELECT COUNT(*) FROM users WHERE billing_status='trial' AND trial_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS expired_trials,
 (SELECT COUNT(*) FROM checks) AS checks_total,
 (SELECT COUNT(*) FROM checks WHERE status='healthy') AS checks_healthy,
 (SELECT COUNT(*) FROM checks WHERE status='failed') AS checks_failed,
 (SELECT COUNT(*) FROM outreach_prospects) AS prospects_researched,
 (SELECT COUNT(*) FROM outreach_prospects WHERE eligibility='approved') AS outreach_eligible,
 (SELECT COUNT(*) FROM campaign_events WHERE event_type='sent') AS outreach_sent,
 (SELECT COUNT(*) FROM campaign_events WHERE event_type='reply') AS outreach_replies
`;

export const ACTIVITY_ACTIONS=Object.freeze([
 'registered','email_verified','login','dashboard_view','website_added',
 'ownership_verified','website_configured','manual_check_requested','monitoring_toggled'
]);
const allowed=new Set(ACTIVITY_ACTIONS);
export function safeAttribution(x){
 const value=String(x||'').trim().toLowerCase();
 return /^[a-z0-9_-]{1,60}$/.test(value)?value:'direct';
}
export function safeCampaign(x){
 const value=String(x||'').trim().toLowerCase();
 return /^[a-z0-9_-]{1,80}$/.test(value)?value:'';
}
export async function trackActivity(env,userId,action){
 if(!Number.isSafeInteger(Number(userId)) || Number(userId)<1 || !allowed.has(action)) throw Error('Invalid activity event');
 await env.DB.prepare('INSERT INTO customer_activity(user_id,action,happened_at,origin) VALUES(?,?,?,?)').bind(Number(userId),action,now(),'customer').run();
}
export async function tryTrackActivity(env,userId,action){
 try {await trackActivity(env,userId,action);}
 catch(err) {console.error('LeadPulse analytics event failed',String(err?.message||err));}
}
export function percentage(part,total){
 return total>0?Math.round((Number(part||0)/Number(total))*1000)/10:0;
}
export async function readMetrics(db){
 const stats=await db.prepare(METRICS_SQL).first();
 if(!stats) throw Error('Metrics query returned no data');
 return stats;
}
const CUSTOMERS_SQL=`
SELECT u.id,u.email,u.created_at,u.verified,u.acquisition_source,u.acquisition_campaign,
 u.trial_until,u.plan,u.billing_status,
 CASE WHEN EXISTS(SELECT 1 FROM sites s WHERE s.user_id=u.id AND s.verified_at IS NOT NULL) THEN 1 ELSE 0 END AS onboarded,
 CASE WHEN EXISTS(SELECT 1 FROM checks c WHERE c.user_id=u.id AND c.status='healthy') THEN 1 ELSE 0 END AS activated,
 (SELECT MAX(a.happened_at) FROM customer_activity a WHERE a.user_id=u.id AND a.origin='customer' AND a.action IN ('login','dashboard_view','website_added','ownership_verified','website_configured','manual_check_requested')) AS last_human_activity,
 (SELECT MAX(s.last_checked) FROM sites s WHERE s.user_id=u.id) AS last_monitoring_check
FROM users u ORDER BY u.created_at DESC LIMIT 100`;
export async function readCustomerOverview(db){
 const [metrics,users,sources]=await Promise.all([
  readMetrics(db),
  db.prepare(CUSTOMERS_SQL).all(),
  db.prepare("SELECT acquisition_source,COUNT(*) AS registered FROM users GROUP BY acquisition_source ORDER BY registered DESC LIMIT 20").all()
 ]);
 return {metrics,customers:users.results||[],sources:sources.results||[]};
}
function value(v){return e(v===null||v===undefined?'—':v);}
function card(label,val){return `<div class="stat"><span>${e(label)}</span><strong>${value(val)}</strong></div>`;}
export function renderGrowthPage(data){
 const m=data.metrics;
 const cards=[
  ['Registered',m.registered],['Verified',m.verified],['Onboarded',m.onboarded],
  ['Activated',m.activated],['Active trials',m.active_trials],['Monitoring active',m.active_monitoring_customers],
  ['7-day active users',m.weekly_active_users],['30-day active users',m.monthly_active_users],
  ['Monitoring checks',m.checks_total],['Checks healthy',m.checks_healthy],
  ['Prospects researched',m.prospects_researched],['Outreach sent',m.outreach_sent]
 ].map(([n,v])=>card(n,v)).join('');
 const funnels=[['Registered',m.registered],['Email verified',m.verified],['Onboarded',m.onboarded],['Activated',m.activated]].map(([n,v])=>`<tr><td>${e(n)}</td><td>${value(v)}</td><td>${percentage(v,m.registered)}%</td></tr>`).join('');
 const users=data.customers.map(u=>`<tr><td>${value(u.id)}</td><td>${value(u.email)}</td><td>${value(u.acquisition_source)}</td><td>${u.verified?'Yes':'No'}</td><td>${u.onboarded?'Yes':'No'}</td><td>${u.activated?'Yes':'No'}</td><td>${value(u.last_human_activity)}</td><td>${value(u.last_monitoring_check)}</td></tr>`).join('');
 const sources=data.sources.map(s=>`<tr><td>${value(s.acquisition_source)}</td><td>${value(s.registered)}</td></tr>`).join('');
 return `<section class="app-background"><div class="inner app-area">
 <div class="app-title"><div><div class="eyebrow">ADMIN · PRIVATE DATA</div><h1>Customer growth and actual usage</h1><p>Real D1 records only. Human engagement excludes scheduled checks. All times UTC.</p></div></div>
 <div class="stat-grid">${cards}</div>
 <section class="panel history"><h2>Acquisition → Activation</h2><div class="table-scroll"><table><thead><tr><th>Step</th><th>Customers</th><th>% of registrations</th></tr></thead><tbody>${funnels}</tbody></table></div></section>
 <section class="panel history"><h2>Acquisition source</h2><div class="table-scroll"><table><thead><tr><th>Source</th><th>Registrations</th></tr></thead><tbody>${sources||'<tr><td colspan="2">No signups</td></tr>'}</tbody></table></div></section>
 <section class="panel history"><h2>Recent customers (up to 100)</h2><p class="helper-text">Onboarded means an authorized site verified; activated means a successful authorized check. A customer may benefit from automatic monitoring without visiting this dashboard.</p><div class="table-scroll"><table><thead><tr><th>ID</th><th>Email</th><th>Source</th><th>Verified</th><th>Onboarded</th><th>Activated</th><th>Human activity</th><th>Last form check</th></tr></thead><tbody>${users||'<tr><td colspan="8">No customers registered</td></tr>'}</tbody></table></div></section>
 </div></section>`;
}
export function isAdminAuthorized(request,env){
 const password=env.ADMIN_DASHBOARD_PASSWORD;
 if(typeof password!=='string'||password.length<24) return false;
 const header=request.headers.get('authorization')||'';
 const expected='Basic '+btoa('admin:'+password);
 return constantTimeStringEq(header,expected);
}
export function adminDenied(configured){
 return new Response('Private analytics dashboard',{status:configured?401:404,headers:{
  ...(configured?{'WWW-Authenticate':'Basic realm="LeadPulse Admin", charset="UTF-8"'}:{}),
  'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'
 }});
}
