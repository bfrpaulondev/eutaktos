import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItem, Paper, TextField } from '@mui/material';
import type { Locale } from './lib/preferences';
import { emergencyContactsApi, type EmergencyContactDto } from './lib/emergencyContactsApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': { title: 'Contactos de emergência', loading: 'A carregar contactos de emergência…', empty: 'Não existem contactos de emergência registados.', name: 'Nome', phone: 'Telefone', relationship: 'Relação', add: 'Adicionar contacto', adding: 'A adicionar…', close: 'Fechar', remove: 'Remover', removing: 'A remover…', restricted: 'Dados sensíveis: consulta-os apenas quando forem necessários para uma situação de emergência.', unavailable: 'Não foi possível aceder aos contactos de emergência. Tenta novamente.', saveError: 'Não foi possível guardar o contacto. Tenta novamente.', removeError: 'Não foi possível remover o contacto. Tenta novamente.', retry: 'Tentar novamente', successAdd: 'Contacto de emergência adicionado.', successRemove: 'Contacto de emergência removido.', confirmTitle: 'Remover contacto de emergência?', confirmBody: 'Esta ação remove o contacto selecionado. O nome e telefone não são repetidos nesta confirmação para reduzir a exposição visual de dados sensíveis.', confirm: 'Sim, remover', cancel: 'Cancelar', sensitive: 'Sensível', formTitle: 'Adicionar contacto de emergência' },
  en: { title: 'Emergency contacts', loading: 'Loading emergency contacts…', empty: 'There are no emergency contacts recorded.', name: 'Name', phone: 'Phone', relationship: 'Relationship', add: 'Add contact', adding: 'Adding…', close: 'Close', remove: 'Remove', removing: 'Removing…', restricted: 'Sensitive data: view it only when needed for an emergency situation.', unavailable: 'Emergency contacts could not be accessed. Please try again.', saveError: 'The contact could not be saved. Please try again.', removeError: 'The contact could not be removed. Please try again.', retry: 'Try again', successAdd: 'Emergency contact added.', successRemove: 'Emergency contact removed.', confirmTitle: 'Remove emergency contact?', confirmBody: 'This action removes the selected contact. Name and phone are not repeated in this confirmation to reduce visual exposure of sensitive data.', confirm: 'Yes, remove', cancel: 'Cancel', sensitive: 'Sensitive', formTitle: 'Add emergency contact' },
  es: { title: 'Contactos de emergencia', loading: 'Cargando contactos de emergencia…', empty: 'No hay contactos de emergencia registrados.', name: 'Nombre', phone: 'Teléfono', relationship: 'Relación', add: 'Añadir contacto', adding: 'Añadiendo…', close: 'Cerrar', remove: 'Eliminar', removing: 'Eliminando…', restricted: 'Datos sensibles: consúltalos solo cuando sean necesarios para una situación de emergencia.', unavailable: 'No se pudo acceder a los contactos de emergencia. Inténtalo de nuevo.', saveError: 'No se pudo guardar el contacto. Inténtalo de nuevo.', removeError: 'No se pudo eliminar el contacto. Inténtalo de nuevo.', retry: 'Intentar de nuevo', successAdd: 'Contacto de emergencia añadido.', successRemove: 'Contacto de emergencia eliminado.', confirmTitle: '¿Eliminar contacto de emergencia?', confirmBody: 'Esta acción elimina el contacto seleccionado. El nombre y el teléfono no se repiten en esta confirmación para reducir la exposición visual de datos sensibles.', confirm: 'Sí, eliminar', cancel: 'Cancelar', sensitive: 'Sensible', formTitle: 'Añadir contacto de emergencia' },
} as const;

export function canSubmitEmergencyContact(name: string, phone: string, saving: boolean): boolean { return !saving && name.trim().length > 0 && phone.trim().length > 0; }

