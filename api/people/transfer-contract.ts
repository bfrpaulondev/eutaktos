import { ordinaryContactOf, type CongregationPerson } from '@eutaktos/domain';
import { BadRequestError, exactKeys, requestBody, stringArray } from '../_endpoint';

export const PEOPLE_TRANSFER_TTL_MS = 72 * 60 * 60 * 1000;
export const PEOPLE_TRANSFER_MAX_PEOPLE = 25;

export interface TransferPayloadPerson {
  readonly displayName: string;
  readonly preferredLocale?: string;
  readonly ordinaryContact?: Readonly<{ phone?: string; email?: string; address?: string }>;
}

export type PeopleTransferStatus = 'pending' | 'claimed' | 'expired' | 'cancelled';

export function parseSendPeopleTransferBody(value: unknown): readonly string[] {
  const body = requestBody(value);
  exactKeys(body, ['personIds']);
  const ids = stringArray(body, 'personIds', PEOPLE_TRANSFER_MAX_PEOPLE);
  if (!ids.length) throw new BadRequestError('personIds must not be empty');
  return ids;
}

export function parseTransferCodeBody(value: unknown): string {
  const body = requestBody(value);
  exactKeys(body, ['code']);
  const code = body.code;
  if (typeof code !== 'string') throw new BadRequestError('code must be a string');
  const normalized = code.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(normalized)) throw new BadRequestError('code is invalid');
  return normalized;
}

export function transferPayloadFromPeople(people: readonly Readonly<CongregationPerson>[]): readonly Readonly<TransferPayloadPerson>[] {
  return Object.freeze(people.map(person => {
    const contact = ordinaryContactOf(person);
    const ordinaryContact = Object.keys(contact).length ? Object.freeze({ ...contact }) : undefined;
    return Object.freeze({
      displayName: person.displayName,
      ...(person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
      ...(ordinaryContact ? { ordinaryContact } : {}),
    });
  }));
}

export function transferStatus(value: Readonly<{ expiresAt: string; claimedAt?: string; cancelledAt?: string }>, nowMs = Date.now()): PeopleTransferStatus {
  if (value.claimedAt) return 'claimed';
  if (value.cancelledAt) return 'cancelled';
  return Date.parse(value.expiresAt) <= nowMs ? 'expired' : 'pending';
}

export function createPeopleTransferSecret(): Readonly<{ code: string; tokenHash: Promise<string> }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const code = Buffer.from(bytes).toString('base64url');
  const tokenHash = crypto.subtle.digest('SHA-256', bytes).then(digest => Buffer.from(digest).toString('hex'));
  return Object.freeze({ code, tokenHash });
}

export async function hashPeopleTransferCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Buffer.from(code, 'base64url'));
  return Buffer.from(digest).toString('hex');
}