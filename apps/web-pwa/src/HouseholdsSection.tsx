import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { householdsApi, type HouseholdDto, type HouseholdsApi } from './lib/householdsApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { title: 'Agregados familiares', subtitle: 'Agrupa pessoas da mesma família sem duplicar informação de perfis.', create: 'Criar agregado', name: 'Nome do agregado', members: 'IDs dos membros', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirm: 'Eliminar agregado?', confirmBody: 'Esta ação remove o agregado, mas não elimina os perfis das pessoas.', removing: 'A eliminar…', empty: 'Ainda não existem agregados familiares.', loading: 'A carregar agregados…', error: 'Não foi possível carregar os agregados. Tenta novamente.', saveError: 'Não foi possível guardar o agregado. Tenta novamente.', deleteError: 'Não foi possível eliminar o agregado. Tenta novamente.', retry: 'Tentar novamente', hint: 'Separa IDs por vírgulas. Apenas IDs já fornecidos pela API são guardados.', member: 'membro', membersCount: 'membros', successCreate: 'Agregado criado com sucesso.', successUpdate: 'Agregado atualizado com sucesso.', successDelete: 'Agregado eliminado com sucesso.', actions: 'Ações do agregado', close: 'Fechar', discardTitle: 'Descartar alterações?', discardBody: 'As alterações não guardadas a este agregado serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Households', subtitle: 'Group people from the same family without duplicating profile information.', create: 'Create household', name: 'Household name', members: 'Member IDs', edit: 'Edit', delete: 'Delete', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirm: 'Delete household?', confirmBody: 'This removes the household but does not delete any people profiles.', removing: 'Deleting…', empty: 'There are no households yet.', loading: 'Loading households…', error: 'Households could not be loaded. Please try again.', saveError: 'The household could not be saved. Please try again.', deleteError: 'The household could not be deleted. Please try again.', retry: 'Try again', hint: 'Separate IDs with commas. Only IDs already provided by the API are saved.', member: 'member', membersCount: 'members', successCreate: 'Household created successfully.', successUpdate: 'Household updated successfully.', successDelete: 'Household deleted successfully.', actions: 'Household actions', close: 'Close', discardTitle: 'Discard changes?', discardBody: 'Unsaved changes to this household will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Grupos familiares', subtitle: 'Agrupa personas de la misma familia sin duplicar información de perfiles.', create: 'Crear grupo', name: 'Nombre del grupo', members: 'IDs de miembros', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirm: '¿Eliminar grupo familiar?', confirmBody: 'Esta acción elimina el grupo, pero no elimina los perfiles de las personas.', removing: 'Eliminando…', empty: 'Todavía no hay grupos familiares.', loading: 'Cargando grupos familiares…', error: 'No se pudieron cargar los grupos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el grupo. Inténtalo de nuevo.', deleteError: 'No se pudo eliminar el grupo. Inténtalo de nuevo.', retry: 'Intentar de nuevo', hint: 'Separa los IDs con comas. Solo se guardan IDs ya proporcionados por la API.', member: 'miembro', membersCount: 'miembros', successCreate: 'Grupo creado correctamente.', successUpdate: 'Grupo actualizado correctamente.', successDelete: 'Grupo eliminado correctamente.', actions: 'Acciones del grupo', close: 'Cerrar', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderán los cambios no guardados de este grupo familiar.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

export function parseMemberIds(value: string): string[] {
  return [...new Set(value.split(',').map(memberId => memberId.trim()).filter(Boolean))];
}

export function canSubmitHousehold(name: string, saving: boolean): boolean {
  return !saving && name.trim().length > 0;
}

export function hasUnsavedHouseholdDraft(name: string, members: string, editing: Pick<HouseholdDto, 'name' | 'memberIds'> | null): boolean {
  const normalizedName = name.trim();
  const normalizedMembers = parseMemberIds(members);
  if (!editing) return normalizedName.length > 0 || normalizedMembers.length > 0;
  return normalizedName !== editing.name || normalizedMembers.join('\u0000') !== editing.memberIds.join('\u0000');
}

