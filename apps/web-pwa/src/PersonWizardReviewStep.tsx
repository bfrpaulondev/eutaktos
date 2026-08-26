import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Empty from 'antd/es/empty';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import type { HouseholdDto } from './lib/householdsApi';
import type { Locale } from './lib/preferences';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import { personWizardAvailabilityChanges, type PersonWizardDraft, type PersonWizardMode } from './PersonWizardModel';

export function PersonWizardReviewStep({ mode, locale, draft, initial, households, groups, labels }: { mode: PersonWizardMode; locale: Locale; draft: PersonWizardDraft; initial: PersonWizardDraft; households: readonly HouseholdDto[]; groups: readonly ServiceGroupDto[]; labels: Readonly<{ identity: string; name: string; locale: string; state: string; active: string; inactive: string; organization: string; households: string; groups: string; responsibilities: string; none: string; eligibility: string; eligible: string; ineligible: string; availability: string; away: string; unavailable: string; other: string; confirm: string }> }) {
  const decisions = Object.entries(draft.eligibility).filter(([id, value]) => value !== 'unchanged' && (mode === 'create' || value !== (initial.eligibility[id] ?? 'unchanged')));
  const names = (ids: readonly string[], options: readonly { id: string; name: string }[]) => ids.map(id => options.find(option => option.id === id)?.name).filter(Boolean).join(', ') || labels.none;
  const changed = (before: string, after: string) => mode === 'edit' && before !== after ? `${before || labels.none} → ${after || labels.none}` : after || labels.none;
  const initialState = initial.active ? labels.active : labels.inactive; const nextState = draft.active ? labels.active : labels.inactive;
  const availability = personWizardAvailabilityChanges(initial, draft); const reason = (value: string | undefined) => value === 'unavailable' ? labels.unavailable : value === 'other' ? labels.other : labels.away;
  return <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    <Typography.Paragraph>{labels.confirm}</Typography.Paragraph>
    <Card title={labels.identity}><Descriptions column={1} size="small"><Descriptions.Item label={labels.name}>{changed(initial.displayName.trim(), draft.displayName.trim())}</Descriptions.Item><Descriptions.Item label={labels.locale}>{changed(initial.preferredLocale, draft.preferredLocale)}</Descriptions.Item><Descriptions.Item label={labels.state}><Tag color={draft.active ? 'success' : 'default'}>{changed(initialState, nextState)}</Tag></Descriptions.Item></Descriptions></Card>
    <Card title={labels.organization}><Descriptions column={1} size="small"><Descriptions.Item label={labels.households}>{changed(names(initial.householdIds, households), names(draft.householdIds, households))}</Descriptions.Item><Descriptions.Item label={labels.groups}>{changed(names(initial.serviceGroupIds, groups), names(draft.serviceGroupIds, groups))}</Descriptions.Item><Descriptions.Item label={labels.responsibilities}>{draft.responsibilities.length ? draft.responsibilities.map(item => `${item.responsibilityKey}: ${item.startsAt.slice(0, 10)}${item.endsAt ? ` – ${item.endsAt.slice(0, 10)}` : ''}`).join(', ') : labels.none}</Descriptions.Item></Descriptions></Card>
    <Card title={labels.eligibility}>{decisions.length ? <Space wrap>{decisions.map(([id, choice]) => <Tag key={id} color={choice === 'enabled' ? 'success' : 'default'}>{assignmentTypeLabel(id, locale)}: {choice === 'enabled' ? labels.eligible : labels.ineligible}</Tag>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.none} />}</Card>
    <Card title={labels.availability}>{availability.length ? <Space wrap>{availability.map(item => <Tag key={`${item.startsAt}:${item.endsAt}:${item.reasonCode ?? ''}`}>{item.startsAt.slice(0, 10)} – {item.endsAt.slice(0, 10)} · {reason(item.reasonCode)}</Tag>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.none} />}</Card>
  </Space>;
}
