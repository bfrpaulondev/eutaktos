import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PORTABLE_JSON_VERSION,
  PORTABLE_JSON_FORMAT,
  serializePortableJson,
  parsePortableJson,
  validatePortableDocument,
  type PortablePerson,
} from './portable-json';

describe('portable-json', () => {
  const validPeople: readonly PortablePerson[] = [
    { externalId: 'ext-1', displayName: 'Alice Johnson', active: true },
    { externalId: 'ext-2', displayName: 'Bob Smith', preferredLocale: 'en-US', active: false },
  ];

  // --- serializePortableJson ---

  describe('serializePortableJson', () => {
    it('produces valid JSON with correct structure', () => {
      const json = serializePortableJson(validPeople, { tenantId: 't1' });
      const parsed = JSON.parse(json);

      expect(parsed.format).toBe(PORTABLE_JSON_FORMAT);
      expect(parsed.version).toBe(PORTABLE_JSON_VERSION);
      expect(parsed.tenantId).toBe('t1');
      expect(parsed.people).toHaveLength(2);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('uses 2-space indentation at top level', () => {
      const json = serializePortableJson(validPeople, { tenantId: 't1' });
      expect(json).toContain('  "format"');
    });

    it('sets omitSecrets to true by default, stripping extra fields', () => {
      const peopleWithSecrets: readonly PortablePerson[] = [
        { externalId: 'ext-1', displayName: 'Alice', active: true, preferredLocale: 'en' } as PortablePerson & { internalId: string },
      ];
      // Cast to add extra field at runtime
      const withSecret = [
        { ...peopleWithSecrets[0], internalId: 'secret-123' },
      ];

      const json = serializePortableJson(withSecret as unknown as PortablePerson[], { tenantId: 't1' });
      const parsed = JSON.parse(json);

      expect(parsed.people[0].internalId).toBeUndefined();
      expect(parsed.people[0].externalId).toBe('ext-1');
    });

    it('explicitly omitSecrets=false still strips non-PortablePerson fields (defense in depth)', () => {
      const withExtra = [
        { externalId: 'ext-1', displayName: 'Alice', active: true, auditTrail: 'secret' },
      ];

      const json = serializePortableJson(withExtra as unknown as PortablePerson[], {
        tenantId: 't1',
        omitSecrets: false,
      });
      const parsed = JSON.parse(json);

      // Even with omitSecrets=false, we only include known PortablePerson fields
      expect(parsed.people[0].auditTrail).toBeUndefined();
    });

    it('handles empty people array', () => {
      const json = serializePortableJson([], { tenantId: 't1' });
      const parsed = JSON.parse(json);
      expect(parsed.people).toEqual([]);
    });

    it('sets exportedAt to a valid ISO 8601 timestamp', () => {
      const json = serializePortableJson(validPeople, { tenantId: 't1' });
      const parsed = JSON.parse(json);
      expect(Number.isFinite(Date.parse(parsed.exportedAt))).toBe(true);
    });

    it('preserves preferredLocale when present', () => {
      const json = serializePortableJson(validPeople, { tenantId: 't1' });
      const parsed = JSON.parse(json);
      expect(parsed.people[0].preferredLocale).toBeUndefined();
      expect(parsed.people[1].preferredLocale).toBe('en-US');
    });
  });

  // --- parsePortableJson ---

  describe('parsePortableJson', () => {
    it('parses a valid document', () => {
      const json = serializePortableJson(validPeople, { tenantId: 't1' });
      const result = parsePortableJson(json);

      expect(result.document.format).toBe(PORTABLE_JSON_FORMAT);
      expect(result.document.version).toBe(PORTABLE_JSON_VERSION);
      expect(result.document.tenantId).toBe('t1');
      expect(result.document.people).toHaveLength(2);
      expect(result.warnings).toEqual([]);
    });

    it('throws on invalid JSON', () => {
      expect(() => parsePortableJson('not json')).toThrow('Invalid JSON');
    });

    it('rejects wrong format string', () => {
      const doc = {
        format: 'wrong/format',
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('Invalid format');
    });

    it('rejects wrong version', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 99,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('Unsupported version');
    });

    it('rejects missing people field', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('people must be an array');
    });

    it('rejects invalid person (missing externalId)', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ displayName: 'Alice', active: true }],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('non-empty externalId');
    });

    it('rejects invalid person (missing displayName)', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'ext-1', active: true }],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('non-empty displayName');
    });

    it('rejects invalid person (active is not boolean)', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'ext-1', displayName: 'Alice', active: 'yes' }],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('boolean active field');
    });

    it('rejects invalid exportedAt', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: 'not-a-date',
        tenantId: 't1',
        people: [],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('valid ISO 8601');
    });

    it('rejects empty tenantId', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: '',
        people: [],
      };
      expect(() => parsePortableJson(JSON.stringify(doc))).toThrow('non-empty string');
    });
  });

  // --- Warnings ---

  describe('warnings', () => {
    it('warns about unknown top-level keys', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [],
        extraKey: 'surprise',
      };
      const result = parsePortableJson(JSON.stringify(doc));
      expect(result.warnings).toContain('Unknown top-level key: extraKey');
    });

    it('warns about extra fields on person objects', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'e1', displayName: 'A', active: true, secretField: 'x' }],
      };
      const result = parsePortableJson(JSON.stringify(doc));
      expect(result.warnings).toContain('Person at index 0 has unknown field: secretField');
    });

    it('collects multiple warnings', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [
          { externalId: 'e1', displayName: 'A', active: true, foo: 1 },
          { externalId: 'e2', displayName: 'B', active: true, bar: 2 },
        ],
        meta: 'extra',
      };
      const result = parsePortableJson(JSON.stringify(doc));
      expect(result.warnings).toHaveLength(3);
      expect(result.warnings[0]).toBe('Unknown top-level key: meta');
    });
  });

  // --- Round-trip ---

  describe('round-trip', () => {
    it('serialize → parse preserves all PortablePerson data', () => {
      const original: readonly PortablePerson[] = [
        { externalId: 'ext-1', displayName: 'Alice Johnson', active: true, preferredLocale: 'en-US' },
        { externalId: 'ext-2', displayName: 'Böb Smïth', active: false },
        { externalId: 'ext-3', displayName: '日本語 名前', active: true, preferredLocale: 'ja' },
      ];

      const json = serializePortableJson(original, { tenantId: 't1' });
      const result = parsePortableJson(json);

      expect(result.document.people).toEqual(original);
    });
  });

  // --- Unicode handling ---

  describe('Unicode', () => {
    it('handles Unicode in displayName', () => {
      const people: readonly PortablePerson[] = [
        { externalId: 'ext-u1', displayName: '日本語 名前 🎉', active: true },
        { externalId: 'ext-u2', displayName: 'Müller-Schmidt', preferredLocale: 'de-DE', active: false },
      ];

      const json = serializePortableJson(people, { tenantId: 't1' });
      const result = parsePortableJson(json);

      expect(result.document.people[0].displayName).toBe('日本語 名前 🎉');
      expect(result.document.people[1].displayName).toBe('Müller-Schmidt');
    });

    it('handles Unicode in externalId', () => {
      const people: readonly PortablePerson[] = [
        { externalId: '外部-ID-α', displayName: 'Test', active: true },
      ];

      const json = serializePortableJson(people, { tenantId: 't1' });
      const result = parsePortableJson(json);

      expect(result.document.people[0].externalId).toBe('外部-ID-α');
    });
  });

  // --- No secrets leaked ---

  describe('no secrets leaked', () => {
    it('does not include internalId or audit data in output', () => {
      // Simulate a person object with extra internal fields
      const spy = vi.spyOn(Date.prototype, 'toISOString');
      spy.mockReturnValue('2025-01-01T00:00:00.000Z');

      const rawPeople = [
        { externalId: 'ext-1', displayName: 'Alice', active: true, internalId: 'int-secret', auditLog: ['did things'] },
      ];

      const json = serializePortableJson(rawPeople as unknown as PortablePerson[], { tenantId: 't1' });

      expect(json).not.toContain('int-secret');
      expect(json).not.toContain('auditLog');
      expect(json).not.toContain('did things');

      spy.mockRestore();
    });
  });

  // --- validatePortableDocument ---

  describe('validatePortableDocument', () => {
    it('returns the document when valid', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'e1', displayName: 'A', active: true }],
      };
      const result = validatePortableDocument(doc);
      expect(result.format).toBe(PORTABLE_JSON_FORMAT);
      expect(result.people).toHaveLength(1);
    });

    it('throws when document is not an object', () => {
      expect(() => validatePortableDocument('string')).toThrow('must be an object');
      expect(() => validatePortableDocument(42)).toThrow('must be an object');
      expect(() => validatePortableDocument(null)).toThrow('must be an object');
    });

    it('rejects invalid preferredLocale type', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'e1', displayName: 'A', active: true, preferredLocale: 123 }],
      };
      expect(() => validatePortableDocument(doc)).toThrow('preferredLocale must be a string');
    });

    it('allows undefined preferredLocale', () => {
      const doc = {
        format: PORTABLE_JSON_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        tenantId: 't1',
        people: [{ externalId: 'e1', displayName: 'A', active: true }],
      };
      const result = validatePortableDocument(doc);
      expect(result.people[0].preferredLocale).toBeUndefined();
    });
  });
});
