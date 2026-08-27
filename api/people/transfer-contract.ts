import { ordinaryContactOf, type CongregationPerson } from '@eutaktos/domain';
import { BadRequestError, exactKeys, requestBody, stringArray } from '../_endpoint';

export const PEOPLE_TRANSFER_TTL_MS = 72 * 60 * 60 * 1000;
export const PEOPLE_TRANSFER_MAX_PEOPLE = 25;

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

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

function base64UrlEncode(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64URL[(combined >>> 18) & 63];
    output += BASE64URL[(combined >>> 12) & 63];
    if (second !== undefined) output += BASE64URL[(combined >>> 6) & 63];
    if (third !== undefined) output += BASE64URL[combined & 63];
  }
  return output;
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new BadRequestError('code is invalid');
  const output = new Uint8Array(32);
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (const character of value) {
    const digit = BASE64URL.indexOf(character);
    if (digit < 0) throw new BadRequestError('code is invalid');
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (offset < output.length) output[offset++] = (buffer >>> bits) & 255;
    }
  }
  if (offset !== output.length) throw new BadRequestError('code is invalid');
  return output;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function hexDigest(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createPeopleTransferSecret(): Readonly<{ code: string; tokenHash: Promise<string> }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const code = base64UrlEncode(bytes);
  const tokenHash = crypto.subtle.digest('SHA-256', exactArrayBuffer(bytes)).then(hexDigest);
  return Object.freeze({ code, tokenHash });
}

export async function hashPeopleTransferCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', exactArrayBuffer(base64UrlDecode(code)));
  return hexDigest(digest);
}
