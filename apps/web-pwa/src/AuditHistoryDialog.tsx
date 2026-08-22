import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { auditHistoryApi, type AuditAction, type AuditHistoryDto, type AuditResourceType } from './lib/auditHistoryApi';
import { Stack, Typography } from './ui/MuiCompat';

const resourceTypes: readonly AuditResourceType[] = [
  'person', 'household', 'service-group', 'responsibility', 'delegation', 'congregation',
  'eligibility', 'availability', 'emergency-contact', 'access-grant', 'midweek-meeting',
  'student-assignment', 'non-student-assignment', 'weekend-meeting', 'public-talk-assignment',
];
const actions: readonly AuditAction[] = ['create', 'update', 'delete', 'grant', 'revoke'];

const copy = {
  'pt-PT': { title: 'Histórico de auditoria', subtitle: 'Registo de alterações operacionais autorizadas neste tenant.', allResources: 'Todos os recursos', allActions: 'Todas as ações', resource: 'Tipo de recurso', action: 'Ação', actor: 'ID do ator', from: 'A partir de', to: 'Até', loading: 'A carregar histórico…', empty: 'Nenhum evento corresponde aos filtros.', unavailable: 'Não foi possível carregar o histórico. Tenta novamente.', retry: 'Tentar novamente', refresh: 'Atualizar', close: 'Fechar', resourceId: 'Identificador do recurso', changed: 'Campos registados', by: 'Registado por', results: 'eventos apresentados', clear: 'Limpar filtros', filterHint: 'Os filtros são aplicados apenas aos eventos já carregados.' },
  en: { title: 'Audit history', subtitle: 'Record of authorized operational changes in this tenant.', allResources: 'All resources', allActions: 'All actions', resource: 'Resource type', action: 'Action', actor: 'Actor ID', from: 'From', to: 'To', loading: 'Loading audit history…', empty: 'No events match the filters.', unavailable: 'Audit history could not be loaded. Please try again.', retry: 'Try again', refresh: 'Refresh', close: 'Close', resourceId: 'Resource identifier', changed: 'Recorded fields', by: 'Recorded by', results: 'events shown', clear: 'Clear filters', filterHint: 'Filters apply only to events that are already loaded.' },
  es: { title: 'Historial de auditoría', subtitle: 'Registro de cambios operativos autorizados en este tenant.', allResources: 'Todos los recursos', allActions: 'Todas las acciones', resource: 'Tipo de recurso', action: 'Acción', actor: 'ID del actor', from: 'Desde', to: 'Hasta', loading: 'Cargando historial…', empty: 'Ningún evento coincide con los filtros.', unavailable: 'No se pudo cargar el historial. Inténtalo de nuevo.', retry: 'Intentar de nuevo', refresh: 'Actualizar', close: 'Cerrar', resourceId: 'Identificador del recurso', changed: 'Campos registrados', by: 'Registrado por', results: 'eventos mostrados', clear: 'Limpiar filtros', filterHint: 'Los filtros se aplican solo a los eventos ya cargados.' },
} as const;

const actionLabels: Record<Locale, Record<AuditAction, string>> = {
  'pt-PT': { create: 'Criar', update: 'Atualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revogar' },
  en: { create: 'Create', update: 'Update', delete: 'Delete', grant: 'Grant', revoke: 'Revoke' },
  es: { create: 'Crear', update: 'Actualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revocar' },
};
const resourceLabels: Record<Locale, Record<AuditResourceType, string>> = {
  'pt-PT': { person: 'Pessoa', household: 'Agregado', 'service-group': 'Grupo de serviço', responsibility: 'Responsabilidade', delegation: 'Delegação', congregation: 'Congregação', eligibility: 'Elegibilidade', availability: 'Disponibilidade', 'emergency-contact': 'Contacto de emergência', 'access-grant': 'Acesso', 'midweek-meeting': 'Reunião do meio da semana', 'student-assignment': 'Designação de estudante', 'non-student-assignment': 'Designação não estudantil', 'weekend-meeting': 'Reunião do fim de semana', 'public-talk-assignment': 'Designação de discurso público' },
  en: { person: 'Person', household: 'Household', 'service-group': 'Service group', responsibility: 'Responsibility', delegation: 'Delegation', congregation: 'Congregation', eligibility: 'Eligibility', availability: 'Availability', 'emergency-contact': 'Emergency contact', 'access-grant': 'Access grant', 'midweek-meeting': 'Midweek meeting', 'student-assignment': 'Student assignment', 'non-student-assignment': 'Non-student assignment', 'weekend-meeting': 'Weekend meeting', 'public-talk-assignment': 'Public talk assignment' },
  es: { person: 'Persona', household: 'Hogar', 'service-group': 'Grupo de servicio', responsibility: 'Responsabilidad', delegation: 'Delegación', congregation: 'Congregación', eligibility: 'Elegibilidad', availability: 'Disponibilidad', 'emergency-contact': 'Contacto de emergencia', 'access-grant': 'Acceso', 'midweek-meeting': 'Reunión de entre semana', 'student-assignment': 'Asignación de estudiante', 'non-student-assignment': 'Asignación no estudiantil', 'weekend-meeting': 'Reunión del fin de semana', 'public-talk-assignment': 'Asignación de discurso público' },
};

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function resolvedTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

