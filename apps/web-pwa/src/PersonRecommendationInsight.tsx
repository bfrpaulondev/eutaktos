import CalendarOutlined from '@ant-design/icons/es/icons/CalendarOutlined';
import LockOutlined from '@ant-design/icons/es/icons/LockOutlined';
import ReloadOutlined from '@ant-design/icons/es/icons/ReloadOutlined';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useRef, useState } from 'react';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import type { Locale } from './lib/preferences';
import {
  isCurrentInsightRequest,
  loadProfileRecommendationInsight,
  type ProfileCandidateInsight,
  type ProfileRecommendationInsightResult,
} from './lib/profileRecommendationInsight';
import { recommendationReasonText, recommendationWarningText } from './lib/recommendationReasonCopy';

const { Paragraph, Text, Title } = Typography;

type InsightState =
  | Readonly<{ status: 'loading' }>
  | ProfileRecommendationInsightResult;

const copy = {
  'pt-PT': {
    title: 'Insight de candidato',
    subtitle: 'Evidência PX7 confirmada para próximas partes ainda sem estudante. É apenas apoio à decisão; nenhuma designação é feita automaticamente.',
    loading: 'A confirmar próximas oportunidades…',
    blocked: 'As permissões atuais não permitem confirmar recomendações para este perfil.',
    empty: 'Nas próximas partes verificadas, não existe neste momento um insight PX7 confirmado para esta pessoa.',
    unavailable: 'Não foi possível confirmar todas as evidências necessárias. Nenhuma conclusão foi estimada.',
    partial: 'Existe evidência positiva confirmada abaixo, mas outra próxima parte não pôde ser verificada.',
    retry: 'Tentar novamente',
    recommendation: 'Recomendação',
    meeting: 'Reunião',
    part: 'Parte',
  },
  en: {
    title: 'Candidate insight',
    subtitle: 'Confirmed PX7 evidence for upcoming student parts that are still unassigned. This supports the decision only; no assignment is made automatically.',
    loading: 'Checking upcoming opportunities…',
    blocked: 'Current permissions do not allow recommendations to be confirmed for this profile.',
    empty: 'Across the upcoming parts checked, there is currently no confirmed PX7 insight for this person.',
    unavailable: 'The required evidence could not all be confirmed. No conclusion was estimated.',
    partial: 'Confirmed positive evidence is shown below, but another upcoming part could not be checked.',
    retry: 'Try again',
    recommendation: 'Recommendation',
    meeting: 'Meeting',
    part: 'Part',
  },
  es: {
    title: 'Insight de candidato',
    subtitle: 'Evidencia PX7 confirmada para próximas partes de estudiante todavía sin asignar. Solo apoya la decisión; no se realiza ninguna asignación automáticamente.',
    loading: 'Comprobando próximas oportunidades…',
    blocked: 'Los permisos actuales no permiten confirmar recomendaciones para este perfil.',
    empty: 'En las próximas partes comprobadas, actualmente no hay un insight PX7 confirmado para esta persona.',
    unavailable: 'No se pudo confirmar toda la evidencia necesaria. No se estimó ninguna conclusión.',
    partial: 'A continuación se muestra evidencia positiva confirmada, pero otra próxima parte no pudo comprobarse.',
    retry: 'Intentar de nuevo',
    recommendation: 'Recomendación',
    meeting: 'Reunión',
    part: 'Parte',
  },
} as const;

function formatCivilDate(value: string, locale: Locale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function InsightCard({ insight, locale }: { insight: ProfileCandidateInsight; locale: Locale }) {
  const text = copy[locale];
  return <Card
    size="small"
    title={<Space wrap><CalendarOutlined /><Text strong>{formatCivilDate(insight.target.meetingDate, locale)} · {insight.target.localTime}</Text></Space>}
    extra={<Tag color="processing">{text.recommendation} #{insight.rank}</Tag>}
  >
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text><Text type="secondary">{text.part}: </Text>{assignmentTypeLabel(insight.target.assignmentTypeId, locale)}</Text>
      <Text type="secondary">{text.meeting}: {insight.target.timezone}</Text>
      <Space size={[4, 4]} wrap>
        {insight.reasons.map(reason => <Tag key={reason.code}>{recommendationReasonText(reason.code, locale)}</Tag>)}
      </Space>
      {insight.warnings.map(warning => <Text key={warning.code} type="warning">{recommendationWarningText(warning.code, locale)}</Text>)}
    </Space>
  </Card>;
}

export function PersonRecommendationInsight({ personId, locale }: { personId: string; locale: Locale }) {
  const text = copy[locale];
  const [state, setState] = useState<InsightState>({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    setState({ status: 'loading' });
    void loadProfileRecommendationInsight(personId, new Date(), controller.signal).then(result => {
      if (!isCurrentInsightRequest(requestVersion, requestVersionRef.current, controller.signal.aborted)) return;
      setState(result);
    }).catch(() => {
      if (!isCurrentInsightRequest(requestVersion, requestVersionRef.current, controller.signal.aborted)) return;
      setState({ status: 'unavailable' });
    });
    return () => controller.abort();
  }, [personId, retryKey]);

  return <Card aria-labelledby="person-recommendation-insight-title">
    <Title level={4} id="person-recommendation-insight-title" style={{ marginTop: 0, marginBottom: 4 }}>{text.title}</Title>
    <Paragraph type="secondary">{text.subtitle}</Paragraph>

    {state.status === 'loading' ? <div role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 2 }} /></div> : null}
    {state.status === 'blocked' ? <Alert type="info" showIcon icon={<LockOutlined />} message={text.blocked} /> : null}
    {state.status === 'empty' ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : null}
    {state.status === 'unavailable' ? <Alert type="warning" showIcon message={text.unavailable} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => setRetryKey(value => value + 1)}>{text.retry}</Button>} /> : null}
    {state.status === 'ready' ? <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {state.partial ? <Alert type="warning" showIcon message={text.partial} /> : null}
      {state.insights.map(insight => <InsightCard key={`${insight.target.meetingId}:${insight.target.slotId}`} insight={insight} locale={locale} />)}
    </Space> : null}
  </Card>;
}
