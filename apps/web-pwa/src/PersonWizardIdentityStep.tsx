import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Typography from 'antd/es/typography';
import type { PersonWizardDraft } from './PersonWizardModel';
import { personWizardDisplayNameValid, supportedLocaleOptions } from './PersonWizardModel';

export function PersonWizardIdentityStep({ draft, labels, onChange }: { draft: PersonWizardDraft; labels: Readonly<{ name: string; nameRequired: string; locale: string; active: string; required: string; optional: string }>; onChange: (change: Partial<PersonWizardDraft>) => void }) {
  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    <Typography.Paragraph type="secondary">{labels.required}</Typography.Paragraph>
    <Form.Item name="displayName" label={labels.name} required rules={[{ validator: async (_, value) => { if (!personWizardDisplayNameValid(typeof value === 'string' ? value : '')) throw new Error(labels.nameRequired); } }]}>
      <Input required aria-required="true" autoComplete="name" maxLength={120} value={draft.displayName} onChange={event => onChange({ displayName: event.target.value })} />
    </Form.Item>
    <Form.Item label={`${labels.locale} · ${labels.optional}`}>
      <Select aria-label={labels.locale} value={draft.preferredLocale || undefined} allowClear onChange={value => onChange({ preferredLocale: value ?? '' })} options={supportedLocaleOptions(draft.preferredLocale).map(value => ({ value, label: value }))} />
    </Form.Item>
    <Form.Item label={labels.active}>
      <Switch aria-label={labels.active} checked={draft.active} onChange={active => onChange({ active })} />
    </Form.Item>
  </Space>;
}
