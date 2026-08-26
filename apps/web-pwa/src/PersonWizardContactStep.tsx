import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Typography from 'antd/es/typography';

export function PersonWizardContactStep({ title, detail }: { title: string; detail: string }) {
  return <Card><Alert type="info" showIcon title={title} description={<Typography.Text type="secondary">{detail}</Typography.Text>} /></Card>;
}
