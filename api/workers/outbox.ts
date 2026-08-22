declare const process: { env: Record<string,string|undefined> };

import { DatabaseNotConfiguredError, type OutboxRow } from '../_db';
import { runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { requireWorkerAuthentication } from '../_worker-auth';

interface ProviderConfig { url:string; token:string }
function providerConfig():ProviderConfig|undefined{
  const rawUrl=process.env.EUTAKTOS_NOTIFICATION_PROVIDER_URL?.trim();
  const token=process.env.EUTAKTOS_NOTIFICATION_PROVIDER_TOKEN?.trim();
  if(!rawUrl&&!token)return undefined;
  if(!rawUrl||!token) throw new DatabaseNotConfiguredError();
  const url=new URL(rawUrl);
  if(url.protocol!=='https:') throw new DatabaseNotConfiguredError();
  return Object.freeze({url:url.toString(),token});
}
function deliverable(event:OutboxRow):boolean{
  return event.event_type.startsWith('notification.') && event.schema_version===1;
}
async function deliver(config:ProviderConfig,event:OutboxRow):Promise<'delivered'|'rejected'|'unavailable'> {
  try{
    const response=await fetch(config.url,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Accept:'application/json',
        Authorization:`Bearer ${config.token}`,
        'Idempotency-Key':event.id,
      },
      body:JSON.stringify({
        id:event.id,
        type:event.event_type,
        aggregateId:event.aggregate_id,
        occurredAt:event.occurred_at,
        schemaVersion:event.schema_version,
        ...(event.correlation_id?{correlationId:event.correlation_id}:{}),
        payload:event.payload,
      }),
    });
    if(response.ok)return 'delivered';
    return response.status>=400&&response.status<500?'rejected':'unavailable';
  }catch{return 'unavailable';}
}

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='POST'){methodNotAllowed(response,['POST']);return;}
  await runEndpoint(request,response,async database=>{
    await requireWorkerAuthentication(request);
    const provider=providerConfig();
    const events=await database.claimOutbox(25);
    let delivered=0,failed=0,invalid=0;
    for(const event of events){
      if(!deliverable(event)){
        await database.markOutboxFailed(event.tenant_id,event.id,'invalid-event');
        invalid+=1;
        continue;
      }
      if(!provider){
        await database.markOutboxFailed(event.tenant_id,event.id,'provider-unconfigured');
        failed+=1;
        continue;
      }
      const result=await deliver(provider,event);
      if(result==='delivered'){
        await database.markOutboxDelivered(event.tenant_id,event.id,new Date().toISOString());
        delivered+=1;
      }else{
        await database.markOutboxFailed(event.tenant_id,event.id,result==='rejected'?'provider-rejected':'provider-unavailable');
        failed+=1;
      }
    }
    json(response,200,{claimed:events.length,delivered,failed,invalid});
  });
};
export default handler;
