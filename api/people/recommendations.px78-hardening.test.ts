import { describe, expect, it } from 'vitest';
import { createAccessContext, type CongregationPerson, type MidweekMeeting } from '@eutaktos/domain';
import { buildAuthorizedMidweekRecommendation, type MidweekRecommendationSource } from './recommendation-adapter';
import { recommendationTargetFromRequest } from './recommendations';

/**
 * PX7.8 request/adapter hardening.
 *
 * The public recommendation contract must stay identity-only: no browser field
 * may ever carry authority over tenant, actor, capabilities, eligibility,
 * responsibilities or manual constraints. This suite pins that boundary for the
 * constraint-related field names introduced by PX7.8 review and proves the
 * adapter output remains byte-deterministic across repeated identical calls.
 */

const FULL_READ = ['people.read', 'eligibility.read', 'availability.read', 'schedule.read'] as const;

function person(input: {
  id: string;
  tenantId?: string;
  eligible?: boolean;
}): CongregationPerson {
  const tenantId = input.tenantId ?? 'tenant-a';
  return Object.freeze({
    id: input.id,
    tenantId,
    displayName: `Person ${input.id}`,
    active: true,
    availability: Object.freeze([]),
    eligibility: Object.freeze([{
      assignmentTypeId: 'reading',
      enabled: input.eligible ?? true,
      decidedBy: 'actor-config',
      decidedAt: '2032-01-01T00:00:00.000Z',
    }]),
  });
}

function meeting(): MidweekMeeting {
  return Object.freeze({
    id: 'meeting-a',
    tenantId: 'tenant-a',
    date: '2032-06-10',
    localTime: '19:00',
    timezone: 'Europe/Lisbon',
    state: 'published' as const,
    slots: Object.freeze([
      Object.freeze({ id: 'slot-a', position: 0, durationMinutes: 10, titleKey: 'slot.reading', partDefinitionId: 'reading' }),
    ]),
    createdAt: '2032-01-01T00:00:00.000Z',
    updatedAt: '2032-01-01T00:00:00.000Z',
  });
}

function source(): MidweekRecommendationSource {
  return {
    people: Object.freeze([person({ id: 'eligible' }), person({ id: 'manually-excluded', eligible: false })]),
    meetings: Object.freeze([meeting()]),
    studentAssignments: Object.freeze([]),
    nonStudentAssignments: Object.freeze([]),
  };
}

describe('PX7.8 public request contract — manual-constraint forgery is rejected, never ignored silently', () => {
  it.each([
    'manualConstraints',
    'manualExclusions',
    'requiredResponsibilityKey',
    'responsibilities',
    'eligibility',
    'constraints',
    'excludedPersonIds',
    'candidateIds',
    'actorId',
    'tenantId',
    'capabilities',
  ])('rejects query field %s as unknown instead of accepting it as evidence', field => {
    expect(() => recommendationTargetFromRequest({
      query: { meetingId: 'meeting-a', slotId: 'slot-a', [field]: 'forged' },
    })).toThrow('Unknown recommendation query field');
  });

  it('rejects a forged body carrying manual constraints even with a valid query target', () => {
    expect(() => recommendationTargetFromRequest({
      query: { meetingId: 'meeting-a', slotId: 'slot-a' },
      body: { manualConstraints: [{ personId: 'p', assignmentTypeId: 'reading', kind: 'exclude' }] },
    })).toThrow('does not accept a request body');
  });
});

describe('PX7.8 adapter preservation — server-derived constraints and byte determinism', () => {
  it('keeps explicitly excluded people out of ranked candidates without leaking authority fields', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-1', capabilities: FULL_READ });
    const result = buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, source());

    expect(result.candidates.map(item => item.personId)).toEqual(['eligible']);
    expect(result.excluded.map(item => [item.personId, item.reasons.map(reason => reason.code)])).toEqual([
      ['manually-excluded', ['NOT_ELIGIBLE']],
    ]);

    const serialized = JSON.stringify(result);
    for (const forbidden of ['tenantId', 'capabilities', 'decidedBy', 'availability', 'eligibility']) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it('produces identical responses for repeated identical authorized calls (no shuffle across repeats)', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-1', capabilities: FULL_READ });
    const first = buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, source());
    const second = buildAuthorizedMidweekRecommendation(
      context,
      { meetingId: 'meeting-a', slotId: 'slot-a' },
      JSON.parse(JSON.stringify(source())) as MidweekRecommendationSource,
    );

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('does not let a foreign-tenant person enter the tenant evidence through the stored projection', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-1', capabilities: FULL_READ });
    const crossTenant = {
      ...source(),
      people: Object.freeze([...source().people, person({ id: 'foreign', tenantId: 'tenant-b' })]),
    };
    const result = buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, crossTenant);

    expect([...result.candidates, ...result.excluded].some(item => item.personId === 'foreign')).toBe(false);
  });
});
