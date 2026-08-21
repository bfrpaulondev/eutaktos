import { describe, expect, it } from 'vitest';
import {
  countPublicTalksBySpeaker,
  lastPublicTalkUseOfOutline,
  orderPublicTalkHistoryByDate,
  previousPublicTalkCombinations,
  publicTalkHistoryBySpeaker,
  publicTalkHistoryInDateRange,
  recordPublicTalkHistory,
} from './public-talk-history';

function record(tenantId:string, id:string, date:string, speakerId='speaker-1', outlineId='outline-1') {
  return recordPublicTalkHistory({
    id, tenantId, speakerId, talkOutlineId:outlineId, congregationId:'cong-1', date,
    type:'local', state:'completed', recordedAt:`${date}T12:00:00.000Z`, weekendMeetingId:`wm-${id}`,
  });
}

describe('public talk history',()=>{
  it('creates immutable append-only records',()=>{
    const value=record('a','1','2026-08-01');
    expect(Object.isFrozen(value)).toBe(true);
    expect(value.tenantId).toBe('a');
  });

  it('scopes speaker history by tenant even when ids are identical',()=>{
    const values=[record('a','1','2026-08-01'),record('b','2','2026-08-10')];
    const result=publicTalkHistoryBySpeaker(values,'a','speaker-1');
    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('a');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not let another tenant change last-use results',()=>{
    const values=[record('a','1','2026-08-01'),record('b','2','2026-12-31')];
    expect(lastPublicTalkUseOfOutline(values,'a','outline-1')).toBe('2026-08-01');
  });

  it('scopes date-range queries by tenant',()=>{
    const values=[record('a','1','2026-08-01'),record('b','2','2026-08-02')];
    expect(publicTalkHistoryInDateRange(values,'a','2026-08-01','2026-08-31').map(x=>x.id)).toEqual(['1']);
  });

  it('scopes counts and combinations by tenant',()=>{
    const values=[record('a','1','2026-08-01'),record('b','2','2026-08-02')];
    expect(countPublicTalksBySpeaker(values,'a','speaker-1')).toBe(1);
    expect(previousPublicTalkCombinations(values,'a','speaker-1','outline-1')).toHaveLength(1);
  });

  it('orders only the selected tenant without mutating input',()=>{
    const values=[record('a','2','2026-08-02'),record('b','x','2026-01-01'),record('a','1','2026-08-01')];
    const before=values.map(x=>x.id);
    expect(orderPublicTalkHistoryByDate(values,'a').map(x=>x.id)).toEqual(['1','2']);
    expect(values.map(x=>x.id)).toEqual(before);
  });

  it('rejects invalid dates and inverted ranges',()=>{
    expect(()=>record('a','1','2026-02-30')).toThrow('valid calendar date');
    expect(()=>publicTalkHistoryInDateRange([], 'a','2026-09-01','2026-08-01')).toThrow('Date range must end');
  });
});
