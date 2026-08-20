import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import {
  ACCESS_CAPABILITIES,
  accessGrantApi,
  type AccessGrantDto,
  type Capability,
} from './lib/accessGrantApi';
import { Stack, Typography } from './ui/MuiCompat';

const SENSITIVE = new Set<Capability>([
  'eligibility.write',
  'emergency-contacts.read',
  'emergency-contacts.write',
  'delegations.read',
  'delegations.write',
  'review.read',
  'review.write',
  'audit.read',
  'access.manage',
]);

const copy = {
  'pt-PT': {
    title: 'Gestão de acessos', subtitle: 'Concede capabilities explícitas. Nenhuma função ou qualificação é inferida automaticamente.',
    person: 'Pessoa', searchPerson: 'Procurar pessoa', capability: 'Capability', grant: 'Conceder acesso', granting: 'A conceder…',
    active: 'Ativo', revoked: 'Revogado', sensitive: 'Sensível', revoke: 'Revogar', revoking: 'A revogar…',
    choosePerson: 'Seleciona uma pessoa para consultar os acessos.', noGrants: 'Nenhum acesso explícito registado para esta pessoa.',
    directoryLoading: 'A carregar pessoas…', grantsLoading: 'A carregar acessos…', retry: 'Tentar novamente', close: 'Fechar',
    unavailable: 'Não foi possível carregar a gestão de acessos.', directoryHint: 'A listagem de pessoas exige people.read separadamente de access.manage.',
  },
  en: {
    title: 'Access management', subtitle: 'Grant explicit capabilities. No role or qualification is inferred automatically.',
    person: 'Person', searchPerson: 'Search people', capability: 'Capability', grant: 'Grant access', granting: 'Granting…',
    active: 'Active', revoked: 'Revoked', sensitive: 'Sensitive', revoke: 'Revoke', revoking: 'Revoking…',
    choosePerson: 'Select a person to inspect access.', noGrants: 'No explicit access is recorded for this person.',
    directoryLoading: 'Loading people…', grantsLoading: 'Loading access…', retry: 'Try again', close: 'Close',
    unavailable: 'Access management could not be loaded.', directoryHint: 'Listing people requires people.read separately from access.manage.',
  },
  es: {
    title: 'Gestión de accesos', subtitle: 'Concede capabilities explícitas. No se infiere automáticamente ningún rol ni cualificación.',
    person: 'Persona', searchPerson: 'Buscar personas', capability: 'Capability', grant: 'Conceder acceso', granting: 'Concediendo…',
    active: 'Activo', revoked: 'Revocado', sensitive: 'Sensible', revoke: 'Revocar', revoking: 'Revocando…',
    choosePerson: 'Selecciona una persona para consultar los accesos.', noGrants: 'No hay acceso explícito registrado para esta persona.',
    directoryLoading: 'Cargando personas…', grantsLoading: 'Cargando accesos…', retry: 'Intentar de nuevo', close: 'Cerrar',
    unavailable: 'No se pudo cargar la gestión de accesos.', directoryHint: 'Listar personas requiere people.read por separado de access.manage.',
  },
} as const;

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AccessManagementDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [personId, setPersonId] = useState('');
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState<Capability>('people.read');
  const [grants, setGrants] = useState<readonly AccessGrantDto[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return people;
    return people.filter(person => person.displayName.toLocaleLowerCase(locale).includes(needle));
  }, [locale, people, query]);

  const loadDirectory = useCallback(async (signal?: AbortSignal) => {
    setDirectoryLoading(true);
    setError(null);
    try {
      const result = await peopleApi.list(signal);
      setPeople(result.filter(person => person.active));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setDirectoryLoading(false);
    }
  }, [text.unavailable]);

  const loadGrants = useCallback(async (subjectId: string, signal?: AbortSignal) => {
    if (!subjectId) {
      setGrants([]);
      return;
    }
    setGrantsLoading(true);
    setError(null);
    try {
      setGrants(await accessGrantApi.list(subjectId, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setGrantsLoading(false);
    }
  }, [text.unavailable]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadDirectory(controller.signal);
    return () => controller.abort();
  }, [loadDirectory, open]);

  useEffect(() => {
    if (!open || !personId) return;
    const controller = new AbortController();
    void loadGrants(personId, controller.signal);
    return () => controller.abort();
  }, [loadGrants, open, personId]);

  const grantAccess = async () => {
    if (!personId) return;
    setSaving(true);
    setError(null);
    try {
      const granted = await accessGrantApi.grant(personId, capability);
      setGrants(current => {
        const withoutSame = current.filter(item => item.id !== granted.id);
        return [...withoutSame, granted].sort((a, b) => a.capability.localeCompare(b.capability));
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (grantId: string) => {
    setRevokingId(grantId);
    setError(null);
    try {
      const revoked = await accessGrantApi.revoke(grantId);
      setGrants(current => current.map(item => item.id === revoked.id ? revoked : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      setRevokingId(null);
    }
  };

  const activeCapabilities = new Set(grants.filter(item => !item.revokedAt).map(item => item.capability));
  const canGrant = personId && !activeCapabilities.has(capability) && !saving;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="access-management-title">
      <DialogTitle id="access-management-title">
        <Typography variant="h5" fontWeight={760}>{text.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{text.subtitle}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">{text.directoryHint}</Alert>
          {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void loadDirectory()}>{text.retry}</Button>}>{error}</Alert> : null}

          {directoryLoading ? (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 3 }} role="status">
              <CircularProgress size={24} /><Typography color="text.secondary">{text.directoryLoading}</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <TextField
                label={text.searchPerson}
                value={query}
                onChange={event => setQuery(event.target.value)}
                type="search"
                fullWidth
                slotProps={{ htmlInput: { autoComplete: 'off' } }}
              />
              <TextField select label={text.person} value={personId} onChange={event => setPersonId(event.target.value)} fullWidth>
                <MenuItem value=""><em>—</em></MenuItem>
                {filteredPeople.map(person => <MenuItem key={person.id} value={person.id}>{person.displayName}</MenuItem>)}
              </TextField>
            </Stack>
          )}

          {personId ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
                <TextField select label={text.capability} value={capability} onChange={event => setCapability(event.target.value as Capability)} fullWidth>
                  {ACCESS_CAPABILITIES.map(value => (
                    <MenuItem key={value} value={value} disabled={activeCapabilities.has(value)}>
                      {value}{SENSITIVE.has(value) ? ` · ${text.sensitive}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="contained" onClick={() => void grantAccess()} disabled={!canGrant} sx={{ minWidth: { sm: 180 } }}>
                  {saving ? text.granting : text.grant}
                </Button>
              </Stack>

              {grantsLoading ? (
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 3 }} role="status">
                  <CircularProgress size={24} /><Typography color="text.secondary">{text.grantsLoading}</Typography>
                </Stack>
              ) : grants.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">{text.noGrants}</Typography></Box>
              ) : (
                <Stack spacing={1}>
                  {grants.map(item => (
                    <Box key={item.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} alignItems={{ sm: 'center' }}>
                        <Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <Typography fontWeight={700}>{item.capability}</Typography>
                            {SENSITIVE.has(item.capability) ? <Chip label={text.sensitive} size="small" variant="outlined" /> : null}
                            <Chip label={item.revokedAt ? text.revoked : text.active} size="small" color={item.revokedAt ? 'default' : 'primary'} variant="outlined" />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">{formatDate(item.grantedAt, locale)}</Typography>
                        </Box>
                        {!item.revokedAt ? (
                          <Button color="error" variant="outlined" disabled={revokingId === item.id} onClick={() => void revoke(item.id)}>
                            {revokingId === item.id ? text.revoking : text.revoke}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          ) : (
            <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">{text.choosePerson}</Typography></Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{text.close}</Button></DialogActions>
    </Dialog>
  );
}
