import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { useRef, useState } from 'react';
import { midweekApi, type NonStudentAssignmentDto, type StudentAssignmentDto } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { RecommendationPicker } from './RecommendationPicker';

const copy = {
  'pt-PT': { replace: 'Substituir', cancelAssignment: 'Cancelar designação', cancel: 'Cancelar', save: 'Guardar', working: 'A guardar…', error: 'Não foi possível concluir a operação.', student: 'Estudante', assistant: 'Ajudante (opcional)', person: 'Pessoa', none: 'Sem ajudante', manualStudent: 'Selecionar manualmente', hideManualStudent: 'Ocultar seleção manual', manualStudentHint: 'A seleção manual mostra pessoas ativas. Não afirma que estejam elegíveis, disponíveis ou sem conflitos para esta parte.' },
  en: { replace: 'Replace', cancelAssignment: 'Cancel assignment', cancel: 'Cancel', save: 'Save', working: 'Saving…', error: 'The operation could not be completed.', student: 'Student', assistant: 'Assistant (optional)', person: 'Person', none: 'No assistant', manualStudent: 'Select manually', hideManualStudent: 'Hide manual selection', manualStudentHint: 'Manual selection shows active people. It does not claim they are eligible, available or conflict-free for this part.' },
  es: { replace: 'Sustituir', cancelAssignment: 'Cancelar asignación', cancel: 'Cancelar', save: 'Guardar', working: 'Guardando…', error: 'No se pudo completar la operación.', student: 'Estudiante', assistant: 'Ayudante (opcional)', person: 'Persona', none: 'Sin ayudante', manualStudent: 'Seleccionar manualmente', hideManualStudent: 'Ocultar selección manual', manualStudentHint: 'La selección manual muestra personas activas. No afirma que sean elegibles, estén disponibles o no tengan conflictos para esta parte.' },
} as const;

function activeOptions(people: readonly PersonProfileDto[], excludedId?: string) {
  return people.filter(person => person.active && person.id !== excludedId).map(person => ({ value: person.id, label: person.displayName }));
}

export function StudentAssignmentControls({ locale, assignment, people, onChanged }: { locale: Locale; assignment: StudentAssignmentDto; people: readonly PersonProfileDto[]; onChanged: () => Promise<void> | void }) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState(assignment.studentId);
  const [assistantId, setAssistantId] = useState(assignment.assistantId ?? '');
  const [manual, setManual] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const workingRef = useRef(false);
  if (assignment.state !== 'assigned') return null;

  const run = async (operation: () => Promise<void>) => {
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

  const close = () => {
    if (workingRef.current) return;
    setOpen(false);
    setManual(false);
  };

  return <>
    <Space size="small">
      <Button size="small" onClick={() => { setError(false); setManual(false); setOpen(true); }}>{text.replace}</Button>
      <Button size="small" danger disabled={working} onClick={() => void run(() => midweekApi.cancelStudent(assignment.id))}>{text.cancelAssignment}</Button>
    </Space>
    <Modal open={open} title={text.replace} footer={null} onCancel={close} destroyOnHidden>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <RecommendationPicker locale={locale} meetingId={assignment.meetingId} slotId={assignment.slotId} selectedPersonId={studentId || undefined} onSelect={setStudentId} disabled={working} />
        <Button size="small" type="text" disabled={working} onClick={() => setManual(value => !value)} aria-expanded={manual}>{manual ? text.hideManualStudent : text.manualStudent}</Button>
        {manual ? <>
          <Typography.Text type="secondary">{text.manualStudentHint}</Typography.Text>
          <Select aria-label={text.student} value={studentId || undefined} onChange={setStudentId} options={activeOptions(people)} style={{ width: '100%' }} />
        </> : null}
        <Select aria-label={text.assistant} allowClear value={assistantId || undefined} onChange={value => setAssistantId(value ?? '')} options={activeOptions(people, studentId)} placeholder={text.none} style={{ width: '100%' }} />
        {error ? <Alert type="error" showIcon title={text.error} /> : null}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={close} disabled={working}>{text.cancel}</Button>
          <Button type="primary" loading={working} disabled={!studentId} onClick={async () => { const ok = await run(() => midweekApi.replaceStudent(assignment.id, { studentId, assistantId: assistantId || null })); if (ok) close(); }}>{working ? text.working : text.save}</Button>
        </Space>
      </Space>
    </Modal>
  </>;
}

export function NonStudentAssignmentControls({ locale, assignment, people, onChanged }: { locale: Locale; assignment: NonStudentAssignmentDto; people: readonly PersonProfileDto[]; onChanged: () => Promise<void> | void }) {
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState(assignment.personId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const workingRef = useRef(false);
  if (assignment.state !== 'assigned') return null;

  const run = async (operation: () => Promise<void>) => {
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

  const close = () => { if (!workingRef.current) setOpen(false); };

  return <>
    <Space size="small">
      <Button size="small" onClick={() => { setError(false); setOpen(true); }}>{text.replace}</Button>
      <Button size="small" danger disabled={working} onClick={() => void run(() => midweekApi.cancelNonStudent(assignment.id))}>{text.cancelAssignment}</Button>
    </Space>
    <Modal open={open} title={text.replace} footer={null} onCancel={close} destroyOnHidden>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Select aria-label={text.person} value={personId || undefined} onChange={setPersonId} options={activeOptions(people)} style={{ width: '100%' }} />
        {error ? <Alert type="error" showIcon title={text.error} /> : null}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={close} disabled={working}>{text.cancel}</Button>
          <Button type="primary" loading={working} disabled={!personId} onClick={async () => { const ok = await run(() => midweekApi.replaceNonStudent(assignment.id, personId)); if (ok) close(); }}>{working ? text.working : text.save}</Button>
        </Space>
      </Space>
    </Modal>
  </>;
}
