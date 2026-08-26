import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Modal from 'antd/es/modal';
import Result from 'antd/es/result';
import Space from 'antd/es/space';
import Steps from 'antd/es/steps';
import Typography from 'antd/es/typography';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Capability } from './lib/accessGrantApi';
import { availabilityApi, type AvailabilityApi, type AvailabilityPeriodDto } from './lib/availabilityApi';
import { eligibilityApi, type EligibilityApi } from './lib/eligibilityApi';
import { householdsApi, type HouseholdDto, type HouseholdsApi } from './lib/householdsApi';
import { ordinaryContactApi, type OrdinaryContactApi, type OrdinaryContactDto } from './lib/ordinaryContactApi';
import { peopleApi, type PeopleApi, type PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { responsibilitiesApi, type ResponsibilitiesApi, type ResponsibilityDto } from './lib/responsibilitiesApi';
import { serviceGroupsApi, type ServiceGroupDto, type ServiceGroupsApi } from './lib/serviceGroupsApi';
import { PersonWizardContactStep } from './PersonWizardContactStep';
import { PersonWizardIdentityStep } from './PersonWizardIdentityStep';
import {
  createPersonWizardDraft,
  createPersonWizardMutationGuard,
  isAmbiguousCreateOutcome,
  personWizardAvailabilityChanges,
  personWizardContactChanged,
  personWizardContactValidation,
  personWizardEligibilityChanges,
  personWizardHasChanges,
  personWizardMembershipChanges,
  personWizardStep,
  savePersonWizard,
  shouldInitializeRelatedBaseline,
  wizardErrorState,
  wizardResourceState,
  type PersonWizardDraft,
  type PersonWizardMode,
  type PersonWizardMutationState,
  type PersonWizardResourceState,
} from './PersonWizardModel';
import './PersonWizard.css';

const PersonWizardOrganizationStep = lazy(async () => ({ default: (await import('./PersonWizardOrganizationStep')).PersonWizardOrganizationStep }));
const PersonWizardParticipationStep = lazy(async () => ({ default: (await import('./PersonWizardParticipationStep')).PersonWizardParticipationStep }));
const PersonWizardReviewStep = lazy(async () => ({ default: (await import('./PersonWizardReviewStep')).PersonWizardReviewStep }));

export interface PersonWizardApis {
  people: PeopleApi;
  households: HouseholdsApi;
  serviceGroups: ServiceGroupsApi;
  eligibility: EligibilityApi;
  contact: OrdinaryContactApi;
  responsibilities: ResponsibilitiesApi;
  availability: AvailabilityApi;
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
    contact: { loading: 'A carregar contactos…', error: 'Não foi possível carregar os contactos.', forbidden: 'Não tem permissão para consultar estes contactos.', unauthenticated: 'A sessão terminou antes de carregar os contactos.', retry: 'Tentar novamente', explanation: 'Telefone, email e morada são opcionais e só são usados neste fluxo autorizado.', noWrite: 'Pode consultar estes contactos, mas não tem permissão para os alterar.', optional: 'Opcional', phone: 'Telefone', email: 'Email', address: 'Morada', phoneTooLong: 'O telefone não pode exceder 40 caracteres.', emailInvalid: 'Introduza um email válido.', emailTooLong: 'O email não pode exceder 254 caracteres.', addressTooLong: 'A morada não pode exceder 500 caracteres.' },
    organization: { loading: 'A carregar agregados e grupos…', error: 'Não foi possível carregar esta parte da organização.', forbidden: 'Não tem permissão para consultar estes relacionamentos.', unauthenticated: 'A sessão terminou antes de carregar esta parte da organização.', retry: 'Tentar novamente', empty: 'Ainda não existem agregados ou grupos configurados.', households: 'Agregados familiares', groups: 'Grupos de serviço', optional: 'Opcional', noWrite: 'Pode consultar estes dados, mas não tem permissão para os alterar.', responsibilities: 'Responsabilidades', responsibilityKey: 'Responsabilidade aprovada', responsibilityHint: 'Ex.: som, literatura, tarefa-local', start: 'Início', end: 'Fim', responsibilityExplanation: 'Responsabilidades são atribuições administrativas explícitas. O intervalo é [início, fim): o início é incluído e o fim é exclusivo.', responsibilityReadOnly: 'Não tem permissão para alterar responsabilidades.', responsibilityRange: 'O fim deve ser posterior ao início.', noResponsibilities: 'Sem responsabilidades registadas.', active: 'Ativa', ended: 'Terminada', scheduled: 'Agendada', invalid: 'Dados inválidos', endResponsibility: 'Encerrar', endQueued: 'Encerramento pendente' },
    participation: { loading: 'A carregar participação…', error: 'Não foi possível carregar esta parte da participação.', forbidden: 'Esta informação de participação está indisponível com as permissões atuais.', unauthenticated: 'A sessão terminou antes de carregar esta parte da participação.', retry: 'Tentar novamente', explanation: 'Elegibilidade é uma decisão administrativa explícita. Não garante disponibilidade nem recomendação e não representa um julgamento pessoal.', unchanged: 'Não configurado / manter atual', enabled: 'Elegível', disabled: 'Não elegível', noWrite: 'Não tem permissão para alterar decisões de elegibilidade.', availability: 'Disponibilidade e ausências', availabilityExplanation: 'Disponibilidade é uma condição temporal baseada em períodos datados e é independente da elegibilidade.', availabilityReadOnly: 'Não tem permissão para alterar períodos de ausência.', start: 'Início', end: 'Fim', reason: 'Motivo', away: 'Ausente', unavailable: 'Indisponível', other: 'Outro', availabilityRange: 'O fim deve ser posterior ao início.', noPeriods: 'Sem períodos de ausência registados.', currentPeriods: 'Períodos registados', optional: 'Opcional', removePeriod: 'Remover', correctPeriod: 'Corrigir', removalQueued: 'Remoção pendente' },
    review: { identity: 'Identidade', name: 'Nome', locale: 'Idioma', state: 'Estado', active: 'Ativo', inactive: 'Inativo', contact: 'Contacto', phone: 'Telefone', email: 'Email', address: 'Morada', organization: 'Organização', households: 'Agregados', groups: 'Grupos', responsibilities: 'Novas responsabilidades', endResponsibilities: 'Responsabilidades a encerrar', none: 'Sem alterações', eligibility: 'Participação / Elegibilidade', eligible: 'Elegível', ineligible: 'Não elegível', availability: 'Disponibilidade / ausências', removeAvailability: 'Períodos a remover', away: 'Ausente', unavailable: 'Indisponível', other: 'Outro', confirm: 'Confirme apenas as alterações abaixo. IDs técnicos, tenant, ator e capabilities não são apresentados.' },
    discardTitle: 'Descartar alterações?', discardDetail: 'As alterações não guardadas serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar', unauthenticated: 'A sessão terminou. Inicie sessão novamente antes de guardar.', permission: 'Não tem permissão para concluir esta ação.', validation: 'Existem dados inválidos. Reveja os campos indicados.', retryable: 'Não foi possível confirmar a gravação. Tente novamente; não é apresentado sucesso sem refetch autoritativo.', ambiguousCreate: 'O resultado da criação é incerto. Para evitar duplicar a pessoa, esta criação não será repetida automaticamente. Feche este fluxo e confirme no Diretório antes de tentar novamente.', partialPersistence: 'Algumas alterações já foram confirmadas pelo servidor. Tentar novamente retoma a partir do estado autoritativo e evita repetir gravações conhecidas.', noChanges: 'Não existem alterações para guardar.', success: 'Dados confirmados pelo servidor.',
  },
  en: {
    createTitle: 'Add person', editTitle: 'Edit person', steps: ['Identity', 'Contact', 'Organization', 'Participation', 'Review'],
    stepAnnouncement: 'Current step', cancel: 'Cancel', previous: 'Previous', next: 'Next', save: 'Confirm and save', saving: 'Saving…', retry: 'Try again',
    identity: { name: 'Name', nameRequired: 'Name is required by the person contract.', locale: 'Preferred language', active: 'Active profile', required: 'Name is the only required field defined by the current contract.', optional: 'Optional' },
    contact: { loading: 'Loading contacts…', error: 'Contacts could not be loaded.', forbidden: 'You do not have permission to view these contacts.', unauthenticated: 'Your session ended before contacts could be loaded.', retry: 'Try again', explanation: 'Phone, email and address are optional and are used only in this authorized workflow.', noWrite: 'You can view these contacts, but you do not have permission to change them.', optional: 'Optional', phone: 'Phone', email: 'Email', address: 'Address', phoneTooLong: 'Phone cannot exceed 40 characters.', emailInvalid: 'Enter a valid email.', emailTooLong: 'Email cannot exceed 254 characters.', addressTooLong: 'Address cannot exceed 500 characters.' },
    organization: { loading: 'Loading households and groups…', error: 'This organization resource could not be loaded.', forbidden: 'You do not have permission to view these relationships.', unauthenticated: 'Your session ended before this organization resource could be loaded.', retry: 'Try again', empty: 'No households or groups have been configured yet.', households: 'Households', groups: 'Service groups', optional: 'Optional', noWrite: 'You can view this data, but you do not have permission to change it.', responsibilities: 'Responsibilities', responsibilityKey: 'Approved responsibility', responsibilityHint: 'E.g. sound, literature, local-duty', start: 'Start', end: 'End', responsibilityExplanation: 'Responsibilities are explicit administrative assignments. The interval is [start, end): start is inclusive and end is exclusive.', responsibilityReadOnly: 'You do not have permission to change responsibilities.', responsibilityRange: 'End must be after start.', noResponsibilities: 'No responsibilities are recorded.', active: 'Active', ended: 'Ended', scheduled: 'Scheduled', invalid: 'Invalid data', endResponsibility: 'End', endQueued: 'End pending' },
    participation: { loading: 'Loading participation…', error: 'This participation resource could not be loaded.', forbidden: 'This participation information is unavailable with the current permissions.', unauthenticated: 'Your session ended before this participation resource could be loaded.', retry: 'Try again', explanation: 'Eligibility is an explicit administrative decision. It does not guarantee availability or recommendation and is not a personal judgment.', unchanged: 'Not configured / keep current', enabled: 'Eligible', disabled: 'Not eligible', noWrite: 'You do not have permission to change eligibility decisions.', availability: 'Availability and absences', availabilityExplanation: 'Availability is a dated operational condition and is independent from eligibility.', availabilityReadOnly: 'You do not have permission to change away periods.', start: 'Start', end: 'End', reason: 'Reason', away: 'Away', unavailable: 'Unavailable', other: 'Other', availabilityRange: 'End must be after start.', noPeriods: 'No away periods are recorded.', currentPeriods: 'Recorded periods', optional: 'Optional', removePeriod: 'Remove', correctPeriod: 'Correct', removalQueued: 'Removal pending' },
    review: { identity: 'Identity', name: 'Name', locale: 'Language', state: 'State', active: 'Active', inactive: 'Inactive', contact: 'Contact', phone: 'Phone', email: 'Email', address: 'Address', organization: 'Organization', households: 'Households', groups: 'Groups', responsibilities: 'New responsibilities', endResponsibilities: 'Responsibilities to end', none: 'No changes', eligibility: 'Participation / Eligibility', eligible: 'Eligible', ineligible: 'Not eligible', availability: 'Availability / absences', removeAvailability: 'Periods to remove', away: 'Away', unavailable: 'Unavailable', other: 'Other', confirm: 'Confirm only the changes below. Technical IDs, tenant, actor and capabilities are not displayed.' },
    discardTitle: 'Discard changes?', discardDetail: 'Unsaved changes will be lost.', keepEditing: 'Keep editing', discard: 'Discard', unauthenticated: 'Your session ended. Sign in again before saving.', permission: 'You do not have permission to complete this action.', validation: 'Some data is invalid. Review the indicated fields.', retryable: 'The save could not be confirmed. Try again; success is never shown without an authoritative refetch.', ambiguousCreate: 'The outcome of the create request is uncertain. To avoid duplicating the person, this creation will not be retried automatically. Close this flow and check the Directory before trying again.', partialPersistence: 'Some changes were already confirmed by the server. Retrying resumes from authoritative state and avoids repeating known writes.', noChanges: 'There are no changes to save.', success: 'Data confirmed by the server.',
  },
  es: {
    createTitle: 'Añadir persona', editTitle: 'Editar persona', steps: ['Identidad', 'Contacto', 'Organización', 'Participación', 'Revisar'],
    stepAnnouncement: 'Paso actual', cancel: 'Cancelar', previous: 'Anterior', next: 'Siguiente', save: 'Confirmar y guardar', saving: 'Guardando…', retry: 'Intentar de nuevo',
    identity: { name: 'Nombre', nameRequired: 'El nombre es obligatorio según el contrato de persona.', locale: 'Idioma preferido', active: 'Perfil activo', required: 'El nombre es el único campo obligatorio definido por el contrato actual.', optional: 'Opcional' },
    contact: { loading: 'Cargando contactos…', error: 'No se pudieron cargar los contactos.', forbidden: 'No tiene permiso para consultar estos contactos.', unauthenticated: 'La sesión terminó antes de cargar los contactos.', retry: 'Intentar de nuevo', explanation: 'El teléfono, el email y la dirección son opcionales y solo se usan en este flujo autorizado.', noWrite: 'Puede consultar estos contactos, pero no tiene permiso para cambiarlos.', optional: 'Opcional', phone: 'Teléfono', email: 'Email', address: 'Dirección', phoneTooLong: 'El teléfono no puede superar 40 caracteres.', emailInvalid: 'Introduzca un email válido.', emailTooLong: 'El email no puede superar 254 caracteres.', addressTooLong: 'La dirección no puede superar 500 caracteres.' },
    organization: { loading: 'Cargando hogares y grupos…', error: 'No se pudo cargar este recurso de organización.', forbidden: 'No tiene permiso para consultar estas relaciones.', unauthenticated: 'La sesión terminó antes de cargar este recurso de organización.', retry: 'Intentar de nuevo', empty: 'Todavía no hay hogares o grupos configurados.', households: 'Hogares', groups: 'Grupos de servicio', optional: 'Opcional', noWrite: 'Puede consultar estos datos, pero no tiene permiso para cambiarlos.', responsibilities: 'Responsabilidades', responsibilityKey: 'Responsabilidad aprobada', responsibilityHint: 'Ej.: sonido, literatura, tarea-local', start: 'Inicio', end: 'Fin', responsibilityExplanation: 'Las responsabilidades son asignaciones administrativas explícitas. El intervalo es [inicio, fin): el inicio se incluye y el fin se excluye.', responsibilityReadOnly: 'No tiene permiso para cambiar responsabilidades.', responsibilityRange: 'El fin debe ser posterior al inicio.', noResponsibilities: 'No hay responsabilidades registradas.', active: 'Activa', ended: 'Terminada', scheduled: 'Programada', invalid: 'Datos inválidos', endResponsibility: 'Finalizar', endQueued: 'Finalización pendiente' },
    participation: { loading: 'Cargando participación…', error: 'No se pudo cargar este recurso de participación.', forbidden: 'Esta información de participación no está disponible con los permisos actuales.', unauthenticated: 'La sesión terminó antes de cargar este recurso de participación.', retry: 'Intentar de nuevo', explanation: 'La elegibilidad es una decisión administrativa explícita. No garantiza disponibilidad ni recomendación y no es un juicio personal.', unchanged: 'Sin configurar / mantener actual', enabled: 'Elegible', disabled: 'No elegible', noWrite: 'No tiene permiso para cambiar decisiones de elegibilidad.', availability: 'Disponibilidad y ausencias', availabilityExplanation: 'La disponibilidad es una condición operativa fechada e independiente de la elegibilidad.', availabilityReadOnly: 'No tiene permiso para cambiar períodos de ausencia.', start: 'Inicio', end: 'Fin', reason: 'Motivo', away: 'Ausente', unavailable: 'No disponible', other: 'Otro', availabilityRange: 'El fin debe ser posterior al inicio.', noPeriods: 'No hay períodos de ausencia registrados.', currentPeriods: 'Períodos registrados', optional: 'Opcional', removePeriod: 'Eliminar', correctPeriod: 'Corregir', removalQueued: 'Eliminación pendiente' },
    review: { identity: 'Identidad', name: 'Nombre', locale: 'Idioma', state: 'Estado', active: 'Activo', inactive: 'Inactivo', contact: 'Contacto', phone: 'Teléfono', email: 'Email', address: 'Dirección', organization: 'Organización', households: 'Hogares', groups: 'Grupos', responsibilities: 'Nuevas responsabilidades', endResponsibilities: 'Responsabilidades a finalizar', none: 'Sin cambios', eligibility: 'Participación / Elegibilidad', eligible: 'Elegible', ineligible: 'No elegible', availability: 'Disponibilidad / ausencias', removeAvailability: 'Períodos a eliminar', away: 'Ausente', unavailable: 'No disponible', other: 'Otro', confirm: 'Confirme solo los cambios siguientes. No se muestran IDs técnicos, tenant, actor ni capabilities.' },
    discardTitle: '¿Descartar cambios?', discardDetail: 'Se perderán los cambios no guardados.', keepEditing: 'Seguir editando', discard: 'Descartar', unauthenticated: 'La sesión terminó. Inicie sesión de nuevo antes de guardar.', permission: 'No tiene permiso para completar esta acción.', validation: 'Hay datos inválidos. Revise los campos indicados.', retryable: 'No se pudo confirmar el guardado. Inténtelo de nuevo; nunca se muestra éxito sin una recarga autoritativa.', ambiguousCreate: 'El resultado de la creación es incierto. Para evitar duplicar la persona, esta creación no se repetirá automáticamente. Cierre este flujo y compruebe el Directorio antes de intentarlo de nuevo.', partialPersistence: 'Algunos cambios ya fueron confirmados por el servidor. Reintentar continúa desde el estado autoritativo y evita repetir escrituras conocidas.', noChanges: 'No hay cambios para guardar.', success: 'Datos confirmados por el servidor.',
  },
} as const;

