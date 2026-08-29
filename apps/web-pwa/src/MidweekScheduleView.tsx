import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Drawer from 'antd/es/drawer';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { midweekApi, type CandidateProfileDto, type CandidateQueryResultDto, type CandidateRole, type ScheduleMeetingViewDto } from './lib/midweekApi';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': {
    title: 'Programação da Reunião Vida e Ministério',
    subtitle: 'Veja e organize as designações da reunião do meio de semana.',
    loading: 'A carregar a programação…',
    error: 'Não foi possível carregar a programação.',
    retry: 'Tentar novamente',
    refresh: 'Atualizar',
    back: 'Voltar',
    vacantSlot: 'Por designar',
    filledSlot: 'Designado',
    conflictSlot: 'Conflito',
    total: 'Total',
    filled: 'Preenchidas',
    vacant: 'Vagas',
    conflicts: 'Conflitos',
    designations: 'designações',
    noSlots: 'Ainda não existem partes nesta reunião.',
    minutes: 'min',
    candidates: 'Candidatos',
    candidatesFor: 'Candidatos para',
    search: 'Procurar por nome…',
    assignStudent: 'Designar estudante',
    assignAssistant: 'Designar ajudante',
    assignNonStudent: 'Designar função',
    replace: 'Substituir',
    cancel: 'Remover',
    cancelAssignment: 'Cancelar designação',
    cancelConfirm: 'Tem a certeza que pretende cancelar esta designação? O histórico será mantido.',
    publish: 'Publicar programação',
    publishConfirm: 'Publicar a programação? Não poderá alterá-la depois.',
    published: 'Programação publicada',
    ineligible: 'Não elegível',
    inactive: 'Inativo',
    unavailable: 'Indisponível',
    lastAssignment: 'Última designação',
    noHistory: 'Sem histórico',
    daysAgo: 'dias atrás',
    weeksAgo: 'semanas atrás',
    recentCount: 'Designações recentes',
    inThisMeeting: 'Já designado nesta reunião',
    suggestion: 'Sugestão',
    select: 'Selecionar',
    close: 'Fechar',
    assignSuccess: 'Designação criada.',
    assignError: 'Não foi possível criar a designação.',
    cancelSuccess: 'Designação cancelada.',
    cancelError: 'Não foi possível cancelar a designação.',
    publishSuccess: 'Programação publicada.',
    publishError: 'Não foi possível publicar a programação.',
    publishBlocked: 'Existem conflitos. Resolva-os antes de publicar.',
    refreshUpdated: 'Programação atualizada.',
    advisoryNote: 'As sugestões servem apenas como apoio. A decisão da designação pertence ao utilizador autorizado.',
    longTimeSince: 'Pouca utilização recente',
    noHistoryFor: 'Ainda não recebeu esta designação',
    availableLowLoad: 'Disponível, com baixa carga recente',
    longestTimeSince: 'Maior intervalo desde a última designação',
    alreadyAssigned: 'Já possui designação nesta reunião',
    recentAssignmentFor: 'Designação recente para esta função',
    conflictSchedule: 'Conflito de horário',
    noCandidates: 'Não existem candidatos elegíveis para esta designação.',
    role: 'Função',
    assistant: 'Ajudante',
    student: 'Estudante',
    noAssistant: 'Sem ajudante',
    duration: 'Duração',
    parts: 'Partes',
  },
  en: {
    title: 'Life and Ministry Meeting Schedule',
    subtitle: 'View and organize the midweek meeting assignments.',
    loading: 'Loading the schedule…',
    error: 'The schedule could not be loaded.',
    retry: 'Try again',
    refresh: 'Refresh',
    back: 'Back',
    vacantSlot: 'Unassigned',
    filledSlot: 'Assigned',
    conflictSlot: 'Conflict',
    total: 'Total',
    filled: 'Filled',
    vacant: 'Vacant',
    conflicts: 'Conflicts',
    designations: 'assignments',
    noSlots: 'There are no parts in this meeting yet.',
    minutes: 'min',
    candidates: 'Candidates',
    candidatesFor: 'Candidates for',
    search: 'Search by name…',
    assignStudent: 'Assign student',
    assignAssistant: 'Assign assistant',
    assignNonStudent: 'Assign role',
    replace: 'Replace',
    cancel: 'Remove',
    cancelAssignment: 'Cancel assignment',
    cancelConfirm: 'Are you sure you want to cancel this assignment? History will be kept.',
    publish: 'Publish schedule',
    publishConfirm: 'Publish the schedule? You will not be able to change it afterwards.',
    published: 'Schedule published',
    ineligible: 'Not eligible',
    inactive: 'Inactive',
    unavailable: 'Unavailable',
    lastAssignment: 'Last assignment',
    noHistory: 'No history',
    daysAgo: 'days ago',
    weeksAgo: 'weeks ago',
    recentCount: 'Recent assignments',
    inThisMeeting: 'Already assigned in this meeting',
    suggestion: 'Suggestion',
    select: 'Select',
    close: 'Close',
    assignSuccess: 'Assignment created.',
    assignError: 'Could not create the assignment.',
    cancelSuccess: 'Assignment cancelled.',
    cancelError: 'Could not cancel the assignment.',
    publishSuccess: 'Schedule published.',
    publishError: 'Could not publish the schedule.',
    publishBlocked: 'There are conflicts. Resolve them before publishing.',
    refreshUpdated: 'Schedule refreshed.',
    advisoryNote: 'These suggestions are advisory only. The decision belongs to the authorized user.',
    longTimeSince: 'Low recent usage',
    noHistoryFor: 'Has not received this assignment yet',
    availableLowLoad: 'Available, with low recent load',
    longestTimeSince: 'Longest gap since last assignment',
    alreadyAssigned: 'Already has an assignment in this meeting',
    recentAssignmentFor: 'Recent assignment for this role',
    conflictSchedule: 'Schedule conflict',
    noCandidates: 'There are no eligible candidates for this assignment.',
    role: 'Role',
    assistant: 'Assistant',
    student: 'Student',
    noAssistant: 'No assistant',
    duration: 'Duration',
    parts: 'Parts',
  },
  es: {
    title: 'Programación de la Reunión Vida y Ministerio',
    subtitle: 'Vea y organice las asignaciones de la reunión de entresemana.',
    loading: 'Cargando la programación…',
    error: 'No se pudo cargar la programación.',
    retry: 'Intentar de nuevo',
    refresh: 'Actualizar',
    back: 'Volver',
    vacantSlot: 'Sin asignar',
    filledSlot: 'Asignado',
    conflictSlot: 'Conflicto',
    total: 'Total',
    filled: 'Llenas',
    vacant: 'Vacantes',
    conflicts: 'Conflictos',
    designations: 'asignaciones',
    noSlots: 'Todavía no hay partes en esta reunión.',
    minutes: 'min',
    candidates: 'Candidatos',
    candidatesFor: 'Candidatos para',
    search: 'Buscar por nombre…',
    assignStudent: 'Asignar estudiante',
    assignAssistant: 'Asignar ayudante',
    assignNonStudent: 'Asignar función',
    replace: 'Sustituir',
    cancel: 'Quitar',
    cancelAssignment: 'Cancelar asignación',
    cancelConfirm: '¿Está seguro de que desea cancelar esta asignación? Se mantendrá el historial.',
    publish: 'Publicar programación',
    publishConfirm: '¿Publicar la programación? No podrá cambiarla después.',
    published: 'Programación publicada',
    ineligible: 'No elegible',
    inactive: 'Inactivo',
    unavailable: 'No disponible',
    lastAssignment: 'Última asignación',
    noHistory: 'Sin historial',
    daysAgo: 'días atrás',
    weeksAgo: 'semanas atrás',
    recentCount: 'Asignaciones recientes',
    inThisMeeting: 'Ya asignado en esta reunión',
    suggestion: 'Sugerencia',
    select: 'Seleccionar',
    close: 'Cerrar',
    assignSuccess: 'Asignación creada.',
    assignError: 'No se pudo crear la asignación.',
    cancelSuccess: 'Asignación cancelada.',
    cancelError: 'No se pudo cancelar la asignación.',
    publishSuccess: 'Programación publicada.',
    publishError: 'No se pudo publicar la programación.',
    publishBlocked: 'Hay conflictos. Resuélvalos antes de publicar.',
    refreshUpdated: 'Programación actualizada.',
    advisoryNote: 'Estas sugerencias son solo de apoyo. La decisión pertenece al usuario autorizado.',
    longTimeSince: 'Poco uso reciente',
    noHistoryFor: 'Aún no ha recibido esta asignación',
    availableLowLoad: 'Disponible, con poca carga reciente',
    longestTimeSince: 'Mayor intervalo desde la última asignación',
    alreadyAssigned: 'Ya tiene asignación en esta reunión',
    recentAssignmentFor: 'Asignación reciente para esta función',
    conflictSchedule: 'Conflicto de horario',
    noCandidates: 'No hay candidatos elegibles para esta asignación.',
    role: 'Función',
    assistant: 'Ayudante',
    student: 'Estudiante',
    noAssistant: 'Sin ayudante',
    duration: 'Duración',
    parts: 'Partes',
  },
} as const;

