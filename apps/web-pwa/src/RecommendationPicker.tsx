import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Modal from 'antd/es/modal';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import type { Locale } from './lib/preferences';
import {
  peopleRecommendationApi,
  PeopleRecommendationApiError,
  type PeopleRecommendationDto,
  type RecommendationPersonDto,
} from './lib/peopleRecommendationApi';
import { recommendationReasonText, recommendationWarningText } from './lib/recommendationReasonCopy';

const { Paragraph, Text, Title } = Typography;
const DEFAULT_RECOMMENDATION_LIMIT = 3;
type LoadState = 'loading' | 'ready' | 'error';

const copy = {
  'pt-PT': {
    title: 'Recomendados', subtitle: 'Sugestões baseadas apenas em elegibilidade, disponibilidade, conflitos, carga semanal, histórico autorizado e exclusões manuais explícitas. A decisão continua a ser sua.', loading: 'A analisar candidatos…', empty: 'Não existem candidatos recomendados para esta parte.', error: 'Não foi possível obter recomendações. Pode tentar novamente ou usar a seleção manual, se estiver disponível.', unauthorized: 'É necessário iniciar sessão para consultar recomendações.', forbidden: 'Não tem permissão para consultar todas as evidências necessárias para recomendações.', unavailableTarget: 'Esta parte ainda não tem informação suficiente para gerar recomendações.', retry: 'Tentar novamente', select: 'Selecionar', selected: 'Selecionado', recommendation: 'Recomendação', allEligible: 'Ver todos os elegíveis', hideAllEligible: 'Ocultar lista completa', otherEligible: 'Outros elegíveis', allEligibleHint: 'Estas pessoas também passaram as restrições operacionais desta parte. A ordem continua a vir do servidor; o browser não recalcula a recomendação.', exclude: 'Excluir desta parte', excludeTitle: 'Criar exclusão manual?', excludeConfirm: 'Esta pessoa deixará de aparecer como recomendada para este tipo de designação até remover a exclusão.', manualExcluded: 'Exclusões manuais', manualExcludedHint: 'Estas exclusões foram guardadas explicitamente para este tipo de designação. Não são inferidas a partir de dados pessoais.', allow: 'Remover exclusão', allowTitle: 'Remover exclusão manual?', allowConfirm: 'Esta pessoa voltará a ser avaliada normalmente pelas regras operacionais deste tipo de designação.', constraintError: 'Não foi possível alterar a exclusão manual.', manualReason: 'Excluída manualmente para este tipo de designação.' },
  en: {
    title: 'Recommended', subtitle: 'Suggestions use only authorized eligibility, availability, conflicts, weekly workload, assignment history and explicit manual exclusions. The final decision remains yours.', loading: 'Reviewing candidates…', empty: 'There are no recommended candidates for this part.', error: 'Recommendations could not be loaded. You can retry or use manual selection if it is available.', unauthorized: 'Sign-in is required to view recommendations.', forbidden: 'You do not have permission to view all evidence required for recommendations.', unavailableTarget: 'This part does not yet have enough information to generate recommendations.', retry: 'Try again', select: 'Select', selected: 'Selected', recommendation: 'Recommendation', allEligible: 'View all eligible', hideAllEligible: 'Hide full list', otherEligible: 'Other eligible people', allEligibleHint: 'These people also passed the operational constraints for this part. Ordering still comes from the server; the browser does not recalculate the recommendation.', exclude: 'Exclude for this part', excludeTitle: 'Create manual exclusion?', excludeConfirm: 'This person will stop appearing as recommended for this assignment type until the exclusion is removed.', manualExcluded: 'Manual exclusions', manualExcludedHint: 'These exclusions were explicitly saved for this assignment type. They are not inferred from personal data.', allow: 'Remove exclusion', allowTitle: 'Remove manual exclusion?', allowConfirm: 'This person will again be evaluated normally by the operational rules for this assignment type.', constraintError: 'The manual exclusion could not be changed.', manualReason: 'Manually excluded for this assignment type.' },
  es: {
    title: 'Recomendados', subtitle: 'Las sugerencias usan solo elegibilidad, disponibilidad, conflictos, carga semanal, historial autorizado y exclusiones manuales explícitas. La decisión final sigue siendo suya.', loading: 'Analizando candidatos…', empty: 'No hay candidatos recomendados para esta parte.', error: 'No se pudieron cargar las recomendaciones. Puede intentarlo de nuevo o usar la selección manual si está disponible.', unauthorized: 'Es necesario iniciar sesión para consultar recomendaciones.', forbidden: 'No tiene permiso para consultar todas las evidencias necesarias para las recomendaciones.', unavailableTarget: 'Esta parte aún no tiene información suficiente para generar recomendaciones.', retry: 'Intentar de nuevo', select: 'Seleccionar', selected: 'Seleccionado', recommendation: 'Recomendación', allEligible: 'Ver todos los elegibles', hideAllEligible: 'Ocultar lista completa', otherEligible: 'Otros elegibles', allEligibleHint: 'Estas personas también superaron las restricciones operativas de esta parte. El orden sigue viniendo del servidor; el navegador no recalcula la recomendación.', exclude: 'Excluir para esta parte', excludeTitle: '¿Crear exclusión manual?', excludeConfirm: 'Esta persona dejará de aparecer como recomendada para este tipo de asignación hasta eliminar la exclusión.', manualExcluded: 'Exclusiones manuales', manualExcludedHint: 'Estas exclusiones se guardaron explícitamente para este tipo de asignación. No se infieren a partir de datos personales.', allow: 'Eliminar exclusión', allowTitle: '¿Eliminar exclusión manual?', allowConfirm: 'Esta persona volverá a ser evaluada normalmente por las reglas operativas de este tipo de asignación.', constraintError: 'No se pudo cambiar la exclusión manual.', manualReason: 'Excluida manualmente para este tipo de asignación.' },
} as const;

