import { useCallback, useEffect, useMemo, useState } from 'react';
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
  MenuItem,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import {
  auditHistoryApi,
  type AuditAction,
  type AuditHistoryDto,
  type AuditResourceType,
} from './lib/auditHistoryApi';
import { Stack, Typography } from './ui/MuiCompat';

const resourceTypes: readonly AuditResourceType[] = [
  'person', 'household', 'service-group', 'responsibility', 'delegation', 'congregation',
  'eligibility', 'availability', 'emergency-contact', 'access-grant',
];
const actions: readonly AuditAction[] = ['create', 'update', 'delete', 'grant', 'revoke'];

const copy = {
  'pt-PT': {
    title: 'Histórico de auditoria', subtitle: 'Alterações operacionais autorizadas neste tenant.',
    allResources: 'Todos os recursos', allActions: 'Todas as ações', resource: 'Tipo de recurso', action: 'Ação', actor: 'ID do ator',
    loading: 'A carregar histórico…', empty: 'Nenhum evento corresponde aos filtros.', unavailable: 'Não foi possível carregar o histórico.',
    retry: 'Tentar novamente', refresh: 'Atualizar', close: 'Fechar', resourceId: 'Recurso', changed: 'Campos alterados', by: 'Por',
  },
  en: {
    title: 'Audit history', subtitle: 'Authorized operational changes in this tenant.',
    allResources: 'All resources', allActions: 'All actions', resource: 'Resource type', action: 'Action', actor: 'Actor ID',
    loading: 'Loading audit history…', empty: 'No events match the filters.', unavailable: 'Audit history could not be loaded.',
    retry: 'Try again', refresh: 'Refresh', close: 'Close', resourceId: 'Resource', changed: 'Changed fields', by: 'By',
  },
  es: {
    title: 'Historial de auditoría', subtitle: 'Cambios operativos autorizados en este tenant.',
    allResources: 'Todos los recursos', allActions: 'Todas las acciones', resource: 'Tipo de recurso', action: 'Acción', actor: 'ID del actor',
    loading: 'Cargando historial…', empty: 'Ningún evento coincide con los filtros.', unavailable: 'No se pudo cargar el historial.',
    retry: 'Intentar de nuevo', refresh: 'Actualizar', close: 'Cerrar', resourceId: 'Recurso', changed: 'Campos modificados', by: 'Por',
  },
} as const;

const actionLabels: Record<Locale, Record<AuditAction, string>> = {
  'pt-PT': { create: 'Criar', update: 'Atualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revogar' },
  en: { create: 'Create', update: 'Update', delete: 'Delete', grant: 'Grant', revoke: 'Revoke' },
  es: { create: 'Crear', update: 'Actualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revocar' },
};

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AuditHistoryDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [events, setEvents] = useState<readonly AuditHistoryDto[]>([]);
  const [resourceType, setResourceType] = useState<AuditResourceType | ''>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [actorId, setActorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({
    ...(resourceType ? { resourceType } : {}),
    ...(action ? { action } : {}),
    ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
    limit: 100,
  }), [action, actorId, resourceType]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await auditHistoryApi.list(filters, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, text.unavailable]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="audit-history-title">
      <DialogTitle id="audit-history-title">
        <Typography variant="h5" fontWeight={760}>{text.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{text.subtitle}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              fullWidth
              label={text.resource}
              value={resourceType}
              onChange={event => setResourceType(event.target.value as AuditResourceType | '')}
            >
              <MenuItem value="">{text.allResources}</MenuItem>
              {resourceTypes.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </TextField>
            <TextField
              select
              fullWidth
              label={text.action}
              value={action}
              onChange={event => setAction(event.target.value as AuditAction | '')}
            >
              <MenuItem value="">{text.allActions}</MenuItem>
              {actions.map(value => <MenuItem key={value} value={value}>{actionLabels[locale][value]}</MenuItem>)}
            </TextField>
            <TextField
              fullWidth
              label={text.actor}
              value={actorId}
              onChange={event => setActorId(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200, autoComplete: 'off' } }}
            />
          </Stack>

          {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>}>{error}</Alert> : null}

          {loading ? (
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1.5} sx={{ py: 5 }} role="status">
              <CircularProgress size={24} />
              <Typography color="text.secondary">{text.loading}</Typography>
            </Stack>
          ) : events.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary">{text.empty}</Typography></Box>
          ) : (
            <Stack spacing={1.5}>
              {events.map(item => (
                <Card key={item.id} component="article" variant="outlined">
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                          <Chip size="small" label={item.resourceType} variant="outlined" />
                          <Chip size="small" label={actionLabels[locale][item.action]} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">{formatDate(item.occurredAt, locale)}</Typography>
                      </Stack>
                      <Typography variant="body2"><strong>{text.resourceId}:</strong> {item.resourceId}</Typography>
                      <Typography variant="body2"><strong>{text.by}:</strong> {item.actorId}</Typography>
                      {item.changedFields.length ? (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                          <Typography variant="caption" color="text.secondary">{text.changed}:</Typography>
                          {item.changedFields.map(field => <Chip key={field} label={field} size="small" variant="outlined" />)}
                        </Stack>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void load()} disabled={loading}>{text.refresh}</Button>
        <Button onClick={onClose}>{text.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
