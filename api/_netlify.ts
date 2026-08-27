import type { ApiHandler, ApiRequest, ApiResponse } from './_types';
import healthHandler from './health';
import readyHandler from './ready';
import sessionHandler from './session';
import logoutHandler from './session/logout';
import logoutAllHandler from './session/logout-all';
import rotateSessionHandler from './session/rotate';
import authOtpHandler from './auth/otp';
import authVerifyHandler from './auth/verify';
import peopleHandler from './people';
import peopleDirectoryHandler from './people/directory';
import peopleOverviewEvidenceHandler from './people/overview-evidence';
import peopleAssistanceHandler from './people/assistance';
import peopleRecommendationsHandler from './people/recommendations';
import peopleRemindersHandler from './people/reminders';
import peopleContactListHandler from './people/contact-list';
import peopleRecordCardsHandler from './people/record-cards';
import peopleMapHandler from './people/map';
import peopleTransfersHandler from './people/transfers';
import peopleTransferPreviewHandler from './people/transfers/preview';
import peopleTransferClaimHandler from './people/transfers/claim';
import peopleTransferCancelHandler from './people/transfers/[transferId]/cancel';
import personHandler from './people/[personId]';
import personArchiveHandler from './people/[personId]/archive';
import personMapLocationHandler from './people/[personId]/map-location';
import eligibilityHandler from './people/[personId]/eligibility';
import availabilityHandler from './people/[personId]/availability';
import ordinaryContactHandler from './people/[personId]/contact';
import availabilityPeriodHandler from './people/[personId]/availability/[availabilityPeriodId]';
import hourglassPreviewHandler from './import/hourglass/preview';
import hourglassPrepareHandler from './import/hourglass/prepare';
import hourglassExecuteHandler from './import/hourglass/execute';
import hourglassRollbackHandler from './import/hourglass/rollback';
import householdsHandler from './households';
import householdHandler from './households/[householdId]';
import serviceGroupsHandler from './service-groups';
import serviceGroupHandler from './service-groups/[serviceGroupId]';
import responsibilitiesHandler from './responsibilities';
import responsibilityHandler from './responsibilities/[responsibilityId]';
import endResponsibilityHandler from './responsibilities/[responsibilityId]/end';
import congregationSettingsHandler from './congregation/settings';
import auditHistoryHandler from './audit/history';
import accessGrantsHandler from './access/grants';
import subjectGrantsHandler from './access/subjects/[subjectId]/grants';
import revokeGrantHandler from './access/grants/[grantId]/revoke';
import midweekHandler from './midweek';
import midweekRouteHandler from './midweek/[...route]';
import outboxWorkerHandler from './workers/outbox';
import agentRespondHandler from './agent/respond';

export interface NetlifyApiEvent {
  readonly httpMethod?: string;
  readonly path?: string;
  readonly rawUrl?: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly multiValueHeaders?: Readonly<Record<string, readonly string[] | undefined>>;
  readonly queryStringParameters?: Readonly<Record<string, string | undefined>>;
  readonly multiValueQueryStringParameters?: Readonly<Record<string, readonly string[] | undefined>>;
  readonly body?: string | null;
  readonly isBase64Encoded?: boolean;
}

export interface NetlifyApiResult {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly multiValueHeaders?: Readonly<Record<string, readonly string[]>>;
  readonly body: string;
}

type RouteKey =
  | 'health' | 'ready' | 'session' | 'logout' | 'logout-all' | 'rotate-session' | 'auth-otp' | 'auth-verify'
  | 'people' | 'people-directory' | 'people-overview-evidence' | 'people-assistance' | 'people-recommendations' | 'people-reminders' | 'people-contact-list' | 'people-record-cards' | 'people-map' | 'people-transfers' | 'people-transfer-preview' | 'people-transfer-claim' | 'people-transfer-cancel' | 'person' | 'person-archive' | 'person-map-location' | 'eligibility' | 'availability' | 'ordinary-contact' | 'availability-period'
  | 'hourglass-preview' | 'hourglass-prepare' | 'hourglass-execute' | 'hourglass-rollback'
  | 'households' | 'household' | 'service-groups' | 'service-group'
  | 'responsibilities' | 'responsibility' | 'end-responsibility' | 'congregation-settings' | 'audit-history'
  | 'access-grants' | 'subject-grants' | 'revoke-grant' | 'midweek' | 'midweek-route' | 'outbox-worker' | 'agent-respond';

interface RouteMatch {
  readonly key: RouteKey;
  readonly params: Readonly<Record<string, string>>;
}

