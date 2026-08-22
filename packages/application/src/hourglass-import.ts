export const HOURGLASS_IMPORT_LIMITS = Object.freeze({
  maxJsonBytes: 5_000_000,
  maxPublishers: 10_000,
  maxGroups: 2_000,
  maxPrivileges: 200,
  maxStringLength: 500,
} as const);

export const HOURGLASS_EXTERNAL_ID_PREFIX = 'hourglass:publisher:';
export const HOURGLASS_PRIVILEGE_PREFIX = 'hourglass:';

type JsonRecord = Readonly<Record<string, unknown>>;

export interface HourglassPublisher {
  readonly externalId: string;
  readonly sourceId: number;
  readonly displayName: string;
  readonly sourceUuid?: string;
}

export interface HourglassExplicitPrivilege {
  readonly externalPersonId: string;
  readonly assignmentTypeId: string;
}

export interface HourglassGroupSummary {
  readonly externalId: string;
  readonly name?: string;
}

export interface HourglassImportReport {
  readonly format: 'hourglass-json-export-v1';
  readonly publisherCount: number;
  readonly groupCount: number;
  readonly explicitPrivilegeCount: number;
  readonly unknownTopLevelSections: readonly string[];
  readonly unknownPublisherFields: readonly string[];
  readonly unknownGroupFields: readonly string[];
  readonly recognizedSections: readonly string[];
}

export interface HourglassImportInspection {
  readonly publishers: readonly HourglassPublisher[];
  readonly groups: readonly HourglassGroupSummary[];
  readonly explicitPrivileges: readonly HourglassExplicitPrivilege[];
  readonly report: Readonly<HourglassImportReport>;
}

export type HourglassPreviewAction = 'create' | 'unchanged' | 'conflict';

export interface ExistingHourglassPerson {
  readonly tenantId: string;
  readonly externalId: string;
  readonly personId: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly explicitAssignmentTypeIds: readonly string[];
}

export interface HourglassPreviewPerson {
  readonly externalId: string;
  readonly displayName: string;
  readonly action: HourglassPreviewAction;
  readonly targetPersonId?: string;
  readonly reasons: readonly string[];
  readonly explicitAssignmentTypeIds: readonly string[];
}

export interface HourglassMigrationPreview {
  readonly persons: readonly HourglassPreviewPerson[];
  readonly counts: Readonly<Record<HourglassPreviewAction, number>>;
  readonly report: Readonly<HourglassImportReport>;
}

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const KNOWN_TOP_LEVEL = new Set([
  'addresses', 'attendance', 'congregation', 'fsGroups', 'monthlyTotals', 'notPublishers',
  'privileges', 'publishers', 'reports', 'territories', 'territoryRecords',
]);
const KNOWN_PUBLISHER_FIELDS = new Set(['id', 'uuid', 'firstname', 'lastname', 'middlename', 'suffix']);
const KNOWN_GROUP_FIELDS = new Set(['id', 'name', 'members', 'overseer_id', 'assistant_id', 'overseer', 'assistant', 'notes']);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function safeKeys(value: JsonRecord, label: string): readonly string[] {
  const keys = Object.keys(value);
  if (keys.some(key => UNSAFE_KEYS.has(key))) throw new Error(`${label} contains an unsafe key`);
  return Object.freeze([...keys].sort());
}

function assertSafeTree(value: unknown, depth = 0): void {
  if (depth > 16) throw new Error('Hourglass import is nested too deeply');
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertSafeTree(item, depth + 1);
    return;
  }
  const record = asRecord(value, 'Hourglass value');
  for (const key of safeKeys(record, 'Hourglass value')) assertSafeTree(record[key], depth + 1);
}

function requiredInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be a string when present`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return undefined;
  if (normalized.length > HOURGLASS_IMPORT_LIMITS.maxStringLength) throw new Error(`${label} is too long`);
  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(normalized)) throw new Error(`${label} contains control characters`);
  return normalized;
}

function publisherDisplayName(record: JsonRecord, index: number): string {
  const first = optionalText(record.firstname, `publishers[${index}].firstname`);
  const last = optionalText(record.lastname, `publishers[${index}].lastname`);
  const middle = optionalText(record.middlename, `publishers[${index}].middlename`);
  const suffix = optionalText(record.suffix, `publishers[${index}].suffix`);
  const displayName = [first, middle, last, suffix].filter((value): value is string => Boolean(value)).join(' ');
  if (!displayName) throw new Error(`publishers[${index}] requires a name`);
  return displayName;
}

function externalId(sourceId: number): string { return `${HOURGLASS_EXTERNAL_ID_PREFIX}${sourceId}`; }
function assignmentTypeId(privilege: string): string {
  const normalized = optionalText(privilege, 'privilege name');
  if (!normalized || !/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(normalized)) throw new Error('privilege name is invalid');
  return `${HOURGLASS_PRIVILEGE_PREFIX}${normalized}`;
}

function unknownFields(records: readonly JsonRecord[], known: ReadonlySet<string>, label: string): readonly string[] {
  const result = new Set<string>();
  for (const record of records) for (const key of safeKeys(record, label)) if (!known.has(key)) result.add(key);
  return Object.freeze([...result].sort());
}

/**
 * Parses only the demonstrated Hourglass JSON export shape. It accepts no aliases,
 * silently ignores no unknown section names, and never maps personal attributes to
 * eligibility. The returned value is a read-only inspection; it performs no writes.
 */
export function inspectHourglassJsonExport(value: unknown, byteLength?: number): Readonly<HourglassImportInspection> {
  if (byteLength !== undefined && (!Number.isInteger(byteLength) || byteLength < 0 || byteLength > HOURGLASS_IMPORT_LIMITS.maxJsonBytes)) throw new Error('Hourglass JSON file is too large');
  const root = asRecord(value, 'Hourglass export');
  assertSafeTree(root);
  const rootKeys = safeKeys(root, 'Hourglass export');
  if (!Array.isArray(root.publishers) || !Array.isArray(root.fsGroups) || !isRecord(root.privileges)) {
    throw new Error('Unrecognized Hourglass JSON export format');
  }
  if (root.publishers.length > HOURGLASS_IMPORT_LIMITS.maxPublishers) throw new Error('Hourglass export contains too many publishers');
  if (root.fsGroups.length > HOURGLASS_IMPORT_LIMITS.maxGroups) throw new Error('Hourglass export contains too many groups');

  const publisherRecords = root.publishers.map((item, index) => asRecord(item, `publishers[${index}]`));
  const sourceIds = new Set<number>();
  const publishers = publisherRecords.map((record, index) => {
    const sourceId = requiredInteger(record.id, `publishers[${index}].id`);
    if (sourceIds.has(sourceId)) throw new Error('Hourglass export contains duplicate publisher ids');
    sourceIds.add(sourceId);
    const sourceUuid = optionalText(record.uuid, `publishers[${index}].uuid`);
    return Object.freeze({ externalId: externalId(sourceId), sourceId, displayName: publisherDisplayName(record, index), ...(sourceUuid ? { sourceUuid } : {}) });
  });

  const groupRecords = root.fsGroups.map((item, index) => asRecord(item, `fsGroups[${index}]`));
  const groupIds = new Set<number>();
  const groups = groupRecords.map((record, index) => {
    const sourceId = requiredInteger(record.id, `fsGroups[${index}].id`);
    if (groupIds.has(sourceId)) throw new Error('Hourglass export contains duplicate group ids');
    groupIds.add(sourceId);
    const name = optionalText(record.name, `fsGroups[${index}].name`);
    return Object.freeze({ externalId: `hourglass:fs-group:${sourceId}`, ...(name ? { name } : {}) });
  });

  const privileges = asRecord(root.privileges, 'privileges');
  const privilegeKeys = safeKeys(privileges, 'privileges');
  if (privilegeKeys.length > HOURGLASS_IMPORT_LIMITS.maxPrivileges) throw new Error('Hourglass export contains too many privilege types');
  const explicitPrivileges: HourglassExplicitPrivilege[] = [];
  const seenGrants = new Set<string>();
  for (const privilege of privilegeKeys) {
    const assigned = privileges[privilege];
    if (!Array.isArray(assigned)) throw new Error(`privileges.${privilege} must be an array`);
    const typeId = assignmentTypeId(privilege);
    for (const [index, personId] of assigned.entries()) {
      const sourceId = requiredInteger(personId, `privileges.${privilege}[${index}]`);
      if (!sourceIds.has(sourceId)) throw new Error(`privileges.${privilege} references an unknown publisher`);
      const key = `${externalId(sourceId)}\u0000${typeId}`;
      if (!seenGrants.has(key)) { seenGrants.add(key); explicitPrivileges.push(Object.freeze({ externalPersonId: externalId(sourceId), assignmentTypeId: typeId })); }
    }
  }
  explicitPrivileges.sort((left, right) => left.externalPersonId.localeCompare(right.externalPersonId) || left.assignmentTypeId.localeCompare(right.assignmentTypeId));

  const report: HourglassImportReport = Object.freeze({
    format: 'hourglass-json-export-v1',
    publisherCount: publishers.length,
    groupCount: groups.length,
    explicitPrivilegeCount: explicitPrivileges.length,
    unknownTopLevelSections: Object.freeze(rootKeys.filter(key => !KNOWN_TOP_LEVEL.has(key))),
    unknownPublisherFields: unknownFields(publisherRecords, KNOWN_PUBLISHER_FIELDS, 'publisher'),
    unknownGroupFields: unknownFields(groupRecords, KNOWN_GROUP_FIELDS, 'fsGroup'),
    recognizedSections: Object.freeze(['publishers', 'fsGroups', 'privileges']),
  });
  return Object.freeze({ publishers: Object.freeze(publishers), groups: Object.freeze(groups), explicitPrivileges: Object.freeze(explicitPrivileges), report });
}

/** A client may use this to reject oversized JSON before parsing it. */
export function parseHourglassJsonText(jsonText: string): Readonly<HourglassImportInspection> {
  if (typeof jsonText !== 'string') throw new Error('Hourglass JSON text must be a string');
  const byteLength = new TextEncoder().encode(jsonText).byteLength;
  if (byteLength > HOURGLASS_IMPORT_LIMITS.maxJsonBytes) throw new Error('Hourglass JSON file is too large');
  let value: unknown;
  try { value = JSON.parse(jsonText); } catch { throw new Error('Hourglass JSON is malformed'); }
  return inspectHourglassJsonExport(value, byteLength);
}

/**
 * Previews only. The tenant is explicit and existing rows from other tenants are
 * ignored, so identical Hourglass external IDs can never be conflated across tenants.
 */
export function previewHourglassImport(
  inspection: Readonly<HourglassImportInspection>,
  tenantIdInput: string,
  existing: readonly ExistingHourglassPerson[],
): Readonly<HourglassMigrationPreview> {
  if (typeof tenantIdInput !== 'string' || !tenantIdInput.trim()) throw new Error('tenantId is required');
  const tenantId = tenantIdInput.trim();
  const existingByExternalId = new Map<string, ExistingHourglassPerson>();
  for (const person of existing) {
    if (person.tenantId !== tenantId) continue;
    if (existingByExternalId.has(person.externalId)) throw new Error('Duplicate existing Hourglass external id');
    existingByExternalId.set(person.externalId, person);
  }
  const grantsByPerson = new Map<string, string[]>();
  for (const grant of inspection.explicitPrivileges) {
    const grants = grantsByPerson.get(grant.externalPersonId) ?? [];
    grants.push(grant.assignmentTypeId); grantsByPerson.set(grant.externalPersonId, grants);
  }
  const persons = inspection.publishers.map(source => {
    const target = existingByExternalId.get(source.externalId);
    const grants = Object.freeze([...(grantsByPerson.get(source.externalId) ?? [])].sort());
    if (!target) return Object.freeze({ externalId: source.externalId, displayName: source.displayName, action: 'create' as const, reasons: Object.freeze([]), explicitAssignmentTypeIds: grants });
    const reasons: string[] = [];
    if (target.displayName !== source.displayName) reasons.push('Display name differs from the existing Eutaktos person');
    const currentGrants = [...new Set(target.explicitAssignmentTypeIds)].sort();
    if (currentGrants.join('\u0000') !== grants.join('\u0000')) reasons.push('Explicit eligibility differs from the Hourglass import');
    const action: HourglassPreviewAction = reasons.length === 0 ? 'unchanged' : 'conflict';
    return Object.freeze({ externalId: source.externalId, displayName: source.displayName, action, targetPersonId: target.personId, reasons: Object.freeze(reasons), explicitAssignmentTypeIds: grants });
  }).sort((left, right) => left.externalId.localeCompare(right.externalId));
  const counts: Record<HourglassPreviewAction, number> = { create: 0, unchanged: 0, conflict: 0 };
  for (const person of persons) counts[person.action] += 1;
  return Object.freeze({ persons: Object.freeze(persons), counts: Object.freeze(counts), report: inspection.report });
}


export interface HourglassContactListCsvInspection {
  readonly format: 'hourglass-contact-list-csv-v1';
  readonly recordCount: number;
  readonly headers: readonly string[];
  readonly unknownHeaders: readonly string[];
  readonly rejectedFormulaRows: number;
  readonly importable: false;
  readonly limitation: 'stable-hourglass-publisher-id-is-not-present';
}

const HOURGLASS_CONTACT_LIST_REQUIRED_HEADERS = new Set(['lastname', 'firstname']);
const HOURGLASS_CONTACT_LIST_KNOWN_HEADERS = new Set([
  'lastname', 'firstname', 'middlename', 'suffix', 'fullname', 'descriptor', 'sex', 'birth', 'baptism', 'piiconsentdate', 'appt', 'pioneerid', 'email', 'cellphone', 'homephone', 'address_id', 'address_line1', 'address_line2', 'address_city', 'address_state', 'address_postalcode', 'address_country', 'status', 'group_id', 'group_overseer', 'firstmonth', 'anointed', 'familycontact', 'comments', 'inactive', 'reportstobranch', 'tags',
]);

function parseHourglassCsv(text: string): readonly string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) { if (character === '"') { if (text[index + 1] === '"') { field += '"'; index += 1; } else quoted = false; } else field += character; continue; }
    if (character === '"') { if (field) throw new Error('Malformed Hourglass CSV quote'); quoted = true; continue; }
    if (character === ',') { row.push(field); field = ''; continue; }
    if (character === '\r' || character === '\n') { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(field); field = ''; if (row.some(value => value !== '')) rows.push(row); row = []; if (rows.length > HOURGLASS_IMPORT_LIMITS.maxPublishers + 1) throw new Error('Hourglass CSV contains too many rows'); continue; }
    field += character; if (field.length > HOURGLASS_IMPORT_LIMITS.maxStringLength * 20) throw new Error('Hourglass CSV field is too large');
  }
  if (quoted) throw new Error('Unterminated Hourglass CSV quote');
  if (field || row.length) { row.push(field); if (row.some(value => value !== '')) rows.push(row); }
  return rows;
}
function hasSpreadsheetFormula(value: string): boolean { return /^[\s\t\r\n]*[=+\-@]/.test(value); }

/**
 * The proven contact-list CSV has no stable publisher ID. It is intentionally
 * inspectable but never eligible for persistence/reconciliation by itself.
 */
export function inspectHourglassContactListCsv(csv: string): Readonly<HourglassContactListCsvInspection> {
  if (typeof csv !== 'string') throw new Error('Hourglass CSV must be a string');
  if (new TextEncoder().encode(csv).byteLength > HOURGLASS_IMPORT_LIMITS.maxJsonBytes) throw new Error('Hourglass CSV file is too large');
  const rows = parseHourglassCsv(csv.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('Hourglass CSV is empty');
  const headers = rows[0].map(header => header.trim());
  if (headers.some(header => !header)) throw new Error('Hourglass CSV has an empty header');
  if (new Set(headers).size !== headers.length) throw new Error('Hourglass CSV has duplicate headers');
  for (const header of HOURGLASS_CONTACT_LIST_REQUIRED_HEADERS) if (!headers.includes(header)) throw new Error('Unrecognized Hourglass contact-list CSV format');
  let rejectedFormulaRows = 0;
  for (const row of rows.slice(1)) { if (row.length !== headers.length) throw new Error('Hourglass CSV row has an unexpected column count'); if (row.some(hasSpreadsheetFormula)) rejectedFormulaRows += 1; }
  return Object.freeze({ format: 'hourglass-contact-list-csv-v1', recordCount: rows.length - 1, headers: Object.freeze([...headers]), unknownHeaders: Object.freeze(headers.filter(header => !HOURGLASS_CONTACT_LIST_KNOWN_HEADERS.has(header)).sort()), rejectedFormulaRows, importable: false, limitation: 'stable-hourglass-publisher-id-is-not-present' });
}


export interface HourglassPrivilegeColumnSummary {
  readonly sourceColumn: string;
  readonly occurrence: number;
  readonly explicitlyMarkedRows: number;
  readonly markerEncoding: 'single-token' | 'mixed-or-invalid';
}

export interface HourglassPrivilegesCsvInspection {
  readonly format: 'hourglass-privileges-csv-v1';
  readonly recordCount: number;
  readonly identityColumns: readonly string[];
  readonly privilegeColumns: readonly HourglassPrivilegeColumnSummary[];
  readonly unknownColumns: readonly string[];
  readonly rejectedFormulaRows: number;
  readonly requiresExplicitIdentityReconciliation: true;
  readonly importableWithoutReconciliation: false;
}

const HOURGLASS_PRIVILEGES_IDENTITY_COLUMNS = new Set(['lastname', 'firstname', 'middlename', 'suffix', 'fullname']);
const HOURGLASS_PRIVILEGES_METADATA_COLUMNS = new Set(['appt']);
const HOURGLASS_PRIVILEGE_COLUMNS = new Set([
  'Oração', 'Presidente', 'Conselheiro Aux. ( 2ª Sala)', 'Tesouros da Palavra de Deus', 'Pérolas Espirituais', 'Leitor da Bíblia', 'Contacto inicial (vídeo)', 'Iniciar conversas', 'Cultivar o interesse', 'Fazer discípulos', 'Ajudante', 'Discurso de Estudante', 'Viver como Cristãos', 'Estudo Bíblico de Congregação', 'Leitor do Estudo Bíblico de Congregação', 'Indicador', 'Assistente Zoom', 'Indicador entrada', 'Palco', 'Áudio', 'Vídeo', 'Microfones', 'Discursos Públicos', 'Discursos Públicos - Fora', 'Dirigente de A Sentinela', 'Leitor da Sentinela', 'Hospitalidade', 'Intérprete', 'Reunião de Serviço de Campo', 'Testemunho Público', 'Limpeza',
]);

/**
 * Inspects the demonstrated privilege matrix without retaining row values. Its
 * identity columns contain names only, not a stable Hourglass publisher id, so this
 * result intentionally cannot grant eligibility until an authorized human reconciles
 * every intended row with a known external publisher reference.
 */
export function inspectHourglassPrivilegesCsv(csv: string): Readonly<HourglassPrivilegesCsvInspection> {
  if (typeof csv !== 'string') throw new Error('Hourglass privileges CSV must be a string');
  if (new TextEncoder().encode(csv).byteLength > HOURGLASS_IMPORT_LIMITS.maxJsonBytes) throw new Error('Hourglass privileges CSV file is too large');
  const rows = parseHourglassCsv(csv.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('Hourglass privileges CSV requires a header and at least one row');
  const headers = rows[0].map(value => value.trim());
  if (headers.some(header => !header)) throw new Error('Hourglass privileges CSV has an empty header');
  for (const required of HOURGLASS_PRIVILEGES_IDENTITY_COLUMNS) if (!headers.includes(required)) throw new Error('Unrecognized Hourglass privileges CSV format');
  const dataRows = rows.slice(1);
  for (const row of dataRows) if (row.length !== headers.length) throw new Error('Hourglass privileges CSV row has an unexpected column count');
  const occurrences = new Map<string, number>();
  const privilegeColumns: HourglassPrivilegeColumnSummary[] = [];
  const unknownColumns = new Set<string>();
  let rejectedFormulaRows = 0;
  for (const row of dataRows) if (row.some(hasSpreadsheetFormula)) rejectedFormulaRows += 1;
  for (const [index, header] of headers.entries()) {
    const occurrence = (occurrences.get(header) ?? 0) + 1;
    occurrences.set(header, occurrence);
    if (HOURGLASS_PRIVILEGES_IDENTITY_COLUMNS.has(header) || HOURGLASS_PRIVILEGES_METADATA_COLUMNS.has(header)) continue;
    if (!HOURGLASS_PRIVILEGE_COLUMNS.has(header)) { unknownColumns.add(header); continue; }
    const marks = dataRows.map(row => row[index].trim()).filter(Boolean);
    const markerEncoding = new Set(marks).size <= 1 ? 'single-token' as const : 'mixed-or-invalid' as const;
    privilegeColumns.push(Object.freeze({ sourceColumn: header, occurrence, explicitlyMarkedRows: marks.length, markerEncoding }));
  }
  return Object.freeze({
    format: 'hourglass-privileges-csv-v1',
    recordCount: dataRows.length,
    identityColumns: Object.freeze(headers.filter(header => HOURGLASS_PRIVILEGES_IDENTITY_COLUMNS.has(header))),
    privilegeColumns: Object.freeze(privilegeColumns),
    unknownColumns: Object.freeze([...unknownColumns].sort()),
    rejectedFormulaRows,
    requiresExplicitIdentityReconciliation: true,
    importableWithoutReconciliation: false,
  });
}


export type HourglassMidweekSection = 'tgw' | 'fm' | 'lac';
export interface HourglassLegacyAssignmentSnapshot {
  readonly meetingDate: string;
  readonly externalWeekId: string;
  readonly externalAssignmentId: string;
  readonly externalPartId: string;
  readonly partType: string;
  readonly section: HourglassMidweekSection;
  readonly classroom: number;
  readonly externalAssigneeId?: string;
  readonly externalAssistantId?: string;
  /** The observed schema has no per-assignment completion or cancellation field. */
  readonly verification: 'unverified-legacy-plan';
}
export interface HourglassMidweekScheduleInspection {
  readonly format: 'hourglass-midweek-program-and-assignments-v1';
  readonly programWeekCount: number;
  readonly assignmentWeekCount: number;
  readonly matchedWeekCount: number;
  readonly matchedPartCount: number;
  readonly unmatchedProgramPartCount: number;
  readonly unmatchedAssignmentPartCount: number;
  readonly unassignedPartCount: number;
  readonly specialRoleCount: number;
  readonly legacySnapshots: readonly HourglassLegacyAssignmentSnapshot[];
  readonly historicalImportSupported: false;
  readonly historicalImportLimitation: 'assignment-state-is-not-present';
}

const MIDWEEK_SECTIONS: readonly HourglassMidweekSection[] = Object.freeze(['tgw', 'fm', 'lac']);
function requiredDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a valid YYYY-MM-DD date`);
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`${label} must be a valid YYYY-MM-DD date`);
  return value;
}
function positiveId(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}
function optionalExternalPersonId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === 0) return undefined;
  return String(positiveId(value, label));
}
function parseSection(value: unknown, label: string): readonly JsonRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return Object.freeze(value.map((item, index) => asRecord(item, `${label}[${index}]`)));
}
function programPartIndex(programWeeks: readonly JsonRecord[]): ReadonlyMap<string, { type: string; section: HourglassMidweekSection }> {
  const index = new Map<string, { type: string; section: HourglassMidweekSection }>();
  for (const [weekIndex, week] of programWeeks.entries()) {
    const date = requiredDate(week.date, `programWeeks[${weekIndex}].date`);
    positiveId(week.id, `programWeeks[${weekIndex}].id`);
    for (const section of MIDWEEK_SECTIONS) for (const [partIndex, part] of parseSection(week[section], `programWeeks[${weekIndex}].${section}`).entries()) {
      const partId = positiveId(part.id, `programWeeks[${weekIndex}].${section}[${partIndex}].id`);
      const type = optionalText(part.type, `programWeeks[${weekIndex}].${section}[${partIndex}].type`);
      if (!type) throw new Error(`programWeeks[${weekIndex}].${section}[${partIndex}].type is required`);
      const key = `${date}\u0000${partId}`;
      if (index.has(key)) throw new Error('Hourglass program has duplicate date and part id');
      index.set(key, Object.freeze({ type, section }));
    }
  }
  return index;
}