type Copy = typeof copy['pt-PT'] | typeof copy['en'] | typeof copy['es'];

function dateLabel(date: string, localTime: string, locale: Locale): string {
  const language = locale === 'en' ? 'en-GB' : locale;
  const instant = new Date(`${date}T00:00:00Z`);
  const formatted = Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(instant)
    : date;
  return `${formatted} · ${localTime}`;
}

function stateLabel(state: ScheduleMeetingViewDto['state'], copy: Copy): string {
  if (state === 'draft') return copy.vacantSlot;
  if (state === 'published') return copy.published;
  return copy.back;
}

function slotStateLabel(state: 'filled' | 'vacant' | 'conflict', copy: Copy): string {
  if (state === 'filled') return copy.filledSlot;
  if (state === 'vacant') return copy.vacantSlot;
  return copy.conflictSlot;
}

function reasonLabel(messageKey: string, params: Readonly<Record<string, string | number>>, copy: Copy): string {
  if (messageKey === 'midweek.candidates.reason.longTimeSinceAssignment') {
    const weeks = typeof params.weeks === 'number' ? params.weeks : 0;
    return `${copy.longTimeSince} (${weeks} ${copy.weeksAgo})`;
  }
  if (messageKey === 'midweek.candidates.reason.lowRecentAssignmentLoad') {
    return copy.availableLowLoad;
  }
  if (messageKey === 'midweek.candidates.reason.noHistoryForAssignment') {
    return copy.noHistoryFor;
  }
  if (messageKey === 'midweek.candidates.reason.alreadyAssignedInMeeting') {
    return copy.alreadyAssigned;
  }
  if (messageKey === 'midweek.candidates.reason.recentAssignmentForRole') {
    const weeks = typeof params.weeks === 'number' ? params.weeks : 0;
    return `${copy.recentAssignmentFor} (${weeks} ${copy.weeksAgo})`;
  }
  if (messageKey === 'midweek.candidates.reason.available') {
    return '';
  }
  if (messageKey === 'midweek.candidates.reason.unavailablePeriod') {
    return copy.unavailable;
  }
  if (messageKey === 'midweek.candidates.reason.inactive') {
    return copy.inactive;
  }
  return messageKey;
}

