import { randomBytes } from 'node:crypto';

export function runtimeConfig() {
  const rawUrl=process.env.EUTAKTOS_SUPABASE_URL?.trim();
  const key=process.env.EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!rawUrl||!key) throw new Error('EUTAKTOS_SUPABASE_URL and EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY are required');
  const url=new URL(rawUrl);
  if(url.protocol!=='https:') throw new Error('EUTAKTOS_SUPABASE_URL must use HTTPS');
  return {url:url.toString().replace(/\/$/,''),key};
}

export async function rpc(name,body){
  const {url,key}=runtimeConfig();
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{Accept:'application/json','Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
    body:JSON.stringify(body),
  });
  if(!response.ok) throw new Error(`Database operation failed (${response.status})`);
  if(response.status===204)return undefined;
  const text=await response.text();
  return text?JSON.parse(text):undefined;
}

export function arg(name){
  const index=process.argv.indexOf(`--${name}`);
  if(index<0)return undefined;
  const value=process.argv[index+1];
  if(!value||value.startsWith('--'))throw new Error(`--${name} requires a value`);
  return value;
}
export function hasFlag(name){return process.argv.includes(`--${name}`);}
export function requiredArg(name){const value=arg(name)?.trim();if(!value)throw new Error(`--${name} is required`);return value;}
export function sessionId(){return `session-${randomBytes(32).toString('base64url')}`;}
