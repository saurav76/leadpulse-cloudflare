import {validEmail,sha256,randToken,hashPassword,now} from './lib.js';
import {sendEmail} from './monitor.js';
import {passwordResetEmailMessage} from './emailTemplates.js';

const GENERIC='If the account exists and is verified, a password reset link will be sent.';
export function recoveryAvailable(env){
 return env.PREVIEW_ONLY!=='true' && !!env.RESEND_API_KEY && !!env.EMAIL_FROM && !!env.PUBLIC_URL;
}
export async function requestPasswordReset(env,rawEmail){
 if(!recoveryAvailable(env))throw Error('Password recovery email is not configured.');
 const email=String(rawEmail||'').trim().toLowerCase();
 if(!validEmail(email))return GENERIC;
 const digest=await sha256(email);
 const threshold=new Date(Date.now()-3600000).toISOString();
 const count=await env.DB.prepare('SELECT COUNT(*) AS attempts FROM password_reset_attempts WHERE email_digest=? AND requested_at>?').bind(digest,threshold).first();
 // Do not reveal existence, verification state or per-address rate limits.
 if(Number(count?.attempts||0)>=3)return GENERIC;
 await env.DB.prepare('INSERT INTO password_reset_attempts(email_digest,requested_at) VALUES(?,?)').bind(digest,now()).run();
 const account=await env.DB.prepare('SELECT id,verified FROM users WHERE email=?').bind(email).first();
 if(!account?.verified)return GENERIC;
 const token=randToken(32),hash=await sha256(token),expires=new Date(Date.now()+30*60000).toISOString();
 await env.DB.prepare('UPDATE users SET password_reset_hash=?,password_reset_expires_at=? WHERE id=?').bind(hash,expires,account.id).run();
 const message=passwordResetEmailMessage(env.PUBLIC_URL,token);
 try{await sendEmail(env,email,message.subject,message.text);}
 catch(err){console.error('Password reset delivery failure',String(err?.message||err));}
 return GENERIC;
}
export async function finishPasswordReset(env,token,password){
 if(env.PREVIEW_ONLY==='true')throw Error('Account recovery is unavailable in preview.');
 if(typeof token!=='string'||token.length<30||token.length>150)throw Error('Invalid or expired password reset link.');
 const hash=await sha256(token);
 const account=await env.DB.prepare('SELECT id FROM users WHERE password_reset_hash=? AND password_reset_expires_at>?').bind(hash,now()).first();
 if(!account)throw Error('Invalid or expired password reset link.');
 const next=await hashPassword(password);
 const result=await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,password_reset_hash=NULL,password_reset_expires_at=NULL WHERE id=? AND password_reset_hash=? AND password_reset_expires_at>?').bind(next.hash,next.salt,account.id,hash,now()).run();
 if(!result.meta?.changes)throw Error('Invalid or expired password reset link.');
 await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(account.id).run();
 return true;
}
