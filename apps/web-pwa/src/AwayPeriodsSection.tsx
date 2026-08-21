import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import { Stack, Typography } from './ui/MuiCompat';

interface AvailabilityPeriodDto {
  id: string;
  startsAt: string;
  endsAt: string;
  reasonCode?: string;
}

interface AvailabilityApi {
  list(personId: string, signal?: AbortSignal): Promise<readonly AvailabilityPeriodDto[]>;
  add(personId: string, input: { startsAt: string; endsAt: string; reasonCode?: string }, signal?: AbortSignal): Promise<AvailabilityPeriodDto>;
  remove(personId: string, periodId: string, signal?: AbortSignal): Promise<void>;
}

const availabilityApi: AvailabilityApi = {
  async list(personId, signal) {
    const res = await fetch(`/api/people/${encodeURIComponent(personId)}/availability`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) throw new Error('Error loading');
    return res.json() as Promise<readonly AvailabilityPeriodDto[]>;
  },
  async add(personId, input, signal) {
    const res = await fetch(`/api/people/${encodeURIComponent(personId)}/availability`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    if (!res.ok) throw new Error('Error adding');
    return res.json() as Promise<AvailabilityPeriodDto>;
  },
  async remove(personId, periodId, signal) {
    const res = await fetch(`/api/people/${encodeURIComponent(personId)}/availability/${encodeURIComponent(periodId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) throw new Error('Error removing');
  },
};

const reasonLabels: Record<Locale, Record<string, string>> = {
  'pt-PT': { away: 'Ausente', unavailable: 'Indisponível', other: 'Outro' },
  en: { away: 'Away', unavailable: 'Unavailable', other: 'Other' },
  es: { away: 'Ausente', unavailable: 'No disponible', other: 'Otro' },
};

const copy = {
  'pt-PT': {
    title: 'Períodos de ausência',
    add: 'Adicionar ausência',
    start: 'Início',
    end: 'Fim',
    reason: 'Motivo',
    remove: 'Remover',
    empty: 'Nenhum período de ausência',
    error: 'Erro ao carregar',
    retry: 'Tentar novamente',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  en: {
    title: 'Away periods',
    add: 'Add absence',
    start: 'Start',
    end: 'End',
    reason: 'Reason',
    remove: 'Remove',
    empty: 'No away periods',
    error: 'Error loading',
    retry: 'Try again',
    save: 'Save',
    cancel: 'Cancel',
  },
  es: {
    title: 'Períodos de ausencia',
    add: 'Agregar ausencia',
    start: 'Inicio',
    end: 'Fin',
    reason: 'Motivo',
    remove: 'Eliminar',
    empty: 'Ningún período',
    error: 'Error al cargar',
    retry: 'Intentar de nuevo',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
} as const;

function formatDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AwayPeriodsSection({ locale, personId }: { locale: Locale; personId: string }) {
  const text = copy[locale];
  const reasons = reasonLabels[locale];
  const [periods, setPeriods] = useState<readonly AvailabilityPeriodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reasonCode, setReasonCode] = useState<string>('');

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setPeriods(await availabilityApi.list(personId, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [personId]);

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [periods]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!startsAt || !endsAt) return;
    setSaving(true);
    setError(null);
    try {
      const created = await availabilityApi.add(personId, {
        startsAt,
        endsAt,
        ...(reasonCode ? { reasonCode } : {}),
      });
      setPeriods(current => [...current, created]);
      setDialogOpen(false);
      setStartsAt('');
      setEndsAt('');
      setReasonCode('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (periodId: string) => {
    setError(null);
    try {
      await availabilityApi.remove(personId, periodId);
      setPeriods(current => current.filter(p => p.id !== periodId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.error);
    }
  };

  return (
    <Box component="section" aria-labelledby="away-periods-title">
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" id="away-periods-title" fontWeight={700}>{text.title}</Typography>
        <Button variant="outlined" size="small" onClick={() => setDialogOpen(true)}>{text.add}</Button>
      </Stack>

      {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>} sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <LinearProgress sx={{ my: 2 }} role="status" aria-label={text.error} />
      ) : sortedPeriods.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{text.empty}</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          {sortedPeriods.map(period => (
            <Card key={period.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Stack spacing={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {formatDate(period.startsAt, locale)} — {formatDate(period.endsAt, locale)}
                    </Typography>
                    {period.reasonCode ? (
                      <Chip label={reasons[period.reasonCode] ?? period.reasonCode} size="small" variant="outlined" />
                    ) : null}
                  </Stack>
                  <Button size="small" color="error" onClick={() => void handleRemove(period.id)}>{text.remove}</Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleAdd}>
          <DialogTitle>{text.add}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label={text.start}
                type="date"
                value={startsAt}
                onChange={event => setStartsAt(event.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={text.end}
                type="date"
                value={endsAt}
                onChange={event => setEndsAt(event.target.value)}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <FormControl fullWidth>
                <InputLabel shrink>{text.reason}</InputLabel>
                <Select
                  value={reasonCode}
                  label={text.reason}
                  onChange={event => setReasonCode(event.target.value)}
                  displayEmpty
                  notched
                >
                  <MenuItem value="">
                    <em>—</em>
                  </MenuItem>
                  <MenuItem value="away">{reasons['away']}</MenuItem>
                  <MenuItem value="unavailable">{reasons['unavailable']}</MenuItem>
                  <MenuItem value="other">{reasons['other']}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>{text.cancel}</Button>
            <Button type="submit" variant="contained" disabled={saving || !startsAt || !endsAt}>{text.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
