import type { MidweekMeeting, NonStudentAssignment, StudentAssignment } from '@eutaktos/domain';

export interface HourglassHandoffPerson {
  readonly id: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly externalHourglassPersonId?: string;
}
export interface HourglassHandoffItem {
  readonly date: string;
  readonly meetingId: string;
  readonly part: string;
  readonly personId: string;
  readonly person: string;
  readonly externalHourglassPersonId?: string;
  readonly state: 'assigned' | 'cancelled' | 'completed';
  readonly observation: string;
}
export interface HourglassHandoff {
  readonly kind: 'hourglass-handoff';
  readonly compatibility: 'manual-entry-only';
  readonly items: readonly HourglassHandoffItem[];
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
function assertTenant(tenantId: string, value: { tenantId: string }): void { if (value.tenantId !== tenantId) throw new Error('Cross-tenant handoff access denied'); }
function required(value: string, label: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`${label} is required`); return normalized; }

/**
 * Produces a manual Hourglass handoff only. No schema in the demonstrated export
 * proves that Hourglass can import externally authored plans, so callers must not
 * label this output as an Hourglass-compatible import file.
 */
export function createHourglassHandoff(input: {
  tenantId: string;
  meetings: readonly Readonly<MidweekMeeting>[];
  studentAssignments: readonly Readonly<StudentAssignment>[];
  nonStudentAssignments: readonly Readonly<NonStudentAssignment>[];
  people: readonly HourglassHandoffPerson[];
}): Readonly<HourglassHandoff> {
  const tenantId = required(input.tenantId, 'tenantId');
  const meetings = new Map<string, Readonly<MidweekMeeting>>();
  for (const meeting of input.meetings) { assertTenant(tenantId, meeting); meetings.set(meeting.id, meeting); }
  const people = new Map<string, HourglassHandoffPerson>();
  for (const person of input.people) {
    assertTenant(tenantId, person);
    if (people.has(person.id)) throw new Error('Duplicate handoff person');
    people.set(person.id, person);
  }
  const items: HourglassHandoffItem[] = [];
  const add = (assignment: Readonly<StudentAssignment> | Readonly<NonStudentAssignment>, personId: string, part: string) => {
    assertTenant(tenantId, assignment);
    const meeting = meetings.get(assignment.meetingId); if (!meeting) throw new Error('Assignment references an unknown meeting');
    const person = people.get(personId); if (!person) throw new Error('Assignment references an unknown person');
    items.push(Object.freeze({ date: meeting.date, meetingId: meeting.id, part: required(part, 'part'), personId: person.id, person: required(person.displayName, 'person displayName'), ...(person.externalHourglassPersonId ? { externalHourglassPersonId: person.externalHourglassPersonId } : {}), state: assignment.state, observation: 'Manual Eutaktos handoff — verify and enter in Hourglass' }));
  };
  for (const assignment of input.studentAssignments) {
    const meeting = meetings.get(assignment.meetingId); if (!meeting) throw new Error('Assignment references an unknown meeting');
    const slot = meeting.slots.find(item => item.id === assignment.slotId); if (!slot) throw new Error('Student assignment references an unknown meeting slot');
    add(assignment, assignment.studentId, slot.titleKey);
  }
  for (const assignment of input.nonStudentAssignments) add(assignment, assignment.personId, assignment.role);
  items.sort((left, right) => left.date.localeCompare(right.date) || left.meetingId.localeCompare(right.meetingId) || left.part.localeCompare(right.part) || left.person.localeCompare(right.person));
  return Object.freeze({ kind: 'hourglass-handoff', compatibility: 'manual-entry-only', items: Object.freeze(items) });
}

export function serializeHourglassHandoffJson(handoff: Readonly<HourglassHandoff>): string { return `${JSON.stringify(handoff, null, 2)}\n`; }
export function serializeHourglassHandoffCsv(handoff: Readonly<HourglassHandoff>): string {
  const headers = ['date', 'meeting', 'part', 'person', 'externalHourglassPersonId', 'state', 'observation'];
  const rows = handoff.items.map(item => [item.date, item.meetingId, item.part, item.person, item.externalHourglassPersonId ?? '', item.state, item.observation]);
  return `${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
export function renderHourglassHandoffPrintView(handoff: Readonly<HourglassHandoff>): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  const rows = handoff.items.map(item => `<tr><td>${escape(item.date)}</td><td>${escape(item.meetingId)}</td><td>${escape(item.part)}</td><td>${escape(item.person)}</td><td>${escape(item.state)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Hourglass handoff</title></head><body><h1>Hourglass handoff</h1><p>Manual entry only — not an Hourglass import file.</p><table><thead><tr><th>Date</th><th>Meeting</th><th>Part</th><th>Person</th><th>State</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