export function eligibleRecommendationCandidates(candidates: readonly RecommendationPersonDto[]): readonly RecommendationPersonDto[] {
  return Object.freeze(candidates.filter(candidate => candidate.status === 'candidate' && candidate.rank !== undefined));
}
export function topRecommendationCandidates(candidates: readonly RecommendationPersonDto[], limit = DEFAULT_RECOMMENDATION_LIMIT): readonly RecommendationPersonDto[] {
  if (!Number.isInteger(limit) || limit < 1) return Object.freeze([]);
  return Object.freeze(eligibleRecommendationCandidates(candidates).slice(0, limit));
}
export function additionalEligibleCandidates(candidates: readonly RecommendationPersonDto[], limit = DEFAULT_RECOMMENDATION_LIMIT): readonly RecommendationPersonDto[] {
  if (!Number.isInteger(limit) || limit < 1) return Object.freeze([]);
  return Object.freeze(eligibleRecommendationCandidates(candidates).slice(limit));
}
function errorMessage(locale: Locale, status: number | undefined): string {
  const text = copy[locale];
  if (status === 401) return text.unauthorized;
  if (status === 403) return text.forbidden;
  if (status === 400) return text.unavailableTarget;
  return text.error;
}

function CandidateCard({ candidate, locale, selectedPersonId, onSelect, onExclude, disabled, canManage }: {
  readonly candidate: RecommendationPersonDto; readonly locale: Locale; readonly selectedPersonId?: string; readonly onSelect: (personId: string) => void; readonly onExclude: (candidate: RecommendationPersonDto) => void; readonly disabled: boolean; readonly canManage: boolean;
}) {
  const text = copy[locale];
  const selected = candidate.personId === selectedPersonId;
  return <Card size="small" title={<Space size="small" wrap><Text strong>{candidate.rank}. {candidate.displayName}</Text>{selected ? <Tag color="success">{text.selected}</Tag> : null}</Space>} extra={<Text type="secondary">{text.recommendation} #{candidate.rank}</Text>}>
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Space size={[4, 4]} wrap>{candidate.reasons.map(item => <Tag key={item.code}>{recommendationReasonText(item.code, locale)}</Tag>)}</Space>
      {candidate.warnings.map(item => <Text key={item.code} type="warning">{recommendationWarningText(item.code, locale)}</Text>)}
      <Space wrap>
        <Button type={selected ? 'primary' : 'default'} disabled={disabled} onClick={() => onSelect(candidate.personId)} aria-pressed={selected}>{selected ? text.selected : text.select}</Button>
        {canManage ? <Button danger disabled={disabled} onClick={() => onExclude(candidate)}>{text.exclude}</Button> : null}
      </Space>
    </Space>
  </Card>;
}

export interface RecommendationPickerProps { readonly locale: Locale; readonly meetingId: string; readonly slotId: string; readonly selectedPersonId?: string; readonly onSelect: (personId: string) => void; readonly disabled?: boolean; }

export function RecommendationPicker({ locale, meetingId, slotId, selectedPersonId, onSelect, disabled = false }: RecommendationPickerProps) {
  const text = copy[locale];
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PeopleRecommendationDto | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const [retryKey, setRetryKey] = useState(0);
  const [showAllEligible, setShowAllEligible] = useState(false);
  const [constraintBusyPersonId, setConstraintBusyPersonId] = useState<string | null>(null);
  const [constraintError, setConstraintError] = useState(false);
  const requestVersionRef = useRef(0);
  const constraintVersionRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    setState('loading'); setData(null); setErrorStatus(undefined); setShowAllEligible(false); setConstraintError(false);
    void peopleRecommendationApi.get(meetingId, slotId, controller.signal).then(result => {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setData(result); setState('ready');
    }).catch(error => {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setErrorStatus(error instanceof PeopleRecommendationApiError ? error.status : undefined); setState('error');
    });
    return () => controller.abort();
  }, [meetingId, slotId, retryKey]);

  const changeConstraint = async (personId: string, excluded: boolean) => {
    if (disabled || constraintBusyPersonId) return;
    const version = ++constraintVersionRef.current;
    setConstraintBusyPersonId(personId); setConstraintError(false);
    try {
      await peopleRecommendationApi.setManualExclusion(meetingId, slotId, personId, excluded);
      if (version !== constraintVersionRef.current) return;
      setRetryKey(value => value + 1);
    } catch {
      if (version !== constraintVersionRef.current) return;
      setConstraintError(true);
    } finally {
      if (version === constraintVersionRef.current) setConstraintBusyPersonId(null);
    }
  };
  const confirmExclude = (candidate: RecommendationPersonDto) => Modal.confirm({ title: text.excludeTitle, content: `${candidate.displayName} — ${text.excludeConfirm}`, okText: text.exclude, cancelText: text.hideAllEligible, okButtonProps: { danger: true }, onOk: () => changeConstraint(candidate.personId, true) });
  const confirmAllow = (candidate: RecommendationPersonDto) => Modal.confirm({ title: text.allowTitle, content: `${candidate.displayName} — ${text.allowConfirm}`, okText: text.allow, cancelText: text.hideAllEligible, onOk: () => changeConstraint(candidate.personId, false) });

  const recommendations = useMemo(() => topRecommendationCandidates(data?.candidates ?? []), [data]);
  const additionalEligible = useMemo(() => additionalEligibleCandidates(data?.candidates ?? []), [data]);
  const manuallyExcluded = useMemo(() => (data?.excluded ?? []).filter(candidate => candidate.manualConstraintCodes.includes('MANUAL_EXCLUSION')), [data]);
  const eligibleCount = recommendations.length + additionalEligible.length;
  const additionalRegionId = `recommendation-picker-all-${meetingId}-${slotId}`;
  const interactionDisabled = disabled || Boolean(constraintBusyPersonId);

  return <section aria-labelledby={`recommendation-picker-${meetingId}-${slotId}`}>
    <Title level={5} id={`recommendation-picker-${meetingId}-${slotId}`} style={{ marginBottom: 4 }}>{text.title}</Title>
    <Paragraph type="secondary" style={{ marginTop: 0 }}>{text.subtitle}</Paragraph>
    {state === 'loading' ? <div role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}
    {state === 'error' ? <Alert type={errorStatus === 401 || errorStatus === 403 ? 'warning' : 'error'} showIcon message={errorMessage(locale, errorStatus)} action={<Button size="small" onClick={() => setRetryKey(value => value + 1)}>{text.retry}</Button>} /> : null}
    {constraintError ? <Alert type="error" showIcon message={text.constraintError} action={<Button size="small" onClick={() => setConstraintError(false)}>{text.retry}</Button>} /> : null}
    {state === 'ready' && recommendations.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : null}
    {state === 'ready' && recommendations.length > 0 ? <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {recommendations.map(candidate => <CandidateCard key={candidate.personId} candidate={candidate} locale={locale} selectedPersonId={selectedPersonId} onSelect={onSelect} onExclude={confirmExclude} disabled={interactionDisabled} canManage={Boolean(data?.canManageManualConstraints)} />)}
      {additionalEligible.length > 0 ? <>
        <Button type="link" disabled={interactionDisabled} aria-expanded={showAllEligible} aria-controls={additionalRegionId} onClick={() => setShowAllEligible(value => !value)} style={{ alignSelf: 'flex-start', paddingInline: 0 }}>{showAllEligible ? text.hideAllEligible : `${text.allEligible} (${eligibleCount})`}</Button>
        {showAllEligible ? <div id={additionalRegionId}><Title level={5} style={{ marginBottom: 4 }}>{text.otherEligible}</Title><Paragraph type="secondary" style={{ marginTop: 0 }}>{text.allEligibleHint}</Paragraph><Space direction="vertical" size="small" style={{ width: '100%' }}>{additionalEligible.map(candidate => <CandidateCard key={candidate.personId} candidate={candidate} locale={locale} selectedPersonId={selectedPersonId} onSelect={onSelect} onExclude={confirmExclude} disabled={interactionDisabled} canManage={Boolean(data?.canManageManualConstraints)} />)}</Space></div> : null}
      </> : null}
    </Space> : null}
    {state === 'ready' && data?.canManageManualConstraints && manuallyExcluded.length > 0 ? <Card size="small" title={text.manualExcluded} style={{ marginTop: 12 }}>
      <Paragraph type="secondary">{text.manualExcludedHint}</Paragraph>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {manuallyExcluded.map(candidate => <Card key={candidate.personId} size="small"><Space direction="vertical" size="small"><Text strong>{candidate.displayName}</Text><Text type="secondary">{text.manualReason}</Text><Button disabled={interactionDisabled} onClick={() => confirmAllow(candidate)}>{text.allow}</Button></Space></Card>)}
      </Space>
    </Card> : null}
  </section>;
}