import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AssignmentHistoryRecord,
  type CongregationPerson,
  type ResponsibilityAssignment,
} from '@eutaktos/domain';
import {
  deterministicRecommendationEvidence,
  type DeterministicRecommendationInput,
} from './people-overview-evidence';

/**
 * PX7.8 preservation/hardening suite.
 *
 * Scope discipline: every assertion below pins behavior that is ALREADY part of
 * the principal-accepted PX7 contracts (eligibility decisions, availability
 * periods, responsibility requirements). This file intentionally introduces no
 * production change and no new product concept: its purpose is to prove that
 * explicit responsibility/manual constraints keep participating
 * deterministically, tenant-scoped and fail-closed, before ranking, until the
 * Principal approves the remaining persistence contract.
 */

const FULL_CONTEXT = createAccessContext({
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read'],
});

const RESPONSIBILITY_CONTEXT = createAccessContext({
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read', 'responsibilities.read'],
});

function person(input: {
  id: string;
  tenantId?: string;
  active?: boolean;
  eligibility?: CongregationPerson['eligibility'];
}): CongregationPerson {
  return {
    id: input.id,
    tenantId: input.tenantId ?? 'tenant-a',
    displayName: `Person ${input.id}`,
    active: input.active ?? true,
    availability: [],
    eligibility: input.eligibility ?? [
      { assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-config', decidedAt: '2026-01-01T00:00:00.000Z' },
    ],
  };
}

function completedHistory(input: { personId: string; daysAgo: number; id: string }): AssignmentHistoryRecord {
  const meetingDate = `2026-0${Math.max(1, 4 - Math.ceil(input.daysAgo / 30))}-${String(((input.daysAgo % 27) + 1)).padStart(2, '0')}`;
  return {
    id: input.id,
    tenantId: 'tenant-a',
    assignmentId: `assignment-${input.id}`,
    personId: input.personId,
    partType: 'reading',
    meetingDate,
    state: 'completed',
    recordedAt: `${meetingDate}T20:00:00.000Z`,
    meetingId: `meeting-${input.id}`,
  };
}

function responsibility(input: {
  id: string;
  personId: string;
  tenantId?: string;
  responsibilityKey?: string;
  startsAt: string;
  endsAt?: string;
  assignedBy?: string;
}): ResponsibilityAssignment {
  return {
    id: input.id,
    tenantId: input.tenantId ?? 'tenant-a',
    personId: input.personId,
    responsibilityKey: input.responsibilityKey ?? 'chairman',
    startsAt: input.startsAt,
    ...(input.endsAt ? { endsAt: input.endsAt } : {}),
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedBy: input.assignedBy ?? 'actor-config',
  };
}

function input(overrides: Partial<DeterministicRecommendationInput> = {}): DeterministicRecommendationInput {
  return {
    assignmentTypeId: 'reading',
    partType: 'reading',
    targetMeetingDate: '2026-04-01',
    referenceDate: '2026-04-01',
    startsAt: '2026-04-01T19:00:00.000Z',
    endsAt: '2026-04-01T19:30:00.000Z',
    people: [],
    history: [],
    activeAssignments: [],
    workloadAssignments: [],
    ...overrides,
  };
}

describe('PX7.8 — explicit responsibility constraint preservation', () => {
  it('keeps an active required responsibility eligible and everyone else excluded (fail closed)', () => {
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'holder' }), person({ id: 'other' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({ id: 'r-active', personId: 'holder', startsAt: '2026-02-01T00:00:00.000Z' })],
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['holder']);
    expect(result.candidates[0]?.reasons.map(item => item.code)).toContain('MEETS_REQUIRED_RESPONSIBILITY');
    expect(result.excluded.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)])).toEqual([
      ['other', ['MISSING_REQUIRED_RESPONSIBILITY']],
    ]);
  });

  it('treats `endsAt == targetInstant` as no longer active ([start,end) semantics)', () => {
    // Record ended at the exact millisecond of the target slot start.
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'ended-exactly' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({
        id: 'r-end-exact',
        personId: 'ended-exactly',
        startsAt: '2026-03-01T19:00:00.000Z',
        endsAt: '2026-04-01T19:00:00.000Z',
      })],
    }));

    expect(result.candidates).toEqual([]);
    expect(result.excluded.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)])).toEqual([
      ['ended-exactly', ['MISSING_REQUIRED_RESPONSIBILITY']],
    ]);
  });

  it('treats a future-started responsibility as not yet active', () => {
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'future-holder' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({
        id: 'r-future',
        personId: 'future-holder',
        startsAt: '2026-06-01T19:00:00.000Z',
      })],
    }));

    expect(result.candidates).toEqual([]);
    expect(result.excluded[0]?.reasons.map(item => item.code)).toEqual(['MISSING_REQUIRED_RESPONSIBILITY']);
  });

  it('fails closed deterministically when stored responsibility evidence carries an invalid timestamp', () => {
    const build = (): unknown => deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'broken-record' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({
        id: 'r-broken',
        personId: 'broken-record',
        startsAt: '2026-02-01T00:00:00.000Z',
        endsAt: 'not-an-instant',
      })],
    }));

    expect(build).toThrow('Invalid ISO date: not-an-instant');
  });

  it('never lets foreign-tenant responsibility evidence satisfy or break the tenant requirement', () => {
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'tenant-holder' }), person({ id: 'foreign-holder', tenantId: 'tenant-b' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [
        responsibility({ id: 'r-foreign', personId: 'foreign-holder', tenantId: 'tenant-b', startsAt: '2026-02-01T00:00:00.000Z', assignedBy: 'actor-b' }),
        responsibility({ id: 'r-local', personId: 'tenant-holder', startsAt: '2026-02-01T00:00:00.000Z' }),
      ],
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['tenant-holder']);
    expect([...result.candidates, ...result.excluded].some(item => item.personId === 'foreign-holder')).toBe(false);
  });

  it('still fails closed when a requirement exists but authorized responsibility evidence was not supplied', () => {
    expect(() => deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'anyone' })],
      requiredResponsibilityKey: 'chairman',
    }))).toThrow('responsibilities are required when requiredResponsibilityKey is provided');
  });
});

