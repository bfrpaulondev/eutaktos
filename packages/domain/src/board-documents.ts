import type { TenantId } from './people';
import { validateDisplayWindow, classifyDisplayWindow, type DisplayWindowClassification } from './display-window';

export type BoardDocumentId = string;

const ALLOWED_MIME_PREFIXES = ['application/', 'image/', 'text/', 'video/', 'audio/'] as const;

export interface BoardDocument {
  readonly id: BoardDocumentId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly mimeType: string;
  readonly resourceType: 'external' | 'internal';
  readonly resourceReference: string;
  readonly url: string | null;
  readonly displayFrom: string | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

function isValidUrl(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

function isValidMimeType(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p));
}

export function createBoardDocument(input: {
  id: BoardDocumentId; tenantId: TenantId; title: string; mimeType: string;
  resourceType: 'external' | 'internal'; resourceReference: string;
  url?: string | null; displayFrom?: string | null; expiresAt?: string | null; now: string;
}): Readonly<BoardDocument> {
  validateInstant(input.now);
  const title = required(input.title, 'title');
  if (title.length > 300) throw new Error('title is too long (max 300)');
  if (!isValidMimeType(input.mimeType)) throw new Error(`Invalid MIME type: ${input.mimeType}`);
  required(input.resourceReference, 'resourceReference');
  if (input.resourceType !== 'external' && input.resourceType !== 'internal') throw new Error('resourceType must be external or internal');

  let url: string | null = null;
  if (input.url != null && input.url !== '') {
    if (!isValidUrl(input.url)) throw new Error('Invalid URL: must be http/https');
    url = input.url;
  }

  let displayFrom: string | null = null;
  if (input.displayFrom != null && input.displayFrom !== '') { validateInstant(input.displayFrom); displayFrom = input.displayFrom; }
  let expiresAt: string | null = null;
  if (input.expiresAt != null && input.expiresAt !== '') { validateInstant(input.expiresAt); expiresAt = input.expiresAt; }

  validateDisplayWindow({ displayFrom, expiresAt });

  return Object.freeze({
    id: required(input.id, 'documentId'), tenantId: required(input.tenantId, 'tenantId'),
    title, mimeType: input.mimeType, resourceType: input.resourceType,
    resourceReference: input.resourceReference, url, displayFrom, expiresAt,
    createdAt: input.now,
  });
}

export function classifyBoardDocument(doc: Readonly<BoardDocument>, at?: string): DisplayWindowClassification {
  return classifyDisplayWindow({ displayFrom: doc.displayFrom, expiresAt: doc.expiresAt }, at);
}

export function assertBoardDocumentTenant(doc: Readonly<BoardDocument>, tenantId: TenantId): void {
  if (doc.tenantId !== tenantId) throw new Error('Cross-tenant board document access denied');
}

export function normalizeBoardDocument(input: BoardDocument): Readonly<BoardDocument> {
  required(input.id, 'documentId'); required(input.tenantId, 'tenantId');
  required(input.title, 'title'); required(input.resourceReference, 'resourceReference');
 validateInstant(input.createdAt);
  if (!isValidMimeType(input.mimeType)) throw new Error(`Invalid MIME type`);
  if (input.url !== null && !isValidUrl(input.url)) throw new Error('Invalid URL');
  return Object.freeze({ ...input });
}
