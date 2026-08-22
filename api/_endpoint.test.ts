import { afterEach, describe, expect, it } from 'vitest';
import { assertTrustedMutation, CsrfError } from './_endpoint';

const original=process.env.EUTAKTOS_PUBLIC_ORIGIN;
afterEach(()=>{ if(original===undefined) delete process.env.EUTAKTOS_PUBLIC_ORIGIN; else process.env.EUTAKTOS_PUBLIC_ORIGIN=original; });
function request(headers:Record<string,string>){return {method:'POST',headers,query:{}} as const;}

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
