export type AgentStatus = 'completed' | 'denied' | 'failed' | 'cancelled';

export interface AgentEvidence {
  readonly source: string;
  readonly label: string;
}

export interface AgentSuggestion {
  readonly kind: 'advisory';
  readonly message: string;
}

export interface AgentResponse {
  readonly responseId: string;
  readonly message: string;
  readonly evidence: readonly AgentEvidence[];
  readonly suggestions: readonly AgentSuggestion[];
  readonly status: AgentStatus;
}

export interface AgentFunctionCall {
  readonly callId: string;
  readonly name: string;
  readonly argumentsJson: string;
}

export interface AgentModelRequest {
  readonly history: readonly unknown[];
  readonly tools: readonly unknown[];
  readonly signal: AbortSignal;
}

export interface AgentModelResponse {
  readonly responseId: string;
  readonly message: string;
  readonly functionCalls: readonly AgentFunctionCall[];
  /** Normalized response items that may safely be appended to this request only. */
  readonly continuationItems: readonly unknown[];
}

export interface AgentModel {
  generate(input: AgentModelRequest): Promise<AgentModelResponse>;
}

export class AgentConfigurationError extends Error {}
export class AgentInputError extends Error {}
export class AgentToolError extends Error {}
export class AgentToolDeniedError extends AgentToolError {}
export class AgentModelResponseError extends Error {}
export class AgentUnavailableError extends Error {}
