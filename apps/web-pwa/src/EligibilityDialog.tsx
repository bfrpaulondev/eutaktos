import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, MenuItem, Paper, Switch, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { eligibilityApi, type EligibilityDecisionDto } from './lib/eligibilityApi';
import {
  assignmentTypeLabel,
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  ELIGIBILITY_ASSIGNMENT_TYPES,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { title: 'Elegibilidade de atribuições', subtitle: 'Estas são decisões administrativas explícitas registadas por utilizadores autorizados. A interface não recomenda nem infere adequação.', loading: 'A carregar elegibilidade…', unavailable: 'Não foi possível carregar a elegibilidade. Tenta novamente.', saveError: 'Não foi possível registar a decisão. Tenta novamente.', retry: 'Tentar novamente', empty: 'Ainda não existem decisões registadas.', assignmentType: 'Tipo de atribuição', chooseAssignmentType: 'Seleciona um tipo de atribuição', customAssignmentType: 'Identificador da função personalizada', customOption: 'Outra função personalizada…', enabled: 'Elegível', disabled: 'Não elegível', decision: 'Registar decisão administrativa', decisionHint: 'Seleciona uma atribuição conhecida. Usa a opção personalizada apenas para uma função específica já definida pela congregação.', cancel: 'Fechar', save: 'Continuar', saving: 'A guardar…', updated: 'Decisão atualizada.', confirmTitle: 'Confirmar decisão administrativa', confirmBody: 'Confirma que pretende registar esta decisão explícita. Esta ação não é uma recomendação nem altera outras decisões.', confirm: 'Sim, registar', status: 'Estado da decisão', current: 'Decisões atuais' },
  en: { title: 'Assignment eligibility', subtitle: 'These are explicit administrative decisions recorded by authorized users. The interface does not recommend or infer suitability.', loading: 'Loading eligibility…', unavailable: 'Eligibility could not be loaded. Please try again.', saveError: 'The decision could not be recorded. Please try again.', retry: 'Try again', empty: 'No decisions have been recorded yet.', assignmentType: 'Assignment type', chooseAssignmentType: 'Select an assignment type', customAssignmentType: 'Custom role identifier', customOption: 'Another custom role…', enabled: 'Eligible', disabled: 'Not eligible', decision: 'Record administrative decision', decisionHint: 'Select a known assignment. Use the custom option only for a specific role already defined by the congregation.', cancel: 'Close', save: 'Continue', saving: 'Saving…', updated: 'Decision updated.', confirmTitle: 'Confirm administrative decision', confirmBody: 'Confirm that you want to record this explicit decision. This is not a recommendation and does not change other decisions.', confirm: 'Yes, record', status: 'Decision status', current: 'Current decisions' },
  es: { title: 'Elegibilidad de asignaciones', subtitle: 'Estas son decisiones administrativas explícitas registradas por usuarios autorizados. La interfaz no recomienda ni infiere idoneidad.', loading: 'Cargando elegibilidad…', unavailable: 'No se pudo cargar la elegibilidad. Inténtalo de nuevo.', saveError: 'No se pudo registrar la decisión. Inténtalo de nuevo.', retry: 'Intentar de nuevo', empty: 'Todavía no hay decisiones registradas.', assignmentType: 'Tipo de asignación', chooseAssignmentType: 'Selecciona un tipo de asignación', customAssignmentType: 'Identificador de la función personalizada', customOption: 'Otra función personalizada…', enabled: 'Elegible', disabled: 'No elegible', decision: 'Registrar decisión administrativa', decisionHint: 'Selecciona una asignación conocida. Usa la opción personalizada solo para una función específica ya definida por la congregación.', cancel: 'Cerrar', save: 'Continuar', saving: 'Guardando…', updated: 'Decisión actualizada.', confirmTitle: 'Confirmar decisión administrativa', confirmBody: 'Confirma que deseas registrar esta decisión explícita. No es una recomendación ni cambia otras decisiones.', confirm: 'Sí, registrar', status: 'Estado de la decisión', current: 'Decisiones actuales' },
} as const;

export function isEligibilityDecisionSubmittable(assignmentTypeId: string, saving: boolean): boolean { return !saving && assignmentTypeId.trim().length > 0; }

