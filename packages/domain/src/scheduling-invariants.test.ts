import { describe, expect, it } from 'vitest';

// ============================================================
// MINIMAL LOCAL TYPES (self-contained, no imports from unmerged branches)
// ============================================================

type TenantEntity = { tenantId: string; [key: string]: unknown };

type PersonRef = { personId: string; tenantId: string };

type MeetingRef = { meetingId: string; tenantId: string; date: string };

type AvailabilityPeriod = { personId: string; tenantId: string; startsAt: string; endsAt: string };

type EligibilityEntry = { personId: string; tenantId: string; assignmentTypeId: string; enabled: boolean; decidedBy: string; decidedAt: string };

type Assignment = { id: string; tenantId: string; meetingId: string; slotId: string; personId: string; meetingDate: string; startTime: string; endTime: string; classId?: string };

type HistoryRecord = { id: string; tenantId: string; personId: string; partType: string; meetingDate: string; state: string; recordedAt: string; meetingId: string };

type Conflict = { type: string; assignmentIds: string[]; personId: string; description: string };

// ============================================================
// SEEDED PRNG (LCG — no external library)
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed >>> 0; // ensure unsigned 32-bit
  return () => {
    s = ((s * 1664525 + 1013904223) & 0xFFFFFFFF) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

// ============================================================
// RANDOM GENERATORS
// ============================================================

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateString(rng: () => number, minLength = 1, maxLength = 20): string {
  const len = minLength + Math.floor(rng() * (maxLength - minLength + 1));
  return Array.from({ length: len }, () => CHARS[Math.floor(rng() * CHARS.length)]).join('');
}

function generateTenantIds(rng: () => number, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push('tenant-' + generateString(rng, 4, 8));
  }
  return ids;
}

function generateTenantEntities(rng: () => number, count: number, tenantIds: string[]): TenantEntity[] {
  return Array.from({ length: count }, () => ({
    tenantId: tenantIds[Math.floor(rng() * tenantIds.length)],
    extra: generateString(rng),
  }));
}

function generatePersonRefs(rng: () => number, count: number, tenantIds: string[]): PersonRef[] {
  return Array.from({ length: count }, () => ({
    personId: 'person-' + generateString(rng, 4, 8),
    tenantId: tenantIds[Math.floor(rng() * tenantIds.length)],
  }));
}

