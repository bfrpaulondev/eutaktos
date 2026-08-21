import { describe, expect, it } from 'vitest';
import {
  assignSlotToClass,
  assertClassTenant,
  createAuxiliaryClass,
  createMainClass,
  createMeetingClass,
  filterAuxiliaryClasses,
  findMainClass,
  orderClassesByOrdering,
  removeSlotFromClass,
  totalCapacity,
  validateNoSlotOverlap,
} from './meeting-classes';
import type { MeetingClass } from './meeting-classes';

const NOW = '2026-01-15T10:00:00Z';
const TENANT = 'tenant-1';
const MEETING = 'meeting-1';

function mainClass(overrides?: Partial<Parameters<typeof createMeetingClass>[0]>): Readonly<MeetingClass> {
  return createMeetingClass({
    id: 'mc-main',
    tenantId: TENANT,
    meetingId: MEETING,
    classType: 'main',
    ordering: 0,
    now: NOW,
    ...overrides,
  });
}

function auxClass(id: string, ordering: number, overrides?: Partial<Parameters<typeof createMeetingClass>[0]>): Readonly<MeetingClass> {
  return createMeetingClass({
    id,
    tenantId: TENANT,
    meetingId: MEETING,
    classType: 'auxiliary',
    ordering,
    now: NOW,
    ...overrides,
  });
}

// ── Creation & validation ──────────────────────────────────────────────────

describe('createMeetingClass', () => {
  it('creates a valid main class', () => {
    const mc = mainClass();
    expect(mc.id).toBe('mc-main');
    expect(mc.tenantId).toBe(TENANT);
    expect(mc.meetingId).toBe(MEETING);
    expect(mc.classType).toBe('main');
    expect(mc.ordering).toBe(0);
    expect(mc.createdAt).toBe(NOW);
    expect(mc.slotIds).toEqual([]);
    expect(mc.configuration).toEqual({});
  });

  it('creates a valid auxiliary class', () => {
    const mc = auxClass('mc-aux1', 1);
    expect(mc.classType).toBe('auxiliary');
    expect(mc.ordering).toBe(1);
  });

  it('freezes the returned object', () => {
    const mc = mainClass();
    expect(Object.isFrozen(mc)).toBe(true);
    expect(Object.isFrozen(mc.slotIds)).toBe(true);
    expect(Object.isFrozen(mc.configuration)).toBe(true);
  });

  it('trims required string fields', () => {
    const mc = createMeetingClass({
      id: '  mc-1  ',
      tenantId: '  tenant-1  ',
      meetingId: '  meeting-1  ',
      classType: 'main',
      ordering: 0,
      now: NOW,
    });
    expect(mc.id).toBe('mc-1');
    expect(mc.tenantId).toBe('tenant-1');
    expect(mc.meetingId).toBe('meeting-1');
  });

  it('rejects missing classId', () => {
    expect(() => createMeetingClass({
      id: '', tenantId: TENANT, meetingId: MEETING,
      classType: 'main', ordering: 0, now: NOW,
    })).toThrow(/classId is required/);
  });

  it('rejects missing tenantId', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: '  ', meetingId: MEETING,
      classType: 'main', ordering: 0, now: NOW,
    })).toThrow(/tenantId is required/);
  });

  it('rejects missing meetingId', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: '',
      classType: 'main', ordering: 0, now: NOW,
    })).toThrow(/meetingId is required/);
  });

  it('rejects invalid class type', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'invalid' as any, ordering: 0, now: NOW,
    })).toThrow(/Invalid meeting class type/);
  });

  it('rejects invalid now timestamp', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'main', ordering: 0, now: 'not-a-date',
    })).toThrow(/Invalid ISO date/);
  });

  it('accepts locationId when provided', () => {
    const mc = mainClass({ locationId: 'loc-1' });
    expect(mc.locationId).toBe('loc-1');
  });

  it('trims and stores locationId', () => {
    const mc = mainClass({ locationId: '  loc-1  ' });
    expect(mc.locationId).toBe('loc-1');
  });

  it('omits locationId when empty/whitespace', () => {
    const mc = mainClass({ locationId: '   ' });
    expect(mc.locationId).toBeUndefined();
  });

  it('accepts configuration with maxStudents', () => {
    const mc = mainClass({ configuration: { maxStudents: 40 } });
    expect(mc.configuration.maxStudents).toBe(40);
  });

  it('freezes configuration', () => {
    const mc = mainClass({ configuration: { maxStudents: 40 } });
    expect(Object.isFrozen(mc.configuration)).toBe(true);
  });

  it('rejects negative maxStudents', () => {
    expect(() => mainClass({ configuration: { maxStudents: -1 } })).toThrow(/maxStudents must be a non-negative integer/);
  });

  it('rejects non-integer maxStudents', () => {
    expect(() => mainClass({ configuration: { maxStudents: 1.5 } })).toThrow(/maxStudents must be a non-negative integer/);
  });

  it('rejects non-object configuration', () => {
    expect(() => mainClass({ configuration: 'bad' as any })).toThrow(/configuration must be an object/);
  });

  it('rejects array configuration', () => {
    expect(() => mainClass({ configuration: [] as any })).toThrow(/configuration must be an object/);
  });

  it('accepts initial slotIds', () => {
    const mc = mainClass({ slotIds: ['slot-1', 'slot-2'] });
    expect(mc.slotIds).toEqual(['slot-1', 'slot-2']);
  });

  it('rejects duplicate slotIds within a class', () => {
    expect(() => mainClass({ slotIds: ['slot-1', 'slot-1'] })).toThrow(/Duplicate slot IDs/);
  });

  it('rejects empty string slotId', () => {
    expect(() => mainClass({ slotIds: ['slot-1', '  '] })).toThrow(/non-empty string/);
  });

  it('rejects main class with ordering != 0', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'main', ordering: 1, now: NOW,
    })).toThrow(/Main class must have ordering 0/);
  });

  it('rejects auxiliary class with ordering 0', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'auxiliary', ordering: 0, now: NOW,
    })).toThrow(/Auxiliary class must have ordering >= 1/);
  });

  it('rejects negative ordering', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'auxiliary', ordering: -1, now: NOW,
    })).toThrow(/ordering must be a non-negative integer/);
  });

  it('rejects non-integer ordering', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'auxiliary', ordering: 1.5, now: NOW,
    })).toThrow(/ordering must be a non-negative integer/);
  });
});

