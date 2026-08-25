import type { Locale } from './preferences';
import type { PeopleDirectoryDto, PeopleDirectoryPersonDto } from './peopleDirectoryApi';

type DirectoryCapabilities = PeopleDirectoryDto['capabilities'];

type ExportColumn = Readonly<{
  key: string;
  header: Readonly<Record<Locale, string>>;
  enabled: (capabilities: DirectoryCapabilities) => boolean;
  value: (person: PeopleDirectoryPersonDto, locale: Locale) => string;
}>;

const localized = <T extends Readonly<Record<Locale, string>>>(value: T): T => value;

const STATE = {
  'pt-PT': { active: 'Ativo', inactive: 'Inativo', available: 'Disponível', unavailable: 'Indisponível' },
  en: { active: 'Active', inactive: 'Inactive', available: 'Available', unavailable: 'Unavailable' },
  es: { active: 'Activo', inactive: 'Inactivo', available: 'Disponible', unavailable: 'No disponible' },
} as const;

function spreadsheetSafe(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsv(value: string): string {
  const safe = spreadsheetSafe(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function join(values: readonly string[]): string {
  return values.join(' | ');
}

const COLUMNS: readonly ExportColumn[] = Object.freeze([
  {
    key: 'displayName',
    header: localized({ 'pt-PT': 'Nome', en: 'Name', es: 'Nombre' }),
    enabled: () => true,
    value: person => person.displayName,
  },
  {
    key: 'state',
    header: localized({ 'pt-PT': 'Estado', en: 'State', es: 'Estado' }),
    enabled: () => true,
    value: (person, locale) => person.active ? STATE[locale].active : STATE[locale].inactive,
  },
  {
    key: 'preferredLocale',
    header: localized({ 'pt-PT': 'Idioma preferido', en: 'Preferred language', es: 'Idioma preferido' }),
    enabled: () => true,
    value: person => person.preferredLocale ?? '',
  },
  {
    key: 'groups',
    header: localized({ 'pt-PT': 'Grupos', en: 'Groups', es: 'Grupos' }),
    enabled: () => true,
    value: person => join(person.groups.map(group => group.name)),
  },
  {
    key: 'availability',
    header: localized({ 'pt-PT': 'Disponibilidade atual', en: 'Current availability', es: 'Disponibilidad actual' }),
    enabled: capabilities => capabilities.availability,
    value: (person, locale) => person.availability.status === 'ready'
      ? person.availability.current === 'available' ? STATE[locale].available : STATE[locale].unavailable
      : '',
  },
  {
    key: 'nextUnavailable',
    header: localized({ 'pt-PT': 'Próxima indisponibilidade', en: 'Next unavailability', es: 'Próxima indisponibilidad' }),
    enabled: capabilities => capabilities.availability,
    value: person => person.availability.status === 'ready' ? person.availability.nextPeriod?.startsAt ?? '' : '',
  },
  {
    key: 'eligibility',
    header: localized({ 'pt-PT': 'Elegibilidade', en: 'Eligibility', es: 'Elegibilidad' }),
    enabled: capabilities => capabilities.eligibility,
    value: person => person.eligibility.status === 'ready' ? join(person.eligibility.enabledAssignmentTypeIds) : '',
  },
  {
    key: 'responsibilities',
    header: localized({ 'pt-PT': 'Responsabilidades', en: 'Responsibilities', es: 'Responsabilidades' }),
    enabled: capabilities => capabilities.responsibilities,
    value: person => person.responsibilities.status === 'ready' ? join(person.responsibilities.keys) : '',
  },
  {
    key: 'lastCompletedAssignment',
    header: localized({ 'pt-PT': 'Última designação concluída', en: 'Last completed assignment', es: 'Última asignación completada' }),
    enabled: capabilities => capabilities.schedule,
    value: person => person.assignmentHistory.status === 'ready' ? person.assignmentHistory.lastCompletedMeetingDate ?? '' : '',
  },
]);

export function peopleDirectoryExportColumns(capabilities: DirectoryCapabilities): readonly string[] {
  return Object.freeze(COLUMNS.filter(column => column.enabled(capabilities)).map(column => column.key));
}

export function exportPeopleDirectoryCsv(
  people: readonly PeopleDirectoryPersonDto[],
  capabilities: DirectoryCapabilities,
  locale: Locale,
): string {
  const columns = COLUMNS.filter(column => column.enabled(capabilities));
  const sorted = [...people].sort((left, right) => left.displayName.localeCompare(right.displayName, locale) || left.id.localeCompare(right.id));
  const lines = [columns.map(column => escapeCsv(column.header[locale])).join(',')];
  for (const person of sorted) {
    lines.push(columns.map(column => escapeCsv(column.value(person, locale))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function peopleDirectoryExportFilename(now: Date = new Date()): string {
  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `eutaktos-people-${year}-${month}-${day}.csv`;
}