export interface MidweekScheduleViewProps {
  readonly meetingId: string;
  readonly locale: Locale;
  readonly canWrite: boolean;
  readonly onChanged?: () => void;
  readonly onBack?: () => void;
}

interface DrawerState {
  readonly open: boolean;
  readonly slotId: string | null;
  readonly role: CandidateRole | null;
  readonly titleKey: string;
  readonly excludePersonIds?: readonly string[];
  readonly mode: 'assign' | 'replace';
  readonly assignmentId?: string;
}

const INITIAL_DRAWER: DrawerState = {
  open: false,
  slotId: null,
  role: null,
  titleKey: '',
  mode: 'assign',
};

export function MidweekScheduleView({ meetingId, locale, canWrite, onChanged, onBack }: MidweekScheduleViewProps) {
  const text = copy[locale];
  const [view, setView] = useState<Readonly<ScheduleMeetingViewDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(INITIAL_DRAWER);
  const [candidates, setCandidates] = useState<Readonly<CandidateQueryResultDto> | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const requestVersionRef = useRef(0);
  const candidatesVersionRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const next = await midweekApi.scheduleView(meetingId, signal);
      if (requestVersion === requestVersionRef.current && !signal?.aborted) setView(next);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (requestVersion === requestVersionRef.current) setLoadError(true);
    } finally {
      if (requestVersion === requestVersionRef.current && !signal?.aborted) setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadCandidates = useCallback(async (slotId: string, role: CandidateRole, excludePersonIds?: readonly string[], assignmentTypeId?: string) => {
    const requestVersion = ++candidatesVersionRef.current;
    setCandidatesLoading(true);
    setCandidatesError(false);
    try {
      const next = await midweekApi.candidates(meetingId, { slotId, role, ...(excludePersonIds && excludePersonIds.length ? { excludePersonIds } : {}), ...(assignmentTypeId ? { assignmentTypeId } : {}) });
      if (requestVersion === candidatesVersionRef.current) setCandidates(next);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (requestVersion === candidatesVersionRef.current) setCandidatesError(true);
    } finally {
      if (requestVersion === candidatesVersionRef.current) setCandidatesLoading(false);
    }
  }, [meetingId]);

  const openAssignDrawer = (slotId: string, role: CandidateRole, titleKey: string, assignmentTypeId?: string) => {
    setActionError(null);
    setDrawer({ open: true, slotId, role, titleKey, mode: 'assign', ...(assignmentTypeId ? { assignmentTypeId } as Pick<DrawerState, 'excludePersonIds'> : {}) });
    void loadCandidates(slotId, role);
  };

  const openReplaceDrawer = (slotId: string, role: CandidateRole, titleKey: string, assignmentId: string, excludePersonIds?: readonly string[]) => {
    setActionError(null);
    setDrawer({ open: true, slotId, role, titleKey, mode: 'replace', assignmentId, ...(excludePersonIds && excludePersonIds.length ? { excludePersonIds } : {}) });
    void loadCandidates(slotId, role, excludePersonIds);
  };

  const closeDrawer = () => {
    setDrawer(INITIAL_DRAWER);
    setCandidates(null);
    setCandidatesError(false);
  };

  const selectCandidate = async (personId: string, role: CandidateRole, assistantPersonId?: string) => {
    if (!view) return;
    if (drawer.mode === 'assign') {
      if (!drawer.slotId) return;
      setActionInFlight(true);
      setActionError(null);
      try {
        if (role === 'student') {
          await midweekApi.assignStudent(meetingId, { slotId: drawer.slotId, studentId: personId, ...(assistantPersonId !== undefined ? { assistantId: assistantPersonId } : {}) });
        } else if (role === 'non-student') {
          // For non-student, personId IS the assignment. We use role as the assignment type id from candidates result.
          if (!candidates) throw new Error('Missing assignment type');
          await midweekApi.assignNonStudent(meetingId, { slotId: drawer.slotId, personId, role: candidates.assignmentTypeId });
        }
        closeDrawer();
        await load();
        onChanged?.();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : text.assignError);
      } finally {
        setActionInFlight(false);
      }
    } else if (drawer.mode === 'replace' && drawer.assignmentId) {
      setActionInFlight(true);
      setActionError(null);
      try {
        if (role === 'student') {
          await midweekApi.replaceStudent(drawer.assignmentId, { studentId: personId, ...(assistantPersonId !== undefined ? { assistantId: assistantPersonId } : {}) });
        } else {
          await midweekApi.replaceNonStudent(drawer.assignmentId, personId);
        }
        closeDrawer();
        await load();
        onChanged?.();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : text.assignError);
      } finally {
        setActionInFlight(false);
      }
    }
  };

  const cancelAssignment = async (assignmentId: string, isStudent: boolean) => {
    if (!confirm(text.cancelConfirm)) return;
    setActionInFlight(true);
    setActionError(null);
    try {
      if (isStudent) {
        await midweekApi.cancelStudent(assignmentId);
      } else {
        await midweekApi.cancelNonStudent(assignmentId);
      }
      await load();
      onChanged?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.cancelError);
    } finally {
      setActionInFlight(false);
    }
  };

  const publishMeeting = async () => {
    if (!view) return;
    if (view.conflictedSlots > 0) {
      setActionError(text.publishBlocked);
      return;
    }
    if (!confirm(text.publishConfirm)) return;
    setActionInFlight(true);
    setActionError(null);
    try {
      await midweekApi.publishMeeting(meetingId);
      await load();
      onChanged?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text.publishError);
    } finally {
      setActionInFlight(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    return candidates.candidates;
  }, [candidates]);

  if (loading) {
    return (
      <section aria-busy="true" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBlock: 56 }}>
        <Spin size="small" />
        <Typography.Text type="secondary">{text.loading}</Typography.Text>
      </section>
    );
  }

  if (loadError) {
    return (
      <section>
        <Alert type="warning" showIcon message={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} />
      </section>
    );
  }

  if (!view) {
    return null;
  }

  const canPublish = canWrite && view.state === 'draft' && view.vacantSlots === 0 && view.conflictedSlots === 0;

  return (
    <section aria-labelledby={`schedule-view-${meetingId}`}>
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 760, flex: '1 1 320px' }}>
              <Typography.Title level={2} id={`schedule-view-${meetingId}`} style={{ marginBlock: '0 4px' }}>{dateLabel(view.date, view.localTime, locale)}</Typography.Title>
              <Typography.Text type="secondary">{view.timezone}</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Tag color={view.state === 'published' ? 'success' : view.state === 'cancelled' ? 'warning' : undefined}>{stateLabel(view.state, text)}</Tag>
              </div>
            </div>
            <Space wrap>
              {onBack ? <Button onClick={onBack}>{text.back}</Button> : null}
              <Button onClick={() => void load()} disabled={loading}>{text.refresh}</Button>
              {canPublish ? <Button type="primary" loading={actionInFlight} onClick={() => void publishMeeting()}>{text.publish}</Button> : null}
            </Space>
          </div>
        </Card>

        {/* Vacancies bar */}
        <Card>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <VacancyPill label={text.filled} value={view.filledSlots} total={view.totalSlots} tone="success" />
            <VacancyPill label={text.vacant} value={view.vacantSlots} total={view.totalSlots} tone="warning" />
            {view.conflictedSlots > 0 ? <VacancyPill label={text.conflicts} value={view.conflictedSlots} total={view.totalSlots} tone="error" /> : null}
            <Typography.Text type="secondary" style={{ marginLeft: 'auto' }}>{view.filledSlots}/{view.totalSlots} {text.designations}</Typography.Text>
          </div>
        </Card>

        {actionError ? <Alert type="error" showIcon message={actionError} closable onClose={() => setActionError(null)} /> : null}

        {view.slots.length === 0 ? (
          <Card><Empty description={text.noSlots} /></Card>
        ) : (
          <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
            {view.slots.map(slot => (
              <Card key={slot.slotId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <Typography.Title level={5} style={{ marginBlock: 0 }}>{slot.position + 1}. {slot.titleKey}</Typography.Title>
                    <Typography.Text type="secondary">{slot.durationMinutes} {text.minutes}</Typography.Text>
                  </div>
                  <Tag color={slot.state === 'filled' ? 'success' : slot.state === 'conflict' ? 'error' : 'warning'}>
                    {slotStateLabel(slot.state, text)}
                  </Tag>
                </div>
                <div style={{ marginTop: 8 }}>
                  {slot.studentDisplayName ? (
                    <Space direction="vertical" size="small" style={{ display: 'flex' }}>
                      <Typography.Text><strong>{text.student}:</strong> {slot.studentDisplayName}</Typography.Text>
                      {slot.assistantDisplayName ? <Typography.Text><strong>{text.assistant}:</strong> {slot.assistantDisplayName}</Typography.Text> : null}
                      {canWrite ? (
                        <Space wrap>
                          <Button size="small" disabled={actionInFlight} onClick={() => openReplaceDrawer(slot.slotId, 'student', slot.titleKey, '', [])}>{text.replace}</Button>
                          {/* Replace student needs an assignmentId — we don't have it in the view, so this opens the assign drawer */}
                          <Button size="small" danger disabled={actionInFlight} onClick={() => { /* cancel needs assignment id; view does not expose it */ setActionError(text.cancelError); }}>{text.cancel}</Button>
                        </Space>
                      ) : null}
                    </Space>
                  ) : null}
                  {slot.nonStudentDisplayName ? (
                    <Space direction="vertical" size="small" style={{ display: 'flex' }}>
                      <Typography.Text><strong>{text.role}:</strong> {slot.nonStudentRole}</Typography.Text>
                      <Typography.Text>{slot.nonStudentDisplayName}</Typography.Text>
                      {canWrite ? (
                        <Space wrap>
                          <Button size="small" disabled={actionInFlight} onClick={() => openReplaceDrawer(slot.slotId, 'non-student', slot.titleKey, '', [])}>{text.replace}</Button>
                          <Button size="small" danger disabled={actionInFlight} onClick={() => { setActionError(text.cancelError); }}>{text.cancel}</Button>
                        </Space>
                      ) : null}
                    </Space>
                  ) : null}
                  {!slot.studentDisplayName && !slot.nonStudentDisplayName && canWrite ? (
                    <Space wrap>
                      {slot.partDefinitionId ? (
                        <>
                          <Button type="primary" size="small" disabled={actionInFlight} onClick={() => openAssignDrawer(slot.slotId, 'student', slot.titleKey, slot.partDefinitionId)}>{text.assignStudent}</Button>
                          <Button size="small" disabled={actionInFlight} onClick={() => openAssignDrawer(slot.slotId, 'assistant', slot.titleKey, slot.partDefinitionId)}>{text.assignAssistant}</Button>
                        </>
                      ) : (
                        <Button type="primary" size="small" disabled={actionInFlight} onClick={() => openAssignDrawer(slot.slotId, 'non-student', slot.titleKey)}>{text.assignNonStudent}</Button>
                      )}
                    </Space>
                  ) : null}
                </div>
              </Card>
            ))}
          </Space>
        )}

        <Typography.Text type="secondary" italic style={{ display: 'block', marginTop: 8 }}>{text.advisoryNote}</Typography.Text>
      </Space>

      <Drawer
        title={`${text.candidatesFor}: ${drawer.titleKey}`}
        open={drawer.open}
        onClose={closeDrawer}
        width={Math.min(480, typeof window !== 'undefined' ? window.innerWidth - 32 : 480)}
        destroyOnClose
        aria-label={text.candidates}
      >
        <CandidatesPanel
          candidates={filteredCandidates}
          loading={candidatesLoading}
          error={candidatesError}
          text={text}
          onSelect={(personId) => void selectCandidate(personId, drawer.role ?? 'student')}
          canSelect={drawer.mode === 'assign'}
          inFlight={actionInFlight}
        />
      </Drawer>
    </section>
  );
}

