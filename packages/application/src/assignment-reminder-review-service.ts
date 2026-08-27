import {
  assertAssignmentReminderTenant,
  assertCapability,
  assertResponseTenant,
  latestAssignmentReminder,
  type AccessContext,
  type AssignmentReminderRecord,
  type AssignmentResponse,
} from '@eutaktos/domain';

export type AssignmentReminderReason = 'awaiting-response';

export interface AssignmentReminderReviewItem {
  readonly responseId: string;
  readonly assignmentId: string;
  readonly recipientId: string;
  readonly reason: AssignmentReminderReason;
  readonly pendingSince: string;
  readonly lastReminderAt: string | null;
}

export interface AssignmentReminderReviewReadModel {
  listAssignmentResponses(context: AccessContext): readonly Readonly<AssignmentResponse>[];
  listAssignmentReminderRecords(context: AccessContext): readonly Readonly<AssignmentReminderRecord>[];
}

function compare(left: Readonly<AssignmentReminderReviewItem>, right: Readonly<AssignmentReminderReviewItem>): number {
  return left.pendingSince.localeCompare(right.pendingSince)
    || left.assignmentId.localeCompare(right.assignmentId)
    || left.recipientId.localeCompare(right.recipientId)
    || left.responseId.localeCompare(right.responseId);
}

export class AssignmentReminderReviewService {
  readonly #readModel: AssignmentReminderReviewReadModel;

  constructor(readModel: AssignmentReminderReviewReadModel) {
    this.#readModel = readModel;
  }

  list(context: AccessContext): readonly Readonly<AssignmentReminderReviewItem>[] {
    assertCapability(context, 'schedule.read');

    const responses = this.#readModel.listAssignmentResponses(context);
    const reminders = this.#readModel.listAssignmentReminderRecords(context);

    for (const response of responses) assertResponseTenant(response, context.tenantId);
    for (const reminder of reminders) assertAssignmentReminderTenant(reminder, context.tenantId);

    return Object.freeze(
      responses
        .filter(response => response.status === 'pending')
        .map(response => {
          const lastReminder = latestAssignmentReminder(
            reminders,
            context.tenantId,
            response.assignmentId,
            response.personId,
          );
          return Object.freeze({
            responseId: response.id,
            assignmentId: response.assignmentId,
            recipientId: response.personId,
            reason: 'awaiting-response' as const,
            pendingSince: response.createdAt,
            lastReminderAt: lastReminder?.queuedAt ?? null,
          });
        })
        .sort(compare),
    );
  }
}
