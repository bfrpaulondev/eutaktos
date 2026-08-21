import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { serviceGroupsApi, type ServiceGroupDto, type ServiceGroupsApi } from './lib/serviceGroupsApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { title: 'Grupos de serviço', subtitle: 'Consulta grupos, membros e responsáveis conforme os dados já autorizados pela API.', create: 'Criar grupo', name: 'Nome do grupo', members: 'IDs dos membros', overseer: 'ID do responsável', assistant: 'ID do ajudante', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirm: 'Eliminar grupo de serviço?', confirmBody: 'Esta ação elimina o grupo, mas não elimina pessoas nem altera outras responsabilidades.', removing: 'A eliminar…', empty: 'Ainda não existem grupos de serviço.', loading: 'A carregar grupos de serviço…', error: 'Não foi possível carregar os grupos. Tenta novamente.', saveError: 'Não foi possível guardar o grupo. Tenta novamente.', deleteError: 'Não foi possível eliminar o grupo. Tenta novamente.', retry: 'Tentar novamente', hint: 'Separa IDs por vírgulas. Apenas IDs já fornecidos pela API são guardados.', member: 'membro', membersCount: 'membros', responsible: 'Responsável', helper: 'Ajudante', successCreate: 'Grupo criado com sucesso.', successUpdate: 'Grupo atualizado com sucesso.', successDelete: 'Grupo eliminado com sucesso.', actions: 'Ações do grupo' },
  en: { title: 'Service groups', subtitle: 'Review groups, members and responsible people from data already authorized by the API.', create: 'Create group', name: 'Group name', members: 'Member IDs', overseer: 'Overseer ID', assistant: 'Assistant ID', edit: 'Edit', delete: 'Delete', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirm: 'Delete service group?', confirmBody: 'This deletes the group but does not delete people or change other responsibilities.', removing: 'Deleting…', empty: 'There are no service groups yet.', loading: 'Loading service groups…', error: 'Service groups could not be loaded. Please try again.', saveError: 'The group could not be saved. Please try again.', deleteError: 'The group could not be deleted. Please try again.', retry: 'Try again', hint: 'Separate IDs with commas. Only IDs already provided by the API are saved.', member: 'member', membersCount: 'members', responsible: 'Overseer', helper: 'Assistant', successCreate: 'Group created successfully.', successUpdate: 'Group updated successfully.', successDelete: 'Group deleted successfully.', actions: 'Group actions' },
  es: { title: 'Grupos de servicio', subtitle: 'Consulta grupos, miembros y responsables según los datos ya autorizados por la API.', create: 'Crear grupo', name: 'Nombre del grupo', members: 'IDs de miembros', overseer: 'ID del responsable', assistant: 'ID del ayudante', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirm: '¿Eliminar grupo de servicio?', confirmBody: 'Esta acción elimina el grupo, pero no elimina personas ni cambia otras responsabilidades.', removing: 'Eliminando…', empty: 'Todavía no hay grupos de servicio.', loading: 'Cargando grupos de servicio…', error: 'No se pudieron cargar los grupos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el grupo. Inténtalo de nuevo.', deleteError: 'No se pudo eliminar el grupo. Inténtalo de nuevo.', retry: 'Intentar de nuevo', hint: 'Separa los IDs con comas. Solo se guardan IDs ya proporcionados por la API.', member: 'miembro', membersCount: 'miembros', responsible: 'Responsable', helper: 'Ayudante', successCreate: 'Grupo creado correctamente.', successUpdate: 'Grupo actualizado correctamente.', successDelete: 'Grupo eliminado correctamente.', actions: 'Acciones del grupo' },
} as const;

export function parseServiceGroupMemberIds(value: string): string[] {
  return [...new Set(value.split(',').map(memberId => memberId.trim()).filter(Boolean))];
}

export function canSubmitServiceGroup(name: string, saving: boolean): boolean {
  return !saving && name.trim().length > 0;
}

