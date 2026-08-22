declare const process: { env: Record<string,string|undefined> };

import { DatabaseNotConfiguredError, type OutboxRow } from '../_db';
import { runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { requireWorkerAuthentication } from '../_worker-auth';

interface ProviderConfig { url:string; token:string }
const DELIVERY_PAYLOAD_FIELDS = Object.freeze(['deliveryId','recipientId','channel','templateKey','locale'] as const);
const DELIVERY_CHANNELS = new Set(['in-app','push','email','whatsapp']);

function providerConfig():ProviderConfig|undefined{
  const rawUrl=process.env.EUTAKTOS_NOTIFICATION_PROVIDER_URL?.trim();
  const token=process.env.EUTAKTOS_NOTIFICATION_PROVIDER_TOKEN?.trim();
  if(!rawUrl&&!token)return undefined;
  if(!rawUrl||!token) throw new DatabaseNotConfiguredError();
  const url=new URL(rawUrl);
  if(url.protocol!=='https:') throw new DatabaseNotConfiguredError();
  return Object.freeze({url:url.toString(),token});
}

/**
 * External delivery is allowed only when the outbox event carries the minimal,
 * privacy-bounded K47 delivery envelope. A bare NotificationIntentQueued event
 * is a domain intent, not proof that a provider has enough information to send.
 */
export function isDeliverableNotificationEvent(event:OutboxRow):boolean{
  if(event.event_type!=='NotificationIntentQueued'||event.schema_version!==1)return false;
  for(const field of DELIVERY_PAYLOAD_FIELDS){
    const value=event.payload[field];
    if(typeof value!=='string'||!value.trim())return false;
  }
  return DELIVERY_CHANNELS.has(String(event.payload.channel));
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
    // The database claim is already payload-guarded. Keep the same check here
    // as defense in depth if a migration/configuration drifts.
    const events=await database.claimNotificationOutbox(25);
    let delivered=0,failed=0,invalid=0;
    for(const event of events){
      if(!isDeliverableNotificationEvent(event)){
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
