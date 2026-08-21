import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, ListSubheader, MenuItem, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { ACCESS_CAPABILITIES, accessGrantApi, type AccessGrantDto, type Capability } from './lib/accessGrantApi';
import { Stack, Typography } from './ui/MuiCompat';

const SENSITIVE = new Set<Capability>(['eligibility.write', 'emergency-contacts.read', 'emergency-contacts.write', 'delegations.read', 'delegations.write', 'review.read', 'review.write', 'audit.read', 'access.manage', 'tenant.manage']);
const GROUPS: readonly { key: 'people' | 'availability' | 'operations' | 'review' | 'administration'; capabilities: readonly Capability[] }[] = [
  { key: 'people', capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write', 'emergency-contacts.read', 'emergency-contacts.write'] },
  { key: 'availability', capabilities: ['availability.read', 'availability.write'] },
  { key: 'operations', capabilities: ['responsibilities.read', 'responsibilities.write', 'delegations.read', 'delegations.write', 'schedule.read', 'schedule.write', 'reports.read', 'reports.write'] },
  { key: 'review', capabilities: ['review.read', 'review.write', 'audit.read'] },
  { key: 'administration', capabilities: ['access.manage', 'tenant.manage'] },
];

const copy = {
  'pt-PT': { title: 'Gestão de acessos', subtitle: 'Concede capabilities explícitas. Nenhuma função ou qualificação é inferida automaticamente.', person: 'Pessoa', searchPerson: 'Procurar pessoa', capability: 'Capability a conceder', selectCapability: 'Seleciona primeiro uma capability explícita.', grant: 'Conceder acesso', granting: 'A conceder…', active: 'Ativo', revoked: 'Revogado', sensitive: 'Sensível', revoke: 'Revogar', revoking: 'A revogar…', choosePerson: 'Seleciona uma pessoa para consultar os acessos.', noGrants: 'Nenhum acesso explícito registado para esta pessoa.', directoryLoading: 'A carregar pessoas…', grantsLoading: 'A carregar acessos…', retry: 'Tentar novamente', close: 'Fechar', unavailable: 'Não foi possível carregar a gestão de acessos. Tenta novamente.', grantError: 'Não foi possível conceder o acesso. Tenta novamente.', revokeError: 'Não foi possível revogar o acesso. Tenta novamente.', grantSuccess: 'Acesso concedido com sucesso.', revokeSuccess: 'Acesso revogado com sucesso.', directoryHint: 'A listagem de pessoas exige people.read separadamente de access.manage.', groups: { people: 'Pessoas e dados sensíveis', availability: 'Disponibilidade', operations: 'Operações', review: 'Revisão e auditoria', administration: 'Administração' }, grantTitle: 'Confirmar concessão de acesso', grantBody: 'Confirma que pretende conceder esta capability explícita à pessoa selecionada. A ação não altera outras capabilities.', revokeTitle: 'Confirmar revogação de acesso', revokeBody: 'Confirma que pretende revogar esta capability explícita. A pessoa deixará de ter este acesso após a confirmação.', confirmGrant: 'Sim, conceder', confirmRevoke: 'Sim, revogar', cancel: 'Cancelar', tenantWarning: 'tenant.manage não concede acesso universal; aplica-se somente às verificações de autorização do servidor.' },
  en: { title: 'Access management', subtitle: 'Grant explicit capabilities. No role or qualification is inferred automatically.', person: 'Person', searchPerson: 'Search people', capability: 'Capability to grant', selectCapability: 'Select an explicit capability first.', grant: 'Grant access', granting: 'Granting…', active: 'Active', revoked: 'Revoked', sensitive: 'Sensitive', revoke: 'Revoke', revoking: 'Revoking…', choosePerson: 'Select a person to inspect access.', noGrants: 'No explicit access is recorded for this person.', directoryLoading: 'Loading people…', grantsLoading: 'Loading access…', retry: 'Try again', close: 'Close', unavailable: 'Access management could not be loaded. Please try again.', grantError: 'Access could not be granted. Please try again.', revokeError: 'Access could not be revoked. Please try again.', grantSuccess: 'Access granted successfully.', revokeSuccess: 'Access revoked successfully.', directoryHint: 'Listing people requires people.read separately from access.manage.', groups: { people: 'People and sensitive data', availability: 'Availability', operations: 'Operations', review: 'Review and audit', administration: 'Administration' }, grantTitle: 'Confirm access grant', grantBody: 'Confirm that you want to grant this explicit capability to the selected person. This does not change any other capabilities.', revokeTitle: 'Confirm access revocation', revokeBody: 'Confirm that you want to revoke this explicit capability. The person will no longer have this access after confirmation.', confirmGrant: 'Yes, grant', confirmRevoke: 'Yes, revoke', cancel: 'Cancel', tenantWarning: 'tenant.manage does not grant universal access; it applies only to server-side authorization checks.' },
  es: { title: 'Gestión de accesos', subtitle: 'Concede capabilities explícitas. No se infiere automáticamente ningún rol ni cualificación.', person: 'Persona', searchPerson: 'Buscar personas', capability: 'Capability para conceder', selectCapability: 'Selecciona primero una capability explícita.', grant: 'Conceder acceso', granting: 'Concediendo…', active: 'Activo', revoked: 'Revocado', sensitive: 'Sensible', revoke: 'Revocar', revoking: 'Revocando…', choosePerson: 'Selecciona una persona para consultar los accesos.', noGrants: 'No hay acceso explícito registrado para esta persona.', directoryLoading: 'Cargando personas…', grantsLoading: 'Cargando accesos…', retry: 'Intentar de nuevo', close: 'Cerrar', unavailable: 'No se pudo cargar la gestión de accesos. Inténtalo de nuevo.', grantError: 'No se pudo conceder el acceso. Inténtalo de nuevo.', revokeError: 'No se pudo revocar el acceso. Inténtalo de nuevo.', grantSuccess: 'Acceso concedido correctamente.', revokeSuccess: 'Acceso revocado correctamente.', directoryHint: 'Listar personas requiere people.read por separado de access.manage.', groups: { people: 'Personas y datos sensibles', availability: 'Disponibilidad', operations: 'Operaciones', review: 'Revisión y auditoría', administration: 'Administración' }, grantTitle: 'Confirmar concesión de acceso', grantBody: 'Confirma que deseas conceder esta capability explícita a la persona seleccionada. La acción no cambia otras capabilities.', revokeTitle: 'Confirmar revocación de acceso', revokeBody: 'Confirma que deseas revocar esta capability explícita. La persona dejará de tener este acceso después de confirmar.', confirmGrant: 'Sí, conceder', confirmRevoke: 'Sí, revocar', cancel: 'Cancelar', tenantWarning: 'tenant.manage no concede acceso universal; se aplica únicamente a las comprobaciones de autorización del servidor.' },
} as const;

export function capabilityGroup(capability: Capability): (typeof GROUPS)[number]['key'] { return GROUPS.find(group => group.capabilities.includes(capability))?.key ?? 'administration'; }
export function isSensitiveCapability(capability: Capability): boolean { return SENSITIVE.has(capability); }
function formatDate(value: string, locale: Locale): string { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value; }

export function AccessManagementDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [personId, setPersonId] = useState('');
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState<Capability | ''>('');
  const [grants, setGrants] = useState<readonly AccessGrantDto[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [grantConfirmation, setGrantConfirmation] = useState(false);
  const [revokeCandidate, setRevokeCandidate] = useState<AccessGrantDto | null>(null);
  const [error, setError] = useState<'load' | 'grant' | 'revoke' | null>(null);
  const [notice, setNotice] = useState<'grant' | 'revoke' | null>(null);
  const grantRef = useRef(false);
  const revokeRef = useRef(false);
  const grantButtonRef = useRef<HTMLButtonElement | null>(null);
  const revokeButtonRef = useRef<HTMLButtonElement | null>(null);

  const filteredPeople = useMemo(() => { const needle = query.trim().toLocaleLowerCase(locale); return !needle ? people : people.filter(person => person.displayName.toLocaleLowerCase(locale).includes(needle)); }, [locale, people, query]);
  const selectedPerson = people.find(person => person.id === personId) ?? null;
  const activeCapabilities = new Set(grants.filter(item => !item.revokedAt).map(item => item.capability));
  const canConfirmGrant = Boolean(personId && capability && !activeCapabilities.has(capability) && !granting);

  const loadDirectory = useCallback(async (signal?: AbortSignal) => {
    setDirectoryLoading(true); setError(null);
    try { setPeople((await peopleApi.list(signal)).filter(person => person.active)); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return; setError('load'); }
    finally { if (!signal?.aborted) setDirectoryLoading(false); }
  }, []);
  const loadGrants = useCallback(async (subjectId: string, signal?: AbortSignal) => {
    if (!subjectId) { setGrants([]); return; }
    setGrantsLoading(true); setError(null);
    try { setGrants(await accessGrantApi.list(subjectId, signal)); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return; setError('load'); }
    finally { if (!signal?.aborted) setGrantsLoading(false); }
  }, []);
  useEffect(() => { if (!open) return; const controller = new AbortController(); void loadDirectory(controller.signal); return () => controller.abort(); }, [loadDirectory, open]);
  useEffect(() => { if (!open || !personId) return; const controller = new AbortController(); void loadGrants(personId, controller.signal); return () => controller.abort(); }, [loadGrants, open, personId]);

  const grantAccess = async () => {
    if (!personId || !capability || grantRef.current) return;
    grantRef.current = true; setGranting(true); setError(null); setNotice(null);
    try { const granted = await accessGrantApi.grant(personId, capability); setGrants(current => [...current.filter(item => item.id !== granted.id), granted].sort((first, second) => first.capability.localeCompare(second.capability))); setGrantConfirmation(false); setNotice('grant'); setCapability(''); window.requestAnimationFrame(() => grantButtonRef.current?.focus()); }
    catch { setError('grant'); }
    finally { grantRef.current = false; setGranting(false); }
  };
  const revoke = async () => {
    if (!revokeCandidate || revokeRef.current) return;
    revokeRef.current = true; setRevokingId(revokeCandidate.id); setError(null); setNotice(null);
    try { const revoked = await accessGrantApi.revoke(revokeCandidate.id); setGrants(current => current.map(item => item.id === revoked.id ? revoked : item)); setRevokeCandidate(null); setNotice('revoke'); window.requestAnimationFrame(() => revokeButtonRef.current?.focus()); }
    catch { setError('revoke'); }
    finally { revokeRef.current = false; setRevokingId(null); }
  };
  const retry = () => { if (personId) void loadGrants(personId); else void loadDirectory(); };
  const errorMessage = error === 'grant' ? text.grantError : error === 'revoke' ? text.revokeError : text.unavailable;

  return <Dialog open={open} onClose={() => !granting && !revokingId && !grantConfirmation && !revokeCandidate && onClose()} fullWidth maxWidth="md" aria-labelledby="access-management-title">
    <DialogTitle id="access-management-title"><Typography variant="h5" fontWeight={760}>{text.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{text.subtitle}</Typography></DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Alert severity="info">{text.directoryHint}</Alert>
      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice === 'grant' ? text.grantSuccess : text.revokeSuccess}</Alert> : null}
      {error ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={directoryLoading || grantsLoading} onClick={retry}>{text.retry}</Button>}>{errorMessage}</Alert> : null}
      {directoryLoading ? <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 3 }} role="status"><CircularProgress size={24} /><Typography color="text.secondary">{text.directoryLoading}</Typography></Stack> : <Stack spacing={1.5}><TextField label={text.searchPerson} value={query} onChange={event => setQuery(event.target.value)} type="search" fullWidth slotProps={{ htmlInput: { autoComplete: 'off' } }} /><TextField select label={text.person} value={personId} onChange={event => { setPersonId(event.target.value); setCapability(''); setNotice(null); }} fullWidth><MenuItem value=""><em>—</em></MenuItem>{filteredPeople.map(person => <MenuItem key={person.id} value={person.id}>{person.displayName}</MenuItem>)}</TextField></Stack>}
      {personId ? <Stack spacing={2}><Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={1.25}><TextField select label={text.capability} value={capability} onChange={event => setCapability(event.target.value as Capability | '')} fullWidth><MenuItem value=""><em>{text.selectCapability}</em></MenuItem>{GROUPS.map(group => [<ListSubheader key={group.key}>{text.groups[group.key]}</ListSubheader>, ...group.capabilities.map(value => <MenuItem key={value} value={value} disabled={activeCapabilities.has(value)}>{value}{isSensitiveCapability(value) ? ` · ${text.sensitive}` : ''}</MenuItem>)])}</TextField>{capability === 'tenant.manage' ? <Alert severity="warning">{text.tenantWarning}</Alert> : null}<Button ref={grantButtonRef} variant="contained" onClick={() => setGrantConfirmation(true)} disabled={!canConfirmGrant} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>{granting ? text.granting : text.grant}</Button></Stack></Paper>
        {grantsLoading ? <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 3 }} role="status"><CircularProgress size={24} /><Typography color="text.secondary">{text.grantsLoading}</Typography></Stack> : grants.length === 0 ? <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">{text.noGrants}</Typography></Box> : <Stack spacing={1}>{grants.map(item => <Paper key={item.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} alignItems={{ sm: 'center' }}><Box><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center"><Typography fontWeight={700}>{item.capability}</Typography>{isSensitiveCapability(item.capability) ? <Chip label={text.sensitive} size="small" color="warning" variant="outlined" /> : null}<Chip label={item.revokedAt ? text.revoked : text.active} size="small" color={item.revokedAt ? 'default' : 'primary'} variant="outlined" /></Stack><Typography variant="caption" color="text.secondary">{formatDate(item.grantedAt, locale)}</Typography></Box>{!item.revokedAt ? <Button color="error" variant="outlined" disabled={revokingId !== null} onClick={event => { revokeButtonRef.current = event.currentTarget; setError(null); setRevokeCandidate(item); }}>{revokingId === item.id ? text.revoking : text.revoke}</Button> : null}</Stack></Paper>)}</Stack>}
      </Stack> : <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">{text.choosePerson}</Typography></Box>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={granting || revokingId !== null}>{text.close}</Button></DialogActions>
    <Dialog open={grantConfirmation} onClose={() => !granting && setGrantConfirmation(false)} fullWidth maxWidth="xs" aria-describedby="access-grant-confirmation"><DialogTitle>{text.grantTitle}</DialogTitle><DialogContent><Typography id="access-grant-confirmation">{text.grantBody}</Typography><Typography sx={{ mt: 1 }} fontWeight={700}>{selectedPerson?.displayName} · {capability}</Typography>{capability && isSensitiveCapability(capability) ? <Chip label={text.sensitive} color="warning" size="small" sx={{ mt: 1 }} /> : null}</DialogContent><DialogActions><Button disabled={granting} onClick={() => setGrantConfirmation(false)}>{text.cancel}</Button><Button variant="contained" disabled={!canConfirmGrant} onClick={() => void grantAccess()}>{granting ? text.granting : text.confirmGrant}</Button></DialogActions></Dialog>
    <Dialog open={revokeCandidate !== null} onClose={() => !revokingId && setRevokeCandidate(null)} fullWidth maxWidth="xs" aria-describedby="access-revoke-confirmation"><DialogTitle>{text.revokeTitle}</DialogTitle><DialogContent><Typography id="access-revoke-confirmation">{text.revokeBody}</Typography><Typography sx={{ mt: 1 }} fontWeight={700}>{revokeCandidate?.capability}</Typography>{revokeCandidate && isSensitiveCapability(revokeCandidate.capability) ? <Chip label={text.sensitive} color="warning" size="small" sx={{ mt: 1 }} /> : null}</DialogContent><DialogActions><Button disabled={revokingId !== null} onClick={() => setRevokeCandidate(null)}>{text.cancel}</Button><Button color="error" variant="contained" disabled={revokingId !== null} onClick={() => void revoke()}>{revokingId ? text.revoking : text.confirmRevoke}</Button></DialogActions></Dialog>
  </Dialog>;
}
