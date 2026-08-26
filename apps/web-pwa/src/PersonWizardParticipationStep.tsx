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
import { ELIGIBILITY_ASSIGNMENT_TYPES } from './lib/assignmentTypeCatalog';
import type { AvailabilityPeriodDto, AvailabilityReasonCode } from './lib/availabilityApi';
import type { Locale } from './lib/preferences';
import { isPersonWizardTemporalRangeValid, type EligibilityChoice, type PersonWizardDraft, type PersonWizardResourceState } from './PersonWizardModel';

function dateValue(value: string | undefined): string { return value?.slice(0, 10) ?? ''; }
function instantValue(value: string): string { return value ? `${value}T00:00:00.000Z` : ''; }

export function PersonWizardParticipationStep({ locale, draft, periods, state, availabilityState, canWriteEligibility, canWriteAvailability, labels, onChange, onRetry, onRetryAvailability }: {
  locale: Locale; draft: PersonWizardDraft; periods: readonly AvailabilityPeriodDto[]; state: PersonWizardResourceState; availabilityState: PersonWizardResourceState; canWriteEligibility: boolean; canWriteAvailability: boolean;
  labels: Readonly<{ loading: string; error: string; forbidden: string; unauthenticated: string; retry: string; explanation: string; unchanged: string; enabled: string; disabled: string; noWrite: string; availability: string; availabilityExplanation: string; availabilityReadOnly: string; start: string; end: string; reason: string; away: string; unavailable: string; other: string; availabilityRange: string; noPeriods: string; currentPeriods: string; optional: string }>;
  onChange: (change: Partial<PersonWizardDraft>) => void; onRetry: () => void; onRetryAvailability: () => void;
}) {
  if (state === 'loading') return <Card aria-busy="true"><Skeleton active paragraph={{ rows: 4 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></Card>;
  if (state === 'error') return <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetry}>{labels.retry}</Button>} />;
  if (state === 'unauthenticated') return <Alert type="error" showIcon title={labels.unauthenticated} />;
  if (state === 'forbidden') return <Alert type="warning" showIcon title={labels.forbidden} />;

  const updateEligibility = (id: string, choice: EligibilityChoice) => onChange({ eligibility: { ...draft.eligibility, [id]: choice } });
  const period = draft.availabilityPeriods[0]; const start = dateValue(period?.startsAt); const end = dateValue(period?.endsAt); const reason = period?.reasonCode ?? 'away';
  const rangeInvalid = Boolean((start || end) && !isPersonWizardTemporalRangeValid(instantValue(start), instantValue(end), true));
  const updatePeriod = (patch: Partial<{ startsAt: string; endsAt: string; reasonCode: AvailabilityReasonCode }>) => {
    const nextStart = patch.startsAt ?? start; const nextEnd = patch.endsAt ?? end; const nextReason = patch.reasonCode ?? reason;
    if (!nextStart && !nextEnd) { onChange({ availabilityPeriods: [] }); return; }
    onChange({ availabilityPeriods: [{ startsAt: instantValue(nextStart), endsAt: instantValue(nextEnd), reasonCode: nextReason }] });
  };
  const reasonLabel = (code: AvailabilityReasonCode) => code === 'away' ? labels.away : code === 'unavailable' ? labels.unavailable : labels.other;

  return <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    <Alert type="info" showIcon title={labels.explanation} />
    {!canWriteEligibility ? <Alert type="warning" showIcon title={labels.noWrite} /> : null}
    {ELIGIBILITY_ASSIGNMENT_TYPES.map(type => <Card size="small" key={type.id}><div className="person-wizard-choice"><Typography.Text strong>{type.label[locale]}</Typography.Text><Select aria-label={type.label[locale]} disabled={!canWriteEligibility} value={draft.eligibility[type.id] ?? 'unchanged'} onChange={value => updateEligibility(type.id, value)} options={[{ value: 'unchanged', label: labels.unchanged }, { value: 'enabled', label: labels.enabled }, { value: 'disabled', label: labels.disabled }]} /></div></Card>)}

    <Card title={labels.availability}>
      {availabilityState === 'loading' ? <Skeleton active paragraph={{ rows: 2 }} /> : null}
      {availabilityState === 'error' ? <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetryAvailability}>{labels.retry}</Button>} /> : null}
      {availabilityState === 'unauthenticated' ? <Alert type="error" showIcon title={labels.unauthenticated} /> : null}
      {availabilityState === 'forbidden' ? <Alert type="info" showIcon title={labels.availabilityReadOnly} /> : null}
      {availabilityState === 'ready' ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={labels.availabilityExplanation} />
        <Typography.Text strong>{labels.currentPeriods}</Typography.Text>
        {periods.length ? <List size="small" dataSource={[...periods].sort((left, right) => left.startsAt.localeCompare(right.startsAt))} renderItem={item => <List.Item key={item.id}><Space wrap><Typography.Text>{dateValue(item.startsAt)} – {dateValue(item.endsAt)}</Typography.Text><Tag>{reasonLabel(item.reasonCode ?? 'away')}</Tag></Space></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noPeriods} />}
        {!canWriteAvailability ? <Alert type="info" showIcon title={labels.availabilityReadOnly} /> : <Card size="small"><Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text strong>{labels.availability} · {labels.optional}</Typography.Text>
          <Space wrap><label><Typography.Text>{labels.start}</Typography.Text><Input aria-label={labels.start} type="date" value={start} onChange={event => updatePeriod({ startsAt: event.target.value })} /></label><label><Typography.Text>{labels.end}</Typography.Text><Input aria-label={labels.end} type="date" value={end} onChange={event => updatePeriod({ endsAt: event.target.value })} /></label></Space>
          <Select aria-label={labels.reason} value={reason} onChange={reasonCode => updatePeriod({ reasonCode })} options={(['away', 'unavailable', 'other'] as const).map(code => ({ value: code, label: reasonLabel(code) }))} />
          {rangeInvalid ? <Alert type="error" showIcon title={labels.availabilityRange} /> : null}
        </Space></Card>}
      </Space> : null}
    </Card>
  </Space>;
}
