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
/*  Local DTO & API interface (real implementation will come later)   */
/* ------------------------------------------------------------------ */

export interface HouseholdDto {
  id: string;
  name: string;
  memberIds: readonly string[];
}

export interface HouseholdsApi {
  list(signal?: AbortSignal): Promise<readonly HouseholdDto[]>;
  create(input: { name: string; memberIds: string[] }): Promise<HouseholdDto>;
  update(id: string, input: { name: string; memberIds: string[] }): Promise<HouseholdDto>;
  remove(id: string): Promise<void>;
}

// Placeholder — will be replaced by the real implementation from K07
const api: HouseholdsApi = {
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
    title: 'Agregados familiares',
    create: 'Criar agregado',
    name: 'Nome',
    members: 'Membros',
    edit: 'Editar',
    delete: 'Eliminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    deleteConfirmTitle: 'A eliminar agregado?',
    empty: 'Nenhum agregado familiar',
    errorLoading: 'Erro ao carregar agregados',
    retry: 'Tentar novamente',
    memberCount: (n: number) => (n === 1 ? '1 membro' : `${n} membros`),
    editTitle: 'Editar agregado',
    createTitle: 'Novo agregado',
    confirmDelete: 'Eliminar',
    confirmCancel: 'Cancelar',
  },
  en: {
    title: 'Households',
    create: 'Create household',
    name: 'Name',
    members: 'Members',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    deleteConfirmTitle: 'Delete household?',
    empty: 'No households',
    errorLoading: 'Error loading households',
    retry: 'Try again',
    memberCount: (n: number) => (n === 1 ? '1 member' : `${n} members`),
    editTitle: 'Edit household',
    createTitle: 'New household',
    confirmDelete: 'Delete',
    confirmCancel: 'Cancel',
  },
  es: {
    title: 'Grupos familiares',
    create: 'Crear grupo',
    name: 'Nombre',
    members: 'Miembros',
    edit: 'Editar',
    delete: 'Eliminar',
    save: 'Guardar',
    cancel: 'Cancelar',
    deleteConfirmTitle: '¿Eliminar grupo familiar?',
    empty: 'Ningún grupo familiar',
    errorLoading: 'Error al cargar grupos',
    retry: 'Intentar de nuevo',
    memberCount: (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`),
    editTitle: 'Editar grupo',
    createTitle: 'Nuevo grupo',
    confirmDelete: 'Eliminar',
    confirmCancel: 'Cancelar',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HouseholdsSection({ locale }: { locale: Locale }) {
  const text = copy[locale];

  const [items, setItems] = useState<readonly HouseholdDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HouseholdDto | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formMembers, setFormMembers] = useState('');

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
    setDialogOpen(true);
  };

  const openEdit = (item: HouseholdDto) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormMembers(item.memberIds.join(', '));
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

    setSaving(true);
    setError(null);
    try {
      if (editingItem) {
        const updated = await api.update(editingItem.id, { name, memberIds });
        setItems(current =>
          current
            .map(h => (h.id === updated.id ? updated : h))
            .sort((a, b) => a.name.localeCompare(b.name, locale)),
        );
      } else {
        const created = await api.create({ name, memberIds });
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
      setItems(current => current.filter(h => h.id !== deleteConfirmId));
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
    <Box component="section" aria-labelledby="households-title">
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-end' }}>
          <Box>
            <Typography variant="h2" id="households-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>
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
                helperText={locale === 'pt-PT' ? 'IDs separados por vírgula' : locale === 'es' ? 'IDs separados por coma' : 'Comma-separated IDs'}
                fullWidth
                multiline
                minRows={2}
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
