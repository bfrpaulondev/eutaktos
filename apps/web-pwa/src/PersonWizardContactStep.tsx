import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import type { OrdinaryContactDto } from './lib/ordinaryContactApi';
import type { PersonWizardResourceState } from './PersonWizardModel';

export interface PersonWizardContactLabels {
  loading: string;
  error: string;
  forbidden: string;
  unauthenticated: string;
  retry: string;
  explanation: string;
  noWrite: string;
  optional: string;
  phone: string;
  email: string;
  address: string;
  phoneTooLong: string;
  emailInvalid: string;
  emailTooLong: string;
  addressTooLong: string;
}

export function PersonWizardContactStep({
  contact,
  state,
  canWrite,
  labels,
  errors,
  onChange,
  onRetry,
}: {
  contact: OrdinaryContactDto;
  state: PersonWizardResourceState;
  canWrite: boolean;
  labels: PersonWizardContactLabels;
  errors: Readonly<Partial<Record<'phone' | 'email' | 'address', string>>>;
  onChange: (contact: OrdinaryContactDto) => void;
  onRetry: () => void;
}) {
  if (state === 'loading') {
    return <Card aria-busy="true"><Skeleton active paragraph={{ rows: 4 }} /><Typography.Text role="status">{labels.loading}</Typography.Text></Card>;
  }
  if (state === 'error') return <Alert type="warning" showIcon title={labels.error} action={<Button onClick={onRetry}>{labels.retry}</Button>} />;
  if (state === 'unauthenticated') return <Alert type="error" showIcon title={labels.unauthenticated} />;
  if (state === 'forbidden') return <Alert type="warning" showIcon title={labels.forbidden} />;

  const change = (field: keyof OrdinaryContactDto, value: string) => onChange({ ...contact, [field]: value });

  return <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
    <Alert type="info" showIcon title={labels.explanation} />
    {!canWrite ? <Alert type="info" showIcon title={labels.noWrite} /> : null}
    <Card>
      <Form.Item label={`${labels.phone} · ${labels.optional}`} validateStatus={errors.phone ? 'error' : undefined} help={errors.phone}>
        <Input aria-label={labels.phone} autoComplete="tel" value={contact.phone ?? ''} disabled={!canWrite} onChange={event => change('phone', event.target.value)} />
      </Form.Item>
      <Form.Item label={`${labels.email} · ${labels.optional}`} validateStatus={errors.email ? 'error' : undefined} help={errors.email}>
        <Input aria-label={labels.email} type="email" autoComplete="email" value={contact.email ?? ''} disabled={!canWrite} onChange={event => change('email', event.target.value)} />
      </Form.Item>
      <Form.Item label={`${labels.address} · ${labels.optional}`} validateStatus={errors.address ? 'error' : undefined} help={errors.address}>
        <Input.TextArea aria-label={labels.address} autoComplete="street-address" rows={3} value={contact.address ?? ''} disabled={!canWrite} onChange={event => change('address', event.target.value)} />
      </Form.Item>
    </Card>
  </Space>;
}
