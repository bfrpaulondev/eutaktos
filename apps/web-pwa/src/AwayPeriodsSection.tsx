import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Empty from 'antd/es/empty';
import Modal from 'antd/es/modal';
import Row from 'antd/es/row';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Locale } from './lib/preferences';
import { availabilityApi, type AvailabilityApi, type AvailabilityReasonCode } from './lib/availabilityApi';

const labels: Record<Locale, Record<AvailabilityReasonCode, string>> = {
  'pt-PT': { away: 'Ausente', unavailable: 'Indisponível', other: 'Outro' },
  en: { away: 'Away', unavailable: 'Unavailable', other: 'Other' },
  es: { away: 'Ausente', unavailable: 'No disponible', other: 'Otro' },
};

const copy = {
  'pt-PT': { title: 'Períodos de ausência', add: 'Adicionar ausência', start: 'Início', end: 'Fim', day: 'Dia', month: 'Mês', year: 'Ano', reason: 'Motivo', remove: 'Remover', empty: 'Ainda não existem períodos de ausência.', loading: 'A carregar períodos de ausência…', error: 'Não foi possível carregar os períodos. Tenta novamente.', saveError: 'Não foi possível guardar o período. Tenta novamente.', removeError: 'Não foi possível remover o período. Tenta novamente.', range: 'O fim deve ser posterior ao início.', retry: 'Tentar novamente', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirmTitle: 'Remover período de ausência?', confirmBody: 'Esta ação remove este período do perfil da pessoa.', confirm: 'Sim, remover', removing: 'A remover…', success: 'Período de ausência adicionado.', removed: 'Período de ausência removido.', discardTitle: 'Descartar alterações?', discardBody: 'O período de ausência não guardado será perdido.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Away periods', add: 'Add absence', start: 'Start', end: 'End', day: 'Day', month: 'Month', year: 'Year', reason: 'Reason', remove: 'Remove', empty: 'There are no away periods yet.', loading: 'Loading away periods…', error: 'Away periods could not be loaded. Please try again.', saveError: 'The period could not be saved. Please try again.', removeError: 'The period could not be removed. Please try again.', range: 'End must be after start.', retry: 'Try again', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirmTitle: 'Remove away period?', confirmBody: 'This action removes this period from the person profile.', confirm: 'Yes, remove', removing: 'Removing…', success: 'Away period added.', removed: 'Away period removed.', discardTitle: 'Discard changes?', discardBody: 'The unsaved away period will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Períodos de ausencia', add: 'Agregar ausencia', start: 'Inicio', end: 'Fin', day: 'Día', month: 'Mes', year: 'Año', reason: 'Motivo', remove: 'Eliminar', empty: 'Todavía no hay períodos de ausencia.', loading: 'Cargando períodos de ausencia…', error: 'No se pudieron cargar los períodos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el período. Inténtalo de nuevo.', removeError: 'No se pudo eliminar el período. Inténtalo de nuevo.', range: 'El fin debe ser posterior al inicio.', retry: 'Intentar de nuevo', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirmTitle: '¿Eliminar período de ausencia?', confirmBody: 'Esta acción elimina este período del perfil de la persona.', confirm: 'Sí, eliminar', removing: 'Eliminando…', success: 'Período de ausencia añadido.', removed: 'Período de ausencia eliminado.', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderá el período de ausencia no guardado.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

type DateDraft = Readonly<{ day: string; month: string; year: string }>;
const emptyDateDraft: DateDraft = Object.freeze({ day: '', month: '', year: '' });

export function dateDraftToIso(draft: DateDraft): string {
  if (!/^\d{1,2}$/.test(draft.day) || !/^\d{1,2}$/.test(draft.month) || !/^\d{4}$/.test(draft.year)) return '';
  const day = Number(draft.day);
  const month = Number(draft.month);
  const year = Number(draft.year);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() !== month - 1 || instant.getUTCDate() !== day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function draftHasValue(draft: DateDraft): boolean {
  return Boolean(draft.day || draft.month || draft.year);
}

function daysInMonth(year: string, month: string): number {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return 31;
  return new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
}

function DatePartsFields({ label, locale, value, onChange }: { label: string; locale: Locale; value: DateDraft; onChange: (next: DateDraft) => void }) {
  const text = copy[locale];
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 16 }, (_, index) => currentYear - 10 + index);
  const maxDay = daysInMonth(value.year, value.month);
  const update = (patch: Partial<DateDraft>) => {
    const next = { ...value, ...patch };
    const nextMaxDay = daysInMonth(next.year, next.month);
    if (next.day && Number(next.day) > nextMaxDay) next.day = '';
    onChange(Object.freeze(next));
  };

  return <Space orientation="vertical" size="small" style={{ width: '100%' }}>
    <Typography.Text strong>{label}</Typography.Text>
    <Row gutter={[8, 8]}>
      <Col span={8}>
        <Select
          aria-label={`${label} · ${text.day}`}
          placeholder={text.day}
          value={value.day || undefined}
          onChange={day => update({ day })}
          style={{ width: '100%' }}
          options={Array.from({ length: maxDay }, (_, index) => String(index + 1)).map(day => ({ value: day, label: day }))}
        />
      </Col>
      <Col span={8}>
        <Select
          aria-label={`${label} · ${text.month}`}
          placeholder={text.month}
          value={value.month || undefined}
          onChange={month => update({ month })}
          style={{ width: '100%' }}
          options={Array.from({ length: 12 }, (_, index) => String(index + 1)).map(month => ({ value: month, label: month.padStart(2, '0') }))}
        />
      </Col>
      <Col span={8}>
        <Select
          aria-label={`${label} · ${text.year}`}
          placeholder={text.year}
          value={value.year || undefined}
          onChange={year => update({ year })}
          style={{ width: '100%' }}
          options={years.map(year => ({ value: String(year), label: String(year) }))}
        />
      </Col>
    </Row>
  </Space>;
}

export function isValidAwayPeriodRange(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Boolean(startsAt && endsAt && Number.isFinite(start) && Number.isFinite(end) && end > start);
}

export function hasUnsavedAwayPeriodDraft(start: string, end: string, reason: AvailabilityReasonCode | ''): boolean {
  return Boolean(start || end || reason);
}

export function formatAwayPeriodDate(value: string, locale: Locale): string {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds)
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(milliseconds))
    : value;
}

