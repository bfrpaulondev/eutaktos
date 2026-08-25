import { SafeLogger, type SafeLogEntry, type SafeLogSink } from '@eutaktos/infrastructure';
import type { ApiRequest, ApiResponse } from './_types';
import { header } from './_types';

const CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

class ConsoleSafeLogSink implements SafeLogSink {
  write(entry: Readonly<SafeLogEntry>): void {
    // SafeLogEntry metadata is allowlisted by SafeLogger; never log request bodies,
    // cookies, tenant/actor ids, URLs or free-form error messages here.
    console.log(JSON.stringify(entry));
  }
}

const logger = new SafeLogger(new ConsoleSafeLogSink());

export function correlationIdForRequest(request: ApiRequest): string {
  const supplied = header(request, 'x-correlation-id')?.trim();
  return supplied && CORRELATION_ID.test(supplied) ? supplied : crypto.randomUUID();
}

export function attachCorrelationId(request: ApiRequest, response: ApiResponse): string {
  const correlationId = correlationIdForRequest(request);
  request.correlationId = correlationId;
  response.setHeader('X-Correlation-Id', correlationId);
  return correlationId;
}

export function logRequestSuccess(request: ApiRequest, correlationId: string, startedAt: number): void {
  logger.info('api.request.completed', {
    correlationId,
    httpMethod: request.method,
    durationMs: Math.max(0, Date.now() - startedAt),
    success: true,
  });
}

/**
 * Agent telemetry is metadata-only. The SafeLogger runtime allowlist excludes
 * bodies, tenant/actor identifiers, names, secrets and free-form text.
 */
export function logAgentEvent(
  event: 'agent.requested' | 'agent.tool_invoked' | 'agent.completed' | 'agent.denied' | 'agent.failed' | 'agent.feedback_recorded',
  metadata: Readonly<Record<string, unknown>>,
): void {
  logger.info(event, metadata);
}

export function logRequestFailure(
  request: ApiRequest,
  correlationId: string,
  startedAt: number,
  error: unknown,
  status: number,
): void {
  logger.failure('api.request.failed', error, {
    correlationId,
    httpMethod: request.method,
    httpStatus: status,
    durationMs: Math.max(0, Date.now() - startedAt),
    success: false,
  });
}
