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

type ContactField = 'phone' | 'email' | 'address';

function errorId(field: ContactField): string {
  return `person-wizard-contact-${field}-error`;
}

function ContactError({ field, message }: { field: ContactField; message: string | undefined }) {
  if (!message) return null;
  return <Typography.Text id={errorId(field)} type="danger" role="alert">{message}</Typography.Text>;
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
  errors: Readonly<Partial<Record<ContactField, string>>>;
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
      <Form.Item label={`${labels.phone} · ${labels.optional}`} validateStatus={errors.phone ? 'error' : undefined}>
        <Input aria-label={labels.phone} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? errorId('phone') : undefined} autoComplete="tel" value={contact.phone ?? ''} disabled={!canWrite} onChange={event => change('phone', event.target.value)} />
        <ContactError field="phone" message={errors.phone} />
      </Form.Item>
      <Form.Item label={`${labels.email} · ${labels.optional}`} validateStatus={errors.email ? 'error' : undefined}>
        <Input aria-label={labels.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? errorId('email') : undefined} type="email" autoComplete="email" value={contact.email ?? ''} disabled={!canWrite} onChange={event => change('email', event.target.value)} />
        <ContactError field="email" message={errors.email} />
      </Form.Item>
      <Form.Item label={`${labels.address} · ${labels.optional}`} validateStatus={errors.address ? 'error' : undefined}>
        <Input.TextArea aria-label={labels.address} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? errorId('address') : undefined} autoComplete="street-address" rows={3} value={contact.address ?? ''} disabled={!canWrite} onChange={event => change('address', event.target.value)} />
        <ContactError field="address" message={errors.address} />
      </Form.Item>
    </Card>
  </Space>;
}