// ── Convenience factories ──────────────────────────────────────────────────

describe('createMainClass', () => {
  it('creates a main class with ordering 0', () => {
    const mc = createMainClass(MEETING, TENANT, NOW);
    expect(mc.classType).toBe('main');
    expect(mc.ordering).toBe(0);
    expect(mc.meetingId).toBe(MEETING);
    expect(mc.tenantId).toBe(TENANT);
  });

  it('freezes the returned object', () => {
    const mc = createMainClass(MEETING, TENANT, NOW);
    expect(Object.isFrozen(mc)).toBe(true);
  });
});

describe('createAuxiliaryClass', () => {
  it('creates an auxiliary class with given ordering', () => {
    const mc = createAuxiliaryClass(MEETING, TENANT, 2, NOW);
    expect(mc.classType).toBe('auxiliary');
    expect(mc.ordering).toBe(2);
  });

  it('rejects ordering < 1', () => {
    expect(() => createAuxiliaryClass(MEETING, TENANT, 0, NOW)).toThrow(/Auxiliary class must have ordering >= 1/);
  });

  it('freezes the returned object', () => {
    const mc = createAuxiliaryClass(MEETING, TENANT, 1, NOW);
    expect(Object.isFrozen(mc)).toBe(true);
  });
});

// ── Slot associations ──────────────────────────────────────────────────────

