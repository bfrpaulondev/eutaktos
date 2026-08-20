import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  TextField,
} from '@mui/material';
import { Stack, Typography } from './ui/MuiCompat';

type Locale = 'pt-PT' | 'en' | 'es';

/* ------------------------------------------------------------------ */
/*  Local DTO & API interface                                          */
/* ------------------------------------------------------------------ */

export interface ResponsibilityDto {
  id: string;
  personId: string;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
}

export interface ResponsibilitiesApi {
  list(signal?: AbortSignal): Promise<readonly ResponsibilityDto[]>;
  assign(input: { personId: string; responsibilityKey: string; startsAt: string; endsAt?: string }): Promise<ResponsibilityDto>;
  end(id: string, endsAt: string): Promise<ResponsibilityDto>;
}

// Placeholder — will be replaced by the real implementation from K09
const api: ResponsibilitiesApi = {
  list: async () => [],
  assign: async (input) => ({ id: crypto.randomUUID(), ...input }),
  end: async (id, endsAt) => ({ id, personId: '', responsibilityKey: '', startsAt: '', endsAt }),
};

/* ------------------------------------------------------------------ */
/*  Locale-aware labels                                                */
/* ------------------------------------------------------------------ */

const copy = {
  'pt-PT': {
    title: 'Responsabilidades',
    create: 'Atribuir responsabilidade',
    person: 'Pessoa',
    personId: 'ID da pessoa',
    responsibilityKey: 'Função',
    startsAt: 'Início',
    endsAt: 'Fim',
    endAction: 'Terminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    endConfirmTitle: 'Terminar responsabilidade?',
    empty: 'Nenhuma responsabilidade atribuída',
    errorLoading: 'Erro ao carregar responsabilidades',
    retry: 'Tentar novamente',
    createTitle: 'Nova responsabilidade',
    confirmEnd: 'Terminar',
    confirmCancel: 'Cancelar',
    active: 'Ativa',
    ended: 'Terminada',
    datePlaceholder: 'AAAA-MM-DD',
    personPlaceholder: 'ID da pessoa',
    keyPlaceholder: 'ex: elder, ministerial-servant, pioneer',
    endedOn: 'Terminada em',
    startedOn: 'Iniciada em',
    endsOn: 'Até',
  },
  en: {
    title: 'Responsibilities',
    create: 'Assign responsibility',
    person: 'Person',
    personId: 'Person ID',
    responsibilityKey: 'Responsibility',
    startsAt: 'Start',
    endsAt: 'End',
    endAction: 'End',
    save: 'Save',
    cancel: 'Cancel',
    endConfirmTitle: 'End responsibility?',
    empty: 'No responsibilities assigned',
    errorLoading: 'Error loading responsibilities',
    retry: 'Try again',
    createTitle: 'New responsibility',
    confirmEnd: 'End',
    confirmCancel: 'Cancel',
    active: 'Active',
    ended: 'Ended',
    datePlaceholder: 'YYYY-MM-DD',
    personPlaceholder: 'Person ID',
    keyPlaceholder: 'e.g. elder, ministerial-servant, pioneer',
    endedOn: 'Ended on',
    startedOn: 'Started on',
    endsOn: 'Until',
  },
  es: {
    title: 'Responsabilidades',
    create: 'Atribuir responsabilidade',
    person: 'Persona',
    personId: 'ID de persona',
    responsibilityKey: 'Función',
    startsAt: 'Inicio',
    endsAt: 'Fin',
    endAction: 'Terminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    endConfirmTitle: '¿Terminar responsabilidad?',
    empty: 'Ninguna responsabilidad asignada',
    errorLoading: 'Error al cargar responsabilidades',
    retry: 'Intentar de nuevo',
    createTitle: 'Nueva responsabilidad',
    confirmEnd: 'Terminar',
    confirmCancel: 'Cancelar',
    active: 'Activa',
    ended: 'Terminada',
    datePlaceholder: 'AAAA-MM-DD',
    personPlaceholder: 'ID de persona',
    keyPlaceholder: 'ej: anciano, siervo ministerial, precursor',
    endedOn: 'Terminada el',
    startedOn: 'Iniciada el',
    endsOn: 'Hasta',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString(
      locale === 'pt-PT' ? 'pt-PT' : locale,
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ResponsibilitiesSection({ locale }: { locale: Locale }) {
  const text = copy[locale];

  const [items, setItems] = useState<readonly ResponsibilityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [endConfirmId, setEndConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);

  // Form state
  const [formPersonId, setFormPersonId] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formStartsAt, setFormStartsAt] = useState(todayIso());
  const [formEndsAt, setFormEndsAt] = useState('');

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.list(signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.errorLoading);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  /* ---------- dialog helpers ---------- */

  const openCreate = () => {
    setFormPersonId('');
    setFormKey('');
    setFormStartsAt(todayIso());
    setFormEndsAt('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  /* ---------- submit ---------- */

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const personId = formPersonId.trim();
    const responsibilityKey = formKey.trim();
    const startsAt = formStartsAt;
    if (!personId || !responsibilityKey || !startsAt) return;
    const endsAt = formEndsAt.trim() || undefined;

    setSaving(true);
    setError(null);
    try {
      const created = await api.assign({ personId, responsibilityKey, startsAt, endsAt });
      setItems(current =>
        [...current, created].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      );
      closeDialog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.errorLoading);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- end ---------- */

  const handleEnd = async () => {
    if (!endConfirmId) return;
    const endDate = todayIso();
    setEnding(true);
    setError(null);
    try {
      const updated = await api.end(endConfirmId, endDate);
      setItems(current =>
        current
          .map(r => (r.id === updated.id ? updated : r))
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      );
      setEndConfirmId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.errorLoading);
      setEndConfirmId(null);
    } finally {
      setEnding(false);
    }
  };

  /* ---------- render ---------- */

  return (
    <Box component="section" aria-labelledby="responsibilities-title">
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-end' }}>
          <Box>
            <Typography variant="h2" id="responsibilities-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>
              {text.title}
            </Typography>
          </Box>
          <Button variant="contained" onClick={openCreate}>{text.create}</Button>
        </Stack>
      </Paper>

      {loading && <LinearProgress />}

      {error && (
        <Paper sx={{ p: 2, mb: 2, borderColor: 'error.main' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
            <Typography color="error">{error}</Typography>
            <Button color="error" size="small" onClick={() => void load()}>
              {text.retry}
            </Button>
          </Stack>
        </Paper>
      )}

      {!loading && items.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{text.empty}</Typography>
        </Paper>
      )}

      {!loading && items.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {items.map(item => {
            const isEnded = Boolean(item.endsAt);
            return (
              <Card component="article" key={item.id}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" fontWeight={700} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.responsibilityKey}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {text.person}: {item.personId}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={isEnded ? text.ended : text.active}
                          size="small"
                          variant="outlined"
                          color={isEnded ? 'default' : 'success'}
                        />
                        {!isEnded && (
                          <Button
                            size="small"
                            variant="text"
                            color="warning"
                            onClick={() => setEndConfirmId(item.id)}
                          >
                            {text.endAction}
                          </Button>
                        )}
                      </Stack>
                    </Stack>

                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary">
                        {text.startedOn} {formatDate(item.startsAt, locale)}
                      </Typography>
                      {item.endsAt && (
                        <Typography variant="body2" color="text.secondary">
                          {text.endedOn} {formatDate(item.endsAt, locale)}
                        </Typography>
                      )}
                      {!isEnded && item.endsAt && (
                        <Typography variant="body2" color="text.secondary">
                          {text.endsOn} {formatDate(item.endsAt, locale)}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Assign dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{text.createTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label={text.personId}
                value={formPersonId}
                onChange={e => setFormPersonId(e.target.value)}
                required
                autoFocus
                fullWidth
                placeholder={text.personPlaceholder}
              />
              <TextField
                label={text.responsibilityKey}
                value={formKey}
                onChange={e => setFormKey(e.target.value)}
                required
                fullWidth
                placeholder={text.keyPlaceholder}
              />
              <TextField
                label={text.startsAt}
                type="date"
                value={formStartsAt}
                onChange={e => setFormStartsAt(e.target.value)}
                required
                fullWidth
                slotProps={{ htmlInput: { max: formEndsAt || undefined } }}
              />
              <TextField
                label={text.endsAt}
                type="date"
                value={formEndsAt}
                onChange={e => setFormEndsAt(e.target.value)}
                fullWidth
                slotProps={{ htmlInput: { min: formStartsAt } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={saving}>{text.cancel}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !formPersonId.trim() || !formKey.trim() || !formStartsAt}
            >
              {text.save}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* End confirmation dialog */}
      <Dialog open={endConfirmId !== null} onClose={() => !ending && setEndConfirmId(null)}>
        <DialogTitle>{text.endConfirmTitle}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setEndConfirmId(null)} disabled={ending}>{text.confirmCancel}</Button>
          <Button onClick={() => void handleEnd()} color="warning" variant="contained" disabled={ending}>
            {text.confirmEnd}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
