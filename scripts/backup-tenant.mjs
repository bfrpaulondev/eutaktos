import { createCipheriv, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { rpc, requiredArg } from './eutaktos-ops-lib.mjs';

function backupKey(){
  const raw=process.env.EUTAKTOS_BACKUP_KEY_BASE64?.trim();
  if(!raw)throw new Error('EUTAKTOS_BACKUP_KEY_BASE64 is required');
  const key=Buffer.from(raw,'base64');
  if(key.length!==32)throw new Error('EUTAKTOS_BACKUP_KEY_BASE64 must decode to exactly 32 bytes');
  return key;
}

const tenantId=requiredArg('tenant');
const output=requiredArg('out');
const snapshot=await rpc('eutaktos_export_tenant',{p_tenant_id:tenantId});
if(!snapshot||snapshot.tenantId!==tenantId||snapshot.schemaVersion!==1)throw new Error('Database returned an invalid tenant snapshot');

const iv=randomBytes(12);
const cipher=createCipheriv('aes-256-gcm',backupKey(),iv);
const plaintext=Buffer.from(JSON.stringify(snapshot),'utf8');
const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
const envelope={
  format:'eutaktos-encrypted-backup',
  version:1,
  algorithm:'AES-256-GCM',
  iv:iv.toString('base64'),
  tag:cipher.getAuthTag().toString('base64'),
  ciphertext:ciphertext.toString('base64'),
};
await writeFile(output,JSON.stringify(envelope),'utf8');
console.log(`Encrypted backup written to ${output}. Sessions are deliberately excluded.`);
