import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Divider from 'antd/es/divider';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { midweekApi, type MidweekMeetingDto, type NonStudentAssignmentDto, type StudentAssignmentDto } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import {
  BUILTIN_PARTS,
  builtinPart,
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  resolveAssignmentTypeChoice,
  slotAllowsStudentAssignment,
  STANDARD_NON_STUDENT_ROLES,
} from './lib/assignmentTypeCatalog';
import { RecommendationPicker } from './RecommendationPicker';

export { BUILTIN_PARTS, slotAllowsStudentAssignment };
export { StudentAssignmentControls, NonStudentAssignmentControls } from './MidweekAssignmentControls';

const copy = {
  'pt-PT': { createMeeting:'Nova reunião', meetingTitle:'Criar reunião', date:'Data', time:'Hora', timezone:'Fuso horário', location:'Local (opcional)', addPart:'Adicionar parte', partTitle:'Nova parte', titleKey:'Título / chave da parte', duration:'Duração (min)', partDefinition:'Tipo de parte', customPart:'Parte personalizada / função', assignStudent:'Designar estudante', assignRole:'Designar função', student:'Estudante', assistant:'Ajudante (opcional)', assistantRequired:'Ajudante (obrigatório)', person:'Pessoa', role:'Função', chooseRole:'Seleciona uma função', customRole:'Outra função personalizada…', customRoleId:'Identificador da função personalizada', none:'Sem ajudante', publish:'Publicar', removePart:'Remover parte', replace:'Substituir', cancelAssignment:'Cancelar designação', save:'Guardar', cancel:'Cancelar', working:'A guardar…', error:'Não foi possível concluir a operação.', publishConfirm:'Publicar esta reunião? Depois de publicada, as alterações ficam mais restritas.', confirm:'Confirmar', noPeople:'Não existem pessoas ativas disponíveis.', manualStudent:'Selecionar manualmente', hideManualStudent:'Ocultar seleção manual', manualStudentHint:'A seleção manual mostra pessoas ativas. Não afirma que estejam elegíveis, disponíveis ou sem conflitos para esta parte.' },
  en: { createMeeting:'New meeting', meetingTitle:'Create meeting', date:'Date', time:'Time', timezone:'Timezone', location:'Location (optional)', addPart:'Add part', partTitle:'New part', titleKey:'Part title / key', duration:'Duration (min)', partDefinition:'Part type', customPart:'Custom part / role', assignStudent:'Assign student', assignRole:'Assign role', student:'Student', assistant:'Assistant (optional)', assistantRequired:'Assistant (required)', person:'Person', role:'Role', chooseRole:'Select a role', customRole:'Another custom role…', customRoleId:'Custom role identifier', none:'No assistant', publish:'Publish', removePart:'Remove part', replace:'Replace', cancelAssignment:'Cancel assignment', save:'Save', cancel:'Cancel', working:'Saving…', error:'The operation could not be completed.', publishConfirm:'Publish this meeting? Changes become more restricted after publishing.', confirm:'Confirm', noPeople:'No active people are available.', manualStudent:'Select manually', hideManualStudent:'Hide manual selection', manualStudentHint:'Manual selection shows active people. It does not claim they are eligible, available or conflict-free for this part.' },
  es: { createMeeting:'Nueva reunión', meetingTitle:'Crear reunión', date:'Fecha', time:'Hora', timezone:'Zona horaria', location:'Lugar (opcional)', addPart:'Añadir parte', partTitle:'Nueva parte', titleKey:'Título / clave de la parte', duration:'Duración (min)', partDefinition:'Tipo de parte', customPart:'Parte personalizada / función', assignStudent:'Asignar estudiante', assignRole:'Asignar función', student:'Estudiante', assistant:'Ayudante (opcional)', assistantRequired:'Ayudante (obligatorio)', person:'Persona', role:'Función', chooseRole:'Selecciona una función', customRole:'Otra función personalizada…', customRoleId:'Identificador de la función personalizada', none:'Sin ayudante', publish:'Publicar', removePart:'Eliminar parte', replace:'Sustituir', cancelAssignment:'Cancelar asignación', save:'Guardar', cancel:'Cancelar', working:'Guardando…', error:'No se pudo completar la operación.', publishConfirm:'¿Publicar esta reunión? Después de publicarla, los cambios estarán más restringidos.', confirm:'Confirmar', noPeople:'No hay personas activas disponibles.', manualStudent:'Seleccionar manualmente', hideManualStudent:'Ocultar selección manual', manualStudentHint:'La selección manual muestra personas activas. No afirma que sean elegibles, estén disponibles o no tengan conflictos para esta parte.' },
} as const;

function localTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

function personOptions(people: readonly PersonProfileDto[], excludedId?: string) {
  return people.filter(person => person.active && person.id !== excludedId).map(person => ({ value: person.id, label: person.displayName }));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <Form.Item label={label} style={{ marginBottom: 12 }}>{children}</Form.Item>;
}

export function CreateMidweekMeetingControl({ locale, onChanged }: { locale: Locale; onChanged: () => Promise<void> | void }) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:30');
  const [timezone, setTimezone] = useState(localTimezone);
  const [location, setLocation] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const workingRef = useRef(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!date || !time || !timezone.trim() || workingRef.current) return;
    workingRef.current = true;
    setWorking(true);
    setError(false);
    try {
      await midweekApi.createMeeting({ date, localTime: time, timezone: timezone.trim(), ...(location.trim() ? { locationId: location.trim() } : {}) });
      setOpen(false);
      setDate('');
      setLocation('');
      await onChanged();
    } catch {
      setError(true);
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };

  return <>
    <Button type="primary" onClick={() => { setError(false); setOpen(true); }}>{text.createMeeting}</Button>
    <Modal open={open} title={text.meetingTitle} footer={null} onCancel={() => { if (!workingRef.current) setOpen(false); }} destroyOnHidden>
      <form onSubmit={submit}>
        <Field label={text.date}><Input aria-label={text.date} type="date" value={date} onChange={event => setDate(event.target.value)} required /></Field>
        <Field label={text.time}><Input aria-label={text.time} type="time" step={60} value={time} onChange={event => setTime(event.target.value)} required /></Field>
        <Field label={text.timezone}><Input aria-label={text.timezone} value={timezone} onChange={event => setTimezone(event.target.value)} required /></Field>
        <Field label={text.location}><Input aria-label={text.location} maxLength={200} value={location} onChange={event => setLocation(event.target.value)} /></Field>
        {error ? <Alert type="error" showIcon title={text.error} style={{ marginBottom: 16 }} /> : null}
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setOpen(false)} disabled={working}>{text.cancel}</Button>
          <Button htmlType="submit" type="primary" loading={working} disabled={working || !date || !time || !timezone.trim()}>{working ? text.working : text.save}</Button>
        </Space>
      </form>
    </Modal>
  </>;
}

type AssignmentKind = 'student' | 'role';