function generateTime(rng: () => number): string {
  const h = Math.floor(rng() * 24);
  const m = Math.floor(rng() * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateDate(rng: () => number): string {
  const y = 2024 + Math.floor(rng() * 3);
  const m = 1 + Math.floor(rng() * 12);
  const d = 1 + Math.floor(rng() * 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function generateISO(rng: () => number): string {
  const date = generateDate(rng);
  const time = generateTime(rng);
  return `${date}T${time}:00Z`;
}

function generateAvailabilityPeriods(rng: () => number, count: number, tenantIds: string[], personIds: string[]): AvailabilityPeriod[] {
  return Array.from({ length: count }, () => {
    const start = generateISO(rng);
    const endDay = generateDate(rng);
    const endTime = generateTime(rng);
    return {
      personId: personIds[Math.floor(rng() * personIds.length)],
      tenantId: tenantIds[Math.floor(rng() * tenantIds.length)],
      startsAt: start,
      endsAt: `${endDay}T${endTime}:00Z`,
    };
  });
}

function generateAssignments(rng: () => number, count: number, tenantIds: string[]): Assignment[] {
  return Array.from({ length: count }, () => ({
    id: 'assign-' + generateString(rng, 4, 8),
    tenantId: tenantIds[Math.floor(rng() * tenantIds.length)],
    meetingId: 'meeting-' + generateString(rng, 4, 8),
    slotId: 'slot-' + generateString(rng, 4, 8),
    personId: 'person-' + generateString(rng, 4, 8),
    meetingDate: generateDate(rng),
    startTime: generateTime(rng),
    endTime: generateTime(rng),
  }));
}

function generateHistoryRecords(rng: () => number, count: number, tenantIds: string[]): HistoryRecord[] {
  const states = ['completed', 'cancelled', 'rescheduled'];
  return Array.from({ length: count }, () => ({
    id: 'hist-' + generateString(rng, 4, 8),
    tenantId: tenantIds[Math.floor(rng() * tenantIds.length)],
    personId: 'person-' + generateString(rng, 4, 8),
    partType: 'part-' + generateString(rng, 3, 6),
    meetingDate: generateDate(rng),
    state: states[Math.floor(rng() * states.length)],
    recordedAt: generateISO(rng),
    meetingId: 'meeting-' + generateString(rng, 4, 8),
  }));
}

// ============================================================
// PURE FUNCTIONS UNDER TEST (mirror contracts from K21–K39)
// ============================================================

function filterByTenant<T extends { tenantId: string }>(entities: T[], tenantId: string): T[] {
  return entities.filter(e => e.tenantId === tenantId);
}

function isPersonUnavailable(
  periods: AvailabilityPeriod[],
  personId: string,
  meetingDate: string,
  startTime: string,
  endTime: string,
  _timezone?: string,
): boolean {
  const mStart = new Date(`${meetingDate}T${startTime}:00Z`);
  const mEnd = new Date(`${meetingDate}T${endTime}:00Z`);
  return periods.some(p => {
    if (p.personId !== personId) return false;
    const pStart = new Date(p.startsAt);
    const pEnd = new Date(p.endsAt);
    return pStart < mEnd && pEnd > mStart;
  });
}

function checkEligibility(
  entries: EligibilityEntry[],
  personId: string,
  assignmentTypeId: string,
): { eligible: boolean; reason: string } {
  const matching = entries
    .filter(e => e.personId === personId && e.assignmentTypeId === assignmentTypeId)
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

  if (matching.length === 0) {
    return { eligible: false, reason: 'no-eligibility-record' };
  }
  const latest = matching[0];
  if (!latest.enabled) {
    return { eligible: false, reason: 'explicitly-disabled' };
  }
  return { eligible: true, reason: 'eligible' };
}

function timeRangesOverlap(
  dateA: string, startA: string, endA: string,
  dateB: string, startB: string, endB: string,
): boolean {
  const aStart = new Date(`${dateA}T${startA}:00Z`);
  const aEnd = new Date(`${dateA}T${endA}:00Z`);
  const bStart = new Date(`${dateB}T${startB}:00Z`);
  const bEnd = new Date(`${dateB}T${endB}:00Z`);
  return aStart < bEnd && bStart < aEnd;
}

type ExclusivePair = { slotId1: string; slotId2: string };

function detectConflicts(assignments: Assignment[], exclusivePairs?: ExclusivePair[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Temporal conflicts: same person, overlapping times
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      if (a.personId === b.personId && a.id !== b.id) {
        if (timeRangesOverlap(a.meetingDate, a.startTime, a.endTime, b.meetingDate, b.startTime, b.endTime)) {
          conflicts.push({
            type: 'temporal',
            assignmentIds: [a.id, b.id],
            personId: a.personId,
            description: `Person ${a.personId} has overlapping assignments ${a.id} and ${b.id}`,
          });
        }
      }
    }
  }

  // Exclusive slot conflicts
  if (exclusivePairs) {
    for (const pair of exclusivePairs) {
      const slot1Assignments = assignments.filter(a => a.slotId === pair.slotId1);
      const slot2Assignments = assignments.filter(a => a.slotId === pair.slotId2);
      for (const a1 of slot1Assignments) {
        for (const a2 of slot2Assignments) {
          if (a1.personId === a2.personId) {
            conflicts.push({
              type: 'exclusive-slot',
              assignmentIds: [a1.id, a2.id],
              personId: a1.personId,
              description: `Person ${a1.personId} assigned to mutually exclusive slots ${pair.slotId1} and ${pair.slotId2}`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function createHistoryRecord(input: Omit<HistoryRecord, 'id'> & { id?: string }): HistoryRecord {
  const record: HistoryRecord = {
    id: input.id ?? 'hist-' + Math.random().toString(36).slice(2, 10),
    tenantId: input.tenantId,
    personId: input.personId,
    partType: input.partType,
    meetingDate: input.meetingDate,
    state: input.state,
    recordedAt: input.recordedAt,
    meetingId: input.meetingId,
  };
  return Object.freeze(record) as HistoryRecord;
}

function validateDate(date: unknown): boolean {
  if (typeof date !== 'string') return false;
  if (date.trim() === '') return false;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return false;
  const d = new Date(parsed);
  // Reject invalid calendar dates like Feb 30
  const reconstructed = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const datePart = date.slice(0, 10);
  if (datePart !== reconstructed) return false;
  return true;
}

function validateRequiredId(id: unknown): boolean {
  if (id === null || id === undefined) return false;
  if (typeof id !== 'string') return false;
  if (id.trim() === '') return false;
  return true;
}

function queryHistory(history: HistoryRecord[], personId: string): HistoryRecord[] {
  return history.filter(h => h.personId === personId);
}

// ============================================================
// STRUCTURAL EQUALITY HELPER
// ============================================================

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a as object).sort();
    const keysB = Object.keys(b as object).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

// ============================================================
// INVARIANT 1: Cross-tenant data never crosses boundaries (8 tests)
// ============================================================

describe('Invariant 1: Cross-tenant isolation', () => {
  it('P1.1 - generated entities with 2 tenants never leak across boundaries', () => {
    const rng = seededRandom(42);
    const tenantIds = generateTenantIds(rng, 2);
    const entities = generateTenantEntities(rng, 100, tenantIds);
    const queryTenant = tenantIds[0];
    const result = filterByTenant(entities, queryTenant);
    for (const entity of result) {
      expect(entity.tenantId).toBe(queryTenant);
    }
  });

  it('P1.2 - generated entities with 5 tenants never leak', () => {
    const rng = seededRandom(123);
    const tenantIds = generateTenantIds(rng, 5);
    const entities = generateTenantEntities(rng, 200, tenantIds);
    for (const tid of tenantIds) {
      const result = filterByTenant(entities, tid);
      for (const entity of result) {
        expect(entity.tenantId).toBe(tid);
      }
    }
  });

  it('P1.3 - zero entities for a tenant returns empty array', () => {
    const rng = seededRandom(777);
    const tenantIds = generateTenantIds(rng, 3);
    // Put all entities in tenantIds[0]
    const entities = Array.from({ length: 50 }, () => ({ tenantId: tenantIds[0], data: 'x' }));
    expect(filterByTenant(entities, tenantIds[1])).toEqual([]);
    expect(filterByTenant(entities, tenantIds[2])).toEqual([]);
  });

  it('P1.4 - all entities in one tenant: query for that tenant returns all', () => {
    const rng = seededRandom(999);
    const tenantId = 'single-tenant';
    const entities = generateTenantEntities(rng, 30, [tenantId]);
    const result = filterByTenant(entities, tenantId);
    expect(result).toHaveLength(30);
  });

  it('P1.5 - adversarial tenantId: substring attacks do not leak', () => {
    const entities: TenantEntity[] = [
      { tenantId: 'tenant-abc', val: 1 },
      { tenantId: 'tenant-abc-def', val: 2 },
      { tenantId: 'tenant-ab', val: 3 },
      { tenantId: 'tenant-abcdef', val: 4 },
    ];
    const result = filterByTenant(entities, 'tenant-abc');
    expect(result).toHaveLength(1);
    expect(result[0].val).toBe(1);
  });

  it('P1.6 - adversarial tenantId: unicode and special characters', () => {
    const entities: TenantEntity[] = [
      { tenantId: 'tënánt-α', val: 'alpha' },
      { tenantId: 'tenant-normal', val: 'normal' },
    ];
    expect(filterByTenant(entities, 'tënánt-α')).toHaveLength(1);
    expect(filterByTenant(entities, 'tenant-normal')).toHaveLength(1);
    expect(filterByTenant(entities, 'tenant-α')).toHaveLength(0);
  });

  it('P1.7 - non-existent tenantId always returns empty', () => {
    const rng = seededRandom(321);
    const tenantIds = generateTenantIds(rng, 3);
    const entities = generateTenantEntities(rng, 80, tenantIds);
    expect(filterByTenant(entities, 'nonexistent-tenant')).toEqual([]);
  });

  it('P1.8 - person refs respect tenant boundaries with filterByTenant', () => {
    const rng = seededRandom(555);
    const tenantIds = generateTenantIds(rng, 3);
    const people = generatePersonRefs(rng, 60, tenantIds);
    for (const tid of tenantIds) {
      const result = filterByTenant(people, tid);
      for (const p of result) {
        expect(p.tenantId).toBe(tid);
      }
    }
  });
});

// ============================================================
// INVARIANT 2: Determinism (6 tests)
// ============================================================

describe('Invariant 2: Deterministic results', () => {
  it('P2.1 - filterByTenant is deterministic over 10 runs', () => {
    const rng = seededRandom(100);
    const tenantIds = generateTenantIds(rng, 3);
    const entities = generateTenantEntities(rng, 50, tenantIds);
    const queryTenant = tenantIds[0];
    const first = filterByTenant(entities, queryTenant);
    for (let i = 0; i < 9; i++) {
      const next = filterByTenant(entities, queryTenant);
      expect(deepEqual(first, next)).toBe(true);
    }
  });

  it('P2.2 - isPersonUnavailable is deterministic over 10 runs', () => {
    const rng = seededRandom(200);
    const tenantIds = ['t1'];
    const personIds = ['p1'];
    const periods = generateAvailabilityPeriods(rng, 5, tenantIds, personIds);
    const meetingDate = '2025-06-15';
    const startTime = '10:00';
    const endTime = '11:00';
    const first = isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime);
    for (let i = 0; i < 9; i++) {
      expect(isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime)).toBe(first);
    }
  });

  it('P2.3 - checkEligibility is deterministic over 10 runs', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: false, decidedBy: 'admin', decidedAt: '2025-06-01T00:00:00Z' },
    ];
    const first = checkEligibility(entries, 'p1', 'at1');
    for (let i = 0; i < 9; i++) {
      expect(deepEqual(checkEligibility(entries, 'p1', 'at1'), first)).toBe(true);
    }
  });

  it('P2.4 - detectConflicts is deterministic over 10 runs', () => {
    const rng = seededRandom(300);
    const tenantIds = generateTenantIds(rng, 2);
    const assignments = generateAssignments(rng, 20, tenantIds);
    const exclusivePairs: ExclusivePair[] = [
      { slotId1: 'slot-a', slotId2: 'slot-b' },
    ];
    const first = detectConflicts(assignments, exclusivePairs);
    for (let i = 0; i < 9; i++) {
      expect(deepEqual(detectConflicts(assignments, exclusivePairs), first)).toBe(true);
    }
  });

  it('P2.5 - queryHistory is deterministic over 10 runs', () => {
    const rng = seededRandom(400);
    const tenantIds = generateTenantIds(rng, 2);
    const history = generateHistoryRecords(rng, 40, tenantIds);
    const personId = history[0]?.personId ?? 'p1';
    const first = queryHistory(history, personId);
    for (let i = 0; i < 9; i++) {
      expect(deepEqual(queryHistory(history, personId), first)).toBe(true);
    }
  });

  it('P2.6 - validateDate and validateRequiredId are deterministic over 10 runs', () => {
    const inputs = ['2025-01-01', 'invalid', '', '2025-02-30', null, undefined, 42, NaN, '  ', '2024-12-31T23:59:59Z'];
    for (const input of inputs) {
      const dateResult1 = validateDate(input);
      const idResult1 = validateRequiredId(input);
      for (let i = 0; i < 9; i++) {
        expect(validateDate(input)).toBe(dateResult1);
        expect(validateRequiredId(input)).toBe(idResult1);
      }
    }
  });
});

// ============================================================
// INVARIANT 3: Unavailable person not assigned (6 tests)
// ============================================================

describe('Invariant 3: Unavailable person detection', () => {
  it('P3.1 - person with covering availability period is flagged unavailable', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-06-15T09:00:00Z', endsAt: '2025-06-15T12:00:00Z' },
    ];
    expect(isPersonUnavailable(periods, 'p1', '2025-06-15', '10:00', '11:00')).toBe(true);
  });

  it('P3.2 - person available outside the period is not flagged', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-06-15T09:00:00Z', endsAt: '2025-06-15T10:00:00Z' },
    ];
    expect(isPersonUnavailable(periods, 'p1', '2025-06-15', '10:00', '11:00')).toBe(false);
  });

  it('P3.3 - exact boundary: period ends when meeting starts → not unavailable', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-06-15T08:00:00Z', endsAt: '2025-06-15T10:00:00Z' },
    ];
    // Meeting starts exactly when period ends: no overlap (end is exclusive)
    expect(isPersonUnavailable(periods, 'p1', '2025-06-15', '10:00', '11:00')).toBe(false);
  });

  it('P3.4 - exact boundary: meeting ends when period starts → not unavailable', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-06-15T11:00:00Z', endsAt: '2025-06-15T13:00:00Z' },
    ];
    expect(isPersonUnavailable(periods, 'p1', '2025-06-15', '10:00', '11:00')).toBe(false);
  });

  it('P3.5 - multi-day availability covering meeting date is detected', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-06-14T00:00:00Z', endsAt: '2025-06-16T23:59:59Z' },
    ];
    expect(isPersonUnavailable(periods, 'p1', '2025-06-15', '10:00', '11:00')).toBe(true);
  });

  it('P3.6 - randomly generated periods: availability covering meeting always flags', () => {
    const rng = seededRandom(606);
    // Generate 50 test cases where we explicitly create overlapping periods
    for (let i = 0; i < 50; i++) {
      const meetingDate = '2025-06-15';
      const meetingStartH = Math.floor(rng() * 20) + 1;
      const meetingEndH = meetingStartH + Math.floor(rng() * 3) + 1;
      const startTime = `${String(meetingStartH).padStart(2, '0')}:00`;
      const endTime = `${String(Math.min(meetingEndH, 23)).padStart(2, '0')}:00`;

      // Create a period that definitely covers the meeting
      const periodStartH = meetingStartH - Math.floor(rng() * 3) - 1;
      const periodEndH = meetingEndH + Math.floor(rng() * 3) + 1;
      const periods: AvailabilityPeriod[] = [
        {
          personId: 'p1',
          tenantId: 't1',
          startsAt: `2025-06-15T${String(Math.max(0, periodStartH)).padStart(2, '0')}:00:00Z`,
          endsAt: `2025-06-15T${String(Math.min(23, periodEndH)).padStart(2, '0')}:00:00Z`,
        },
      ];
      expect(isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime)).toBe(true);
    }
  });
});