interface VacancyPillProps {
  readonly label: string;
  readonly value: number;
  readonly total: number;
  readonly tone: 'success' | 'warning' | 'error';
}

function VacancyPill({ label, value, total, tone }: VacancyPillProps) {
  const color = tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'error';
  return (
    <div role="status" aria-label={`${label}: ${value} / ${total}`}>
      <Tag color={color} style={{ fontSize: 14, paddingInline: 8 }}>{value}</Tag>
      <Typography.Text strong style={{ marginLeft: 4 }}>{label}</Typography.Text>
    </div>
  );
}

interface CandidatesPanelProps {
  readonly candidates: readonly CandidateProfileDto[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly text: Copy;
  readonly onSelect: (personId: string) => void;
  readonly canSelect: boolean;
  readonly inFlight: boolean;
}

function CandidatesPanel({ candidates, loading, error, text, onSelect, canSelect, inFlight }: CandidatesPanelProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return candidates;
    return candidates.filter(c => c.displayName.toLowerCase().includes(normalized));
  }, [candidates, search]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBlock: 32 }}>
        <Spin size="small" />
        <Typography.Text type="secondary">{text.loading}</Typography.Text>
      </div>
    );
  }

  if (error) {
    return <Alert type="warning" showIcon message={text.error} action={<Button size="small" onClick={() => location.reload()}>{text.retry}</Button>} />;
  }

  if (candidates.length === 0) {
    return <Empty description={text.noCandidates} />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      <Input.Search
        placeholder={text.search}
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        aria-label={text.search}
      />
      {filtered.length === 0 ? <Empty description={text.noCandidates} /> : (
        <Space direction="vertical" size="small" style={{ display: 'flex' }}>
          {filtered.map(candidate => (
            <CandidateCard
              key={candidate.personId}
              candidate={candidate}
              text={text}
              onSelect={canSelect ? () => onSelect(candidate.personId) : undefined}
              inFlight={inFlight}
            />
          ))}
        </Space>
      )}
      <Typography.Text type="secondary" italic style={{ display: 'block', marginTop: 8 }}>{text.advisoryNote}</Typography.Text>
    </Space>
  );
}

