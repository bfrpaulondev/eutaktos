import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Empty from 'antd/es/empty';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import type { AvailabilityPeriodDto } from './lib/availabilityApi';
import type { HouseholdDto } from './lib/householdsApi';
import type { Locale } from './lib/preferences';
import type { ResponsibilityDto } from './lib/responsibilitiesApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import {
  normalizePersonWizardContact,
  personWizardAvailabilityChanges,
  personWizardContactChanged,
  type PersonWizardDraft,
  type PersonWizardMode,
} from './PersonWizardModel';

export interface PersonWizardReviewLabels {
  identity: string;
  name: string;
  locale: string;
  state: string;
  active: string;
  inactive: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  organization: string;
  households: string;
  groups: string;
  responsibilities: string;
  endResponsibilities: string;
  none: string;
  eligibility: string;
  eligible: string;
  ineligible: string;
  availability: string;
  removeAvailability: string;
  away: string;
  unavailable: string;
  other: string;
  confirm: string;
}

export function PersonWizardReviewStep({
  mode,
  locale,
  draft,
  initial,
  households,
  groups,
  responsibilities,
  periods,
  labels,
}: {
  mode: PersonWizardMode;
  locale: Locale;
  draft: PersonWizardDraft;
  initial: PersonWizardDraft;
  households: readonly HouseholdDto[];
  groups: readonly ServiceGroupDto[];
  responsibilities: readonly ResponsibilityDto[];
  periods: readonly AvailabilityPeriodDto[];
  labels: PersonWizardReviewLabels;
}) {
  const decisions = Object.entries(draft.eligibility)
    .filter(([id, value]) => value !== 'unchanged' && (mode === 'create' || value !== (initial.eligibility[id] ?? 'unchanged')));
  const names = (ids: readonly string[], options: readonly { id: string; name: string }[]) => ids.map(id => options.find(option => option.id === id)?.name).filter(Boolean).join(', ') || labels.none;
  const changed = (before: string, after: string) => mode === 'edit' && before !== after ? `${before || labels.none} → ${after || labels.none}` : after || labels.none;
  const initialState = initial.active ? labels.active : labels.inactive;
  const nextState = draft.active ? labels.active : labels.inactive;
  const availability = personWizardAvailabilityChanges(initial, draft);
  const reason = (value: string | undefined) => value === 'unavailable' ? labels.unavailable : value === 'other' ? labels.other : labels.away;
  const initialContact = normalizePersonWizardContact(initial.contact);
  const nextContact = normalizePersonWizardContact(draft.contact);
  const contactChanged = personWizardContactChanged(initial, draft);
  const endingResponsibilities = draft.responsibilityEnds
    .map(change => responsibilities.find(item => item.id === change.id))
    .filter((item): item is ResponsibilityDto => Boolean(item));
  const removingPeriods = draft.availabilityRemovals
    .map(change => periods.find(item => item.id === change.id))
    .filter((item): item is AvailabilityPeriodDto => Boolean(item));

  return <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    <Typography.Paragraph>{labels.confirm}</Typography.Paragraph>
    <Card title={labels.identity}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label={labels.name}>{changed(initial.displayName.trim(), draft.displayName.trim())}</Descriptions.Item>
        <Descriptions.Item label={labels.locale}>{changed(initial.preferredLocale, draft.preferredLocale)}</Descriptions.Item>
        <Descriptions.Item label={labels.state}><Tag color={draft.active ? 'success' : 'default'}>{changed(initialState, nextState)}</Tag></Descriptions.Item>
      </Descriptions>
    </Card>
    <Card title={labels.contact}>
      {contactChanged ? <Descriptions column={1} size="small">
        <Descriptions.Item label={labels.phone}>{changed(initialContact.phone ?? '', nextContact.phone ?? '')}</Descriptions.Item>
        <Descriptions.Item label={labels.email}>{changed(initialContact.email ?? '', nextContact.email ?? '')}</Descriptions.Item>
        <Descriptions.Item label={labels.address}>{changed(initialContact.address ?? '', nextContact.address ?? '')}</Descriptions.Item>
      </Descriptions> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.none} />}
    </Card>
    <Card title={labels.organization}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label={labels.households}>{changed(names(initial.householdIds, households), names(draft.householdIds, households))}</Descriptions.Item>
        <Descriptions.Item label={labels.groups}>{changed(names(initial.serviceGroupIds, groups), names(draft.serviceGroupIds, groups))}</Descriptions.Item>
        <Descriptions.Item label={labels.responsibilities}>{draft.responsibilities.length ? draft.responsibilities.map(item => `${item.responsibilityKey}: ${item.startsAt.slice(0, 10)}${item.endsAt ? ` – ${item.endsAt.slice(0, 10)}` : ''}`).join(', ') : labels.none}</Descriptions.Item>
        <Descriptions.Item label={labels.endResponsibilities}>{endingResponsibilities.length ? endingResponsibilities.map(item => item.responsibilityKey).join(', ') : labels.none}</Descriptions.Item>
      </Descriptions>
    </Card>
    <Card title={labels.eligibility}>
      {decisions.length ? <Space wrap>{decisions.map(([id, choice]) => <Tag key={id} color={choice === 'enabled' ? 'success' : 'default'}>{assignmentTypeLabel(id, locale)}: {choice === 'enabled' ? labels.eligible : labels.ineligible}</Tag>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.none} />}
    </Card>
    <Card title={labels.availability}>
      <Space orientation="vertical" size="small" style={{ width: '100%' }}>
        {availability.length ? <Space wrap>{availability.map(item => <Tag key={`${item.startsAt}:${item.endsAt}:${item.reasonCode ?? ''}`}>{item.startsAt.slice(0, 10)} – {item.endsAt.slice(0, 10)} · {reason(item.reasonCode)}</Tag>)}</Space> : null}
        {removingPeriods.length ? <Descriptions column={1} size="small"><Descriptions.Item label={labels.removeAvailability}>{removingPeriods.map(item => `${item.startsAt.slice(0, 10)} – ${item.endsAt.slice(0, 10)} · ${reason(item.reasonCode)}`).join(', ')}</Descriptions.Item></Descriptions> : null}
        {!availability.length && !removingPeriods.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.none} /> : null}
      </Space>
    </Card>
  </Space>;
}
