import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
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
    title: 'Recomendados',
    subtitle: 'Sugestões baseadas apenas em elegibilidade, disponibilidade, conflitos, carga semanal e histórico autorizado. A decisão continua a ser sua.',
    loading: 'A analisar candidatos…',
    empty: 'Não existem candidatos recomendados para esta parte.',
    error: 'Não foi possível obter recomendações. Pode continuar com a seleção manual abaixo.',
    unauthorized: 'É necessário iniciar sessão para consultar recomendações.',
    forbidden: 'Não tem permissão para consultar todas as evidências necessárias para recomendações.',
    unavailableTarget: 'Esta parte ainda não tem informação suficiente para gerar recomendações. Pode continuar com a seleção manual abaixo.',
    retry: 'Tentar novamente',
    select: 'Selecionar',
    selected: 'Selecionado',
    recommendation: 'Recomendação',
  },
  en: {
    title: 'Recommended',
    subtitle: 'Suggestions use only authorized eligibility, availability, conflicts, weekly workload and assignment history. The final decision remains yours.',
    loading: 'Reviewing candidates…',
    empty: 'There are no recommended candidates for this part.',
    error: 'Recommendations could not be loaded. You can continue with the manual selection below.',
    unauthorized: 'Sign-in is required to view recommendations.',
    forbidden: 'You do not have permission to view all evidence required for recommendations.',
    unavailableTarget: 'This part does not yet have enough information to generate recommendations. You can continue with the manual selection below.',
    retry: 'Try again',
    select: 'Select',
    selected: 'Selected',
    recommendation: 'Recommendation',
  },
  es: {
    title: 'Recomendados',
    subtitle: 'Las sugerencias usan solo elegibilidad, disponibilidad, conflictos, carga semanal e historial de asignaciones autorizados. La decisión final sigue siendo suya.',
    loading: 'Analizando candidatos…',
    empty: 'No hay candidatos recomendados para esta parte.',
    error: 'No se pudieron cargar las recomendaciones. Puede continuar con la selección manual de abajo.',
    unauthorized: 'Es necesario iniciar sesión para consultar recomendaciones.',
    forbidden: 'No tiene permiso para consultar todas las evidencias necesarias para las recomendaciones.',
    unavailableTarget: 'Esta parte aún no tiene información suficiente para generar recomendaciones. Puede continuar con la selección manual de abajo.',
    retry: 'Intentar de nuevo',
    select: 'Seleccionar',
    selected: 'Seleccionado',
    recommendation: 'Recomendación',
  },
} as const;

export function topRecommendationCandidates(
  candidates: readonly RecommendationPersonDto[],
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): readonly RecommendationPersonDto[] {
  if (!Number.isInteger(limit) || limit < 1) return Object.freeze([]);
  // The strict API parser already proves server order and sequential ranks.
  // Never calculate, repair or reorder recommendation evidence in the browser.
  return Object.freeze(candidates
    .filter(candidate => candidate.status === 'candidate' && candidate.rank !== undefined)
    .slice(0, limit));
}

function errorMessage(locale: Locale, status: number | undefined): string {
  const text = copy[locale];
  if (status === 401) return text.unauthorized;
  if (status === 403) return text.forbidden;
  if (status === 400) return text.unavailableTarget;
  return text.error;
}

export interface RecommendationPickerProps {
  readonly locale: Locale;
  readonly meetingId: string;
  readonly slotId: string;
  readonly selectedPersonId?: string;
  readonly onSelect: (personId: string) => void;
  readonly disabled?: boolean;
}

export function RecommendationPicker({ locale, meetingId, slotId, selectedPersonId, onSelect, disabled = false }: RecommendationPickerProps) {
  const text = copy[locale];
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PeopleRecommendationDto | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>();
  const [retryKey, setRetryKey] = useState(0);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    setState('loading');
    setData(null);
    setErrorStatus(undefined);
    void peopleRecommendationApi.get(meetingId, slotId, controller.signal).then(result => {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setData(result);
      setState('ready');
    }).catch(error => {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setErrorStatus(error instanceof PeopleRecommendationApiError ? error.status : undefined);
      setState('error');
    });
    return () => controller.abort();
  }, [meetingId, slotId, retryKey]);

  const recommendations = useMemo(() => topRecommendationCandidates(data?.candidates ?? []), [data]);

  return <section aria-labelledby={`recommendation-picker-${meetingId}-${slotId}`}>
    <Title level={5} id={`recommendation-picker-${meetingId}-${slotId}`} style={{ marginBottom: 4 }}>{text.title}</Title>
    <Paragraph type="secondary" style={{ marginTop: 0 }}>{text.subtitle}</Paragraph>

    {state === 'loading' ? <div role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}

    {state === 'error' ? <Alert
      type={errorStatus === 401 || errorStatus === 403 ? 'warning' : 'error'}
      showIcon
      message={errorMessage(locale, errorStatus)}
      action={<Button size="small" onClick={() => setRetryKey(value => value + 1)}>{text.retry}</Button>}
    /> : null}

    {state === 'ready' && recommendations.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : null}

    {state === 'ready' && recommendations.length > 0 ? <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {recommendations.map(candidate => {
        const selected = candidate.personId === selectedPersonId;
        return <Card
          key={candidate.personId}
          size="small"
          title={<Space size="small" wrap><Text strong>{candidate.rank}. {candidate.displayName}</Text>{selected ? <Tag color="success">{text.selected}</Tag> : null}</Space>}
          extra={<Text type="secondary">{text.recommendation} #{candidate.rank}</Text>}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space size={[4, 4]} wrap>
              {candidate.reasons.map(item => <Tag key={item.code}>{recommendationReasonText(item.code, locale)}</Tag>)}
            </Space>
            {candidate.warnings.map(item => <Text key={item.code} type="warning">{recommendationWarningText(item.code, locale)}</Text>)}
            <Button type={selected ? 'primary' : 'default'} disabled={disabled} onClick={() => onSelect(candidate.personId)} aria-pressed={selected}>
              {selected ? text.selected : text.select}
            </Button>
          </Space>
        </Card>;
      })}
    </Space> : null}
  </section>;
}
