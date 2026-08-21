type ErrorBody = { error?: unknown };
const INVALID = 'Invalid Service Groups API response';

export interface ServiceGroupDto { id: string; name: string; memberIds: readonly string[]; overseerId?: string; assistantId?: string }
export interface CreateServiceGroupPayload { name: string; memberIds: string[]; overseerId?: string; assistantId?: string }
export interface UpdateServiceGroupPayload { name?: string; memberIds?: string[]; overseerId?: string | null; assistantId?: string | null }
export interface ServiceGroupsApi {
  list(signal?: AbortSignal): Promise<readonly ServiceGroupDto[]>;
  get(serviceGroupId: string, signal?: AbortSignal): Promise<ServiceGroupDto>;
  create(input: CreateServiceGroupPayload, signal?: AbortSignal): Promise<ServiceGroupDto>;
  update(serviceGroupId: string, input: UpdateServiceGroupPayload, signal?: AbortSignal): Promise<ServiceGroupDto>;
  delete(serviceGroupId: string, signal?: AbortSignal): Promise<void>;
}

function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID); return value as Record<string, unknown>; }
function exact(c: Record<string, unknown>): void { const allowed = new Set(['id','name','memberIds','overseerId','assistantId']); if (Object.keys(c).some(k => !allowed.has(k))) throw new Error(INVALID); }
function parse(value: unknown): ServiceGroupDto {
  const c = record(value); exact(c);
  if (typeof c.id !== 'string' || typeof c.name !== 'string' || !Array.isArray(c.memberIds) || !c.memberIds.every(x => typeof x === 'string')) throw new Error(INVALID);
  if (c.overseerId !== undefined && typeof c.overseerId !== 'string') throw new Error(INVALID);
  if (c.assistantId !== undefined && typeof c.assistantId !== 'string') throw new Error(INVALID);
  return Object.freeze({ id:c.id, name:c.name, memberIds:Object.freeze([...c.memberIds] as string[]), ...(c.overseerId !== undefined ? { overseerId:c.overseerId as string } : {}), ...(c.assistantId !== undefined ? { assistantId:c.assistantId as string } : {}) });
}
export function parseServiceGroupList(value: unknown): readonly ServiceGroupDto[] { if (!Array.isArray(value)) throw new Error(INVALID); return Object.freeze(value.map(parse)); }
async function json(r: Response): Promise<unknown> { try { return await r.json(); } catch { throw new Error('Invalid API response'); } }
function err(status:number, body:unknown): Error { if(status>=500) return new Error(`Service Groups API request failed (${status})`); const m=body&&typeof body==='object'?(body as ErrorBody).error:undefined; return new Error(typeof m==='string'&&m.length<=300&&m.length>0?m:`Service Groups API request failed (${status})`); }
function createBody(i:CreateServiceGroupPayload):CreateServiceGroupPayload { return { name:i.name, memberIds:[...i.memberIds], ...(i.overseerId!==undefined?{overseerId:i.overseerId}:{}), ...(i.assistantId!==undefined?{assistantId:i.assistantId}:{}) }; }
function updateBody(i:UpdateServiceGroupPayload):UpdateServiceGroupPayload { return { ...(i.name!==undefined?{name:i.name}:{}), ...(i.memberIds!==undefined?{memberIds:[...i.memberIds]}:{}), ...(i.overseerId!==undefined?{overseerId:i.overseerId}:{}), ...(i.assistantId!==undefined?{assistantId:i.assistantId}:{}) }; }
export function createServiceGroupsApi(fetcher:typeof fetch=fetch):ServiceGroupsApi { return {
  async list(signal){const r=await fetcher('/api/service-groups',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parseServiceGroupList(b);},
  async get(id,signal){const r=await fetcher(`/api/service-groups/${encodeURIComponent(id)}`,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
  async create(input,signal){const r=await fetcher('/api/service-groups',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(createBody(input)),signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
  async update(id,input,signal){const r=await fetcher(`/api/service-groups/${encodeURIComponent(id)}`,{method:'PUT',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(updateBody(input)),signal});const b=await json(r);if(!r.ok)throw err(r.status,b);return parse(b);},
  async delete(id,signal){const r=await fetcher(`/api/service-groups/${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin',signal});if(!r.ok){const b=await json(r).catch(()=>undefined);throw err(r.status,b);}},
}; }
export const serviceGroupsApi=createServiceGroupsApi();
