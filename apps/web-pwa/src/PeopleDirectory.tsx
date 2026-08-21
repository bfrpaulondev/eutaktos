import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Switch, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { EligibilityDialog } from './EligibilityDialog';
import { CongregationSettingsDialog } from './CongregationSettingsDialog';
import { AwayPeriodsSection } from './AwayPeriodsSection';
import { Stack, Typography } from './ui/MuiCompat';

type PersonStatusFilter = 'all' | 'active' | 'inactive';

const copy = {
  'pt-PT': { eyebrow: 'Organização', title: 'Pessoas', subtitle: 'Perfis, contactos, elegibilidade e disponibilidade reunidos num único local.', search: 'Procurar por nome ou idioma', add: 'Adicionar pessoa', filter: 'Estado do perfil', all: 'Todas as pessoas', active: 'Ativo', inactive: 'Inativo', results: 'resultados', result: 'resultado', clear: 'Limpar filtros', locale: 'Idioma', empty: 'Ainda não existem pessoas para mostrar.', noResults: 'Nenhuma pessoa corresponde aos filtros atuais.', loading: 'A carregar pessoas…', retry: 'Tentar novamente', unavailable: 'Não foi possível carregar as pessoas. Tenta novamente.', contacts: 'Contactos de emergência', eligibility: 'Elegibilidade', away: 'Ausências', congregation: 'Configurações da congregação', dialogTitle: 'Nova pessoa', name: 'Nome', preferredLocale: 'Idioma preferido', enabled: 'Perfil ativo', cancel: 'Cancelar', save: 'Guardar', saving: 'A guardar…', actions: 'Ações da pessoa', formError: 'Não foi possível guardar a pessoa. Tenta novamente.', success: 'Pessoa adicionada com sucesso.', close: 'Fechar' },
  en: { eyebrow: 'Organization', title: 'People', subtitle: 'Profiles, contacts, eligibility and availability together in one place.', search: 'Search by name or language', add: 'Add person', filter: 'Profile status', all: 'All people', active: 'Active', inactive: 'Inactive', results: 'results', result: 'result', clear: 'Clear filters', locale: 'Language', empty: 'There are no people to show yet.', noResults: 'No people match the current filters.', loading: 'Loading people…', retry: 'Try again', unavailable: 'People could not be loaded. Please try again.', contacts: 'Emergency contacts', eligibility: 'Eligibility', away: 'Away periods', congregation: 'Congregation settings', dialogTitle: 'New person', name: 'Name', preferredLocale: 'Preferred language', enabled: 'Active profile', cancel: 'Cancel', save: 'Save', saving: 'Saving…', actions: 'Person actions', formError: 'The person could not be saved. Please try again.', success: 'Person added successfully.', close: 'Close' },
  es: { eyebrow: 'Organización', title: 'Personas', subtitle: 'Perfiles, contactos, elegibilidad y disponibilidad reunidos en un solo lugar.', search: 'Buscar por nombre o idioma', add: 'Añadir persona', filter: 'Estado del perfil', all: 'Todas las personas', active: 'Activo', inactive: 'Inactivo', results: 'resultados', result: 'resultado', clear: 'Limpiar filtros', locale: 'Idioma', empty: 'Todavía no hay personas para mostrar.', noResults: 'Ninguna persona coincide con los filtros actuales.', loading: 'Cargando personas…', retry: 'Intentar de nuevo', unavailable: 'No se pudieron cargar las personas. Inténtalo de nuevo.', contacts: 'Contactos de emergencia', eligibility: 'Elegibilidad', away: 'Ausencias', congregation: 'Configuración de la congregación', dialogTitle: 'Nueva persona', name: 'Nombre', preferredLocale: 'Idioma preferido', enabled: 'Perfil activo', cancel: 'Cancelar', save: 'Guardar', saving: 'Guardando…', actions: 'Acciones de la persona', formError: 'No se pudo guardar la persona. Inténtalo de nuevo.', success: 'Persona añadida correctamente.', close: 'Cerrar' },
} as const;

