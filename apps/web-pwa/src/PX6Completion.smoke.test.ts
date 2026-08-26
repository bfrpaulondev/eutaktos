import { describe, expect, it } from 'vitest';
import { createPersonWizardDraft, personWizardResponsibilityStatus } from './PersonWizardModel';

describe('PX6 completion smoke', () => {
  it('keeps optional related-change queues explicit and empty by default', () => {
    const draft = createPersonWizardDraft('pt-PT');
    expect(draft.contact).toEqual({});
    expect(draft.responsibilityEnds).toEqual([]);
    expect(draft.availabilityRemovals).toEqual([]);
  });

  it('uses exclusive responsibility end semantics', () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    expect(personWizardResponsibilityStatus({ startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-26T12:00:00.000Z' }, now)).toBe('ended');
    expect(personWizardResponsibilityStatus({ startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-26T12:00:00.001Z' }, now)).toBe('active');
  });
});
