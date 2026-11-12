import {METRICS_SQL,percentage} from '../src/growth.js';
import {appendFileSync} from 'node:fs';

const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const db=process.env.LEADPULSE_D1_DATABASE_ID;
if(!token || !/^[a-f0-9]{32}$/i.test(account||'') || !/^[a-f0-9-]{36}$/i.test(db||''))
 throw Error('Cloudflare deployment credentials are not configured');
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`;
const res=await fetch(endpoint,{
 method:'POST',
 headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify({sql:METRICS_SQL}),
 signal:AbortSignal.timeout(25000)
});
const json=await res.json().catch(()=>({}));
if(!res.ok||!json.success) throw Error(`Cloudflare D1 metrics query failed (HTTP ${res.status}); verify D1 permissions/migration.`);
const item=json.result?.[0]?.results?.[0];
if(!item || typeof item.registered!=='number')throw Error('Metrics schema not available: apply 0002_customer_growth.sql');
const rows=[
 ['Registered accounts',item.registered],['Email verified',item.verified],
 ['Onboarded (authorized website)',item.onboarded],['Activated (healthy check)',item.activated],
 ['Active trials',item.active_trials],['Active monitoring customers',item.active_monitoring_customers],
 ['7-day human active users',item.weekly_active_users],['30-day human active users',item.monthly_active_users],
 ['Total checks',item.checks_total],['Healthy checks',item.checks_healthy],['Failed checks',item.checks_failed],
 ['Prospects researched',item.prospects_researched],['Outreach eligible',item.outreach_eligible],
 ['Emails recorded as sent',item.outreach_sent],['Replies recorded',item.outreach_replies]
];
const summary=[
 '# LeadPulse customer growth — live Cloudflare D1',
 `Generated: ${new Date().toISOString()}`,
 '',
 '| Metric | Actual |','|---|---:|',
 ...rows.map(([name,n])=>`| ${name} | ${n} |`),
 '',
 `**Verification rate:** ${percentage(item.verified,item.registered)}% · **Activation rate:** ${percentage(item.activated,item.registered)}%`,
 '',
 'Engaged users = unique humans with meaningful logged-in actions. Automated monitoring is counted separately.',
 'These are actual D1 aggregates. Zero means no matching records, not that acquisition succeeded.'
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
console.log(summary);
