import { describe, expect, it } from 'vitest';
import { exportPeopleContactListCsv, peopleContactListExportFilename } from './peopleContactListExport';

describe('People Contact List CSV export', () => {
  it('exports only selected fields, omits person ids and hardens spreadsheet formulas', () => {
    const csv = exportPeopleContactListCsv([
      { personId: 'private-id', displayName: '=HYPERLINK("https://evil")', phone: '+351 210000000', email: '@danger.example' },
    ], ['phone', 'email'], 'pt-PT');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@danger.example");
    expect(csv).not.toContain('private-id');
    expect(csv).not.toContain('Morada');
  });

  it('localizes headers and creates a date-only privacy-safe filename', () => {
    const csv = exportPeopleContactListCsv([{ personId: 'p1', displayName: 'Ana', active: false }], ['state'], 'es');
    expect(csv.startsWith('Nombre,Estado')).toBe(true);
    expect(csv).toContain('Inactivo');
    expect(peopleContactListExportFilename(new Date('2026-08-27T18:30:00.000Z'))).toBe('eutaktos-contact-list-2026-08-27.csv');
  });
});
