import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Row from 'antd/es/row';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Locale } from './lib/preferences';
import { responsibilitiesApi, type ResponsibilityDto, type ResponsibilitiesApi } from './lib/responsibilitiesApi';

type ResponsibilityStatus = 'active' | 'ended';

const copy = {
  'pt-PT': { title: 'Responsabilidades', subtitle: 'Consulta atribuições existentes sem inferir elegibilidade ou recomendar pessoas.', create: 'Atribuir responsabilidade', person: 'ID da pessoa', key: 'Chave da responsabilidade', start: 'Início', end: 'Fim opcional', finish: 'Terminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', empty: 'Ainda não existem responsabilidades atribuídas.', loading: 'A carregar responsabilidades…', error: 'Não foi possível carregar as responsabilidades. Tenta novamente.', saveError: 'Não foi possível guardar a responsabilidade. Tenta novamente.', finishError: 'Não foi possível terminar a responsabilidade. Tenta novamente.', retry: 'Tentar novamente', active: 'Ativa', ended: 'Terminada', scheduledEnd: 'Termina em', started: 'Iniciada em', hint: 'Ex.: som, literatura, tarefa-local', range: 'O fim deve ser posterior ao início.', confirmTitle: 'Terminar responsabilidade?', confirmBody: 'Esta ação fecha a responsabilidade na data de hoje. Confirma apenas se esta decisão administrativa está correta.', confirm: 'Sim, terminar', finishing: 'A terminar…', successAssign: 'Responsabilidade atribuída com sucesso.', successFinish: 'Responsabilidade terminada com sucesso.', discardTitle: 'Descartar alterações?', discardBody: 'A atribuição não guardada será perdida.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Responsibilities', subtitle: 'Review existing assignments without inferring eligibility or recommending people.', create: 'Assign responsibility', person: 'Person ID', key: 'Responsibility key', start: 'Start', end: 'Optional end', finish: 'End', save: 'Save', saving: 'Saving…', cancel: 'Cancel', empty: 'There are no responsibilities assigned yet.', loading: 'Loading responsibilities…', error: 'Responsibilities could not be loaded. Please try again.', saveError: 'The responsibility could not be saved. Please try again.', finishError: 'The responsibility could not be ended. Please try again.', retry: 'Try again', active: 'Active', ended: 'Ended', scheduledEnd: 'Ends on', started: 'Started on', hint: 'E.g. sound, literature, local-duty', range: 'End must be after start.', confirmTitle: 'End responsibility?', confirmBody: 'This closes the responsibility on today’s date. Confirm only if this administrative decision is correct.', confirm: 'Yes, end', finishing: 'Ending…', successAssign: 'Responsibility assigned successfully.', successFinish: 'Responsibility ended successfully.', discardTitle: 'Discard changes?', discardBody: 'The unsaved assignment will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Responsabilidades', subtitle: 'Consulta asignaciones existentes sin inferir elegibilidad ni recomendar personas.', create: 'Asignar responsabilidad', person: 'ID de persona', key: 'Clave de responsabilidad', start: 'Inicio', end: 'Fin opcional', finish: 'Terminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', empty: 'Todavía no hay responsabilidades asignadas.', loading: 'Cargando responsabilidades…', error: 'No se pudieron cargar las responsabilidades. Inténtalo de nuevo.', saveError: 'No se pudo guardar la responsabilidad. Inténtalo de nuevo.', finishError: 'No se pudo terminar la responsabilidad. Inténtalo de nuevo.', retry: 'Intentar de nuevo', active: 'Activa', ended: 'Terminada', scheduledEnd: 'Termina el', started: 'Iniciada el', hint: 'Ej.: sonido, literatura, tarea-local', range: 'El fin debe ser posterior al inicio.', confirmTitle: '¿Terminar responsabilidad?', confirmBody: 'Esta acción cierra la responsabilidad en la fecha de hoy. Confirma solo si esta decisión administrativa es correcta.', confirm: 'Sí, terminar', finishing: 'Terminando…', successAssign: 'Responsabilidad asignada correctamente.', successFinish: 'Responsabilidad terminada correctamente.', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderá la asignación no guardada.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidResponsibilityRange(startsAt: string, endsAt: string): boolean {
  if (!endsAt) return Boolean(startsAt);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Boolean(startsAt && Number.isFinite(start) && Number.isFinite(end) && end > start);
}

export function getResponsibilityStatus(item: Pick<ResponsibilityDto, 'endsAt'>, now = Date.now()): ResponsibilityStatus {
  return item.endsAt && Date.parse(item.endsAt) <= now ? 'ended' : 'active';
}

export function hasUnsavedResponsibilityDraft(personId: string, key: string, start: string, end: string, initialStart: string): boolean {
  return personId.trim().length > 0 || key.trim().length > 0 || start !== initialStart || end.length > 0;
}

export function formatResponsibilityDate(value: string, locale: Locale): string {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(milliseconds))
    : value;
}

function focusCreateButton() {
  window.requestAnimationFrame(() => document.getElementById('responsibilities-create-button')?.focus());
}

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
  const finishTriggerRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const finishingRef = useRef(false);

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

  const sorted = useMemo(
    () => [...items].sort((first, second) => second.startsAt.localeCompare(first.startsAt)),
    [items],
  );
  const finishingItem = sorted.find(item => item.id === finishId) ?? null;
  const rangeError = Boolean(end && !isValidResponsibilityRange(start, end));
  const canSubmit = Boolean(personId.trim() && key.trim() && isValidResponsibilityRange(start, end));

  const resetCreate = () => {
    const today = localDate();
    setPersonId('');
    setKey('');
    setStart(today);
    setInitialStart(today);
    setEnd('');
    setOperationError(null);
  };

  const closeCreate = () => {
    if (saving) return;
    if (hasUnsavedResponsibilityDraft(personId, key, start, end, initialStart)) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
    setOperationError(null);
    focusCreateButton();
  };

  const discardCreate = () => {
    setDiscardOpen(false);
    setOpen(false);
    resetCreate();
    focusCreateButton();
  };

  const closeFinish = () => {
    if (finishing) return;
    setFinishId(null);
    window.requestAnimationFrame(() => finishTriggerRef.current?.focus());
  };

  const beginCreate = () => {
    resetCreate();
    setNotice(null);
    setDiscardOpen(false);
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !canSubmit) return;
    savingRef.current = true;
    setSaving(true);
    setOperationError(null);
    setNotice(null);
    try {
      const created = await api.assign({
        personId: personId.trim(),
        responsibilityKey: key.trim(),
        startsAt: start,
        ...(end ? { endsAt: end } : {}),
      });
      setItems(current => [...current, created].sort((first, second) => second.startsAt.localeCompare(first.startsAt)));
      setOpen(false);
      setDiscardOpen(false);
      resetCreate();
      setNotice('assign');
      focusCreateButton();
    } catch {
      setOperationError('save');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const finish = async () => {
    if (!finishingItem || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setOperationError(null);
    setNotice(null);
    try {
      const updated = await api.end(finishingItem.id, { endsAt: localDate() });
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
      setFinishId(null);
      setNotice('finish');
      window.requestAnimationFrame(() => finishTriggerRef.current?.focus());
    } catch {
      setOperationError('finish');
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  };

  const noticeText = notice === 'assign' ? text.successAssign : text.successFinish;

  return <section aria-labelledby="responsibilities-title">
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Row gutter={[16, 16]} align="bottom" justify="space-between">
          <Col xs={24} md={18}>
            <Typography.Text type="secondary">{text.title}</Typography.Text>
            <Typography.Title level={2} id="responsibilities-title" style={{ marginTop: 4, marginBottom: 8 }}>{text.title}</Typography.Title>
            <Typography.Text type="secondary">{text.subtitle}</Typography.Text>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Button id="responsibilities-create-button" type="primary" onClick={beginCreate}>{text.create}</Button>
          </Col>
        </Row>
      </Card>

      {notice ? <Alert type="success" showIcon closable title={noticeText} onClose={() => setNotice(null)} /> : null}
      {operationError ? <Alert type="error" showIcon title={operationError === 'save' ? text.saveError : text.finishError} /> : null}
      {loadError ? <Alert type="warning" showIcon title={text.error} action={<Button size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {loading ? <Card role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /><Typography.Text type="secondary">{text.loading}</Typography.Text></Card> : null}
      {!loading && !loadError && sorted.length === 0 ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /></Card> : null}

      {!loading && !loadError && sorted.length > 0 ? <Row gutter={[16, 16]}>
        {sorted.map(item => {
          const status = getResponsibilityStatus(item);
          return <Col key={item.id} xs={24} sm={12} xl={8}>
            <Card title={item.responsibilityKey} extra={<Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? text.active : text.ended}</Tag>} style={{ height: '100%' }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Text type="secondary">{text.person}: {item.personId}</Typography.Text>
                <Typography.Text type="secondary">{text.started}: {formatResponsibilityDate(item.startsAt, locale)}</Typography.Text>
                {item.endsAt ? <Typography.Text type="secondary">{status === 'ended' ? text.ended : text.scheduledEnd}: {formatResponsibilityDate(item.endsAt, locale)}</Typography.Text> : null}
                {status === 'active' ? <Button
                  size="small"
                  disabled={finishing}
                  onClick={event => {
                    finishTriggerRef.current = event.currentTarget;
                    setOperationError(null);
                    setFinishId(item.id);
                  }}
                >{text.finish}</Button> : null}
              </Space>
            </Card>
          </Col>;
        })}
      </Row> : null}
    </Space>

    <Modal
      open={open}
      title={<span id="responsibility-create-title">{text.create}</span>}
      aria-labelledby="responsibility-create-title"
      aria-describedby={operationError === 'save' ? 'responsibility-form-error' : undefined}
      onCancel={closeCreate}
      maskClosable={!saving}
      keyboard={!saving}
      footer={null}
      destroyOnHidden
    >
      <form onSubmit={submit}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <label>
            <Typography.Text strong>{text.person}</Typography.Text>
            <Input autoFocus required value={personId} onChange={event => setPersonId(event.target.value)} aria-label={text.person} />
          </label>
          <label>
            <Typography.Text strong>{text.key}</Typography.Text>
            <Input required value={key} onChange={event => setKey(event.target.value)} aria-label={text.key} placeholder={text.hint} />
          </label>
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <label>
                <Typography.Text strong>{text.start}</Typography.Text>
                <Input type="date" required value={start} onChange={event => setStart(event.target.value)} aria-label={text.start} />
              </label>
            </Col>
            <Col xs={24} sm={12}>
              <label>
                <Typography.Text strong>{text.end}</Typography.Text>
                <Input type="date" value={end} min={start} status={rangeError ? 'error' : undefined} onChange={event => setEnd(event.target.value)} aria-label={text.end} aria-invalid={rangeError} />
              </label>
            </Col>
          </Row>
          {rangeError ? <Alert type="error" showIcon title={text.range} /> : null}
          {operationError === 'save' ? <Alert id="responsibility-form-error" type="error" showIcon title={text.saveError} /> : null}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button disabled={saving} onClick={closeCreate}>{text.cancel}</Button>
            <Button htmlType="submit" type="primary" loading={saving} disabled={!canSubmit}>{saving ? text.saving : text.save}</Button>
          </Space>
        </Space>
      </form>
    </Modal>

    <Modal
      open={discardOpen}
      title={<span id="responsibility-discard-title">{text.discardTitle}</span>}
      aria-labelledby="responsibility-discard-title"
      aria-describedby="responsibility-discard-description"
      onCancel={() => setDiscardOpen(false)}
      footer={[
        <Button key="keep" autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button>,
        <Button key="discard" danger type="primary" onClick={discardCreate}>{text.discard}</Button>,
      ]}
    >
      <Typography.Text id="responsibility-discard-description">{text.discardBody}</Typography.Text>
    </Modal>

    <Modal
      open={finishingItem !== null}
      title={<span id="responsibility-finish-title">{text.confirmTitle}</span>}
      aria-labelledby="responsibility-finish-title"
      aria-describedby="responsibility-finish-description"
      onCancel={closeFinish}
      maskClosable={!finishing}
      keyboard={!finishing}
      footer={[
        <Button key="cancel" disabled={finishing} onClick={closeFinish}>{text.cancel}</Button>,
        <Button key="confirm" danger type="primary" loading={finishing} disabled={!finishingItem} onClick={() => void finish()}>{finishing ? text.finishing : text.confirm}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Text id="responsibility-finish-description">{text.confirmBody}</Typography.Text>
        {finishingItem ? <Typography.Text strong>{finishingItem.responsibilityKey}</Typography.Text> : null}
      </Space>
    </Modal>
  </section>;
}
