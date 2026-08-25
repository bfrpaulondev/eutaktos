import { requireCapability, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { AgentConfigurationError, AgentModelResponseError, AgentUnavailableError } from './contracts';
import { OpenAiResponsesModel } from './openai-client';
import { EutaktosAgentService } from './service';
import { logAgentEvent } from '../_observability';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const body = requestBody(request.body);
    // Deliberately reject tenantId, actorId, role and capabilities rather than
    // accepting them as hints. Server session records are authoritative.
    exactKeys(body, ['message']);
    const message = requiredString(body, 'message', 4_000);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'tenant.manage');
    try {
      const service = new EutaktosAgentService({ model: new OpenAiResponsesModel() });
      const result = await service.respond(principal, database, { message, correlationId: request.correlationId });
      json(response, 200, result);
    } catch (error) {
      if (error instanceof AgentConfigurationError || error instanceof AgentUnavailableError) {
        logAgentEvent('agent.failed', { correlationId: request.correlationId, operation: 'respond', errorCode: 'upstream_unavailable' });
        json(response, 503, { error: 'AI service temporarily unavailable' });
        return;
      }
      if (error instanceof AgentModelResponseError) {
        logAgentEvent('agent.failed', { correlationId: request.correlationId, operation: 'respond', errorCode: 'invalid_upstream_response' });
        json(response, 502, { error: 'AI service returned an invalid response' });
        return;
      }
      throw error;
    }
  });
};

export default handler;
