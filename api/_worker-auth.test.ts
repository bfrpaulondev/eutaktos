declare const process:{env:Record<string,string|undefined>};

import { afterEach, describe, expect, it } from 'vitest';
import { AuthenticationError } from './_auth';
import { DatabaseNotConfiguredError } from './_db';
import { requireWorkerAuthentication } from './_worker-auth';
import type { ApiRequest } from './_types';

const original=process.env.EUTAKTOS_WORKER_TOKEN;
afterEach(()=>{if(original===undefined)delete process.env.EUTAKTOS_WORKER_TOKEN;else process.env.EUTAKTOS_WORKER_TOKEN=original;});
function request(authorization?:string):ApiRequest{return{method:'POST',headers:authorization?{authorization}:{},query:{}};}

describe('worker authentication',()=>{
  it('fails closed when the server token is not configured',async()=>{
    delete process.env.EUTAKTOS_WORKER_TOKEN;
    await expect(requireWorkerAuthentication(request('Bearer anything'))).rejects.toBeInstanceOf(DatabaseNotConfiguredError);
  });
  it('rejects missing and malformed bearer authorization',async()=>{
    process.env.EUTAKTOS_WORKER_TOKEN='worker-secret-value';
    await expect(requireWorkerAuthentication(request())).rejects.toBeInstanceOf(AuthenticationError);
    await expect(requireWorkerAuthentication(request('Basic worker-secret-value'))).rejects.toBeInstanceOf(AuthenticationError);
  });
  it('rejects the wrong bearer token',async()=>{
    process.env.EUTAKTOS_WORKER_TOKEN='worker-secret-value';
    await expect(requireWorkerAuthentication(request('Bearer wrong-value'))).rejects.toBeInstanceOf(AuthenticationError);
  });
  it('accepts only the configured bearer token',async()=>{
    process.env.EUTAKTOS_WORKER_TOKEN='worker-secret-value';
    await expect(requireWorkerAuthentication(request('Bearer worker-secret-value'))).resolves.toBeUndefined();
  });
});
