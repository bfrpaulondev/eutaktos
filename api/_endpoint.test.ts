declare const process:{env:Record<string,string|undefined>};

import { afterEach, describe, expect, it } from 'vitest';
import { assertRequestEnvelope, assertTrustedMutation, BadRequestError, CsrfError, PayloadTooLargeError } from './_endpoint';
import type { ApiRequest } from './_types';

const original=process.env.EUTAKTOS_PUBLIC_ORIGIN;
afterEach(()=>{ if(original===undefined) delete process.env.EUTAKTOS_PUBLIC_ORIGIN; else process.env.EUTAKTOS_PUBLIC_ORIGIN=original; });
function request(headers:Record<string,string>, body?:unknown):ApiRequest{return {method:'POST',headers,query:{},body};}

describe('mutation origin boundary',()=>{
  it('accepts the configured same-origin browser request',()=>{
    process.env.EUTAKTOS_PUBLIC_ORIGIN='https://eutaktos.example';
    expect(()=>assertTrustedMutation(request({origin:'https://eutaktos.example','sec-fetch-site':'same-origin'}))).not.toThrow();
  });
  it('rejects a cross-site origin even with a valid session elsewhere',()=>{
    process.env.EUTAKTOS_PUBLIC_ORIGIN='https://eutaktos.example';
    expect(()=>assertTrustedMutation(request({origin:'https://evil.example','sec-fetch-site':'cross-site'}))).toThrow(CsrfError);
  });
  it('rejects missing browser origin metadata',()=>{
    process.env.EUTAKTOS_PUBLIC_ORIGIN='https://eutaktos.example';
    expect(()=>assertTrustedMutation(request({}))).toThrow(CsrfError);
  });
});

describe('request envelope limits',()=>{
  it('rejects an oversized declared payload before business logic',()=>{
    expect(()=>assertRequestEnvelope(request({'content-length':String(64*1024+1)}))).toThrow(PayloadTooLargeError);
  });
  it('rejects an oversized parsed payload even when Content-Length is absent',()=>{
    expect(()=>assertRequestEnvelope(request({}, {value:'x'.repeat(70*1024)}))).toThrow(PayloadTooLargeError);
  });
  it('rejects malformed Content-Length instead of coercing it',()=>{
    expect(()=>assertRequestEnvelope(request({'content-length':'12.5'}))).toThrow(BadRequestError);
  });
  it('accepts a normal small JSON payload',()=>{
    expect(()=>assertRequestEnvelope(request({'content-length':'17'}, {name:'Example'}))).not.toThrow();
  });
  it('allows an explicitly larger endpoint limit without weakening the default limit',()=>{
    const body={value:'x'.repeat(128*1024)};
    expect(()=>assertRequestEnvelope(request({},body))).toThrow(PayloadTooLargeError);
    expect(()=>assertRequestEnvelope(request({},body),{maxBodyBytes:256*1024})).not.toThrow();
  });
  it('never permits endpoint limits above the absolute server safety ceiling',()=>{
    expect(()=>assertRequestEnvelope(request({}),{maxBodyBytes:7*1024*1024})).toThrow('Invalid request body limit');
  });
});
