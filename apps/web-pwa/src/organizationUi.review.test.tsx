import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createAvailabilityApi, parsePeriod, type AvailabilityApi } from './lib/availabilityApi';
import { HouseholdsSection } from './HouseholdsSection';
import { ServiceGroupsSection } from './ServiceGroupsSection';
import { ResponsibilitiesSection } from './ResponsibilitiesSection';
import { AwayPeriodsSection } from './AwayPeriodsSection';
import type { HouseholdsApi } from './lib/householdsApi';
import type { ServiceGroupsApi } from './lib/serviceGroupsApi';
import type { ResponsibilitiesApi } from './lib/responsibilitiesApi';

function response(body:unknown,status=200):Response{return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}

describe('reviewed availability API',()=>{
 it('rejects unknown server fields and impossible periods',()=>{
  expect(()=>parsePeriod({id:'a',startsAt:'2026-08-21',endsAt:'2026-08-22',tenantId:'secret'})).toThrow('Invalid availability API response');
  expect(()=>parsePeriod({id:'a',startsAt:'2026-08-22',endsAt:'2026-08-21'})).toThrow('Availability end must be after start');
 });
 it('minimizes writes and validates range before network',async()=>{
  const fetcher=vi.fn(async()=>response({id:'a',startsAt:'2026-08-21',endsAt:'2026-08-22',reasonCode:'away'}));
  const api=createAvailabilityApi(fetcher as typeof fetch);
  await api.add('person/1',{startsAt:'2026-08-21',endsAt:'2026-08-22',reasonCode:'away',tenantId:'evil'} as never);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({startsAt:'2026-08-21',endsAt:'2026-08-22',reasonCode:'away'});
  expect(String(fetcher.mock.calls[0][0])).toContain('person%2F1');
  await expect(api.add('p',{startsAt:'2026-08-22',endsAt:'2026-08-21'})).rejects.toThrow('Availability end must be after start');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('hides 5xx details',async()=>{const fetcher=vi.fn(async()=>response({error:'internal stack'},500));await expect(createAvailabilityApi(fetcher as typeof fetch).list('p')).rejects.toThrow('Availability API request failed (500)');});
});

describe('reviewed organization UI',()=>{
 const households:HouseholdsApi={list:async()=>[],get:async()=>({id:'h',name:'H',memberIds:[]}),create:async i=>({id:'h',...i}),update:async(id,i)=>({id,name:i.name??'H',memberIds:i.memberIds??[]}),delete:async()=>{}};
 const groups:ServiceGroupsApi={list:async()=>[],get:async()=>({id:'g',name:'G',memberIds:[]}),create:async i=>({id:'g',...i}),update:async(id,i)=>({id,name:i.name??'G',memberIds:i.memberIds??[],...(typeof i.overseerId==='string'?{overseerId:i.overseerId}:{}),...(typeof i.assistantId==='string'?{assistantId:i.assistantId}:{})}),delete:async()=>{}};
 const responsibilities:ResponsibilitiesApi={list:async()=>[],get:async()=>({id:'r',personId:'p',responsibilityKey:'sound',startsAt:'2026-08-21'}),assign:async i=>({id:'r',...i}),end:async(id,i)=>({id,personId:'p',responsibilityKey:'sound',startsAt:'2026-08-21',endsAt:i.endsAt})};
 const availability:AvailabilityApi={list:async()=>[],add:async(_p,i)=>({id:'a',...i}),remove:async()=>{}};
 it('renders localized real management surfaces without placeholder data',()=>{
  expect(renderToStaticMarkup(<HouseholdsSection locale="pt-PT" api={households}/>)).toContain('Agregados familiares');
  expect(renderToStaticMarkup(<ServiceGroupsSection locale="en" api={groups}/>)).toContain('Service groups');
  const responsibilityMarkup=renderToStaticMarkup(<ResponsibilitiesSection locale="es" api={responsibilities}/>);
  expect(responsibilityMarkup).toContain('Responsabilidades');
  expect(responsibilityMarkup).not.toContain('anciano');
  expect(renderToStaticMarkup(<AwayPeriodsSection locale="en" personId="p" api={availability}/>)).toContain('Away periods');
 });
});
