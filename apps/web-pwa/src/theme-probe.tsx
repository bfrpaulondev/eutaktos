import { Alert, Button, Card, ConfigProvider, Space, Tag, theme } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AntDesignFoundation } from './ui/AntDesignFoundation';

function Probe() {
  const { token } = theme.useToken();
  return (
    <main
      id="ant-theme-probe"
      style={{
        minHeight: '100dvh',
        padding: 32,
        background: token.colorBgLayout,
        color: token.colorText,
      }}
      data-bg={token.colorBgLayout}
      data-surface={token.colorBgContainer}
      data-text={token.colorText}
      data-primary={token.colorPrimary}
    >
      <Card title="Theme probe" style={{ maxWidth: 560 }}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Button type="primary">Primary action</Button>
          <Alert type="warning" title="Attention" showIcon />
          <Space>
            <Tag color="success">Healthy</Tag>
            <Tag color="error">Critical</Tag>
          </Space>
        </Space>
      </Card>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('theme-probe-root')!).render(
  <React.StrictMode>
    <AntDesignFoundation>
      <ConfigProvider>
        <Probe />
      </ConfigProvider>
    </AntDesignFoundation>
  </React.StrictMode>,
);
