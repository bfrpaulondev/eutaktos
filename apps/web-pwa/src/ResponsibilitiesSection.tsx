import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { responsibilitiesApi, type ResponsibilityDto, type ResponsibilitiesApi } from './lib/responsibilitiesApi';
import { Stack, Typography } from './ui/MuiCompat';

type ResponsibilityStatus = 'active' | 'ended';

const copy = {
  'pt-PT': { title: 'Responsabilidades', subtitle: 'Consulta atribuições existentes sem inferir elegibilidade ou recomendar pessoas.', create: 'Atribuir responsabilidade', person: 'ID da pessoa', key: 'Chave da responsabilidade', start: 'Início', end: 'Fim opcional', finish: 'Terminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', empty: 'Ainda não existem responsabilidades atribuídas.', loading: 'A carregar responsabilidades…', error: 'Não foi possível carregar as responsabilidades. Tenta novamente.', saveError: 'Não foi possível guardar a responsabilidade. Tenta novamente.', finishError: 'Não foi possível terminar a responsabilidade. Tenta novamente.', retry: 'Tentar novamente', active: 'Ativa', ended: 'Terminada', scheduledEnd: 'Termina em', started: 'Iniciada em', hint: 'Ex.: som, literatura, tarefa-local', range: 'O fim deve ser posterior ao início.', confirmTitle: 'Terminar responsabilidade?', confirmBody: 'Esta ação fecha a responsabilidade na data de hoje. Confirma apenas se esta decisão administrativa está correta.', confirm: 'Sim, terminar', finishing: 'A terminar…', successAssign: 'Responsabilidade atribuída com sucesso.', successFinish: 'Responsabilidade terminada com sucesso.', actions: 'Ações da responsabilidade', discardTitle: 'Descartar alterações?', discardBody: 'A atribuição não guardada será perdida.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Responsibilities', subtitle: 'Review existing assignments without inferring eligibility or recommending people.', create: 'Assign responsibility', person: 'Person ID', key: 'Responsibility key', start: 'Start', end: 'Optional end', finish: 'End', save: 'Save', saving: 'Saving…', cancel: 'Cancel', empty: 'There are no responsibilities assigned yet.', loading: 'Loading responsibilities…', error: 'Responsibilities could not be loaded. Please try again.', saveError: 'The responsibility could not be saved. Please try again.', finishError: 'The responsibility could not be ended. Please try again.', retry: 'Try again', active: 'Active', ended: 'Ended', scheduledEnd: 'Ends on', started: 'Started on', hint: 'E.g. sound, literature, local-duty', range: 'End must be after start.', confirmTitle: 'End responsibility?', confirmBody: 'This closes the responsibility on today’s date. Confirm only if this administrative decision is correct.', confirm: 'Yes, end', finishing: 'Ending…', successAssign: 'Responsibility assigned successfully.', successFinish: 'Responsibility ended successfully.', actions: 'Responsibility actions', discardTitle: 'Discard changes?', discardBody: 'The unsaved assignment will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Responsabilidades', subtitle: 'Consulta asignaciones existentes sin inferir elegibilidad ni recomendar personas.', create: 'Asignar responsabilidad', person: 'ID de persona', key: 'Clave de responsabilidad', start: 'Inicio', end: 'Fin opcional', finish: 'Terminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', empty: 'Todavía no hay responsabilidades asignadas.', loading: 'Cargando responsabilidades…', error: 'No se pudieron cargar las responsabilidades. Inténtalo de nuevo.', saveError: 'No se pudo guardar la responsabilidad. Inténtalo de nuevo.', finishError: 'No se pudo terminar la responsabilidad. Inténtalo de nuevo.', retry: 'Intentar de nuevo', active: 'Activa', ended: 'Terminada', scheduledEnd: 'Termina el', started: 'Iniciada el', hint: 'Ej.: sonido, literatura, tarea-local', range: 'El fin debe ser posterior al inicio.', confirmTitle: '¿Terminar responsabilidad?', confirmBody: 'Esta acción cierra la responsabilidad en la fecha de hoy. Confirma solo si esta decisión administrativa es correcta.', confirm: 'Sí, terminar', finishing: 'Terminando…', successAssign: 'Responsabilidad asignada correctamente.', successFinish: 'Responsabilidad terminada correctamente.', actions: 'Acciones de la responsabilidad', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderá la asignación no guardada.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

export function localDate(date = new Date()): string { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
export function isValidResponsibilityRange(startsAt: string, endsAt: string): boolean { if (!endsAt) return Boolean(startsAt); const start = Date.parse(startsAt); const end = Date.parse(endsAt); return Boolean(startsAt && Number.isFinite(start) && Number.isFinite(end) && end > start); }
export function getResponsibilityStatus(item: Pick<ResponsibilityDto, 'endsAt'>, now = Date.now()): ResponsibilityStatus { return item.endsAt && Date.parse(item.endsAt) <= now ? 'ended' : 'active'; }
export function hasUnsavedResponsibilityDraft(personId: string, key: string, start: string, end: string, initialStart: string): boolean { return personId.trim().length > 0 || key.trim().length > 0 || start !== initialStart || end.length > 0; }
export function formatResponsibilityDate(value: string, locale: Locale): string { const milliseconds = Date.parse(value); return Number.isFinite(milliseconds) ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(milliseconds)) : value; }

export function ResponsibilitiesSection({ locale, api = responsibilitiesApi }: { locale: Locale; api?: ResponsibilitiesApi }) {
  const text = copy[locale];
  const [items, setItems] = useState<readonly ResponsibilityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'finish' | null>(null);
  const [notice, setNotice] = useState<'assign' | 'finish' | null>(null);
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [personId, setPersonId] = useState('');
  const [key, setKey] = useState('');
  const [start, setStart] = useState(localDate());
  const [initialStart, setInitialStart] = useState(start);
  const [end, setEnd] = useState('');
  const [finishId, setFinishId] = useState<string | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const finishTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savingRef = useRef(false);
  const finishingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setItems(await api.list(signal)); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [api]);

  const sorted = useMemo(() => [...items].sort((first, second) => second.startsAt.localeCompare(first.startsAt)), [items]);
  const finishingItem = sorted.find(item => item.id === finishId) ?? null;
  const rangeError = Boolean(end && !isValidResponsibilityRange(start, end));
  const resetCreate = () => {
    const today = localDate();
    setPersonId(''); setKey(''); setStart(today); setInitialStart(today); setEnd(''); setOperationError(null);
  };
  const closeCreate = () => {
    if (saving) return;
    if (hasUnsavedResponsibilityDraft(personId, key, start, end, initialStart)) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false); setOperationError(null); window.requestAnimationFrame(() => createButtonRef.current?.focus());
  };
  const discardCreate = () => {
    setDiscardOpen(false); setOpen(false); resetCreate();
    window.requestAnimationFrame(() => createButtonRef.current?.focus());
  };
  const closeFinish = () => {
    if (finishing) return;
    setFinishId(null);
    window.requestAnimationFrame(() => finishTriggerRef.current?.focus());
  };
  const beginCreate = () => {
    resetCreate(); setNotice(null); setDiscardOpen(false); setOpen(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !personId.trim() || !key.trim() || !isValidResponsibilityRange(start, end)) return;
    savingRef.current = true; setSaving(true); setOperationError(null); setNotice(null);
    try {
      const created = await api.assign({ personId: personId.trim(), responsibilityKey: key.trim(), startsAt: start, ...(end ? { endsAt: end } : {}) });
      setItems(current => [...current, created].sort((first, second) => second.startsAt.localeCompare(first.startsAt)));
      setOpen(false); setDiscardOpen(false); resetCreate(); setNotice('assign');
      window.requestAnimationFrame(() => createButtonRef.current?.focus());
    } catch { setOperationError('save'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const finish = async () => {
    if (!finishingItem || finishingRef.current) return;
    finishingRef.current = true; setFinishing(true); setOperationError(null); setNotice(null);
    try {
      const updated = await api.end(finishingItem.id, { endsAt: localDate() });
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); setFinishId(null); setNotice('finish');
      window.requestAnimationFrame(() => finishTriggerRef.current?.focus());
    } catch { setOperationError('finish'); }
    finally { finishingRef.current = false; setFinishing(false); }
  };
  const noticeText = notice === 'assign' ? text.successAssign : text.successFinish;

  return <Box component="section" aria-labelledby="responsibilities-title">
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}><Box sx={{ maxWidth: 720 }}><Typography variant="overline" color="primary.main">{text.title}</Typography><Typography variant="h2" id="responsibilities-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.subtitle}</Typography></Box><Button ref={createButtonRef} variant="contained" onClick={beginCreate}>{text.create}</Button></Stack></Paper>
    {notice ? <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{noticeText}</Alert> : null}
    {operationError ? <Alert severity="error" sx={{ mb: 2 }}>{operationError === 'save' ? text.saveError : text.finishError}</Alert> : null}
    {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} sx={{ mb: 2 }}>{text.error}</Alert> : null}
    {loading ? <Box role="status" aria-live="polite" sx={{ py: 2 }}><LinearProgress aria-label={text.loading} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{text.loading}</Typography></Box> : null}
    {!loading && !loadError && sorted.length === 0 ? <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2.5, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : null}
    {!loading && !loadError && sorted.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mt: 2 }}>{sorted.map(item => { const status = getResponsibilityStatus(item); return <Card component="article" key={item.id}><CardContent><Stack spacing={1.25}><Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start"><Typography variant="h6" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.responsibilityKey}</Typography><Chip size="small" label={status === 'active' ? text.active : text.ended} color={status === 'active' ? 'success' : 'default'} variant="outlined" /></Stack><Divider /><Typography variant="body2" color="text.secondary">{text.person}: {item.personId}</Typography><Typography variant="body2" color="text.secondary">{text.started}: {formatResponsibilityDate(item.startsAt, locale)}</Typography>{item.endsAt ? <Typography variant="body2" color="text.secondary">{status === 'ended' ? text.ended : text.scheduledEnd}: {formatResponsibilityDate(item.endsAt, locale)}</Typography> : null}{status === 'active' ? <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} disabled={finishing} onClick={event => { finishTriggerRef.current = event.currentTarget; setOperationError(null); setFinishId(item.id); }}>{text.finish}</Button> : null}</Stack></CardContent></Card>; })}</Box> : null}
    <Dialog open={open} onClose={closeCreate} fullWidth maxWidth="sm" aria-describedby="responsibility-form-error"><Box component="form" onSubmit={submit}><DialogTitle>{text.create}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={text.person} value={personId} onChange={event => setPersonId(event.target.value)} required autoFocus /><TextField label={text.key} value={key} onChange={event => setKey(event.target.value)} required helperText={text.hint} /><TextField label={text.start} type="date" value={start} onChange={event => setStart(event.target.value)} required slotProps={{ inputLabel: { shrink: true } }} /><TextField label={text.end} type="date" value={end} onChange={event => setEnd(event.target.value)} error={rangeError} helperText={rangeError ? text.range : undefined} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: start } }} />{operationError === 'save' ? <Alert id="responsibility-form-error" severity="error">{text.saveError}</Alert> : null}</Stack></DialogContent><DialogActions><Button onClick={closeCreate} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={saving || !personId.trim() || !key.trim() || rangeError}>{saving ? text.saving : text.save}</Button></DialogActions></Box></Dialog>
    <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)} aria-labelledby="responsibility-discard-title" aria-describedby="responsibility-discard-description"><DialogTitle id="responsibility-discard-title">{text.discardTitle}</DialogTitle><DialogContent><Typography id="responsibility-discard-description">{text.discardBody}</Typography></DialogContent><DialogActions><Button autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button><Button color="warning" variant="contained" onClick={discardCreate}>{text.discard}</Button></DialogActions></Dialog>
    <Dialog open={finishingItem !== null} onClose={closeFinish} fullWidth maxWidth="xs" aria-describedby="responsibility-finish-description"><DialogTitle>{text.confirmTitle}</DialogTitle><DialogContent><Typography id="responsibility-finish-description">{text.confirmBody}</Typography>{finishingItem ? <Typography sx={{ mt: 1 }} fontWeight={700}>{finishingItem.responsibilityKey}</Typography> : null}</DialogContent><DialogActions><Button disabled={finishing} onClick={closeFinish}>{text.cancel}</Button><Button variant="contained" disabled={finishing} onClick={() => void finish()}>{finishing ? text.finishing : text.confirm}</Button></DialogActions></Dialog>
  </Box>;
}
