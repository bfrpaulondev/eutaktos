import type { ContactListField, ContactListPersonDto } from './peopleContactListApi';
import type { Locale } from './preferences';

const HEADERS: Readonly<Record<'displayName' | ContactListField, Readonly<Record<Locale, string>>>> = Object.freeze({
  displayName: Object.freeze({ 'pt-PT': 'Nome', en: 'Name', es: 'Nombre' }),
  phone: Object.freeze({ 'pt-PT': 'Telefone', en: 'Phone', es: 'Teléfono' }),
  email: Object.freeze({ 'pt-PT': 'Email', en: 'Email', es: 'Email' }),
  address: Object.freeze({ 'pt-PT': 'Morada', en: 'Address', es: 'Dirección' }),
  preferredLocale: Object.freeze({ 'pt-PT': 'Idioma preferido', en: 'Preferred language', es: 'Idioma preferido' }),
  groups: Object.freeze({ 'pt-PT': 'Grupos', en: 'Groups', es: 'Grupos' }),
  state: Object.freeze({ 'pt-PT': 'Estado', en: 'State', es: 'Estado' }),
});

function spreadsheetSafe(value: string): string {
  return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsv(value: string): string {
  const safe = spreadsheetSafe(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function fieldValue(person: ContactListPersonDto, field: ContactListField, locale: Locale): string {
  if (field === 'phone') return person.phone ?? '';
  if (field === 'email') return person.email ?? '';
  if (field === 'address') return person.address ?? '';
  if (field === 'preferredLocale') return person.preferredLocale ?? '';
  if (field === 'groups') return (person.groups ?? []).map(group => group.name).join(' | ');
  if (person.active === undefined) return '';
  return person.active
    ? ({ 'pt-PT': 'Ativo', en: 'Active', es: 'Activo' } as const)[locale]
    : ({ 'pt-PT': 'Inativo', en: 'Inactive', es: 'Inactivo' } as const)[locale];
}

export function exportPeopleContactListCsv(people: readonly ContactListPersonDto[], fields: readonly ContactListField[], locale: Locale): string {
  const columns: readonly ('displayName' | ContactListField)[] = ['displayName', ...fields];
  const sorted = [...people].sort((left, right) => left.displayName.localeCompare(right.displayName, locale) || left.personId.localeCompare(right.personId));
  const lines = [columns.map(column => escapeCsv(HEADERS[column][locale])).join(',')];
  for (const person of sorted) {
    lines.push(columns.map(column => escapeCsv(column === 'displayName' ? person.displayName : fieldValue(person, column, locale))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function peopleContactListExportFilename(now: Date = new Date()): string {
  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `eutaktos-contact-list-${year}-${month}-${day}.csv`;
}