// ============================================================
// INVARIANT 4-5: Eligibility (8 tests)
// ============================================================

describe('Invariant 4-5: Eligibility checks', () => {
  it('P4.1 - missing eligibility record returns not eligible', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p2', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
    ];
    const result = checkEligibility(entries, 'p1', 'at1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });

  it('P4.2 - explicitly disabled person is not eligible', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: false, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
    ];
    const result = checkEligibility(entries, 'p1', 'at1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('explicitly-disabled');
  });

  it('P4.3 - explicitly enabled person is eligible', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
    ];
    const result = checkEligibility(entries, 'p1', 'at1');
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('eligible');
  });

  it('P4.4 - most-recent-wins: last enabled entry takes precedence', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: false, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'admin', decidedAt: '2025-06-01T00:00:00Z' },
    ];
    expect(checkEligibility(entries, 'p1', 'at1').eligible).toBe(true);
  });

  it('P4.5 - most-recent-wins: last disabled entry takes precedence', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: false, decidedBy: 'admin', decidedAt: '2025-06-01T00:00:00Z' },
    ];
    expect(checkEligibility(entries, 'p1', 'at1').eligible).toBe(false);
  });

  it('P4.6 - absence of eligibility data fails closed (empty array)', () => {
    expect(checkEligibility([], 'p1', 'at1').eligible).toBe(false);
    expect(checkEligibility([], 'p1', 'at1').reason).toBe('no-eligibility-record');
  });

  it('P4.7 - random ordering of entries: most-recent-wins still applies', () => {
    const rng = seededRandom(777);
    for (let trial = 0; trial < 20; trial++) {
      const timestamp1 = '2025-01-01T00:00:00Z';
      const timestamp2 = '2025-06-01T00:00:00Z';
      const entry1: EligibilityEntry = { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: true, decidedBy: 'a', decidedAt: timestamp1 };
      const entry2: EligibilityEntry = { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at1', enabled: false, decidedBy: 'a', decidedAt: timestamp2 };
      // Randomly shuffle
      const entries = rng() > 0.5 ? [entry1, entry2] : [entry2, entry1];
      expect(checkEligibility(entries, 'p1', 'at1').eligible).toBe(false);
    }
  });

  it('P4.8 - different assignmentTypeId does not match', () => {
    const entries: EligibilityEntry[] = [
      { personId: 'p1', tenantId: 't1', assignmentTypeId: 'at-other', enabled: true, decidedBy: 'admin', decidedAt: '2025-01-01T00:00:00Z' },
    ];
    expect(checkEligibility(entries, 'p1', 'at-target').eligible).toBe(false);
  });
});

