import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import CheckSquareOutlined from '@ant-design/icons/es/icons/CheckSquareOutlined';
import DownloadOutlined from '@ant-design/icons/es/icons/DownloadOutlined';
import EditOutlined from '@ant-design/icons/es/icons/EditOutlined';
import FilterOutlined from '@ant-design/icons/es/icons/FilterOutlined';
import PlusOutlined from '@ant-design/icons/es/icons/PlusOutlined';
import SearchOutlined from '@ant-design/icons/es/icons/SearchOutlined';
import Alert from 'antd/es/alert';
import Avatar from 'antd/es/avatar';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Popover from 'antd/es/popover';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import type { ColumnsType } from 'antd/es/table';
import { theme } from 'antd';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { peopleDirectoryApi, type PeopleDirectoryDto, type PeopleDirectoryPersonDto } from './lib/peopleDirectoryApi';
import { exportPeopleDirectoryCsv, peopleDirectoryExportFilename } from './lib/peopleDirectoryExport';
import {
  DEFAULT_PEOPLE_DIRECTORY_FILTERS,
  filterPeopleDirectory,
  hasPeopleDirectoryFilters,
  peopleDirectoryFiltersFromSearch,
  peopleDirectorySearchWithFilters,
  sanitizePeopleDirectoryFilters,
  type PeopleDirectoryFilters,
} from './lib/peopleDirectoryFilters';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { EligibilityDialog } from './EligibilityDialog';
import { AwayPeriodsSection } from './AwayPeriodsSection';
import './PeopleDirectory.css';

const { Paragraph, Text, Title } = Typography;

type LoadState = 'loading' | 'ready' | 'error';

