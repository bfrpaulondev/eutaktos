import { describe, expect, it } from 'vitest';
import { inspectHourglassContactListCsv, inspectHourglassJsonExport, inspectHourglassPrivilegesCsv, parseHourglassJsonText, previewHourglassImport } from './hourglass-import';

const fixture = {
  publishers: [
    { id: 101, uuid: '00000000-0000-4000-8000-000000000101', firstname: 'Ana', lastname: 'Exemplo', middlename: '', suffix: '', email: 'ignored@example.invalid', appt: 'ignored' },
    { id: 202, uuid: '00000000-0000-4000-8000-000000000202', firstname: 'Bruno', lastname: 'Demonstração', anointed: true, comments: 'ignored' },
  ],
  fsGroups: [{ id: 5, name: 'Grupo de demonstração', members: [101, 202], notes: 'ignored' }],
  privileges: { reading: [101, 101], prayer: [202] },
  unrecognizedSection: { sensitiveValue: 'must never be persisted or logged' },
};

describe('Hourglass JSON import adapter', () => {
  it('recognizes only the demonstrated sections and derives explicit eligibility from privileges', () => {
    const inspection = inspectHourglassJsonExport(fixture);
    expect(inspection.publishers.map(person => person.externalId)).toEqual(['hourglass:publisher:101', 'hourglass:publisher:202']);
    expect(inspection.explicitPrivileges).toEqual([
      { externalPersonId: 'hourglass:publisher:101', assignmentTypeId: 'hourglass:reading' },
      { externalPersonId: 'hourglass:publisher:202', assignmentTypeId: 'hourglass:prayer' },
    ]);
    expect(inspection.report.unknownTopLevelSections).toEqual(['unrecognizedSection']);
    expect(inspection.report.unknownPublisherFields).toContain('email');
    expect(inspection.report.unknownPublisherFields).toContain('appt');
  });

  it('is preview-only and idempotently recognizes an unchanged re-import', () => {
    const inspection = inspectHourglassJsonExport(fixture);
    const preview = previewHourglassImport(inspection, [
      { externalId: 'hourglass:publisher:101', personId: 'person-1', displayName: 'Ana Exemplo', active: true, explicitAssignmentTypeIds: ['hourglass:reading'] },
      { externalId: 'hourglass:publisher:202', personId: 'person-2', displayName: 'Outro nome', active: true, explicitAssignmentTypeIds: [] },
    ]);
    expect(preview.counts).toEqual({ create: 0, unchanged: 1, conflict: 1 });
    expect(preview.persons[1].reasons).toEqual([
      'Display name differs from the existing Eutaktos person',
      'Explicit eligibility differs from the Hourglass import',
    ]);
  });

  it('inspects the proven contact-list CSV but refuses to use it as an import without a stable publisher ID', () => {
    const inspection = inspectHourglassContactListCsv('lastname,firstname,address_id\r\nExemplo,Ana,ADDR-1\r\nDemonstração,Bruno,=unsafe\r\n');
    expect(inspection).toMatchObject({ format: 'hourglass-contact-list-csv-v1', recordCount: 2, rejectedFormulaRows: 1, importable: false, limitation: 'stable-hourglass-publisher-id-is-not-present' });
    expect(() => inspectHourglassContactListCsv('firstname,address_id\nAna,ADDR-1\n')).toThrow('Unrecognized Hourglass contact-list CSV format');
  });

  it('inspects an explicit privilege matrix but forbids grants until identity reconciliation', () => {
    const inspection = inspectHourglassPrivilegesCsv('lastname,firstname,middlename,suffix,fullname,appt,Oração,Presidente,Presidente\r\nExemplo,Ana,,,Ana Exemplo,,X,,X\r\nDemonstração,Bruno,,,Bruno Demonstração,,X,=unsafe,X\r\n');
    expect(inspection).toMatchObject({ format: 'hourglass-privileges-csv-v1', recordCount: 2, requiresExplicitIdentityReconciliation: true, importableWithoutReconciliation: false, rejectedFormulaRows: 1 });
    expect(inspection.privilegeColumns).toEqual([
      { sourceColumn: 'Oração', occurrence: 1, explicitlyMarkedRows: 2, markerEncoding: 'single-token' },
      { sourceColumn: 'Presidente', occurrence: 1, explicitlyMarkedRows: 1, markerEncoding: 'single-token' },
      { sourceColumn: 'Presidente', occurrence: 2, explicitlyMarkedRows: 2, markerEncoding: 'single-token' },
    ]);
  });

  it('rejects malformed, unknown and dangerous data rather than guessing a schema', () => {
    expect(() => parseHourglassJsonText('{')).toThrow('Hourglass JSON is malformed');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: { reading: [999] } })).toThrow('unknown publisher');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: {}, constructor: {} })).toThrow('unsafe key');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: [], attendance: {} })).toThrow('Unrecognized Hourglass JSON export format');
  });
});
