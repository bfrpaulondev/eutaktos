export type MidweekMeetingState = 'draft' | 'published' | 'cancelled' | 'archived';
export type AssignmentState = 'assigned' | 'cancelled' | 'completed';
export type CandidateRole = 'student' | 'assistant' | 'non-student';
export type SlotAssignmentState = 'filled' | 'vacant' | 'conflict';

export interface MidweekSlotDto { readonly id:string; readonly position:number; readonly durationMinutes:number; readonly titleKey:string; readonly partDefinitionId?:string }
export interface MidweekMeetingDto { readonly id:string; readonly date:string; readonly localTime:string; readonly timezone:string; readonly locationId?:string; readonly state:MidweekMeetingState; readonly slots:readonly MidweekSlotDto[] }
export interface StudentAssignmentDto { readonly id:string; readonly meetingId:string; readonly slotId:string; readonly studentId:string; readonly studentDisplayName:string; readonly assistantId:string|null; readonly assistantDisplayName:string|null; readonly state:AssignmentState }
export interface NonStudentAssignmentDto { readonly id:string; readonly meetingId:string; readonly slotId:string; readonly personId:string; readonly personDisplayName:string; readonly role:string; readonly state:AssignmentState }
export interface MidweekOverviewDto { readonly meetings:readonly MidweekMeetingDto[]; readonly studentAssignments:readonly StudentAssignmentDto[]; readonly nonStudentAssignments:readonly NonStudentAssignmentDto[] }
export interface CreateMidweekMeetingPayload { readonly date:string; readonly localTime:string; readonly timezone:string; readonly locationId?:string }
export interface AddMidweekSlotPayload { readonly position:number; readonly durationMinutes:number; readonly titleKey:string; readonly partDefinitionId?:string }
export interface AssignStudentPayload { readonly slotId:string; readonly studentId:string; readonly assistantId?:string|null }
export interface AssignNonStudentPayload { readonly slotId:string; readonly personId:string; readonly role:string }
export interface ReplaceStudentPayload { readonly studentId:string; readonly assistantId?:string|null }

