import { describe, expect, it } from 'vitest';
import { acceptsHourglassFilename, inspectHourglassSelectedSource } from './HourglassImportInspector';

describe('Hourglass import source selection', () => {
  it('accepts only the extension associated with the explicitly selected source', () => {
    expect(acceptsHourglassFilename('json', 'export.JSON')).toBe(true);
    expect(acceptsHourglassFilename('json', 'contacts.csv')).toBe(false);
    expect(acceptsHourglassFilename('contacts-csv', 'contacts.CSV')).toBe(true);
    expect(acceptsHourglassFilename('privileges-csv', 'privileges.csv')).toBe(true);
    expect(acceptsHourglassFilename('privileges-csv', 'export.json')).toBe(false);
  });

  it('does not silently fall back to a different parser when the selected format is wrong', () => {
    expect(() => inspectHourglassSelectedSource('json', 'lastname,firstname\nSilva,Ana')).toThrow();
    expect(() => inspectHourglassSelectedSource('contacts-csv', '{"publishers":[]}')).toThrow();
  });
});