const handlers: Readonly<Record<RouteKey, ApiHandler>> = Object.freeze({
  health: healthHandler,
  ready: readyHandler,
  session: sessionHandler,
  logout: logoutHandler,
  'logout-all': logoutAllHandler,
  'rotate-session': rotateSessionHandler,
  'auth-otp': authOtpHandler,
  'auth-verify': authVerifyHandler,
  people: peopleHandler,
  'people-directory': peopleDirectoryHandler,
  'people-overview-evidence': peopleOverviewEvidenceHandler,
  'people-assistance': peopleAssistanceHandler,
  'people-recommendations': peopleRecommendationsHandler,
  'people-reminders': peopleRemindersHandler,
  'people-contact-list': peopleContactListHandler,
  'people-record-cards': peopleRecordCardsHandler,
  'people-map': peopleMapHandler,
  'people-transfers': peopleTransfersHandler,
  'people-transfer-preview': peopleTransferPreviewHandler,
  'people-transfer-claim': peopleTransferClaimHandler,
  'people-transfer-cancel': peopleTransferCancelHandler,
  person: personHandler,
  'person-archive': personArchiveHandler,
  'person-map-location': personMapLocationHandler,
  eligibility: eligibilityHandler,
  availability: availabilityHandler,
  'ordinary-contact': ordinaryContactHandler,
  'availability-period': availabilityPeriodHandler,
  'hourglass-preview': hourglassPreviewHandler,
  'hourglass-prepare': hourglassPrepareHandler,
  'hourglass-execute': hourglassExecuteHandler,
  'hourglass-rollback': hourglassRollbackHandler,
  households: householdsHandler,
  household: householdHandler,
  'service-groups': serviceGroupsHandler,
  'service-group': serviceGroupHandler,
  responsibilities: responsibilitiesHandler,
  responsibility: responsibilityHandler,
  'end-responsibility': endResponsibilityHandler,
  'congregation-settings': congregationSettingsHandler,
  'audit-history': auditHistoryHandler,
  'access-grants': accessGrantsHandler,
  'subject-grants': subjectGrantsHandler,
  'revoke-grant': revokeGrantHandler,
  midweek: midweekHandler,
  'midweek-route': midweekRouteHandler,
  'outbox-worker': outboxWorkerHandler,
  'agent-respond': agentRespondHandler,
});

function decodeSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.includes('/') || decoded.includes('\\')) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

