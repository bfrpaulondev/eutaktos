import { describe, expect, it } from 'vitest';
import { createHourglassHandoff, renderHourglassHandoffPrintView, serializeHourglassHandoffCsv, serializeHourglassHandoffJson } from './hourglass-handoff';

const meeting = { id: 'meeting-1', tenantId: 'tenant-a', date: '2026-09-02', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft' as const, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', slots: [{ id: 'slot-1', position: 1, durationMinutes: 5, titleKey: '=Reading' }] };
const assignment = { id: 'assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1', assistantId: null, assistantIsRequired: false, state: 'assigned' as const, assignedAt: '2026-08-01T00:00:00.000Z', cancelledAt: null, completedAt: null };

describe('Hourglass handoff', () => {
  it('creates a manual-only handoff from real Eutaktos assignment shapes', () => {
    const handoff = createHourglassHandoff({ tenantId: 'tenant-a', meetings: [meeting], studentAssignments: [assignment], nonStudentAssignments: [], people: [{ id: 'person-1', displayName: 'Ana Exemplo', externalHourglassPersonId: 'hourglass:publisher:101' }] });
    expect(handoff.compatibility).toBe('manual-entry-only');
    expect(handoff.items[0]).toMatchObject({ date: '2026-09-02', part: '=Reading', person: 'Ana Exemplo', externalHourglassPersonId: 'hourglass:publisher:101' });
    expect(serializeHourglassHandoffJson(handoff)).toContain('manual-entry-only');
    expect(serializeHourglassHandoffCsv(handoff)).toContain("'=Reading");
    expect(renderHourglassHandoffPrintView(handoff)).toContain('Manual entry only');
  });

  it('does not mix resources from another tenant', () => {
    expect(() => createHourglassHandoff({ tenantId: 'tenant-a', meetings: [{ ...meeting, tenantId: 'tenant-b' }], studentAssignments: [], nonStudentAssignments: [], people: [] })).toThrow('Cross-tenant handoff access denied');
  });
});
