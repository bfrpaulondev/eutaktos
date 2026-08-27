export type DirectoryNextPeriod = Readonly<{ startsAt: string; endsAt: string; reasonCode?: 'away' | 'unavailable' | 'other' }>;
export type DirectoryAvailability = Readonly<{ status: 'ready'; current: 'available' | 'unavailable'; currentReasonCodes: readonly ('away' | 'unavailable' | 'other')[]; nextPeriod?: DirectoryNextPeriod }> | Readonly<{ status: 'unavailable' }>;
export type DirectoryEligibility = Readonly<{ status: 'ready'; enabledAssignmentTypeIds: readonly string[] }> | Readonly<{ status: 'unavailable' }>;
export type DirectoryResponsibilities = Readonly<{ status: 'ready'; keys: readonly string[] }> | Readonly<{ status: 'unavailable' }>;
export type DirectoryAssignmentHistory = Readonly<{ status: 'ready'; lastCompletedMeetingDate?: string }> | Readonly<{ status: 'unavailable' }>;

export interface PeopleDirectoryPersonDto {
  readonly id: string; readonly displayName: string; readonly preferredLocale?: string; readonly active: boolean;
  readonly labels?: readonly string[];
  readonly groups: readonly Readonly<{ id: string; name: string }>[];
  readonly availability: DirectoryAvailability; readonly eligibility: DirectoryEligibility;
  readonly responsibilities: DirectoryResponsibilities; readonly assignmentHistory: DirectoryAssignmentHistory;
}

export interface PeopleDirectoryDto {
  readonly contractVersion: 'people-directory-v1'; readonly generatedAt: string;
  readonly capabilities: Readonly<{ writePeople: boolean; availability: boolean; eligibility: boolean; responsibilities: boolean; schedule: boolean }>;
  readonly filters: Readonly<{ groups: readonly Readonly<{ id: string; name: string }>[]; responsibilityKeys: readonly string[]; assignmentTypeIds: readonly string[]; labels?: readonly string[] }>;
  readonly people: readonly PeopleDirectoryPersonDto[];
}

function record(value: unknown): Readonly<Record<string, unknown>> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People directory response'); return value as Readonly<Record<string, unknown>>; }
function stringValue(value: unknown): string { if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid People directory response'); return value; }
function stringArray(value: unknown): readonly string[] { if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) throw new Error('Invalid People directory response'); return Object.freeze([...value]); }
function group(value: unknown): Readonly<{ id: string; name: string }> { const item = record(value); return Object.freeze({ id: stringValue(item.id), name: stringValue(item.name) }); }

