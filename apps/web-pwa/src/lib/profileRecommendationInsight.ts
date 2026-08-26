import type { RecommendationReasonCode, RecommendationWarningCode } from '@eutaktos/application';
import { slotAllowsStudentAssignment } from './assignmentTypeCatalog';
import type { MidweekOverviewDto } from './midweekApi';
import { midweekApi } from './midweekApi';
import { meetingStartMs } from './personProfileData';
import { peopleRecommendationApi, PeopleRecommendationApiError } from './peopleRecommendationApi';
import type { CurrentSessionDto } from './sessionApi';
import { sessionApi } from './sessionApi';

export const MAX_PROFILE_RECOMMENDATION_TARGETS = 4;

const REQUIRED_CAPABILITIES = Object.freeze([
  'people.read',
  'eligibility.read',
  'availability.read',
  'schedule.read',
] as const);

export interface ProfileRecommendationTarget {
  readonly meetingId: string;
  readonly slotId: string;
  readonly assignmentTypeId: string;
  readonly meetingDate: string;
  readonly localTime: string;
  readonly timezone: string;
}

export interface ProfileCandidateInsight {
  readonly target: ProfileRecommendationTarget;
  readonly rank: number;
  readonly reasons: readonly Readonly<{ code: RecommendationReasonCode }>[];
  readonly warnings: readonly Readonly<{ code: RecommendationWarningCode }>[];
}

export type ProfileRecommendationInsightResult =
  | Readonly<{ status: 'ready'; insights: readonly ProfileCandidateInsight[]; partial: boolean }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'blocked' }>
  | Readonly<{ status: 'unavailable' }>;

export interface ProfileRecommendationInsightDependencies {
  readonly session: Pick<typeof sessionApi, 'current'>;
  readonly assignments: Pick<typeof midweekApi, 'overview'>;
  readonly recommendations: Pick<typeof peopleRecommendationApi, 'get'>;
}

const defaultDependencies: ProfileRecommendationInsightDependencies = Object.freeze({
  session: sessionApi,
  assignments: midweekApi,
  recommendations: peopleRecommendationApi,
});

function hasRequiredCapabilities(session: CurrentSessionDto): boolean {
  return REQUIRED_CAPABILITIES.every(capability => session.capabilities.includes(capability as never));
}

function statusFromError(error: unknown): number | undefined {
  if (error instanceof PeopleRecommendationApiError) return error.status;
  const message = error instanceof Error ? error.message : '';
  const numeric = /\((\d{3})\)/.exec(message);
  if (numeric) return Number(numeric[1]);
  if (/^Unauthorized$/i.test(message)) return 401;
  if (/^Forbidden$/i.test(message)) return 403;
  return undefined;
}

function assignmentKey(meetingId: string, slotId: string): string {
  return `${meetingId}\u0000${slotId}`;
}

/**
 * Selects a bounded, chronological set of future student-capable slots that do
 * not already have an active student assignment. This only chooses opaque C5.3
 * targets; it never decides whether a person is a candidate.
 */
export function profileRecommendationTargets(
  overview: MidweekOverviewDto,
  now: Date,
  limit = MAX_PROFILE_RECOMMENDATION_TARGETS,
): readonly ProfileRecommendationTarget[] {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(now.getTime())) return Object.freeze([]);

  const occupied = new Set(
    overview.studentAssignments
      .filter(assignment => assignment.state === 'assigned')
      .map(assignment => assignmentKey(assignment.meetingId, assignment.slotId)),
  );

  const futureMeetings = overview.meetings
    .map(meeting => ({ meeting, startsAt: meetingStartMs(meeting.date, meeting.localTime, meeting.timezone) }))
    .filter((value): value is { meeting: MidweekOverviewDto['meetings'][number]; startsAt: number } =>
      value.startsAt !== undefined
      && value.startsAt >= now.getTime()
      && (value.meeting.state === 'draft' || value.meeting.state === 'published'))
    .sort((left, right) => left.startsAt - right.startsAt || left.meeting.id.localeCompare(right.meeting.id));

  const targets: ProfileRecommendationTarget[] = [];
  for (const { meeting } of futureMeetings) {
    for (const slot of [...meeting.slots].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))) {
      const assignmentTypeId = slot.partDefinitionId?.trim();
      if (!assignmentTypeId || !slotAllowsStudentAssignment(assignmentTypeId)) continue;
      if (occupied.has(assignmentKey(meeting.id, slot.id))) continue;
      targets.push(Object.freeze({
        meetingId: meeting.id,
        slotId: slot.id,
        assignmentTypeId,
        meetingDate: meeting.date,
        localTime: meeting.localTime,
        timezone: meeting.timezone,
      }));
      if (targets.length >= limit) return Object.freeze(targets);
    }
  }
  return Object.freeze(targets);
}

function aborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/**
 * Reads only approved C5.3/PX7 evidence. No client ranking or eligibility
 * inference is performed. An empty result is returned only when every bounded
 * target was successfully checked and the person was not a candidate in any of
 * them. Partial failures without positive evidence remain unavailable.
 */
export async function loadProfileRecommendationInsight(
  personId: string,
  now: Date,
  signal?: AbortSignal,
  dependencies: ProfileRecommendationInsightDependencies = defaultDependencies,
): Promise<ProfileRecommendationInsightResult> {
  try {
    aborted(signal);
    const [session, overview] = await Promise.all([
      dependencies.session.current(signal),
      dependencies.assignments.overview(signal),
    ]);
    aborted(signal);

    if (!hasRequiredCapabilities(session)) return Object.freeze({ status: 'blocked' as const });
    const targets = profileRecommendationTargets(overview, now);
    if (!targets.length) return Object.freeze({ status: 'empty' as const });

    const settled = await Promise.allSettled(targets.map(target =>
      dependencies.recommendations.get(target.meetingId, target.slotId, signal)));
    aborted(signal);

    const insights: ProfileCandidateInsight[] = [];
    let failures = 0;
    let blockedFailure = false;

    settled.forEach((result, index) => {
      const target = targets[index];
      if (!target) return;
      if (result.status === 'rejected') {
        failures += 1;
        const status = statusFromError(result.reason);
        if (status === 401 || status === 403) blockedFailure = true;
        return;
      }
      const candidate = result.value.candidates.find(value => value.personId === personId);
      if (!candidate || candidate.rank === undefined) return;
      insights.push(Object.freeze({
        target,
        rank: candidate.rank,
        reasons: candidate.reasons,
        warnings: candidate.warnings,
      }));
    });

    if (insights.length) return Object.freeze({ status: 'ready' as const, insights: Object.freeze(insights), partial: failures > 0 });
    if (failures === 0) return Object.freeze({ status: 'empty' as const });
    if (blockedFailure && failures === settled.length) return Object.freeze({ status: 'blocked' as const });
    return Object.freeze({ status: 'unavailable' as const });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    const status = statusFromError(error);
    if (status === 401 || status === 403) return Object.freeze({ status: 'blocked' as const });
    return Object.freeze({ status: 'unavailable' as const });
  }
}

export function isCurrentInsightRequest(requestVersion: number, currentVersion: number, abortedValue: boolean): boolean {
  return requestVersion === currentVersion && !abortedValue;
}
