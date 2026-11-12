import test from 'node:test';
import assert from 'node:assert/strict';
import {safeAttribution,safeCampaign,percentage,isAdminAuthorized,adminDenied,METRICS_SQL,renderGrowthPage,trackActivity} from '../src/growth.js';
import {entitlementFor,paidAccessVerified,canEnableCheckout} from '../src/paid.js';
test('attribution is allowlisted and prevents HTML injection',()=>{
 assert.equal(safeAttribution('Email_Campaign-01'),'email_campaign-01');
 assert.equal(safeAttribution('<script>'),'direct');
 assert.equal(safeCampaign('Holiday24'),'holiday24');
 assert.equal(safeCampaign('https://evil.com'),'');
});
test('activation and engagement are distinct from cron checks',()=>{
 assert.match(METRICS_SQL,/checks c WHERE c.status='healthy'/);
 assert.match(METRICS_SQL,/a.origin='customer'/);
 assert.match(METRICS_SQL,/active_monitoring_customers/);
});
test('admin password is mandatory and checked without embedding in URL',()=>{
 const pw='S'.repeat(30);
 const request=new Request('https://leadpulse.example/admin',{headers:{Authorization:'Basic '+btoa('admin:'+pw)}});
 assert.equal(isAdminAuthorized(request,{ADMIN_DASHBOARD_PASSWORD:pw}),true);
 assert.equal(isAdminAuthorized(request,{ADMIN_DASHBOARD_PASSWORD:'wrong'}),false);
 assert.equal(isAdminAuthorized(request,{}),false);
 assert.equal(adminDenied(false).status,404);
 assert.equal(adminDenied(true).status,401);
});
test('admin metrics escape customer PII and show real counts',()=>{
 const html=renderGrowthPage({metrics:{registered:1,verified:1,onboarded:1,activated:0,weekly_active_users:0},customers:[{id:1,email:'<script>alert(1)</script>',created_at:'now',verified:1,onboarded:1,activated:0}],sources:[{acquisition_source:'referral',registered:1}]});
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/Registered/);
});
test('percentage handles empty cohorts',()=>{assert.equal(percentage(1,4),25);assert.equal(percentage(0,0),0)});
test('activity writes only whitelisted customer events',async()=>{
 let args;const env={DB:{prepare:()=>({bind:(...a)=>{args=a;return {run:async()=>({})}}})}};
 await trackActivity(env,42,'login');
 assert.deepEqual(args.slice(0,2),[42,'login']);
 await assert.rejects(()=>trackActivity(env,42,'cron'));
});
test('paid plans cannot be activated without verified payment evidence',()=>{
 const u={verified:1,plan:'agency',billing_status:'prepaid',paid_until:'2099-01-01'};
 assert.equal(paidAccessVerified(u),false);
 assert.equal(entitlementFor(u).active,false);
 assert.equal(entitlementFor({...u,paid_verified_at:'2026-01-01'}).active,true);
 assert.equal(canEnableCheckout({BILLING_ENABLED:'true'}),false);
});