describe('PX7.8 — explicit manual exclusion preservation (existing eligibility contract)', () => {
  it('keeps an explicit `enabled: false` decision out of the ranked candidates as a hard constraint', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'excluded-manually', eligibility: [
          { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-config', decidedAt: '2026-02-01T00:00:00.000Z' },
        ] }),
        person({ id: 'eligible-person' }),
      ],
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['eligible-person']);
    expect(result.excluded.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)])).toEqual([
      ['excluded-manually', ['NOT_ELIGIBLE']],
    ]);
  });

  it('stays reversible: a later recorded decision supersedes an earlier manual exclusion in both directions', () => {
    const excluded = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'reversible', eligibility: [
        { assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-a', decidedAt: '2026-01-10T00:00:00.000Z' },
        { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-b', decidedAt: '2026-02-10T00:00:00.000Z' },
      ] })],
    }));
    const restored = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'reversible', eligibility: [
        { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-b', decidedAt: '2026-02-10T00:00:00.000Z' },
        { assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-c', decidedAt: '2026-03-10T00:00:00.000Z' },
      ] })],
    }));

    expect(excluded.candidates).toEqual([]);
    expect(excluded.excluded[0]?.reasons.map(item => item.code)).toEqual(['NOT_ELIGIBLE']);
    expect(restored.candidates.map(candidate => candidate.personId)).toEqual(['reversible']);
    expect(restored.excluded).toEqual([]);
  });

  it('breaks equal `decidedAt` ties by recording order only — never by actor identifier', () => {
    // Later-recorded TRUE wins although its actor sorts lexicographically EARLIER.
    const reEnabled = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'tie-break', eligibility: [
        { assignmentTypeId: 'reading', enabled: false, decidedBy: 'zzz-last-actor', decidedAt: '2026-02-10T00:00:00.000Z' },
        { assignmentTypeId: 'reading', enabled: true, decidedBy: 'aaa-early-actor', decidedAt: '2026-02-10T00:00:00.000Z' },
      ] })],
    }));
    // Same instants, swapped recording order: now the FALSE record wins although
    // its actor sorts lexicographically LATER.
    const reExcluded = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'tie-break', eligibility: [
        { assignmentTypeId: 'reading', enabled: true, decidedBy: 'aaa-early-actor', decidedAt: '2026-02-10T00:00:00.000Z' },
        { assignmentTypeId: 'reading', enabled: false, decidedBy: 'zzz-late-actor', decidedAt: '2026-02-10T00:00:00.000Z' },
      ] })],
    }));

    expect(reEnabled.candidates.map(candidate => candidate.personId)).toEqual(['tie-break']);
    expect(reExcluded.candidates).toEqual([]);
    expect(reExcluded.excluded[0]?.reasons.map(item => item.code)).toEqual(['NOT_ELIGIBLE']);
  });

  it('scopes a manual exclusion to its own assignment type only', () => {
    const eligibility = [
      { assignmentTypeId: 'chairman', enabled: false, decidedBy: 'actor-config', decidedAt: '2026-02-01T00:00:00.000Z' },
      { assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-config', decidedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const reading = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'type-scoped', eligibility })],
    }));
    const chairman = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      assignmentTypeId: 'chairman',
      partType: 'chairman',
      people: [person({ id: 'type-scoped', eligibility })],
    }));

    expect(reading.candidates.map(candidate => candidate.personId)).toEqual(['type-scoped']);
    expect(chairman.excluded.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)])).toEqual([
      ['type-scoped', ['NOT_ELIGIBLE']],
    ]);
  });

  it('cannot be influenced by exclusion records belonging to another tenant', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'local-candidate' }),
        person({ id: 'foreign-excluded', tenantId: 'tenant-b', eligibility: [
          { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-b', decidedAt: '2026-02-01T00:00:00.000Z' },
        ] }),
      ],
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['local-candidate']);
    expect([...result.candidates, ...result.excluded].some(item => item.personId === 'foreign-excluded')).toBe(false);
  });

  it('returns byte-identical evidence for repeated identical calls including exclusions and requirements', () => {
    const source = input({
      people: [
        person({ id: 'holder' }),
        person({ id: 'excluded', eligibility: [
          { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-config', decidedAt: '2026-02-01T00:00:00.000Z' },
        ] }),
      ],
      history: [completedHistory({ personId: 'holder', daysAgo: 40, id: 'h1' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({ id: 'r-active', personId: 'holder', startsAt: '2026-02-01T00:00:00.000Z' })],
    });

    const first = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, source);
    const replayed = JSON.parse(JSON.stringify(source)) as Partial<DeterministicRecommendationInput>;
    const second = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input(replayed));

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe('PX7.8 — constraints apply before ranking', () => {
  it('never lets the strongest recency signal resurrect an explicitly excluded person', () => {
    // `long-rested` has by far the most favorable (largest) factual interval — if
    // ranking ran before hard constraints it would win. It must stay excluded.
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'long-rested', eligibility: [
          { assignmentTypeId: 'reading', enabled: false, decidedBy: 'actor-config', decidedAt: '2026-02-01T00:00:00.000Z' },
        ] }),
        person({ id: 'first-valid' }),
        person({ id: 'second-valid' }),
      ],
      history: [
        completedHistory({ personId: 'long-rested', daysAgo: 120, id: 'hr' }),
        completedHistory({ personId: 'second-valid', daysAgo: 60, id: 'hs' }),
        completedHistory({ personId: 'first-valid', daysAgo: 10, id: 'hf' }),
      ],
    }));

    expect(result.excluded.map(candidate => candidate.personId)).toEqual(['long-rested']);
    expect(result.candidates.map(candidate => [candidate.personId, candidate.rank])).toEqual([
      ['second-valid', 1],
      ['first-valid', 2],
    ]);
  });

  it('preserves the documented deterministic order for equally valid candidates (workload, recency, id tie-break)', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'z-tie' }),
        person({ id: 'a-tie' }),
        person({ id: 'recent-10d' }),
        person({ id: 'older-90d' }),
      ],
      history: [
        completedHistory({ personId: 'recent-10d', daysAgo: 10, id: 'h1' }),
        completedHistory({ personId: 'older-90d', daysAgo: 90, id: 'h2' }),
        completedHistory({ personId: 'a-tie', daysAgo: 30, id: 'h3' }),
        completedHistory({ personId: 'z-tie', daysAgo: 30, id: 'h4' }),
      ],
    }));

    // Completed-history intervals are factual projections from meetingDate to
    // referenceDate: `older-90d` ≈ 81d, both ties ≈ 28d, and the record built
    // from daysAgo=10 lands on 2026-03-11 ≈ 21d (shortest of the four).
    expect(result.candidates.map(candidate => candidate.personId)).toEqual([
      'older-90d',
      'a-tie',
      'z-tie',
      'recent-10d',
    ]);
    expect(result.candidates.map(candidate => candidate.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('PX7.8 — response minimization at the canonical engine boundary', () => {
  it('emits only structural code-bearing reasons/warnings and never tenant/actor identifiers', () => {
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [
        person({ id: 'holder' }),
        person({ id: 'inactive', active: false }),
        person({ id: 'missing-everything', eligibility: [] }),
      ],
      requiredResponsibilityKey: 'chairman',
      responsibilities: [responsibility({ id: 'r-active', personId: 'holder', startsAt: '2026-02-01T00:00:00.000Z' })],
    }));

    const serialized = JSON.stringify(result);
    for (const forbidden of ['tenantId', 'actorId', 'decidedBy', 'assignedBy', 'displayName', 'phone']) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
    for (const entry of [...result.candidates, ...result.excluded]) {
      for (const item of entry.reasons) expect(Object.keys(item).sort()).toEqual(['code']);
      for (const item of entry.warnings) expect(Object.keys(item).sort()).toEqual(['code']);
    }
  });
});