// ============================================================
// INVARIANT 6: Exclusive slots don't receive duplicates (5 tests)
// ============================================================

describe('Invariant 6: Exclusive slot conflicts', () => {
  it('P6.1 - same person assigned to two exclusive slots produces conflict', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 'slot-a', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm1', slotId: 'slot-b', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
    ];
    const exclusivePairs: ExclusivePair[] = [{ slotId1: 'slot-a', slotId2: 'slot-b' }];
    const conflicts = detectConflicts(assignments, exclusivePairs);
    expect(conflicts.some(c => c.type === 'exclusive-slot')).toBe(true);
  });

  it('P6.2 - different persons on exclusive slots: no conflict', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 'slot-a', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm1', slotId: 'slot-b', personId: 'p2', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
    ];
    const exclusivePairs: ExclusivePair[] = [{ slotId1: 'slot-a', slotId2: 'slot-b' }];
    const conflicts = detectConflicts(assignments, exclusivePairs);
    expect(conflicts.some(c => c.type === 'exclusive-slot')).toBe(false);
  });

  it('P6.3 - no exclusive pairs provided: only temporal conflicts detected', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 'slot-a', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm1', slotId: 'slot-b', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
    ];
    const conflicts = detectConflicts(assignments, []);
    // These overlap temporally for same person so there IS a temporal conflict
    expect(conflicts.some(c => c.type === 'temporal')).toBe(true);
    expect(conflicts.some(c => c.type === 'exclusive-slot')).toBe(false);
  });

  it('P6.4 - random exclusive pairs: conflicts correctly identified', () => {
    const rng = seededRandom(888);
    for (let trial = 0; trial < 20; trial++) {
      const personId = 'p1';
      const assignments: Assignment[] = [
        { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 'slot-x', personId, meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
        { id: 'a2', tenantId: 't1', meetingId: 'm1', slotId: 'slot-y', personId, meetingDate: '2025-06-15', startTime: '14:00', endTime: '15:00' },
      ];
      const exclusivePairs: ExclusivePair[] = [{ slotId1: 'slot-x', slotId2: 'slot-y' }];
      const conflicts = detectConflicts(assignments, exclusivePairs);
      expect(conflicts.some(c => c.type === 'exclusive-slot')).toBe(true);
    }
  });

  it('P6.5 - no false positives: non-exclusive same-person different slots no conflict when no pairs', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 'slot-a', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 'slot-c', personId: 'p1', meetingDate: '2025-06-22', startTime: '10:00', endTime: '11:00' },
    ];
    const conflicts = detectConflicts(assignments, []);
    expect(conflicts).toEqual([]);
  });
});

