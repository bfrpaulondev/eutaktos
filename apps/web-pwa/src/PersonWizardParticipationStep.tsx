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
import { ELIGIBILITY_ASSIGNMENT_TYPES } from './lib/assignmentTypeCatalog';
import type { AvailabilityPeriodDto, AvailabilityReasonCode } from './lib/availabilityApi';
import type { Locale } from './lib/preferences';
import {
  isPersonWizardTemporalRangeValid,
  type EligibilityChoice,
  type PersonWizardDraft,
  type PersonWizardResourceState,
} from './PersonWizardModel';

function dateValue(value: string | undefined): string {
  return value?.slice(0, 10) ?? '';
}

function instantValue(value: string): string {
  return value ? `${value}T00:00:00.000Z` : '';
}

export interface PersonWizardParticipationLabels {
  loading: string;
  error: string;
  forbidden: string;
  unauthenticated: string;
  retry: string;
  explanation: string;
  unchanged: string;
  enabled: string;
  disabled: string;
  noWrite: string;
  availability: string;
  availabilityExplanation: string;
  availabilityReadOnly: string;
  start: string;
  end: string;
  reason: string;
  away: string;
  unavailable: string;
  other: string;
  availabilityRange: string;
  noPeriods: string;
  currentPeriods: string;
  optional: string;
  removePeriod: string;
  correctPeriod: string;
  removalQueued: string;
}

