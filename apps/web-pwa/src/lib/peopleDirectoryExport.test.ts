import { describe, expect, it } from 'vitest';
import { exportPeopleDirectoryCsv, peopleDirectoryExportColumns, peopleDirectoryExportFilename } from './peopleDirectoryExport';
import type { PeopleDirectoryDto, PeopleDirectoryPersonDto } from './peopleDirectoryApi';

const fullCapabilities: PeopleDirectoryDto['capabilities'] = Object.freeze({ writePeople: true, availability: true, eligibility: true, responsibilities: true, schedule: true });

const person = (overrides: Partial<PeopleDirectoryPersonDto> = {}): PeopleDirectoryPersonDto => Object.freeze({
  id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true,
  groups: Object.freeze([{ id: 'group-1', name: 'Grupo 1' }]),
  availability: Object.freeze({ status: 'ready' as const, current: 'available' as const, currentReasonCodes: Object.freeze([]), nextPeriod: Object.freeze({ startsAt: '2026-09-12T00:00:00.000Z', endsAt: '2026-09-18T00:00:00.000Z', reasonCode: 'away' as const }) }),
  eligibility: Object.freeze({ status: 'ready' as const, enabledAssignmentTypeIds: Object.freeze(['builtin:reading']) }),
  responsibilities: Object.freeze({ status: 'ready' as const, keys: Object.freeze(['service-group-overseer']) }),
  assignmentHistory: Object.freeze({ status: 'ready' as const, lastCompletedMeetingDate: '2026-07-22' }),
  ...overrides,
});

describe('People Directory capability-aware CSV export', () => {
  it('includes only fields backed by the caller capabilities', () => {
    const limited: PeopleDirectoryDto['capabilities'] = Object.freeze({ writePeople: false, availability: false, eligibility: true, responsibilities: false, schedule: false });
    expect(peopleDirectoryExportColumns(limited)).toEqual(['displayName', 'state', 'preferredLocale', 'groups', 'eligibility']);
    const csv = exportPeopleDirectoryCsv([person()], limited, 'en');
    expect(csv.split('\r\n')[0]).toBe('Name,State,Preferred language,Groups,Eligibility');
    expect(csv).toContain('Ana Martins,Active,pt-PT,Grupo 1,builtin:reading');
    expect(csv).not.toContain('service-group-overseer');
    expect(csv).not.toContain('2026-07-22');
    expect(csv).not.toContain('2026-09-12');
  });

  it('does not manufacture values for unavailable authorized evidence', () => {
    const unavailable = person({
      availability: Object.freeze({ status: 'unavailable' as const }),
      eligibility: Object.freeze({ status: 'unavailable' as const }),
      responsibilities: Object.freeze({ status: 'unavailable' as const }),
      assignmentHistory: Object.freeze({ status: 'unavailable' as const }),
    });
    expect(exportPeopleDirectoryCsv([unavailable], fullCapabilities, 'pt-PT').split('\r\n')[1]).toBe('Ana Martins,Ativo,pt-PT,Grupo 1,,,,,');
  });

  it('is deterministic, escapes CSV content and neutralizes spreadsheet formulas', () => {
    const formula = person({ id: 'person-2', displayName: '=HYPERLINK("https://bad.example")', groups: Object.freeze([{ id: 'group-2', name: 'Grupo, Dois' }]) });
    const disguisedFormula = person({ id: 'person-3', displayName: ' \t=SUM(1+1)' });
    const first = person({ id: 'person-1', displayName: 'Ana Martins' });
    const csv = exportPeopleDirectoryCsv([formula, disguisedFormula, first], fullCapabilities, 'en');
    expect(csv).toBe(exportPeopleDirectoryCsv([first, disguisedFormula, formula], fullCapabilities, 'en'));
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Grupo, Dois"');
    expect(csv).toContain("' \t=SUM(1+1)");
  });

  it('uses a stable UTC filename', () => {
    expect(peopleDirectoryExportFilename(new Date('2026-08-25T23:55:00-07:00'))).toBe('eutaktos-people-2026-08-26.csv');
  });
});
