type ErrorBody={error?:unknown};
const INVALID='Invalid Responsibilities API response';
const DATE_ONLY=/^\d{4}-\d{2}-\d{2}$/;
export interface ResponsibilityDto{id:string;personId:string;responsibilityKey:string;startsAt:string;endsAt?:string}
export interface AssignResponsibilityPayload{personId:string;responsibilityKey:string;startsAt:string;endsAt?:string}
export interface EndResponsibilityPayload{endsAt:string}
export interface ResponsibilitiesApi{list(signal?:AbortSignal):Promise<readonly ResponsibilityDto[]>;get(id:string,signal?:AbortSignal):Promise<ResponsibilityDto>;assign(input:AssignResponsibilityPayload,signal?:AbortSignal):Promise<ResponsibilityDto>;end(id:string,input:EndResponsibilityPayload,signal?:AbortSignal):Promise<ResponsibilityDto>}
function parse(value:unknown):ResponsibilityDto{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(INVALID);const c=value as Record<string,unknown>;const allowed=new Set(['id','personId','responsibilityKey','startsAt','endsAt']);if(Object.keys(c).some(k=>!allowed.has(k)))throw new Error(INVALID);if(typeof c.id!=='string'||typeof c.personId!=='string'||typeof c.responsibilityKey!=='string'||typeof c.startsAt!=='string'||(c.endsAt!==undefined&&typeof c.endsAt!=='string'))throw new Error(INVALID);return Object.freeze({id:c.id,personId:c.personId,responsibilityKey:c.responsibilityKey,startsAt:c.startsAt,...(c.endsAt!==undefined?{endsAt:c.endsAt as string}:{})});}
export function parseResponsibilityList(value:unknown):readonly ResponsibilityDto[]{if(!Array.isArray(value))throw new Error(INVALID);return Object.freeze(value.map(parse));}
async function json(r:Response):Promise<unknown>{try{return await r.json();}catch{throw new Error('Invalid API response');}}
function err(status:number,body:unknown):Error{if(status>=500)return new Error(`Responsibilities API request failed (${status})`);const m=body&&typeof body==='object'?(body as ErrorBody).error:undefined;return new Error(typeof m==='string'&&m.length>0&&m.length<=300?m:`Responsibilities API request failed (${status})`);}
function startInstant(value:string):string{return DATE_ONLY.test(value)?`${value}T00:00:00.000Z`:value;}
function scheduledEndInstant(value:string):string{return DATE_ONLY.test(value)?`${value}T23:59:59.999Z`:value;}
function endNowIfDateOnly(value:string):string{return DATE_ONLY.test(value)?new Date().toISOString():value;}
function assignBody(i:AssignResponsibilityPayload):AssignResponsibilityPayload{return{personId:i.personId,responsibilityKey:i.responsibilityKey,startsAt:startInstant(i.startsAt),...(i.endsAt!==undefined?{endsAt:scheduledEndInstant(i.endsAt)}:{})};}
export function createResponsibilitiesApi(fetcher:typeof fetch=fetch):ResponsibilitiesApi{return{
async list(signal){const r=await fetcher('/api/responsibilities',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parseResponsibilityList(b);},
async get(id,signal){const r=await fetcher(`/api/responsibilities/${encodeURIComponent(id)}`,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
async assign(input,signal){const r=await fetcher('/api/responsibilities',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(assignBody(input)),signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
async end(id,input,signal){const r=await fetcher(`/api/responsibilities/${encodeURIComponent(id)}/end`,{method:'PUT',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({endsAt:endNowIfDateOnly(input.endsAt)}),signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
};}
export const responsibilitiesApi=createResponsibilitiesApi();