export function ServiceGroupsSection({ locale, api = serviceGroupsApi }: { locale: Locale; api?: ServiceGroupsApi }) {
  const text = copy[locale];
  const [items, setItems] = useState<readonly ServiceGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'delete' | null>(null);
  const [notice, setNotice] = useState<'create' | 'update' | 'delete' | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceGroupDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [overseer, setOverseer] = useState('');
  const [assistant, setAssistant] = useState('');
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try { setItems(await api.list(signal)); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [api]);

  const sorted = useMemo(() => [...items].sort((first, second) => first.name.localeCompare(second.name, locale)), [items, locale]);
  const deletingGroup = sorted.find(item => item.id === deleteId) ?? null;
  const begin = (item?: ServiceGroupDto, trigger?: HTMLButtonElement) => {
    if (trigger) actionTriggerRef.current = trigger;
    setNotice(null); setOperationError(null); setEditing(item ?? null); setName(item?.name ?? ''); setMembers(item?.memberIds.join(', ') ?? ''); setOverseer(item?.overseerId ?? ''); setAssistant(item?.assistantId ?? ''); setOpen(true);
  };
  const closeEditor = () => {
    if (saving) return;
    setOpen(false); setOperationError(null);
    window.requestAnimationFrame(() => (editing ? actionTriggerRef.current : createButtonRef.current)?.focus());
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitServiceGroup(name, saving) || savingRef.current) return;
    savingRef.current = true; setSaving(true); setOperationError(null); setNotice(null);
    const payload = { name: name.trim(), memberIds: parseServiceGroupMemberIds(members), overseerId: overseer.trim() || undefined, assistantId: assistant.trim() || undefined };
    try {
      const saved = editing ? await api.update(editing.id, payload) : await api.create(payload);
      const wasEditing = editing !== null;
      setItems(current => wasEditing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      setOpen(false); setEditing(null); setName(''); setMembers(''); setOverseer(''); setAssistant(''); setNotice(wasEditing ? 'update' : 'create');
      window.requestAnimationFrame(() => (wasEditing ? actionTriggerRef.current : createButtonRef.current)?.focus());
    } catch { setOperationError('save'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (!deletingGroup || deletingRef.current) return;
    deletingRef.current = true; setDeleting(true); setOperationError(null); setNotice(null);
    try { await api.delete(deletingGroup.id); setItems(current => current.filter(item => item.id !== deletingGroup.id)); setDeleteId(null); setNotice('delete'); window.requestAnimationFrame(() => actionTriggerRef.current?.focus()); }
    catch { setOperationError('delete'); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  const noticeText = notice === 'create' ? text.successCreate : notice === 'update' ? text.successUpdate : text.successDelete;

  return <Box component="section" aria-labelledby="service-groups-title">
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}><Box sx={{ maxWidth: 720 }}><Typography variant="overline" color="primary.main">{text.title}</Typography><Typography variant="h2" id="service-groups-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.subtitle}</Typography></Box><Button ref={createButtonRef} variant="contained" onClick={() => begin()}>{text.create}</Button></Stack></Paper>
    {notice ? <Alert severity="success" onClose={() => setNotice(null)} sx={{ mb: 2 }}>{noticeText}</Alert> : null}
    {operationError ? <Alert severity="error" sx={{ mb: 2 }}>{operationError === 'save' ? text.saveError : text.deleteError}</Alert> : null}
    {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} sx={{ mb: 2 }}>{text.error}</Alert> : null}
    {loading ? <Box role="status" aria-live="polite" sx={{ py: 2 }}><LinearProgress aria-label={text.loading} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{text.loading}</Typography></Box> : null}
    {!loading && !loadError && sorted.length === 0 ? <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2.5, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : null}
    {!loading && !loadError && sorted.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mt: 2 }}>{sorted.map(item => <Card component="article" key={item.id}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between" gap={1.25} alignItems="flex-start"><Typography variant="h6" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.name}</Typography><Chip label={`${item.memberIds.length} ${item.memberIds.length === 1 ? text.member : text.membersCount}`} size="small" variant="outlined" /></Stack><Divider />{item.memberIds.length > 0 ? <Stack direction="row" flexWrap="wrap" gap={0.5} useFlexGap aria-label={text.members}>{item.memberIds.slice(0, 4).map(memberId => <Chip key={memberId} label={memberId} size="small" variant="outlined" />)}{item.memberIds.length > 4 ? <Chip label={`+${item.memberIds.length - 4}`} size="small" /> : null}</Stack> : null}<Stack spacing={0.5}>{item.overseerId ? <Typography variant="body2"><Typography component="span" fontWeight={700}>{text.responsible}: </Typography>{item.overseerId}</Typography> : null}{item.assistantId ? <Typography variant="body2"><Typography component="span" fontWeight={700}>{text.helper}: </Typography>{item.assistantId}</Typography> : null}</Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} aria-label={`${text.actions} — ${item.name}`}><Button size="small" variant="outlined" onClick={event => begin(item, event.currentTarget)}>{text.edit}</Button><Button size="small" color="error" variant="outlined" disabled={deleting} onClick={event => { actionTriggerRef.current = event.currentTarget; setOperationError(null); setDeleteId(item.id); }}>{text.delete}</Button></Stack></Stack></CardContent></Card>)}</Box> : null}
    <Dialog open={open} onClose={closeEditor} fullWidth maxWidth="sm" aria-describedby="service-group-form-error"><Box component="form" onSubmit={submit}><DialogTitle>{editing ? text.edit : text.create}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label={text.name} value={name} onChange={event => setName(event.target.value)} required autoFocus slotProps={{ htmlInput: { maxLength: 120 } }} /><TextField label={text.members} value={members} onChange={event => setMembers(event.target.value)} helperText={text.hint} multiline minRows={2} /><TextField label={text.overseer} value={overseer} onChange={event => setOverseer(event.target.value)} /><TextField label={text.assistant} value={assistant} onChange={event => setAssistant(event.target.value)} />{operationError === 'save' ? <Alert id="service-group-form-error" severity="error">{text.saveError}</Alert> : null}</Stack></DialogContent><DialogActions><Button onClick={closeEditor} disabled={saving}>{text.cancel}</Button><Button type="submit" variant="contained" disabled={!canSubmitServiceGroup(name, saving)}>{saving ? text.saving : text.save}</Button></DialogActions></Box></Dialog>
    <Dialog open={deletingGroup !== null} onClose={() => !deleting && setDeleteId(null)} fullWidth maxWidth="xs" aria-describedby="service-group-delete-description"><DialogTitle>{text.confirm}</DialogTitle><DialogContent><Typography id="service-group-delete-description">{text.confirmBody}</Typography>{deletingGroup ? <Typography sx={{ mt: 1 }} fontWeight={700}>{deletingGroup.name}</Typography> : null}</DialogContent><DialogActions><Button disabled={deleting} onClick={() => setDeleteId(null)}>{text.cancel}</Button><Button color="error" variant="contained" disabled={deleting} onClick={() => void remove()}>{deleting ? text.removing : text.delete}</Button></DialogActions></Dialog>
  </Box>;
}