export function PersonWizardParticipationStep({
  locale,
  draft,
  periods,
  eligibilityState,
  availabilityState,
  canWriteEligibility,
  canWriteAvailability,
  labels,
  onChange,
  onRetryEligibility,
  onRetryAvailability,
}: {
  locale: Locale;
  draft: PersonWizardDraft;
  periods: readonly AvailabilityPeriodDto[];
  eligibilityState: PersonWizardResourceState;
  availabilityState: PersonWizardResourceState;
  canWriteEligibility: boolean;
  canWriteAvailability: boolean;
  labels: PersonWizardParticipationLabels;
  onChange: (change: Partial<PersonWizardDraft>) => void;
  onRetryEligibility: () => void;
  onRetryAvailability: () => void;
}) {
  const updateEligibility = (id: string, choice: EligibilityChoice) => onChange({ eligibility: { ...draft.eligibility, [id]: choice } });
  const pending = draft.availabilityPeriods[0];
  const start = dateValue(pending?.startsAt);
  const end = dateValue(pending?.endsAt);
  const reason = pending?.reasonCode ?? 'away';
  const rangeInvalid = Boolean((start || end) && !isPersonWizardTemporalRangeValid(instantValue(start), instantValue(end), true));

  const updatePeriod = (patch: Partial<{ startsAt: string; endsAt: string; reasonCode: AvailabilityReasonCode }>) => {
    const nextStart = patch.startsAt ?? start;
    const nextEnd = patch.endsAt ?? end;
    const nextReason = patch.reasonCode ?? reason;
    if (!nextStart && !nextEnd) {
      onChange({ availabilityPeriods: [] });
      return;
    }
    onChange({ availabilityPeriods: [{ startsAt: instantValue(nextStart), endsAt: instantValue(nextEnd), reasonCode: nextReason }] });
  };

  const reasonLabel = (code: AvailabilityReasonCode) => code === 'away' ? labels.away : code === 'unavailable' ? labels.unavailable : labels.other;

  const queueRemoval = (item: AvailabilityPeriodDto) => {
    if (draft.availabilityRemovals.some(value => value.id === item.id)) return;
    onChange({ availabilityRemovals: [...draft.availabilityRemovals, { id: item.id }] });
  };

  const queueCorrection = (item: AvailabilityPeriodDto) => {
    const removals = draft.availabilityRemovals.some(value => value.id === item.id)
      ? draft.availabilityRemovals
      : [...draft.availabilityRemovals, { id: item.id }];
    onChange({
      availabilityRemovals: removals,
      availabilityPeriods: [{ startsAt: item.startsAt, endsAt: item.endsAt, reasonCode: item.reasonCode ?? 'away' }],
    });
  };

  const eligibilityContent = eligibilityState === 'loading'
    ? <><Skeleton active paragraph={{ rows: 4 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></>
    : eligibilityState === 'error'
      ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryEligibility}>{labels.retry}</Button>} />
      : eligibilityState === 'unauthenticated'
        ? <Alert type="error" showIcon title={labels.unauthenticated} />
        : eligibilityState === 'forbidden'
          ? <Alert type="warning" showIcon title={labels.forbidden} />
          : <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="info" showIcon title={labels.explanation} />
            {!canWriteEligibility ? <Alert type="warning" showIcon title={labels.noWrite} /> : null}
            {ELIGIBILITY_ASSIGNMENT_TYPES.map(type => <Card size="small" key={type.id}>
              <div className="person-wizard-choice">
                <Typography.Text strong>{type.label[locale]}</Typography.Text>
                <Select
                  aria-label={type.label[locale]}
                  disabled={!canWriteEligibility}
                  value={draft.eligibility[type.id] ?? 'unchanged'}
                  onChange={value => updateEligibility(type.id, value)}
                  options={[
                    { value: 'unchanged', label: labels.unchanged },
                    { value: 'enabled', label: labels.enabled },
                    { value: 'disabled', label: labels.disabled },
                  ]}
                />
              </div>
            </Card>)}
          </Space>;

  const availabilityContent = availabilityState === 'loading'
    ? <Skeleton active paragraph={{ rows: 2 }} />
    : availabilityState === 'error'
      ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryAvailability}>{labels.retry}</Button>} />
      : availabilityState === 'unauthenticated'
        ? <Alert type="error" showIcon title={labels.unauthenticated} />
        : availabilityState === 'forbidden'
          ? <Alert type="info" showIcon title={labels.availabilityReadOnly} />
          : <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="info" showIcon title={labels.availabilityExplanation} />
            <Typography.Text strong>{labels.currentPeriods}</Typography.Text>
            {periods.length ? <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              {[...periods].sort((left, right) => left.startsAt.localeCompare(right.startsAt)).map(item => {
                const removalQueued = draft.availabilityRemovals.some(value => value.id === item.id);
                return <Card key={item.id} size="small">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <Space wrap>
                      <Typography.Text>{dateValue(item.startsAt)} – {dateValue(item.endsAt)}</Typography.Text>
                      <Tag>{reasonLabel(item.reasonCode ?? 'away')}</Tag>
                      {removalQueued ? <Tag color="warning">{labels.removalQueued}</Tag> : null}
                    </Space>
                    {canWriteAvailability && !removalQueued ? <Space wrap>
                      <Button size="small" onClick={() => queueCorrection(item)}>{labels.correctPeriod}</Button>
                      <Button size="small" danger onClick={() => queueRemoval(item)}>{labels.removePeriod}</Button>
                    </Space> : null}
                  </div>
                </Card>;
              })}
            </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noPeriods} />}
            {!canWriteAvailability ? <Alert type="info" showIcon title={labels.availabilityReadOnly} /> : <Card size="small">
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Text strong>{labels.availability} · {labels.optional}</Typography.Text>
                <Space wrap>
                  <label><Typography.Text>{labels.start}</Typography.Text><Input aria-label={labels.start} type="date" value={start} onChange={event => updatePeriod({ startsAt: event.target.value })} /></label>
                  <label><Typography.Text>{labels.end}</Typography.Text><Input aria-label={labels.end} type="date" value={end} onChange={event => updatePeriod({ endsAt: event.target.value })} /></label>
                </Space>
                <Select aria-label={labels.reason} value={reason} onChange={reasonCode => updatePeriod({ reasonCode })} options={(['away', 'unavailable', 'other'] as const).map(code => ({ value: code, label: reasonLabel(code) }))} />
                {rangeInvalid ? <Alert type="error" showIcon title={labels.availabilityRange} /> : null}
              </Space>
            </Card>}
          </Space>;

  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    <Card>{eligibilityContent}</Card>
    <Card title={labels.availability}>{availabilityContent}</Card>
  </Space>;
}