const copy = {
  'pt-PT': {
    eyebrow: 'Pessoas', title: 'Diretório', subtitle: 'Encontre rapidamente uma pessoa e veja apenas o contexto operacional que está autorizado a consultar.',
    search: 'Procurar por nome', add: 'Adicionar pessoa', state: 'Estado', all: 'Todos', active: 'Ativo', inactive: 'Inativo',
    group: 'Grupo', allGroups: 'Todos os grupos', availability: 'Disponibilidade', available: 'Disponível agora', unavailableNow: 'Indisponível agora',
    more: 'Mais filtros', eligibility: 'Elegibilidade', allEligibility: 'Todos os tipos', responsibility: 'Responsabilidade', allResponsibilities: 'Todas',
    clear: 'Limpar filtros', results: 'resultados', result: 'resultado', loading: 'A carregar diretório…', retry: 'Tentar novamente',
    loadError: 'Não foi possível carregar o diretório. Os dados não foram substituídos por informação estimada.', unauthorized: 'É necessário iniciar sessão para consultar Pessoas.', forbidden: 'Não tem permissão para consultar Pessoas.',
    partial: 'Algum contexto operacional não está disponível com as permissões atuais. Os campos indisponíveis são mostrados como tal, nunca como zero.',
    noPeople: 'Ainda não existem pessoas.', noResults: 'Nenhuma pessoa corresponde aos filtros atuais.', noGroup: 'Sem grupo', unknown: 'Não disponível',
    nextUnavailable: 'Próxima indisponibilidade', noNextUnavailable: 'Sem próxima indisponibilidade registada', eligibleFor: 'Elegível para', eligibleTypes: 'tipos', noEligibility: 'Sem elegibilidade ativa registada',
    responsibilities: 'Responsabilidades', noResponsibilities: 'Sem responsabilidade ativa', lastAssignment: 'Última designação concluída', noAssignmentHistory: 'Sem designação concluída registada',
    locale: 'Idioma', actions: 'Ações', edit: 'Editar', contacts: 'Contactos de emergência', away: 'Ausências',
    export: 'Exportar', exportFiltered: 'Exportar resultados filtrados', selectForExport: 'Selecionar pessoas para exportar', exportSelected: 'Exportar selecionadas',
    selectedOne: 'pessoa selecionada', selectedMany: 'pessoas selecionadas', selectAllFiltered: 'Selecionar resultados', clearSelection: 'Limpar seleção', finishSelection: 'Concluir',
    selectionHelp: 'A exportação em lote inclui apenas os campos autorizados pelas suas permissões atuais.', selectPerson: 'Selecionar pessoa',
    dialogTitle: 'Nova pessoa', editTitle: 'Editar pessoa', name: 'Nome', preferredLocale: 'Idioma preferido', enabled: 'Perfil ativo', cancel: 'Cancelar', save: 'Guardar', saving: 'A guardar…',
    formError: 'Não foi possível guardar a pessoa. Tenta novamente.', success: 'Pessoa adicionada com sucesso.', updated: 'Pessoa atualizada com sucesso.', close: 'Fechar',
    discardTitle: 'Descartar alterações?', discardDetail: 'As alterações não guardadas serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar',
  },
  en: {
    eyebrow: 'People', title: 'Directory', subtitle: 'Find a person quickly and see only the operational context you are authorized to view.',
    search: 'Search by name', add: 'Add person', state: 'State', all: 'All', active: 'Active', inactive: 'Inactive',
    group: 'Group', allGroups: 'All groups', availability: 'Availability', available: 'Available now', unavailableNow: 'Unavailable now',
    more: 'More filters', eligibility: 'Eligibility', allEligibility: 'All types', responsibility: 'Responsibility', allResponsibilities: 'All',
    clear: 'Clear filters', results: 'results', result: 'result', loading: 'Loading directory…', retry: 'Try again',
    loadError: 'The directory could not be loaded. No estimated information replaced your data.', unauthorized: 'Sign-in is required to view People.', forbidden: 'You do not have permission to view People.',
    partial: 'Some operational context is unavailable with the current permissions. Unavailable fields are shown as such, never as zero.',
    noPeople: 'There are no people yet.', noResults: 'No people match the current filters.', noGroup: 'No group', unknown: 'Unavailable',
    nextUnavailable: 'Next unavailability', noNextUnavailable: 'No upcoming unavailability recorded', eligibleFor: 'Eligible for', eligibleTypes: 'types', noEligibility: 'No active eligibility recorded',
    responsibilities: 'Responsibilities', noResponsibilities: 'No active responsibility', lastAssignment: 'Last completed assignment', noAssignmentHistory: 'No completed assignment recorded',
    locale: 'Language', actions: 'Actions', edit: 'Edit', contacts: 'Emergency contacts', away: 'Away periods',
    export: 'Export', exportFiltered: 'Export filtered results', selectForExport: 'Select people to export', exportSelected: 'Export selected',
    selectedOne: 'person selected', selectedMany: 'people selected', selectAllFiltered: 'Select results', clearSelection: 'Clear selection', finishSelection: 'Done',
    selectionHelp: 'Bulk export includes only fields authorized by your current permissions.', selectPerson: 'Select person',
    dialogTitle: 'New person', editTitle: 'Edit person', name: 'Name', preferredLocale: 'Preferred language', enabled: 'Active profile', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    formError: 'The person could not be saved. Please try again.', success: 'Person added successfully.', updated: 'Person updated successfully.', close: 'Close',
    discardTitle: 'Discard changes?', discardDetail: 'Unsaved changes will be lost.', keepEditing: 'Keep editing', discard: 'Discard',
  },
  es: {
    eyebrow: 'Personas', title: 'Directorio', subtitle: 'Encuentre rápidamente una persona y vea solo el contexto operativo que está autorizado a consultar.',
    search: 'Buscar por nombre', add: 'Añadir persona', state: 'Estado', all: 'Todos', active: 'Activo', inactive: 'Inactivo',
    group: 'Grupo', allGroups: 'Todos los grupos', availability: 'Disponibilidad', available: 'Disponible ahora', unavailableNow: 'No disponible ahora',
    more: 'Más filtros', eligibility: 'Elegibilidad', allEligibility: 'Todos los tipos', responsibility: 'Responsabilidad', allResponsibilities: 'Todas',
    clear: 'Limpiar filtros', results: 'resultados', result: 'resultado', loading: 'Cargando directorio…', retry: 'Intentar de nuevo',
    loadError: 'No se pudo cargar el directorio. Ninguna información estimada sustituyó sus datos.', unauthorized: 'Es necesario iniciar sesión para consultar Personas.', forbidden: 'No tiene permiso para consultar Personas.',
    partial: 'Parte del contexto operativo no está disponible con los permisos actuales. Los campos no disponibles se muestran como tales, nunca como cero.',
    noPeople: 'Todavía no hay personas.', noResults: 'Ninguna persona coincide con los filtros actuales.', noGroup: 'Sin grupo', unknown: 'No disponible',
    nextUnavailable: 'Próxima indisponibilidad', noNextUnavailable: 'No hay próxima indisponibilidad registrada', eligibleFor: 'Elegible para', eligibleTypes: 'tipos', noEligibility: 'Sin elegibilidad activa registrada',
    responsibilities: 'Responsabilidades', noResponsibilities: 'Sin responsabilidad activa', lastAssignment: 'Última asignación completada', noAssignmentHistory: 'Sin asignación completada registrada',
    locale: 'Idioma', actions: 'Acciones', edit: 'Editar', contacts: 'Contactos de emergencia', away: 'Ausencias',
    export: 'Exportar', exportFiltered: 'Exportar resultados filtrados', selectForExport: 'Seleccionar personas para exportar', exportSelected: 'Exportar seleccionadas',
    selectedOne: 'persona seleccionada', selectedMany: 'personas seleccionadas', selectAllFiltered: 'Seleccionar resultados', clearSelection: 'Limpiar selección', finishSelection: 'Finalizar',
    selectionHelp: 'La exportación por lotes incluye solo los campos autorizados por sus permisos actuales.', selectPerson: 'Seleccionar persona',
    dialogTitle: 'Nueva persona', editTitle: 'Editar persona', name: 'Nombre', preferredLocale: 'Idioma preferido', enabled: 'Perfil ativo', cancel: 'Cancelar', save: 'Guardar', saving: 'Guardando…',
    formError: 'No se pudo guardar la persona. Inténtelo de nuevo.', success: 'Persona añadida correctamente.', updated: 'Persona actualizada correctamente.', close: 'Cerrar',
    discardTitle: '¿Descartar cambios?', discardDetail: 'Se perderán los cambios no guardados.', keepEditing: 'Seguir editando', discard: 'Descartar',
  },
} as const;