function selectedMembership<T extends { id: string; memberIds: readonly string[] }>(items: readonly T[], personId: string | undefined): string[] {
  return personId ? items.filter(item => item.memberIds.includes(personId)).map(item => item.id) : [];
}

export function PersonWizard({ open, mode, locale, capabilities, person, apis, onCancel, onSaved }: PersonWizardProps) {
  const text = copy[locale];
  const api: PersonWizardApis = {
    people: apis?.people ?? peopleApi,
    households: apis?.households ?? householdsApi,
    serviceGroups: apis?.serviceGroups ?? serviceGroupsApi,
    eligibility: apis?.eligibility ?? eligibilityApi,
    contact: apis?.contact ?? ordinaryContactApi,
    responsibilities: apis?.responsibilities ?? responsibilitiesApi,
    availability: apis?.availability ?? availabilityApi,
  };
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PersonWizardDraft>(() => createPersonWizardDraft(locale, person));
  const [initial, setInitial] = useState<PersonWizardDraft>(() => createPersonWizardDraft(locale, person));
  const [households, setHouseholds] = useState<readonly HouseholdDto[]>([]);
  const [groups, setGroups] = useState<readonly ServiceGroupDto[]>([]);
  const [responsibilities, setResponsibilities] = useState<readonly ResponsibilityDto[]>([]);
  const [periods, setPeriods] = useState<readonly AvailabilityPeriodDto[]>([]);
  const [contactState, setContactState] = useState<PersonWizardResourceState>('loading');
  const [membershipState, setMembershipState] = useState<PersonWizardResourceState>('loading');
  const [responsibilityState, setResponsibilityState] = useState<PersonWizardResourceState>('loading');
  const [eligibilityState, setEligibilityState] = useState<PersonWizardResourceState>('loading');
  const [availabilityState, setAvailabilityState] = useState<PersonWizardResourceState>('loading');
  const [mutationState, setMutationState] = useState<PersonWizardMutationState>('idle');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [partialPersisted, setPartialPersisted] = useState(false);
  const [unknownCreateOutcome, setUnknownCreateOutcome] = useState(false);

  const mutationGuardRef = useRef(createPersonWizardMutationGuard());
  const persistedCoreRef = useRef<PersonProfileDto | undefined>(undefined);
  const contactBaselineInitializedRef = useRef(false);
  const membershipBaselineInitializedRef = useRef(false);
  const eligibilityBaselineInitializedRef = useRef(false);
  const relatedRequestRef = useRef(0);
  const relatedControllerRef = useRef<AbortController | null>(null);
  const capabilitiesKey = [...capabilities].sort().join('|');
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
  const canReadResponsibilities = canReadPeople && capabilities.includes('responsibilities.read');
  const canWriteResponsibilities = canReadResponsibilities && capabilities.includes('responsibilities.write');
  const canReadAvailability = canReadPeople && capabilities.includes('availability.read');
  const canWriteAvailability = canReadAvailability && capabilities.includes('availability.write');

  const dirty = personWizardHasChanges(initial, draft);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const busy = mutationState === 'validating' || mutationState === 'submitting';
  const contactChanged = personWizardContactChanged(initial, draft);
  const membershipChanged = personWizardMembershipChanges(initial.householdIds, draft.householdIds).length > 0 || personWizardMembershipChanges(initial.serviceGroupIds, draft.serviceGroupIds).length > 0;
  const responsibilityChanged = draft.responsibilities.length > 0 || draft.responsibilityEnds.length > 0;
  const eligibilityChanged = personWizardEligibilityChanges(initial, draft).length > 0;
  const availabilityChanged = personWizardAvailabilityChanges(initial, draft).length > 0 || draft.availabilityRemovals.length > 0;
  const contactValidationKeys = personWizardContactValidation(draft.contact);
  const contactErrors: Readonly<Partial<Record<'phone' | 'email' | 'address', string>>> = {
    ...(contactValidationKeys.includes('phone') ? { phone: text.contact.phoneTooLong } : {}),
    ...(contactValidationKeys.includes('email') ? { email: (draft.contact.email?.trim().length ?? 0) > 254 ? text.contact.emailTooLong : text.contact.emailInvalid } : {}),
    ...(contactValidationKeys.includes('address') ? { address: text.contact.addressTooLong } : {}),
  };
  const canSave = canWritePeople
    && !unknownCreateOutcome
    && (!contactChanged || (canWritePeople && contactState === 'ready' && contactValidationKeys.length === 0))
    && (!membershipChanged || membershipState === 'ready')
    && (!responsibilityChanged || (canWriteResponsibilities && responsibilityState === 'ready'))
    && (!eligibilityChanged || (canWriteEligibility && eligibilityState === 'ready'))
    && (!availabilityChanged || (canWriteAvailability && availabilityState === 'ready'));

  const updateDraft = (change: Partial<PersonWizardDraft>) => {
    setDraft(current => ({ ...current, ...change }));
    if (mutationState !== 'idle') setMutationState('idle');
  };

  const loadRelated = async (preserveDraft = false) => {
    const requestVersion = ++relatedRequestRef.current;
    relatedControllerRef.current?.abort();
    const controller = new AbortController();
    relatedControllerRef.current = controller;

    setContactState(canReadPeople ? 'loading' : 'forbidden');
    setMembershipState(canReadPeople ? 'loading' : 'forbidden');
    setEligibilityState(canReadEligibility ? 'loading' : 'forbidden');
    setResponsibilityState(canReadResponsibilities ? 'loading' : 'forbidden');
    setAvailabilityState(canReadAvailability ? 'loading' : 'forbidden');

    const contactRequest = canReadPeople && mode === 'edit' && person ? api.contact.get(person.id, controller.signal) : Promise.resolve<OrdinaryContactDto>({});
    const householdRequest = canReadPeople ? api.households.list(controller.signal) : Promise.resolve<readonly HouseholdDto[]>([]);
    const groupRequest = canReadPeople ? api.serviceGroups.list(controller.signal) : Promise.resolve<readonly ServiceGroupDto[]>([]);
    const eligibilityRequest = canReadEligibility && mode === 'edit' && person ? api.eligibility.list(person.id, controller.signal) : Promise.resolve([]);
    const responsibilityRequest = canReadResponsibilities && mode === 'edit' && person ? api.responsibilities.list(controller.signal) : Promise.resolve<readonly ResponsibilityDto[]>([]);
    const availabilityRequest = canReadAvailability && mode === 'edit' && person ? api.availability.list(person.id, controller.signal) : Promise.resolve<readonly AvailabilityPeriodDto[]>([]);

    const [contactResult, householdResult, groupResult, eligibilityResult, responsibilityResult, availabilityResult] = await Promise.allSettled([
      contactRequest,
      householdRequest,
      groupRequest,
      eligibilityRequest,
      responsibilityRequest,
      availabilityRequest,
    ]);
    if (controller.signal.aborted || requestVersion !== relatedRequestRef.current) return;

    if (!canReadPeople) {
      setContactState('forbidden');
      setMembershipState('forbidden');
    } else {
      if (contactResult.status === 'rejected') setContactState(wizardResourceState(contactResult.reason));
      else {
        setContactState('ready');
        if (shouldInitializeRelatedBaseline(preserveDraft, contactBaselineInitializedRef.current)) {
          const contact = contactResult.value;
          setDraft(current => ({ ...current, contact }));
          setInitial(current => ({ ...current, contact }));
          contactBaselineInitializedRef.current = true;
        }
      }

      const membershipError = householdResult.status === 'rejected' ? householdResult.reason : groupResult.status === 'rejected' ? groupResult.reason : undefined;
      if (membershipError) setMembershipState(wizardResourceState(membershipError));
      else {
        const nextHouseholds = householdResult.status === 'fulfilled' ? householdResult.value : [];
        const nextGroups = groupResult.status === 'fulfilled' ? groupResult.value : [];
        setHouseholds(nextHouseholds);
        setGroups(nextGroups);
        setMembershipState('ready');
        if (shouldInitializeRelatedBaseline(preserveDraft, membershipBaselineInitializedRef.current)) {
          const householdIds = selectedMembership(nextHouseholds, person?.id);
          const serviceGroupIds = selectedMembership(nextGroups, person?.id);
          setDraft(current => ({ ...current, householdIds, serviceGroupIds }));
          setInitial(current => ({ ...current, householdIds, serviceGroupIds }));
          membershipBaselineInitializedRef.current = true;
        }
      }
    }

    if (!canReadEligibility) setEligibilityState('forbidden');
    else if (eligibilityResult.status === 'rejected') setEligibilityState(wizardResourceState(eligibilityResult.reason));
    else {
      const decisions = eligibilityResult.value ?? [];
      const choices = Object.fromEntries(decisions.map(decision => [decision.assignmentTypeId, decision.enabled ? 'enabled' : 'disabled'] as const));
      if (shouldInitializeRelatedBaseline(preserveDraft, eligibilityBaselineInitializedRef.current)) {
        setDraft(current => ({ ...current, eligibility: choices }));
        setInitial(current => ({ ...current, eligibility: choices }));
        eligibilityBaselineInitializedRef.current = true;
      }
      setEligibilityState('ready');
    }

    if (!canReadResponsibilities) setResponsibilityState('forbidden');
    else if (responsibilityResult.status === 'rejected') setResponsibilityState(wizardResourceState(responsibilityResult.reason));
    else {
      setResponsibilities(person ? responsibilityResult.value.filter(item => item.personId === person.id) : []);
      setResponsibilityState('ready');
    }

    if (!canReadAvailability) setAvailabilityState('forbidden');
    else if (availabilityResult.status === 'rejected') setAvailabilityState(wizardResourceState(availabilityResult.reason));
    else {
      setPeriods(availabilityResult.value);
      setAvailabilityState('ready');
    }
  };

  useEffect(() => {
    if (!open) return;
    const base = createPersonWizardDraft(locale, person);
    setStep(0);
    setDraft(base);
    setInitial(base);
    setMutationState('idle');
    setDiscardOpen(false);
    setPartialPersisted(false);
    setUnknownCreateOutcome(false);
    setHouseholds([]);
    setGroups([]);
    setResponsibilities([]);
    setPeriods([]);
    persistedCoreRef.current = undefined;
    contactBaselineInitializedRef.current = false;
    membershipBaselineInitializedRef.current = false;
    eligibilityBaselineInitializedRef.current = false;
    capabilitiesKeyRef.current = capabilitiesKey;
    form.resetFields();
    form.setFieldsValue({ displayName: base.displayName });
    void loadRelated(false);
    return () => {
      relatedRequestRef.current += 1;
      relatedControllerRef.current?.abort();
    };
  }, [open, mode, person?.id, locale]);

  useEffect(() => {
    if (!open || capabilitiesKeyRef.current === capabilitiesKey) return;
    capabilitiesKeyRef.current = capabilitiesKey;
    contactBaselineInitializedRef.current = false;
    membershipBaselineInitializedRef.current = false;
    eligibilityBaselineInitializedRef.current = false;
    setHouseholds([]);
    setGroups([]);
    setResponsibilities([]);
    setPeriods([]);
    setDraft(current => ({ ...current, contact: {}, householdIds: [], serviceGroupIds: [], eligibility: {}, responsibilities: [], responsibilityEnds: [], availabilityPeriods: [], availabilityRemovals: [] }));
    setInitial(current => ({ ...current, contact: {}, householdIds: [], serviceGroupIds: [], eligibility: {}, responsibilities: [], responsibilityEnds: [], availabilityPeriods: [], availabilityRemovals: [] }));
    void loadRelated(false);
  }, [open, capabilitiesKey]);

  useEffect(() => {
    if (!open) return;
    if (!historyGuardRef.current) {
      window.history.pushState({ ...window.history.state, personWizardMarker: historyMarkerRef.current }, '', `${window.location.pathname}${window.location.search}${window.location.hash}`);
      historyGuardRef.current = true;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const popState = (event: PopStateEvent) => {
      if (closingHistoryRef.current) {
        closingHistoryRef.current = false;
        const callback = pendingHistoryCallbackRef.current;
        pendingHistoryCallbackRef.current = null;
        callback?.();
        return;
      }
      if (event.state?.personWizardMarker === historyMarkerRef.current) {
        if (restoringHistoryRef.current) {
          restoringHistoryRef.current = false;
          setDiscardOpen(true);
        }
        return;
      }
      if (dirtyRef.current) {
        restoringHistoryRef.current = true;
        window.history.forward();
      } else {
        historyGuardRef.current = false;
        onCancel();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', popState);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', popState);
    };
  }, [open]);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }, [open, step]);

  const releaseHistoryMarker = (callback: () => void) => {
    if (historyGuardRef.current && window.history.state?.personWizardMarker === historyMarkerRef.current) {
      closingHistoryRef.current = true;
      historyGuardRef.current = false;
      pendingHistoryCallbackRef.current = callback;
      window.history.back();
    } else callback();
  };
  const closeConfirmed = () => releaseHistoryMarker(onCancel);
  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else closeConfirmed();
  };

  const goTo = async (target: number) => {
    if (busy) return;
    if (target > 0) {
      setMutationState('validating');
      try {
        await form.validateFields(['displayName']);
      } catch {
        setMutationState('validation-error');
        form.scrollToField('displayName', { focus: true });
        return;
      }
    }
    if (step === 1 && target > 1 && contactValidationKeys.length > 0) {
      setMutationState('validation-error');
      return;
    }
    setMutationState('idle');
    setStep(target);
  };

  const save = async () => mutationGuardRef.current(async () => {
    if (busy || !canSave || (mode === 'edit' && !dirty) || (mode === 'edit' && !person)) return;
    setMutationState('validating');
    try {
      await form.validateFields(['displayName']);
      if (contactValidationKeys.length > 0) throw new Error('Invalid contact values (422)');
      setMutationState('submitting');
      const authoritative = await savePersonWizard({
        mode,
        person: persistedCoreRef.current ?? person,
        draft,
        initial,
        households,
        groups,
        canReadContact: canReadPeople,
        canWriteContact: canWritePeople,
        canReadEligibility,
        canWriteEligibility,
        canReadResponsibilities,
        canWriteResponsibilities,
        canReadAvailability,
        canWriteAvailability,
        apis: api,
        onCorePersisted: value => { persistedCoreRef.current = value; },
        onMutationPersisted: () => setPartialPersisted(true),
      });
      persistedCoreRef.current = authoritative;
      setInitial(draft);
      setPartialPersisted(false);
      setUnknownCreateOutcome(false);
      setMutationState('success');
      releaseHistoryMarker(() => onSaved(authoritative));
    } catch (error) {
      const state = wizardErrorState(error);
      if (isAmbiguousCreateOutcome(mode, state, Boolean(persistedCoreRef.current))) setUnknownCreateOutcome(true);
      setMutationState(state);
      if (state === 'validation-error' && !contactValidationKeys.length) {
        form.setFields([{ name: 'displayName', errors: [text.validation] }]);
        form.scrollToField('displayName', { focus: true });
      }
    }
  });

  const errorMessage = mutationState === 'unauthenticated' ? text.unauthenticated
    : mutationState === 'permission-error' ? text.permission
      : mutationState === 'validation-error' ? text.validation
        : mutationState === 'retryable-error' ? text.retryable
          : undefined;
  const canRetryMutation = mutationState === 'retryable-error' && !unknownCreateOutcome;
  const loadingStep = <Typography.Text role="status">{step === 2 ? text.organization.loading : text.participation.loading}</Typography.Text>;
  const stepContent = step === 0
    ? <PersonWizardIdentityStep draft={draft} labels={text.identity} onChange={updateDraft} />
    : step === 1
      ? <PersonWizardContactStep contact={draft.contact} state={contactState} canWrite={canWritePeople} labels={text.contact} errors={contactErrors} onChange={contact => updateDraft({ contact })} onRetry={() => void loadRelated(true)} />
      : step === 2
        ? <Suspense fallback={loadingStep}><PersonWizardOrganizationStep draft={draft} households={households} groups={groups} responsibilities={responsibilities} membershipState={membershipState} responsibilityState={responsibilityState} canWriteMembership={canWritePeople} canWriteResponsibilities={canWriteResponsibilities} labels={text.organization} onChange={updateDraft} onRetryMembership={() => void loadRelated(true)} onRetryResponsibilities={() => void loadRelated(true)} /></Suspense>
        : step === 3
          ? <Suspense fallback={loadingStep}><PersonWizardParticipationStep locale={locale} draft={draft} periods={periods} eligibilityState={eligibilityState} availabilityState={availabilityState} canWriteEligibility={canWriteEligibility} canWriteAvailability={canWriteAvailability} labels={text.participation} onChange={updateDraft} onRetryEligibility={() => void loadRelated(true)} onRetryAvailability={() => void loadRelated(true)} /></Suspense>
          : <Suspense fallback={loadingStep}><PersonWizardReviewStep mode={mode} locale={locale} draft={draft} initial={initial} households={households} groups={groups} responsibilities={responsibilities} periods={periods} labels={text.review} /></Suspense>;

  return <>
    <Modal className="person-wizard" open={open} width={900} title={mode === 'create' ? text.createTitle : text.editTitle} footer={null} onCancel={requestClose} maskClosable={!busy} keyboard={!busy} destroyOnHidden>
      {mutationState === 'success' ? <Result status="success" title={text.success} /> : <Form form={form} layout="vertical" initialValues={{ displayName: draft.displayName }} requiredMark="optional" onFinish={() => { if (step === 4) void save(); else void goTo(step + 1); }}>
        <Steps className="person-wizard-steps" current={step} responsive size="small" onChange={busy ? undefined : target => void goTo(target)} items={text.steps.map(title => ({ title, disabled: busy }))} />
        <Typography.Title ref={headingRef} tabIndex={-1} level={3} style={{ marginTop: 0 }} aria-live="polite">{text.stepAnnouncement}: {text.steps[step]}</Typography.Title>
        {unknownCreateOutcome ? <Alert style={{ marginBottom: 16 }} type="error" showIcon title={text.ambiguousCreate} /> : errorMessage ? <Alert style={{ marginBottom: 16 }} type="error" showIcon title={errorMessage} action={canRetryMutation ? <Button disabled={busy} onClick={() => void save()}>{text.retry}</Button> : undefined} /> : null}
        {partialPersisted && !unknownCreateOutcome && errorMessage ? <Alert style={{ marginBottom: 16 }} type="warning" showIcon title={text.partialPersistence} /> : null}
        {mode === 'edit' && step === 4 && !dirty ? <Alert type="info" showIcon title={text.noChanges} style={{ marginBottom: 16 }} /> : null}
        <div className="person-wizard-content">{stepContent}</div>
        <div className="person-wizard-actions">
          <Button disabled={busy} onClick={requestClose}>{text.cancel}</Button>
          <Space wrap>
            {step > 0 ? <Button disabled={busy} onClick={() => void goTo(personWizardStep(step, 'previous'))}>{text.previous}</Button> : null}
            <Button htmlType="submit" type="primary" loading={busy} disabled={busy || !canWritePeople || unknownCreateOutcome || (step === 4 && (!canSave || (mode === 'edit' && !dirty)))}>{busy ? text.saving : step === 4 ? text.save : text.next}</Button>
          </Space>
        </div>
      </Form>}
    </Modal>
    <Modal open={discardOpen} title={text.discardTitle} onCancel={() => setDiscardOpen(false)} onOk={() => { setDiscardOpen(false); closeConfirmed(); }} okText={text.discard} cancelText={text.keepEditing} okButtonProps={{ danger: true }}>{text.discardDetail}</Modal>
  </>;
}

export const personWizardCopy = copy;
