export const PLANS = Object.freeze({trial:1,solo:1,studio:5,agency:20});
export const PRICES = Object.freeze({solo:9,studio:19,agency:39});

export const now = () => new Date().toISOString();
export const addDays = (days) => new Date(Date.now() + days*86400000).toISOString();
export function htmlEscape(x='') { return String(x).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function validEmail(x) { return /^[^\s@]{1,100}@[^\s@]{1,180}\.[a-z]{2,}$/i.test(x) && x.length<=254; }
export function publicUrl(raw) {
 let u; try { u = new URL(raw); } catch { throw new Error('Enter a valid public HTTPS URL'); }
 if (u.protocol!=='https:' || u.username || u.password || u.port || u.hash) throw new Error('Only public HTTPS URLs are supported (without ports or credentials)');
 const h=u.hostname.toLowerCase();
 if (h==='localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.test') || h.endsWith('.invalid') || h.endsWith('.onion') || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':') || !h.includes('.') || h.length>253) throw new Error('Public DNS hostname required');
 if (!/^[a-z0-9.-]+$/.test(h) || h.split('.').some(p=>!p || p.startsWith('-') || p.endsWith('-'))) throw new Error('Invalid domain');
 if (u.toString().length>500) throw new Error('URL too long');
 u.search = ''; u.hash = ''; return u.toString();
}
export function accessValid(user, at = new Date()) {
 if (!user || !user.verified) return false;
 if (user.billing_status==='prepaid' && user.paid_verified_at && ['solo','studio','agency'].includes(user.plan) && user.paid_until) return new Date(user.paid_until)>at;
 if (user.billing_status==='trial' && user.trial_until) return new Date(user.trial_until)>at;
 return false;
}
export function planLimit(user) {return user?.billing_status==='prepaid' && user?.paid_verified_at ? (PLANS[user?.plan]||1) : 1;}
export function safeSelector(x) { const s=String(x||'form').trim(); if (!s || s.length>150 || /[\x00-\x1f]/.test(s)) throw Error('Invalid selector'); return s; }
export function base64url(bytes) {return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function randToken(bytes=32) {return base64url(crypto.getRandomValues(new Uint8Array(bytes)));}
const enc=new TextEncoder();
export async function sha256(x) {return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(x))));}
export async function hashPassword(password,salt=randToken(16)) {
 if (typeof password!=='string' || password.length<12 || password.length>128) throw Error('Password must be 12–128 characters');
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:150000,hash:'SHA-256'},key,256);
 return {salt,hash:base64url(new Uint8Array(bits))};
}
export async function verifyPassword(password,salt,hash) {
 try { const computed=(await hashPassword(password,salt)).hash; return constantTimeStringEq(computed,hash); } catch {return false;}
}
export function constantTimeStringEq(a,b) { const x=enc.encode(String(a)),y=enc.encode(String(b));let diff=x.length^y.length; for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0; }
export function getCookie(request,name) {return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
export function csrfValid(request, token) {
 let origin=request.headers.get('origin');
 if (!origin || origin!==new URL(request.url).origin) return false;
 let expected=getCookie(request,'lp_csrf');
 return !!token && !!expected && constantTimeStringEq(token, expected);
}
export function cookie(name,value,age,clear=false) {return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${clear?0:age}`;}