export function HouseholdsSection({ locale, api = householdsApi }: { locale: Locale; api?: HouseholdsApi }) {
  const text = copy[locale];
  const [items, setItems] = useState<readonly HouseholdDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'delete' | null>(null);
  const [notice, setNotice] = useState<'create' | 'update' | 'delete' | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HouseholdDto | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setItems(await api.list(signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [api]);

  const sorted = useMemo(() => [...items].sort((first, second) => first.name.localeCompare(second.name, locale)), [items, locale]);
  const deletingHousehold = sorted.find(item => item.id === deleteId) ?? null;
  const restoreEditorTrigger = (wasEditing: boolean) => window.requestAnimationFrame(() => (wasEditing ? actionTriggerRef.current : createButtonRef.current)?.focus());
  const closeEditor = () => {
    if (saving) return;
    if (hasUnsavedHouseholdDraft(name, members, editing)) {
      setDiscardOpen(true);
      return;
    }
    const wasEditing = editing !== null;
    setOpen(false);
    setOperationError(null);
    restoreEditorTrigger(wasEditing);
  };
  const discardEditor = () => {
    const wasEditing = editing !== null;
    setDiscardOpen(false);
    setOpen(false);
    setEditing(null);
    setName('');
    setMembers('');
    setOperationError(null);
    restoreEditorTrigger(wasEditing);
  };
  const closeDelete = () => {
    if (deleting) return;
    setDeleteId(null);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
  };
  const begin = (item?: HouseholdDto, trigger?: HTMLButtonElement) => {
    if (trigger) actionTriggerRef.current = trigger;
    setNotice(null);
    setOperationError(null);
    setDiscardOpen(false);
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setMembers(item?.memberIds.join(', ') ?? '');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitHousehold(name, saving) || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setOperationError(null);
    setNotice(null);
    const householdName = name.trim();
    const memberIds = parseMemberIds(members);
    try {
      const saved = editing ? await api.update(editing.id, { name: householdName, memberIds }) : await api.create({ name: householdName, memberIds });
      setItems(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      const wasEditing = editing !== null;
      setOpen(false);
      setDiscardOpen(false);
      setEditing(null);
      setName('');
      setMembers('');
      setNotice(wasEditing ? 'update' : 'create');
      window.requestAnimationFrame(() => (wasEditing ? actionTriggerRef.current : createButtonRef.current)?.focus());
    } catch {
      setOperationError('save');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deletingHousehold || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setOperationError(null);
    setNotice(null);
    try {
      await api.delete(deletingHousehold.id);
      setItems(current => current.filter(item => item.id !== deletingHousehold.id));
      setDeleteId(null);
      setNotice('delete');
      window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
    } catch {
      setOperationError('delete');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const noticeText = notice === 'create' ? text.successCreate : notice === 'update' ? text.successUpdate : text.successDelete;
  return <Box component="section" aria-labelledby="households-title">
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}><Box sx={{ maxWidth: 720 }}><Typography variant="overline" color="primary.main">{text.title}</Typography><Typography variant="h2" id="households-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.subtitle}</Typography></Box><Button ref={createButtonRef} variant="contained" onClick={() => begin()}>{text.create}</Button></Stack></Paper>
    {notice ? <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{noticeText}</Alert> : null}
    {operationError ? <Alert severity="error" sx={{ mb: 2 }}>{operationError === 'save' ? text.saveError : text.deleteError}</Alert> : null}
    {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} sx={{ mb: 2 }}>{text.error}</Alert> : null}
    {loading ? <Box role="status" aria-live="polite" sx={{ py: 2 }}><LinearProgress aria-label={text.loading} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{text.loading}</Typography></Box> : null}
    {!loading && !loadError && sorted.length === 0 ? <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2.5, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : null}
    {!loading && !loadError && sorted.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mt: 2 }}>{sorted.map(item => <Card component="article" key={item.id}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start"><Typography variant="h6" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography><Chip label={`${item.memberIds.length} ${item.memberIds.length === 1 ? text.member : text.membersCount}`} size="small" variant="outlined" /></Stack><Divider />{item.memberIds.length > 0 ? <Stack direction="row" flexWrap="wrap" gap={0.5} useFlexGap aria-label={text.members}>{item.memberIds.slice(0, 4).map(memberId => <Chip key={memberId} label={memberId} size="small" variant="outlined" />)}{item.memberIds.length > 4 ? <Chip label={`+${item.memberIds.length - 4}`} size="small" /> : null}</Stack> : <Typography variant="body2" color="text.secondary">{text.empty}</Typography>}<Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} aria-label={`${text.actions} — ${item.name}`}><Button size="small" variant="outlined" onClick={event => begin(item, event.currentTarget)}>{text.edit}</Button><Button size="small" color="error" variant="outlined" disabled={deleting} onClick={event => { actionTriggerRef.current = event.currentTarget; setOperationError(null); setDeleteId(item.id); }}>{text.delete}</Button></Stack></Stack></CardContent></Card>)}</Box> : null}
    <Dialog open={open} onClose={closeEditor} fullWidth maxWidth="sm" aria-describedby="household-form-error"><Box component="form" onSubmit={submit}><DialogTitle>{editing ? text.edit : text.create}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={text.name} value={name} onChange={event => setName(event.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 120 } }} /><TextField label={text.members} value={members} onChange={event => setMembers(event.target.value)} helperText={text.hint} multiline minRows={2} />{operationError === 'save' ? <Alert id="household-form-error" severity="error">{text.saveError}</Alert> : null}</Stack></DialogContent><DialogActions><Button onClick={closeEditor} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={!canSubmitHousehold(name, saving)}>{saving ? text.saving : text.save}</Button></DialogActions></Box></Dialog>
    <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)} aria-labelledby="household-discard-title" aria-describedby="household-discard-description"><DialogTitle id="household-discard-title">{text.discardTitle}</DialogTitle><DialogContent><Typography id="household-discard-description">{text.discardBody}</Typography></DialogContent><DialogActions><Button autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button><Button color="warning" variant="contained" onClick={discardEditor}>{text.discard}</Button></DialogActions></Dialog>
    <Dialog open={deletingHousehold !== null} onClose={closeDelete} fullWidth maxWidth="xs" aria-describedby="household-delete-description"><DialogTitle>{text.confirm}</DialogTitle><DialogContent><Typography id="household-delete-description">{text.confirmBody}</Typography>{deletingHousehold ? <Typography sx={{ mt: 1 }} fontWeight={700}>{deletingHousehold.name}</Typography> : null}</DialogContent><DialogActions><Button disabled={deleting} onClick={closeDelete}>{text.cancel}</Button><Button color="error" variant="contained" disabled={deleting} onClick={() => void remove()}>{deleting ? text.removing : text.delete}</Button></DialogActions></Dialog>
  </Box>;
}
