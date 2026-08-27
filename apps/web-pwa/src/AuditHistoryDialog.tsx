import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from './lib/preferences';
import { auditHistoryApi, type AuditAction, type AuditHistoryDto, type AuditResourceType } from './lib/auditHistoryApi';

const resourceTypes: readonly AuditResourceType[] = [
  'person', 'household', 'service-group', 'responsibility', 'delegation', 'congregation',
  'eligibility', 'availability', 'emergency-contact', 'access-grant', 'session', 'midweek-meeting',
  'student-assignment', 'non-student-assignment', 'weekend-meeting', 'public-talk-assignment',
];
const actions: readonly AuditAction[] = ['create', 'update', 'delete', 'grant', 'revoke'];

const copy = {
  'pt-PT': { title: 'Histórico de auditoria', subtitle: 'Registo de alterações operacionais autorizadas neste tenant.', allResources: 'Todos os recursos', allActions: 'Todas as ações', resource: 'Tipo de recurso', action: 'Ação', actor: 'ID do ator', from: 'A partir de', to: 'Até', loading: 'A carregar histórico…', empty: 'Nenhum evento corresponde aos filtros.', unavailable: 'Não foi possível carregar o histórico. Tenta novamente.', retry: 'Tentar novamente', refresh: 'Atualizar', close: 'Fechar', resourceId: 'Identificador do recurso', changed: 'Campos registados', by: 'Registado por', results: 'eventos apresentados', clear: 'Limpar filtros', filterHint: 'Os filtros são aplicados apenas aos eventos já carregados.' },
  en: { title: 'Audit history', subtitle: 'Record of authorized operational changes in this tenant.', allResources: 'All resources', allActions: 'All actions', resource: 'Resource type', action: 'Action', actor: 'Actor ID', from: 'From', to: 'To', loading: 'Loading audit history…', empty: 'No events match the filters.', unavailable: 'Audit history could not be loaded. Please try again.', retry: 'Try again', refresh: 'Refresh', close: 'Close', resourceId: 'Resource identifier', changed: 'Recorded fields', by: 'Recorded by', results: 'events shown', clear: 'Clear filters', filterHint: 'Filters apply only to events that are already loaded.' },
  es: { title: 'Historial de auditoría', subtitle: 'Registro de cambios operativos autorizados en este tenant.', allResources: 'Todos los recursos', allActions: 'Todas las acciones', resource: 'Tipo de recurso', action: 'Acción', actor: 'ID del actor', from: 'Desde', to: 'Hasta', loading: 'Cargando historial…', empty: 'Ningún evento coincide con los filtros.', unavailable: 'No se pudo cargar el historial. Inténtalo de nuevo.', retry: 'Intentar de nuevo', refresh: 'Actualizar', close: 'Cerrar', resourceId: 'Identificador del recurso', changed: 'Campos registrados', by: 'Registrado por', results: 'eventos mostrados', clear: 'Limpiar filtros', filterHint: 'Los filtros se aplican solo a los eventos ya cargados.' },
} as const;

const actionLabels: Record<Locale, Record<AuditAction, string>> = {
  'pt-PT': { create: 'Criar', update: 'Atualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revogar' },
  en: { create: 'Create', update: 'Update', delete: 'Delete', grant: 'Grant', revoke: 'Revoke' },
  es: { create: 'Crear', update: 'Actualizar', delete: 'Eliminar', grant: 'Conceder', revoke: 'Revocar' },
};
const resourceLabels: Record<Locale, Record<AuditResourceType, string>> = {
  'pt-PT': { person: 'Pessoa', household: 'Agregado', 'service-group': 'Grupo de serviço', responsibility: 'Responsabilidade', delegation: 'Delegação', congregation: 'Congregação', eligibility: 'Elegibilidade', availability: 'Disponibilidade', 'emergency-contact': 'Contacto de emergência', 'access-grant': 'Acesso', session: 'Sessão', 'midweek-meeting': 'Reunião do meio da semana', 'student-assignment': 'Designação de estudante', 'non-student-assignment': 'Designação não estudantil', 'weekend-meeting': 'Reunião do fim de semana', 'public-talk-assignment': 'Designação de discurso público' },
  en: { person: 'Person', household: 'Household', 'service-group': 'Service group', responsibility: 'Responsibility', delegation: 'Delegation', congregation: 'Congregation', eligibility: 'Eligibility', availability: 'Availability', 'emergency-contact': 'Emergency contact', 'access-grant': 'Access grant', session: 'Session', 'midweek-meeting': 'Midweek meeting', 'student-assignment': 'Student assignment', 'non-student-assignment': 'Non-student assignment', 'weekend-meeting': 'Weekend meeting', 'public-talk-assignment': 'Public talk assignment' },
  es: { person: 'Persona', household: 'Hogar', 'service-group': 'Grupo de servicio', responsibility: 'Responsabilidad', delegation: 'Delegación', congregation: 'Congregación', eligibility: 'Elegibilidad', availability: 'Disponibilidad', 'emergency-contact': 'Contacto de emergencia', 'access-grant': 'Acceso', session: 'Sesión', 'midweek-meeting': 'Reunión de entre semana', 'student-assignment': 'Asignación de estudiante', 'non-student-assignment': 'Asignación no estudiantil', 'weekend-meeting': 'Reunión del fin de semana', 'public-talk-assignment': 'Asignación de discurso público' },
};

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

function resolvedTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

export function auditLocalDateKey(occurredAt: string, timeZone: string): string {
  const date = new Date(occurredAt);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = new Map(parts.map(part => [part.type, part.value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

function inDateRange(occurredAt: string, from: string, to: string, timeZone: string): boolean {
  const eventDate = auditLocalDateKey(occurredAt, timeZone);
  return Boolean(eventDate) && (!from || eventDate >= from) && (!to || eventDate <= to);
}

export function filterAuditEvents(
  events: readonly AuditHistoryDto[],
  filters: { resourceType: AuditResourceType | ''; action: AuditAction | ''; actorId: string; from: string; to: string },
  timeZone = resolvedTimeZone(),
): readonly AuditHistoryDto[] {
  const actor = filters.actorId.trim().toLocaleLowerCase();
  return events
    .filter(event =>
      (!filters.resourceType || event.resourceType === filters.resourceType) &&
      (!filters.action || event.action === filters.action) &&
      (!actor || event.actorId.toLocaleLowerCase().includes(actor)) &&
      inDateRange(event.occurredAt, filters.from, filters.to, timeZone))
    .slice()
    .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt));
}

export function AuditHistoryDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [events, setEvents] = useState<readonly AuditHistoryDto[]>([]);
  const [resourceType, setResourceType] = useState<AuditResourceType | ''>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [actorId, setActorId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setEvents(await auditHistoryApi.list({ limit: 100 }, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, open]);

  const filters = { resourceType, action, actorId, from, to };
  const filteredEvents = useMemo(() => filterAuditEvents(events, filters), [events, resourceType, action, actorId, from, to]);
  const filtersActive = Boolean(resourceType || action || actorId.trim() || from || to);
  const clearFilters = () => { setResourceType(''); setAction(''); setActorId(''); setFrom(''); setTo(''); };

  const resourceOptions = [{ value: '', label: text.allResources }, ...resourceTypes.map(value => ({ value, label: resourceLabels[locale][value] }))];
  const actionOptions = [{ value: '', label: text.allActions }, ...actions.map(value => ({ value, label: actionLabels[locale][value] }))];

  return <Modal
    open={open}
    destroyOnHidden
    width={860}
    title={<div id="audit-history-title"><Typography.Title level={4} style={{ margin: 0 }}>{text.title}</Typography.Title><Typography.Text id="audit-history-description" type="secondary">{text.subtitle}</Typography.Text></div>}
    aria-labelledby="audit-history-title"
    aria-describedby="audit-history-description"
    onCancel={onClose}
    footer={[
      <Button key="refresh" onClick={() => void load()} disabled={loading}>{text.refresh}</Button>,
      <Button key="close" onClick={onClose}>{text.close}</Button>,
    ]}
  >
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" aria-label={text.title}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{text.filterHint}</Typography.Text>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label><Typography.Text>{text.resource}</Typography.Text><Select aria-label={text.resource} style={{ width: '100%', marginTop: 6 }} value={resourceType} onChange={value => setResourceType(value)} options={resourceOptions} /></label>
            <label><Typography.Text>{text.action}</Typography.Text><Select aria-label={text.action} style={{ width: '100%', marginTop: 6 }} value={action} onChange={value => setAction(value)} options={actionOptions} /></label>
            <label><Typography.Text>{text.actor}</Typography.Text><Input aria-label={text.actor} style={{ marginTop: 6 }} value={actorId} maxLength={200} autoComplete="off" onChange={event => setActorId(event.target.value)} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <label><Typography.Text>{text.from}</Typography.Text><Input aria-label={text.from} type="date" style={{ marginTop: 6 }} value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
            <label><Typography.Text>{text.to}</Typography.Text><Input aria-label={text.to} type="date" style={{ marginTop: 6 }} value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
            {filtersActive ? <Button onClick={clearFilters}>{text.clear}</Button> : <span />}
          </div>
        </Space>
      </Card>

      {loadError ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {loading ? <div role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 5 }} /></div> : null}
      {!loading && !loadError ? <>
        <Typography.Text type="secondary" aria-live="polite">{filteredEvents.length} {text.results}</Typography.Text>
        {filteredEvents.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : <Space orientation="vertical" size="small" style={{ width: '100%' }} role="list" aria-label={text.title}>
          {filteredEvents.map(item => <Card key={item.id} size="small" role="listitem">
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Space wrap size="small"><Tag>{resourceLabels[locale][item.resourceType]}</Tag><Tag color="processing">{actionLabels[locale][item.action]}</Tag></Space>
                <Typography.Text type="secondary">{formatDate(item.occurredAt, locale)}</Typography.Text>
              </div>
              <Typography.Text style={{ overflowWrap: 'anywhere' }}><strong>{text.resourceId}:</strong> {item.resourceId}</Typography.Text>
              <Typography.Text style={{ overflowWrap: 'anywhere' }}><strong>{text.by}:</strong> {item.actorId}</Typography.Text>
              {item.changedFields.length ? <div><Typography.Text type="secondary">{text.changed}</Typography.Text><div style={{ marginTop: 6 }}><Space wrap size="small">{item.changedFields.map(field => <Tag key={field}>{field}</Tag>)}</Space></div></div> : null}
            </Space>
          </Card>)}
        </Space>}
      </> : null}
    </Space>
  </Modal>;
}
