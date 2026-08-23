export type MidweekMeetingState = 'draft' | 'published' | 'cancelled' | 'archived';
export type AssignmentState = 'assigned' | 'cancelled' | 'completed';

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

async function readJson(response:Response):Promise<unknown>{try{return await response.json();}catch{throw new Error('Invalid API response');}}
function safeError(response:Response,body:unknown):Error{if(response.status>=500)return new Error(`Midweek API request failed (${response.status})`);const message=body&&typeof body==='object'?(body as {error?:unknown}).error:undefined;return new Error(typeof message==='string'&&message.length<=300?message:`Midweek API request failed (${response.status})`);}
function mutationInit(method:'POST'|'PUT'|'DELETE',body?:unknown):RequestInit{return{method,credentials:'same-origin',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})};}
function meetingPayload(input:CreateMidweekMeetingPayload):CreateMidweekMeetingPayload{return{date:input.date,localTime:input.localTime,timezone:input.timezone,...(input.locationId!==undefined?{locationId:input.locationId}:{})};}
function slotPayload(input:AddMidweekSlotPayload):AddMidweekSlotPayload{return{position:input.position,durationMinutes:input.durationMinutes,titleKey:input.titleKey,...(input.partDefinitionId!==undefined?{partDefinitionId:input.partDefinitionId}:{})};}
function studentPayload(input:AssignStudentPayload):AssignStudentPayload{return{slotId:input.slotId,studentId:input.studentId,...(input.assistantId!==undefined?{assistantId:input.assistantId}:{})};}
function nonStudentPayload(input:AssignNonStudentPayload):AssignNonStudentPayload{return{slotId:input.slotId,personId:input.personId,role:input.role};}
function replacementPayload(input:ReplaceStudentPayload):ReplaceStudentPayload{return{studentId:input.studentId,...(input.assistantId!==undefined?{assistantId:input.assistantId}:{})};}

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
}
export function createMidweekApi(fetcher:typeof fetch=fetch):MidweekApi{
 const requestMeeting=async(path:string,init:RequestInit):Promise<MidweekMeetingDto>=>{const response=await fetcher(path,init);const body=await readJson(response);if(!response.ok)throw safeError(response,body);return meeting(body);};
 const requestMutation=async(path:string,init:RequestInit):Promise<void>=>{const response=await fetcher(path,init);const body=await readJson(response).catch(()=>undefined);if(!response.ok)throw safeError(response,body);};
 return{
  async overview(signal){const response=await fetcher('/api/midweek',{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},signal});const body=await readJson(response);if(!response.ok)throw safeError(response,body);return parseMidweekOverview(body);},
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
 };
}
export const midweekApi=createMidweekApi();