export function auditLocalDateKey(occurredAt: string, timeZone: string): string {
  const date = new Date(occurredAt);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map(part => [part.type, part.value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function inDateRange(occurredAt: string, from: string, to: string, timeZone: string): boolean {
  const eventDate = auditLocalDateKey(occurredAt, timeZone);
  return Boolean(eventDate) && (!from || eventDate >= from) && (!to || eventDate <= to);
}

export function filterAuditEvents(
  events: readonly AuditHistoryDto[],
  filters: { resourceType: AuditResourceType | ''; action: AuditAction | ''; actorId: string; from: string; to: string },
  timeZone = resolvedTimeZone(),
): readonly AuditHistoryDto[] {
  const actor = filters.actorId.trim().toLocaleLowerCase();
  return events
    .filter(event =>
      (!filters.resourceType || event.resourceType === filters.resourceType) &&
      (!filters.action || event.action === filters.action) &&
      (!actor || event.actorId.toLocaleLowerCase().includes(actor)) &&
      inDateRange(event.occurredAt, filters.from, filters.to, timeZone))
    .slice()
    .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt));
}

export function AuditHistoryDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [events, setEvents] = useState<readonly AuditHistoryDto[]>([]);
  const [resourceType, setResourceType] = useState<AuditResourceType | ''>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setEvents(await auditHistoryApi.list({ limit: 100 }, signal)); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { if (!open) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, open]);
  const filters = { resourceType, action, actorId, from, to };
  const filteredEvents = useMemo(() => filterAuditEvents(events, filters), [events, resourceType, action, actorId, from, to]);
  const filtersActive = Boolean(resourceType || action || actorId.trim() || from || to);
  const clearFilters = () => { setResourceType(''); setAction(''); setActorId(''); setFrom(''); setTo(''); };

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="audit-history-title" aria-describedby="audit-history-description">
    <DialogTitle id="audit-history-title"><Typography variant="h5" fontWeight={760}>{text.title}</Typography><Typography id="audit-history-description" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{text.subtitle}</Typography></DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }} aria-label={text.title}><Stack spacing={1.5}><Typography variant="body2" color="text.secondary">{text.filterHint}</Typography><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}><TextField select fullWidth label={text.resource} value={resourceType} onChange={event => setResourceType(event.target.value as AuditResourceType | '')}><MenuItem value="">{text.allResources}</MenuItem>{resourceTypes.map(value => <MenuItem key={value} value={value}>{resourceLabels[locale][value]}</MenuItem>)}</TextField><TextField select fullWidth label={text.action} value={action} onChange={event => setAction(event.target.value as AuditAction | '')}><MenuItem value="">{text.allActions}</MenuItem>{actions.map(value => <MenuItem key={value} value={value}>{actionLabels[locale][value]}</MenuItem>)}</TextField><TextField fullWidth label={text.actor} value={actorId} onChange={event => setActorId(event.target.value)} slotProps={{ htmlInput: { maxLength: 200, autoComplete: 'off' } }} /></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}><TextField fullWidth type="date" label={text.from} value={from} onChange={event => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || undefined } }} /><TextField fullWidth type="date" label={text.to} value={to} onChange={event => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }} />{filtersActive ? <Button onClick={clearFilters} sx={{ whiteSpace: 'nowrap' }}>{text.clear}</Button> : null}</Stack></Stack></Paper>
      {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
      {loading ? <Stack direction="row" justifyContent="center" alignItems="center" spacing={1.5} sx={{ py: 5 }} role="status" aria-live="polite"><CircularProgress size={24} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : null}
      {!loading && !loadError ? <><Typography variant="body2" color="text.secondary" aria-live="polite">{filteredEvents.length} {text.results}</Typography>{filteredEvents.length === 0 ? <Box sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary">{text.empty}</Typography></Box> : <Stack component="ol" spacing={0} sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={text.title}>{filteredEvents.map((item, index) => <Stack component="li" key={item.id} direction="row" spacing={1.25} sx={{ position: 'relative' }}><Box aria-hidden sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, pt: 2 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', flex: '0 0 auto' }} />{index < filteredEvents.length - 1 ? <Box sx={{ width: 2, flex: 1, minHeight: 28, bgcolor: 'divider' }} /> : null}</Box><Paper component="article" variant="outlined" sx={{ flex: 1, mb: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={1.25}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center"><Chip size="small" label={resourceLabels[locale][item.resourceType]} variant="outlined" /><Chip size="small" color="primary" label={actionLabels[locale][item.action]} /></Stack><Typography variant="body2" color="text.secondary">{formatDate(item.occurredAt, locale)}</Typography></Stack><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}><strong>{text.resourceId}:</strong> {item.resourceId}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}><strong>{text.by}:</strong> {item.actorId}</Typography>{item.changedFields.length ? <Stack spacing={0.75}><Typography variant="caption" color="text.secondary">{text.changed}</Typography><Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>{item.changedFields.map(field => <Chip key={field} label={field} size="small" variant="outlined" />)}</Stack></Stack> : null}</Stack></Paper></Stack>)}</Stack>}</> : null}
    </Stack></DialogContent>
    <DialogActions><Button onClick={() => void load()} disabled={loading}>{text.refresh}</Button><Button onClick={onClose} disabled={loading}>{text.close}</Button></DialogActions>
  </Dialog>;
}
