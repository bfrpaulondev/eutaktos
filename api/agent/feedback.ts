export const AGENT_FEEDBACK_KINDS = Object.freeze([
  'helpful',
  'not_helpful',
  'suggestion_accepted',
  'suggestion_rejected',
] as const);

export type AgentFeedbackKind = (typeof AGENT_FEEDBACK_KINDS)[number];

export interface AgentFeedbackInput {
  readonly responseId: string;
  readonly kind: AgentFeedbackKind;
  readonly reason?: string;
}

export interface AgentFeedbackRecord extends AgentFeedbackInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly recordedAt: string;
}

/**
 * Intentionally only a contract in v1. The current repository has no reviewed
 * tenant-safe persistence boundary for feedback-only records. Any later
 * implementation must derive tenant/actor server-side, minimize reason text,
 * audit metadata only, and must never persist a full prompt or model response.
 */
export interface AgentFeedbackStore {
  record(record: AgentFeedbackRecord): Promise<void>;
}

export function validateAgentFeedback(input: AgentFeedbackInput): AgentFeedbackInput {
  const responseId = input.responseId?.trim();
  if (!responseId || responseId.length > 200) throw new Error('responseId is invalid');
  if (!AGENT_FEEDBACK_KINDS.includes(input.kind)) throw new Error('feedback kind is invalid');
  const reason = input.reason?.trim();
  if (reason !== undefined && reason.length > 500) throw new Error('feedback reason is too long');
  return Object.freeze({ responseId, kind: input.kind, ...(reason ? { reason } : {}) });
}