export function filterPeople(people: readonly PersonProfileDto[], query: string, status: PersonStatusFilter, locale: Locale): readonly PersonProfileDto[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  return people.filter(person => {
    const matchesQuery = !needle || person.displayName.toLocaleLowerCase(locale).includes(needle) || person.preferredLocale?.toLocaleLowerCase(locale).includes(needle);
    const matchesStatus = status === 'all' || (status === 'active' ? person.active : !person.active);
    return Boolean(matchesQuery && matchesStatus);
  });
}

export function canSubmitPerson(displayName: string, saving: boolean): boolean {
  return !saving && displayName.trim().length > 0;
}

export function PeopleDirectory({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PersonStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState(false);
  const [created, setCreated] = useState(false);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsPerson, setContactsPerson] = useState<PersonProfileDto | null>(null);
  const [eligibilityPerson, setEligibilityPerson] = useState<PersonProfileDto | null>(null);
  const [awayPerson, setAwayPerson] = useState<PersonProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<string>(locale);
  const [active, setActive] = useState(true);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastDialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);

  const restoreFocus = (target: React.RefObject<HTMLButtonElement | null>) => window.requestAnimationFrame(() => target.current?.focus());
  const closeCreate = () => {
    if (saving) return;
    setOpen(false);
    setFormError(false);
    restoreFocus(addButtonRef);
  };
  const closePersonDialog = (setter: (value: null) => void) => {
    setter(null);
    window.requestAnimationFrame(() => lastDialogTriggerRef.current?.focus());
  };

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setPeople(await peopleApi.list(signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => filterPeople(people, query, statusFilter, locale), [locale, people, query, statusFilter]);
  const hasFilters = Boolean(query.trim()) || statusFilter !== 'all';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitPerson(displayName, saving) || submittingRef.current) return;
    submittingRef.current = true;
    const name = displayName.trim();
    setSaving(true);
    setFormError(false);
    setCreated(false);
    try {
      const person = await peopleApi.create({ displayName: name, preferredLocale: preferredLocale.trim() || undefined, active });
      setPeople(current => [...current, person].sort((first, second) => first.displayName.localeCompare(second.displayName, locale)));
      setOpen(false);
      setDisplayName('');
      setPreferredLocale(locale);
      setActive(true);
      setCreated(true);
      restoreFocus(addButtonRef);
    } catch {
      setFormError(true);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };
  const openPersonDialog = (person: PersonProfileDto, trigger: HTMLButtonElement, setter: (value: PersonProfileDto) => void) => {
    lastDialogTriggerRef.current = trigger;
    setter(person);
  };

  return <Box component="section" aria-labelledby="people-directory-title">
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2.5} alignItems={{ md: 'flex-end' }}>
        <Box sx={{ maxWidth: 720 }}><Typography variant="overline" color="primary.main">{text.eyebrow}</Typography><Typography variant="h2" id="people-directory-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.subtitle}</Typography></Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}><Button ref={settingsButtonRef} variant="outlined" onClick={() => setSettingsOpen(true)}>{text.congregation}</Button><Button ref={addButtonRef} variant="contained" onClick={() => { setCreated(false); setOpen(true); }}>{text.add}</Button></Stack>
      </Stack>
    </Paper>
    <Stack spacing={2}>
      <Paper component="form" onSubmit={event => event.preventDefault()} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: 2.5, boxShadow: 'none', bgcolor: 'transparent' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
          <TextField label={text.search} value={query} onChange={event => setQuery(event.target.value)} type="search" fullWidth slotProps={{ htmlInput: { autoComplete: 'off' } }} />
          <FormControl fullWidth sx={{ maxWidth: { sm: 230 }, flexShrink: 0 }}><InputLabel id="people-status-filter-label">{text.filter}</InputLabel><Select labelId="people-status-filter-label" label={text.filter} value={statusFilter} onChange={event => setStatusFilter(event.target.value as PersonStatusFilter)}><MenuItem value="all">{text.all}</MenuItem><MenuItem value="active">{text.active}</MenuItem><MenuItem value="inactive">{text.inactive}</MenuItem></Select></FormControl>
          {hasFilters ? <Button variant="text" onClick={clearFilters} sx={{ flexShrink: 0 }}>{text.clear}</Button> : null}
        </Stack>
      </Paper>
      {created ? <Alert severity="success" onClose={() => setCreated(false)}>{text.success}</Alert> : null}
      {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
      <Box aria-live="polite" aria-atomic="true" sx={{ minHeight: { xs: 32, sm: 28 } }}>{!loading && !loadError ? <Typography variant="body2" color="text.secondary">{filtered.length} {filtered.length === 1 ? text.result : text.results}</Typography> : null}</Box>
      <Box sx={{ minHeight: { xs: 280, sm: 320 } }}>
        {loading ? <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 7 }} role="status"><CircularProgress size={24} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : null}
        {!loading && !loadError && filtered.length === 0 ? <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={1.5} alignItems="center"><Typography color="text.secondary">{hasFilters ? text.noResults : text.empty}</Typography>{hasFilters ? <Button variant="outlined" onClick={clearFilters}>{text.clear}</Button> : null}</Stack></Paper> : null}
        {!loading && !loadError && filtered.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>{filtered.map(person => <Card component="article" key={person.id}><CardContent><Stack spacing={1.75}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}><Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}><Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 800, flexShrink: 0 }}>{person.displayName.slice(0, 1).toLocaleUpperCase(locale)}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="h5" fontWeight={750} noWrap title={person.displayName}>{person.displayName}</Typography>{person.preferredLocale ? <Typography variant="body2" color="text.secondary" noWrap>{text.locale}: {person.preferredLocale}</Typography> : null}</Box></Stack><Chip label={person.active ? text.active : text.inactive} size="small" variant="outlined" color={person.active ? 'success' : 'default'} /></Stack>
          <Divider />
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap aria-label={`${text.actions} — ${person.displayName}`}><Button size="small" variant="text" onClick={event => openPersonDialog(person, event.currentTarget, setContactsPerson)} aria-label={`${text.contacts} — ${person.displayName}`}>{text.contacts}</Button><Button size="small" variant="text" onClick={event => openPersonDialog(person, event.currentTarget, setEligibilityPerson)} aria-label={`${text.eligibility} — ${person.displayName}`}>{text.eligibility}</Button><Button size="small" variant="text" onClick={event => openPersonDialog(person, event.currentTarget, setAwayPerson)} aria-label={`${text.away} — ${person.displayName}`}>{text.away}</Button></Stack>
        </Stack></CardContent></Card>)}</Box> : null}
      </Box>
    </Stack>
    <Dialog open={open} onClose={closeCreate} fullWidth maxWidth="sm" aria-describedby="person-create-error"><Box component="form" onSubmit={submit}><DialogTitle>{text.dialogTitle}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={text.name} value={displayName} onChange={event => setDisplayName(event.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 120 } }} /><TextField label={text.preferredLocale} value={preferredLocale} onChange={event => setPreferredLocale(event.target.value)} slotProps={{ htmlInput: { maxLength: 35 } }} /><FormControlLabel control={<Switch checked={active} onChange={event => setActive(event.target.checked)} />} label={text.enabled} />{formError ? <Alert id="person-create-error" severity="error">{text.formError}</Alert> : null}</Stack></DialogContent><DialogActions><Button onClick={closeCreate} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={!canSubmitPerson(displayName, saving)}>{saving ? text.saving : text.save}</Button></DialogActions></Box></Dialog>
    {contactsPerson ? <EmergencyContactsDialog personId={contactsPerson.id} personName={contactsPerson.displayName} locale={locale} open onClose={() => closePersonDialog(setContactsPerson)} /> : null}
    {eligibilityPerson ? <EligibilityDialog personId={eligibilityPerson.id} personName={eligibilityPerson.displayName} locale={locale} open onClose={() => closePersonDialog(setEligibilityPerson)} /> : null}
    <Dialog open={awayPerson !== null} onClose={() => closePersonDialog(setAwayPerson)} fullWidth maxWidth="md"><DialogTitle>{awayPerson ? `${text.away} — ${awayPerson.displayName}` : text.away}</DialogTitle><DialogContent>{awayPerson ? <AwayPeriodsSection locale={locale} personId={awayPerson.id} /> : null}</DialogContent><DialogActions><Button onClick={() => closePersonDialog(setAwayPerson)}>{text.close}</Button></DialogActions></Dialog>
    <CongregationSettingsDialog locale={locale} open={settingsOpen} onClose={() => { setSettingsOpen(false); restoreFocus(settingsButtonRef); }} />
  </Box>;
}
