import { describe, expect, it } from 'vitest';
import { assertExplicitEligibility, buildEligibilityIndex, checkEligibility } from './eligibility-constraints';
import type { CongregationPerson } from './people';

function person(tenantId:string, id:string, enabled:boolean, decidedAt='2026-08-21T10:00:00.000Z'):CongregationPerson {
  return { id, tenantId, displayName:id, active:true, availability:[], eligibility:[{ assignmentTypeId:'reading', enabled, decidedBy:'elder-1', decidedAt }] };
}

describe('eligibility constraints',()=>{
  it('uses only explicit decisions from the requested tenant',()=>{
    const index=buildEligibilityIndex([person('a','p1',true),person('b','p1',false)],'a');
    expect(checkEligibility(index,'a','p1','reading')).toBe(true);
  });
  it('rejects cross-tenant index access',()=>{
    const index=buildEligibilityIndex([person('a','p1',true)],'a');
    expect(()=>checkEligibility(index,'b','p1','reading')).toThrow('Cross-tenant eligibility index access denied');
  });
  it('uses the latest explicit human decision',()=>{
    const p=person('a','p1',true,'2026-08-20T10:00:00.000Z');
    p.eligibility=[...p.eligibility,{assignmentTypeId:'reading',enabled:false,decidedBy:'elder-2',decidedAt:'2026-08-21T10:00:00.000Z'}];
    const index=buildEligibilityIndex([p],'a');
    expect(checkEligibility(index,'a','p1','reading')).toBe(false);
  });
  it('does not infer eligibility when there is no explicit decision',()=>{
    const index=buildEligibilityIndex([{...person('a','p1',true),eligibility:[]}],'a');
    expect(checkEligibility(index,'a','p1','reading')).toBe(false);
    expect(()=>assertExplicitEligibility(index,'a','p1','reading')).toThrow('not explicitly eligible');
  });
  it('returns a runtime-immutable lookup object',()=>{
    const index=buildEligibilityIndex([person('a','p1',true)],'a');
    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.decisions)).toBe(true);
    expect(()=>{(index.decisions as Record<string,boolean>)['x']=true;}).toThrow();
  });
  it('rejects malformed grants instead of coercing values',()=>{
    const p=person('a','p1',true);
    p.eligibility=[{assignmentTypeId:'reading',enabled:'true' as unknown as boolean,decidedBy:'e',decidedAt:'2026-08-21T10:00:00.000Z'}];
    expect(()=>buildEligibilityIndex([p],'a')).toThrow('must be a boolean');
  });
});
