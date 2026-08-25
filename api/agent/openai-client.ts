declare const process: { env: Record<string, string | undefined> };

import OpenAI from 'openai';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { EUTAKTOS_AGENT_POLICY } from './policy';
import {
  AgentConfigurationError,
  AgentModelResponseError,
  AgentUnavailableError,
  type AgentFunctionCall,
  type AgentModel,
  type AgentModelRequest,
  type AgentModelResponse,
} from './contracts';

/** Verified against the official Responses API documentation on 2026-08-25. */
export const DEFAULT_AGENT_MODEL = 'gpt-5.5';
const DEFAULT_TIMEOUT_MS = 20_000;

export interface AgentRuntimeConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
}

function requiredEnvironment(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new AgentConfigurationError('AI agent is not configured');
  return normalized;
}

function optionalModel(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_AGENT_MODEL;
  if (normalized.length > 160 || /[\u0000-\u001F]/.test(normalized)) throw new AgentConfigurationError('AI agent is not configured');
  return normalized;
}

function timeoutFromEnvironment(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_TIMEOUT_MS;
  if (!/^\d{1,6}$/.test(value.trim())) throw new AgentConfigurationError('AI agent is not configured');
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new AgentConfigurationError('AI agent is not configured');
  return timeoutMs;
}

export function agentRuntimeConfig(environment: Readonly<Record<string, string | undefined>> = process.env): AgentRuntimeConfig {
  return Object.freeze({
    apiKey: requiredEnvironment(environment.OPENAI_KEY_AGENT),
    model: optionalModel(environment.OPENAI_AGENT_MODEL),
    timeoutMs: timeoutFromEnvironment(environment.OPENAI_AGENT_TIMEOUT_MS),
  });
}

function functionCallsFromOutput(output: readonly unknown[]): readonly AgentFunctionCall[] {
  const calls: AgentFunctionCall[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Readonly<Record<string, unknown>>;
    if (record.type !== 'function_call') continue;
    if (typeof record.call_id !== 'string' || typeof record.name !== 'string' || typeof record.arguments !== 'string') {
      throw new AgentModelResponseError('Invalid model response');
    }
    calls.push(Object.freeze({ callId: record.call_id, name: record.name, argumentsJson: record.arguments }));
  }
  return Object.freeze(calls);
}

export class OpenAiResponsesModel implements AgentModel {
  readonly #client: OpenAI;
  readonly #config: AgentRuntimeConfig;

  constructor(config: AgentRuntimeConfig = agentRuntimeConfig()) {
    this.#config = config;
    // The custom environment variable is intentionally wired explicitly and
    // never delegated to the SDK default OPENAI_API_KEY lookup.
    this.#client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 0,
      logLevel: 'off',
    });
  }

  async generate(input: AgentModelRequest): Promise<AgentModelResponse> {
    try {
      if (input.signal.aborted) throw input.signal.reason ?? new DOMException('Aborted', 'AbortError');
      const response = await this.#client.responses.create({
        model: this.#config.model,
        instructions: EUTAKTOS_AGENT_POLICY,
        input: input.history as never,
        tools: input.tools as never,
        store: false,
      }, { signal: input.signal });
      const output = Array.isArray(response.output) ? response.output : undefined;
      if (!output || typeof response.id !== 'string' || !response.id.trim()) throw new AgentModelResponseError('Invalid model response');
      const functionCalls = functionCallsFromOutput(output);
      const message = typeof response.output_text === 'string' ? response.output_text.trim() : '';
      if (!functionCalls.length && !message) throw new AgentModelResponseError('Invalid model response');
      return Object.freeze({
        responseId: response.id,
        message,
        functionCalls,
        continuationItems: Object.freeze(toResponseInputItems(output as never)),
      });
    } catch (error) {
      if (error instanceof AgentModelResponseError) throw error;
      if (input.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      if (error instanceof OpenAI.APIError || error instanceof OpenAI.APIConnectionError || error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new AgentUnavailableError('AI service temporarily unavailable');
      }
      throw new AgentUnavailableError('AI service temporarily unavailable');
    }
  }
}