function availability(value: unknown): DirectoryAvailability { const item = record(value); if (item.status === 'unavailable') return Object.freeze({ status: 'unavailable' }); if (item.status !== 'ready' || (item.current !== 'available' && item.current !== 'unavailable') || !Array.isArray(item.currentReasonCodes)) throw new Error('Invalid People directory response'); const allowed = new Set(['away', 'unavailable', 'other']); if (!item.currentReasonCodes.every(code => typeof code === 'string' && allowed.has(code))) throw new Error('Invalid People directory response'); let nextPeriod: DirectoryNextPeriod | undefined; if (item.nextPeriod !== undefined) { const next = record(item.nextPeriod); const reasonCode = next.reasonCode; if (reasonCode !== undefined && (typeof reasonCode !== 'string' || !allowed.has(reasonCode))) throw new Error('Invalid People directory response'); nextPeriod = Object.freeze({ startsAt: stringValue(next.startsAt), endsAt: stringValue(next.endsAt), ...(reasonCode ? { reasonCode: reasonCode as 'away' | 'unavailable' | 'other' } : {}) }); } return Object.freeze({ status: 'ready', current: item.current, currentReasonCodes: Object.freeze(item.currentReasonCodes as ('away' | 'unavailable' | 'other')[]), ...(nextPeriod ? { nextPeriod } : {}) }); }
function eligibility(value: unknown): DirectoryEligibility { const item = record(value); if (item.status === 'unavailable') return Object.freeze({ status: 'unavailable' }); if (item.status !== 'ready') throw new Error('Invalid People directory response'); return Object.freeze({ status: 'ready', enabledAssignmentTypeIds: stringArray(item.enabledAssignmentTypeIds) }); }
function responsibilities(value: unknown): DirectoryResponsibilities { const item = record(value); if (item.status === 'unavailable') return Object.freeze({ status: 'unavailable' }); if (item.status !== 'ready') throw new Error('Invalid People directory response'); return Object.freeze({ status: 'ready', keys: stringArray(item.keys) }); }
function assignmentHistory(value: unknown): DirectoryAssignmentHistory { const item = record(value); if (item.status === 'unavailable') return Object.freeze({ status: 'unavailable' }); if (item.status !== 'ready' || (item.lastCompletedMeetingDate !== undefined && typeof item.lastCompletedMeetingDate !== 'string')) throw new Error('Invalid People directory response'); return Object.freeze({ status: 'ready', ...(typeof item.lastCompletedMeetingDate === 'string' ? { lastCompletedMeetingDate: item.lastCompletedMeetingDate } : {}) }); }
function person(value: unknown): PeopleDirectoryPersonDto { const item = record(value); if (typeof item.active !== 'boolean' || !Array.isArray(item.groups)) throw new Error('Invalid People directory response'); if (item.preferredLocale !== undefined && typeof item.preferredLocale !== 'string') throw new Error('Invalid People directory response'); const labels = stringArray(item.labels ?? []); return Object.freeze({ id: stringValue(item.id), displayName: stringValue(item.displayName), ...(typeof item.preferredLocale === 'string' ? { preferredLocale: item.preferredLocale } : {}), active: item.active, ...(labels.length ? { labels } : {}), groups: Object.freeze(item.groups.map(group)), availability: availability(item.availability), eligibility: eligibility(item.eligibility), responsibilities: responsibilities(item.responsibilities), assignmentHistory: assignmentHistory(item.assignmentHistory) }); }

export function parsePeopleDirectoryResponse(value: unknown): PeopleDirectoryDto {
  const root = record(value); if (root.contractVersion !== 'people-directory-v1' || typeof root.generatedAt !== 'string' || !Array.isArray(root.people)) throw new Error('Invalid People directory response');
  const capabilities = record(root.capabilities); if (!['writePeople', 'availability', 'eligibility', 'responsibilities', 'schedule'].every(key => typeof capabilities[key] === 'boolean')) throw new Error('Invalid People directory response');
  const filters = record(root.filters); if (!Array.isArray(filters.groups)) throw new Error('Invalid People directory response'); const labels = stringArray(filters.labels ?? []);
  return Object.freeze({ contractVersion: 'people-directory-v1', generatedAt: root.generatedAt, capabilities: Object.freeze({ writePeople: capabilities.writePeople as boolean, availability: capabilities.availability as boolean, eligibility: capabilities.eligibility as boolean, responsibilities: capabilities.responsibilities as boolean, schedule: capabilities.schedule as boolean }), filters: Object.freeze({ groups: Object.freeze(filters.groups.map(group)), responsibilityKeys: stringArray(filters.responsibilityKeys), assignmentTypeIds: stringArray(filters.assignmentTypeIds), ...(labels.length ? { labels } : {}) }), people: Object.freeze(root.people.map(person)) });
}

async function readJson(response: Response): Promise<unknown> { try { return await response.json(); } catch { throw new Error('Invalid API response'); } }
function apiError(status: number, value: unknown): Error { const item = value && typeof value === 'object' ? value as Readonly<Record<string, unknown>> : undefined; const message = typeof item?.error === 'string' && status < 500 ? item.error : 'People directory request failed'; return new Error(`${message} (${status})`); }
export function createPeopleDirectoryApi(fetcher: typeof fetch = fetch) { return Object.freeze({ async get(signal?: AbortSignal): Promise<PeopleDirectoryDto> { const response = await fetcher('/api/people/directory', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal }); const body = await readJson(response); if (!response.ok) throw apiError(response.status, body); return parsePeopleDirectoryResponse(body); } }); }
export const peopleDirectoryApi = createPeopleDirectoryApi();
