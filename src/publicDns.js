// Fail closed on non-public DNS answers. DNS rebinding is still a residual risk;
// public signup/monitoring requires infrastructure-level outbound safeguards.
function ipv4Parts(value){
 if(!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value))return null;
 const n=value.split('.').map(Number);
 return n.every(v=>v>=0&&v<=255)?n:null;
}
export function isPublicIp(value){
 const ip=String(value||'').toLowerCase().trim();
 const v4=ipv4Parts(ip);
 if(v4){
  const [a,b,c]=v4;
  if(a===0||a===10||a===127||a>=224)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&(b===168||b===0||b===88&&c===99))return false;
  if(a===192&&b===0&&c===2)return false;
  if(a===198&&(b===18||b===19||b===51&&c===100))return false;
  if(a===203&&b===0&&c===113)return false;
  return true;
 }
 // Only accept common 2000::/3 global-unicast IPv6. Refuse embedded IPv4,
 // transitional, documentation, ULA, loopback and link-local allocations.
 if(!/^[0-9a-f:]+$/.test(ip) || ip.includes(':::') || ip.includes('.'))return false;
 if(!/^[23][0-9a-f]{3}:/.test(ip))return false;
 if(ip.startsWith('2001:db8:') || ip.startsWith('2001:0:') ||
    ip.startsWith('2002:') || ip.startsWith('2001:10:'))return false;
 return ip.length<=39;
}
export async function publicHostResolves(host,fetchImpl=fetch){
 const hostname=String(host||'').trim().toLowerCase();
 if(!/^(?=.{4,253}$)[a-z0-9.-]+$/.test(hostname)||!hostname.includes('.'))return false;
 const questions=['A','AAAA'];
 try{
  const responses=await Promise.all(questions.map(async type=>{
   const url=`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
   const r=await fetchImpl(url,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(6000)});
   if(!r.ok)throw Error('DNS lookup failed');
   const body=await r.json();
   if(body.Status!==0 && body.Status!==3)throw Error('DNS response failed');
   return body.Answer||[];
  }));
  const addresses=responses.flat().filter(a=>a.type===1||a.type===28).map(a=>a.data);
  return addresses.length>0 && addresses.every(isPublicIp);
 }catch{return false;}
}
