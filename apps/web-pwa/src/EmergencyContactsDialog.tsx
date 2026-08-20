import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { Locale } from './lib/preferences';
import {
  emergencyContactsApi,
  type EmergencyContactDto,
} from './lib/emergencyContactsApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { title: 'Contactos de emergência', loading: 'A carregar…', empty: 'Sem contactos de emergência.', name: 'Nome', phone: 'Telefone', relationship: 'Relação', add: 'Adicionar', close: 'Fechar', remove: 'Remover contacto', restricted: 'Esta informação é restrita e requer permissão específica.' },
  en: { title: 'Emergency contacts', loading: 'Loading…', empty: 'No emergency contacts.', name: 'Name', phone: 'Phone', relationship: 'Relationship', add: 'Add', close: 'Close', remove: 'Remove contact', restricted: 'This information is restricted and requires a specific permission.' },
  es: { title: 'Contactos de emergencia', loading: 'Cargando…', empty: 'Sin contactos de emergencia.', name: 'Nombre', phone: 'Teléfono', relationship: 'Relación', add: 'Añadir', close: 'Cerrar', remove: 'Eliminar contacto', restricted: 'Esta información está restringida y requiere un permiso específico.' },
} as const;

export function EmergencyContactsDialog({
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
  onClose(): void;
}) {
  const text = copy[locale];
  const [contacts, setContacts] = useState<readonly EmergencyContactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    emergencyContactsApi.list(personId, controller.signal)
      .then(setContacts)
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : text.restricted);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, personId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await emergencyContactsApi.create(personId, {
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim() || undefined,
      });
      setContacts(current => [...current, created]);
      setName('');
      setPhone('');
      setRelationship('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.restricted);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (contactId: string) => {
    setError(null);
    try {
      await emergencyContactsApi.remove(personId, contactId);
      setContacts(current => current.filter(contact => contact.id !== contactId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.restricted);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{text.title} — {personName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{text.restricted}</Typography>
          {error ? <Alert severity="warning">{error}</Alert> : null}
          {loading ? <Typography color="text.secondary">{text.loading}</Typography> : contacts.length === 0 ? (
            <Typography color="text.secondary">{text.empty}</Typography>
          ) : (
            <List disablePadding>
              {contacts.map(contact => (
                <ListItem
                  key={contact.id}
                  divider
                  secondaryAction={
                    <IconButton aria-label={`${text.remove}: ${contact.name}`} onClick={() => void remove(contact.id)}>
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={contact.name}
                    secondary={[contact.phone, contact.relationship].filter(Boolean).join(' · ')}
                  />
                </ListItem>
              ))}
            </List>
          )}
          <Stack component="form" spacing={1.5} onSubmit={submit}>
            <TextField label={text.name} value={name} onChange={event => setName(event.target.value)} required />
            <TextField label={text.phone} value={phone} onChange={event => setPhone(event.target.value)} required />
            <TextField label={text.relationship} value={relationship} onChange={event => setRelationship(event.target.value)} />
            <Button type="submit" variant="outlined" disabled={saving || !name.trim() || !phone.trim()}>{text.add}</Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{text.close}</Button></DialogActions>
    </Dialog>
  );
}
