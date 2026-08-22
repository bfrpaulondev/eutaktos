import { createDecipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hasFlag, requiredArg, rpc } from './eutaktos-ops-lib.mjs';

function backupKey(){
  const raw=process.env.EUTAKTOS_BACKUP_KEY_BASE64?.trim();
  if(!raw)throw new Error('EUTAKTOS_BACKUP_KEY_BASE64 is required');
  const key=Buffer.from(raw,'base64');
  if(key.length!==32)throw new Error('EUTAKTOS_BACKUP_KEY_BASE64 must decode to exactly 32 bytes');
  return key;
}
function decode(value,name){
  if(typeof value!=='string'||!value)throw new Error(`Invalid backup ${name}`);
  return Buffer.from(value,'base64');
}

if(!hasFlag('confirm-restore'))throw new Error('Restore is destructive. Re-run with --confirm-restore after verifying the target tenant and backup.');
const tenantId=requiredArg('tenant');
const input=requiredArg('in');
const envelope=JSON.parse(await readFile(input,'utf8'));
if(envelope?.format!=='eutaktos-encrypted-backup'||envelope.version!==1||envelope.algorithm!=='AES-256-GCM')throw new Error('Unsupported backup envelope');
const decipher=createDecipheriv('aes-256-gcm',backupKey(),decode(envelope.iv,'iv'));
decipher.setAuthTag(decode(envelope.tag,'tag'));
const plaintext=Buffer.concat([decipher.update(decode(envelope.ciphertext,'ciphertext')),decipher.final()]);
const snapshot=JSON.parse(plaintext.toString('utf8'));
if(snapshot?.schemaVersion!==1||snapshot.tenantId!==tenantId)throw new Error('Backup tenant does not match --tenant');
await rpc('eutaktos_restore_tenant',{p_tenant_id:tenantId,p_snapshot:snapshot});
console.log(`Tenant ${tenantId} restored transactionally. All pre-existing sessions for this tenant were revoked.`);
