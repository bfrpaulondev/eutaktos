import { describe, expect, it, vi } from 'vitest';
import { createHouseholdsApi, parseHouseholdList } from './householdsApi';
import { createServiceGroupsApi, parseServiceGroupList } from './serviceGroupsApi';
import { createResponsibilitiesApi, parseResponsibilityList } from './responsibilitiesApi';

function response(body: unknown, status=200): Response { return new Response(JSON.stringify(body), { status, headers:{'Content-Type':'application/json'} }); }

describe('reviewed organization API boundaries',()=>{
  it('rejects privacy-boundary widening from server responses',()=>{
    expect(()=>parseHouseholdList([{id:'h1',name:'H',memberIds:[],tenantId:'secret'}])).toThrow('Invalid Households API response');
    expect(()=>parseServiceGroupList([{id:'g1',name:'G',memberIds:[],tenantId:'secret'}])).toThrow('Invalid Service Groups API response');
    expect(()=>parseResponsibilityList([{id:'r1',personId:'p1',responsibilityKey:'custom-duty',startsAt:'2026-01-01',assignedBy:'hidden'}])).toThrow('Invalid Responsibilities API response');
  });

  it('minimizes household writes even for adversarial runtime objects',async()=>{
    const fetcher=vi.fn(async (_url:RequestInfo|URL, init?:RequestInit)=>response({id:'h1',name:'H',memberIds:[]}));
    const api=createHouseholdsApi(fetcher as typeof fetch);
    await api.create({name:'H',memberIds:[],tenantId:'evil',actorId:'evil'} as never);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({name:'H',memberIds:[]});
  });

  it('minimizes service-group writes even for adversarial runtime objects',async()=>{
    const fetcher=vi.fn(async (_url:RequestInfo|URL, init?:RequestInit)=>response({id:'g1',name:'G',memberIds:[]}));
    const api=createServiceGroupsApi(fetcher as typeof fetch);
    await api.create({name:'G',memberIds:[],tenantId:'evil',capabilities:['tenant.manage']} as never);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({name:'G',memberIds:[]});
  });

  it('minimizes responsibility writes even for adversarial runtime objects',async()=>{
    const fetcher=vi.fn(async (_url:RequestInfo|URL, init?:RequestInit)=>response({id:'r1',personId:'p1',responsibilityKey:'custom-duty',startsAt:'2026-01-01'}));
    const api=createResponsibilitiesApi(fetcher as typeof fetch);
    await api.assign({personId:'p1',responsibilityKey:'custom-duty',startsAt:'2026-01-01',tenantId:'evil',assignedBy:'evil'} as never);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({personId:'p1',responsibilityKey:'custom-duty',startsAt:'2026-01-01'});
  });

  it('never exposes server-provided 5xx details',async()=>{
    const fetcher=vi.fn(async()=>response({error:'database password leaked'},500));
    await expect(createHouseholdsApi(fetcher as typeof fetch).list()).rejects.toThrow('Households API request failed (500)');
    await expect(createServiceGroupsApi(fetcher as typeof fetch).list()).rejects.toThrow('Service Groups API request failed (500)');
    await expect(createResponsibilitiesApi(fetcher as typeof fetch).list()).rejects.toThrow('Responsibilities API request failed (500)');
  });

  it('uses same-origin credentials on reads',async()=>{
    const fetcher=vi.fn(async()=>response([]));
    await createHouseholdsApi(fetcher as typeof fetch).list();
    expect(fetcher.mock.calls[0][1]?.credentials).toBe('same-origin');
  });
});
