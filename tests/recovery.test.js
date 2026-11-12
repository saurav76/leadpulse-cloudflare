import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyEmailMessage,passwordResetEmailMessage,welcomeEmailMessage,trialReminderEmailMessage} from '../src/emailTemplates.js';
import {recoveryAvailable,requestPasswordReset} from '../src/recovery.js';
test('email verification and password reset links use HTTPS and expire',()=>{
 const verify=verifyEmailMessage('https://leadpulse.example','a secret/');
 assert.match(verify.text,/verify-email\?token=a%20secret%2F/);
 assert.match(verify.text,/24 hours/);
 const reset=passwordResetEmailMessage('https://leadpulse.example','abc');
 assert.match(reset.text,/30 minutes/);
 assert.match(welcomeEmailMessage('https://leadpulse.example').text,/authorize/i);
 assert.match(trialReminderEmailMessage('https://leadpulse.example',1).text,/no charge/);
});
test('reject untrusted email callback base',()=>{
 assert.throws(()=>verifyEmailMessage('http://not-https.example','token'));
 assert.throws(()=>passwordResetEmailMessage('https://user:pass@example.com','token'));
});
test('recovery is disabled in preview or without mail config',async()=>{
 const env={PREVIEW_ONLY:'true',RESEND_API_KEY:'x',EMAIL_FROM:'team@example.com',PUBLIC_URL:'https://leadpulse.example'};
 assert.equal(recoveryAvailable(env),false);
 await assert.rejects(()=>requestPasswordReset(env,'test@example.com'));
});