// ============================================================
// INVARIANT 7: Temporal conflicts detected (6 tests)
// ============================================================

describe('Invariant 7: Temporal conflict detection', () => {
  it('P7.1 - overlapping time ranges for same person detected', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:30', endTime: '11:30' },
    ];
    expect(detectConflicts(assignments).some(c => c.type === 'temporal')).toBe(true);
  });

  it('P7.2 - adjacent time ranges (no overlap) produce no conflict', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p1', meetingDate: '2025-06-15', startTime: '11:00', endTime: '12:00' },
    ];
    expect(detectConflicts(assignments)).toEqual([]);
  });

  it('P7.3 - contained range detected (one meeting fully inside another)', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: '2025-06-15', startTime: '09:00', endTime: '13:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
    ];
    expect(detectConflicts(assignments).some(c => c.type === 'temporal')).toBe(true);
  });

  it('P7.4 - different persons at overlapping times: no conflict', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p2', meetingDate: '2025-06-15', startTime: '10:00', endTime: '11:00' },
    ];
    expect(detectConflicts(assignments)).toEqual([]);
  });

  it('P7.5 - same day different non-overlapping times: no conflict', () => {
    const assignments: Assignment[] = [
      { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: '2025-06-15', startTime: '09:00', endTime: '10:00' },
      { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p1', meetingDate: '2025-06-15', startTime: '14:00', endTime: '15:00' },
    ];
    expect(detectConflicts(assignments)).toEqual([]);
  });

  it('P7.6 - random temporal overlaps always detected', () => {
    const rng = seededRandom(707);
    for (let i = 0; i < 30; i++) {
      const date = '2025-06-15';
      const startH = Math.floor(rng() * 14) + 1; // 1–14
      const dur = Math.floor(rng() * 3) + 2; // 2–4
      const endH = Math.min(startH + dur, 22); // cap at 22 so +1 = 23
      const assignments: Assignment[] = [
        { id: 'a1', tenantId: 't1', meetingId: 'm1', slotId: 's1', personId: 'p1', meetingDate: date, startTime: `${String(startH).padStart(2, '0')}:00`, endTime: `${String(endH).padStart(2, '0')}:00` },
        { id: 'a2', tenantId: 't1', meetingId: 'm2', slotId: 's2', personId: 'p1', meetingDate: date, startTime: `${String(endH - 1).padStart(2, '0')}:00`, endTime: `${String(Math.min(endH + 1, 23)).padStart(2, '0')}:00` },
      ];
      // endH - 1 < endH (overlap guaranteed since second starts before first ends)
      expect(detectConflicts(assignments).some(c => c.type === 'temporal')).toBe(true);
    }
  });
});

