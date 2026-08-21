import type { TenantId } from './people';
import { classifyDisplayWindow, validateDisplayWindow, type DisplayWindowClassification } from './display-window';

export type BoardDocumentId = string;
export type BoardResourceType = 'external' | 'internal';

export interface BoardDocument {
  readonly id: BoardDocumentId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly mimeType: string;
  readonly resourceType: BoardResourceType;
  readonly resourceReference: string;
  readonly url: string | null;
  readonly displayFrom: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

const MIME_TYPE = /^(application|image|text|video|audio)\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function normalizeMimeType(value: string): string {
  const mime = required(value, 'mimeType').toLowerCase();
  if (!MIME_TYPE.test(mime)) throw new Error(`Invalid MIME type: ${value}`);
  return mime;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
    if (url.username || url.password) throw new Error('credentials');
    return url.toString();
  } catch {
    throw new Error('Invalid URL: must be credential-free http/https');
  }
}

function normalizeInstant(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  validateInstant(value);
  return value;
}

function validateResource(resourceType: BoardResourceType, url: string | null): void {
  if (resourceType !== 'external' && resourceType !== 'internal') {
    throw new Error('resourceType must be external or internal');
  }
  if (resourceType === 'external' && url === null) throw new Error('external resources require a URL');
  if (resourceType === 'internal' && url !== null) throw new Error('internal resources cannot contain an external URL');
}

export function createBoardDocument(input: {
  id: BoardDocumentId;
  tenantId: TenantId;
  title: string;
  mimeType: string;
  resourceType: BoardResourceType;
  resourceReference: string;
  url?: string | null;
  displayFrom?: string | null;
  expiresAt?: string | null;
  now: string;
}): Readonly<BoardDocument> {
  validateInstant(input.now);
  const title = required(input.title, 'title');
  if (title.length > 300) throw new Error('title is too long (max 300)');
  const resourceReference = required(input.resourceReference, 'resourceReference');
  if (resourceReference.length > 1000) throw new Error('resourceReference is too long (max 1000)');
  const mimeType = normalizeMimeType(input.mimeType);
  const url = normalizeUrl(input.url);
  validateResource(input.resourceType, url);
  const displayFrom = normalizeInstant(input.displayFrom, 'displayFrom');
  const expiresAt = normalizeInstant(input.expiresAt, 'expiresAt');
  validateDisplayWindow({ displayFrom, expiresAt });

  return Object.freeze({
    id: required(input.id, 'documentId'),
    tenantId: required(input.tenantId, 'tenantId'),
    title,
    mimeType,
    resourceType: input.resourceType,
    resourceReference,
    url,
    displayFrom,
    expiresAt,
    createdAt: input.now,
  });
}

export function classifyBoardDocument(
  document: Readonly<BoardDocument>,
  at?: string,
): DisplayWindowClassification {
  return classifyDisplayWindow({ displayFrom: document.displayFrom, expiresAt: document.expiresAt }, at);
}

export function assertBoardDocumentTenant(document: Readonly<BoardDocument>, tenantId: TenantId): void {
  if (document.tenantId !== tenantId) throw new Error('Cross-tenant board document access denied');
}

export function normalizeBoardDocument(input: BoardDocument): Readonly<BoardDocument> {
  const id = required(input.id, 'documentId');
  const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title');
  if (title.length > 300) throw new Error('title is too long (max 300)');
  const resourceReference = required(input.resourceReference, 'resourceReference');
  if (resourceReference.length > 1000) throw new Error('resourceReference is too long (max 1000)');
  const mimeType = normalizeMimeType(input.mimeType);
  const url = normalizeUrl(input.url);
  validateResource(input.resourceType, url);
  validateInstant(input.createdAt);
  const displayFrom = normalizeInstant(input.displayFrom, 'displayFrom');
  const expiresAt = normalizeInstant(input.expiresAt, 'expiresAt');
  validateDisplayWindow({ displayFrom, expiresAt });
  return Object.freeze({ ...input, id, tenantId, title, resourceReference, mimeType, url, displayFrom, expiresAt });
}
