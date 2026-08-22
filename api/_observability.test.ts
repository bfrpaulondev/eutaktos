import { describe, expect, it } from 'vitest';
import { attachCorrelationId, correlationIdForRequest } from './_observability';
import type { ApiRequest, ApiResponse } from './_types';

function responseWith(headers:Record<string,string>):ApiResponse {
  return {
    status:()=>responseWith(headers),
    setHeader:(name,value)=>{headers[name]=typeof value==='string'?value:[...value].join(', ');},
    json:()=>undefined,
    end:()=>undefined,
  };
}

describe('API correlation ids',()=>{
  it('preserves a valid operator correlation id',()=>{
    const request:ApiRequest={method:'GET',headers:{'x-correlation-id':'req-123:abc'},query:{}};
    expect(correlationIdForRequest(request)).toBe('req-123:abc');
  });
  it('replaces unsafe free-form values instead of reflecting them',()=>{
    const request:ApiRequest={method:'GET',headers:{'x-correlation-id':'person@example.com / secret'},query:{}};
    const id=correlationIdForRequest(request);
    expect(id).not.toContain('person@example.com');
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it('attaches one server correlation id to request and response',()=>{
    const request:ApiRequest={method:'GET',headers:{},query:{}};
    const headers:Record<string,string>={};
    const id=attachCorrelationId(request,responseWith(headers));
    expect(request.correlationId).toBe(id);
    expect(headers['X-Correlation-Id']).toBe(id);
  });
});
