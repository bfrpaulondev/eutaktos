import { StudentAssignmentReplacementService } from '@eutaktos/application';
import { CandidateQueryHttpTransport, MidweekSchedulingHttpTransport, ScheduleViewHttpTransport, StudentAssignmentReplacementHttpTransport, type TransportResponse } from '@eutaktos/transport';
import { requireCapability, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, runEndpoint } from '../_endpoint';
import { loadCandidateQueryService, loadMidweekScheduling, loadScheduleViewService } from '../_midweek';
import { SchedulingRuntimeIds } from '../_midweek-uow';
import { sendTransport, transportRequest } from '../_transport';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

function segments(value: string | string[] | undefined): readonly string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return Object.freeze(raw.flatMap(item => item.split('/')).map(item => item.trim()).filter(Boolean));
}

function notFound(response: Parameters<ApiHandler>[1]): void { json(response, 404, { error: 'Not found' }); }

const handler: ApiHandler = async (request, response) => {
  const route = segments(request.query.route);
  if (route.length === 0) { notFound(response); return; }

  // Determine allowed method for each route shape.
  let allowedMethod: 'POST' | 'PUT' | 'DELETE' | 'GET' | undefined;
  if (route[0] === 'meetings' && route.length === 2) allowedMethod = 'PUT';
  if (route[0] === 'meetings' && route.length === 3 && route[2] === 'slots') allowedMethod = 'POST';
  if (route[0] === 'meetings' && route.length === 4 && route[2] === 'slots') allowedMethod = 'DELETE';
  if (route[0] === 'meetings' && route.length === 3 && (route[2] === 'student-assignments' || route[2] === 'non-student-assignments')) allowedMethod = 'POST';
  if (route[0] === 'meetings' && route.length === 3 && (route[2] === 'publish' || route[2] === 'cancel' || route[2] === 'archive')) allowedMethod = 'POST';
  if (route[0] === 'meetings' && route.length === 3 && route[2] === 'candidates') allowedMethod = 'POST';
  if (route[0] === 'meetings' && route.length === 3 && route[2] === 'schedule-view') allowedMethod = 'GET';
  if (route[0] === 'student-assignments' && route.length === 3 && (route[2] === 'cancel' || route[2] === 'replace')) allowedMethod = 'POST';
  if (route[0] === 'non-student-assignments' && route.length === 3 && (route[2] === 'cancel' || route[2] === 'replace')) allowedMethod = 'POST';
  if (!allowedMethod) { notFound(response); return; }
  if (request.method !== allowedMethod) { methodNotAllowed(response, [allowedMethod]); return; }

  // Read-only routes: candidates (POST with body for query parameters) and schedule-view (GET).
  // These require only schedule.read + eligibility.read + availability.read, NOT schedule.write.
  const isReadOnlyRoute = (route[0] === 'meetings' && route.length === 3 && (route[2] === 'candidates' || route[2] === 'schedule-view'));

  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);

    if (isReadOnlyRoute) {
      // Read-only routes: only require schedule.read.
      requireCapability(principal, 'schedule.read');
      const meetingId = route[1] as string;

      if (route[2] === 'candidates') {
        const { service } = await loadCandidateQueryService(database, principal);
        const transport = new CandidateQueryHttpTransport(service);
        const result = transport.listCandidates(transportRequest(request, principal), principal, { meetingId });
        sendTransport(response, result);
        return;
      }
      if (route[2] === 'schedule-view') {
        const { service } = await loadScheduleViewService(database, principal);
        const transport = new ScheduleViewHttpTransport(service);
        const result = transport.viewMeeting(transportRequest(request, principal), principal, { meetingId });
        sendTransport(response, result);
        return;
      }
      notFound(response);
      return;
    }

    // Write routes: require schedule.write + trusted mutation.
    requireCapability(principal, 'schedule.write');
    assertTrustedMutation(request);
    const { service, unitOfWork } = await loadMidweekScheduling(database, principal);
    const midweek = new MidweekSchedulingHttpTransport(service);
    const meetingId = route[0] === 'meetings' ? route[1] : undefined;
    const assignmentId = route[0]?.endsWith('assignments') ? route[1] : undefined;
    let result: TransportResponse;

    if (route[0] === 'meetings' && route.length === 2) {
      result = midweek.updateMeeting(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'slots' && route.length === 3) {
      result = midweek.addSlot(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'slots' && route.length === 4) {
      result = midweek.removeSlot(transportRequest(request, principal, { meetingId, slotId: route[3] }));
    } else if (route[0] === 'meetings' && route[2] === 'student-assignments') {
      result = midweek.assignStudent(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'non-student-assignments') {
      result = midweek.assignNonStudent(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'publish') {
      result = midweek.publishMeeting(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'cancel') {
      result = midweek.cancelMeeting(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'meetings' && route[2] === 'archive') {
      result = midweek.archiveMeeting(transportRequest(request, principal, { meetingId }));
    } else if (route[0] === 'student-assignments' && route[2] === 'cancel') {
      result = midweek.cancelStudent(transportRequest(request, principal, { assignmentId }));
    } else if (route[0] === 'student-assignments' && route[2] === 'replace') {
      const replacement = new StudentAssignmentReplacementHttpTransport(new StudentAssignmentReplacementService(unitOfWork, new SchedulingRuntimeIds()));
      result = replacement.replace(transportRequest(request, principal, { assignmentId }));
    } else if (route[0] === 'non-student-assignments' && route[2] === 'cancel') {
      result = midweek.cancelNonStudent(transportRequest(request, principal, { assignmentId }));
    } else if (route[0] === 'non-student-assignments' && route[2] === 'replace') {
      result = midweek.replaceNonStudent(transportRequest(request, principal, { assignmentId }));
    } else {
      notFound(response); return;
    }

    if (result.status >= 200 && result.status < 300) await unitOfWork.flush(database);
    sendTransport(response, result);
  });
};

export default handler;
