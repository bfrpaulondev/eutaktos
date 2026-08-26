import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import type { HouseholdDto } from './lib/householdsApi';
import type { ResponsibilityDto } from './lib/responsibilitiesApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import { isPersonWizardTemporalRangeValid, type PersonWizardDraft, type PersonWizardResourceState } from './PersonWizardModel';

function dateValue(value: string | undefined): string { return value?.slice(0, 10) ?? ''; }
function instantValue(value: string): string { return value ? `${value}T00:00:00.000Z` : ''; }

export function PersonWizardOrganizationStep({ draft, households, groups, responsibilities, state, responsibilityState, canWriteMembership, canWriteResponsibilities, labels, onChange, onRetry, onRetryResponsibilities }: {
  draft: PersonWizardDraft; households: readonly HouseholdDto[]; groups: readonly ServiceGroupDto[]; responsibilities: readonly ResponsibilityDto[]; state: PersonWizardResourceState; responsibilityState: PersonWizardResourceState; canWriteMembership: boolean; canWriteResponsibilities: boolean;
  labels: Readonly<{ loading: string; error: string; forbidden: string; unauthenticated: string; retry: string; empty: string; households: string; groups: string; optional: string; noWrite: string; responsibilities: string; responsibilityKey: string; responsibilityHint: string; start: string; end: string; responsibilityExplanation: string; responsibilityReadOnly: string; responsibilityRange: string; noResponsibilities: string; active: string; ended: string }>;
  onChange: (change: Partial<PersonWizardDraft>) => void; onRetry: () => void; onRetryResponsibilities: () => void;
}) {
  if (state === 'loading') return <Card aria-busy="true"><Skeleton active paragraph={{ rows: 3 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></Card>;
  if (state === 'error') return <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetry}>{labels.retry}</Button>} />;
  if (state === 'unauthenticated') return <Alert type="error" showIcon title={labels.unauthenticated} />;
  if (state === 'forbidden') return <Alert type="warning" showIcon title={labels.forbidden} />;

  const responsibility = draft.responsibilities[0];
  const key = responsibility?.responsibilityKey ?? '';
  const start = dateValue(responsibility?.startsAt);
  const end = dateValue(responsibility?.endsAt);
  const rangeInvalid = Boolean((key || start || end) && (!key.trim() || !isPersonWizardTemporalRangeValid(instantValue(start), end ? instantValue(end) : undefined)));
  const updateResponsibility = (patch: Partial<{ responsibilityKey: string; startsAt: string; endsAt: string }>) => {
    const nextKey = patch.responsibilityKey ?? key;
    const nextStart = patch.startsAt ?? start;
    const nextEnd = patch.endsAt ?? end;
    if (!nextKey && !nextStart && !nextEnd) { onChange({ responsibilities: [] }); return; }
    onChange({ responsibilities: [{ responsibilityKey: nextKey, startsAt: instantValue(nextStart), ...(nextEnd ? { endsAt: instantValue(nextEnd) } : {}) }] });
  };

  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    {!canWriteMembership ? <Alert type="info" showIcon title={labels.noWrite} /> : null}
    <div><Typography.Text strong>{labels.households} · {labels.optional}</Typography.Text><Select aria-label={labels.households} mode="multiple" disabled={!canWriteMembership} style={{ width: '100%', marginTop: 8 }} value={[...draft.householdIds]} onChange={householdIds => onChange({ householdIds })} options={households.map(item => ({ value: item.id, label: item.name }))} /></div>
    <div><Typography.Text strong>{labels.groups} · {labels.optional}</Typography.Text><Select aria-label={labels.groups} mode="multiple" disabled={!canWriteMembership} style={{ width: '100%', marginTop: 8 }} value={[...draft.serviceGroupIds]} onChange={serviceGroupIds => onChange({ serviceGroupIds })} options={groups.map(item => ({ value: item.id, label: item.name }))} /></div>

    <Card title={labels.responsibilities}>
      {responsibilityState === 'loading' ? <Skeleton active paragraph={{ rows: 2 }} /> : null}
      {responsibilityState === 'error' ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryResponsibilities}>{labels.retry}</Button>} /> : null}
      {responsibilityState === 'unauthenticated' ? <Alert type="error" showIcon title={labels.unauthenticated} /> : null}
      {responsibilityState === 'forbidden' ? <Alert type="info" showIcon title={labels.responsibilityReadOnly} /> : null}
      {responsibilityState === 'ready' ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={labels.responsibilityExplanation} />
        {responsibilities.length ? <List size="small" dataSource={[...responsibilities]} renderItem={item => <List.Item key={item.id}><Space wrap><Typography.Text>{item.responsibilityKey}</Typography.Text><Tag color={item.endsAt ? 'default' : 'success'}>{item.endsAt ? labels.ended : labels.active}</Tag></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noResponsibilities} />}
        {!canWriteResponsibilities ? <Alert type="info" showIcon title={labels.responsibilityReadOnly} /> : <Card size="small">
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <Typography.Text strong>{labels.responsibilityKey} · {labels.optional}</Typography.Text>
            <Input aria-label={labels.responsibilityKey} value={key} onChange={event => updateResponsibility({ responsibilityKey: event.target.value })} placeholder={labels.responsibilityHint} />
            <Space wrap style={{ width: '100%' }}><label><Typography.Text>{labels.start}</Typography.Text><Input aria-label={labels.start} type="date" value={start} onChange={event => updateResponsibility({ startsAt: event.target.value })} /></label><label><Typography.Text>{labels.end} · {labels.optional}</Typography.Text><Input aria-label={labels.end} type="date" value={end} onChange={event => updateResponsibility({ endsAt: event.target.value })} /></label></Space>
            {rangeInvalid ? <Alert type="error" showIcon title={labels.responsibilityRange} /> : null}
          </Space>
        </Card>}
      </Space> : null}
    </Card>
  </Space>;
}
