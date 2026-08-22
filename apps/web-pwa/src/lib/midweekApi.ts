export type MidweekMeetingState = 'draft' | 'published' | 'cancelled' | 'archived';
export type AssignmentState = 'assigned' | 'cancelled' | 'completed';

export interface MidweekSlotDto {
  readonly id: string;
  readonly position: number;
  readonly durationMinutes: number;
  readonly titleKey: string;
  readonly partDefinitionId?: string;
}
export interface MidweekMeetingDto {
  readonly id: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId?: string;
  readonly state: MidweekMeetingState;
  readonly slots: readonly MidweekSlotDto[];
}
export interface StudentAssignmentDto {
  readonly id: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly studentId: string;
  readonly studentDisplayName: string;
  readonly assistantId: string | null;
  readonly assistantDisplayName: string | null;
  readonly state: AssignmentState;
}
export interface NonStudentAssignmentDto {
  readonly id: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly personId: string;
  readonly personDisplayName: string;
  readonly role: string;
  readonly state: AssignmentState;
}
export interface MidweekOverviewDto {
  readonly meetings: readonly MidweekMeetingDto[];
  readonly studentAssignments: readonly StudentAssignmentDto[];
  readonly nonStudentAssignments: readonly NonStudentAssignmentDto[];
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${label}`);
  return value;
}
function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}
function state(value: unknown): AssignmentState {
  if (value !== 'assigned' && value !== 'cancelled' && value !== 'completed') throw new Error('Invalid assignment state');
  return value;
}
function meetingState(value: unknown): MidweekMeetingState {
  if (value !== 'draft' && value !== 'published' && value !== 'cancelled' && value !== 'archived') throw new Error('Invalid meeting state');
  return value;
}
function slot(value: unknown): MidweekSlotDto {
  const item = record(value, 'meeting slot');
  if (typeof item.position !== 'number' || !Number.isInteger(item.position) || typeof item.durationMinutes !== 'number' || !Number.isFinite(item.durationMinutes)) throw new Error('Invalid meeting slot');
  return Object.freeze({
    id: text(item.id, 'slot id'), position: item.position, durationMinutes: item.durationMinutes,
    titleKey: text(item.titleKey, 'slot title'),
    ...(typeof item.partDefinitionId === 'string' && item.partDefinitionId.trim() ? { partDefinitionId: item.partDefinitionId } : {}),
  });
}
function meeting(value: unknown): MidweekMeetingDto {
  const item = record(value, 'meeting');
  if (!Array.isArray(item.slots)) throw new Error('Invalid meeting slots');
  return Object.freeze({
    id: text(item.id, 'meeting id'), date: text(item.date, 'meeting date'), localTime: text(item.localTime, 'meeting time'),
    timezone: text(item.timezone, 'meeting timezone'),
    ...(typeof item.locationId === 'string' && item.locationId.trim() ? { locationId: item.locationId } : {}),
    state: meetingState(item.state), slots: Object.freeze(item.slots.map(slot)),
  });
}
function student(value: unknown): StudentAssignmentDto {
  const item = record(value, 'student assignment');
  return Object.freeze({
    id: text(item.id, 'assignment id'), meetingId: text(item.meetingId, 'meeting id'), slotId: text(item.slotId, 'slot id'),
    studentId: text(item.studentId, 'student id'), studentDisplayName: text(item.studentDisplayName, 'student name'),
    assistantId: nullableText(item.assistantId, 'assistant id'), assistantDisplayName: nullableText(item.assistantDisplayName, 'assistant name'),
    state: state(item.state),
  });
}
function nonStudent(value: unknown): NonStudentAssignmentDto {
  const item = record(value, 'non-student assignment');
  return Object.freeze({
    id: text(item.id, 'assignment id'), meetingId: text(item.meetingId, 'meeting id'), slotId: text(item.slotId, 'slot id'),
    personId: text(item.personId, 'person id'), personDisplayName: text(item.personDisplayName, 'person name'), role: text(item.role, 'assignment role'), state: state(item.state),
  });
}

export function parseMidweekOverview(value: unknown): MidweekOverviewDto {
  const body = record(value, 'Midweek API response');
  if (!Array.isArray(body.meetings) || !Array.isArray(body.studentAssignments) || !Array.isArray(body.nonStudentAssignments)) throw new Error('Invalid Midweek API response');
  return Object.freeze({
    meetings: Object.freeze(body.meetings.map(meeting)),
    studentAssignments: Object.freeze(body.studentAssignments.map(student)),
    nonStudentAssignments: Object.freeze(body.nonStudentAssignments.map(nonStudent)),
  });
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error('Invalid API response'); }
}

export interface MidweekApi { overview(signal?: AbortSignal): Promise<MidweekOverviewDto> }
export function createMidweekApi(fetcher: typeof fetch = fetch): MidweekApi {
  return {
    async overview(signal) {
      const response = await fetcher('/api/midweek', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      const body = await readJson(response);
      if (!response.ok) {
        const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
        throw new Error(typeof message === 'string' ? message : `Midweek API request failed (${response.status})`);
      }
      return parseMidweekOverview(body);
    },
  };
}
export const midweekApi = createMidweekApi();
