import { useEffect, useRef, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { peopleAssistanceApi, type PeopleAssistanceDto } from './lib/peopleAssistanceApi';
import type { Locale } from './lib/preferences';

const { Paragraph, Text, Title } = Typography;
type LoadState = 'loading' | 'ready' | 'error';

const copy = {
  'pt-PT': {
    title: 'Assistência operacional',
    subtitle: 'Sugestões factuais para rever. O sistema não faz designações nem toma decisões por si.',
    loading: 'A analisar condições operacionais…',
    error: 'Não foi possível carregar a assistência operacional.',
    retry: 'Tentar novamente',
    unavailable: 'Algumas sugestões não estão disponíveis com as permissões atuais.',
    empty: 'Não existem sugestões operacionais adicionais nos dados disponíveis.',
    dismiss: 'Dispensar',
    openAssignments: 'Abrir designações',
    affected: 'Uma ausência afeta uma designação',
    affectedDetail: 'está marcado como ausente durante a reunião.',
    substitutes: 'Substitutos sugeridos',
    noDirectSubstitute: 'Esta designação precisa de revisão, mas não existe um contrato de substituição direta aprovado para este tipo.',
    incomplete: 'Reunião incompleta',
    openParts: 'partes ainda sem designação',
    candidateParts: 'partes têm candidatos disponíveis para análise',
    workload: 'Distribuição semanal a rever',
    workloadDetail: 'tem mais designações nesta semana do que alternativas elegíveis para esta parte.',
    alternatives: 'alternativas com menor carga semanal',
    longInterval: 'Intervalo longo desde a última designação',
    days: 'dias desde a última designação concluída',
  },
  en: {
    title: 'Operational assistance',
    subtitle: 'Factual prompts for review. The system does not assign people or make decisions for you.',
    loading: 'Reviewing operational conditions…',
    error: 'Operational assistance could not be loaded.',
    retry: 'Try again',
    unavailable: 'Some suggestions are unavailable with the current permissions.',
    empty: 'There are no additional operational prompts in the available data.',
    dismiss: 'Dismiss',
    openAssignments: 'Open assignments',
    affected: 'An absence affects an assignment',
    affectedDetail: 'is recorded as away during the meeting.',
    substitutes: 'Suggested substitutes',
    noDirectSubstitute: 'This assignment needs review, but there is no approved direct-substitution contract for this assignment type.',
    incomplete: 'Meeting incomplete',
    openParts: 'parts still have no assignment',
    candidateParts: 'parts have candidates available for review',
    workload: 'Weekly distribution to review',
    workloadDetail: 'has more assignments this week than eligible alternatives for this part.',
    alternatives: 'alternatives with a lower weekly load',
    longInterval: 'Long interval since the last assignment',
    days: 'days since the last completed assignment',
  },
  es: {
    title: 'Asistencia operativa',
    subtitle: 'Avisos factuales para revisar. El sistema no asigna personas ni toma decisiones por usted.',
    loading: 'Revisando condiciones operativas…',
    error: 'No se pudo cargar la asistencia operativa.',
    retry: 'Intentar de nuevo',
    unavailable: 'Algunas sugerencias no están disponibles con los permisos actuales.',
    empty: 'No hay avisos operativos adicionales en los datos disponibles.',
    dismiss: 'Descartar',
    openAssignments: 'Abrir asignaciones',
    affected: 'Una ausencia afecta una asignación',
    affectedDetail: 'figura como ausente durante la reunión.',
    substitutes: 'Sustitutos sugeridos',
    noDirectSubstitute: 'Esta asignación debe revisarse, pero no existe un contrato aprobado de sustitución directa para este tipo.',
    incomplete: 'Reunión incompleta',
    openParts: 'partes siguen sin asignación',
    candidateParts: 'partes tienen candidatos disponibles para revisar',
    workload: 'Distribución semanal para revisar',
    workloadDetail: 'tiene más asignaciones esta semana que alternativas elegibles para esta parte.',
    alternatives: 'alternativas con menor carga semanal',
    longInterval: 'Intervalo largo desde la última asignación',
    days: 'días desde la última asignación completada',
  },
} as const;

function openAssignments(): void {
  if (window.location.pathname !== '/designacoes') {
    window.history.pushState({ section: 'assignments', source: 'people-assistance' }, '', '/designacoes');
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
}

function AssistanceCard({ title, children, dismiss, action }: {
  title: string;
  children: React.ReactNode;
  dismiss: () => void;
  action: string;
}) {
  return <Card title={title} extra={<Button type="text" size="small" onClick={dismiss}>{action}</Button>}>
    {children}
  </Card>;
}

export function PeopleAssistancePanel({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PeopleAssistanceDto | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const requestRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = ++requestRef.current;
    setState('loading');
    setData(null);
    void peopleAssistanceApi.get(controller.signal).then(value => {
      if (controller.signal.aborted || request !== requestRef.current) return;
      setData(value);
      setState('ready');
    }).catch(() => {
      if (controller.signal.aborted || request !== requestRef.current) return;
      setState('error');
    });
    return () => controller.abort();
  }, [retryKey]);

  const dismiss = (key: string) => setDismissed(current => new Set([...current, key]));
  const cards: React.ReactNode[] = [];

  if (data?.affectedAssignments.status === 'ready') {
    data.affectedAssignments.items.forEach((item, index) => {
      const key = `affected:${item.meetingId}:${item.slotId}:${item.affectedDisplayName}:${index}`;
      if (dismissed.has(key)) return;
      cards.push(<AssistanceCard key={key} title={text.affected} dismiss={() => dismiss(key)} action={text.dismiss}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text><strong>{item.affectedDisplayName}</strong> {text.affectedDetail}</Text>
          <Text type="secondary">{item.meetingDate}</Text>
          {item.suggestionStatus === 'ready' && item.topCandidates.length > 0 ? <>
            <Text strong>{text.substitutes}</Text>
            <Space wrap>{item.topCandidates.map(candidate => <Tag key={`${candidate.rank}:${candidate.displayName}`}>{candidate.rank}. {candidate.displayName}</Tag>)}</Space>
          </> : <Text type="secondary">{text.noDirectSubstitute}</Text>}
          <Button onClick={openAssignments}>{text.openAssignments}</Button>
        </Space>
      </AssistanceCard>);
    });
  }

  if (data?.incompleteMeetings.status === 'ready') {
    data.incompleteMeetings.items.forEach(item => {
      const key = `incomplete:${item.meetingId}`;
      if (dismissed.has(key)) return;
      cards.push(<AssistanceCard key={key} title={text.incomplete} dismiss={() => dismiss(key)} action={text.dismiss}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text><strong>{item.openPartCount}</strong> {text.openParts}.</Text>
          <Text><strong>{item.partsWithCandidates}</strong> {text.candidateParts}.</Text>
          <Text type="secondary">{item.meetingDate}</Text>
          <Button onClick={openAssignments}>{text.openAssignments}</Button>
        </Space>
      </AssistanceCard>);
    });
  }

  if (data?.workloadImbalance.status === 'ready') {
    data.workloadImbalance.items.forEach((item, index) => {
      const key = `workload:${item.meetingId}:${item.slotId}:${item.displayName}:${index}`;
      if (dismissed.has(key)) return;
      cards.push(<AssistanceCard key={key} title={text.workload} dismiss={() => dismiss(key)} action={text.dismiss}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text><strong>{item.displayName}</strong> {text.workloadDetail}</Text>
          <Text>{item.lowerWorkloadAlternativeCount} {text.alternatives}.</Text>
          <Text type="secondary">{item.meetingDate}</Text>
          <Button onClick={openAssignments}>{text.openAssignments}</Button>
        </Space>
      </AssistanceCard>);
    });
  }

  if (data?.longInterval.status === 'ready') {
    data.longInterval.items.forEach((item, index) => {
      const key = `long:${item.meetingId}:${item.slotId}:${item.displayName}:${index}`;
      if (dismissed.has(key)) return;
      cards.push(<AssistanceCard key={key} title={text.longInterval} dismiss={() => dismiss(key)} action={text.dismiss}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text><strong>{item.displayName}</strong> · {item.daysSinceLastCompletedAssignment} {text.days}.</Text>
          <Text type="secondary">{item.meetingDate}</Text>
          <Button onClick={openAssignments}>{text.openAssignments}</Button>
        </Space>
      </AssistanceCard>);
    });
  }

  const hasUnavailable = data ? [data.affectedAssignments, data.incompleteMeetings, data.workloadImbalance, data.longInterval].some(value => value.status === 'unavailable') : false;

  return <section aria-labelledby="people-assistance-title">
    <Title level={3} id="people-assistance-title" style={{ marginBottom: 4 }}>{text.title}</Title>
    <Paragraph type="secondary" style={{ marginTop: 0 }}>{text.subtitle}</Paragraph>
    {state === 'loading' ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 4 }} /></div> : null}
    {state === 'error' ? <Alert type="warning" showIcon title={text.error} action={<Button size="small" onClick={() => setRetryKey(value => value + 1)}>{text.retry}</Button>} /> : null}
    {state === 'ready' && hasUnavailable ? <Alert type="info" showIcon title={text.unavailable} style={{ marginBottom: 12 }} /> : null}
    {state === 'ready' && cards.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : null}
    {state === 'ready' && cards.length > 0 ? <Space direction="vertical" size="middle" style={{ width: '100%' }}>{cards}</Space> : null}
  </section>;
}