export function EligibilityDialog({ personId, personName, locale, open, onClose }: { personId: string; personName: string; locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const [decisions, setDecisions] = useState<readonly EligibilityDecisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState(false);
  const [assignmentTypeChoice, setAssignmentTypeChoice] = useState('');
  const [customAssignmentTypeId, setCustomAssignmentTypeId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const savingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const assignmentTypeId = resolveAssignmentTypeChoice(assignmentTypeChoice, customAssignmentTypeId);
  const cataloguedIds = new Set(ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id));
  const existingCustomIds = [...new Set(decisions.map(decision => decision.assignmentTypeId).filter(id => !cataloguedIds.has(id)))].sort((a, b) => a.localeCompare(b));

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setDecisions(await eligibilityApi.list(personId, signal)); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { if (!open) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [open, personId]);

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!isEligibilityDecisionSubmittable(assignmentTypeId, saving)) return;
    setSaveError(false); setNotice(false); setConfirming(true);
  };
  const submit = async () => {
    if (!assignmentTypeId || savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(false); setNotice(false);
    try {
      const decision = await eligibilityApi.set(personId, { assignmentTypeId, enabled });
      setDecisions(current => [...current.filter(item => item.assignmentTypeId !== decision.assignmentTypeId), decision].sort((first, second) => first.assignmentTypeId.localeCompare(second.assignmentTypeId)));
      setAssignmentTypeChoice(''); setCustomAssignmentTypeId(''); setEnabled(true); setConfirming(false); setNotice(true);
      window.requestAnimationFrame(() => submitButtonRef.current?.focus());
    } catch { setSaveError(true); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const retry = () => void load();

  return <Dialog open={open} onClose={() => !saving && !confirming && onClose()} fullWidth maxWidth="sm" aria-labelledby="eligibility-dialog-title">
    <DialogTitle id="eligibility-dialog-title">{text.title} — {personName}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Alert severity="info">{text.subtitle}</Alert>
      {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={retry}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
      {saveError ? <Alert severity="error">{text.saveError}</Alert> : null}
      {notice ? <Alert severity="success" onClose={() => setNotice(false)}>{text.updated}</Alert> : null}
      {loading ? <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" role="status" sx={{ py: 3 }}><CircularProgress size={22} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={1}><Typography variant="subtitle2" fontWeight={800}>{text.current}</Typography>{decisions.length === 0 ? <Typography color="text.secondary">{text.empty}</Typography> : <Stack spacing={1} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>{decisions.map(decision => <Stack component="li" key={decision.assignmentTypeId} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Stack spacing={0}><Typography sx={{ overflowWrap: 'anywhere' }}>{assignmentTypeLabel(decision.assignmentTypeId, locale)}</Typography>{assignmentTypeLabel(decision.assignmentTypeId, locale) !== decision.assignmentTypeId ? <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{decision.assignmentTypeId}</Typography> : null}</Stack><Chip size="small" variant="outlined" color={decision.enabled ? 'success' : 'default'} label={decision.enabled ? text.enabled : text.disabled} /></Stack>)}</Stack>}</Stack></Paper>}
      <Stack component="form" id="eligibility-decision-form" onSubmit={requestConfirmation} spacing={1.5} sx={{ pt: 1 }}><Divider /><Typography variant="subtitle2" fontWeight={800}>{text.decision}</Typography><Typography variant="body2" color="text.secondary">{text.decisionHint}</Typography><TextField select label={text.assignmentType} value={assignmentTypeChoice} onChange={event => { setAssignmentTypeChoice(event.target.value); setCustomAssignmentTypeId(''); }} required><MenuItem value="" disabled>{text.chooseAssignmentType}</MenuItem>{ELIGIBILITY_ASSIGNMENT_TYPES.map(option => <MenuItem key={option.id} value={option.id}>{option.label[locale]}</MenuItem>)}{existingCustomIds.map(id => <MenuItem key={id} value={id}>{id}</MenuItem>)}<MenuItem value={CUSTOM_ASSIGNMENT_TYPE_CHOICE}>{text.customOption}</MenuItem></TextField>{assignmentTypeChoice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? <TextField label={text.customAssignmentType} value={customAssignmentTypeId} onChange={event => setCustomAssignmentTypeId(event.target.value)} required slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'off' } }} /> : null}<FormControlLabel control={<Switch checked={enabled} onChange={event => setEnabled(event.target.checked)} />} label={`${text.status}: ${enabled ? text.enabled : text.disabled}`} /></Stack>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving || confirming}>{text.cancel}</Button><Button ref={submitButtonRef} type="submit" form="eligibility-decision-form" variant="contained" disabled={!isEligibilityDecisionSubmittable(assignmentTypeId, saving)}>{saving ? text.saving : text.save}</Button></DialogActions>
    <Dialog open={confirming} onClose={() => !saving && setConfirming(false)} fullWidth maxWidth="xs" aria-labelledby="eligibility-confirmation-title" aria-describedby="eligibility-confirmation-description"><DialogTitle id="eligibility-confirmation-title">{text.confirmTitle}</DialogTitle><DialogContent><Typography id="eligibility-confirmation-description">{text.confirmBody}</Typography><Paper variant="outlined" sx={{ mt: 1.5, p: 1.25, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Typography fontWeight={700}>{assignmentTypeLabel(assignmentTypeId, locale)}</Typography>{assignmentTypeLabel(assignmentTypeId, locale) !== assignmentTypeId ? <Typography variant="caption" color="text.secondary">{assignmentTypeId}</Typography> : null}<Chip sx={{ mt: 0.75 }} size="small" label={`${text.status}: ${enabled ? text.enabled : text.disabled}`} color={enabled ? 'success' : 'default'} variant="outlined" /></Paper></DialogContent><DialogActions><Button disabled={saving} onClick={() => setConfirming(false)}>{text.cancel}</Button><Button variant="contained" disabled={!isEligibilityDecisionSubmittable(assignmentTypeId, saving)} onClick={() => void submit()}>{saving ? text.saving : text.confirm}</Button></DialogActions></Dialog>
  </Dialog>;
}
