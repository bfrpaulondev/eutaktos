import type { MigrationLog, RollbackPlan } from '@eutaktos/application';
import { assertCapability, type AccessContext } from '@eutaktos/domain';
function key(tenantId:string,migrationId:string):string{return`${tenantId}\u0000${migrationId}`;}
function cloneLog(log:MigrationLog):Readonly<MigrationLog>{return Object.freeze({...structuredClone(log),operations:Object.freeze(structuredClone([...log.operations]))});}
function clonePlan(plan:RollbackPlan):Readonly<RollbackPlan>{return Object.freeze({...structuredClone(plan),steps:Object.freeze(structuredClone([...plan.steps]))});}
export class InMemoryMigrationLogStore{readonly #logs=new Map<string,Readonly<MigrationLog>>();readonly #plans=new Map<string,Readonly<RollbackPlan>>();
 save(context:AccessContext,log:MigrationLog,plan:RollbackPlan):void{assertCapability(context,'tenant.manage');if(log.tenantId!==context.tenantId||plan.tenantId!==context.tenantId||plan.migrationId!==log.migrationId)throw new Error('Cross-tenant migration access denied');const k=key(context.tenantId,log.migrationId);const nextLog=cloneLog(log);const nextPlan=clonePlan(plan);this.#logs.set(k,nextLog);this.#plans.set(k,nextPlan);}
 getLog(context:AccessContext,migrationId:string):Readonly<MigrationLog>|undefined{assertCapability(context,'tenant.manage');const value=this.#logs.get(key(context.tenantId,migrationId));return value?cloneLog(value):undefined;}
 getRollbackPlan(context:AccessContext,migrationId:string):Readonly<RollbackPlan>|undefined{assertCapability(context,'tenant.manage');const value=this.#plans.get(key(context.tenantId,migrationId));return value?clonePlan(value):undefined;}
 listLogs(context:AccessContext):readonly Readonly<MigrationLog>[] {assertCapability(context,'tenant.manage');return Object.freeze([...this.#logs.values()].filter(log=>log.tenantId===context.tenantId).map(cloneLog).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)||a.migrationId.localeCompare(b.migrationId)));}
}
