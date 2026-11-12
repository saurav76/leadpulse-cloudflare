import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationReady,authReady,turnstileWidget,verifyTurnstile} from '../src/launchSecurity.js';
import {isPublicIp,publicHostResolves} from '../src/publicDns.js';
const configured={PREVIEW_ONLY:'false',ENABLE_SIGNUPS:'true',RESEND_API_KEY:'key',EMAIL_FROM:'team@example.com',PUBLIC_URL:'https://leadpulse.example',TURNSTILE_SITE_KEY:'site_key_123',TURNSTILE_SECRET_KEY:'secret_123',AUTH_RATE_SECRET:'x'.repeat(32)};
test('registration fails closed when services are unconfigured',()=>{
 assert.equal(registrationReady({...configured,PREVIEW_ONLY:'true'}),false);
 assert.equal(registrationReady({...configured,TURNSTILE_SECRET_KEY:undefined}),false);
 assert.equal(registrationReady({...configured,RESEND_API_KEY:undefined}),false);
 assert.equal(registrationReady(configured),true);
 assert.equal(authReady({...configured,AUTH_RATE_SECRET:undefined}),false);
});
test('Turnstile renders widget and validates action plus exact host',async()=>{
 assert.match(turnstileWidget(configured,'signup'),/data-action="signup"/);
 const req=new Request('https://leadpulse.example/signup');
 const yes=async()=>new Response(JSON.stringify({success:true,hostname:'leadpulse.example',action:'signup'}),{status:200});
 assert.equal(await verifyTurnstile(req,configured,'valid_token_123','signup',yes),true);
 const wrong=async()=>new Response(JSON.stringify({success:true,hostname:'wrong.example',action:'signup'}));
 assert.equal(await verifyTurnstile(req,configured,'valid_token_123','signup',wrong),false);
 assert.equal(await verifyTurnstile(req,configured,'valid_token_123','login',yes),false);
 assert.equal(await verifyTurnstile(req,configured,'','signup',yes),false);
});
test('private, special and loopback IPv4 blocked',()=>{
 for(const ip of ['127.0.0.1','10.0.0.9','169.254.169.254','100.64.0.1','172.16.0.3','192.168.1.2','198.18.0.1','192.0.2.4','203.0.113.1','224.0.0.1','0.0.0.0']) assert.equal(isPublicIp(ip),false,ip);
 assert.equal(isPublicIp('8.8.8.8'),true);
 assert.equal(isPublicIp('1.1.1.1'),true);
 assert.equal(isPublicIp('2001:4860:4860::8888'),true);
 for(const ip of ['::1','fc00::1','fe80::1','::ffff:10.0.0.1','2001:db8::1','2002:0a00:0001::1']) assert.equal(isPublicIp(ip),false,ip);
});
test('DNS preflight fails closed for private answers and DNS failures',async()=>{
 const fakePrivate=async url=>new Response(JSON.stringify({Status:0,Answer:url.includes('AAAA')?[]:[{type:1,data:'10.0.0.1'}]}));
 assert.equal(await publicHostResolves('example.com',fakePrivate),false);
 const fakePublic=async url=>new Response(JSON.stringify({Status:0,Answer:url.includes('AAAA')?[]:[{type:1,data:'1.1.1.1'}]}));
 assert.equal(await publicHostResolves('example.com',fakePublic),true);
 const fakeFail=async()=>{throw Error('offline');};
 assert.equal(await publicHostResolves('example.com',fakeFail),false);
});
