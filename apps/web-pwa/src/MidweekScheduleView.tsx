import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Drawer from 'antd/es/drawer';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  midweekApi,
  type CandidateProfileDto,
  type CandidateQueryResultDto,
  type CandidateRole,
  type ScheduleMeetingViewDto,
  type ScheduleSlotViewDto,
} from './lib/midweekApi';
import {
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  STANDARD_NON_STUDENT_ROLES,
  builtinPart,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': {
    loading: 'A carregar a programação…', error: 'Não foi possível carregar a programação.', retry: 'Tentar novamente', refresh: 'Atualizar', back: 'Voltar',
    filled: 'Preenchidas', vacant: 'Vagas', conflicts: 'Conflitos', designations: 'designações', noSlots: 'Ainda não existem partes nesta reunião.', minutes: 'min',
    candidates: 'Candidatos', candidatesFor: 'Candidatos para', search: 'Procurar por nome…', assignStudent: 'Designar estudante', assignRole: 'Designar função', replace: 'Substituir', cancel: 'Remover',
    cancelConfirm: 'Tem a certeza que pretende cancelar esta designação? O histórico será mantido.', publish: 'Publicar programação', publishConfirm: 'Publicar a programação?', publishBlocked: 'Existem conflitos. Resolva-os antes de publicar.',
    assignError: 'Não foi possível concluir a designação.', cancelError: 'Não foi possível cancelar a designação.', publishError: 'Não foi possível publicar a programação.',
    ineligible: 'Não elegível', inactive: 'Inativo', unavailable: 'Indisponível', noHistory: 'Sem histórico nesta função', lastAssignment: 'Última designação', recentCount: 'Designações recentes', inThisMeeting: 'Já designado nesta reunião', select: 'Selecionar',
    noCandidates: 'Não existem candidatos válidos para esta designação.', student: 'Estudante', assistant: 'Ajudante', role: 'Função', noAssistant: 'Sem ajudante', chooseRole: 'Selecionar função', customRole: 'Outra função…', customRoleId: 'Identificador da função', continue: 'Continuar',
    skipAssistant: 'Continuar sem ajudante', assistantRequired: 'Selecione o ajudante obrigatório.', assistantOptional: 'Pode selecionar um ajudante ou continuar sem ajudante.',
    advisory: 'As sugestões servem apenas como apoio. A decisão da designação pertence ao utilizador autorizado.', draft: 'Rascunho', published: 'Publicada', cancelled: 'Cancelada', archived: 'Arquivada', filledSlot: 'Designado', vacantSlot: 'Por designar', conflictSlot: 'Conflito',
  },
  en: {
    loading: 'Loading the schedule…', error: 'The schedule could not be loaded.', retry: 'Try again', refresh: 'Refresh', back: 'Back',
    filled: 'Filled', vacant: 'Vacant', conflicts: 'Conflicts', designations: 'assignments', noSlots: 'There are no parts in this meeting yet.', minutes: 'min',
    candidates: 'Candidates', candidatesFor: 'Candidates for', search: 'Search by name…', assignStudent: 'Assign student', assignRole: 'Assign role', replace: 'Replace', cancel: 'Remove',
    cancelConfirm: 'Cancel this assignment? Its history will be kept.', publish: 'Publish schedule', publishConfirm: 'Publish the schedule?', publishBlocked: 'There are conflicts. Resolve them before publishing.',
    assignError: 'The assignment could not be completed.', cancelError: 'The assignment could not be cancelled.', publishError: 'The schedule could not be published.',
    ineligible: 'Not eligible', inactive: 'Inactive', unavailable: 'Unavailable', noHistory: 'No history for this role', lastAssignment: 'Last assignment', recentCount: 'Recent assignments', inThisMeeting: 'Already assigned in this meeting', select: 'Select',
    noCandidates: 'There are no valid candidates for this assignment.', student: 'Student', assistant: 'Assistant', role: 'Role', noAssistant: 'No assistant', chooseRole: 'Select role', customRole: 'Another role…', customRoleId: 'Role identifier', continue: 'Continue',
    skipAssistant: 'Continue without assistant', assistantRequired: 'Select the required assistant.', assistantOptional: 'Select an assistant or continue without one.',
    advisory: 'These suggestions are advisory only. The decision belongs to the authorized user.', draft: 'Draft', published: 'Published', cancelled: 'Cancelled', archived: 'Archived', filledSlot: 'Assigned', vacantSlot: 'Unassigned', conflictSlot: 'Conflict',
  },
  es: {
    loading: 'Cargando la programación…', error: 'No se pudo cargar la programación.', retry: 'Intentar de nuevo', refresh: 'Actualizar', back: 'Volver',
    filled: 'Llenas', vacant: 'Vacantes', conflicts: 'Conflictos', designations: 'asignaciones', noSlots: 'Todavía no hay partes en esta reunión.', minutes: 'min',
    candidates: 'Candidatos', candidatesFor: 'Candidatos para', search: 'Buscar por nombre…', assignStudent: 'Asignar estudiante', assignRole: 'Asignar función', replace: 'Sustituir', cancel: 'Quitar',
    cancelConfirm: '¿Cancelar esta asignación? Se mantendrá su historial.', publish: 'Publicar programación', publishConfirm: '¿Publicar la programación?', publishBlocked: 'Hay conflictos. Resuélvalos antes de publicar.',
    assignError: 'No se pudo completar la asignación.', cancelError: 'No se pudo cancelar la asignación.', publishError: 'No se pudo publicar la programación.',
    ineligible: 'No elegible', inactive: 'Inactivo', unavailable: 'No disponible', noHistory: 'Sin historial en esta función', lastAssignment: 'Última asignación', recentCount: 'Asignaciones recientes', inThisMeeting: 'Ya asignado en esta reunión', select: 'Seleccionar',
    noCandidates: 'No hay candidatos válidos para esta asignación.', student: 'Estudiante', assistant: 'Ayudante', role: 'Función', noAssistant: 'Sin ayudante', chooseRole: 'Seleccionar función', customRole: 'Otra función…', customRoleId: 'Identificador de función', continue: 'Continuar',
    skipAssistant: 'Continuar sin ayudante', assistantRequired: 'Seleccione el ayudante obligatorio.', assistantOptional: 'Puede seleccionar un ayudante o continuar sin uno.',
    advisory: 'Estas sugerencias son solo de apoyo. La decisión pertenece al usuario autorizado.', draft: 'Borrador', published: 'Publicada', cancelled: 'Cancelada', archived: 'Archivada', filledSlot: 'Asignado', vacantSlot: 'Sin asignar', conflictSlot: 'Conflicto',
  },
} as const;

