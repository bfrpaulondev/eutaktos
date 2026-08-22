import { describe, expect, it } from 'vitest';
import { inspectHourglassContactListCsv, inspectHourglassIdentityAndAbsences, inspectHourglassJsonExport, inspectHourglassMidweekSchedule, inspectHourglassPrivilegesCsv, parseHourglassJsonText, previewHourglassImport } from './hourglass-import';

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

  it('is preview-only, idempotent and tenant-scoped', () => {
    const inspection = inspectHourglassJsonExport(fixture);
    const preview = previewHourglassImport(inspection, 'tenant-a', [
      { tenantId: 'tenant-a', externalId: 'hourglass:publisher:101', personId: 'person-1', displayName: 'Ana Exemplo', active: true, explicitAssignmentTypeIds: ['hourglass:reading'] },
      { tenantId: 'tenant-a', externalId: 'hourglass:publisher:202', personId: 'person-2', displayName: 'Outro nome', active: true, explicitAssignmentTypeIds: [] },
      { tenantId: 'tenant-b', externalId: 'hourglass:publisher:101', personId: 'person-other-tenant', displayName: 'Wrong tenant', active: true, explicitAssignmentTypeIds: [] },
    ]);
    expect(preview.counts).toEqual({ create: 0, unchanged: 1, conflict: 1 });
    expect(preview.persons[0].targetPersonId).toBe('person-1');
    expect(preview.persons.every(person => person.targetPersonId !== 'person-other-tenant')).toBe(true);
    expect(preview.persons[1].reasons).toEqual([
      'Display name differs from the existing Eutaktos person',
      'Explicit eligibility differs from the Hourglass import',
    ]);
    expect(() => previewHourglassImport(inspection, '   ', [])).toThrow('tenantId is required');
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

  it('links demonstrated program and assignment responses without treating past plans as completed history', () => {
    const program = [{ id: 9001, date: '2025-09-01', lang: 'TPO', tgw: [{ id: 1001, type: 'reading' }], fm: [{ id: 1002, type: 'initcall' }], lac: [{ id: 1003, type: 'cbs' }] }];
    const assignments = [{ id: 8001, date: '2025-09-01', chairman: 101, chairman2: 0, chairman3: 0, openprayer: 102, closeprayer: 0, cbs_reader: 103, tgw: [{ id: 7001, assignee: 101, assistant: 0, classroom: 0, part: 1001 }], fm: [{ id: 7002, assignee: 102, assistant: 103, classroom: 1, part: 1002 }], lac: [{ id: 7003, assignee: 0, assistant: 0, classroom: 0, part: 1003 }], workbookChanged: false }];
    const inspection = inspectHourglassMidweekSchedule(program, assignments);
    expect(inspection).toMatchObject({ matchedWeekCount: 1, matchedPartCount: 3, unassignedPartCount: 1, specialRoleCount: 3, historicalImportSupported: false, historicalImportLimitation: 'assignment-state-is-not-present' });
    expect(inspection.legacySnapshots).toEqual([
      { meetingDate: '2025-09-01', externalWeekId: '8001', externalAssignmentId: '7001', externalPartId: '1001', partType: 'reading', section: 'tgw', classroom: 0, externalAssigneeId: '101', verification: 'unverified-legacy-plan' },
      { meetingDate: '2025-09-01', externalWeekId: '8001', externalAssignmentId: '7002', externalPartId: '1002', partType: 'initcall', section: 'fm', classroom: 1, externalAssigneeId: '102', externalAssistantId: '103', verification: 'unverified-legacy-plan' },
    ]);
  });

  it('rejects calendar rollover in schedules and absences', () => {
    const invalidProgram = [{ id: 9001, date: '2025-02-30', tgw: [], fm: [], lac: [] }];
    const invalidAssignments = [{ id: 8001, date: '2025-02-30', tgw: [], fm: [], lac: [] }];
    expect(() => inspectHourglassMidweekSchedule(invalidProgram, invalidAssignments)).toThrow('valid YYYY-MM-DD date');
    expect(() => inspectHourglassIdentityAndAbsences(
      { users: [{ id: 101 }] },
      [{ id: 1, userId: 101, start: '2026-02-30', end: '2026-03-01', pw_only: false }],
    )).toThrow('valid YYYY-MM-DD date');
  });

  it('allows only external identity references and explicit absence fields from the demonstrated statistics responses', () => {
    const inspection = inspectHourglassIdentityAndAbsences(
      { users: [{ id: 101, descriptor: 'Ignored name', email: 'ignored@example.invalid', lastmobiletoken: 'ignored-secret-like-value' }, { id: 102, emergencycontacts: [{ id: 1 }] }] },
      [{ id: 7001, userId: 101, start: '2026-08-01', end: '2026-08-03', pw_only: true }],
    );
    expect(inspection.identityReferences).toEqual([{ externalId: 'hourglass:publisher:101', sourceId: 101 }, { externalId: 'hourglass:publisher:102', sourceId: 102 }]);
    expect(inspection.absences).toEqual([{ externalAbsenceId: 'hourglass:absence:7001', externalPersonId: 'hourglass:publisher:101', startsOn: '2026-08-01', endsOn: '2026-08-03', sourcePwOnly: true }]);
    expect(inspection.ignoredUserFieldNames).toEqual(['descriptor', 'email', 'emergencycontacts', 'lastmobiletoken']);
    expect(inspection).toMatchObject({ availabilityImportSupported: false, availabilityImportLimitation: 'source-pw-only-semantics-require-administrative-mapping' });
    expect(() => inspectHourglassIdentityAndAbsences({ users: [{ id: 101 }] }, [{ id: 1, userId: 101, start: '2026-08-04', end: '2026-08-01', pw_only: false }])).toThrow('precedes');
    expect(() => inspectHourglassIdentityAndAbsences({ users: [{ id: 101 }] }, [{ id: 1, userId: 101, start: '2026-08-01', end: '2026-08-02', pw_only: false, note: 'do not retain' }])).toThrow('unsupported field');
  });

  it('rejects malformed, unknown and dangerous data rather than guessing a schema', () => {
    expect(() => parseHourglassJsonText('{')).toThrow('Hourglass JSON is malformed');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: { reading: [999] } })).toThrow('unknown publisher');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: {}, constructor: {} })).toThrow('unsafe key');
    expect(() => inspectHourglassJsonExport({ publishers: [], fsGroups: [], privileges: [], attendance: {} })).toThrow('Unrecognized Hourglass JSON export format');
  });
});


it('never reconciles a preview by display name when the stable external id differs', () => {
  const inspection = inspectHourglassJsonExport(fixture);
  const preview = previewHourglassImport(inspection, 'tenant-a', [
    { tenantId: 'tenant-a', externalId: 'hourglass:publisher:999', personId: 'same-name-person', displayName: 'Ana Exemplo', active: true, explicitAssignmentTypeIds: [] },
  ]);
  const ana = preview.persons.find(person => person.externalId === 'hourglass:publisher:101');
  expect(ana).toMatchObject({ action: 'create' });
  expect(ana?.targetPersonId).toBeUndefined();
});
