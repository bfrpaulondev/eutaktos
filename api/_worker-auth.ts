declare const process: { env: Record<string,string|undefined> };

import { header, type ApiRequest } from './_types';
import { AuthenticationError } from './_auth';
import { DatabaseNotConfiguredError } from './_db';

async function digest(value:string):Promise<Uint8Array>{
  return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}
function equal(a:Uint8Array,b:Uint8Array):boolean{
  if(a.length!==b.length)return false;
  let diff=0;
  for(let index=0;index<a.length;index+=1) diff|=(a[index]??0)^(b[index]??0);
  return diff===0;
}
export async function requireWorkerAuthentication(request:ApiRequest):Promise<void>{
  const expected=process.env.EUTAKTOS_WORKER_TOKEN?.trim();
  if(!expected) throw new DatabaseNotConfiguredError();
  const authorization=header(request,'authorization');
  if(!authorization?.startsWith('Bearer ')) throw new AuthenticationError('Unauthorized');
  const received=authorization.slice(7);
  if(!received||!(await equal(await digest(received),await digest(expected)))) throw new AuthenticationError('Unauthorized');
}