/** Legacy pure helper retained for regression coverage while Directory 2.0 consumes the projection API. */
export function filterPeople(people: readonly PersonProfileDto[], query: string, status: 'all' | 'active' | 'inactive', locale: Locale): readonly PersonProfileDto[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  return people.filter(person => (!needle || person.displayName.toLocaleLowerCase(locale).includes(needle) || person.preferredLocale?.toLocaleLowerCase(locale).includes(needle)) && (status === 'all' || person.active === (status === 'active')));
}

export function canSubmitPerson(displayName: string, saving: boolean): boolean { return !saving && displayName.trim().length > 0; }
export function hasUnsavedPersonDraft(displayName: string, preferredLocale: string, active: boolean, initialLocale: Locale): boolean { return displayName.trim().length > 0 || preferredLocale.trim() !== initialLocale || !active; }
export function hasPersonProfileChanges(person: Pick<PersonProfileDto, 'displayName' | 'preferredLocale' | 'active'>, displayName: string, preferredLocale: string, active: boolean): boolean { return person.displayName !== displayName.trim() || (person.preferredLocale ?? '') !== preferredLocale.trim() || person.active !== active; }

function formatCivilDate(value: string, locale: Locale): string {
  const normalizedLocale = locale === 'en' ? 'en-GB' : locale;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(normalizedLocale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function errorStatus(error: unknown): number | undefined {
  const match = /\((\d{3})\)$/.exec(error instanceof Error ? error.message : '');
  return match ? Number(match[1]) : undefined;
}

function responsibilityLabel(value: string): string { return value.replace(/[-_]+/g, ' ').replace(/^./, first => first.toLocaleUpperCase()); }

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function PeopleDirectory({ locale, createRequest = 0 }: { locale: Locale; createRequest?: number }) {
  const text = copy[locale];
  const { token } = theme.useToken();
  const [directory, setDirectory] = useState<PeopleDirectoryDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<PeopleDirectoryFilters>(() => peopleDirectoryFiltersFromSearch(window.location.search));
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<readonly string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PeopleDirectoryPersonDto | null>(null);
  const [discardOpen, setDiscardOpen] = useState<'create' | 'edit' | null>(null);
  const [contactsPerson, setContactsPerson] = useState<PeopleDirectoryPersonDto | null>(null);
  const [eligibilityPerson, setEligibilityPerson] = useState<PeopleDirectoryPersonDto | null>(null);
  const [awayPerson, setAwayPerson] = useState<PeopleDirectoryPersonDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(false);
  const [notice, setNotice] = useState<'created' | 'updated' | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<string>(locale);
  const [active, setActive] = useState(true);
  const submittingRef = useRef(false);
  const handledCreateRequestRef = useRef(createRequest);
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const syncFilters = (next: PeopleDirectoryFilters) => {
    setFilters(next);
    const search = peopleDirectorySearchWithFilters(window.location.search, next);
    const target = `${window.location.pathname}${search}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target !== current) window.history.replaceState(window.history.state, '', target);
  };

  const load = async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    if (!directory) setLoadState('loading');
    setLoadError(null);
    try {
      const value = await peopleDirectoryApi.get(controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setDirectory(value);
      setLoadState('ready');
      const sanitized = sanitizePeopleDirectoryFilters(peopleDirectoryFiltersFromSearch(window.location.search), value);
      syncFilters(sanitized);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(error);
      setLoadState('error');
    }
  };

  useEffect(() => { void load(); return () => controllerRef.current?.abort(); }, []);
  useEffect(() => { const onPopState = () => setFilters(peopleDirectoryFiltersFromSearch(window.location.search)); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);

  const resetForm = () => { setDisplayName(''); setPreferredLocale(locale); setActive(true); setFormError(false); };
  const openCreate = () => { if (!directory?.capabilities.writePeople) return; resetForm(); setNotice(null); setDiscardOpen(null); setCreateOpen(true); };
  useEffect(() => { if (handledCreateRequestRef.current === createRequest || !directory) return; handledCreateRequestRef.current = createRequest; if (directory.capabilities.writePeople) openCreate(); }, [createRequest, directory, locale]);

  const beginEdit = (person: PeopleDirectoryPersonDto) => { if (!directory?.capabilities.writePeople) return; setEditingPerson(person); setDisplayName(person.displayName); setPreferredLocale(person.preferredLocale ?? ''); setActive(person.active); setFormError(false); setNotice(null); };
  const closeCreate = () => { if (saving) return; if (hasUnsavedPersonDraft(displayName, preferredLocale, active, locale)) { setDiscardOpen('create'); return; } setCreateOpen(false); resetForm(); };
  const closeEdit = () => { if (saving || !editingPerson) return; if (hasPersonProfileChanges(editingPerson, displayName, preferredLocale, active)) { setDiscardOpen('edit'); return; } setEditingPerson(null); resetForm(); };
  const confirmDiscard = () => { if (discardOpen === 'create') setCreateOpen(false); if (discardOpen === 'edit') setEditingPerson(null); setDiscardOpen(null); resetForm(); };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!directory?.capabilities.writePeople || !canSubmitPerson(displayName, saving) || submittingRef.current) return;
    submittingRef.current = true; setSaving(true); setFormError(false);
    try { await peopleApi.create({ displayName: displayName.trim(), preferredLocale: preferredLocale.trim() || undefined, active }); setCreateOpen(false); resetForm(); setNotice('created'); await load(); }
    catch { setFormError(true); }
    finally { submittingRef.current = false; setSaving(false); }
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!directory?.capabilities.writePeople || !editingPerson || !canSubmitPerson(displayName, saving) || submittingRef.current) return;
    submittingRef.current = true; setSaving(true); setFormError(false);
    try { await peopleApi.update(editingPerson.id, { displayName: displayName.trim(), preferredLocale: preferredLocale.trim() || null, active }); setEditingPerson(null); resetForm(); setNotice('updated'); await load(); }
    catch { setFormError(true); }
    finally { submittingRef.current = false; setSaving(false); }
  };

  const effectiveFilters = directory ? sanitizePeopleDirectoryFilters(filters, directory) : DEFAULT_PEOPLE_DIRECTORY_FILTERS;
  const filtered = useMemo(() => directory ? filterPeopleDirectory(directory.people, query, effectiveFilters, locale) : [], [directory, effectiveFilters, locale, query]);
  const selectedPeople = useMemo(() => filtered.filter(person => selectedPersonIds.includes(person.id)), [filtered, selectedPersonIds]);
  const hasFilters = hasPeopleDirectoryFilters(query, effectiveFilters);
  const advancedCount = Number(Boolean(effectiveFilters.eligibilityTypeId)) + Number(Boolean(effectiveFilters.responsibilityKey));
  const clearFilters = () => { setQuery(''); syncFilters(DEFAULT_PEOPLE_DIRECTORY_FILTERS); };
  const updateFilter = <K extends keyof PeopleDirectoryFilters>(key: K, value: PeopleDirectoryFilters[K]) => syncFilters(Object.freeze({ ...effectiveFilters, [key]: value || undefined }));

  useEffect(() => { if (!selectionMode) return; const visibleIds = new Set(filtered.map(person => person.id)); setSelectedPersonIds(current => current.filter(id => visibleIds.has(id))); }, [filtered, selectionMode]);

  const toggleSelection = (personId: string, checked: boolean) => { setSelectedPersonIds(current => checked ? current.includes(personId) ? current : Object.freeze([...current, personId]) : Object.freeze(current.filter(id => id !== personId))); };
  const finishSelection = () => { setSelectionMode(false); setSelectedPersonIds([]); };
  const exportRows = (people: readonly PeopleDirectoryPersonDto[]) => { if (!directory || people.length === 0) return; downloadCsv(exportPeopleDirectoryCsv(people, directory.capabilities, locale), peopleDirectoryExportFilename()); };
  const beginSelection = () => { if (filtered.length === 0) return; setSelectionMode(true); setSelectedPersonIds([]); };

  const availabilityNode = (person: PeopleDirectoryPersonDto) => {
    if (person.availability.status !== 'ready') return <Text type="secondary">{text.unknown}</Text>;
    return <Space direction="vertical" size={2}><Tag color={person.availability.current === 'available' ? 'success' : 'warning'}>{person.availability.current === 'available' ? text.available : text.unavailableNow}</Tag><Text type="secondary" style={{ fontSize: 12 }}>{person.availability.nextPeriod ? `${text.nextUnavailable}: ${formatCivilDate(person.availability.nextPeriod.startsAt, locale)}` : text.noNextUnavailable}</Text></Space>;
  };
  const eligibilityNode = (person: PeopleDirectoryPersonDto) => { if (person.eligibility.status !== 'ready') return <Text type="secondary">{text.unknown}</Text>; if (!person.eligibility.enabledAssignmentTypeIds.length) return <Text type="secondary">{text.noEligibility}</Text>; return <Text>{person.eligibility.enabledAssignmentTypeIds.length} {text.eligibleTypes}</Text>; };
  const responsibilitiesNode = (person: PeopleDirectoryPersonDto) => { if (person.responsibilities.status !== 'ready') return <Text type="secondary">{text.unknown}</Text>; if (!person.responsibilities.keys.length) return <Text type="secondary">{text.noResponsibilities}</Text>; return <Space size={[4, 4]} wrap>{person.responsibilities.keys.slice(0, 3).map(key => <Tag key={key}>{responsibilityLabel(key)}</Tag>)}</Space>; };
  const historyNode = (person: PeopleDirectoryPersonDto) => { if (person.assignmentHistory.status !== 'ready') return <Text type="secondary">{text.unknown}</Text>; return <Text>{person.assignmentHistory.lastCompletedMeetingDate ? formatCivilDate(person.assignmentHistory.lastCompletedMeetingDate, locale) : text.noAssignmentHistory}</Text>; };
  const actionsNode = (person: PeopleDirectoryPersonDto) => <Space size={4} wrap>{directory?.capabilities.writePeople ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => beginEdit(person)}>{text.edit}</Button> : null}<Button type="link" size="small" onClick={() => setAwayPerson(person)}>{text.away}</Button>{directory?.capabilities.eligibility ? <Button type="link" size="small" onClick={() => setEligibilityPerson(person)}>{text.eligibility}</Button> : null}<Button type="link" size="small" onClick={() => setContactsPerson(person)}>{text.contacts}</Button></Space>;

  const columns: ColumnsType<PeopleDirectoryPersonDto> = [
    { title: text.title, key: 'person', width: 230, sorter: (left, right) => left.displayName.localeCompare(right.displayName, locale), render: (_, person) => <Space><Avatar>{person.displayName.slice(0, 1).toLocaleUpperCase(locale)}</Avatar><span><Text strong>{person.displayName}</Text>{person.preferredLocale ? <><br /><Text type="secondary" style={{ fontSize: 12 }}>{text.locale}: {person.preferredLocale}</Text></> : null}</span></Space> },
    { title: text.group, key: 'group', width: 150, render: (_, person) => person.groups.length ? <Space size={[4, 4]} wrap>{person.groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : <Text type="secondary">{text.noGroup}</Text> },
    { title: text.availability, key: 'availability', width: 220, render: (_, person) => availabilityNode(person) },
    { title: text.eligibility, key: 'eligibility', width: 150, render: (_, person) => eligibilityNode(person) },
    { title: text.responsibilities, key: 'responsibilities', width: 190, render: (_, person) => responsibilitiesNode(person) },
    { title: text.lastAssignment, key: 'history', width: 180, render: (_, person) => historyNode(person) },
    { title: text.state, key: 'state', width: 100, render: (_, person) => <Tag color={person.active ? 'success' : 'default'}>{person.active ? text.active : text.inactive}</Tag> },
    { title: text.actions, key: 'actions', fixed: 'right', width: 300, render: (_, person) => actionsNode(person) },
  ];

  const error = errorStatus(loadError);
  const partial = directory && [directory.capabilities.availability, directory.capabilities.eligibility, directory.capabilities.responsibilities, directory.capabilities.schedule].some(value => !value);
  const advancedFilters = directory ? <Space direction="vertical" size="middle" style={{ width: 280 }}><div><Text strong>{text.eligibility}</Text><Select aria-label={text.eligibility} style={{ width: '100%', marginTop: 6 }} value={effectiveFilters.eligibilityTypeId ?? ''} disabled={!directory.capabilities.eligibility} onChange={value => updateFilter('eligibilityTypeId', value || undefined)} options={[{ value: '', label: text.allEligibility }, ...directory.filters.assignmentTypeIds.map(id => ({ value: id, label: assignmentTypeLabel(id, locale) }))]} /></div><div><Text strong>{text.responsibility}</Text><Select aria-label={text.responsibility} style={{ width: '100%', marginTop: 6 }} value={effectiveFilters.responsibilityKey ?? ''} disabled={!directory.capabilities.responsibilities} onChange={value => updateFilter('responsibilityKey', value || undefined)} options={[{ value: '', label: text.allResponsibilities }, ...directory.filters.responsibilityKeys.map(key => ({ value: key, label: responsibilityLabel(key) }))]} /></div></Space> : null;

  return <section aria-labelledby="people-directory-title">
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card styles={{ body: { padding: 24 } }}><Space direction="vertical" size="small" style={{ width: '100%' }}><Text type="secondary" strong>{text.eyebrow}</Text><Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap><div style={{ maxWidth: 760 }}><Title level={2} id="people-directory-title" style={{ margin: 0 }}>{text.title}</Title><Paragraph type="secondary" style={{ margin: '8px 0 0' }}>{text.subtitle}</Paragraph></div><Space wrap>
        {directory ? <><Button icon={<DownloadOutlined />} onClick={() => exportRows(filtered)} disabled={filtered.length === 0}>{text.export}</Button><Button icon={<CheckSquareOutlined />} onClick={beginSelection} disabled={filtered.length === 0 || selectionMode}>{text.selectForExport}</Button></> : null}
        {directory?.capabilities.writePeople ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{text.add}</Button> : null}
      </Space></Space></Space></Card>

      {notice ? <Alert type="success" showIcon closable onClose={() => setNotice(null)} message={notice === 'created' ? text.success : text.updated} /> : null}
      {partial ? <Alert type="info" showIcon message={text.partial} /> : null}
      {loadState === 'error' ? <Alert type="error" showIcon message={error === 401 ? text.unauthorized : error === 403 ? text.forbidden : text.loadError} action={error !== 401 && error !== 403 ? <Button size="small" onClick={() => void load()}>{text.retry}</Button> : undefined} /> : null}

      <Card><div className="people-directory-filter-grid"><Input allowClear prefix={<SearchOutlined />} value={query} onChange={event => setQuery(event.target.value)} placeholder={text.search} aria-label={text.search} /><Select aria-label={text.group} value={effectiveFilters.groupId ?? ''} onChange={value => updateFilter('groupId', value || undefined)} showSearch optionFilterProp="label" options={[{ value: '', label: text.allGroups }, ...(directory?.filters.groups ?? []).map(group => ({ value: group.id, label: group.name }))]} /><Select aria-label={text.availability} value={effectiveFilters.availability} disabled={directory ? !directory.capabilities.availability : false} onChange={value => updateFilter('availability', value)} options={[{ value: 'all', label: text.all }, { value: 'available', label: text.available }, { value: 'unavailable', label: text.unavailableNow }]} /><Select aria-label={text.state} value={effectiveFilters.status} onChange={value => updateFilter('status', value)} options={[{ value: 'all', label: text.all }, { value: 'active', label: text.active }, { value: 'inactive', label: text.inactive }]} /><Popover trigger="click" placement="bottomRight" content={advancedFilters} title={text.more}><Button icon={<FilterOutlined />}>{advancedCount ? `${text.more} (${advancedCount})` : text.more}</Button></Popover></div>{hasFilters ? <div style={{ marginTop: 12 }}><Button type="link" onClick={clearFilters} style={{ paddingInline: 0 }}>{text.clear}</Button></div> : null}</Card>

      {selectionMode && directory ? <Alert type="info" showIcon message={`${selectedPeople.length} ${selectedPeople.length === 1 ? text.selectedOne : text.selectedMany}`} description={text.selectionHelp} action={<Space wrap><Button size="small" onClick={() => setSelectedPersonIds(Object.freeze(filtered.map(person => person.id)))} disabled={filtered.length === 0}>{text.selectAllFiltered}</Button><Button size="small" onClick={() => setSelectedPersonIds([])} disabled={selectedPeople.length === 0}>{text.clearSelection}</Button><Button size="small" type="primary" icon={<DownloadOutlined />} onClick={() => exportRows(selectedPeople)} disabled={selectedPeople.length === 0}>{text.exportSelected}</Button><Button size="small" onClick={finishSelection}>{text.finishSelection}</Button></Space>} /> : null}

      {loadState === 'loading' && !directory ? <Card><Skeleton active paragraph={{ rows: 6 }} /></Card> : null}
      {directory ? <><Text type="secondary" aria-live="polite">{filtered.length} {filtered.length === 1 ? text.result : text.results}</Text>{directory.people.length === 0 ? <Card><Empty description={text.noPeople} /></Card> : filtered.length === 0 ? <Card><Empty description={text.noResults}><Button onClick={clearFilters}>{text.clear}</Button></Empty></Card> : <><div className="people-directory-desktop"><Card styles={{ body: { padding: 0 } }}><Table rowKey="id" columns={columns} dataSource={[...filtered]} rowSelection={selectionMode ? { selectedRowKeys: [...selectedPersonIds], onChange: keys => setSelectedPersonIds(Object.freeze(keys.map(key => String(key)))) } : undefined} pagination={{ pageSize: 25, showSizeChanger: true }} scroll={{ x: 1500 }} /></Card></div><div className="people-directory-mobile"><Space direction="vertical" size="middle" style={{ width: '100%' }}>{filtered.map(person => <Card key={person.id}><Space direction="vertical" size="middle" style={{ width: '100%' }}><Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}><Space align="start">{selectionMode ? <Checkbox checked={selectedPersonIds.includes(person.id)} onChange={event => toggleSelection(person.id, event.target.checked)} aria-label={`${text.selectPerson}: ${person.displayName}`} /> : null}<Avatar size="large">{person.displayName.slice(0, 1).toLocaleUpperCase(locale)}</Avatar><span><Text strong style={{ fontSize: 16 }}>{person.displayName}</Text>{person.preferredLocale ? <><br /><Text type="secondary">{text.locale}: {person.preferredLocale}</Text></> : null}</span></Space><Tag color={person.active ? 'success' : 'default'}>{person.active ? text.active : text.inactive}</Tag></Space><div className="people-directory-card-meta"><div><Text type="secondary">{text.group}</Text><div>{person.groups.length ? <Space size={[4, 4]} wrap>{person.groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : <Text>{text.noGroup}</Text>}</div></div><div><Text type="secondary">{text.availability}</Text><div>{availabilityNode(person)}</div></div><div><Text type="secondary">{text.eligibility}</Text><div>{eligibilityNode(person)}</div></div><div><Text type="secondary">{text.responsibilities}</Text><div>{responsibilitiesNode(person)}</div></div><div><Text type="secondary">{text.lastAssignment}</Text><div>{historyNode(person)}</div></div></div><div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 10 }}>{actionsNode(person)}</div></Space></Card>)}</Space></div></> }</> : null}
    </Space>

    <Modal open={createOpen} title={text.dialogTitle} onCancel={closeCreate} footer={null} destroyOnHidden><form onSubmit={submitCreate}><Space direction="vertical" size="middle" style={{ width: '100%' }}><label><Text strong>{text.name}</Text><Input autoFocus maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} status={formError ? 'error' : undefined} /></label><label><Text strong>{text.preferredLocale}</Text><Input maxLength={35} value={preferredLocale} onChange={event => setPreferredLocale(event.target.value)} /></label><Space><Switch checked={active} onChange={setActive} /><Text>{text.enabled}</Text></Space>{formError ? <Alert type="error" showIcon message={text.formError} /> : null}<Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={closeCreate} disabled={saving}>{text.cancel}</Button><Button htmlType="submit" type="primary" loading={saving} disabled={!directory?.capabilities.writePeople || !canSubmitPerson(displayName, saving)}>{saving ? text.saving : text.save}</Button></Space></Space></form></Modal>

    <Modal open={editingPerson !== null} title={text.editTitle} onCancel={closeEdit} footer={null} destroyOnHidden><form onSubmit={submitEdit}><Space direction="vertical" size="middle" style={{ width: '100%' }}><label><Text strong>{text.name}</Text><Input autoFocus maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} status={formError ? 'error' : undefined} /></label><label><Text strong>{text.preferredLocale}</Text><Input maxLength={35} value={preferredLocale} onChange={event => setPreferredLocale(event.target.value)} /></label><Space><Switch checked={active} onChange={setActive} /><Text>{text.enabled}</Text></Space>{formError ? <Alert type="error" showIcon message={text.formError} /> : null}<Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button onClick={closeEdit} disabled={saving}>{text.cancel}</Button><Button htmlType="submit" type="primary" loading={saving} disabled={!directory?.capabilities.writePeople || !editingPerson || !canSubmitPerson(displayName, saving) || !hasPersonProfileChanges(editingPerson, displayName, preferredLocale, active)}>{saving ? text.saving : text.save}</Button></Space></Space></form></Modal>

    <Modal open={discardOpen !== null} title={text.discardTitle} onCancel={() => setDiscardOpen(null)} onOk={confirmDiscard} okText={text.discard} cancelText={text.keepEditing} okButtonProps={{ danger: true }}>{text.discardDetail}</Modal>
    {contactsPerson ? <EmergencyContactsDialog personId={contactsPerson.id} personName={contactsPerson.displayName} locale={locale} open onClose={() => setContactsPerson(null)} /> : null}
    {eligibilityPerson ? <EligibilityDialog personId={eligibilityPerson.id} personName={eligibilityPerson.displayName} locale={locale} open onClose={() => { setEligibilityPerson(null); void load(); }} /> : null}
    <Modal open={awayPerson !== null} title={awayPerson ? `${text.away} — ${awayPerson.displayName}` : text.away} onCancel={() => { setAwayPerson(null); void load(); }} footer={<Button onClick={() => { setAwayPerson(null); void load(); }}>{text.close}</Button>} width={760} destroyOnHidden>{awayPerson ? <AwayPeriodsSection locale={locale} personId={awayPerson.id} /> : null}</Modal>
  </section>;
}
