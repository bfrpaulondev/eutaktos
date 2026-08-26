import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { ELIGIBILITY_ASSIGNMENT_TYPES } from './lib/assignmentTypeCatalog';
import type { Locale } from './lib/preferences';
import type { EligibilityChoice, PersonWizardDraft, PersonWizardResourceState } from './PersonWizardModel';

export function PersonWizardParticipationStep({ locale, draft, state, canWrite, labels, onChange, onRetry }: {
  locale: Locale;
  draft: PersonWizardDraft;
  state: PersonWizardResourceState;
  canWrite: boolean;
  labels: Readonly<{ loading: string; error: string; forbidden: string; unauthenticated: string; retry: string; explanation: string; availabilityGap: string; unchanged: string; enabled: string; disabled: string; noWrite: string }>;
  onChange: (change: Partial<PersonWizardDraft>) => void;
  onRetry: () => void;
}) {
  if (state === 'loading') return <Card aria-busy="true"><Skeleton active paragraph={{ rows: 4 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></Card>;
  if (state === 'error') return <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetry}>{labels.retry}</Button>} />;
  if (state === 'unauthenticated') return <Alert type="error" showIcon title={labels.unauthenticated} />;
  if (state === 'forbidden') return <Alert type="warning" showIcon title={labels.forbidden} />;
  const update = (id: string, choice: EligibilityChoice) => onChange({ eligibility: { ...draft.eligibility, [id]: choice } });
  return <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    <Alert type="info" showIcon title={labels.explanation} />
    <Alert type="info" title={labels.availabilityGap} />
    {!canWrite ? <Alert type="warning" showIcon title={labels.noWrite} /> : null}
    {ELIGIBILITY_ASSIGNMENT_TYPES.map(type => <Card size="small" key={type.id}><div className="person-wizard-choice"><Typography.Text strong>{type.label[locale]}</Typography.Text><Select aria-label={type.label[locale]} disabled={!canWrite} value={draft.eligibility[type.id] ?? 'unchanged'} onChange={value => update(type.id, value)} options={[{ value: 'unchanged', label: labels.unchanged }, { value: 'enabled', label: labels.enabled }, { value: 'disabled', label: labels.disabled }]} /></div></Card>)}
  </Space>;
}
