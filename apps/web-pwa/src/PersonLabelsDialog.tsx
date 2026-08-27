import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useRef, useState } from 'react';
import { peopleApi, type PeopleApi } from './lib/peopleApi';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': { title: 'Etiquetas', explanation: 'Etiquetas são metadados administrativos explícitos. Não alteram elegibilidade nem recomendações.', empty: 'Sem etiquetas', edit: 'Editar etiquetas', save: 'Guardar', cancel: 'Cancelar', saving: 'A guardar…', readOnly: 'Pode consultar estas etiquetas, mas não tem permissão para as alterar.', invalid: 'Use no máximo 20 etiquetas, com até 40 caracteres cada.', error: 'Não foi possível guardar as etiquetas. Tente novamente.', retry: 'Tentar novamente' },
  en: { title: 'Labels', explanation: 'Labels are explicit administrative metadata. They do not change eligibility or recommendations.', empty: 'No labels', edit: 'Edit labels', save: 'Save', cancel: 'Cancel', saving: 'Saving…', readOnly: 'You can view these labels, but you do not have permission to change them.', invalid: 'Use at most 20 labels, with up to 40 characters each.', error: 'Labels could not be saved. Try again.', retry: 'Try again' },
  es: { title: 'Etiquetas', explanation: 'Las etiquetas son metadatos administrativos explícitos. No cambian la elegibilidad ni las recomendaciones.', empty: 'Sin etiquetas', edit: 'Editar etiquetas', save: 'Guardar', cancel: 'Cancelar', saving: 'Guardando…', readOnly: 'Puede consultar estas etiquetas, pero no tiene permiso para cambiarlas.', invalid: 'Use como máximo 20 etiquetas, de hasta 40 caracteres cada una.', error: 'No se pudieron guardar las etiquetas. Inténtelo de nuevo.', retry: 'Intentar de nuevo' },
} as const;

function normalizeLabels(values: readonly string[]): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const label = value.trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return Object.freeze(result.sort((left, right) => left.localeCompare(right, 'en')));
}

export function labelsDraftValid(values: readonly string[]): boolean {
  return values.length <= 20 && values.every(value => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return normalized.length > 0 && normalized.length <= 40 && !/[\u0000-\u001F\u007F]/.test(normalized);
  });
}

export function PersonLabelsDialog({ personId, personName, labels, locale, canWrite, open, onClose, onSaved, api = peopleApi }: {
  personId: string;
  personName: string;
  labels: readonly string[];
  locale: Locale;
  canWrite: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: (labels: readonly string[]) => void;
  api?: PeopleApi;
}) {
  const text = copy[locale];
  const [draft, setDraft] = useState<readonly string[]>(labels);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const mutationLockRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDraft(labels);
    setEditing(false);
    setSaving(false);
    setSaveError(false);
  }, [open, personId, labels]);

  const normalized = normalizeLabels(draft);
  const valid = labelsDraftValid(draft);
  const changed = JSON.stringify(normalized) !== JSON.stringify(normalizeLabels(labels));

  const save = async () => {
    if (!canWrite || !valid || !changed || mutationLockRef.current) return;
    mutationLockRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await api.update(personId, { labels: normalized });
      const authoritative = (await api.list()).find(person => person.id === personId);
      const confirmed = normalizeLabels(authoritative?.labels ?? []);
      if (!authoritative || JSON.stringify(confirmed) !== JSON.stringify(normalized)) throw new Error('Authoritative label refetch mismatch');
      setDraft(confirmed);
      setEditing(false);
      onSaved(confirmed);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
      mutationLockRef.current = false;
    }
  };

  return <Modal open={open} title={`${text.title} — ${personName}`} onCancel={saving ? undefined : onClose} footer={null} destroyOnHidden>
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.explanation} />
      {!canWrite ? <Alert type="warning" showIcon title={text.readOnly} /> : null}
      {saveError ? <Alert type="error" showIcon title={text.error} action={<Button size="small" disabled={saving} onClick={() => void save()}>{text.retry}</Button>} /> : null}
      {editing ? <>
        <Select
          aria-label={text.edit}
          mode="tags"
          open={false}
          value={[...draft]}
          onChange={value => setDraft(value)}
          disabled={saving}
          tokenSeparators={[',']}
          style={{ width: '100%' }}
          placeholder={text.empty}
        />
        {!valid ? <Typography.Text type="danger" role="alert">{text.invalid}</Typography.Text> : null}
        <Space wrap><Button onClick={() => { setDraft(labels); setEditing(false); setSaveError(false); }} disabled={saving}>{text.cancel}</Button><Button type="primary" loading={saving} disabled={!valid || !changed} onClick={() => void save()}>{saving ? text.saving : text.save}</Button></Space>
      </> : <>
        <Space size={[4, 4]} wrap>{labels.length ? labels.map(label => <Tag key={label}>{label}</Tag>) : <Typography.Text type="secondary">{text.empty}</Typography.Text>}</Space>
        {canWrite ? <Button onClick={() => setEditing(true)}>{text.edit}</Button> : null}
      </>}
    </Space>
  </Modal>;
}
