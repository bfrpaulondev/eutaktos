import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import { eligibilityApi, type EligibilityDecisionDto } from './lib/eligibilityApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': {
    title: 'Elegibilidade de atribuições', subtitle: 'Decisões explícitas registadas por utilizadores autorizados.',
    loading: 'A carregar elegibilidade…', unavailable: 'Não foi possível carregar a elegibilidade.', retry: 'Tentar novamente',
    empty: 'Ainda não existem decisões registadas.', assignmentType: 'Tipo de atribuição', enabled: 'Elegível', disabled: 'Não elegível',
    decision: 'Nova decisão', cancel: 'Fechar', save: 'Registar decisão', saving: 'A guardar…', updated: 'Decisão atualizada.',
  },
  en: {
    title: 'Assignment eligibility', subtitle: 'Explicit decisions recorded by authorized users.',
    loading: 'Loading eligibility…', unavailable: 'Eligibility could not be loaded.', retry: 'Try again',
    empty: 'No decisions have been recorded yet.', assignmentType: 'Assignment type', enabled: 'Eligible', disabled: 'Not eligible',
    decision: 'New decision', cancel: 'Close', save: 'Record decision', saving: 'Saving…', updated: 'Decision updated.',
  },
  es: {
    title: 'Elegibilidad de asignaciones', subtitle: 'Decisiones explícitas registradas por usuarios autorizados.',
    loading: 'Cargando elegibilidad…', unavailable: 'No se pudo cargar la elegibilidad.', retry: 'Intentar de nuevo',
    empty: 'Todavía no hay decisiones registradas.', assignmentType: 'Tipo de asignación', enabled: 'Elegible', disabled: 'No elegible',
    decision: 'Nueva decisión', cancel: 'Cerrar', save: 'Registrar decisión', saving: 'Guardando…', updated: 'Decisión actualizada.',
  },
} as const;

export function EligibilityDialog({
  personId,
  personName,
  locale,
  open,
  onClose,
}: {
  personId: string;
  personName: string;
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const text = copy[locale];
  const [decisions, setDecisions] = useState<readonly EligibilityDecisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assignmentTypeId, setAssignmentTypeId] = useState('');
  const [enabled, setEnabled] = useState(true);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setDecisions(await eligibilityApi.list(personId, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [open, personId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = assignmentTypeId.trim();
    if (!normalized) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const decision = await eligibilityApi.set(personId, { assignmentTypeId: normalized, enabled });
      setDecisions(current => {
        const next = current.filter(item => item.assignmentTypeId !== decision.assignmentTypeId);
        return [...next, decision].sort((a, b) => a.assignmentTypeId.localeCompare(b.assignmentTypeId));
      });
      setAssignmentTypeId('');
      setEnabled(true);
      setNotice(text.updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm" aria-labelledby="eligibility-dialog-title">
      <DialogTitle id="eligibility-dialog-title">{text.title} — {personName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">{text.subtitle}</Typography>
          {error ? <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>}>{error}</Alert> : null}
          {notice ? <Alert severity="success">{notice}</Alert> : null}

          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" role="status" sx={{ py: 3 }}>
              <CircularProgress size={22} /><Typography color="text.secondary">{text.loading}</Typography>
            </Stack>
          ) : decisions.length === 0 ? (
            <Typography color="text.secondary">{text.empty}</Typography>
          ) : (
            <Stack spacing={1} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {decisions.map(decision => (
                <Stack component="li" key={decision.assignmentTypeId} direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>{decision.assignmentTypeId}</Typography>
                  <Chip size="small" variant="outlined" color={decision.enabled ? 'primary' : 'default'} label={decision.enabled ? text.enabled : text.disabled} />
                </Stack>
              ))}
            </Stack>
          )}

          <Stack component="form" id="eligibility-decision-form" onSubmit={submit} spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="subtitle2" fontWeight={800}>{text.decision}</Typography>
            <TextField
              label={text.assignmentType}
              value={assignmentTypeId}
              onChange={event => setAssignmentTypeId(event.target.value)}
              required
              slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'off' } }}
            />
            <FormControlLabel
              control={<Switch checked={enabled} onChange={event => setEnabled(event.target.checked)} />}
              label={enabled ? text.enabled : text.disabled}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{text.cancel}</Button>
        <Button type="submit" form="eligibility-decision-form" variant="contained" disabled={saving || !assignmentTypeId.trim()}>
          {saving ? text.saving : text.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