export function normalizeNetlifyApiPath(event: NetlifyApiEvent): string {
  let path = event.path;
  if (!path && event.rawUrl) {
    try { path = new URL(event.rawUrl).pathname; } catch { path = '/'; }
  }
  path = path || '/';
  path = path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '');
  path = path.replace(/^\/api(?=\/|$)/, '');
  path = `/${path}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return path || '/';
}

export function matchNetlifyApiRoute(path: string): RouteMatch | undefined {
  const exact: Readonly<Record<string, RouteKey>> = Object.freeze({
    '/health': 'health',
    '/ready': 'ready',
    '/session': 'session',
    '/session/logout': 'logout',
    '/session/logout-all': 'logout-all',
    '/session/rotate': 'rotate-session',
    '/auth/otp': 'auth-otp',
    '/auth/verify': 'auth-verify',
    '/people': 'people',
    '/people/directory': 'people-directory',
    '/people/overview-evidence': 'people-overview-evidence',
    '/people/assistance': 'people-assistance',
    '/people/recommendations': 'people-recommendations',
    '/people/reminders': 'people-reminders',
    '/people/contact-list': 'people-contact-list',
    '/people/record-cards': 'people-record-cards',
    '/people/map': 'people-map',
    '/people/transfers': 'people-transfers',
    '/people/transfers/preview': 'people-transfer-preview',
    '/people/transfers/claim': 'people-transfer-claim',
    '/import/hourglass/preview': 'hourglass-preview',
    '/import/hourglass/prepare': 'hourglass-prepare',
    '/import/hourglass/execute': 'hourglass-execute',
    '/import/hourglass/rollback': 'hourglass-rollback',
    '/households': 'households',
    '/service-groups': 'service-groups',
    '/responsibilities': 'responsibilities',
    '/congregation/settings': 'congregation-settings',
    '/audit/history': 'audit-history',
    '/access/grants': 'access-grants',
    '/midweek': 'midweek',
    '/workers/outbox': 'outbox-worker',
    '/agent/respond': 'agent-respond',
  });
  const exactKey = exact[path];
  if (exactKey) return Object.freeze({ key: exactKey, params: Object.freeze({}) });

  const transferCancelMatch = /^\/people\/transfers\/([^/]+)\/cancel$/.exec(path);
  if (transferCancelMatch) {
    const transferId = decodeSegment(transferCancelMatch[1] ?? '');
    if (!transferId) return undefined;
    return Object.freeze({ key: 'people-transfer-cancel', params: Object.freeze({ transferId }) });
  }

  const midweekMatch = /^\/midweek\/(.+)$/.exec(path);
  if (midweekMatch) {
    const decoded = midweekMatch[1].split('/').map(decodeSegment);
    if (decoded.some(value => !value)) return undefined;
    return Object.freeze({ key: 'midweek-route', params: Object.freeze({ route: decoded.join('/') }) });
  }

  const availabilityPeriodMatch = /^\/people\/([^/]+)\/availability\/([^/]+)$/.exec(path);
  if (availabilityPeriodMatch) {
    const personId = decodeSegment(availabilityPeriodMatch[1] ?? '');
    const availabilityPeriodId = decodeSegment(availabilityPeriodMatch[2] ?? '');
    if (!personId || !availabilityPeriodId) return undefined;
    return Object.freeze({
      key: 'availability-period',
      params: Object.freeze({ personId, availabilityPeriodId }),
    });
  }

  const patterns: readonly [RegExp, RouteKey, string][] = [
    [/^\/people\/([^/]+)\/archive$/, 'person-archive', 'personId'],
    [/^\/people\/([^/]+)\/map-location$/, 'person-map-location', 'personId'],
    [/^\/people\/([^/]+)\/eligibility$/, 'eligibility', 'personId'],
    [/^\/people\/([^/]+)\/availability$/, 'availability', 'personId'],
    [/^\/people\/([^/]+)\/contact$/, 'ordinary-contact', 'personId'],
    [/^\/people\/([^/]+)$/, 'person', 'personId'],
    [/^\/households\/([^/]+)$/, 'household', 'householdId'],
    [/^\/service-groups\/([^/]+)$/, 'service-group', 'serviceGroupId'],
    [/^\/responsibilities\/([^/]+)\/end$/, 'end-responsibility', 'responsibilityId'],
    [/^\/responsibilities\/([^/]+)$/, 'responsibility', 'responsibilityId'],
    [/^\/access\/subjects\/([^/]+)\/grants$/, 'subject-grants', 'subjectId'],
    [/^\/access\/grants\/([^/]+)\/revoke$/, 'revoke-grant', 'grantId'],
  ];
  for (const [pattern, key, paramName] of patterns) {
    const match = pattern.exec(path);
    if (!match) continue;
    const decoded = decodeSegment(match[1] ?? '');
    if (!decoded) return undefined;
    return Object.freeze({ key, params: Object.freeze({ [paramName]: decoded }) });
  }
  return undefined;
}

function requestHeaders(event: NetlifyApiEvent): Readonly<Record<string, string | string[] | undefined>> {
  const result: Record<string, string | string[] | undefined> = { ...(event.headers ?? {}) };
  for (const [name, values] of Object.entries(event.multiValueHeaders ?? {})) {
    if (!values?.length) continue;
    result[name] = values.length === 1 ? values[0] : [...values];
  }
  return result;
}

function requestQuery(event: NetlifyApiEvent, params: Readonly<Record<string, string>>): Readonly<Record<string, string | string[] | undefined>> {
  const result: Record<string, string | string[] | undefined> = { ...(event.queryStringParameters ?? {}) };
  for (const [name, values] of Object.entries(event.multiValueQueryStringParameters ?? {})) {
    if (!values?.length) continue;
    result[name] = values.length === 1 ? values[0] : [...values];
  }
  return Object.freeze({ ...result, ...params });
}

function requestBody(event: NetlifyApiEvent, headers: Readonly<Record<string, string | string[] | undefined>>): unknown {
  if (event.body === undefined || event.body === null || event.body === '') return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const contentTypeEntry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
  const contentType = Array.isArray(contentTypeEntry) ? contentTypeEntry[0] : contentTypeEntry;
  if (contentType?.toLowerCase().includes('application/json')) return JSON.parse(raw);
  return raw;
}

function netlifyResponse(): { response: ApiResponse; result: () => NetlifyApiResult } {
  let statusCode = 200;
  let body = '';
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, readonly string[]> = {};
  const response: ApiResponse = {
    status(code) { statusCode = code; return response; },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        multiValueHeaders[name] = [...value];
        delete headers[name];
      } else {
        headers[name] = value as string;
        delete multiValueHeaders[name];
      }
    },
    json(value) { body = JSON.stringify(value); },
    end(value) { body = value ?? ''; },
  };
  return {
    response,
    result: () => Object.freeze({
      statusCode,
      headers: Object.freeze({ ...headers }),
      ...(Object.keys(multiValueHeaders).length ? { multiValueHeaders: Object.freeze({ ...multiValueHeaders }) } : {}),
      body,
    }),
  };
}

function safeJsonError(statusCode: number, error: string): NetlifyApiResult {
  return Object.freeze({
    statusCode,
    headers: Object.freeze({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }),
    body: JSON.stringify({ error }),
  });
}

export async function handleNetlifyApiEvent(event: NetlifyApiEvent): Promise<NetlifyApiResult> {
  const path = normalizeNetlifyApiPath(event);
  const route = matchNetlifyApiRoute(path);
  if (!route) return safeJsonError(404, 'Not found');

  const headers = requestHeaders(event);
  let body: unknown;
  try { body = requestBody(event, headers); }
  catch { return safeJsonError(400, 'Invalid JSON body'); }

  const request: ApiRequest = {
    method: event.httpMethod?.toUpperCase(),
    headers,
    query: requestQuery(event, route.params),
    ...(body !== undefined ? { body } : {}),
  };
  const { response, result } = netlifyResponse();
  await handlers[route.key](request, response);
  return result();
}
