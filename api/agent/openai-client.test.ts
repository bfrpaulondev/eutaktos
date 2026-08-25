import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentConfigurationError, AgentModelResponseError, AgentUnavailableError } from './contracts';
import { agentRuntimeConfig, DEFAULT_AGENT_MODEL, OpenAiResponsesModel } from './openai-client';

const request = () => ({
  history: [{ role: 'user', content: 'Hello' }],
  tools: [],
  signal: new AbortController().signal,
});

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiResponsesModel configuration and failure boundary', () => {
  it('requires only the custom server-side key and centralizes the verified default model', () => {
    expect(() => agentRuntimeConfig({})).toThrow(AgentConfigurationError);
    expect(agentRuntimeConfig({ OPENAI_KEY_AGENT: 'agent-key' })).toMatchObject({ model: DEFAULT_AGENT_MODEL, timeoutMs: 20_000 });
    expect(agentRuntimeConfig({ OPENAI_KEY_AGENT: 'agent-key', OPENAI_AGENT_MODEL: 'configured-model' }).model).toBe('configured-model');
  });

  it('maps provider 429 and 5xx failures to a safe unavailable error', async () => {
    for (const status of [429, 503]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'provider detail' } }), {
        status, headers: { 'content-type': 'application/json', 'x-request-id': 'req-test' },
      })));
      const model = new OpenAiResponsesModel({ apiKey: 'agent-key', model: DEFAULT_AGENT_MODEL, timeoutMs: 1_000 });
      await expect(model.generate(request())).rejects.toBeInstanceOf(AgentUnavailableError);
      vi.unstubAllGlobals();
    }
  });

  it('rejects an invalid provider response instead of fabricating an answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'resp-1', output: [], output_text: '' }), {
      status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-test' },
    })));
    const model = new OpenAiResponsesModel({ apiKey: 'agent-key', model: DEFAULT_AGENT_MODEL, timeoutMs: 1_000 });
    await expect(model.generate(request())).rejects.toBeInstanceOf(AgentModelResponseError);
  });
});
