import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { availabilityApi, type AvailabilityApi, type AvailabilityReasonCode } from './lib/availabilityApi';
import { Stack, Typography } from './ui/MuiCompat';

const labels: Record<Locale, Record<AvailabilityReasonCode, string>> = {
  'pt-PT': { away: 'Ausente', unavailable: 'Indisponível', other: 'Outro' },
  en: { away: 'Away', unavailable: 'Unavailable', other: 'Other' },
  es: { away: 'Ausente', unavailable: 'No disponible', other: 'Otro' },
};

const copy = {
  'pt-PT': { title: 'Períodos de ausência', add: 'Adicionar ausência', start: 'Início', end: 'Fim', day: 'Dia', month: 'Mês', year: 'Ano', reason: 'Motivo', remove: 'Remover', empty: 'Ainda não existem períodos de ausência.', loading: 'A carregar períodos de ausência…', error: 'Não foi possível carregar os períodos. Tenta novamente.', saveError: 'Não foi possível guardar o período. Tenta novamente.', removeError: 'Não foi possível remover o período. Tenta novamente.', range: 'O fim deve ser posterior ao início.', retry: 'Tentar novamente', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirmTitle: 'Remover período de ausência?', confirmBody: 'Esta ação remove este período do perfil da pessoa.', confirm: 'Sim, remover', removing: 'A remover…', success: 'Período de ausência adicionado.', removed: 'Período de ausência removido.', discardTitle: 'Descartar alterações?', discardBody: 'O período de ausência não guardado será perdido.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Away periods', add: 'Add absence', start: 'Start', end: 'End', day: 'Day', month: 'Month', year: 'Year', reason: 'Reason', remove: 'Remove', empty: 'There are no away periods yet.', loading: 'Loading away periods…', error: 'Away periods could not be loaded. Please try again.', saveError: 'The period could not be saved. Please try again.', removeError: 'The period could not be removed. Please try again.', range: 'End must be after start.', retry: 'Try again', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirmTitle: 'Remove away period?', confirmBody: 'This action removes this period from the person profile.', confirm: 'Yes, remove', removing: 'Removing…', success: 'Away period added.', removed: 'Away period removed.', discardTitle: 'Discard changes?', discardBody: 'The unsaved away period will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Períodos de ausencia', add: 'Agregar ausencia', start: 'Inicio', end: 'Fin', day: 'Día', month: 'Mes', year: 'Año', reason: 'Motivo', remove: 'Eliminar', empty: 'Todavía no hay períodos de ausencia.', loading: 'Cargando períodos de ausencia…', error: 'No se pudieron cargar los períodos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el período. Inténtalo de nuevo.', removeError: 'No se pudo eliminar el período. Inténtalo de nuevo.', range: 'El fin debe ser posterior al inicio.', retry: 'Intentar de nuevo', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirmTitle: '¿Eliminar período de ausencia?', confirmBody: 'Esta acción elimina este período del perfil de la persona.', confirm: 'Sí, eliminar', removing: 'Eliminando…', success: 'Período de ausencia añadido.', removed: 'Período de ausencia eliminado.', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderá el período de ausencia no guardado.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

type DateDraft = Readonly<{ day: string; month: string; year: string }>;
const emptyDateDraft: DateDraft = Object.freeze({ day: '', month: '', year: '' });

export function dateDraftToIso(draft: DateDraft): string {
  if (!/^\d{1,2}$/.test(draft.day) || !/^\d{1,2}$/.test(draft.month) || !/^\d{4}$/.test(draft.year)) return '';
  const day = Number(draft.day); const month = Number(draft.month); const year = Number(draft.year);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function draftHasValue(draft: DateDraft): boolean { return Boolean(draft.day || draft.month || draft.year); }
function daysInMonth(year: string, month: string): number {
  const parsedYear = Number(year); const parsedMonth = Number(month);
  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return 31;
  return new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
}

function DatePartsFields({ label, locale, value, onChange }: { label: string; locale: Locale; value: DateDraft; onChange: (next: DateDraft) => void }) {
  const text = copy[locale];
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 16 }, (_, index) => currentYear - 10 + index);
  const maxDay = daysInMonth(value.year, value.month);
  const update = (patch: Partial<DateDraft>) => {
    const next = { ...value, ...patch };
    const nextMaxDay = daysInMonth(next.year, next.month);
    if (next.day && Number(next.day) > nextMaxDay) next.day = '';
    onChange(Object.freeze(next));
  };
  return <Stack spacing={1}>
    <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
      <TextField select label={text.day} value={value.day} onChange={event => update({ day: event.target.value })} required>
        {Array.from({ length: maxDay }, (_, index) => String(index + 1)).map(day => <MenuItem key={day} value={day}>{day}</MenuItem>)}
      </TextField>
      <TextField select label={text.month} value={value.month} onChange={event => update({ month: event.target.value })} required>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(month => <MenuItem key={month} value={month}>{month.padStart(2, '0')}</MenuItem>)}
      </TextField>
      <TextField select label={text.year} value={value.year} onChange={event => update({ year: event.target.value })} required>
        {years.map(year => <MenuItem key={year} value={String(year)}>{year}</MenuItem>)}
      </TextField>
    </Box>
  </Stack>;
}