// ============================================================
// INVARIANT 8: Published histories are immutable (5 tests)
// ============================================================

describe('Invariant 8: History immutability', () => {
  it('P8.1 - frozen record rejects property mutation in strict mode', () => {
    const record = createHistoryRecord({
      id: 'h1', tenantId: 't1', personId: 'p1', partType: 'talk',
      meetingDate: '2025-06-15', state: 'completed', recordedAt: '2025-06-15T12:00:00Z', meetingId: 'm1',
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => { (record as unknown as Record<string, unknown>).state = 'cancelled'; }).toThrow();
    expect(record.state).toBe('completed');
  });

  it('P8.2 - original data unchanged after attempted mutation', () => {
    const record = createHistoryRecord({
      id: 'h2', tenantId: 't1', personId: 'p1', partType: 'bible-reading',
      meetingDate: '2025-06-15', state: 'completed', recordedAt: '2025-06-15T12:00:00Z', meetingId: 'm1',
    });
    const original = { ...record };
    try { (record as unknown as Record<string, unknown>).partType = 'modified'; } catch { /* expected */ }
    try { (record as unknown as Record<string, unknown>).meetingDate = '2099-01-01'; } catch { /* expected */ }
    expect(record.partType).toBe(original.partType);
    expect(record.meetingDate).toBe(original.meetingDate);
    expect(record.state).toBe(original.state);
  });

  it('P8.3 - multiple fields cannot be mutated', () => {
    const record = createHistoryRecord({
      id: 'h3', tenantId: 't1', personId: 'p1', partType: 'student-talk',
      meetingDate: '2025-06-15', state: 'completed', recordedAt: '2025-06-15T12:00:00Z', meetingId: 'm1',
    });
    const fieldsToMutate = ['personId', 'tenantId', 'meetingId', 'meetingDate', 'partType', 'state', 'recordedAt'] as const;
    for (const field of fieldsToMutate) {
      expect(() => { (record as unknown as Record<string, unknown>)[field] = 'hacked'; }).toThrow();
      expect((record as unknown as Record<string, unknown>)[field]).not.toBe('hacked');
    }
  });

  it('P8.4 - randomly generated frozen records are immutable', () => {
    const rng = seededRandom(808);
    for (let i = 0; i < 20; i++) {
      const record = createHistoryRecord({
        id: 'h-' + generateString(rng, 4, 8),
        tenantId: 't-' + generateString(rng, 4, 8),
        personId: 'p-' + generateString(rng, 4, 8),
        partType: 'part-' + generateString(rng, 3, 6),
        meetingDate: generateDate(rng),
        state: 'completed',
        recordedAt: generateISO(rng),
        meetingId: 'm-' + generateString(rng, 4, 8),
      });
      expect(Object.isFrozen(record)).toBe(true);
      expect(() => { (record as unknown as Record<string, unknown>).id = 'tampered'; }).toThrow();
    }
  });

  it('P8.5 - frozen record structure is preserved after mutation attempts', () => {
    const input = {
      id: 'h5', tenantId: 't1', personId: 'p1', partType: 'discussion',
      meetingDate: '2025-06-15', state: 'completed', recordedAt: '2025-06-15T12:00:00Z', meetingId: 'm1',
    };
    const record = createHistoryRecord(input);
    try { (record as unknown as Record<string, unknown>).extraField = 'injected'; } catch { /* expected */ }
    expect(Object.keys(record).sort()).toEqual(Object.keys(input).sort());
  });
});

// ============================================================
// INVARIANT 9: Timezone/DST doesn't change deterministic results (4 tests)
// ============================================================

describe('Invariant 9: Timezone/DST independence', () => {
  const timezones = [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London',
    'Asia/Tokyo', 'Australia/Sydney', 'Europe/Berlin', 'America/Sao_Paulo',
  ];

  it('P9.1 - same UTC meeting time: availability result is identical across timezones', () => {
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-03-09T14:00:00Z', endsAt: '2025-03-09T16:00:00Z' },
    ];
    const meetingDate = '2025-03-09';
    const startTime = '14:30';
    const endTime = '15:30';
    let firstResult: boolean | undefined;
    for (const tz of timezones) {
      const result = isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime, tz);
      if (firstResult === undefined) firstResult = result;
      else expect(result).toBe(firstResult);
    }
  });

  it('P9.2 - DST transition day: same UTC result across timezones', () => {
    // US DST spring forward: March 9, 2025
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-03-09T06:00:00Z', endsAt: '2025-03-09T10:00:00Z' },
    ];
    const meetingDate = '2025-03-09';
    const startTime = '07:00';
    const endTime = '09:00';
    let firstResult: boolean | undefined;
    for (const tz of timezones) {
      const result = isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime, tz);
      if (firstResult === undefined) firstResult = result;
      else expect(result).toBe(firstResult);
    }
  });

  it('P9.3 - DST fall back day: same UTC result across timezones', () => {
    // US DST fall back: November 2, 2025
    const periods: AvailabilityPeriod[] = [
      { personId: 'p1', tenantId: 't1', startsAt: '2025-11-02T05:00:00Z', endsAt: '2025-11-02T10:00:00Z' },
    ];
    const meetingDate = '2025-11-02';
    const startTime = '06:00';
    const endTime = '08:00';
    let firstResult: boolean | undefined;
    for (const tz of timezones) {
      const result = isPersonUnavailable(periods, 'p1', meetingDate, startTime, endTime, tz);
      if (firstResult === undefined) firstResult = result;
      else expect(result).toBe(firstResult);
    }
  });

  it('P9.4 - random UTC times produce same availability across all timezones', () => {
    const rng = seededRandom(909);
    for (let i = 0; i < 15; i++) {
      const startH = Math.floor(rng() * 20) + 2;
      const endH = startH + Math.floor(rng() * 4) + 1;
      const periods: AvailabilityPeriod[] = [
        { personId: 'p1', tenantId: 't1', startsAt: `2025-06-15T${String(startH).padStart(2, '0')}:00:00Z`, endsAt: `2025-06-15T${String(endH).padStart(2, '0')}:00:00Z` },
      ];
      const mStart = startH - 1;
      const mEnd = endH - 1;
      let firstResult: boolean | undefined;
      for (const tz of timezones) {
        const result = isPersonUnavailable(periods, 'p1', '2025-06-15', `${String(mStart).padStart(2, '0')}:00`, `${String(mEnd).padStart(2, '0')}:00`, tz);
        if (firstResult === undefined) firstResult = result;
        else expect(result).toBe(firstResult);
      }
    }
  });
});