export function EmergencyContactsDialog({ personId, personName, locale, open, onClose }: { personId: string; personName: string; locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [contacts, setContacts] = useState<readonly EmergencyContactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<'add' | 'remove' | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const savingRef = useRef(false);
  const removingRef = useRef(false);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(false);
    try { setContacts(await emergencyContactsApi.list(personId, signal)); }
    catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') return; setLoadError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { if (!open) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [open, personId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitEmergencyContact(name, phone, saving) || savingRef.current) return;
    savingRef.current = true; setSaving(true); setOperationError(null); setNotice(null);
    try {
      const created = await emergencyContactsApi.create(personId, { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || undefined });
      setContacts(current => [...current, created]); setName(''); setPhone(''); setRelationship(''); setNotice('add');
    } catch { setOperationError('save'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const remove = async () => {
    if (!confirmingId || removingRef.current) return;
    removingRef.current = true; setRemovingId(confirmingId); setOperationError(null); setNotice(null);
    try { await emergencyContactsApi.remove(personId, confirmingId); setContacts(current => current.filter(contact => contact.id !== confirmingId)); setConfirmingId(null); setNotice('remove'); window.requestAnimationFrame(() => removeTriggerRef.current?.focus()); }
    catch { setOperationError('remove'); }
    finally { removingRef.current = false; setRemovingId(null); }
  };
  const retry = () => void load();

  return <Dialog open={open} onClose={() => !saving && !removingId && !confirmingId && onClose()} fullWidth maxWidth="sm" aria-labelledby="emergency-contacts-title">
    <DialogTitle id="emergency-contacts-title">{text.title} — {personName}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Alert severity="warning" icon={false}><Stack direction="row" spacing={1} alignItems="center"><Chip label={text.sensitive} color="warning" size="small" /><Typography variant="body2">{text.restricted}</Typography></Stack></Alert>
      {notice ? <Alert severity="success" onClose={() => setNotice(null)}>{notice === 'add' ? text.successAdd : text.successRemove}</Alert> : null}
      {operationError ? <Alert severity="error">{operationError === 'save' ? text.saveError : text.removeError}</Alert> : null}
      {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={retry}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
      {loading ? <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" role="status" sx={{ py: 3 }}><CircularProgress size={22} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : contacts.length === 0 && !loadError ? <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.empty}</Typography></Paper> : <List disablePadding aria-label={text.title}>{contacts.map(contact => <ListItem key={contact.id} divider disableGutters sx={{ alignItems: 'flex-start', py: 1.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.25} sx={{ width: '100%' }}><Box sx={{ minWidth: 0 }}><Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{contact.name}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{contact.phone}</Typography>{contact.relationship ? <Typography variant="caption" color="text.secondary">{contact.relationship}</Typography> : null}</Box><Button size="small" color="error" variant="outlined" disabled={removingId !== null} onClick={event => { removeTriggerRef.current = event.currentTarget; setOperationError(null); setConfirmingId(contact.id); }}>{removingId === contact.id ? text.removing : text.remove}</Button></Stack></ListItem>)}</List>}
      <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }} aria-describedby="emergency-contact-form-error"><Stack spacing={1.5}><Typography variant="subtitle2" fontWeight={800}>{text.formTitle}</Typography><TextField label={text.name} value={name} onChange={event => setName(event.target.value)} required slotProps={{ htmlInput: { autoComplete: 'off', maxLength: 120 } }} /><TextField label={text.phone} type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} required slotProps={{ htmlInput: { autoComplete: 'off', maxLength: 64 } }} /><TextField label={text.relationship} value={relationship} onChange={event => setRelationship(event.target.value)} slotProps={{ htmlInput: { autoComplete: 'off', maxLength: 120 } }} />{operationError === 'save' ? <Alert id="emergency-contact-form-error" severity="error">{text.saveError}</Alert> : null}<Button type="submit" variant="outlined" disabled={!canSubmitEmergencyContact(name, phone, saving)} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>{saving ? text.adding : text.add}</Button></Stack></Paper>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving || removingId !== null}>{text.close}</Button></DialogActions>
    <Dialog open={confirmingId !== null} onClose={() => !removingId && setConfirmingId(null)} fullWidth maxWidth="xs" aria-describedby="emergency-contact-remove-description"><DialogTitle>{text.confirmTitle}</DialogTitle><DialogContent><Typography id="emergency-contact-remove-description">{text.confirmBody}</Typography></DialogContent><DialogActions><Button disabled={removingId !== null} onClick={() => setConfirmingId(null)}>{text.cancel}</Button><Button color="error" variant="contained" disabled={removingId !== null} onClick={() => void remove()}>{removingId ? text.removing : text.confirm}</Button></DialogActions></Dialog>
  </Dialog>;
}
