import { completedAssignmentHistoryFromScheduling } from '@eutaktos/application';
import { createAccessContext, type AssignmentHistoryRecord, type MidweekMeeting, type NonStudentAssignment, type StudentAssignment } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { personDto } from '../_entity-read';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';

export interface RecordCardsPeriod { readonly from: string; readonly to: string }
export interface RecordCardRecord { readonly meetingDate: string; readonly partType: string }
export interface RecordCard { readonly personId: string; readonly displayName: string; readonly records: readonly RecordCardRecord[] }

function single(request: Pick<ApiRequest, 'query'>, name: string): string | undefined {
  const value = request.query[name];
  if (Array.isArray(value)) throw new BadRequestError(`${name} must not be repeated`);
  return value;
}

function civilDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestError(`${field} must use YYYY-MM-DD`);
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new BadRequestError(`${field} is not a real calendar date`);
  return value;
}

export function parseRecordCardsPeriod(request: Pick<ApiRequest, 'query'>): RecordCardsPeriod {
  const allowed = new Set(['year', 'from', 'to']);
  if (Object.keys(request.query).some(key => !allowed.has(key))) throw new BadRequestError('Unknown record cards query field');
  const year = single(request, 'year')?.trim();
  const fromValue = single(request, 'from')?.trim();
  const toValue = single(request, 'to')?.trim();

  if (year) {
    if (fromValue || toValue) throw new BadRequestError('year cannot be combined with from/to');
    if (!/^\d{4}$/.test(year)) throw new BadRequestError('year must use YYYY');
    return Object.freeze({ from: `${year}-01-01`, to: `${year}-12-31` });
  }
  if (!fromValue || !toValue) throw new BadRequestError('Supply year or both from and to');
  const from = civilDate(fromValue, 'from');
  const to = civilDate(toValue, 'to');
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (fromMs > toMs) throw new BadRequestError('from must not be after to');
  if ((toMs - fromMs) / 86_400_000 > 365) throw new BadRequestError('Custom record cards period cannot exceed 366 days');
  return Object.freeze({ from, to });
}

function stored<T extends { readonly id: string; readonly tenantId: string }>(row: EntityRow, tenantId: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored record card source');
  const value = row.data as Readonly<Record<string, unknown>>;
  if (value.id !== row.entity_id || value.tenantId !== tenantId) throw new Error('Invalid stored record card source identity');
  return value as unknown as Readonly<T>;
}

export function projectRecordCards(
  people: readonly Readonly<{ id: string; displayName: string }>[],
  history: readonly Readonly<AssignmentHistoryRecord>[],
  period: RecordCardsPeriod,
): readonly Readonly<RecordCard>[] {
  const names = new Map(people.map(person => [person.id, person.displayName] as const));
  const byPerson = new Map<string, Array<Readonly<AssignmentHistoryRecord>>>();
  for (const item of history) {
    if (item.meetingDate < period.from || item.meetingDate > period.to) continue;
    if (!names.has(item.personId)) throw new Error('Completed assignment references a missing person');
    const records = byPerson.get(item.personId) ?? [];
    records.push(item);
    byPerson.set(item.personId, records);
  }

  return Object.freeze([...byPerson.entries()].map(([personId, records]) => Object.freeze({
    personId,
    displayName: names.get(personId)!,
    records: Object.freeze([...records]
      .sort((left, right) => left.meetingDate.localeCompare(right.meetingDate) || left.partType.localeCompare(right.partType) || left.id.localeCompare(right.id))
      .map(item => Object.freeze({ meetingDate: item.meetingDate, partType: item.partType }))),
  })).sort((left, right) => left.displayName.localeCompare(right.displayName) || left.personId.localeCompare(right.personId)));
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'schedule.read');
    requireCapability(principal, 'reports.read');
    const period = parseRecordCardsPeriod(request);
    const [peopleRows, meetingRows, studentRows, nonStudentRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'midweek-meeting'),
      database.entities(principal.tenantId, 'student-assignment'),
      database.entities(principal.tenantId, 'non-student-assignment'),
    ]);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    const history = completedAssignmentHistoryFromScheduling(context, {
      meetings: Object.freeze(meetingRows.map(row => stored<MidweekMeeting>(row, principal.tenantId))),
      studentAssignments: Object.freeze(studentRows.map(row => stored<StudentAssignment>(row, principal.tenantId))),
      nonStudentAssignments: Object.freeze(nonStudentRows.map(row => stored<NonStudentAssignment>(row, principal.tenantId))),
    });
    const people = Object.freeze(peopleRows.map(row => personDto(row, principal.tenantId)));
    const cards = projectRecordCards(people, history, period);
    json(response, 200, Object.freeze({ contractVersion: 'people-record-cards-v1', generatedAt: new Date().toISOString(), period, cards }));
  });
};

export default handler;