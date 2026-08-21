import { describe, it, expect } from 'vitest';
import {
  createCOVisit, orderAgendaSlots, validateAgendaWithinVisit,
  assertCOVisitTenant, normalizeCOVisit,
} from './co-visit';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';
const SLOT_A = { title: 'Public Talk', startsAt: '2026-09-05T14:00:00Z', endsAt: '2026-09-05T14:30:00Z' };
const SLOT_B = { title: 'Bible Study', startsAt: '2026-09-05T14:30:00Z', endsAt: '2026-09-05T15:00:00Z' };
function make(overrides?: Partial<Parameters<typeof createCOVisit>[0]>) {
  return createCOVisit({
    id: 'v-1', tenantId: T, startsAt: '2026-09-05T14:00:00Z', endsAt: '2026-09-05T16:00:00Z',
    agendaSlots: [SLOT_A], locationReference: 'kh-1', now: NOW, ...overrides,
  });
}

describe('createCOVisit', () => {
  it('creates valid', () => { const v = make(); expect(v.agendaSlots).toHaveLength(1); expect(Object.isFrozen(v)).toBe(true); expect(Object.isFrozen(v.agendaSlots)).toBe(true); });
  it('throws on endsAt before startsAt', () => { expect(() => make({ endsAt: '2026-09-05T13:00:00Z' })).toThrow('endsAt must be after'); });
  it('throws on empty agenda', () => { expect(() => make({ agendaSlots: [] })).toThrow('At least one agenda'); });
  it('throws on slot endsAt before startsAt', () => { expect(() => make({ agendaSlots: [{ title: 'Bad', startsAt: '2026-09-05T15:00:00Z', endsAt: '2026-09-05T14:00:00Z' }] })).toThrow('endsAt must be after'); });
  it('throws on slot title too long', () => { expect(() => make({ agendaSlots: [{ title: 'x'.repeat(301), startsAt: '2026-09-05T14:00:00Z', endsAt: '2026-09-05T14:30:00Z' }] })).toThrow('title too long'); });
  it('throws when a slot starts before the visit', () => { expect(() => make({ agendaSlots: [{ title: 'Early', startsAt: '2026-09-05T13:00:00Z', endsAt: '2026-09-05T14:00:00Z' }] })).toThrow('starts before the visit'); });
  it('throws when a slot ends after the visit', () => { expect(() => make({ agendaSlots: [{ title: 'Late', startsAt: '2026-09-05T15:00:00Z', endsAt: '2026-09-05T17:00:00Z' }] })).toThrow('ends after the visit'); });
  it('accepts event/schedule refs', () => { const v = make({ eventReferences: ['evt-1'], scheduleReferences: ['sched-1'] }); expect(v.eventReferences).toEqual(['evt-1']); });
  it('no private/evaluation data stored', () => { const v = make(); expect('pastoralNotes' in v).toBe(false); expect('evaluation' in v).toBe(false); expect('spiritualQualification' in v).toBe(false); });
});

describe('orderAgendaSlots', () => {
  it('sorts by startsAt', () => { expect(orderAgendaSlots(make({ agendaSlots: [SLOT_B, SLOT_A] }))[0].title).toBe('Public Talk'); });
});

describe('validateAgendaWithinVisit', () => {
  it('passes for valid', () => { expect(() => validateAgendaWithinVisit(make())).not.toThrow(); });
});

describe('tenant isolation', () => {
  it('assertCOVisitTenant', () => { expect(() => assertCOVisitTenant(make(), T)).not.toThrow(); expect(() => assertCOVisitTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeCOVisit', () => {
  it('normalizes valid', () => { expect(normalizeCOVisit(make()).id).toBe('v-1'); });
  it('throws on invalid dates', () => { expect(() => normalizeCOVisit({ ...make(), endsAt: 'bad' } as any)).toThrow('Invalid ISO date'); });
  it('rejects persisted slots outside the visit window', () => {
    expect(() => normalizeCOVisit({
      ...make(), agendaSlots: [{ title: 'Early', startsAt: '2026-09-05T13:00:00Z', endsAt: '2026-09-05T14:00:00Z' }],
    })).toThrow('starts before the visit');
  });
});
