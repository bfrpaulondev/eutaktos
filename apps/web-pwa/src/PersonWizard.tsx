import { useEffect, useRef, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Modal from 'antd/es/modal';
import Result from 'antd/es/result';
import Space from 'antd/es/space';
import Steps from 'antd/es/steps';
import Typography from 'antd/es/typography';
import type { Capability } from './lib/accessGrantApi';
import { eligibilityApi, type EligibilityApi } from './lib/eligibilityApi';
import { householdsApi, type HouseholdDto, type HouseholdsApi } from './lib/householdsApi';
import { peopleApi, type PeopleApi, type PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { serviceGroupsApi, type ServiceGroupDto, type ServiceGroupsApi } from './lib/serviceGroupsApi';
import { PersonWizardContactStep } from './PersonWizardContactStep';
import { PersonWizardIdentityStep } from './PersonWizardIdentityStep';
import {
  createPersonWizardDraft,
  createPersonWizardMutationGuard,
  personWizardHasChanges,
  personWizardStep,
  savePersonWizard,
  wizardErrorState,
  type PersonWizardDraft,
  type PersonWizardMode,
  type PersonWizardMutationState,
} from './PersonWizardModel';
import { PersonWizardOrganizationStep } from './PersonWizardOrganizationStep';
import { PersonWizardParticipationStep } from './PersonWizardParticipationStep';
import { PersonWizardReviewStep } from './PersonWizardReviewStep';
import './PersonWizard.css';

type ResourceState = 'loading' | 'ready' | 'error' | 'forbidden';

export interface PersonWizardApis {
  people: PeopleApi;
  households: HouseholdsApi;
  serviceGroups: ServiceGroupsApi;
  eligibility: EligibilityApi;
}

export interface PersonWizardProps {
  open: boolean;
  mode: PersonWizardMode;
  locale: Locale;
  capabilities: readonly Capability[];
  person?: PersonProfileDto;
  apis?: Partial<PersonWizardApis>;
  onCancel: () => void;
  onSaved: (person: PersonProfileDto) => void;
}

const copy = {
  'pt-PT': {
    createTitle: 'Adicionar pessoa', editTitle: 'Editar pessoa', steps: ['Identidade', 'Contacto', 'Organização', 'Participação', 'Rever'],
    stepAnnouncement: 'Passo atual', cancel: 'Cancelar', previous: 'Anterior', next: 'Seguinte', save: 'Confirmar e guardar', saving: 'A guardar…', retry: 'Tentar novamente',
    identity: { name: 'Nome', nameRequired: 'O nome é exigido pelo contrato de pessoa.', locale: 'Idioma preferido', active: 'Perfil ativo', required: 'O nome é o único campo obrigatório definido pelo contrato atual.', optional: 'Opcional' },
    contactTitle: 'Contactos não disponíveis neste contrato', contactDetail: 'A API atual de Pessoas não expõe telefone, email ou morada. Nenhum campo de contacto foi inventado ou será enviado.',
    organization: { loading: 'A carregar agregados e grupos…', error: 'Não foi possível carregar a organização.', forbidden: 'Não tem permissão para consultar estes relacionamentos.', retry: 'Tentar novamente', empty: 'Ainda não existem agregados ou grupos configurados.', households: 'Agregados familiares', groups: 'Grupos de serviço', optional: 'Opcional', noWrite: 'Pode consultar estes dados, mas não tem permissão para os alterar.' },
    participation: { loading: 'A carregar decisões de elegibilidade…', error: 'Não foi possível carregar a elegibilidade.', forbidden: 'A elegibilidade está indisponível com as permissões atuais.', retry: 'Tentar novamente', explanation: 'Cada opção é uma decisão administrativa explícita. O sistema não infere adequação ou elegibilidade.', availabilityGap: 'Não existe um estado geral de disponibilidade para gravar. Ausências exigem períodos com datas e não são inferidas neste fluxo.', unchanged: 'Não configurado / manter atual', enabled: 'Elegível', disabled: 'Não elegível', noWrite: 'Não tem permissão para alterar decisões de elegibilidade.' },
    review: { identity: 'Identidade', name: 'Nome', locale: 'Idioma', state: 'Estado', active: 'Ativo', inactive: 'Inativo', organization: 'Organização', households: 'Agregados', groups: 'Grupos', none: 'Sem configuração', eligibility: 'Participação / Elegibilidade', eligible: 'Elegível', ineligible: 'Não elegível', confirm: 'Confirme os dados abaixo. Apenas estas alterações serão enviadas; IDs técnicos e dados de sessão não são apresentados.' },
    discardTitle: 'Descartar alterações?', discardDetail: 'As alterações não guardadas serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar',
    unauthenticated: 'A sessão terminou. Inicie sessão novamente antes de guardar.', permission: 'Não tem permissão para concluir esta ação.', validation: 'O servidor rejeitou os dados. Reveja os campos indicados.', retryable: 'Não foi possível confirmar a gravação. Tente novamente; não é apresentado sucesso sem refetch.', noChanges: 'Não existem alterações para guardar.', success: 'Dados confirmados pelo servidor.', requiredField: 'Preencha este campo.',
  },
  en: {
    createTitle: 'Add person', editTitle: 'Edit person', steps: ['Identity', 'Contact', 'Organization', 'Participation', 'Review'],
    stepAnnouncement: 'Current step', cancel: 'Cancel', previous: 'Previous', next: 'Next', save: 'Confirm and save', saving: 'Saving…', retry: 'Try again',
    identity: { name: 'Name', nameRequired: 'Name is required by the person contract.', locale: 'Preferred language', active: 'Active profile', required: 'Name is the only required field defined by the current contract.', optional: 'Optional' },
    contactTitle: 'Contacts are unavailable in this contract', contactDetail: 'The current People API does not expose phone, email, or address. No contact field was invented or will be sent.',
    organization: { loading: 'Loading households and groups…', error: 'Organization data could not be loaded.', forbidden: 'You do not have permission to view these relationships.', retry: 'Try again', empty: 'No households or groups have been configured yet.', households: 'Households', groups: 'Service groups', optional: 'Optional', noWrite: 'You can view this data, but you do not have permission to change it.' },
    participation: { loading: 'Loading eligibility decisions…', error: 'Eligibility could not be loaded.', forbidden: 'Eligibility is unavailable with the current permissions.', retry: 'Try again', explanation: 'Each option is an explicit administrative decision. The system does not infer suitability or eligibility.', availabilityGap: 'There is no general availability state to save. Absences require dated periods and are not inferred in this flow.', unchanged: 'Not configured / keep current', enabled: 'Eligible', disabled: 'Not eligible', noWrite: 'You do not have permission to change eligibility decisions.' },
    review: { identity: 'Identity', name: 'Name', locale: 'Language', state: 'State', active: 'Active', inactive: 'Inactive', organization: 'Organization', households: 'Households', groups: 'Groups', none: 'No configuration', eligibility: 'Participation / Eligibility', eligible: 'Eligible', ineligible: 'Not eligible', confirm: 'Confirm the data below. Only these changes will be sent; technical IDs and session data are not displayed.' },
    discardTitle: 'Discard changes?', discardDetail: 'Unsaved changes will be lost.', keepEditing: 'Keep editing', discard: 'Discard',
    unauthenticated: 'Your session ended. Sign in again before saving.', permission: 'You do not have permission to complete this action.', validation: 'The server rejected the data. Review the indicated fields.', retryable: 'The save could not be confirmed. Try again; success is never shown without a refetch.', noChanges: 'There are no changes to save.', success: 'Data confirmed by the server.', requiredField: 'Complete this field.',
  },
  es: {
    createTitle: 'Añadir persona', editTitle: 'Editar persona', steps: ['Identidad', 'Contacto', 'Organización', 'Participación', 'Revisar'],
    stepAnnouncement: 'Paso actual', cancel: 'Cancelar', previous: 'Anterior', next: 'Siguiente', save: 'Confirmar y guardar', saving: 'Guardando…', retry: 'Intentar de nuevo',
    identity: { name: 'Nombre', nameRequired: 'El nombre es obligatorio según el contrato de persona.', locale: 'Idioma preferido', active: 'Perfil activo', required: 'El nombre es el único campo obligatorio definido por el contrato actual.', optional: 'Opcional' },
    contactTitle: 'Contactos no disponibles en este contrato', contactDetail: 'La API actual de Personas no expone teléfono, email ni dirección. No se inventará ni enviará ningún campo de contacto.',
    organization: { loading: 'Cargando hogares y grupos…', error: 'No se pudo cargar la organización.', forbidden: 'No tiene permiso para consultar estas relaciones.', retry: 'Intentar de nuevo', empty: 'Todavía no hay hogares o grupos configurados.', households: 'Hogares', groups: 'Grupos de servicio', optional: 'Opcional', noWrite: 'Puede consultar estos datos, pero no tiene permiso para cambiarlos.' },
    participation: { loading: 'Cargando decisiones de elegibilidad…', error: 'No se pudo cargar la elegibilidad.', forbidden: 'La elegibilidad no está disponible con los permisos actuales.', retry: 'Intentar de nuevo', explanation: 'Cada opción es una decisión administrativa explícita. El sistema no infiere idoneidad ni elegibilidad.', availabilityGap: 'No existe un estado general de disponibilidad para guardar. Las ausencias requieren periodos con fechas y no se infieren en este flujo.', unchanged: 'Sin configurar / mantener actual', enabled: 'Elegible', disabled: 'No elegible', noWrite: 'No tiene permiso para cambiar decisiones de elegibilidad.' },
    review: { identity: 'Identidad', name: 'Nombre', locale: 'Idioma', state: 'Estado', active: 'Activo', inactive: 'Inactivo', organization: 'Organización', households: 'Hogares', groups: 'Grupos', none: 'Sin configuración', eligibility: 'Participación / Elegibilidad', eligible: 'Elegible', ineligible: 'No elegible', confirm: 'Confirme los datos. Solo se enviarán estos cambios; no se muestran IDs técnicos ni datos de sesión.' },
    discardTitle: '¿Descartar cambios?', discardDetail: 'Se perderán los cambios no guardados.', keepEditing: 'Seguir editando', discard: 'Descartar',
    unauthenticated: 'La sesión terminó. Inicie sesión de nuevo antes de guardar.', permission: 'No tiene permiso para completar esta acción.', validation: 'El servidor rechazó los datos. Revise los campos indicados.', retryable: 'No se pudo confirmar el guardado. Inténtelo de nuevo; nunca se muestra éxito sin recargar.', noChanges: 'No hay cambios para guardar.', success: 'Datos confirmados por el servidor.', requiredField: 'Complete este campo.',
  },
} as const;

function selectedMembership<T extends { id: string; memberIds: readonly string[] }>(items: readonly T[], personId: string | undefined): string[] {
  return personId ? items.filter(item => item.memberIds.includes(personId)).map(item => item.id) : [];
}

export function PersonWizard({ open, mode, locale, capabilities, person, apis, onCancel, onSaved }: PersonWizardProps) {
  const text = copy[locale];
  const api: PersonWizardApis = { people: apis?.people ?? peopleApi, households: apis?.households ?? householdsApi, serviceGroups: apis?.serviceGroups ?? serviceGroupsApi, eligibility: apis?.eligibility ?? eligibilityApi };
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PersonWizardDraft>(() => createPersonWizardDraft(locale, person));
  const [initial, setInitial] = useState<PersonWizardDraft>(() => createPersonWizardDraft(locale, person));
  const [households, setHouseholds] = useState<readonly HouseholdDto[]>([]);
  const [groups, setGroups] = useState<readonly ServiceGroupDto[]>([]);
  const [organizationState, setOrganizationState] = useState<ResourceState>('loading');
  const [participationState, setParticipationState] = useState<ResourceState>('loading');
  const [mutationState, setMutationState] = useState<PersonWizardMutationState>('idle');
  const [discardOpen, setDiscardOpen] = useState(false);
  const mutationGuardRef = useRef(createPersonWizardMutationGuard());
  const createdPersonRef = useRef<PersonProfileDto | undefined>(undefined);
  const relatedRequestRef = useRef(0);
  const relatedControllerRef = useRef<AbortController | null>(null);
  const capabilitiesKey = capabilities.join('|');
  const capabilitiesKeyRef = useRef(capabilitiesKey);
  const historyMarkerRef = useRef(`px6-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const historyGuardRef = useRef(false);
  const closingHistoryRef = useRef(false);
  const restoringHistoryRef = useRef(false);
  const pendingHistoryCallbackRef = useRef<(() => void) | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const canReadPeople = capabilities.includes('people.read');
  const canWritePeople = canReadPeople && capabilities.includes('people.write');
  const canReadEligibility = canReadPeople && capabilities.includes('eligibility.read');
  const canWriteEligibility = canReadEligibility && capabilities.includes('eligibility.write');
  const dirty = personWizardHasChanges(initial, draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const busy = mutationState === 'validating' || mutationState === 'submitting';

  const updateDraft = (change: Partial<PersonWizardDraft>) => {
    setDraft(current => ({ ...current, ...change }));
    if (mutationState !== 'idle') setMutationState('idle');
  };

  const eligibilityChanged = Object.entries(draft.eligibility).some(([id, choice]) => choice !== 'unchanged' && choice !== (initial.eligibility[id] ?? 'unchanged'));
  const canSave = canWritePeople && organizationState === 'ready' && (!eligibilityChanged || (canWriteEligibility && participationState === 'ready'));

  const loadRelated = async (preserveDraft = false) => {
    const requestVersion = ++relatedRequestRef.current;
    relatedControllerRef.current?.abort();
    const controller = new AbortController();
    relatedControllerRef.current = controller;
    if (!canReadPeople) { setOrganizationState('forbidden'); setParticipationState('forbidden'); return; }
    setOrganizationState('loading');
    setParticipationState(canReadEligibility || mode === 'create' ? 'loading' : 'forbidden');
    const [householdResult, groupResult, eligibilityResult] = await Promise.allSettled([
      api.households.list(controller.signal),
      api.serviceGroups.list(controller.signal),
      mode === 'edit' && person && canReadEligibility ? api.eligibility.list(person.id, controller.signal) : Promise.resolve([]),
    ]);
    if (controller.signal.aborted || requestVersion !== relatedRequestRef.current) return;
    const organizationError = householdResult.status === 'rejected' ? householdResult.reason : groupResult.status === 'rejected' ? groupResult.reason : undefined;
    if (organizationError) setOrganizationState(wizardErrorState(organizationError) === 'permission-error' ? 'forbidden' : 'error');
    else {
      const nextHouseholds = householdResult.status === 'fulfilled' ? householdResult.value : [];
      const nextGroups = groupResult.status === 'fulfilled' ? groupResult.value : [];
      setHouseholds(nextHouseholds); setGroups(nextGroups); setOrganizationState('ready');
      const householdIds = selectedMembership(nextHouseholds, person?.id);
      const serviceGroupIds = selectedMembership(nextGroups, person?.id);
      if (!preserveDraft) {
        setDraft(current => ({ ...current, householdIds, serviceGroupIds }));
        setInitial(current => ({ ...current, householdIds, serviceGroupIds }));
      }
    }
    if (eligibilityResult.status === 'rejected') setParticipationState(wizardErrorState(eligibilityResult.reason) === 'permission-error' ? 'forbidden' : 'error');
    else {
      const choices = Object.fromEntries(eligibilityResult.value.map(decision => [decision.assignmentTypeId, decision.enabled ? 'enabled' : 'disabled'] as const));
      if (!preserveDraft) {
        setDraft(current => ({ ...current, eligibility: choices }));
        setInitial(current => ({ ...current, eligibility: choices }));
      }
      setParticipationState('ready');
    }
  };

  useEffect(() => {
    if (!open) return;
    const base = createPersonWizardDraft(locale, person);
    setStep(0); setDraft(base); setInitial(base); setMutationState('idle'); setDiscardOpen(false); setHouseholds([]); setGroups([]); createdPersonRef.current = undefined; capabilitiesKeyRef.current = capabilitiesKey;
    form.resetFields(); form.setFieldsValue({ displayName: base.displayName });
    void loadRelated(false);
    return () => { relatedRequestRef.current += 1; relatedControllerRef.current?.abort(); };
  }, [open, mode, person?.id, locale]);

  useEffect(() => {
    if (!open || capabilitiesKeyRef.current === capabilitiesKey) return;
    capabilitiesKeyRef.current = capabilitiesKey;
    setHouseholds([]); setGroups([]);
    setDraft(current => ({ ...current, householdIds: [], serviceGroupIds: [], eligibility: {} }));
    setInitial(current => ({ ...current, householdIds: [], serviceGroupIds: [], eligibility: {} }));
    void loadRelated(false);
  }, [open, capabilitiesKey]);

  useEffect(() => {
    if (!open) return;
    if (!historyGuardRef.current) {
      window.history.pushState({ ...window.history.state, personWizardMarker: historyMarkerRef.current }, '', `${window.location.pathname}${window.location.search}${window.location.hash}`);
      historyGuardRef.current = true;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!dirtyRef.current) return; event.preventDefault(); event.returnValue = ''; };
    const popState = (event: PopStateEvent) => {
      if (closingHistoryRef.current) {
        closingHistoryRef.current = false;
        const callback = pendingHistoryCallbackRef.current;
        pendingHistoryCallbackRef.current = null;
        callback?.();
        return;
      }
      if (event.state?.personWizardMarker === historyMarkerRef.current) {
        if (restoringHistoryRef.current) { restoringHistoryRef.current = false; setDiscardOpen(true); }
        return;
      }
      if (dirtyRef.current) {
        restoringHistoryRef.current = true;
        window.history.forward();
      } else { historyGuardRef.current = false; onCancel(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', popState);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('popstate', popState); };
  }, [open]);

  useEffect(() => { if (open) window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true })); }, [open, step]);

  const releaseHistoryMarker = (callback: () => void) => {
    if (historyGuardRef.current && window.history.state?.personWizardMarker === historyMarkerRef.current) {
      closingHistoryRef.current = true; historyGuardRef.current = false; pendingHistoryCallbackRef.current = callback; window.history.back();
    } else callback();
  };
  const closeConfirmed = () => releaseHistoryMarker(onCancel);
  const requestClose = () => { if (busy) return; if (dirty) setDiscardOpen(true); else closeConfirmed(); };
  const goTo = async (target: number) => {
    if (busy) return;
    if (target > 0) {
      setMutationState('validating');
      try { await form.validateFields(['displayName']); }
      catch { setMutationState('validation-error'); form.scrollToField('displayName', { focus: true }); return; }
    }
    setMutationState('idle'); setStep(target);
  };

  const save = async () => mutationGuardRef.current(async () => {
    if (busy || !canSave || (mode === 'edit' && !dirty) || (mode === 'edit' && !person)) return;
    setMutationState('validating');
    try {
      await form.validateFields(['displayName']);
      setMutationState('submitting');
      const authoritative = await savePersonWizard({ mode, person: person ?? createdPersonRef.current, draft, initial, households, groups, canReadEligibility, canWriteEligibility, apis: api, onCorePersisted: value => { createdPersonRef.current = value; } });
      setInitial(draft); setMutationState('success'); releaseHistoryMarker(() => onSaved(authoritative));
    } catch (error) {
      const state = wizardErrorState(error); setMutationState(state);
      if (state === 'validation-error') { form.setFields([{ name: 'displayName', errors: [text.validation] }]); form.scrollToField('displayName', { focus: true }); }
    }
  });

  const errorMessage = mutationState === 'unauthenticated' ? text.unauthenticated : mutationState === 'permission-error' ? text.permission : mutationState === 'validation-error' ? text.validation : mutationState === 'retryable-error' ? text.retryable : undefined;
  const stepContent = step === 0 ? <PersonWizardIdentityStep draft={draft} labels={text.identity} onChange={updateDraft} />
    : step === 1 ? <PersonWizardContactStep title={text.contactTitle} detail={text.contactDetail} />
      : step === 2 ? <PersonWizardOrganizationStep draft={draft} households={households} groups={groups} state={organizationState} canWrite={canWritePeople} labels={text.organization} onChange={updateDraft} onRetry={() => void loadRelated(true)} />
        : step === 3 ? <PersonWizardParticipationStep locale={locale} draft={draft} state={participationState} canWrite={canWriteEligibility} labels={text.participation} onChange={updateDraft} onRetry={() => void loadRelated(true)} />
          : <PersonWizardReviewStep mode={mode} locale={locale} draft={draft} initial={initial} households={households} groups={groups} labels={text.review} />;

  return <>
    <Modal className="person-wizard" open={open} width={900} title={mode === 'create' ? text.createTitle : text.editTitle} footer={null} onCancel={requestClose} maskClosable={!busy} keyboard={!busy} destroyOnHidden>
      {mutationState === 'success' ? <Result status="success" title={text.success} /> : <Form form={form} layout="vertical" initialValues={{ displayName: draft.displayName }} requiredMark="optional" onFinish={() => { if (step === 4) void save(); else void goTo(step + 1); }}>
        <Steps className="person-wizard-steps" current={step} responsive size="small" onChange={busy ? undefined : target => void goTo(target)} items={text.steps.map(title => ({ title, disabled: busy }))} />
        <Typography.Title ref={headingRef} tabIndex={-1} level={3} style={{ marginTop: 0 }} aria-live="polite">{text.stepAnnouncement}: {text.steps[step]}</Typography.Title>
        {errorMessage ? <Alert style={{ marginBottom: 16 }} type="error" showIcon title={errorMessage} action={mutationState === 'retryable-error' ? <Button disabled={busy} onClick={() => void save()}>{text.retry}</Button> : undefined} /> : null}
        {mode === 'edit' && step === 4 && !dirty ? <Alert type="info" showIcon title={text.noChanges} style={{ marginBottom: 16 }} /> : null}
        <div className="person-wizard-content">{stepContent}</div>
        <div className="person-wizard-actions"><Button disabled={busy} onClick={requestClose}>{text.cancel}</Button><Space wrap>{step > 0 ? <Button disabled={busy} onClick={() => void goTo(personWizardStep(step, 'previous'))}>{text.previous}</Button> : null}<Button htmlType="submit" type="primary" loading={busy} disabled={busy || !canWritePeople || (step === 4 && (!canSave || (mode === 'edit' && !dirty)))}>{busy ? text.saving : step === 4 ? text.save : text.next}</Button></Space></div>
      </Form>}
    </Modal>
    <Modal open={discardOpen} title={text.discardTitle} onCancel={() => setDiscardOpen(false)} onOk={() => { setDiscardOpen(false); closeConfirmed(); }} okText={text.discard} cancelText={text.keepEditing} okButtonProps={{ danger: true }}>{text.discardDetail}</Modal>
  </>;
}

export const personWizardCopy = copy;
