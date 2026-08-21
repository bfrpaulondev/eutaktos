type ErrorBody={error?:unknown};
export type AvailabilityReasonCode='away'|'unavailable'|'other';
export interface AvailabilityPeriodDto{id:string;startsAt:string;endsAt:string;reasonCode?:AvailabilityReasonCode}
export interface CreateAvailabilityPayload{startsAt:string;endsAt:string;reasonCode?:AvailabilityReasonCode}
export interface AvailabilityApi{list(personId:string,signal?:AbortSignal):Promise<readonly AvailabilityPeriodDto[]>;add(personId:string,input:CreateAvailabilityPayload,signal?:AbortSignal):Promise<AvailabilityPeriodDto>;remove(personId:string,periodId:string,signal?:AbortSignal):Promise<void>}
const INVALID='Invalid availability API response';
function validInstant(v:string):boolean{return Number.isFinite(Date.parse(v));}
function validateRange(startsAt:string,endsAt:string):void{if(!validInstant(startsAt)||!validInstant(endsAt))throw new Error('Invalid availability date');if(Date.parse(endsAt)<=Date.parse(startsAt))throw new Error('Availability end must be after start');}
export function parsePeriod(value:unknown):AvailabilityPeriodDto{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(INVALID);const c=value as Record<string,unknown>;const allowed=new Set(['id','startsAt','endsAt','reasonCode']);if(Object.keys(c).some(k=>!allowed.has(k)))throw new Error(INVALID);if(typeof c.id!=='string'||typeof c.startsAt!=='string'||typeof c.endsAt!=='string')throw new Error(INVALID);validateRange(c.startsAt,c.endsAt);if(c.reasonCode!==undefined&&c.reasonCode!=='away'&&c.reasonCode!=='unavailable'&&c.reasonCode!=='other')throw new Error(INVALID);return Object.freeze({id:c.id,startsAt:c.startsAt,endsAt:c.endsAt,...(c.reasonCode!==undefined?{reasonCode:c.reasonCode as AvailabilityReasonCode}:{})});}
export function parseList(value:unknown):readonly AvailabilityPeriodDto[]{if(!Array.isArray(value))throw new Error(INVALID);return Object.freeze(value.map(parsePeriod));}
async function json(r:Response):Promise<unknown>{try{return await r.json();}catch{throw new Error('Invalid API response');}}
function err(status:number,body:unknown):Error{if(status>=500)return new Error(`Availability API request failed (${status})`);const m=body&&typeof body==='object'?(body as ErrorBody).error:undefined;return new Error(typeof m==='string'&&m.length>0&&m.length<=300?m:`Availability API request failed (${status})`);}
function base(personId:string):string{return`/api/people/${encodeURIComponent(personId)}/availability`;}
export function createAvailabilityApi(fetcher:typeof fetch=fetch):AvailabilityApi{return{
async list(personId,signal){const r=await fetcher(base(personId),{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parseList(b);},
async add(personId,input,signal){validateRange(input.startsAt,input.endsAt);const payload:CreateAvailabilityPayload={startsAt:input.startsAt,endsAt:input.endsAt,...(input.reasonCode!==undefined?{reasonCode:input.reasonCode}:{})};const r=await fetcher(base(personId),{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(payload),signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parsePeriod(b);},
async remove(personId,periodId,signal){const r=await fetcher(`${base(personId)}/${encodeURIComponent(periodId)}`,{method:'DELETE',credentials:'same-origin',signal});if(!r.ok){const b=await json(r).catch(()=>undefined);throw err(r.status,b);}},
};}
export const availabilityApi=createAvailabilityApi();
