import { CandidateQueryService, MidweekSchedulingService, ScheduleViewService } from '@eutaktos/application';
import { OPERATIONAL_MIDWEEK_PARTS, type MidweekMeeting, type NonStudentAssignment, type StudentAssignment } from '@eutaktos/domain';
import { requireCapability, type VerifiedPrincipal } from './_auth';
import type { EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';
import { personDto } from './_entity-read';
import { SchedulingRuntimeIds, SchedulingSnapshotUnitOfWork } from './_midweek-uow';

export interface MidweekMeetingOverviewDto {
  readonly id: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId?: string;
  readonly state: MidweekMeeting['state'];
  readonly slots: readonly { readonly id: string; readonly position: number; readonly durationMinutes: number; readonly titleKey: string; readonly partDefinitionId?: string }[];
}

export interface StudentAssignmentOverviewDto {
  readonly id: string; readonly meetingId: string; readonly slotId: string; readonly studentId: string; readonly studentDisplayName: string;
  readonly assistantId: string | null; readonly assistantDisplayName: string | null; readonly state: StudentAssignment['state'];
}

export interface NonStudentAssignmentOverviewDto {
  readonly id: string; readonly meetingId: string; readonly slotId: string; readonly personId: string; readonly personDisplayName: string;
  readonly role: string; readonly state: NonStudentAssignment['state'];
}

export interface MidweekOverviewDto {
  readonly meetings: readonly MidweekMeetingOverviewDto[];
  readonly studentAssignments: readonly StudentAssignmentOverviewDto[];
  readonly nonStudentAssignments: readonly NonStudentAssignmentOverviewDto[];
}

function objectData(row: EntityRow, tenantId: string): Readonly<Record<string, unknown>> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored scheduling entity');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored scheduling entity identity');
  return data;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid stored ${field}`);
  return value;
}

function meetingDto(row: EntityRow, tenantId: string): MidweekMeetingOverviewDto {
  const data = objectData(row, tenantId);
  const state = data.state;
  if (state !== 'draft' && state !== 'published' && state !== 'cancelled' && state !== 'archived') throw new Error('Invalid stored meeting state');
  if (!Array.isArray(data.slots)) throw new Error('Invalid stored meeting slots');
  const slots = data.slots.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid stored meeting slot');
    const slot = raw as Readonly<Record<string, unknown>>;
    if (typeof slot.position !== 'number' || !Number.isInteger(slot.position) || typeof slot.durationMinutes !== 'number' || !Number.isFinite(slot.durationMinutes)) throw new Error('Invalid stored meeting slot');
    return Object.freeze({ id: stringValue(slot.id, 'slot id'), position: slot.position, durationMinutes: slot.durationMinutes, titleKey: stringValue(slot.titleKey, 'slot title'), ...(typeof slot.partDefinitionId === 'string' && slot.partDefinitionId.trim() ? { partDefinitionId: slot.partDefinitionId } : {}) });
  }).sort((left, right) => left.position - right.position);
  return Object.freeze({ id: row.entity_id, date: stringValue(data.date, 'meeting date'), localTime: stringValue(data.localTime, 'meeting time'), timezone: stringValue(data.timezone, 'meeting timezone'), ...(typeof data.locationId === 'string' && data.locationId.trim() ? { locationId: data.locationId } : {}), state, slots: Object.freeze(slots) });
}

function studentAssignment(row: EntityRow, tenantId: string, names: ReadonlyMap<string, string>): StudentAssignmentOverviewDto {
  const data = objectData(row, tenantId);
  const state = data.state;
  if (state !== 'assigned' && state !== 'cancelled' && state !== 'completed') throw new Error('Invalid stored student assignment state');
  const studentId = stringValue(data.studentId, 'student id');
  const assistantId = data.assistantId === null ? null : stringValue(data.assistantId, 'assistant id');
  return Object.freeze({ id: row.entity_id, meetingId: stringValue(data.meetingId, 'meeting id'), slotId: stringValue(data.slotId, 'slot id'), studentId, studentDisplayName: names.get(studentId) ?? studentId, assistantId, assistantDisplayName: assistantId ? (names.get(assistantId) ?? assistantId) : null, state });
}

function nonStudentAssignment(row: EntityRow, tenantId: string, names: ReadonlyMap<string, string>): NonStudentAssignmentOverviewDto {
  const data = objectData(row, tenantId);
  const state = data.state;
  if (state !== 'assigned' && state !== 'cancelled' && state !== 'completed') throw new Error('Invalid stored non-student assignment state');
  const personId = stringValue(data.personId, 'person id');
  return Object.freeze({ id: row.entity_id, meetingId: stringValue(data.meetingId, 'meeting id'), slotId: stringValue(data.slotId, 'slot id'), personId, personDisplayName: names.get(personId) ?? personId, role: stringValue(data.role, 'assignment role'), state });
}

function operationalPartRows(tenantId: string, stored: readonly EntityRow[]): readonly EntityRow[] {
  const ids = new Set(stored.map(row => row.entity_id));
  const defaults: EntityRow[] = OPERATIONAL_MIDWEEK_PARTS
    .filter(part => !ids.has(part.id))
    .map(part => Object.freeze({ tenant_id: tenantId, entity_type: 'midweek-part-definition', entity_id: part.id, data: Object.freeze({ id: part.id, tenantId, type: part.type, titleKey: part.titleKey, durationMinutes: part.durationMinutes, position: part.position, studentNeeded: part.studentNeeded, assistantRequirement: part.assistantRequirement, ...(part.eligibilityTypeId ? { eligibilityTypeId: part.eligibilityTypeId } : {}), ...(part.assistantEligibilityTypeId ? { assistantEligibilityTypeId: part.assistantEligibilityTypeId } : {}), tenantOverrides: part.tenantOverrides }), version: 1 }));
  return Object.freeze([...stored, ...defaults]);
}

async function schedulingRows(database: SupabaseRestDatabase, tenantId: string) {
  const [meetings, studentAssignments, nonStudentAssignments, people, storedPartDefinitions, assignmentHistory] = await Promise.all([
    database.entities(tenantId, 'midweek-meeting'),
    database.entities(tenantId, 'student-assignment'),
    database.entities(tenantId, 'non-student-assignment'),
    database.entities(tenantId, 'person'),
    database.entities(tenantId, 'midweek-part-definition'),
    database.listAssignmentHistory(tenantId).catch(() => []),
  ]);
  return Object.freeze({ meetings, studentAssignments, nonStudentAssignments, people, partDefinitions: operationalPartRows(tenantId, storedPartDefinitions), assignmentHistory });
}

export async function loadMidweekScheduling(database: SupabaseRestDatabase, principal: VerifiedPrincipal) {
  const rows = await schedulingRows(database, principal.tenantId);
  const unitOfWork = new SchedulingSnapshotUnitOfWork(principal.tenantId, rows);
  return Object.freeze({ service: new MidweekSchedulingService(unitOfWork, new SchedulingRuntimeIds()), unitOfWork });
}

export async function loadCandidateQueryService(database: SupabaseRestDatabase, principal: VerifiedPrincipal) {
  const rows = await schedulingRows(database, principal.tenantId);
  const unitOfWork = new SchedulingSnapshotUnitOfWork(principal.tenantId, rows);
  return Object.freeze({ service: new CandidateQueryService(unitOfWork), unitOfWork });
}

export async function loadScheduleViewService(database: SupabaseRestDatabase, principal: VerifiedPrincipal) {
  const rows = await schedulingRows(database, principal.tenantId);
  const unitOfWork = new SchedulingSnapshotUnitOfWork(principal.tenantId, rows);
  return Object.freeze({ service: new ScheduleViewService(unitOfWork), unitOfWork });
}

export async function loadMidweekOverview(database: SupabaseRestDatabase, principal: VerifiedPrincipal): Promise<Readonly<MidweekOverviewDto>> {
  requireCapability(principal, 'schedule.read');
  const rows = await schedulingRows(database, principal.tenantId);
  const names = new Map<string, string>();
  for (const row of rows.people) {
    const person = personDto(row, principal.tenantId);
    names.set(person.id, person.displayName);
  }
  const meetings = rows.meetings.map(row => meetingDto(row, principal.tenantId)).sort((left, right) => left.date.localeCompare(right.date) || left.localTime.localeCompare(right.localTime) || left.id.localeCompare(right.id));
  const meetingOrder = new Map(meetings.map((meeting, index) => [meeting.id, index]));
  const students = rows.studentAssignments.map(row => studentAssignment(row, principal.tenantId, names)).sort((left, right) => (meetingOrder.get(left.meetingId) ?? Number.MAX_SAFE_INTEGER) - (meetingOrder.get(right.meetingId) ?? Number.MAX_SAFE_INTEGER) || left.slotId.localeCompare(right.slotId) || left.id.localeCompare(right.id));
  const nonStudents = rows.nonStudentAssignments.map(row => nonStudentAssignment(row, principal.tenantId, names)).sort((left, right) => (meetingOrder.get(left.meetingId) ?? Number.MAX_SAFE_INTEGER) - (meetingOrder.get(right.meetingId) ?? Number.MAX_SAFE_INTEGER) || left.slotId.localeCompare(right.slotId) || left.id.localeCompare(right.id));
  return Object.freeze({ meetings: Object.freeze(meetings), studentAssignments: Object.freeze(students), nonStudentAssignments: Object.freeze(nonStudents) });
}
