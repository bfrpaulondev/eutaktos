import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Paper, Switch, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { EligibilityDialog } from './EligibilityDialog';
import { CongregationSettingsDialog } from './CongregationSettingsDialog';
import { AwayPeriodsSection } from './AwayPeriodsSection';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { eyebrow: 'Organização', title: 'Pessoas', subtitle: 'Perfis, contactos, elegibilidade e disponibilidade reunidos num único local.', search: 'Procurar pessoa', add: 'Adicionar pessoa', active: 'Ativo', inactive: 'Inativo', locale: 'Idioma', empty: 'Ainda não existem pessoas para mostrar.', loading: 'A carregar pessoas…', retry: 'Tentar novamente', unavailable: 'Não foi possível carregar as pessoas. Tenta novamente.', contacts: 'Contactos de emergência', eligibility: 'Elegibilidade', away: 'Ausências', congregation: 'Configurações da congregação', dialogTitle: 'Nova pessoa', name: 'Nome', preferredLocale: 'Idioma preferido', enabled: 'Perfil ativo', cancel: 'Cancelar', save: 'Guardar', saving: 'A guardar…', actions: 'Ações da pessoa' },
  en: { eyebrow: 'Organization', title: 'People', subtitle: 'Profiles, contacts, eligibility and availability together in one place.', search: 'Search people', add: 'Add person', active: 'Active', inactive: 'Inactive', locale: 'Language', empty: 'There are no people to show yet.', loading: 'Loading people…', retry: 'Try again', unavailable: 'People could not be loaded. Please try again.', contacts: 'Emergency contacts', eligibility: 'Eligibility', away: 'Away periods', congregation: 'Congregation settings', dialogTitle: 'New person', name: 'Name', preferredLocale: 'Preferred language', enabled: 'Active profile', cancel: 'Cancel', save: 'Save', saving: 'Saving…', actions: 'Person actions' },
  es: { eyebrow: 'Organización', title: 'Personas', subtitle: 'Perfiles, contactos, elegibilidad y disponibilidad reunidos en un solo lugar.', search: 'Buscar persona', add: 'Añadir persona', active: 'Activo', inactive: 'Inactivo', locale: 'Idioma', empty: 'Todavía no hay personas para mostrar.', loading: 'Cargando personas…', retry: 'Intentar de nuevo', unavailable: 'No se pudieron cargar las personas. Inténtalo de nuevo.', contacts: 'Contactos de emergencia', eligibility: 'Elegibilidad', away: 'Ausencias', congregation: 'Configuración de la congregación', dialogTitle: 'Nueva persona', name: 'Nombre', preferredLocale: 'Idioma preferido', enabled: 'Perfil activo', cancel: 'Cancelar', save: 'Guardar', saving: 'Guardando…', actions: 'Acciones de la persona' },
} as const;

export function PeopleDirectory({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsPerson, setContactsPerson] = useState<PersonProfileDto | null>(null);
  const [eligibilityPerson, setEligibilityPerson] = useState<PersonProfileDto | null>(null);
  const [awayPerson, setAwayPerson] = useState<PersonProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<string>(locale);
  const [active, setActive] = useState(true);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      setPeople(await peopleApi.list(signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return people;
    return people.filter(person => person.displayName.toLocaleLowerCase(locale).includes(needle) || person.preferredLocale?.toLocaleLowerCase(locale).includes(needle));
  }, [locale, people, query]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    setError(false);
    try {
      const person = await peopleApi.create({ displayName: name, preferredLocale: preferredLocale.trim() || undefined, active });
      setPeople(current => [...current, person].sort((first, second) => first.displayName.localeCompare(second.displayName, locale)));
      setOpen(false);
      setDisplayName('');
      setPreferredLocale(locale);
      setActive(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return <Box component="section" aria-labelledby="people-directory-title">
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2.5} alignItems={{ md: 'flex-end' }}>
        <Box sx={{ maxWidth: 720 }}><Typography variant="overline" color="primary.main">{text.eyebrow}</Typography><Typography variant="h2" id="people-directory-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.subtitle}</Typography></Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}><Button variant="outlined" onClick={() => setSettingsOpen(true)}>{text.congregation}</Button><Button variant="contained" onClick={() => setOpen(true)}>{text.add}</Button></Stack>
      </Stack>
    </Paper>
    <Stack spacing={2}>
      <TextField label={text.search} value={query} onChange={event => setQuery(event.target.value)} type="search" fullWidth slotProps={{ htmlInput: { autoComplete: 'off' } }} />
      {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
      {loading ? <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 7 }} role="status"><CircularProgress size={24} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : null}
      {!loading && !error && filtered.length === 0 ? <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : null}
      {!loading && !error && filtered.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>{filtered.map(person => <Card component="article" key={person.id}><CardContent><Stack spacing={1.75}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}><Stack direction="row" spacing={1.25} alignItems="center"><Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 800 }}>{person.displayName.slice(0, 1).toLocaleUpperCase(locale)}</Avatar><Box><Typography variant="h5" fontWeight={750}>{person.displayName}</Typography>{person.preferredLocale ? <Typography variant="body2" color="text.secondary">{text.locale}: {person.preferredLocale}</Typography> : null}</Box></Stack><Chip label={person.active ? text.active : text.inactive} size="small" variant="outlined" color={person.active ? 'success' : 'default'} /></Stack>
        <Divider />
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap aria-label={text.actions}><Button size="small" variant="text" onClick={() => setContactsPerson(person)}>{text.contacts}</Button><Button size="small" variant="text" onClick={() => setEligibilityPerson(person)}>{text.eligibility}</Button><Button size="small" variant="text" onClick={() => setAwayPerson(person)}>{text.away}</Button></Stack>
      </Stack></CardContent></Card>)}</Box> : null}
    </Stack>
    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm"><Box component="form" onSubmit={submit}><DialogTitle>{text.dialogTitle}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={text.name} value={displayName} onChange={event => setDisplayName(event.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 120 } }} /><TextField label={text.preferredLocale} value={preferredLocale} onChange={event => setPreferredLocale(event.target.value)} slotProps={{ htmlInput: { maxLength: 35 } }} /><FormControlLabel control={<Switch checked={active} onChange={event => setActive(event.target.checked)} />} label={text.enabled} /></Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={saving || !displayName.trim()}>{saving ? text.saving : text.save}</Button></DialogActions></Box></Dialog>
    {contactsPerson ? <EmergencyContactsDialog personId={contactsPerson.id} personName={contactsPerson.displayName} locale={locale} open onClose={() => setContactsPerson(null)} /> : null}
    {eligibilityPerson ? <EligibilityDialog personId={eligibilityPerson.id} personName={eligibilityPerson.displayName} locale={locale} open onClose={() => setEligibilityPerson(null)} /> : null}
    <Dialog open={awayPerson !== null} onClose={() => setAwayPerson(null)} fullWidth maxWidth="md"><DialogTitle>{awayPerson ? `${text.away} — ${awayPerson.displayName}` : text.away}</DialogTitle><DialogContent>{awayPerson ? <AwayPeriodsSection locale={locale} personId={awayPerson.id} /> : null}</DialogContent><DialogActions><Button onClick={() => setAwayPerson(null)}>{text.cancel}</Button></DialogActions></Dialog>
    <CongregationSettingsDialog locale={locale} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </Box>;
}