export interface CandidateReasonDto {
  readonly kind: string;
  readonly messageKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface CandidateConflictInfoDto {
  readonly kind: 'assignment-overlap' | 'unavailable';
  readonly sourceId: string;
}

export interface CandidateProfileDto {
  readonly personId: string;
  readonly displayName: string;
  readonly role: CandidateRole;
  readonly eligible: boolean;
  readonly available: boolean;
  readonly inactive: boolean;
  readonly conflicts: readonly CandidateConflictInfoDto[];
  readonly lastAssignmentDate: string | null;
  readonly daysSinceLastAssignment: number | null;
  readonly recentAssignmentCount: number;
  readonly alreadyAssignedInMeeting: boolean;
  readonly reasons: readonly CandidateReasonDto[];
}

export interface CandidateQueryResultDto {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  readonly assignmentTypeId: string;
  readonly window: { readonly startsAt: string; readonly endsAt: string };
  readonly candidates: readonly CandidateProfileDto[];
}

export interface ScheduleSlotViewDto {
  readonly slotId: string;
  readonly position: number;
  readonly titleKey: string;
  readonly durationMinutes: number;
  readonly partDefinitionId?: string;
  readonly studentAssignmentId: string | null;
  readonly studentId: string | null;
  readonly studentDisplayName: string | null;
  readonly assistantId: string | null;
  readonly assistantDisplayName: string | null;
  readonly nonStudentAssignmentId: string | null;
  readonly nonStudentPersonId: string | null;
  readonly nonStudentDisplayName: string | null;
  readonly nonStudentRole: string | null;
  readonly hasConflict: boolean;
  readonly state: SlotAssignmentState;
}

export interface ScheduleMeetingViewDto {
  readonly meetingId: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId?: string;
  readonly state: MidweekMeetingState;
  readonly slots: readonly ScheduleSlotViewDto[];
  readonly totalSlots: number;
  readonly filledSlots: number;
  readonly vacantSlots: number;
  readonly conflictedSlots: number;
}

export interface CandidateQueryPayload {
  readonly slotId: string;
  readonly role: CandidateRole;
  readonly excludePersonIds?: readonly string[];
  readonly assignmentTypeId?: string;
}

const OVERVIEW_TIMEOUT_MS = 15_000;

function record(value:unknown,label:string):Readonly<Record<string,unknown>>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid ${label}`);return value as Readonly<Record<string,unknown>>;}
function text(value:unknown,label:string):string{if(typeof value!=='string'||!value.trim())throw new Error(`Invalid ${label}`);return value;}
function nullableText(value:unknown,label:string):string|null{if(value===null)return null;return text(value,label);}
function assignmentState(value:unknown):AssignmentState{if(value!=='assigned'&&value!=='cancelled'&&value!=='completed')throw new Error('Invalid assignment state');return value;}
function meetingState(value:unknown):MidweekMeetingState{if(value!=='draft'&&value!=='published'&&value!=='cancelled'&&value!=='archived')throw new Error('Invalid meeting state');return value;}
function slot(value:unknown):MidweekSlotDto{const item=record(value,'meeting slot');if(typeof item.position!=='number'||!Number.isInteger(item.position)||typeof item.durationMinutes!=='number'||!Number.isFinite(item.durationMinutes))throw new Error('Invalid meeting slot');return Object.freeze({id:text(item.id,'slot id'),position:item.position,durationMinutes:item.durationMinutes,titleKey:text(item.titleKey,'slot title'),...(typeof item.partDefinitionId==='string'&&item.partDefinitionId.trim()?{partDefinitionId:item.partDefinitionId}:{})});}
function meeting(value:unknown):MidweekMeetingDto{const item=record(value,'meeting');if(!Array.isArray(item.slots))throw new Error('Invalid meeting slots');return Object.freeze({id:text(item.id,'meeting id'),date:text(item.date,'meeting date'),localTime:text(item.localTime,'meeting time'),timezone:text(item.timezone,'meeting timezone'),...(typeof item.locationId==='string'&&item.locationId.trim()?{locationId:item.locationId}:{}),state:meetingState(item.state),slots:Object.freeze(item.slots.map(slot))});}
function student(value:unknown):StudentAssignmentDto{const item=record(value,'student assignment');return Object.freeze({id:text(item.id,'assignment id'),meetingId:text(item.meetingId,'meeting id'),slotId:text(item.slotId,'slot id'),studentId:text(item.studentId,'student id'),studentDisplayName:text(item.studentDisplayName,'student name'),assistantId:nullableText(item.assistantId,'assistant id'),assistantDisplayName:nullableText(item.assistantDisplayName,'assistant name'),state:assignmentState(item.state)});}
function nonStudent(value:unknown):NonStudentAssignmentDto{const item=record(value,'non-student assignment');return Object.freeze({id:text(item.id,'assignment id'),meetingId:text(item.meetingId,'meeting id'),slotId:text(item.slotId,'slot id'),personId:text(item.personId,'person id'),personDisplayName:text(item.personDisplayName,'person name'),role:text(item.role,'assignment role'),state:assignmentState(item.state)});}
export function parseMidweekOverview(value:unknown):MidweekOverviewDto{const body=record(value,'Midweek API response');if(!Array.isArray(body.meetings)||!Array.isArray(body.studentAssignments)||!Array.isArray(body.nonStudentAssignments))throw new Error('Invalid Midweek API response');return Object.freeze({meetings:Object.freeze(body.meetings.map(meeting)),studentAssignments:Object.freeze(body.studentAssignments.map(student)),nonStudentAssignments:Object.freeze(body.nonStudentAssignments.map(nonStudent))});}

function candidateReason(value: unknown): CandidateReasonDto {
  const item = record(value, 'candidate reason');
  return Object.freeze({
    kind: text(item.kind, 'reason kind'),
    messageKey: text(item.messageKey, 'reason messageKey'),
    params: Object.freeze(Object.fromEntries(
      Object.entries(item.params ?? {}).filter(([, value]) => typeof value === 'string' || typeof value === 'number'),
    ) as Readonly<Record<string, string | number>>),
  });
}

function candidateConflictInfo(value: unknown): CandidateConflictInfoDto {
  const item = record(value, 'candidate conflict');
  const kind = item.kind;
  if (kind !== 'assignment-overlap' && kind !== 'unavailable') throw new Error('Invalid candidate conflict kind');
  return Object.freeze({ kind, sourceId: text(item.sourceId, 'conflict sourceId') });
}

function candidateProfile(value: unknown): CandidateProfileDto {
  const item = record(value, 'candidate profile');
  if (!Array.isArray(item.reasons)) throw new Error('Invalid candidate reasons');
  if (!Array.isArray(item.conflicts)) throw new Error('Invalid candidate conflicts');
  return Object.freeze({
    personId: text(item.personId, 'personId'),
    displayName: text(item.displayName, 'displayName'),
    role: (item.role === 'student' || item.role === 'assistant' || item.role === 'non-student') ? item.role : (() => { throw new Error('Invalid candidate role'); })(),
    eligible: Boolean(item.eligible),
    available: Boolean(item.available),
    inactive: Boolean(item.inactive),
    conflicts: Object.freeze(item.conflicts.map(candidateConflictInfo)),
    lastAssignmentDate: item.lastAssignmentDate === null ? null : text(item.lastAssignmentDate, 'lastAssignmentDate'),
    daysSinceLastAssignment: item.daysSinceLastAssignment === null ? null : (typeof item.daysSinceLastAssignment === 'number' ? item.daysSinceLastAssignment : null),
    recentAssignmentCount: typeof item.recentAssignmentCount === 'number' ? item.recentAssignmentCount : 0,
    alreadyAssignedInMeeting: Boolean(item.alreadyAssignedInMeeting),
    reasons: Object.freeze(item.reasons.map(candidateReason)),
  });
}

export function parseCandidateQueryResult(value: unknown): CandidateQueryResultDto {
  const body = record(value, 'candidate query result');
  if (!Array.isArray(body.candidates)) throw new Error('Invalid candidate query result');
  const window = record(body.window, 'candidate window');
  return Object.freeze({
    meetingId: text(body.meetingId, 'meetingId'),
    slotId: text(body.slotId, 'slotId'),
    role: (body.role === 'student' || body.role === 'assistant' || body.role === 'non-student') ? body.role : (() => { throw new Error('Invalid candidate role'); })(),
    assignmentTypeId: text(body.assignmentTypeId, 'assignmentTypeId'),
    window: Object.freeze({ startsAt: text(window.startsAt, 'startsAt'), endsAt: text(window.endsAt, 'endsAt') }),
    candidates: Object.freeze(body.candidates.map(candidateProfile)),
  });
}

function scheduleSlotView(value: unknown): ScheduleSlotViewDto {
  const item = record(value, 'schedule slot view');
  const state = item.state;
  if (state !== 'filled' && state !== 'vacant' && state !== 'conflict') throw new Error('Invalid slot state');
  return Object.freeze({
    slotId: text(item.slotId, 'slotId'),
    position: typeof item.position === 'number' ? item.position : 0,
    titleKey: text(item.titleKey, 'titleKey'),
    durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : 0,
    ...(typeof item.partDefinitionId === 'string' && item.partDefinitionId.trim() ? { partDefinitionId: item.partDefinitionId } : {}),
    studentAssignmentId: nullableText(item.studentAssignmentId, 'studentAssignmentId'),
    studentId: nullableText(item.studentId, 'studentId'),
    studentDisplayName: nullableText(item.studentDisplayName, 'studentDisplayName'),
    assistantId: nullableText(item.assistantId, 'assistantId'),
    assistantDisplayName: nullableText(item.assistantDisplayName, 'assistantDisplayName'),
    nonStudentAssignmentId: nullableText(item.nonStudentAssignmentId, 'nonStudentAssignmentId'),
    nonStudentPersonId: nullableText(item.nonStudentPersonId, 'nonStudentPersonId'),
    nonStudentDisplayName: nullableText(item.nonStudentDisplayName, 'nonStudentDisplayName'),
    nonStudentRole: nullableText(item.nonStudentRole, 'nonStudentRole'),
    hasConflict: Boolean(item.hasConflict),
    state,
  });
}

export function parseScheduleMeetingView(value: unknown): ScheduleMeetingViewDto {
  const body = record(value, 'schedule meeting view');
  if (!Array.isArray(body.slots)) throw new Error('Invalid schedule slots');
  return Object.freeze({
    meetingId: text(body.meetingId, 'meetingId'),
    date: text(body.date, 'date'),
    localTime: text(body.localTime, 'localTime'),
    timezone: text(body.timezone, 'timezone'),
    ...(typeof body.locationId === 'string' && body.locationId.trim() ? { locationId: body.locationId } : {}),
    state: meetingState(body.state),
    slots: Object.freeze(body.slots.map(scheduleSlotView)),
    totalSlots: typeof body.totalSlots === 'number' ? body.totalSlots : body.slots.length,
    filledSlots: typeof body.filledSlots === 'number' ? body.filledSlots : 0,
    vacantSlots: typeof body.vacantSlots === 'number' ? body.vacantSlots : 0,
    conflictedSlots: typeof body.conflictedSlots === 'number' ? body.conflictedSlots : 0,
  });
}

async function readJson(response:Response):Promise<unknown>{try{return await response.json();}catch{throw new Error('Invalid API response');}}
function safeError(response:Response,body:unknown):Error{if(response.status>=500)return new Error(`Midweek API request failed (${response.status})`);const message=body&&typeof body==='object'?(body as {error?:unknown}).error:undefined;return new Error(typeof message==='string'&&message.length<=300?message:`Midweek API request failed (${response.status})`);}
function mutationInit(method:'POST'|'PUT'|'DELETE',body?:unknown):RequestInit{return{method,credentials:'same-origin',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})};}
function meetingPayload(input:CreateMidweekMeetingPayload):CreateMidweekMeetingPayload{return{date:input.date,localTime:input.localTime,timezone:input.timezone,...(input.locationId!==undefined?{locationId:input.locationId}:{})};}
function slotPayload(input:AddMidweekSlotPayload):AddMidweekSlotPayload{return{position:input.position,durationMinutes:input.durationMinutes,titleKey:input.titleKey,...(input.partDefinitionId!==undefined?{partDefinitionId:input.partDefinitionId}:{})};}
function studentPayload(input:AssignStudentPayload):AssignStudentPayload{return{slotId:input.slotId,studentId:input.studentId,...(input.assistantId!==undefined?{assistantId:input.assistantId}:{})};}
function nonStudentPayload(input:AssignNonStudentPayload):AssignNonStudentPayload{return{slotId:input.slotId,personId:input.personId,role:input.role};}
function replacementPayload(input:ReplaceStudentPayload):ReplaceStudentPayload{return{studentId:input.studentId,...(input.assistantId!==undefined?{assistantId:input.assistantId}:{})};}

async function fetchOverview(fetcher:typeof fetch, signal?:AbortSignal):Promise<Response>{
 const controller=new AbortController(); let timedOut=false;
 const relayAbort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',relayAbort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},OVERVIEW_TIMEOUT_MS);
 try{return await fetcher('/api/midweek',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal:controller.signal});}
 catch(error){if(timedOut)throw new Error('Midweek API request timed out');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',relayAbort);}
}

export interface MidweekApi{
 overview(signal?:AbortSignal):Promise<MidweekOverviewDto>;
 createMeeting(input:CreateMidweekMeetingPayload):Promise<MidweekMeetingDto>;
 addSlot(meetingId:string,input:AddMidweekSlotPayload):Promise<MidweekMeetingDto>;
 removeSlot(meetingId:string,slotId:string):Promise<MidweekMeetingDto>;
 assignStudent(meetingId:string,input:AssignStudentPayload):Promise<void>;
 assignNonStudent(meetingId:string,input:AssignNonStudentPayload):Promise<void>;
 publishMeeting(meetingId:string):Promise<MidweekMeetingDto>;
 replaceStudent(assignmentId:string,input:ReplaceStudentPayload):Promise<void>;
 replaceNonStudent(assignmentId:string,personId:string):Promise<void>;
 cancelStudent(assignmentId:string):Promise<void>;
 cancelNonStudent(assignmentId:string):Promise<void>;
 candidates(meetingId:string,input:CandidateQueryPayload,signal?:AbortSignal):Promise<CandidateQueryResultDto>;
 scheduleView(meetingId:string,signal?:AbortSignal):Promise<ScheduleMeetingViewDto>;
}
export function createMidweekApi(fetcher:typeof fetch=fetch):MidweekApi{
 const requestMeeting=async(path:string,init:RequestInit):Promise<MidweekMeetingDto>=>{const response=await fetcher(path,init);const body=await readJson(response);if(!response.ok)throw safeError(response,body);return meeting(body);};
 const requestMutation=async(path:string,init:RequestInit):Promise<void>=>{const response=await fetcher(path,init);const body=await readJson(response).catch(()=>undefined);if(!response.ok)throw safeError(response,body);};
 const requestJson=async<T>(path:string,init:RequestInit,parse:(value:unknown)=>T):Promise<T>=>{const response=await fetcher(path,init);const body=await readJson(response);if(!response.ok)throw safeError(response,body);return parse(body);};
 return{
  async overview(signal){const response=await fetchOverview(fetcher,signal);const body=await readJson(response);if(!response.ok)throw safeError(response,body);return parseMidweekOverview(body);},
  createMeeting(input){return requestMeeting('/api/midweek',mutationInit('POST',meetingPayload(input)));},
  addSlot(meetingId,input){return requestMeeting(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/slots`,mutationInit('POST',slotPayload(input)));},
  removeSlot(meetingId,slotId){return requestMeeting(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/slots/${encodeURIComponent(slotId)}`,mutationInit('DELETE'));},
  assignStudent(meetingId,input){return requestMutation(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/student-assignments`,mutationInit('POST',studentPayload(input)));},
  assignNonStudent(meetingId,input){return requestMutation(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/non-student-assignments`,mutationInit('POST',nonStudentPayload(input)));},
  publishMeeting(meetingId){return requestMeeting(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/publish`,mutationInit('POST'));},
  replaceStudent(assignmentId,input){return requestMutation(`/api/midweek/student-assignments/${encodeURIComponent(assignmentId)}/replace`,mutationInit('POST',replacementPayload(input)));},
  replaceNonStudent(assignmentId,personId){return requestMutation(`/api/midweek/non-student-assignments/${encodeURIComponent(assignmentId)}/replace`,mutationInit('POST',{personId}));},
  cancelStudent(assignmentId){return requestMutation(`/api/midweek/student-assignments/${encodeURIComponent(assignmentId)}/cancel`,mutationInit('POST'));},
  cancelNonStudent(assignmentId){return requestMutation(`/api/midweek/non-student-assignments/${encodeURIComponent(assignmentId)}/cancel`,mutationInit('POST'));},
  candidates(meetingId,input,signal){return requestJson(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/candidates`,{...mutationInit('POST',input),signal},parseCandidateQueryResult);},
  scheduleView(meetingId,signal){return requestJson(`/api/midweek/meetings/${encodeURIComponent(meetingId)}/schedule-view`,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal},parseScheduleMeetingView);},
 };
}
export const midweekApi=createMidweekApi();
