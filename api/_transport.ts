import type { VerifiedPrincipal as TransportPrincipal, TransportRequest, TransportResponse } from '@eutaktos/transport';
import type { VerifiedPrincipal } from './_auth';
import { header, json, type ApiRequest, type ApiResponse } from './_types';

export function transportPrincipal(principal: VerifiedPrincipal): TransportPrincipal {
  return Object.freeze({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
}

export function correlationId(request: ApiRequest): string | undefined {
  const raw = header(request, 'x-request-id')?.trim();
  if (!raw || raw.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(raw)) return undefined;
  return raw;
}

export function transportRequest(
  request: ApiRequest,
  principal: VerifiedPrincipal,
  params?: Readonly<Record<string, string | undefined>>,
): TransportRequest {
  return {
    principal: transportPrincipal(principal),
    ...(params ? { params } : {}),
    ...(request.body !== undefined ? { body: request.body } : {}),
    ...(correlationId(request) ? { correlationId: correlationId(request) } : {}),
  };
}

export function sendTransport(response: ApiResponse, result: TransportResponse): void {
  json(response, result.status, result.body);
}
