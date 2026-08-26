import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import type { HouseholdDto } from './lib/householdsApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import type { PersonWizardDraft, PersonWizardResourceState } from './PersonWizardModel';

export function PersonWizardOrganizationStep({ draft, households, groups, state, canWrite, labels, onChange, onRetry }: {
  draft: PersonWizardDraft;
  households: readonly HouseholdDto[];
  groups: readonly ServiceGroupDto[];
  state: PersonWizardResourceState;
  canWrite: boolean;
  labels: Readonly<{ loading: string; error: string; forbidden: string; unauthenticated: string; retry: string; empty: string; households: string; groups: string; optional: string; noWrite: string }>;
  onChange: (change: Partial<PersonWizardDraft>) => void;
  onRetry: () => void;
}) {
  if (state === 'loading') return <Card aria-busy="true"><Skeleton active paragraph={{ rows: 3 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></Card>;
  if (state === 'error') return <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetry}>{labels.retry}</Button>} />;
  if (state === 'unauthenticated') return <Alert type="error" showIcon title={labels.unauthenticated} />;
  if (state === 'forbidden') return <Alert type="warning" showIcon title={labels.forbidden} />;
  if (!households.length && !groups.length) return <Empty description={labels.empty} />;
  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    {!canWrite ? <Alert type="info" showIcon title={labels.noWrite} /> : null}
    <div><Typography.Text strong>{labels.households} · {labels.optional}</Typography.Text><Select aria-label={labels.households} mode="multiple" disabled={!canWrite} style={{ width: '100%', marginTop: 8 }} value={[...draft.householdIds]} onChange={householdIds => onChange({ householdIds })} options={households.map(item => ({ value: item.id, label: item.name }))} /></div>
    <div><Typography.Text strong>{labels.groups} · {labels.optional}</Typography.Text><Select aria-label={labels.groups} mode="multiple" disabled={!canWrite} style={{ width: '100%', marginTop: 8 }} value={[...draft.serviceGroupIds]} onChange={serviceGroupIds => onChange({ serviceGroupIds })} options={groups.map(item => ({ value: item.id, label: item.name }))} /></div>
  </Space>;
}
