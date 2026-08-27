import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Locale } from './lib/preferences';
import { eligibilityApi, type EligibilityDecisionDto } from './lib/eligibilityApi';
import {
  assignmentTypeLabel,
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  ELIGIBILITY_ASSIGNMENT_TYPES,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';

const copy = {
  'pt-PT': { title: 'Elegibilidade de atribuições', subtitle: 'Estas são decisões administrativas explícitas registadas por utilizadores autorizados. A interface não recomenda nem infere adequação.', loading: 'A carregar elegibilidade…', unavailable: 'Não foi possível carregar a elegibilidade. Tenta novamente.', saveError: 'Não foi possível registar a decisão. Tenta novamente.', retry: 'Tentar novamente', empty: 'Ainda não existem decisões registadas.', assignmentType: 'Tipo de atribuição', chooseAssignmentType: 'Seleciona um tipo de atribuição', customAssignmentType: 'Identificador da função personalizada', customOption: 'Outra função personalizada…', enabled: 'Elegível', disabled: 'Não elegível', decision: 'Registar decisão administrativa', decisionHint: 'Seleciona uma atribuição conhecida. Usa a opção personalizada apenas para uma função específica já definida pela congregação.', cancel: 'Fechar', save: 'Continuar', saving: 'A guardar…', updated: 'Decisão atualizada.', confirmTitle: 'Confirmar decisão administrativa', confirmBody: 'Confirma que pretende registar esta decisão explícita. Esta ação não é uma recomendação nem altera outras decisões.', confirm: 'Sim, registar', status: 'Estado da decisão', current: 'Decisões atuais' },
  en: { title: 'Assignment eligibility', subtitle: 'These are explicit administrative decisions recorded by authorized users. The interface does not recommend or infer suitability.', loading: 'Loading eligibility…', unavailable: 'Eligibility could not be loaded. Please try again.', saveError: 'The decision could not be recorded. Please try again.', retry: 'Try again', empty: 'No decisions have been recorded yet.', assignmentType: 'Assignment type', chooseAssignmentType: 'Select an assignment type', customAssignmentType: 'Custom role identifier', customOption: 'Another custom role…', enabled: 'Eligible', disabled: 'Not eligible', decision: 'Record administrative decision', decisionHint: 'Select a known assignment. Use the custom option only for a specific role already defined by the congregation.', cancel: 'Close', save: 'Continue', saving: 'Saving…', updated: 'Decision updated.', confirmTitle: 'Confirm administrative decision', confirmBody: 'Confirm that you want to record this explicit decision. This is not a recommendation and does not change other decisions.', confirm: 'Yes, record', status: 'Decision status', current: 'Current decisions' },
  es: { title: 'Elegibilidad de asignaciones', subtitle: 'Estas son decisiones administrativas explícitas registradas por usuarios autorizados. La interfaz no recomienda ni infiere idoneidad.', loading: 'Cargando elegibilidad…', unavailable: 'No se pudo cargar la elegibilidad. Inténtalo de nuevo.', saveError: 'No se pudo registrar la decisión. Inténtalo de nuevo.', retry: 'Intentar de nuevo', empty: 'Todavía no hay decisiones registradas.', assignmentType: 'Tipo de asignación', chooseAssignmentType: 'Selecciona un tipo de asignación', customAssignmentType: 'Identificador de la función personalizada', customOption: 'Otra función personalizada…', enabled: 'Elegible', disabled: 'No elegible', decision: 'Registrar decisión administrativa', decisionHint: 'Selecciona una asignación conocida. Usa la opción personalizada solo para una función específica ya definida por la congregación.', cancel: 'Cerrar', save: 'Continuar', saving: 'Guardando…', updated: 'Decisión actualizada.', confirmTitle: 'Confirmar decisión administrativa', confirmBody: 'Confirma que deseas registrar esta decisión explícita. No es una recomendación ni cambia otras decisiones.', confirm: 'Sí, registrar', status: 'Estado de la decisión', current: 'Decisiones actuales' },
} as const;

export function isEligibilityDecisionSubmittable(assignmentTypeId: string, saving: boolean): boolean {
  return !saving && assignmentTypeId.trim().length > 0;
}

export function EligibilityDialog({ personId, personName, locale, open, onClose }: { personId: string; personName: string; locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const [decisions, setDecisions] = useState<readonly EligibilityDecisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState(false);
  const [assignmentTypeChoice, setAssignmentTypeChoice] = useState('');
  const [customAssignmentTypeId, setCustomAssignmentTypeId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const savingRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const assignmentTypeId = resolveAssignmentTypeChoice(assignmentTypeChoice, customAssignmentTypeId);
  const cataloguedIds = new Set(ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id));
  const existingCustomIds = [...new Set(decisions.map(decision => decision.assignmentTypeId).filter(id => !cataloguedIds.has(id)))].sort((a, b) => a.localeCompare(b));

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setDecisions(await eligibilityApi.list(personId, signal));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [open, personId]);

  const requestConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!isEligibilityDecisionSubmittable(assignmentTypeId, saving)) return;
    setSaveError(false);
    setNotice(false);
    setConfirming(true);
  };

  const submit = async () => {
    if (!assignmentTypeId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    setNotice(false);
    try {
      const decision = await eligibilityApi.set(personId, { assignmentTypeId, enabled });
      setDecisions(current => [...current.filter(item => item.assignmentTypeId !== decision.assignmentTypeId), decision].sort((first, second) => first.assignmentTypeId.localeCompare(second.assignmentTypeId)));
      setAssignmentTypeChoice('');
      setCustomAssignmentTypeId('');
      setEnabled(true);
      setConfirming(false);
      setNotice(true);
      window.requestAnimationFrame(() => submitButtonRef.current?.focus());
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const retry = () => void load();
  const close = () => {
    if (!saving && !confirming) onClose();
  };

  const assignmentOptions = [
    ...ELIGIBILITY_ASSIGNMENT_TYPES.map(option => ({ value: option.id, label: option.label[locale] })),
    ...existingCustomIds.map(id => ({ value: id, label: id })),
    { value: CUSTOM_ASSIGNMENT_TYPE_CHOICE, label: text.customOption },
  ];

  return <>
    <Modal
      open={open}
      width={640}
      title={<span id="eligibility-dialog-title">{text.title} — {personName}</span>}
      onCancel={close}
      maskClosable={!saving && !confirming}
      keyboard={!saving && !confirming}
      aria-labelledby="eligibility-dialog-title"
      footer={[
        <Button key="close" onClick={close} disabled={saving || confirming}>{text.cancel}</Button>,
        <Button
          key="save"
          ref={submitButtonRef}
          type="primary"
          htmlType="submit"
          form="eligibility-decision-form"
          disabled={!isEligibilityDecisionSubmittable(assignmentTypeId, saving) || confirming}
          loading={saving}
        >{saving ? text.saving : text.save}</Button>,
      ]}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={text.subtitle} />
        {loadError ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" disabled={loading} onClick={retry}>{text.retry}</Button>} /> : null}
        {saveError ? <Alert type="error" showIcon title={text.saveError} /> : null}
        {notice ? <Alert type="success" showIcon closable title={text.updated} onClose={() => setNotice(false)} /> : null}

        <Card size="small" title={text.current}>
          {loading ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /></div> : decisions.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            {decisions.map(decision => {
              const label = assignmentTypeLabel(decision.assignmentTypeId, locale);
              return <div key={decision.assignmentTypeId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text style={{ overflowWrap: 'anywhere' }}>{label}</Typography.Text>
                  {label !== decision.assignmentTypeId ? <div><Typography.Text type="secondary" style={{ overflowWrap: 'anywhere', fontSize: 12 }}>{decision.assignmentTypeId}</Typography.Text></div> : null}
                </div>
                <Tag color={decision.enabled ? 'success' : 'default'}>{decision.enabled ? text.enabled : text.disabled}</Tag>
              </div>;
            })}
          </Space>}
        </Card>

        <form id="eligibility-decision-form" onSubmit={requestConfirmation}>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Divider style={{ marginBlock: 4 }} />
            <div>
              <Typography.Text strong>{text.decision}</Typography.Text>
              <div><Typography.Text type="secondary">{text.decisionHint}</Typography.Text></div>
            </div>
            <label>
              <Typography.Text>{text.assignmentType}</Typography.Text>
              <Select
                aria-label={text.assignmentType}
                style={{ width: '100%', marginTop: 6 }}
                value={assignmentTypeChoice || undefined}
                placeholder={text.chooseAssignmentType}
                onChange={value => {
                  setAssignmentTypeChoice(value);
                  setCustomAssignmentTypeId('');
                }}
                options={assignmentOptions}
              />
            </label>
            {assignmentTypeChoice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? <label>
              <Typography.Text>{text.customAssignmentType}</Typography.Text>
              <Input
                aria-label={text.customAssignmentType}
                style={{ marginTop: 6 }}
                value={customAssignmentTypeId}
                maxLength={100}
                autoComplete="off"
                onChange={event => setCustomAssignmentTypeId(event.target.value)}
              />
            </label> : null}
            <Space align="center">
              <Switch checked={enabled} onChange={setEnabled} aria-label={text.status} />
              <Typography.Text>{text.status}: {enabled ? text.enabled : text.disabled}</Typography.Text>
            </Space>
          </Space>
        </form>
      </Space>
    </Modal>

    <Modal
      open={confirming}
      width={480}
      title={<span id="eligibility-confirmation-title">{text.confirmTitle}</span>}
      onCancel={() => { if (!saving) setConfirming(false); }}
      maskClosable={!saving}
      keyboard={!saving}
      aria-labelledby="eligibility-confirmation-title"
      aria-describedby="eligibility-confirmation-description"
      footer={[
        <Button key="cancel" disabled={saving} onClick={() => setConfirming(false)}>{text.cancel}</Button>,
        <Button key="confirm" type="primary" loading={saving} disabled={!isEligibilityDecisionSubmittable(assignmentTypeId, saving)} onClick={() => void submit()}>{saving ? text.saving : text.confirm}</Button>,
      ]}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph id="eligibility-confirmation-description" style={{ marginBottom: 0 }}>{text.confirmBody}</Typography.Paragraph>
        <Card size="small">
          <Space orientation="vertical" size="small">
            <Typography.Text strong>{assignmentTypeLabel(assignmentTypeId, locale)}</Typography.Text>
            {assignmentTypeLabel(assignmentTypeId, locale) !== assignmentTypeId ? <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>{assignmentTypeId}</Typography.Text> : null}
            <Tag color={enabled ? 'success' : 'default'}>{text.status}: {enabled ? text.enabled : text.disabled}</Tag>
          </Space>
        </Card>
      </Space>
    </Modal>
  </>;
}
