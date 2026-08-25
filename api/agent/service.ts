import type { VerifiedPrincipal } from '../_auth';
import type { SupabaseRestDatabase } from '../_db';
import { logAgentEvent } from '../_observability';
import {
  AgentInputError,
  AgentModelResponseError,
  AgentToolDeniedError,
  AgentToolError,
  type AgentEvidence,
  type AgentModel,
  type AgentResponse,
} from './contracts';
import { createAgentTools, type AgentTool, type AgentToolContext } from './tools';

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOOL_ROUNDS = 4;
const MAX_TOOL_CALLS_PER_ROUND = 5;

export interface AgentRespondInput {
  readonly message: string;
  readonly correlationId?: string;
  readonly signal?: AbortSignal;
}

export interface AgentServiceDependencies {
  readonly model: AgentModel;
  readonly tools?: readonly AgentTool[];
  readonly now?: () => string;
}

function validateMessage(value: string): string {
  const message = value.trim();
  if (!message) throw new AgentInputError('message is required');
  if (message.length > MAX_MESSAGE_LENGTH) throw new AgentInputError('message is too long');
  return message;
}

function addEvidence(target: Map<string, AgentEvidence>, values: readonly AgentEvidence[]): void {
  for (const value of values) target.set(`${value.source}\u0000${value.label}`, value);
}

function toolOutput(status: 'ok' | 'denied' | 'invalid', value?: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(Object.freeze({ status, ...(value ? { data: value } : {}) }));
}

/**
 * Read-only agent coordinator. It never exposes a write tool, never accepts a
 * tenant/actor/capability claim, and limits function-call rounds to prevent
 * unbounded model-controlled work.
 */
export class EutaktosAgentService {
  readonly #model: AgentModel;
  readonly #tools: ReadonlyMap<string, AgentTool>;
  readonly #now: () => string;

  constructor(dependencies: AgentServiceDependencies) {
    this.#model = dependencies.model;
    const tools = dependencies.tools ?? createAgentTools();
    this.#tools = new Map(tools.map(tool => [tool.name, tool]));
    this.#now = dependencies.now ?? (() => new Date().toISOString());
  }

  async respond(
    principal: VerifiedPrincipal,
    database: SupabaseRestDatabase,
    input: AgentRespondInput,
  ): Promise<AgentResponse> {
    const message = validateMessage(input.message);
    const controller = new AbortController();
    const signal = input.signal ?? controller.signal;
    if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');

    const context: AgentToolContext = Object.freeze({ principal, database, now: this.#now });
    const auditMetadata = Object.freeze({ correlationId: input.correlationId, operation: 'respond' });
    logAgentEvent('agent.requested', auditMetadata);
    const evidence = new Map<string, AgentEvidence>();
    let history: readonly unknown[] = Object.freeze([{ role: 'user', content: message }]);
    const schemas = Object.freeze([...this.#tools.values()].map(tool => tool.schema));

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const modelResponse = await this.#model.generate({ history, tools: schemas, signal });
      history = Object.freeze([...history, ...modelResponse.continuationItems]);
      if (!modelResponse.functionCalls.length) {
        if (!modelResponse.message) throw new AgentModelResponseError('Invalid model response');
        logAgentEvent('agent.completed', auditMetadata);
        return Object.freeze({
          responseId: modelResponse.responseId,
          message: modelResponse.message,
          evidence: Object.freeze([...evidence.values()]),
          suggestions: Object.freeze([]),
          status: 'completed',
        });
      }
      if (round === MAX_TOOL_ROUNDS || modelResponse.functionCalls.length > MAX_TOOL_CALLS_PER_ROUND) {
        throw new AgentModelResponseError('Tool call limit exceeded');
      }

      const outputs: unknown[] = [];
      for (const call of modelResponse.functionCalls) {
        const tool = this.#tools.get(call.name);
        if (!tool) {
          logAgentEvent('agent.denied', { ...auditMetadata, operation: 'unknown_tool' });
          outputs.push(Object.freeze({ type: 'function_call_output', call_id: call.callId, output: toolOutput('denied') }));
          continue;
        }
        try {
          logAgentEvent('agent.tool_invoked', { ...auditMetadata, operation: call.name });
          const result = await tool.execute(context, call.argumentsJson);
          addEvidence(evidence, result.evidence);
          outputs.push(Object.freeze({ type: 'function_call_output', call_id: call.callId, output: toolOutput('ok', result.output) }));
        } catch (error) {
          if (error instanceof AgentToolDeniedError) {
            logAgentEvent('agent.denied', { ...auditMetadata, operation: call.name });
            outputs.push(Object.freeze({ type: 'function_call_output', call_id: call.callId, output: toolOutput('denied') }));
          } else if (error instanceof AgentToolError) {
            outputs.push(Object.freeze({ type: 'function_call_output', call_id: call.callId, output: toolOutput('invalid') }));
          } else {
            throw error;
          }
        }
      }
      history = Object.freeze([...history, ...outputs]);
    }
    throw new AgentModelResponseError('Tool call limit exceeded');
  }
}
