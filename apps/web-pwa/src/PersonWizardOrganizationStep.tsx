import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import type { HouseholdDto } from './lib/householdsApi';
import type { ResponsibilityDto } from './lib/responsibilitiesApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import {
  isPersonWizardTemporalRangeValid,
  personWizardResponsibilityStatus,
  type PersonWizardDraft,
  type PersonWizardResourceState,
} from './PersonWizardModel';

function dateValue(value: string | undefined): string {
  return value?.slice(0, 10) ?? '';
}

function instantValue(value: string): string {
  return value ? `${value}T00:00:00.000Z` : '';
}

export interface PersonWizardOrganizationLabels {
  loading: string;
  error: string;
  forbidden: string;
  unauthenticated: string;
  retry: string;
  empty: string;
  households: string;
  groups: string;
  optional: string;
  noWrite: string;
  responsibilities: string;
  responsibilityKey: string;
  responsibilityHint: string;
  start: string;
  end: string;
  responsibilityExplanation: string;
  responsibilityReadOnly: string;
  responsibilityRange: string;
  noResponsibilities: string;
  active: string;
  ended: string;
  scheduled: string;
  invalid: string;
  endResponsibility: string;
  endQueued: string;
}

export function PersonWizardOrganizationStep({
  draft,
  households,
  groups,
  responsibilities,
  membershipState,
  responsibilityState,
  canWriteMembership,
  canWriteResponsibilities,
  labels,
  onChange,
  onRetryMembership,
  onRetryResponsibilities,
}: {
  draft: PersonWizardDraft;
  households: readonly HouseholdDto[];
  groups: readonly ServiceGroupDto[];
  responsibilities: readonly ResponsibilityDto[];
  membershipState: PersonWizardResourceState;
  responsibilityState: PersonWizardResourceState;
  canWriteMembership: boolean;
  canWriteResponsibilities: boolean;
  labels: PersonWizardOrganizationLabels;
  onChange: (change: Partial<PersonWizardDraft>) => void;
  onRetryMembership: () => void;
  onRetryResponsibilities: () => void;
}) {
  const pending = draft.responsibilities[0];
  const key = pending?.responsibilityKey ?? '';
  const start = dateValue(pending?.startsAt);
  const end = dateValue(pending?.endsAt);
  const rangeInvalid = Boolean((key || start || end) && (!key.trim() || !isPersonWizardTemporalRangeValid(instantValue(start), end ? instantValue(end) : undefined)));

  const updateResponsibility = (patch: Partial<{ responsibilityKey: string; startsAt: string; endsAt: string }>) => {
    const nextKey = patch.responsibilityKey ?? key;
    const nextStart = patch.startsAt ?? start;
    const nextEnd = patch.endsAt ?? end;
    if (!nextKey && !nextStart && !nextEnd) {
      onChange({ responsibilities: [] });
      return;
    }
    onChange({
      responsibilities: [{
        responsibilityKey: nextKey,
        startsAt: instantValue(nextStart),
        ...(nextEnd ? { endsAt: instantValue(nextEnd) } : {}),
      }],
    });
  };

  const queueEnd = (item: ResponsibilityDto) => {
    if (draft.responsibilityEnds.some(value => value.id === item.id)) return;
    onChange({ responsibilityEnds: [...draft.responsibilityEnds, { id: item.id, endsAt: new Date().toISOString() }] });
  };

  const statusLabel = (item: ResponsibilityDto) => {
    const status = personWizardResponsibilityStatus(item);
    if (status === 'scheduled') return labels.scheduled;
    if (status === 'active') return labels.active;
    if (status === 'ended') return labels.ended;
    return labels.invalid;
  };

  const membershipContent = membershipState === 'loading'
    ? <><Skeleton active paragraph={{ rows: 3 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></>
    : membershipState === 'error'
      ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryMembership}>{labels.retry}</Button>} />
      : membershipState === 'unauthenticated'
        ? <Alert type="error" showIcon title={labels.unauthenticated} />
        : membershipState === 'forbidden'
          ? <Alert type="warning" showIcon title={labels.forbidden} />
          : <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {!canWriteMembership ? <Alert type="info" showIcon title={labels.noWrite} /> : null}
            <div>
              <Typography.Text strong>{labels.households} · {labels.optional}</Typography.Text>
              <Select aria-label={labels.households} mode="multiple" disabled={!canWriteMembership} style={{ width: '100%', marginTop: 8 }} value={[...draft.householdIds]} onChange={householdIds => onChange({ householdIds })} options={households.map(item => ({ value: item.id, label: item.name }))} />
            </div>
            <div>
              <Typography.Text strong>{labels.groups} · {labels.optional}</Typography.Text>
              <Select aria-label={labels.groups} mode="multiple" disabled={!canWriteMembership} style={{ width: '100%', marginTop: 8 }} value={[...draft.serviceGroupIds]} onChange={serviceGroupIds => onChange({ serviceGroupIds })} options={groups.map(item => ({ value: item.id, label: item.name }))} />
            </div>
            {!households.length && !groups.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.empty} /> : null}
          </Space>;

  const responsibilityContent = responsibilityState === 'loading'
    ? <Skeleton active paragraph={{ rows: 2 }} />
    : responsibilityState === 'error'
      ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryResponsibilities}>{labels.retry}</Button>} />
      : responsibilityState === 'unauthenticated'
        ? <Alert type="error" showIcon title={labels.unauthenticated} />
        : responsibilityState === 'forbidden'
          ? <Alert type="info" showIcon title={labels.responsibilityReadOnly} />
          : <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="info" showIcon title={labels.responsibilityExplanation} />
            {responsibilities.length ? <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              {[...responsibilities].map(item => {
                const status = personWizardResponsibilityStatus(item);
                const endingQueued = draft.responsibilityEnds.some(value => value.id === item.id);
                return <Card key={item.id} size="small">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <Space wrap>
                      <Typography.Text>{item.responsibilityKey}</Typography.Text>
                      <Tag color={status === 'active' ? 'success' : status === 'invalid' ? 'error' : 'default'}>{statusLabel(item)}</Tag>
                      {endingQueued ? <Tag color="warning">{labels.endQueued}</Tag> : null}
                    </Space>
                    {canWriteResponsibilities && status === 'active' && !endingQueued
                      ? <Button size="small" onClick={() => queueEnd(item)}>{labels.endResponsibility}</Button>
                      : null}
                  </div>
                </Card>;
              })}
            </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noResponsibilities} />}
            {!canWriteResponsibilities ? <Alert type="info" showIcon title={labels.responsibilityReadOnly} /> : <Card size="small">
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Text strong>{labels.responsibilityKey} · {labels.optional}</Typography.Text>
                <Input aria-label={labels.responsibilityKey} value={key} onChange={event => updateResponsibility({ responsibilityKey: event.target.value })} placeholder={labels.responsibilityHint} />
                <Space wrap style={{ width: '100%' }}>
                  <label><Typography.Text>{labels.start}</Typography.Text><Input aria-label={labels.start} type="date" value={start} onChange={event => updateResponsibility({ startsAt: event.target.value })} /></label>
                  <label><Typography.Text>{labels.end} · {labels.optional}</Typography.Text><Input aria-label={labels.end} type="date" value={end} onChange={event => updateResponsibility({ endsAt: event.target.value })} /></label>
                </Space>
                {rangeInvalid ? <Alert type="error" showIcon title={labels.responsibilityRange} /> : null}
              </Space>
            </Card>}
          </Space>;

  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    <Card>{membershipContent}</Card>
    <Card title={labels.responsibilities}>{responsibilityContent}</Card>
  </Space>;
}