function focusAddButton() {
  window.requestAnimationFrame(() => document.getElementById('away-periods-add-button')?.focus());
}

export function AwayPeriodsSection({ locale, personId, api = availabilityApi }: { locale: Locale; personId: string; api?: AvailabilityApi }) {
  const text = copy[locale];
  const [periods, setPeriods] = useState<Awaited<ReturnType<AvailabilityApi['list']>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<'added' | 'removed' | null>(null);
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState<DateDraft>(emptyDateDraft);
  const [endDraft, setEndDraft] = useState<DateDraft>(emptyDateDraft);
  const [reason, setReason] = useState<AvailabilityReasonCode | ''>('');
  const removeTriggerRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const removingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setPeriods(await api.list(personId, signal));
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
  }, [api, personId]);

  const sorted = useMemo(() => [...periods].sort((first, second) => first.startsAt.localeCompare(second.startsAt)), [periods]);
  const start = dateDraftToIso(startDraft);
  const end = dateDraftToIso(endDraft);
  const rangeError = Boolean(start && end && !isValidAwayPeriodRange(start, end));
  const confirmingPeriod = sorted.find(period => period.id === confirmingId) ?? null;
  const canSave = Boolean(start && end && isValidAwayPeriodRange(start, end));

  const resetForm = () => {
    setStartDraft(emptyDateDraft);
    setEndDraft(emptyDateDraft);
    setReason('');
    setOperationError(null);
  };

  const closeCreate = () => {
    if (saving) return;
    if (draftHasValue(startDraft) || draftHasValue(endDraft) || reason) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
    resetForm();
    focusAddButton();
  };

  const discardCreate = () => {
    setDiscardOpen(false);
    setOpen(false);
    resetForm();
    focusAddButton();
  };

  const closeRemoveConfirmation = () => {
    if (removingId) return;
    setConfirmingId(null);
    window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !canSave) return;
    savingRef.current = true;
    setSaving(true);
    setOperationError(null);
    setNotice(null);
    try {
      const created = await api.add(personId, { startsAt: start, endsAt: end, ...(reason ? { reasonCode: reason } : {}) });
      setPeriods(current => [...current, created]);
      setOpen(false);
      setDiscardOpen(false);
      resetForm();
      setNotice('added');
      focusAddButton();
    } catch {
      setOperationError('save');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmingPeriod || removingRef.current) return;
    removingRef.current = true;
    setRemovingId(confirmingPeriod.id);
    setOperationError(null);
    setNotice(null);
    try {
      await api.remove(personId, confirmingPeriod.id);
      setPeriods(current => current.filter(period => period.id !== confirmingPeriod.id));
      setConfirmingId(null);
      setNotice('removed');
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    } catch {
      setConfirmingId(null);
      setOperationError('remove');
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    } finally {
      removingRef.current = false;
      setRemovingId(null);
    }
  };

  return <section aria-labelledby="away-periods-title">
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Row gutter={[12, 12]} align="middle" justify="space-between">
        <Col xs={24} sm={16}>
          <Typography.Title level={4} id="away-periods-title" style={{ margin: 0 }}>{text.title}</Typography.Title>
          <Typography.Text type="secondary">{sorted.length}</Typography.Text>
        </Col>
        <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
          <Button id="away-periods-add-button" onClick={() => { resetForm(); setNotice(null); setDiscardOpen(false); setOpen(true); }}>{text.add}</Button>
        </Col>
      </Row>

      {notice ? <Alert type="success" showIcon closable title={notice === 'added' ? text.success : text.removed} onClose={() => setNotice(null)} /> : null}
      {operationError ? <Alert type="error" showIcon title={operationError === 'save' ? text.saveError : text.removeError} /> : null}
      {loadError ? <Alert type="warning" showIcon title={text.error} action={<Button size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {loading ? <Card role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 2 }} /><Typography.Text type="secondary">{text.loading}</Typography.Text></Card> : null}
      {!loading && !loadError && sorted.length === 0 ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /></Card> : null}

      {!loading && !loadError && sorted.length > 0 ? <Row gutter={[12, 12]}>
        {sorted.map(period => <Col key={period.id} xs={24} sm={12}>
          <Card style={{ height: '100%' }}>
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <Typography.Text strong>{formatAwayPeriodDate(period.startsAt, locale)}</Typography.Text>
              <Typography.Text type="secondary">{formatAwayPeriodDate(period.endsAt, locale)}</Typography.Text>
              {period.reasonCode ? <Tag>{labels[locale][period.reasonCode]}</Tag> : null}
              <Button
                size="small"
                danger
                disabled={removingId !== null}
                onClick={event => {
                  removeTriggerRef.current = event.currentTarget;
                  setOperationError(null);
                  setConfirmingId(period.id);
                }}
              >{text.remove}</Button>
            </Space>
          </Card>
        </Col>)}
      </Row> : null}
    </Space>

    <Modal
      open={open}
      title={<span id="away-period-create-title">{text.add}</span>}
      aria-labelledby="away-period-create-title"
      aria-describedby={operationError === 'save' ? 'away-period-form-error' : undefined}
      onCancel={closeCreate}
      maskClosable={false}
      keyboard={!saving}
      footer={null}
      destroyOnHidden
    >
      <form onSubmit={add}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <DatePartsFields label={text.start} locale={locale} value={startDraft} onChange={setStartDraft} />
          <DatePartsFields label={text.end} locale={locale} value={endDraft} onChange={setEndDraft} />
          {rangeError ? <Alert type="warning" showIcon title={text.range} /> : null}
          <label>
            <Typography.Text strong>{text.reason}</Typography.Text>
            <Select
              aria-label={text.reason}
              allowClear
              value={reason || undefined}
              onChange={value => setReason((value ?? '') as AvailabilityReasonCode | '')}
              style={{ width: '100%' }}
              options={(['away', 'unavailable', 'other'] as const).map(code => ({ value: code, label: labels[locale][code] }))}
            />
          </label>
          {operationError === 'save' ? <Alert id="away-period-form-error" type="error" showIcon title={text.saveError} /> : null}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeCreate} disabled={saving}>{text.cancel}</Button>
            <Button htmlType="submit" type="primary" loading={saving} disabled={!canSave}>{saving ? text.saving : text.save}</Button>
          </Space>
        </Space>
      </form>
    </Modal>

    <Modal
      open={discardOpen}
      title={<span id="away-discard-title">{text.discardTitle}</span>}
      aria-labelledby="away-discard-title"
      aria-describedby="away-discard-description"
      onCancel={() => setDiscardOpen(false)}
      footer={[
        <Button key="keep" autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button>,
        <Button key="discard" danger type="primary" onClick={discardCreate}>{text.discard}</Button>,
      ]}
    >
      <Typography.Text id="away-discard-description">{text.discardBody}</Typography.Text>
    </Modal>

    <Modal
      open={confirmingPeriod !== null}
      title={<span id="away-remove-title">{text.confirmTitle}</span>}
      aria-labelledby="away-remove-title"
      aria-describedby="away-remove-description"
      onCancel={closeRemoveConfirmation}
      maskClosable={!removingId}
      keyboard={!removingId}
      footer={[
        <Button key="cancel" disabled={removingId !== null} onClick={closeRemoveConfirmation}>{text.cancel}</Button>,
        <Button key="confirm" danger type="primary" loading={removingId !== null} disabled={!confirmingPeriod} onClick={() => void remove()}>{removingId ? text.removing : text.confirm}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Text id="away-remove-description">{text.confirmBody}</Typography.Text>
        {confirmingPeriod ? <Typography.Text strong>{formatAwayPeriodDate(confirmingPeriod.startsAt, locale)} — {formatAwayPeriodDate(confirmingPeriod.endsAt, locale)}</Typography.Text> : null}
      </Space>
    </Modal>
  </section>;
}
