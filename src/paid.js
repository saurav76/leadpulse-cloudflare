// Interfaces for a *future* verified payment provider. No checkout or charges.
export const PLAN_CATALOG=Object.freeze({
 trial:Object.freeze({sites:1,checksPerDay:1,requiresPayment:false}),
 solo:Object.freeze({sites:1,checksPerDay:1,requiresPayment:true}),
 studio:Object.freeze({sites:5,checksPerDay:5,requiresPayment:true}),
 agency:Object.freeze({sites:20,checksPerDay:20,requiresPayment:true})
});
export function paidAccessVerified(user,at=new Date()){
 return !!(user && user.verified && ['solo','studio','agency'].includes(user.plan) &&
  user.billing_status==='prepaid' && user.paid_verified_at &&
  user.paid_until && new Date(user.paid_until)>at);
}
export function entitlementFor(user,at=new Date()){
 if(!user?.verified) return {active:false,plan:'none',sites:0};
 if(user.billing_status==='trial'&&user.trial_until&&new Date(user.trial_until)>at)
  return {active:true,plan:'trial',sites:PLAN_CATALOG.trial.sites};
 if(paidAccessVerified(user,at))return {active:true,plan:user.plan,sites:PLAN_CATALOG[user.plan].sites};
 return {active:false,plan:'none',sites:0};
}
// Payment webhooks are intentionally not implemented. Never use client input to set payment status.
export function canEnableCheckout(env){return false;}
