import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { EmergencyContactsDialog } from './EmergencyContactsDialog';
import { EligibilityDialog } from './EligibilityDialog';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': {
    eyebrow: 'Diretório seguro', title: 'Pessoas', subtitle: 'Perfis operacionais mínimos, carregados pelo boundary seguro de People.',
    search: 'Procurar pessoa', add: 'Adicionar pessoa', active: 'Ativo', inactive: 'Inativo', locale: 'Idioma', empty: 'Nenhuma pessoa encontrada.',
    loading: 'A carregar diretório…', retry: 'Tentar novamente', unavailable: 'Não foi possível carregar o diretório.', contacts: 'Contactos de emergência', eligibility: 'Elegibilidade',
    dialogTitle: 'Nova pessoa', name: 'Nome', preferredLocale: 'Idioma preferido', enabled: 'Perfil ativo', cancel: 'Cancelar', save: 'Guardar', saving: 'A guardar…',
  },
  en: {
    eyebrow: 'Secure directory', title: 'People', subtitle: 'Minimal operational profiles loaded through the secure People boundary.',
    search: 'Search people', add: 'Add person', active: 'Active', inactive: 'Inactive', locale: 'Language', empty: 'No people found.',
    loading: 'Loading directory…', retry: 'Try again', unavailable: 'The directory could not be loaded.', contacts: 'Emergency contacts', eligibility: 'Eligibility',
    dialogTitle: 'New person', name: 'Name', preferredLocale: 'Preferred language', enabled: 'Active profile', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
  },
  es: {
    eyebrow: 'Directorio seguro', title: 'Personas', subtitle: 'Perfiles operativos mínimos cargados mediante el boundary seguro de People.',
    search: 'Buscar persona', add: 'Añadir persona', active: 'Activo', inactive: 'Inactivo', locale: 'Idioma', empty: 'No se encontraron personas.',
    loading: 'Cargando directorio…', retry: 'Intentar de nuevo', unavailable: 'No se pudo cargar el directorio.', contacts: 'Contactos de emergencia', eligibility: 'Elegibilidad',
    dialogTitle: 'Nueva persona', name: 'Nombre', preferredLocale: 'Idioma preferido', enabled: 'Perfil activo', cancel: 'Cancelar', save: 'Guardar', saving: 'Guardando…',
  },
} as const;

export function PeopleDirectory({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [contactsPerson, setContactsPerson] = useState<PersonProfileDto | null>(null);
  const [eligibilityPerson, setEligibilityPerson] = useState<PersonProfileDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [preferredLocale, setPreferredLocale] = useState<string>(locale);
  const [active, setActive] = useState(true);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setPeople(await peopleApi.list(signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
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
    return people.filter(person =>
      person.displayName.toLocaleLowerCase(locale).includes(needle) ||
      person.preferredLocale?.toLocaleLowerCase(locale).includes(needle),
    );
  }, [locale, people, query]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const person = await peopleApi.create({
        displayName: name,
        preferredLocale: preferredLocale.trim() || undefined,
        active,
      });
      setPeople(current => [...current, person].sort((a, b) => a.displayName.localeCompare(b.displayName, locale)));
      setOpen(false);
      setDisplayName('');
      setPreferredLocale(locale);
      setActive(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="section" aria-labelledby="people-directory-title">
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-end' }}>
          <Box>
            <Typography variant="overline" color="text.secondary" fontWeight={800}>{text.eyebrow}</Typography>
            <Typography variant="h2" id="people-directory-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{text.subtitle}</Typography>
          </Box>
          <Button variant="contained" onClick={() => setOpen(true)}>{text.add}</Button>
        </Stack>
      </Paper>

      <Stack spacing={2}>
        <TextField
          label={text.search}
          value={query}
          onChange={event => setQuery(event.target.value)}
          type="search"
          fullWidth
          slotProps={{ htmlInput: { autoComplete: 'off' } }}
        />

        {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>}>{error}</Alert> : null}

        {loading ? (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 6 }} role="status">
            <CircularProgress size={24} /><Typography color="text.secondary">{text.loading}</Typography>
          </Stack>
        ) : filtered.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">{text.empty}</Typography></Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
            {filtered.map(person => (
              <Card component="article" key={person.id}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                      <Box>
                        <Typography variant="h5" fontWeight={750}>{person.displayName}</Typography>
                        {person.preferredLocale ? <Typography variant="body2" color="text.secondary">{text.locale}: {person.preferredLocale}</Typography> : null}
                      </Box>
                      <Chip label={person.active ? text.active : text.inactive} size="small" variant="outlined" color={person.active ? 'primary' : 'default'} />
                    </Stack>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="text" onClick={() => setContactsPerson(person)}>
                        {text.contacts}
                      </Button>
                      <Button size="small" variant="text" onClick={() => setEligibilityPerson(person)}>
                        {text.eligibility}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Stack>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submit}>
          <DialogTitle>{text.dialogTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label={text.name} value={displayName} onChange={event => setDisplayName(event.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 120 } }} />
              <TextField label={text.preferredLocale} value={preferredLocale} onChange={event => setPreferredLocale(event.target.value)} slotProps={{ htmlInput: { maxLength: 35 } }} />
              <FormControlLabel control={<Switch checked={active} onChange={event => setActive(event.target.checked)} />} label={text.enabled} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={saving}>{text.cancel}</Button>
            <Button type="submit" variant="contained" disabled={saving || !displayName.trim()}>{saving ? text.saving : text.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {contactsPerson ? (
        <EmergencyContactsDialog
          personId={contactsPerson.id}
          personName={contactsPerson.displayName}
          locale={locale}
          open
          onClose={() => setContactsPerson(null)}
        />
      ) : null}

      {eligibilityPerson ? (
        <EligibilityDialog
          personId={eligibilityPerson.id}
          personName={eligibilityPerson.displayName}
          locale={locale}
          open
          onClose={() => setEligibilityPerson(null)}
        />
      ) : null}
    </Box>
  );
}
