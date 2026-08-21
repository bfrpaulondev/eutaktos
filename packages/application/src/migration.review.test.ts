import { describe, expect, it } from 'vitest';
import { createMigrationSchema, normalizeMigrationRow, validateMigrationSchema } from './migration-schema';
import { importPeopleCsv } from './csv-import';
import { exportPeopleCsv } from './csv-export';
import { parsePortableJson, serializePortableJson } from './portable-json';
import { previewMigration } from './migration-preview';
import { appendMigrationOperation, createMigrationLog, createRollbackPlan, finishMigration } from './migration-log';
const AT='2026-08-21T12:00:00.000Z';

describe('canonical migration schema',()=>{
 it('normalizes and rejects malformed locale/unknown persisted fields',()=>{expect(normalizeMigrationRow({externalId:' x ',displayName:' Jane   Doe ',active:'yes',preferredLocale:'pt-PT'})).toMatchObject({externalId:'x',displayName:'Jane Doe',active:true,preferredLocale:'pt-PT',isValid:true});expect(normalizeMigrationRow({externalId:'x',displayName:'Jane',active:true,preferredLocale:'bad_locale'}).isValid).toBe(false);expect(()=>validateMigrationSchema({version:1,exportedAt:AT,rows:[],tenantId:'injected'})).toThrow('unknown fields');});
});

describe('secure CSV import/export',()=>{
 it('parses RFC4180-style quotes, commas and embedded newlines',()=>{const result=importPeopleCsv('externalId,displayName,active,preferredLocale\r\n1,"Doe,\nJane",true,pt-PT\r\n',AT);expect(result.schema.rows[0]).toMatchObject({externalId:'1',displayName:'Doe, Jane',isValid:true});});
 it('rejects malformed quotes and raw spreadsheet formulas',()=>{expect(()=>importPeopleCsv('externalId,displayName,active\n1,"broken,true',AT)).toThrow('Unterminated');const result=importPeopleCsv('externalId,displayName,active\n1,=1+1,true\n',AT);expect(result.schema.rows[0].isValid).toBe(false);});
 it('exports fixed columns, neutralizes formulas and round-trips safely',()=>{const schema=createMigrationSchema([{externalId:'1',displayName:'=SUM(A1:A2)',active:true,preferredLocale:'en'}],AT);const csv=exportPeopleCsv(schema.rows);expect(csv.split('\r\n')[0]).toBe('externalId,displayName,active,preferredLocale');expect(csv).toContain("'=SUM");const imported=importPeopleCsv(csv,AT);expect(imported.schema.rows[0]).toMatchObject({displayName:'=SUM(A1:A2)',isValid:true});});
});

describe('portable JSON',()=>{
 it('is deterministic when timestamp is explicit and rejects unknown/sensitive fields',()=>{const input={sourceTenantId:'tenant-a',people:[{externalId:'1',displayName:'Jane',active:true}]};expect(serializePortableJson(input,AT)).toBe(serializePortableJson(input,AT));expect(()=>parsePortableJson(JSON.stringify({format:'eutaktos-portable',version:1,exportedAt:AT,sourceTenantId:'t',people:[{externalId:'1',displayName:'Jane',active:true,sessionToken:'x'}]}))).toThrow('unknown fields');});
 it('rejects duplicate external ids',()=>{expect(()=>parsePortableJson(JSON.stringify({format:'eutaktos-portable',version:1,exportedAt:AT,sourceTenantId:'t',people:[{externalId:'1',displayName:'A',active:true},{externalId:'1',displayName:'B',active:true}]}))).toThrow('Duplicate externalId');});
});

describe('migration preview',()=>{
 it('detects duplicate incoming ids and name collisions and returns frozen source clones',()=>{const rows=createMigrationSchema([{externalId:'x',displayName:'Jane',active:true},{externalId:'x',displayName:'Other',active:true},{externalId:'y',displayName:'Existing',active:true}],AT).rows;const preview=previewMigration(rows,[{id:'p1',externalId:'z',displayName:'Existing',active:true}]);expect(preview.counts.conflict).toBe(3);expect(Object.isFrozen(preview.items[0].source)).toBe(true);});
 it('classifies create/skip/update deterministically',()=>{const rows=createMigrationSchema([{externalId:'a',displayName:'A',active:true},{externalId:'b',displayName:'B2',active:true},{externalId:'c',displayName:'C',active:true}],AT).rows;const preview=previewMigration(rows,[{id:'1',externalId:'a',displayName:'A',active:true},{id:'2',externalId:'b',displayName:'B',active:true}]);expect(preview.counts).toEqual({create:1,update:1,skip:1,conflict:0,error:0});});
});

describe('migration log primitives',()=>{
 it('uses explicit timestamps, enforces lifecycle and keeps log metadata privacy-minimized',()=>{let log=createMigrationLog({tenantId:'t',migrationId:'m',startedAt:AT});log=appendMigrationOperation(log,{operationId:'op1',kind:'create',internalId:'p1',executedAt:AT});expect(JSON.stringify(log)).not.toContain('displayName');log=finishMigration(log,'completed',AT);expect(()=>appendMigrationOperation(log,{operationId:'op2',kind:'create',internalId:'p2',executedAt:AT})).toThrow('not running');});
 it('keeps reversible snapshots in the separate rollback plan',()=>{const plan=createRollbackPlan({tenantId:'t',migrationId:'m',steps:[{type:'restore',internalId:'p1',restore:{externalId:'x',displayName:'Jane',active:true}}]});expect(plan.steps[0].restore?.displayName).toBe('Jane');expect(Object.isFrozen(plan.steps)).toBe(true);});
});
