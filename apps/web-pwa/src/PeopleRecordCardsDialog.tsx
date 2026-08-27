import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Modal from 'antd/es/modal';
import Segmented from 'antd/es/segmented';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { peopleRecordCardsApi, PeopleRecordCardsApiError, type PeopleRecordCardsDto, type RecordCardsRequest } from './lib/peopleRecordCardsApi';
import { downloadPeopleRecordCardsPdf } from './lib/peopleRecordCardsPdf';
import type { Locale } from './lib/preferences';

type Mode = 'year' | 'custom';
type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';

const copy = {
  'pt-PT': { title: 'Cartões / Registos', intro: 'Gera uma pré-visualização factual das designações concluídas no período selecionado. Contactos e outros dados privados não fazem parte deste relatório.', mode: 'Período', year: 'Ano', custom: 'Personalizado', from: 'De', to: 'Até', preview: 'Pré-visualizar', loading: 'A carregar registos…', retry: 'Tentar novamente', error: 'Não foi possível carregar os registos.', unauthenticated: 'A sessão terminou antes de carregar o relatório.', forbidden: 'Não tem permissão para gerar este relatório.', empty: 'Não existem designações concluídas neste período.', print: 'Imprimir', pdf: 'Descarregar PDF', pdfError: 'Não foi possível gerar o PDF.', close: 'Fechar', records: 'registos', generated: 'Gerado em', period: 'Período' },
  en: { title: 'Record cards / Reports', intro: 'Generate a factual preview of completed assignments for the selected period. Contacts and other private data are not part of this report.', mode: 'Period', year: 'Year', custom: 'Custom', from: 'From', to: 'To', preview: 'Preview', loading: 'Loading records…', retry: 'Try again', error: 'The records could not be loaded.', unauthenticated: 'Your session ended before the report was loaded.', forbidden: 'You do not have permission to generate this report.', empty: 'There are no completed assignments in this period.', print: 'Print', pdf: 'Download PDF', pdfError: 'The PDF could not be generated.', close: 'Close', records: 'records', generated: 'Generated', period: 'Period' },
  es: { title: 'Tarjetas / Registros', intro: 'Genera una vista previa factual de las asignaciones completadas en el período seleccionado. Los contactos y otros datos privados no forman parte de este informe.', mode: 'Período', year: 'Año', custom: 'Personalizado', from: 'Desde', to: 'Hasta', preview: 'Vista previa', loading: 'Cargando registros…', retry: 'Intentar de nuevo', error: 'No se pudieron cargar los registros.', unauthenticated: 'La sesión terminó antes de cargar el informe.', forbidden: 'No tiene permiso para generar este informe.', empty: 'No hay asignaciones completadas en este período.', print: 'Imprimir', pdf: 'Descargar PDF', pdfError: 'No se pudo generar el PDF.', close: 'Cerrar', records: 'registros', generated: 'Generado', period: 'Período' },
} as const;

function currentYear(): string { return String(new Date().getFullYear()); }

function printReport(data: PeopleRecordCardsDto, locale: Locale, title: string): void {
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.opener = null;
  const document = popup.document;
  document.title = title;
  const heading = document.createElement('h1');
  heading.textContent = title;
  document.body.appendChild(heading);
  const period = document.createElement('p');
  period.textContent = `${data.period.from} — ${data.period.to}`;
  document.body.appendChild(period);
  for (const card of data.cards) {
    const section = document.createElement('section');
    const name = document.createElement('h2');
    name.textContent = card.displayName;
    section.appendChild(name);
    const list = document.createElement('ul');
    for (const record of card.records) {
      const item = document.createElement('li');
      item.textContent = `${new Date(`${record.meetingDate}T00:00:00`).toLocaleDateString(locale)} — ${record.partType}`;
      list.appendChild(item);
    }
    section.appendChild(list);
    document.body.appendChild(section);
  }
  popup.focus();
  popup.print();
}