export function MidweekMeetingControls({ locale, meeting, people, onChanged }: { locale: Locale; meeting: MidweekMeetingDto; people: readonly PersonProfileDto[]; onChanged: () => Promise<void> | void }) {
  const text = copy[locale];
  const activePeople = people.filter(person => person.active);
  const [partOpen, setPartOpen] = useState(false);
  const [titleKey, setTitleKey] = useState('');
  const [duration, setDuration] = useState('5');
  const [definition, setDefinition] = useState('');
  const [assignment, setAssignment] = useState<{ kind: AssignmentKind; slotId: string } | null>(null);
  const [personId, setPersonId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [roleChoice, setRoleChoice] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [manualStudentSelection, setManualStudentSelection] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const workingRef = useRef(false);

  if (meeting.state !== 'draft') return meeting.slots.length ? <Space orientation="vertical" size="small">{meeting.slots.map(slot => <Typography.Text key={slot.id}>{slot.position + 1}. {slot.titleKey} · {slot.durationMinutes} min</Typography.Text>)}</Space> : null;

  const run = async (operation: () => Promise<unknown>) => {
    if (workingRef.current) return false;
    workingRef.current = true;
    setWorking(true);
    setError(false);
    try {
      await operation();
      await onChanged();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      workingRef.current = false;
      setWorking(false);
    }
  };

  const addPart = async (event: FormEvent) => {
    event.preventDefault();
    const minutes = Number(duration);
    if (!titleKey.trim() || !Number.isInteger(minutes) || minutes <= 0 || minutes > 180) return;
    const ok = await run(() => midweekApi.addSlot(meeting.id, { position: meeting.slots.length, durationMinutes: minutes, titleKey: titleKey.trim(), ...(definition ? { partDefinitionId: definition } : {}) }));
    if (ok) {
      setPartOpen(false);
      setTitleKey('');
      setDuration('5');
      setDefinition('');
    }
  };

  const selectedAssignmentPart = assignment ? builtinPart(meeting.slots.find(slot => slot.id === assignment.slotId)?.partDefinitionId) : undefined;
  const requiresAssistant = assignment?.kind === 'student' && selectedAssignmentPart?.assistantRequirement === 'required';
  const resolvedRole = resolveAssignmentTypeChoice(roleChoice, customRole);
  const closeAssignment = () => { if (!workingRef.current) { setAssignment(null); setManualStudentSelection(false); } };

  const saveAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignment || !personId || (requiresAssistant && !assistantId)) return;
    const ok = assignment.kind === 'student'
      ? await run(() => midweekApi.assignStudent(meeting.id, { slotId: assignment.slotId, studentId: personId, assistantId: assistantId || null }))
      : resolvedRole
        ? await run(() => midweekApi.assignNonStudent(meeting.id, { slotId: assignment.slotId, personId, role: resolvedRole }))
        : false;
    if (ok) {
      setAssignment(null);
      setPersonId('');
      setAssistantId('');
      setRoleChoice('');
      setCustomRole('');
      setManualStudentSelection(false);
    }
  };

  const chooseDefinition = (partId: string) => {
    setDefinition(partId);
    const part = builtinPart(partId);
    if (part) {
      setTitleKey(part.titleKey);
      setDuration(String(part.durationMinutes));
    }
  };

  return <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
    <Divider style={{ marginBlock: 4 }} />
    {meeting.slots.map(slot => <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Typography.Text><strong>{slot.position + 1}. {slot.titleKey}</strong> · {slot.durationMinutes} min</Typography.Text>
      <Space wrap size="small">
        {slotAllowsStudentAssignment(slot.partDefinitionId) ? <Button size="small" disabled={working || !activePeople.length} onClick={() => { setError(false); setPersonId(''); setAssistantId(''); setManualStudentSelection(false); setAssignment({ kind: 'student', slotId: slot.id }); }}>{text.assignStudent}</Button> : null}
        <Button size="small" disabled={working || !activePeople.length} onClick={() => { setError(false); setPersonId(''); setManualStudentSelection(false); setAssignment({ kind: 'role', slotId: slot.id }); }}>{text.assignRole}</Button>
        <Button size="small" danger disabled={working} onClick={() => void run(() => midweekApi.removeSlot(meeting.id, slot.id))}>{text.removePart}</Button>
      </Space>
    </div>)}
    {!activePeople.length ? <Typography.Text type="secondary">{text.noPeople}</Typography.Text> : null}
    {error ? <Alert type="error" showIcon title={text.error} /> : null}
    <Space wrap>
      <Button disabled={working} onClick={() => { setError(false); setPartOpen(true); }}>{text.addPart}</Button>
      <Button type="primary" disabled={working} onClick={() => { setError(false); setPublishOpen(true); }}>{text.publish}</Button>
    </Space>

    <Modal open={partOpen} title={text.partTitle} footer={null} onCancel={() => { if (!workingRef.current) setPartOpen(false); }} destroyOnHidden>
      <form onSubmit={addPart}>
        <Field label={text.partDefinition}><Select aria-label={text.partDefinition} value={definition} onChange={chooseDefinition} style={{ width: '100%' }} options={[{ value: '', label: text.customPart }, ...BUILTIN_PARTS.map(part => ({ value: part.id, label: part.label[locale] }))]} /></Field>
        <Field label={text.titleKey}><Input aria-label={text.titleKey} value={titleKey} onChange={event => setTitleKey(event.target.value)} required /></Field>
        <Field label={text.duration}><Input aria-label={text.duration} type="number" min={1} max={180} step={1} value={duration} onChange={event => setDuration(event.target.value)} required /></Field>
        {error ? <Alert type="error" showIcon title={text.error} style={{ marginBottom: 16 }} /> : null}
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={() => setPartOpen(false)} disabled={working}>{text.cancel}</Button><Button htmlType="submit" type="primary" loading={working} disabled={working || !titleKey.trim()}>{working ? text.working : text.save}</Button></Space>
      </form>
    </Modal>

    <Modal open={assignment !== null} title={assignment?.kind === 'student' ? text.assignStudent : text.assignRole} footer={null} onCancel={closeAssignment} destroyOnHidden>
      <form onSubmit={saveAssignment}>
        <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
          {assignment?.kind === 'student' && assignment ? <>
            <RecommendationPicker locale={locale} meetingId={meeting.id} slotId={assignment.slotId} selectedPersonId={personId || undefined} onSelect={setPersonId} disabled={working} />
            <Button size="small" type="text" disabled={working} onClick={() => setManualStudentSelection(value => !value)} aria-expanded={manualStudentSelection}>{manualStudentSelection ? text.hideManualStudent : text.manualStudent}</Button>
            {manualStudentSelection ? <><Typography.Text type="secondary">{text.manualStudentHint}</Typography.Text><Field label={text.student}><Select aria-label={text.student} value={personId || undefined} onChange={setPersonId} options={personOptions(activePeople)} style={{ width: '100%' }} /></Field></> : null}
          </> : <Field label={text.person}><Select aria-label={text.person} value={personId || undefined} onChange={setPersonId} options={personOptions(activePeople)} style={{ width: '100%' }} /></Field>}
          {assignment?.kind === 'student' ? <Field label={requiresAssistant ? text.assistantRequired : text.assistant}><Select aria-label={requiresAssistant ? text.assistantRequired : text.assistant} value={assistantId || undefined} onChange={value => setAssistantId(value ?? '')} allowClear={!requiresAssistant} options={[{ value: '', label: text.none }, ...personOptions(activePeople, personId)]} style={{ width: '100%' }} /></Field> : <>
            <Field label={text.role}><Select aria-label={text.role} value={roleChoice || undefined} placeholder={text.chooseRole} onChange={value => { setRoleChoice(value); setCustomRole(''); }} options={[...STANDARD_NON_STUDENT_ROLES.map(option => ({ value: option.id, label: option.label[locale] })), { value: CUSTOM_ASSIGNMENT_TYPE_CHOICE, label: text.customRole }]} style={{ width: '100%' }} /></Field>
            {roleChoice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? <Field label={text.customRoleId}><Input aria-label={text.customRoleId} value={customRole} onChange={event => setCustomRole(event.target.value)} required maxLength={100} autoComplete="off" /></Field> : null}
          </>}
          {error ? <Alert type="error" showIcon title={text.error} /> : null}
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={closeAssignment} disabled={working}>{text.cancel}</Button><Button htmlType="submit" type="primary" loading={working} disabled={working || !personId || (assignment?.kind === 'role' && !resolvedRole) || Boolean(requiresAssistant && !assistantId)}>{working ? text.working : text.save}</Button></Space>
        </Space>
      </form>
    </Modal>

    <Modal open={publishOpen} title={<span id="midweek-publish-title">{text.publish}</span>} aria-labelledby="midweek-publish-title" aria-describedby="midweek-publish-description" onCancel={() => { if (!workingRef.current) setPublishOpen(false); }} footer={<Space><Button onClick={() => setPublishOpen(false)} disabled={working}>{text.cancel}</Button><Button danger type="primary" loading={working} disabled={working} onClick={async () => { const ok = await run(() => midweekApi.publishMeeting(meeting.id)); if (ok) setPublishOpen(false); }}>{working ? text.working : text.confirm}</Button></Space>}>
      <Typography.Paragraph id="midweek-publish-description">{text.publishConfirm}</Typography.Paragraph>
      {error ? <Alert type="error" showIcon title={text.error} /> : null}
    </Modal>
  </Space>;
}

export function assignmentLabel(assignment: StudentAssignmentDto | NonStudentAssignmentDto): string {
  return 'studentId' in assignment ? assignment.studentId : `${assignment.role}: ${assignment.personId}`;
}