/**
 * Inspects the demonstrated pair of Hourglass program and assignment responses.
 * It intentionally labels all linked records as legacy plans: neither response
 * exposes a per-assignment completion/cancellation state, so the records cannot be
 * used as completed history or affect recency without a later explicit decision.
 */
export function inspectHourglassMidweekSchedule(programResponse: unknown, assignmentResponse: unknown): Readonly<HourglassMidweekScheduleInspection> {
  if (!Array.isArray(programResponse) || !Array.isArray(assignmentResponse)) throw new Error('Hourglass program and assignment responses must be arrays');
  if (programResponse.length > HOURGLASS_IMPORT_LIMITS.maxPublishers || assignmentResponse.length > HOURGLASS_IMPORT_LIMITS.maxPublishers) throw new Error('Hourglass schedule response contains too many weeks');
  assertSafeTree(programResponse); assertSafeTree(assignmentResponse);
  const programWeeks = programResponse.map((item, index) => asRecord(item, `programWeeks[${index}]`));
  const assignmentWeeks = assignmentResponse.map((item, index) => asRecord(item, `assignmentWeeks[${index}]`));
  const partIndex = programPartIndex(programWeeks);
  const programDates = new Set(programWeeks.map((week, index) => requiredDate(week.date, `programWeeks[${index}].date`)));
  const assignmentDates = new Set<string>();
  const matchedPartKeys = new Set<string>();
  const snapshots: HourglassLegacyAssignmentSnapshot[] = [];
  let unmatchedAssignmentPartCount = 0; let unassignedPartCount = 0; let specialRoleCount = 0;
  for (const [weekIndex, week] of assignmentWeeks.entries()) {
    const weekId = week.id === 0 ? 'unscheduled' : String(positiveId(week.id, `assignmentWeeks[${weekIndex}].id`));
    const date = requiredDate(week.date, `assignmentWeeks[${weekIndex}].date`); assignmentDates.add(date);
    for (const role of ['chairman', 'chairman2', 'chairman3', 'openprayer', 'closeprayer', 'cbs_reader']) if (optionalExternalPersonId(week[role], `assignmentWeeks[${weekIndex}].${role}`)) specialRoleCount += 1;
    for (const section of MIDWEEK_SECTIONS) for (const [assignmentIndex, assignment] of parseSection(week[section], `assignmentWeeks[${weekIndex}].${section}`).entries()) {
      const assignmentId = positiveId(assignment.id, `assignmentWeeks[${weekIndex}].${section}[${assignmentIndex}].id`);
      const partId = positiveId(assignment.part, `assignmentWeeks[${weekIndex}].${section}[${assignmentIndex}].part`);
      const classroom = assignment.classroom === undefined ? 0 : positiveOrZeroInteger(assignment.classroom, `assignmentWeeks[${weekIndex}].${section}[${assignmentIndex}].classroom`);
      const partKey = `${date}\u0000${partId}`; const definition = partIndex.get(partKey);
      if (!definition || definition.section !== section) { unmatchedAssignmentPartCount += 1; continue; }
      matchedPartKeys.add(partKey);
      const assignee = optionalExternalPersonId(assignment.assignee, `assignmentWeeks[${weekIndex}].${section}[${assignmentIndex}].assignee`);
      const assistant = optionalExternalPersonId(assignment.assistant, `assignmentWeeks[${weekIndex}].${section}[${assignmentIndex}].assistant`);
      if (!assignee) { unassignedPartCount += 1; continue; }
      snapshots.push(Object.freeze({ meetingDate: date, externalWeekId: weekId, externalAssignmentId: String(assignmentId), externalPartId: String(partId), partType: definition.type, section, classroom, externalAssigneeId: assignee, ...(assistant ? { externalAssistantId: assistant } : {}), verification: 'unverified-legacy-plan' }));
    }
  }
  snapshots.sort((left, right) => left.meetingDate.localeCompare(right.meetingDate) || left.externalAssignmentId.localeCompare(right.externalAssignmentId));
  return Object.freeze({ format: 'hourglass-midweek-program-and-assignments-v1', programWeekCount: programWeeks.length, assignmentWeekCount: assignmentWeeks.length, matchedWeekCount: [...assignmentDates].filter(date => programDates.has(date)).length, matchedPartCount: matchedPartKeys.size, unmatchedProgramPartCount: partIndex.size - matchedPartKeys.size, unmatchedAssignmentPartCount, unassignedPartCount, specialRoleCount, legacySnapshots: Object.freeze(snapshots), historicalImportSupported: false, historicalImportLimitation: 'assignment-state-is-not-present' });
}
function positiveOrZeroInteger(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`); return value; }


export interface HourglassExternalIdentityReference {
  readonly externalId: string;
  readonly sourceId: number;
}
export interface HourglassSourceAbsencePreview {
  readonly externalAbsenceId: string;
  readonly externalPersonId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  /** Preserved verbatim as a source flag; Hourglass semantics have not been inferred. */
  readonly sourcePwOnly: boolean;
}
export interface HourglassIdentityAndAbsenceInspection {
  readonly format: 'hourglass-users-and-absences-v1';
  readonly identityReferences: readonly HourglassExternalIdentityReference[];
  readonly absences: readonly HourglassSourceAbsencePreview[];
  readonly ignoredUserFieldNames: readonly string[];
  readonly availabilityImportSupported: false;
  readonly availabilityImportLimitation: 'source-pw-only-semantics-require-administrative-mapping';
}
const HOURGLASS_SAFE_USER_ID_FIELDS = new Set(['id']);
const HOURGLASS_SAFE_ABSENCE_FIELDS = new Set(['id', 'userId', 'start', 'end', 'pw_only']);
function requiredIsoDate(value: unknown, label: string): string {
  return requiredDate(value, label);
}
/**
 * Inspects the demonstrated users and absence responses with a strict data-minimising
 * allowlist. The identity response is used only to prove stable external IDs; all
 * other user fields, including encrypted values and account metadata, are ignored.
 */
export function inspectHourglassIdentityAndAbsences(usersResponse: unknown, absenceResponse: unknown): Readonly<HourglassIdentityAndAbsenceInspection> {
  const root = asRecord(usersResponse, 'Hourglass users response');
  assertSafeTree(root); assertSafeTree(absenceResponse);
  if (!Array.isArray(root.users) || !Array.isArray(absenceResponse)) throw new Error('Hourglass users and absences formats are not recognized');
  if (root.users.length > HOURGLASS_IMPORT_LIMITS.maxPublishers || absenceResponse.length > HOURGLASS_IMPORT_LIMITS.maxPublishers) throw new Error('Hourglass users or absences response contains too many records');
  const sourceIds = new Set<number>();
  const ignoredUserFields = new Set<string>();
  for (const [index, value] of root.users.entries()) {
    const user = asRecord(value, `users[${index}]`); const id = requiredInteger(user.id, `users[${index}].id`);
    if (sourceIds.has(id)) throw new Error('Hourglass users response contains duplicate ids');
    sourceIds.add(id);
    for (const key of safeKeys(user, `users[${index}]`)) if (!HOURGLASS_SAFE_USER_ID_FIELDS.has(key)) ignoredUserFields.add(key);
  }
  const absences: HourglassSourceAbsencePreview[] = [];
  const absenceIds = new Set<number>();
  for (const [index, value] of absenceResponse.entries()) {
    const absence = asRecord(value, `absences[${index}]`); const absenceId = requiredInteger(absence.id, `absences[${index}].id`);
    if (absenceIds.has(absenceId)) throw new Error('Hourglass absences response contains duplicate ids'); absenceIds.add(absenceId);
    const userId = requiredInteger(absence.userId, `absences[${index}].userId`);
    if (!sourceIds.has(userId)) throw new Error('Hourglass absence references an unknown user');
    const startsOn = requiredIsoDate(absence.start, `absences[${index}].start`); const endsOn = requiredIsoDate(absence.end, `absences[${index}].end`);
    if (startsOn > endsOn) throw new Error('Hourglass absence end precedes its start');
    if (typeof absence.pw_only !== 'boolean') throw new Error(`absences[${index}].pw_only must be boolean`);
    for (const key of safeKeys(absence, `absences[${index}]`)) if (!HOURGLASS_SAFE_ABSENCE_FIELDS.has(key)) throw new Error(`absences[${index}] contains an unsupported field`);
    absences.push(Object.freeze({ externalAbsenceId: `hourglass:absence:${absenceId}`, externalPersonId: externalId(userId), startsOn, endsOn, sourcePwOnly: absence.pw_only }));
  }
  const identityReferences = [...sourceIds].sort((left, right) => left - right).map(sourceId => Object.freeze({ externalId: externalId(sourceId), sourceId }));
  absences.sort((left, right) => left.startsOn.localeCompare(right.startsOn) || left.externalAbsenceId.localeCompare(right.externalAbsenceId));
  return Object.freeze({ format: 'hourglass-users-and-absences-v1', identityReferences: Object.freeze(identityReferences), absences: Object.freeze(absences), ignoredUserFieldNames: Object.freeze([...ignoredUserFields].sort()), availabilityImportSupported: false, availabilityImportLimitation: 'source-pw-only-semantics-require-administrative-mapping' });
}