export function isValidAwayPeriodRange(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt); const end = Date.parse(endsAt);
  return Boolean(startsAt && endsAt && Number.isFinite(start) && Number.isFinite(end) && end > start);
}

export function hasUnsavedAwayPeriodDraft(start: string, end: string, reason: AvailabilityReasonCode | ''): boolean { return Boolean(start || end || reason); }

export function formatAwayPeriodDate(value: string, locale: Locale): string {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(milliseconds)) : value;
}

export function AwayPeriodsSection({ locale, personId, api = availabilityApi }: { locale: Locale; personId: string; api?: AvailabilityApi }) {
  const text = copy[locale];
  const [periods, setPeriods] = useState<Awaited<ReturnType<AvailabilityApi['list']>>>([]);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'remove' | null>(null); const [notice, setNotice] = useState<'added' | 'removed' | null>(null);
  const [open, setOpen] = useState(false); const [discardOpen, setDiscardOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null); const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState<DateDraft>(emptyDateDraft); const [endDraft, setEndDraft] = useState<DateDraft>(emptyDateDraft);
  const [reason, setReason] = useState<AvailabilityReasonCode | ''>('');
  const addButtonRef = useRef<HTMLButtonElement | null>(null); const removeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savingRef = useRef(false); const removingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setPeriods(await api.list(personId, signal)); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [api, personId]);

  const sorted = useMemo(() => [...periods].sort((first, second) => first.startsAt.localeCompare(second.startsAt)), [periods]);
  const start = dateDraftToIso(startDraft); const end = dateDraftToIso(endDraft);
  const rangeError = Boolean(start && end && !isValidAwayPeriodRange(start, end));
  const confirmingPeriod = sorted.find(period => period.id === confirmingId) ?? null;
  const resetForm = () => { setStartDraft(emptyDateDraft); setEndDraft(emptyDateDraft); setReason(''); setOperationError(null); };
  const closeCreate = () => {
    if (saving) return;
    if (draftHasValue(startDraft) || draftHasValue(endDraft) || reason) { setDiscardOpen(true); return; }
    setOpen(false); resetForm(); window.requestAnimationFrame(() => addButtonRef.current?.focus());
  };
  const discardCreate = () => { setDiscardOpen(false); setOpen(false); resetForm(); window.requestAnimationFrame(() => addButtonRef.current?.focus()); };
  const closeRemoveConfirmation = () => { if (removingId) return; setConfirmingId(null); window.requestAnimationFrame(() => removeTriggerRef.current?.focus()); };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !start || !end || !isValidAwayPeriodRange(start, end)) return;
    savingRef.current = true; setSaving(true); setOperationError(null); setNotice(null);
    try {
      const created = await api.add(personId, { startsAt: start, endsAt: end, ...(reason ? { reasonCode: reason } : {}) });
      setPeriods(current => [...current, created]); setOpen(false); setDiscardOpen(false); resetForm(); setNotice('added');
      window.requestAnimationFrame(() => addButtonRef.current?.focus());
    } catch { setOperationError('save'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const remove = async () => {
    if (!confirmingPeriod || removingRef.current) return;
    removingRef.current = true; setRemovingId(confirmingPeriod.id); setOperationError(null); setNotice(null);
    try {
      await api.remove(personId, confirmingPeriod.id);
      setPeriods(current => current.filter(period => period.id !== confirmingPeriod.id)); setConfirmingId(null); setNotice('removed');
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    } catch { setConfirmingId(null); setOperationError('remove'); window.requestAnimationFrame(() => removeTriggerRef.current?.focus()); }
    finally { removingRef.current = false; setRemovingId(null); }
  };

  return <Box component="section" aria-labelledby="away-periods-title">
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.25} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
      <Box><Typography variant="h6" id="away-periods-title" fontWeight={700}>{text.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{sorted.length}</Typography></Box>
      <Button ref={addButtonRef} variant="outlined" onClick={() => { resetForm(); setNotice(null); setDiscardOpen(false); setOpen(true); }}>{text.add}</Button>
    </Stack>
    {notice ? <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{notice === 'added' ? text.success : text.removed}</Alert> : null}
    {operationError ? <Alert severity="error" sx={{ mb: 2 }}>{operationError === 'save' ? text.saveError : text.removeError}</Alert> : null}
    {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} sx={{ mb: 2 }}>{text.error}</Alert> : null}
    {loading ? <Box role="status" aria-live="polite" sx={{ py: 2 }}><LinearProgress aria-label={text.loading} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{text.loading}</Typography></Box> : null}
    {!loading && !loadError && sorted.length === 0 ? <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center', borderRadius: 2.5, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : null}
    {!loading && !loadError && sorted.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>{sorted.map(period => <Card component="article" key={period.id}><CardContent><Stack spacing={1.25}>
      <Box><Typography fontWeight={700}>{formatAwayPeriodDate(period.startsAt, locale)}</Typography><Typography color="text.secondary">{formatAwayPeriodDate(period.endsAt, locale)}</Typography></Box>
      {period.reasonCode ? <Chip label={labels[locale][period.reasonCode]} size="small" sx={{ alignSelf: 'flex-start' }} /> : null}
      <Button ref={confirmingId === period.id ? removeTriggerRef : undefined} size="small" color="error" variant="outlined" disabled={removingId !== null} sx={{ alignSelf: 'flex-start' }} onClick={event => { removeTriggerRef.current = event.currentTarget; setOperationError(null); setConfirmingId(period.id); }}>{text.remove}</Button>
    </Stack></CardContent></Card>)}</Box> : null}

    <Dialog open={open} onClose={(_event, closeReason) => { if (closeReason === 'backdropClick') return; closeCreate(); }} fullWidth maxWidth="sm" aria-describedby="away-period-form-error">
      <Box component="form" onSubmit={add}><DialogTitle>{text.add}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <DatePartsFields label={text.start} locale={locale} value={startDraft} onChange={setStartDraft} />
        <DatePartsFields label={text.end} locale={locale} value={endDraft} onChange={setEndDraft} />
        {rangeError ? <Alert severity="warning">{text.range}</Alert> : null}
        <FormControl><InputLabel>{text.reason}</InputLabel><Select value={reason} label={text.reason} onChange={event => setReason(event.target.value as AvailabilityReasonCode | '')}><MenuItem value=""><em>—</em></MenuItem>{(['away', 'unavailable', 'other'] as const).map(code => <MenuItem key={code} value={code}>{labels[locale][code]}</MenuItem>)}</Select></FormControl>
        {operationError === 'save' ? <Alert id="away-period-form-error" severity="error">{text.saveError}</Alert> : null}
      </Stack></DialogContent><DialogActions><Button onClick={closeCreate} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={saving || !start || !end || rangeError}>{saving ? text.saving : text.save}</Button></DialogActions></Box>
    </Dialog>
    <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)} aria-labelledby="away-discard-title" aria-describedby="away-discard-description"><DialogTitle id="away-discard-title">{text.discardTitle}</DialogTitle><DialogContent><Typography id="away-discard-description">{text.discardBody}</Typography></DialogContent><DialogActions><Button autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button><Button color="warning" variant="contained" onClick={discardCreate}>{text.discard}</Button></DialogActions></Dialog>
    <Dialog open={confirmingPeriod !== null} onClose={closeRemoveConfirmation} fullWidth maxWidth="xs" aria-describedby="away-remove-description"><DialogTitle>{text.confirmTitle}</DialogTitle><DialogContent><Typography id="away-remove-description">{text.confirmBody}</Typography>{confirmingPeriod ? <Typography sx={{ mt: 1 }} fontWeight={700}>{formatAwayPeriodDate(confirmingPeriod.startsAt, locale)} — {formatAwayPeriodDate(confirmingPeriod.endsAt, locale)}</Typography> : null}</DialogContent><DialogActions><Button disabled={removingId !== null} onClick={closeRemoveConfirmation}>{text.cancel}</Button><Button color="error" variant="contained" disabled={removingId !== null} onClick={() => void remove()}>{removingId ? text.removing : text.confirm}</Button></DialogActions></Dialog>
  </Box>;
}