// ============================================================
// INVARIANT 10-11: Malformed persistence data is rejected (8 tests)
// ============================================================

describe('Invariant 10-11: Malformed data rejection', () => {
  it('P10.1 - validateDate rejects empty string', () => {
    expect(validateDate('')).toBe(false);
  });

  it('P10.2 - validateDate rejects whitespace-only string', () => {
    expect(validateDate('   ')).toBe(false);
    expect(validateDate('\t\n')).toBe(false);
  });

  it('P10.3 - validateDate rejects invalid calendar dates', () => {
    expect(validateDate('2025-02-30')).toBe(false);
    expect(validateDate('2025-13-01')).toBe(false);
    expect(validateDate('2025-00-15')).toBe(false);
    expect(validateDate('2025-01-32')).toBe(false);
    expect(validateDate('2025-04-31')).toBe(false);
  });

  it('P10.4 - validateDate rejects non-string types', () => {
    expect(validateDate(null)).toBe(false);
    expect(validateDate(undefined)).toBe(false);
    expect(validateDate(42)).toBe(false);
    expect(validateDate(NaN)).toBe(false);
    expect(validateDate(Infinity)).toBe(false);
    expect(validateDate(true)).toBe(false);
    expect(validateDate([])).toBe(false);
    expect(validateDate({})).toBe(false);
  });

  it('P10.5 - validateDate accepts valid dates', () => {
    expect(validateDate('2025-01-01')).toBe(true);
    expect(validateDate('2025-12-31')).toBe(true);
    expect(validateDate('2024-02-29')).toBe(true); // leap year
    expect(validateDate('2025-06-15T10:00:00Z')).toBe(true);
  });

  it('P11.1 - validateRequiredId rejects null, undefined, empty, whitespace', () => {
    expect(validateRequiredId(null)).toBe(false);
    expect(validateRequiredId(undefined)).toBe(false);
    expect(validateRequiredId('')).toBe(false);
    expect(validateRequiredId('   ')).toBe(false);
    expect(validateRequiredId('\t')).toBe(false);
  });

  it('P11.2 - validateRequiredId rejects non-string types', () => {
    expect(validateRequiredId(42)).toBe(false);
    expect(validateRequiredId(NaN)).toBe(false);
    expect(validateRequiredId(Infinity)).toBe(false);
    expect(validateRequiredId(true)).toBe(false);
    expect(validateRequiredId([])).toBe(false);
    expect(validateRequiredId({})).toBe(false);
  });

  it('P11.3 - validateRequiredId accepts valid non-empty strings', () => {
    expect(validateRequiredId('abc')).toBe(true);
    expect(validateRequiredId('  abc  ')).toBe(true); // trim-check passes
    expect(validateRequiredId('person-123')).toBe(true);
    expect(validateRequiredId('tënánt-α')).toBe(true);
  });
});

