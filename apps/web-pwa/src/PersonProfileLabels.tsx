import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useState } from 'react';
import { PersonLabelsDialog } from './PersonLabelsDialog';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { sessionApi } from './lib/sessionApi';

const copy = {
  'pt-PT': {
    title: 'Etiquetas',
    empty: 'Sem etiquetas',
    edit: 'Editar etiquetas',
    loading: 'A carregar etiquetas…',
    error: 'Não foi possível carregar as etiquetas deste perfil.',
    retry: 'Tentar novamente',
  },
  en: {
    title: 'Labels',
    empty: 'No labels',
    edit: 'Edit labels',
    loading: 'Loading labels…',
    error: 'The labels for this profile could not be loaded.',
    retry: 'Try again',
  },
  es: {
    title: 'Etiquetas',
    empty: 'Sin etiquetas',
    edit: 'Editar etiquetas',
    loading: 'Cargando etiquetas…',
    error: 'No se pudieron cargar las etiquetas de este perfil.',
    retry: 'Intentar de nuevo',
  },
} as const;

type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; person: PersonProfileDto; canWrite: boolean }>
  | Readonly<{ status: 'error' }>;

export function PersonProfileLabels({ personId, locale }: { personId: string; locale: Locale }) {
  const text = copy[locale];
  const [state, setState] = useState<State>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    void Promise.all([peopleApi.list(controller.signal), sessionApi.current(controller.signal)]).then(([people, session]) => {
      if (controller.signal.aborted) return;
      const person = people.find(candidate => candidate.id === personId);
      if (!person) {
        setState({ status: 'error' });
        return;
      }
      setState({ status: 'ready', person, canWrite: session.capabilities.includes('people.write') });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [personId, requestVersion]);

  if (state.status === 'loading') return <Card title={text.title} aria-busy="true"><Space orientation="vertical" style={{ display: 'flex' }}><Skeleton active paragraph={{ rows: 1 }} /><Typography.Text role="status" type="secondary">{text.loading}</Typography.Text></Space></Card>;

  if (state.status === 'error') return <Card title={text.title}><Alert type="error" showIcon title={text.error} action={<Button size="small" onClick={() => setRequestVersion(current => current + 1)}>{text.retry}</Button>} /></Card>;

  const labels = state.person.labels ?? [];
  return <Card title={text.title} extra={<Button onClick={() => setOpen(true)}>{text.edit}</Button>}>
    <Space size={[4, 4]} wrap>
      {labels.length ? labels.map(label => <Tag key={label}>{label}</Tag>) : <Typography.Text type="secondary">{text.empty}</Typography.Text>}
    </Space>
    <PersonLabelsDialog
      personId={state.person.id}
      personName={state.person.displayName}
      labels={labels}
      locale={locale}
      canWrite={state.canWrite}
      open={open}
      onClose={() => setOpen(false)}
      onSaved={nextLabels => setState(current => current.status === 'ready' ? { ...current, person: { ...current.person, labels: nextLabels } } : current)}
    />
  </Card>;
}

export const personProfileLabelsCopy = copy;