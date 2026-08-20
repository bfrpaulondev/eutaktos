import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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

export interface ServiceGroupDto {
  id: string;
  name: string;
  memberIds: readonly string[];
  overseerId?: string;
  assistantId?: string;
}

export interface ServiceGroupsApi {
  list(signal?: AbortSignal): Promise<readonly ServiceGroupDto[]>;
  create(input: { name: string; memberIds: string[]; overseerId?: string; assistantId?: string }): Promise<ServiceGroupDto>;
  update(id: string, input: { name: string; memberIds: string[]; overseerId?: string; assistantId?: string }): Promise<ServiceGroupDto>;
  remove(id: string): Promise<void>;
}

// Placeholder — will be replaced by the real implementation from K08
const api: ServiceGroupsApi = {
  list: async () => [],
  create: async (input) => ({ id: crypto.randomUUID(), ...input }),
  update: async (id, input) => ({ id, ...input }),
  remove: async () => {},
};

/* ------------------------------------------------------------------ */
/*  Locale-aware labels                                                */
/* ------------------------------------------------------------------ */

const copy = {
  'pt-PT': {
    title: 'Grupos de serviço',
    create: 'Criar grupo',
    name: 'Nome',
    members: 'Membros',
    overseer: 'Superintendente',
    assistant: 'Ajudante',
    edit: 'Editar',
    delete: 'Eliminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    deleteConfirmTitle: 'Eliminar grupo de serviço?',
    empty: 'Nenhum grupo de serviço',
    errorLoading: 'Erro ao carregar grupos de serviço',
    retry: 'Tentar novamente',
    memberCount: (n: number) => (n === 1 ? '1 membro' : `${n} membros`),
    editTitle: 'Editar grupo',
    createTitle: 'Novo grupo',
    confirmDelete: 'Eliminar',
    confirmCancel: 'Cancelar',
    idsHint: 'IDs separados por vírgula',
    optionalId: 'ID (opcional)',
  },
  en: {
    title: 'Service Groups',
    create: 'Create group',
    name: 'Name',
    members: 'Members',
    overseer: 'Overseer',
    assistant: 'Assistant',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    deleteConfirmTitle: 'Delete service group?',
    empty: 'No service groups',
    errorLoading: 'Error loading service groups',
    retry: 'Try again',
    memberCount: (n: number) => (n === 1 ? '1 member' : `${n} members`),
    editTitle: 'Edit group',
    createTitle: 'New group',
    confirmDelete: 'Delete',
    confirmCancel: 'Cancel',
    idsHint: 'Comma-separated IDs',
    optionalId: 'ID (optional)',
  },
  es: {
    title: 'Grupos de servicio',
    create: 'Crear grupo',
    name: 'Nombre',
    members: 'Miembros',
    overseer: 'Superintendente',
    assistant: 'Ayudante',
    edit: 'Editar',
    delete: 'Eliminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    deleteConfirmTitle: '¿Eliminar grupo de servicio?',
    empty: 'Ningún grupo de servicio',
    errorLoading: 'Error al cargar grupos de servicio',
    retry: 'Intentar de nuevo',
    memberCount: (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`),
    editTitle: 'Editar grupo',
    createTitle: 'Nuevo grupo',
    confirmDelete: 'Eliminar',
    confirmCancel: 'Cancelar',
    idsHint: 'IDs separados por coma',
    optionalId: 'ID (opcional)',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ServiceGroupsSection({ locale }: { locale: Locale }) {
  const text = copy[locale];

  const [items, setItems] = useState<readonly ServiceGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceGroupDto | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formMembers, setFormMembers] = useState('');
  const [formOverseer, setFormOverseer] = useState('');
  const [formAssistant, setFormAssistant] = useState('');

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
    setEditingItem(null);
    setFormName('');
    setFormMembers('');
    setFormOverseer('');
    setFormAssistant('');
    setDialogOpen(true);
  };

  const openEdit = (item: ServiceGroupDto) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormMembers(item.memberIds.join(', '));
    setFormOverseer(item.overseerId ?? '');
    setFormAssistant(item.assistantId ?? '');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingItem(null);
  };

  /* ---------- submit ---------- */

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) return;
    const memberIds = formMembers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const overseerId = formOverseer.trim() || undefined;
    const assistantId = formAssistant.trim() || undefined;

    setSaving(true);
    setError(null);
    try {
      if (editingItem) {
        const updated = await api.update(editingItem.id, { name, memberIds, overseerId, assistantId });
        setItems(current =>
          current
            .map(g => (g.id === updated.id ? updated : g))
            .sort((a, b) => a.name.localeCompare(b.name, locale)),
        );
      } else {
        const created = await api.create({ name, memberIds, overseerId, assistantId });
        setItems(current =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name, locale)),
        );
      }
      closeDialog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.errorLoading);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- delete ---------- */

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setError(null);
    try {
      await api.remove(deleteConfirmId);
      setItems(current => current.filter(g => g.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.errorLoading);
      setDeleteConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- render ---------- */

  const isEditing = editingItem !== null;

  return (
    <Box component="section" aria-labelledby="service-groups-title">
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-end' }}>
          <Box>
            <Typography variant="h2" id="service-groups-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>
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
          {items.map(item => (
            <Card component="article" key={item.id}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={700} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {text.memberCount(item.memberIds.length)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="text" onClick={() => openEdit(item)}>
                        {text.edit}
                      </Button>
                      <Button size="small" variant="text" color="error" onClick={() => setDeleteConfirmId(item.id)}>
                        {text.delete}
                      </Button>
                    </Stack>
                  </Stack>

                  {(item.overseerId || item.assistantId) && (
                    <Stack spacing={0.5}>
                      {item.overseerId && (
                        <Typography variant="body2" color="text.secondary">
                          {text.overseer}: {item.overseerId}
                        </Typography>
                      )}
                      {item.assistantId && (
                        <Typography variant="body2" color="text.secondary">
                          {text.assistant}: {item.assistantId}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{isEditing ? text.editTitle : text.createTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label={text.name}
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
                autoFocus
                fullWidth
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
              <TextField
                label={text.members}
                value={formMembers}
                onChange={e => setFormMembers(e.target.value)}
                helperText={text.idsHint}
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label={text.overseer}
                value={formOverseer}
                onChange={e => setFormOverseer(e.target.value)}
                placeholder={text.optionalId}
                fullWidth
              />
              <TextField
                label={text.assistant}
                value={formAssistant}
                onChange={e => setFormAssistant(e.target.value)}
                placeholder={text.optionalId}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} disabled={saving}>{text.cancel}</Button>
            <Button type="submit" variant="contained" disabled={saving || !formName.trim()}>{text.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onClose={() => !deleting && setDeleteConfirmId(null)}>
        <DialogTitle>{text.deleteConfirmTitle}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting}>{text.confirmCancel}</Button>
          <Button onClick={() => void handleDelete()} color="error" variant="contained" disabled={deleting}>{text.confirmDelete}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