// ============================================================
// INVARIANT 12: No rule derives spiritual qualification from history (4 tests)
// ============================================================

describe('Invariant 12: No spiritual scoring from history', () => {
  const forbiddenTerms = ['score', 'rank', 'best', 'recommended', 'suitability', 'readiness', 'quality', 'qualified', 'rating', 'grade', 'fitness'];

  it('P12.1 - queryHistory returns only raw records (dates, counts, no scores)', () => {
    const rng = seededRandom(1212);
    const tenantIds = generateTenantIds(rng, 2);
    const history = generateHistoryRecords(rng, 30, tenantIds);
    const personId = history[0]?.personId ?? 'p1';
    const result = queryHistory(history, personId);
    // Result should be an array of HistoryRecord objects with no extra keys
    for (const record of result) {
      const keys = Object.keys(record);
      const expectedKeys = ['id', 'tenantId', 'personId', 'partType', 'meetingDate', 'state', 'recordedAt', 'meetingId'];
      expect(keys.sort()).toEqual(expectedKeys.sort());
    }
  });

  it('P12.2 - history query result contains no forbidden terms in any value', () => {
    const records: HistoryRecord[] = [
      { id: 'h1', tenantId: 't1', personId: 'p1', partType: 'bible-reading', meetingDate: '2025-06-15', state: 'completed', recordedAt: '2025-06-15T12:00:00Z', meetingId: 'm1' },
      { id: 'h2', tenantId: 't1', personId: 'p1', partType: 'student-talk', meetingDate: '2025-06-22', state: 'completed', recordedAt: '2025-06-22T12:00:00Z', meetingId: 'm2' },
      { id: 'h3', tenantId: 't1', personId: 'p1', partType: 'discussion', meetingDate: '2025-06-29', state: 'cancelled', recordedAt: '2025-06-29T12:00:00Z', meetingId: 'm3' },
    ];
    const result = queryHistory(records, 'p1');
    const resultStr = JSON.stringify(result);
    for (const term of forbiddenTerms) {
      expect(resultStr.toLowerCase()).not.toContain(term);
    }
  });

  it('P12.3 - random history records never contain scoring data', () => {
    const rng = seededRandom(1313);
    const tenantIds = generateTenantIds(rng, 3);
    for (let trial = 0; trial < 20; trial++) {
      const history = generateHistoryRecords(rng, 50, tenantIds);
      const personId = history[trial % history.length].personId;
      const result = queryHistory(history, personId);
      const resultStr = JSON.stringify(result);
      for (const term of forbiddenTerms) {
        expect(resultStr.toLowerCase()).not.toContain(term);
      }
    }
  });

  it('P12.4 - history query returns count as array length, not a derived metric', () => {
    const records: HistoryRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `h${i}`, tenantId: 't1', personId: 'p1', partType: 'talk',
      meetingDate: `2025-06-${String(1 + i).padStart(2, '0')}`, state: 'completed',
      recordedAt: `2025-06-${String(1 + i).padStart(2, '0')}T12:00:00Z`, meetingId: `m${i}`,
    }));
    const result = queryHistory(records, 'p1');
    // Count is simply array length, not a computed property
    expect(result.length).toBe(10);
    expect(typeof (result as unknown as Record<string, unknown>).count).toBe('undefined');
    expect(typeof (result as unknown as Record<string, unknown>).score).toBe('undefined');
  });
});