type Copy = { [K in keyof typeof copy['pt-PT']]: string };

type DrawerState = Readonly<{
  open: boolean;
  mode: 'assign' | 'replace';
  slotId: string;
  role: CandidateRole;
  titleKey: string;
  assignmentId?: string;
  assignmentTypeId?: string;
  excludePersonIds?: readonly string[];
  pendingStudentId?: string;
  preservedAssistantId?: string | null;
  assistantRequirement?: 'none' | 'optional' | 'required';
}>;

const CLOSED_DRAWER: DrawerState = Object.freeze({ open: false, mode: 'assign', slotId: '', role: 'student', titleKey: '' });

function dateLabel(date: string, localTime: string, locale: Locale): string {
  const language = locale === 'en' ? 'en-GB' : locale;
  const instant = new Date(`${date}T00:00:00Z`);
  const formatted = Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat(language, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(instant)
    : date;
  return `${formatted} · ${localTime}`;
}

function stateLabel(state: ScheduleMeetingViewDto['state'], text: Copy): string {
  if (state === 'published') return text.published;
  if (state === 'cancelled') return text.cancelled;
  if (state === 'archived') return text.archived;
  return text.draft;
}

function slotStateLabel(state: ScheduleSlotViewDto['state'], text: Copy): string {
  if (state === 'filled') return text.filledSlot;
  if (state === 'conflict') return text.conflictSlot;
  return text.vacantSlot;
}

function validCandidate(candidate: CandidateProfileDto): boolean {
  return candidate.eligible && candidate.available && !candidate.inactive && candidate.conflicts.length === 0;
}

function candidateHint(candidate: CandidateProfileDto, text: Copy): string {
  if (candidate.inactive) return text.inactive;
  if (!candidate.eligible) return text.ineligible;
  if (!candidate.available || candidate.conflicts.length > 0) return text.unavailable;
  if (candidate.lastAssignmentDate === null) return text.noHistory;
  if (candidate.alreadyAssignedInMeeting) return text.inThisMeeting;
  return `${text.lastAssignment}: ${candidate.lastAssignmentDate} · ${text.recentCount}: ${candidate.recentAssignmentCount}`;
}

export function MidweekScheduleView({
  meetingId,
  locale,
  canWrite,
  onChanged,
  onBack,
}: {
  meetingId: string;
  locale: Locale;
  canWrite: boolean;
  onChanged?: () => void | Promise<void>;
  onBack?: () => void;
}) {
  const text = copy[locale] as Copy;
  const [view, setView] = useState<Readonly<ScheduleMeetingViewDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED_DRAWER);
  const [candidates, setCandidates] = useState<Readonly<CandidateQueryResultDto> | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [roleChoiceBySlot, setRoleChoiceBySlot] = useState<Record<string, string>>({});
  const [customRoleBySlot, setCustomRoleBySlot] = useState<Record<string, string>>({});
  const requestVersionRef = useRef(0);
  const candidateVersionRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersionRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const next = await midweekApi.scheduleView(meetingId, signal);
      if (version === requestVersionRef.current && !signal?.aborted) setView(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (version === requestVersionRef.current) setLoadError(true);
    } finally {
      if (version === requestVersionRef.current && !signal?.aborted) setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadCandidates = useCallback(async (
    slotId: string,
    role: CandidateRole,
    assignmentTypeId?: string,
    excludePersonIds?: readonly string[],
  ) => {
    const version = ++candidateVersionRef.current;
    setCandidatesLoading(true);
    setCandidatesError(false);
    setCandidates(null);
    try {
      const next = await midweekApi.candidates(meetingId, {
        slotId,
        role,
        ...(assignmentTypeId ? { assignmentTypeId } : {}),
        ...(excludePersonIds?.length ? { excludePersonIds } : {}),
      });
      if (version === candidateVersionRef.current) setCandidates(next);
    } catch {
      if (version === candidateVersionRef.current) setCandidatesError(true);
    } finally {
      if (version === candidateVersionRef.current) setCandidatesLoading(false);
    }
  }, [meetingId]);

  const closeDrawer = () => {
    candidateVersionRef.current += 1;
    setDrawer(CLOSED_DRAWER);
    setCandidates(null);
    setCandidatesError(false);
  };

  const refreshAfterMutation = async () => {
    closeDrawer();
    await load();
    await onChanged?.();
  };

  const runMutation = async (operation: () => Promise<unknown>, fallback: string) => {
    if (actionInFlight) return false;
    setActionInFlight(true);
    setActionError(null);
    try {
      await operation();
      await refreshAfterMutation();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : fallback);
      return false;
    } finally {
      setActionInFlight(false);
    }
  };

  const openStudentAssign = (slot: ScheduleSlotViewDto) => {
    if (!slot.partDefinitionId) return;
    const part = builtinPart(slot.partDefinitionId);
    setActionError(null);
    setDrawer({
      open: true,
      mode: 'assign',
      slotId: slot.slotId,
      role: 'student',
      titleKey: slot.titleKey,
      assignmentTypeId: slot.partDefinitionId,
      assistantRequirement: part?.assistantRequirement ?? 'none',
    });
    void loadCandidates(slot.slotId, 'student');
  };

  const openStudentReplace = (slot: ScheduleSlotViewDto) => {
    if (!slot.studentAssignmentId || !slot.partDefinitionId) return;
    const excludes = slot.assistantId ? [slot.assistantId] : [];
    setActionError(null);
    setDrawer({
      open: true,
      mode: 'replace',
      slotId: slot.slotId,
      role: 'student',
      titleKey: slot.titleKey,
      assignmentId: slot.studentAssignmentId,
      assignmentTypeId: slot.partDefinitionId,
      excludePersonIds: excludes,
      preservedAssistantId: slot.assistantId,
    });
    void loadCandidates(slot.slotId, 'student', undefined, excludes);
  };

  const resolvedRoleForSlot = (slotId: string): string => resolveAssignmentTypeChoice(
    roleChoiceBySlot[slotId] ?? '',
    customRoleBySlot[slotId] ?? '',
  );

  const openNonStudentAssign = (slot: ScheduleSlotViewDto) => {
    const role = resolvedRoleForSlot(slot.slotId);
    if (!role) {
      setActionError(text.chooseRole);
      return;
    }
    setActionError(null);
    setDrawer({ open: true, mode: 'assign', slotId: slot.slotId, role: 'non-student', titleKey: slot.titleKey, assignmentTypeId: role });
    void loadCandidates(slot.slotId, 'non-student', role);
  };

  const openNonStudentReplace = (slot: ScheduleSlotViewDto) => {
    if (!slot.nonStudentAssignmentId || !slot.nonStudentRole) return;
    setActionError(null);
    setDrawer({ open: true, mode: 'replace', slotId: slot.slotId, role: 'non-student', titleKey: slot.titleKey, assignmentId: slot.nonStudentAssignmentId, assignmentTypeId: slot.nonStudentRole });
    void loadCandidates(slot.slotId, 'non-student', slot.nonStudentRole);
  };

  const completeStudentAssignment = async (studentId: string, assistantId?: string | null) => {
    await runMutation(
      () => midweekApi.assignStudent(meetingId, { slotId: drawer.slotId, studentId, assistantId: assistantId ?? null }),
      text.assignError,
    );
  };

  const selectCandidate = async (candidate: CandidateProfileDto) => {
    if (!validCandidate(candidate)) return;

    if (drawer.mode === 'replace') {
      if (!drawer.assignmentId) return;
      if (drawer.role === 'student') {
        await runMutation(
          () => midweekApi.replaceStudent(drawer.assignmentId!, { studentId: candidate.personId, assistantId: drawer.preservedAssistantId ?? null }),
          text.assignError,
        );
      } else if (drawer.role === 'non-student') {
        await runMutation(() => midweekApi.replaceNonStudent(drawer.assignmentId!, candidate.personId), text.assignError);
      }
      return;
    }

    if (drawer.role === 'non-student') {
      if (!drawer.assignmentTypeId) return;
      await runMutation(
        () => midweekApi.assignNonStudent(meetingId, { slotId: drawer.slotId, personId: candidate.personId, role: drawer.assignmentTypeId! }),
        text.assignError,
      );
      return;
    }

    if (drawer.role === 'assistant') {
      if (!drawer.pendingStudentId) return;
      await completeStudentAssignment(drawer.pendingStudentId, candidate.personId);
      return;
    }

    const requirement = drawer.assistantRequirement ?? 'none';
    if (requirement === 'none') {
      await completeStudentAssignment(candidate.personId, null);
      return;
    }

    const nextDrawer: DrawerState = {
      ...drawer,
      role: 'assistant',
      pendingStudentId: candidate.personId,
      excludePersonIds: [candidate.personId],
    };
    setDrawer(nextDrawer);
    void loadCandidates(drawer.slotId, 'assistant', undefined, [candidate.personId]);
  };

  const cancelAssignment = async (assignmentId: string, student: boolean) => {
    if (!confirm(text.cancelConfirm)) return;
    await runMutation(
      () => student ? midweekApi.cancelStudent(assignmentId) : midweekApi.cancelNonStudent(assignmentId),
      text.cancelError,
    );
  };

  const publishMeeting = async () => {
    if (!view) return;
    if (view.vacantSlots > 0 || view.conflictedSlots > 0) {
      setActionError(text.publishBlocked);
      return;
    }
    if (!confirm(text.publishConfirm)) return;
    await runMutation(() => midweekApi.publishMeeting(meetingId), text.publishError);
  };

  const filteredCandidates = useMemo(() => candidates?.candidates ?? [], [candidates]);

  if (loading) {
    return <section aria-busy="true" role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBlock: 56 }}><Spin size="small" /><Typography.Text type="secondary">{text.loading}</Typography.Text></section>;
  }
  if (loadError) {
    return <Alert type="warning" showIcon title={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} />;
  }
  if (!view) return null;

  const canPublish = canWrite && view.state === 'draft' && view.vacantSlots === 0 && view.conflictedSlots === 0;

  return <section aria-labelledby={`schedule-view-${meetingId}`}>
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Typography.Title level={2} id={`schedule-view-${meetingId}`} style={{ marginBlock: '0 4px' }}>{dateLabel(view.date, view.localTime, locale)}</Typography.Title>
            <Typography.Text type="secondary">{view.timezone}</Typography.Text>
            <div style={{ marginTop: 8 }}><Tag color={view.state === 'published' ? 'success' : view.state === 'cancelled' ? 'warning' : undefined}>{stateLabel(view.state, text)}</Tag></div>
          </div>
          <Space wrap>
            {onBack ? <Button onClick={onBack}>{text.back}</Button> : null}
            <Button onClick={() => void load()}>{text.refresh}</Button>
            {canPublish ? <Button type="primary" loading={actionInFlight} onClick={() => void publishMeeting()}>{text.publish}</Button> : null}
          </Space>
        </div>
      </Card>

      <Card>
        <Space wrap size="large">
          <StatisticPill label={text.filled} value={view.filledSlots} total={view.totalSlots} tone="success" />
          <StatisticPill label={text.vacant} value={view.vacantSlots} total={view.totalSlots} tone="warning" />
          {view.conflictedSlots > 0 ? <StatisticPill label={text.conflicts} value={view.conflictedSlots} total={view.totalSlots} tone="error" /> : null}
          <Typography.Text type="secondary">{view.filledSlots}/{view.totalSlots} {text.designations}</Typography.Text>
        </Space>
      </Card>

      {actionError ? <Alert type="error" showIcon title={actionError} closable onClose={() => setActionError(null)} /> : null}

      {view.slots.length === 0 ? <Card><Empty description={text.noSlots} /></Card> : <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        {view.slots.map(slot => {
          const part = builtinPart(slot.partDefinitionId);
          const canAssignStudent = Boolean(slot.partDefinitionId && part?.studentNeeded);
          const roleChoice = roleChoiceBySlot[slot.slotId] ?? '';
          return <Card key={slot.slotId}>
            <Space direction="vertical" size="small" style={{ display: 'flex' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div><Typography.Title level={5} style={{ marginBlock: 0 }}>{slot.position + 1}. {slot.titleKey}</Typography.Title><Typography.Text type="secondary">{slot.durationMinutes} {text.minutes}</Typography.Text></div>
                <Tag color={slot.state === 'filled' ? 'success' : slot.state === 'conflict' ? 'error' : 'warning'}>{slotStateLabel(slot.state, text)}</Tag>
              </div>

              {slot.studentDisplayName ? <>
                <Typography.Text><strong>{text.student}:</strong> {slot.studentDisplayName}</Typography.Text>
                <Typography.Text><strong>{text.assistant}:</strong> {slot.assistantDisplayName ?? text.noAssistant}</Typography.Text>
                {canWrite && slot.studentAssignmentId ? <Space wrap>
                  <Button size="small" disabled={actionInFlight} onClick={() => openStudentReplace(slot)}>{text.replace}</Button>
                  <Button size="small" danger disabled={actionInFlight} onClick={() => void cancelAssignment(slot.studentAssignmentId!, true)}>{text.cancel}</Button>
                </Space> : null}
              </> : null}

              {slot.nonStudentDisplayName ? <>
                <Typography.Text><strong>{text.role}:</strong> {slot.nonStudentRole}</Typography.Text>
                <Typography.Text>{slot.nonStudentDisplayName}</Typography.Text>
                {canWrite && slot.nonStudentAssignmentId ? <Space wrap>
                  <Button size="small" disabled={actionInFlight} onClick={() => openNonStudentReplace(slot)}>{text.replace}</Button>
                  <Button size="small" danger disabled={actionInFlight} onClick={() => void cancelAssignment(slot.nonStudentAssignmentId!, false)}>{text.cancel}</Button>
                </Space> : null}
              </> : null}

              {!slot.studentDisplayName && !slot.nonStudentDisplayName && canWrite ? <Space direction="vertical" size="small" style={{ display: 'flex' }}>
                {canAssignStudent ? <Button type="primary" size="small" disabled={actionInFlight} onClick={() => openStudentAssign(slot)}>{text.assignStudent}</Button> : null}
                {!canAssignStudent ? <>
                  <Select
                    aria-label={text.chooseRole}
                    placeholder={text.chooseRole}
                    value={roleChoice || undefined}
                    onChange={value => setRoleChoiceBySlot(current => ({ ...current, [slot.slotId]: value }))}
                    options={[
                      ...STANDARD_NON_STUDENT_ROLES.map(option => ({ value: option.id, label: option.label[locale] })),
                      { value: CUSTOM_ASSIGNMENT_TYPE_CHOICE, label: text.customRole },
                    ]}
                    style={{ width: 'min(100%, 360px)' }}
                  />
                  {roleChoice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? <Input aria-label={text.customRoleId} placeholder={text.customRoleId} value={customRoleBySlot[slot.slotId] ?? ''} onChange={event => setCustomRoleBySlot(current => ({ ...current, [slot.slotId]: event.target.value }))} maxLength={200} /> : null}
                  <Button type="primary" size="small" disabled={actionInFlight || !resolvedRoleForSlot(slot.slotId)} onClick={() => openNonStudentAssign(slot)}>{text.assignRole}</Button>
                </> : null}
              </Space> : null}
            </Space>
          </Card>;
        })}
      </Space>}

      <Typography.Text type="secondary" italic>{text.advisory}</Typography.Text>
    </Space>

    <Drawer
      title={`${text.candidatesFor}: ${drawer.titleKey}`}
      open={drawer.open}
      onClose={closeDrawer}
      width={Math.min(480, typeof window !== 'undefined' ? window.innerWidth - 32 : 480)}
      destroyOnClose
      aria-label={text.candidates}
    >
      {drawer.role === 'assistant' ? <Alert type="info" showIcon title={drawer.assistantRequirement === 'required' ? text.assistantRequired : text.assistantOptional} style={{ marginBottom: 16 }} /> : null}
      {drawer.role === 'assistant' && drawer.assistantRequirement === 'optional' && drawer.pendingStudentId ? <Button block style={{ marginBottom: 16 }} disabled={actionInFlight} onClick={() => void completeStudentAssignment(drawer.pendingStudentId!, null)}>{text.skipAssistant}</Button> : null}
      <CandidatesPanel candidates={filteredCandidates} loading={candidatesLoading} error={candidatesError} text={text} onSelect={candidate => void selectCandidate(candidate)} inFlight={actionInFlight} />
    </Drawer>
  </section>;
}

function StatisticPill({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'success' | 'warning' | 'error' }) {
  return <div role="status" aria-label={`${label}: ${value} / ${total}`}><Tag color={tone}>{value}</Tag><Typography.Text strong>{label}</Typography.Text></div>;
}

function CandidatesPanel({
  candidates,
  loading,
  error,
  text,
  onSelect,
  inFlight,
}: {
  candidates: readonly CandidateProfileDto[];
  loading: boolean;
  error: boolean;
  text: Copy;
  onSelect: (candidate: CandidateProfileDto) => void;
  inFlight: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? candidates.filter(candidate => candidate.displayName.toLocaleLowerCase().includes(query)) : candidates;
  }, [candidates, search]);

  if (loading) return <div role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>;
  if (error) return <Alert type="warning" showIcon title={text.error} />;
  if (candidates.length === 0) return <Empty description={text.noCandidates} />;

  return <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
    <Input.Search allowClear value={search} onChange={event => setSearch(event.target.value)} placeholder={text.search} aria-label={text.search} />
    {filtered.map(candidate => {
      const selectable = validCandidate(candidate);
      return <Card key={candidate.personId} size="small">
        <Space direction="vertical" size="small" style={{ display: 'flex' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <Typography.Text strong>{candidate.displayName}</Typography.Text>
            {!candidate.eligible ? <Tag color="warning">{text.ineligible}</Tag> : candidate.conflicts.length > 0 || !candidate.available ? <Tag color="error">{text.unavailable}</Tag> : <Tag color="success">OK</Tag>}
          </div>
          <Typography.Text type="secondary">{candidateHint(candidate, text)}</Typography.Text>
          {selectable ? <Button type="primary" size="small" disabled={inFlight} onClick={() => onSelect(candidate)}>{text.select}</Button> : null}
        </Space>
      </Card>;
    })}
  </Space>;
}
