// Text-only transactional messages. Never mix prospecting emails with these.
function baseUrl(input){
 const u=new URL(String(input||''));
 if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash)throw Error('Public application HTTPS base URL must be configured');
 return u.origin;
}
export function verifyEmailMessage(base,token){
 return {
  subject:'Verify your LeadPulse email',
  text:`Confirm your LeadPulse email address:\n\n${baseUrl(base)}/verify-email?token=${encodeURIComponent(token)}\n\nThis link expires in 24 hours. If you did not request an account, ignore it.\n\nLeadPulse checks form visibility, not enquiry delivery.`
 };
}
export function welcomeEmailMessage(base){
 return {
  subject:'Welcome to LeadPulse — set up your first website',
  text:`Your LeadPulse email is verified.\n\n1. Sign in at ${baseUrl(base)}/login.\n2. Add one HTTPS form page you own or are authorized to test.\n3. Publish your one-time verification tag and verify ownership.\n4. Choose the form selector and run your first check once monitoring is enabled.\n\nYour free trial lasts seven days. No payment card is needed.\n\nChecks confirm whether the expected form is visible; they do not prove that enquiries arrive in an inbox.`
 };
}
export function passwordResetEmailMessage(base,token){
 return {
  subject:'Reset your LeadPulse password',
  text:`Reset your password using this private link:\n\n${baseUrl(base)}/reset-password?token=${encodeURIComponent(token)}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this message.`
 };
}
export function trialReminderEmailMessage(base,daysRemaining){
 return {
  subject:`LeadPulse trial: ${daysRemaining} day${daysRemaining===1?'':'s'} remaining`,
  text:`Your LeadPulse free trial has ${daysRemaining} day${daysRemaining===1?'':'s'} remaining.\n\nView your website monitoring status at ${baseUrl(base)}/dashboard.\n\nMonitoring stops after trial expiry. Paid checkout is not available yet, and no charge will be made.`
 };
}