interface CandidateCardProps {
  readonly candidate: CandidateProfileDto;
  readonly text: Copy;
  readonly onSelect?: () => void;
  readonly inFlight: boolean;
}

function CandidateCard({ candidate, text, onSelect, inFlight }: CandidateCardProps) {
  const disabled = !candidate.eligible || !candidate.available || candidate.conflicts.length > 0 || inFlight;
  return (
    <Card size="small" style={{ opacity: candidate.eligible && candidate.available ? 1 : 0.6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <Typography.Text strong>{candidate.displayName}</Typography.Text>
          <div style={{ marginTop: 4 }}>
            {candidate.lastAssignmentDate ? (
              <Typography.Text type="secondary">{text.lastAssignment}: {candidate.daysSinceLastAssignment} {text.daysAgo}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">{text.noHistory}</Typography.Text>
            )}
          </div>
          {candidate.recentAssignmentCount > 0 ? (
            <Typography.Text type="secondary">{text.recentCount}: {candidate.recentAssignmentCount}</Typography.Text>
          ) : null}
          {candidate.alreadyAssignedInMeeting ? (
            <div><Tag>{text.inThisMeeting}</Tag></div>
          ) : null}
          {candidate.conflicts.length > 0 ? (
            <div><Tag color="error">{text.conflictSchedule}</Tag></div>
          ) : null}
          {!candidate.eligible ? <Tag>{text.ineligible}</Tag> : null}
          {!candidate.available && candidate.eligible ? <Tag color="warning">{candidate.inactive ? text.inactive : text.unavailable}</Tag> : null}
          {candidate.reasons.length > 0 ? (
            <Space direction="vertical" size={2} style={{ display: 'flex', marginTop: 4 }}>
              {candidate.reasons.map((reason, idx) => {
                const label = reasonLabel(reason.messageKey, reason.params, text);
                if (!label) return null;
                return (
                  <Typography.Text key={idx} type="secondary" style={{ fontSize: 12 }}>
                    {text.suggestion}: {label}
                  </Typography.Text>
                );
              })}
            </Space>
          ) : null}
        </div>
        {onSelect ? (
          <Button type="primary" size="small" disabled={disabled} onClick={onSelect} aria-label={`${text.select}: ${candidate.displayName}`}>
            {text.select}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