describe('assignSlotToClass', () => {
  it('adds a slot to a class', () => {
    const mc = mainClass();
    const updated = assignSlotToClass(mc, 'slot-a');
    expect(updated.slotIds).toEqual(['slot-a']);
    expect(mc.slotIds).toEqual([]); // original unchanged
  });

  it('adds multiple slots sequentially', () => {
    const mc = mainClass();
    const withOne = assignSlotToClass(mc, 'slot-a');
    const withTwo = assignSlotToClass(withOne, 'slot-b');
    expect(withTwo.slotIds).toEqual(['slot-a', 'slot-b']);
  });

  it('freezes the new slot array', () => {
    const mc = mainClass();
    const updated = assignSlotToClass(mc, 'slot-a');
    expect(Object.isFrozen(updated.slotIds)).toBe(true);
  });

  it('freezes the returned object', () => {
    const mc = mainClass();
    const updated = assignSlotToClass(mc, 'slot-a');
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('rejects duplicate slot assignment', () => {
    const mc = assignSlotToClass(mainClass(), 'slot-a');
    expect(() => assignSlotToClass(mc, 'slot-a')).toThrow(/already assigned/);
  });

  it('rejects empty slot ID', () => {
    expect(() => assignSlotToClass(mainClass(), '')).toThrow(/slotId is required/);
  });
});

describe('removeSlotFromClass', () => {
  it('removes a slot from a class', () => {
    const mc = assignSlotToClass(mainClass(), 'slot-a');
    const updated = removeSlotFromClass(mc, 'slot-a');
    expect(updated.slotIds).toEqual([]);
  });

  it('preserves other slots', () => {
    const mc = assignSlotToClass(assignSlotToClass(mainClass(), 'slot-a'), 'slot-b');
    const updated = removeSlotFromClass(mc, 'slot-a');
    expect(updated.slotIds).toEqual(['slot-b']);
  });

  it('freezes the returned object', () => {
    const mc = assignSlotToClass(mainClass(), 'slot-a');
    const updated = removeSlotFromClass(mc, 'slot-a');
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('rejects removing non-assigned slot', () => {
    expect(() => removeSlotFromClass(mainClass(), 'slot-x')).toThrow(/not assigned/);
  });

  it('rejects empty slot ID', () => {
    expect(() => removeSlotFromClass(mainClass(), '')).toThrow(/slotId is required/);
  });
});

// ── Slot overlap detection ─────────────────────────────────────────────────

describe('validateNoSlotOverlap', () => {
  it('passes when slots are unique across classes', () => {
    const classes = [
      assignSlotToClass(mainClass(), 'slot-1'),
      assignSlotToClass(auxClass('a1', 1), 'slot-2'),
    ];
    expect(() => validateNoSlotOverlap(classes)).not.toThrow();
  });

  it('passes when no slots are assigned', () => {
    expect(() => validateNoSlotOverlap([])).not.toThrow();
  });

  it('passes when all classes have empty slots', () => {
    const classes = [mainClass(), auxClass('a1', 1)];
    expect(() => validateNoSlotOverlap(classes)).not.toThrow();
  });

  it('throws when a slot appears in multiple classes', () => {
    const classes = [
      assignSlotToClass(mainClass(), 'slot-dup'),
      assignSlotToClass(auxClass('a1', 1), 'slot-dup'),
    ];
    expect(() => validateNoSlotOverlap(classes)).toThrow(/multiple classes/);
  });

  it('includes both class IDs in the error message', () => {
    const classes = [
      assignSlotToClass(mainClass({ id: 'c1' }), 'slot-dup'),
      assignSlotToClass(auxClass('c2', 1), 'slot-dup'),
    ];
    expect(() => validateNoSlotOverlap(classes)).toThrow(/c1 and c2/);
  });

  it('detects overlap across three classes', () => {
    const classes = [
      assignSlotToClass(mainClass({ id: 'c1' }), 'slot-x'),
      assignSlotToClass(auxClass('c2', 1), 'slot-y'),
      assignSlotToClass(auxClass('c3', 2), 'slot-x'),
    ];
    expect(() => validateNoSlotOverlap(classes)).toThrow(/c1 and c3/);
  });
});

// ── Query helpers ──────────────────────────────────────────────────────────

describe('findMainClass', () => {
  it('returns the main class from a mixed list', () => {
    const classes = [auxClass('a1', 1), mainClass(), auxClass('a2', 2)];
    const main = findMainClass(classes);
    expect(main).toBeDefined();
    expect(main!.classType).toBe('main');
  });

  it('returns undefined when no main class exists', () => {
    const classes = [auxClass('a1', 1), auxClass('a2', 2)];
    expect(findMainClass(classes)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(findMainClass([])).toBeUndefined();
  });

  it('returns the only main class when multiple exist (first match)', () => {
    const classes = [
      mainClass({ id: 'main-1' }),
      mainClass({ id: 'main-2' }),
    ];
    const result = findMainClass(classes);
    expect(result!.id).toBe('main-1');
  });
});

describe('filterAuxiliaryClasses', () => {
  it('returns only auxiliary classes', () => {
    const classes = [auxClass('a1', 1), mainClass(), auxClass('a2', 2)];
    const aux = filterAuxiliaryClasses(classes);
    expect(aux).toHaveLength(2);
    expect(aux.every(c => c.classType === 'auxiliary')).toBe(true);
  });

  it('returns empty array when no auxiliary classes', () => {
    expect(filterAuxiliaryClasses([mainClass()])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterAuxiliaryClasses([])).toEqual([]);
  });
});

describe('orderClassesByOrdering', () => {
  it('sorts classes by ordering ascending', () => {
    const classes = [auxClass('a2', 2), mainClass(), auxClass('a1', 1)];
    const sorted = orderClassesByOrdering(classes);
    expect(sorted.map(c => c.ordering)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input array', () => {
    const classes = [auxClass('a2', 2), mainClass(), auxClass('a1', 1)];
    const originalOrder = classes.map(c => c.id);
    orderClassesByOrdering(classes);
    expect(classes.map(c => c.id)).toEqual(originalOrder);
  });

  it('returns empty array for empty input', () => {
    expect(orderClassesByOrdering([])).toEqual([]);
  });
});

describe('totalCapacity', () => {
  it('sums maxStudents across all classes', () => {
    const classes = [
      mainClass({ configuration: { maxStudents: 100 } }),
      auxClass('a1', 1, { configuration: { maxStudents: 30 } }),
      auxClass('a2', 2, { configuration: { maxStudents: 20 } }),
    ];
    expect(totalCapacity(classes)).toBe(150);
  });

  it('treats missing maxStudents as 0', () => {
    const classes = [
      mainClass(),
      auxClass('a1', 1, { configuration: { maxStudents: 20 } }),
    ];
    expect(totalCapacity(classes)).toBe(20);
  });

  it('returns 0 for empty array', () => {
    expect(totalCapacity([])).toBe(0);
  });

  it('returns 0 when all classes lack maxStudents', () => {
    const classes = [mainClass(), auxClass('a1', 1)];
    expect(totalCapacity(classes)).toBe(0);
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────

describe('assertClassTenant', () => {
  it('passes for matching tenant', () => {
    const mc = mainClass();
    expect(() => assertClassTenant(mc, TENANT)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    const mc = mainClass();
    expect(() => assertClassTenant(mc, 'other-tenant')).toThrow(/Cross-tenant/);
  });

  it('rejects empty tenantId', () => {
    expect(() => assertClassTenant(mainClass(), '')).toThrow(/tenantId is required/);
  });
});

// ── Immutability ───────────────────────────────────────────────────────────

describe('immutability', () => {
  it('slotIds array cannot be mutated on frozen objects', () => {
    const mc = mainClass();
    expect(() => {
      (mc.slotIds as any).push('hack');
    }).toThrow();
  });

  it('configuration cannot be mutated on frozen objects', () => {
    const mc = mainClass({ configuration: { maxStudents: 40 } });
    expect(() => {
      (mc.configuration as any).maxStudents = 999;
    }).toThrow();
  });

  it('createMeetingClass returns a new frozen object each time', () => {
    const a = mainClass();
    const b = mainClass();
    expect(a).not.toBe(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(b)).toBe(true);
  });
});

// ── Malformed inputs ───────────────────────────────────────────────────────

describe('malformed inputs', () => {
  it('rejects undefined id', () => {
    expect(() => createMeetingClass({
      id: undefined as any, tenantId: TENANT, meetingId: MEETING,
      classType: 'main', ordering: 0, now: NOW,
    })).toThrow(/classId must be a string/);
  });

  it('rejects non-string tenantId', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: 42 as any, meetingId: MEETING,
      classType: 'main', ordering: 0, now: NOW,
    })).toThrow(/tenantId must be a string/);
  });

  it('rejects string ordering', () => {
    expect(() => createMeetingClass({
      id: 'mc-1', tenantId: TENANT, meetingId: MEETING,
      classType: 'main', ordering: '0' as any, now: NOW,
    })).toThrow(/ordering must be a non-negative integer/);
  });

  it('rejects non-array slotIds', () => {
    expect(() => mainClass({ slotIds: 'slot-1' as any })).toThrow(/slotIds must be an array/);
  });
});