export function PeopleRecordCardsDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const controllerRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const [mode, setMode] = useState<Mode>('year');
  const [year, setYear] = useState(currentYear);
  const [from, setFrom] = useState(`${currentYear()}-01-01`);
  const [to, setTo] = useState(`${currentYear()}-12-31`);
  const [state, setState] = useState<LoadState>('idle');
  const [data, setData] = useState<PeopleRecordCardsDto | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const cancel = () => {
    versionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  };

  useEffect(() => {
    if (!open) { cancel(); return; }
    cancel();
    setMode('year');
    setYear(currentYear());
    setFrom(`${currentYear()}-01-01`);
    setTo(`${currentYear()}-12-31`);
    setState('idle');
    setData(null);
    setExportingPdf(false);
    setPdfError(false);
    return cancel;
  }, [open]);

  const request = useMemo<RecordCardsRequest | null>(() => {
    if (mode === 'year') return /^\d{4}$/.test(year) ? { year } : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return null;
    return { from, to };
  }, [from, mode, to, year]);

  const clearPreview = () => {
    cancel();
    setData(null);
    setState('idle');
    setPdfError(false);
  };

  const load = async () => {
    if (!request) return;
    const version = ++versionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading');
    setData(null);
    setPdfError(false);
    try {
      const value = await peopleRecordCardsApi.get(request, controller.signal);
      if (controller.signal.aborted || version !== versionRef.current) return;
      setData(value);
      setState('ready');
    } catch (reason) {
      if (controller.signal.aborted || version !== versionRef.current) return;
      if (reason instanceof PeopleRecordCardsApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleRecordCardsApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally {
      if (version === versionRef.current) controllerRef.current = null;
    }
  };

  const downloadPdf = async () => {
    if (!data?.cards.length || exportingPdf) return;
    setExportingPdf(true);
    setPdfError(false);
    try { await downloadPeopleRecordCardsPdf(data, locale, text.title); }
    catch { setPdfError(true); }
    finally { setExportingPdf(false); }
  };

  const years = Array.from({ length: 8 }, (_, index) => String(new Date().getFullYear() - index)).map(value => ({ value, label: value }));
  const exportDisabled = state !== 'ready' || !data?.cards.length;

  return <Modal open={open} onCancel={onClose} width={900} title={text.title} destroyOnHidden footer={<Space wrap><Button onClick={onClose}>{text.close}</Button><Button onClick={() => data && printReport(data, locale, text.title)} disabled={exportDisabled || exportingPdf}>{text.print}</Button><Button type="primary" onClick={() => void downloadPdf()} disabled={exportDisabled} loading={exportingPdf}>{text.pdf}</Button></Space>}>
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.intro} />
      <Space wrap align="end">
        <div><Typography.Text type="secondary">{text.mode}</Typography.Text><br /><Segmented value={mode} options={[{ value: 'year', label: text.year }, { value: 'custom', label: text.custom }]} onChange={value => { clearPreview(); setMode(value as Mode); }} /></div>
        {mode === 'year' ? <div><Typography.Text type="secondary">{text.year}</Typography.Text><br /><Select aria-label={text.year} value={year} options={years} onChange={value => { clearPreview(); setYear(value); }} style={{ width: 130 }} /></div> : <>
          <div><Typography.Text type="secondary">{text.from}</Typography.Text><br /><Input aria-label={text.from} type="date" value={from} onChange={event => { clearPreview(); setFrom(event.target.value); }} /></div>
          <div><Typography.Text type="secondary">{text.to}</Typography.Text><br /><Input aria-label={text.to} type="date" value={to} onChange={event => { clearPreview(); setTo(event.target.value); }} /></div>
        </>}
        <Button type="primary" onClick={() => void load()} disabled={!request || state === 'loading' || exportingPdf}>{text.preview}</Button>
      </Space>
      {state === 'loading' ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 5 }} /></div> : null}
      {state === 'unauthenticated' ? <Alert type="error" showIcon title={text.unauthenticated} /> : null}
      {state === 'forbidden' ? <Alert type="warning" showIcon title={text.forbidden} /> : null}
      {state === 'error' ? <Alert type="error" showIcon title={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {pdfError ? <Alert type="error" showIcon title={text.pdfError} /> : null}
      {state === 'ready' && data ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Text type="secondary">{text.period}: {data.period.from} — {data.period.to} · {text.generated}: {new Date(data.generatedAt).toLocaleString(locale)}</Typography.Text>
        {!data.cards.length ? <Empty description={text.empty} /> : <List dataSource={[...data.cards]} renderItem={card => <List.Item key={card.personId}><Card size="small" title={card.displayName} style={{ width: '100%' }}><Typography.Text type="secondary">{card.records.length} {text.records}</Typography.Text><List size="small" dataSource={[...card.records]} renderItem={record => <List.Item>{new Date(`${record.meetingDate}T00:00:00`).toLocaleDateString(locale)} — {record.partType}</List.Item>} /></Card></List.Item>} />}
      </Space> : null}
    </Space>
  </Modal>;
}