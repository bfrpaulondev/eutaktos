import { rpc, requiredArg, sessionId } from './eutaktos-ops-lib.mjs';

const capabilities=[];
for(let i=0;i<process.argv.length;i+=1){
  if(process.argv[i]==='--capability'){
    const value=process.argv[i+1]?.trim();
    if(!value||value.startsWith('--'))throw new Error('--capability requires a value');
    capabilities.push(value);
  }
}
if(capabilities.length===0)throw new Error('At least one --capability is required; capabilities are never granted implicitly');
if(new Set(capabilities).size!==capabilities.length)throw new Error('Duplicate capabilities are not allowed');

const tenantId=requiredArg('tenant');
const actorId=requiredArg('actor');
const displayName=requiredArg('display-name');
const locale=requiredArg('locale');
const token=sessionId();

await rpc('eutaktos_bootstrap_pilot',{
  p_tenant_id:tenantId,
  p_actor_id:actorId,
  p_display_name:displayName,
  p_locale:locale,
  p_capabilities:capabilities,
  p_session_id:token,
  p_now:new Date().toISOString(),
});

console.log('Pilot tenant created. This session token is sensitive and is shown once:');
console.log(`__Host-eutaktos_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`);
