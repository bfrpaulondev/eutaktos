import { describe, expect, it } from 'vitest';
import { createAccessContext } from '@eutaktos/domain';
import { createMigrationLog, createRollbackPlan } from '@eutaktos/application';
import { InMemoryMigrationLogStore } from './migration-log-memory';
const AT='2026-08-21T12:00:00.000Z';
function ctx(tenantId:string,capabilities:readonly ('tenant.manage')[]=['tenant.manage']){return createAccessContext({tenantId,actorId:'actor',capabilities});}
describe('InMemoryMigrationLogStore',()=>{
 it('isolates tenants and returns defensive clones',()=>{const store=new InMemoryMigrationLogStore();const log=createMigrationLog({tenantId:'a',migrationId:'m',startedAt:AT});const plan=createRollbackPlan({tenantId:'a',migrationId:'m',steps:[{type:'delete',internalId:'p1'}]});store.save(ctx('a'),log,plan);expect(store.getLog(ctx('b'),'m')).toBeUndefined();const copy=store.getRollbackPlan(ctx('a'),'m');expect(copy?.steps[0].internalId).toBe('p1');expect(copy).not.toBe(plan);});
 it('rejects cross-tenant writes and missing capability',()=>{const store=new InMemoryMigrationLogStore();const log=createMigrationLog({tenantId:'a',migrationId:'m',startedAt:AT});const plan=createRollbackPlan({tenantId:'a',migrationId:'m',steps:[]});expect(()=>store.save(ctx('b'),log,plan)).toThrow('Cross-tenant');expect(()=>store.getLog(ctx('a',[]),'m')).toThrow('missing capability tenant.manage');});
});
