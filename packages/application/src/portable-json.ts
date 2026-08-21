export const PORTABLE_JSON_VERSION = 1;
export const PORTABLE_JSON_FORMAT = 'eutaktos/people-portable';

export interface PortablePerson {
  externalId: string;
  displayName: string;
  preferredLocale?: string;
  active: boolean;
}

export interface PortableJsonDocument {
  format: string;
  version: number;
  exportedAt: string;
  tenantId: string;
  people: readonly PortablePerson[];
}

export interface SerializeOptions {
  tenantId: string;
  omitSecrets?: boolean;
}

export interface ParseResult {
  document: PortableJsonDocument;
  warnings: readonly string[];
}

const ALLOWED_PERSON_KEYS = new Set<keyof PortablePerson>([
  'externalId',
  'displayName',
  'preferredLocale',
  'active',
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set<keyof PortableJsonDocument>([
  'format',
  'version',
  'exportedAt',
  'tenantId',
  'people',
]);

function stripSecrets(person: PortablePerson): PortablePerson {
  const clean: PortablePerson = {
    externalId: person.externalId,
    displayName: person.displayName,
    active: person.active,
  };
  if (person.preferredLocale !== undefined) {
    clean.preferredLocale = person.preferredLocale;
  }
  return clean;
}

export function serializePortableJson(
  people: readonly PortablePerson[],
  options: SerializeOptions,
): string {
  // Always strip to only PortablePerson fields — defense in depth
  const sanitizedPeople = people.map(stripSecrets);

  const document: PortableJsonDocument = {
    format: PORTABLE_JSON_FORMAT,
    version: PORTABLE_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    tenantId: options.tenantId,
    people: sanitizedPeople,
  };

  return JSON.stringify(document, null, 2);
}

export function parsePortableJson(jsonText: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON: cannot parse input');
  }

  const doc = validatePortableDocument(parsed);
  const warnings = collectWarnings(parsed);

  return { document: doc, warnings };
}

function collectWarnings(parsed: unknown): string[] {
  const warnings: string[] = [];

  if (typeof parsed !== 'object' || parsed === null) return warnings;

  const obj = parsed as Record<string, unknown>;

  // Check for unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key as keyof PortableJsonDocument)) {
      warnings.push(`Unknown top-level key: ${key}`);
    }
  }

  // Check for extra fields on person objects
  const people = obj['people'];
  if (Array.isArray(people)) {
    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      if (typeof person === 'object' && person !== null) {
        for (const key of Object.keys(person as Record<string, unknown>)) {
          if (!ALLOWED_PERSON_KEYS.has(key as keyof PortablePerson)) {
            warnings.push(`Person at index ${i} has unknown field: ${key}`);
          }
        }
      }
    }
  }

  return warnings;
}

export function validatePortableDocument(doc: unknown): PortableJsonDocument {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('Document must be an object');
  }

  const obj = doc as Record<string, unknown>;

  // Check format
  if (obj['format'] !== PORTABLE_JSON_FORMAT) {
    throw new Error(`Invalid format: expected '${PORTABLE_JSON_FORMAT}'`);
  }

  // Check version
  if (obj['version'] !== PORTABLE_JSON_VERSION) {
    throw new Error(`Unsupported version: expected ${PORTABLE_JSON_VERSION}`);
  }

  // Check exportedAt
  const exportedAt = obj['exportedAt'];
  if (typeof exportedAt !== 'string' || !isValidISODate(exportedAt)) {
    throw new Error('exportedAt must be a valid ISO 8601 date string');
  }

  // Check tenantId
  const tenantId = obj['tenantId'];
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('tenantId must be a non-empty string');
  }

  // Check people is array
  const people = obj['people'];
  if (!Array.isArray(people)) {
    throw new Error('people must be an array');
  }

  // Validate each person
  for (let i = 0; i < people.length; i++) {
    validatePerson(people[i], i);
  }

  return {
    format: obj['format'] as string,
    version: obj['version'] as number,
    exportedAt: exportedAt as string,
    tenantId: tenantId as string,
    people: people as PortablePerson[],
  };
}

function isValidISODate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function validatePerson(person: unknown, index: number): void {
  if (typeof person !== 'object' || person === null) {
    throw new Error(`Person at index ${index} must be an object`);
  }

  const obj = person as Record<string, unknown>;

  if (typeof obj['externalId'] !== 'string' || (obj['externalId'] as string).length === 0) {
    throw new Error(`Person at index ${index} must have a non-empty externalId`);
  }

  if (typeof obj['displayName'] !== 'string' || (obj['displayName'] as string).length === 0) {
    throw new Error(`Person at index ${index} must have a non-empty displayName`);
  }

  if (typeof obj['active'] !== 'boolean') {
    throw new Error(`Person at index ${index} must have a boolean active field`);
  }

  if (obj['preferredLocale'] !== undefined && typeof obj['preferredLocale'] !== 'string') {
    throw new Error(`Person at index ${index} preferredLocale must be a string if provided`);
  }
}
