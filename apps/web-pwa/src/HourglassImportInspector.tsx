import { useRef, useState, type ChangeEvent } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Modal from 'antd/es/modal';
import Segmented from 'antd/es/segmented';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Steps from 'antd/es/steps';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import {
  inspectHourglassContactListCsv,
  inspectHourglassPrivilegesCsv,
  parseHourglassJsonText,
  type HourglassContactListCsvInspection,
  type HourglassImportInspection,
  type HourglassPrivilegesCsvInspection,
} from '@eutaktos/application';
import type { Locale } from './lib/preferences';

type Inspection = Readonly<HourglassImportInspection> | Readonly<HourglassContactListCsvInspection> | Readonly<HourglassPrivilegesCsvInspection>;
export type HourglassImportSource = 'json' | 'contacts-csv' | 'privileges-csv';
const MAX_BYTES = 5_000_000;
const { Paragraph, Text } = Typography;

const copy = {
  'pt-PT': {
    title: 'Inspeção de export Hourglass', subtitle: 'Escolha primeiro a origem. O ficheiro é analisado apenas nesta sessão e nada é guardado nesta etapa.', sourceStep: 'Origem', inspectStep: 'Inspeção', source: 'Formato suportado', json: 'Export JSON Hourglass', csv: 'Contact list CSV', privilegesCsv: 'Matriz CSV de privilégios', choose: 'Escolher ficheiro', loading: 'A analisar ficheiro…', unsupported: 'O ficheiro não corresponde ao formato escolhido ou não pôde ser analisado com segurança.', tooLarge: 'O ficheiro excede o limite de segurança de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilégios explícitos', privilegeTypes: 'Tipos de privilégio marcados', records: 'Registos encontrados', unrecognized: 'Secções não reconhecidas', fields: 'Campos não reconhecidos', csvLimitation: 'Este CSV de contactos não tem um ID de publicador estável comprovado. Pode ser inspecionado, mas não será persistido nem reconciliado sozinho.', privilegeCsvLimitation: 'A matriz tem marcadores de privilégio explícitos, mas não um ID de publicador estável. Nenhuma elegibilidade será criada sem reconciliação humana individual.', jsonReady: 'Este formato tem IDs estáveis e pode avançar futuramente para preview/reconciliação servidor; esta etapa continua sem escrita.', noUnknown: 'Nenhum', close: 'Fechar', privacy: 'Dados sensíveis: não inclua o ficheiro em tickets, screenshots ou commits.', reset: 'Escolher outra origem' },
  en: {
    title: 'Hourglass export inspector', subtitle: 'Choose the source first. The file is analyzed only in this session and nothing is saved at this step.', sourceStep: 'Source', inspectStep: 'Inspection', source: 'Supported format', json: 'Hourglass JSON export', csv: 'Contact list CSV', privilegesCsv: 'Privilege matrix CSV', choose: 'Choose file', loading: 'Analyzing file…', unsupported: 'The file does not match the selected format or could not be analyzed safely.', tooLarge: 'The file exceeds the 5 MB safety limit.', publishers: 'Publishers found', groups: 'Groups found', privileges: 'Explicit privileges', privilegeTypes: 'Marked privilege types', records: 'Records found', unrecognized: 'Unrecognized sections', fields: 'Unrecognized fields', csvLimitation: 'This contact-list CSV has no proven stable publisher ID. It can be inspected but will not be persisted or reconciled on its own.', privilegeCsvLimitation: 'The matrix has explicit privilege markers but no stable publisher ID. No eligibility is created without individual human reconciliation.', jsonReady: 'This format has stable IDs and can later move to server-side preview/reconciliation; this step still performs no writes.', noUnknown: 'None', close: 'Close', privacy: 'Sensitive data: do not include this file in tickets, screenshots or commits.', reset: 'Choose another source' },
  es: {
    title: 'Inspector de exportación Hourglass', subtitle: 'Elija primero el origen. El archivo se analiza solo en esta sesión y no se guarda nada en este paso.', sourceStep: 'Origen', inspectStep: 'Inspección', source: 'Formato compatible', json: 'Exportación JSON Hourglass', csv: 'CSV de lista de contactos', privilegesCsv: 'CSV de matriz de privilegios', choose: 'Elegir archivo', loading: 'Analizando archivo…', unsupported: 'El archivo no coincide con el formato elegido o no se pudo analizar de forma segura.', tooLarge: 'El archivo supera el límite de seguridad de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilegios explícitos', privilegeTypes: 'Tipos de privilegio marcados', records: 'Registros encontrados', unrecognized: 'Secciones no reconocidas', fields: 'Campos no reconocidos', csvLimitation: 'Este CSV de contactos no tiene un ID de publicador estable comprobado. Puede inspeccionarse, pero no se conservará ni reconciliará por sí solo.', privilegeCsvLimitation: 'La matriz tiene marcadores explícitos de privilegio, pero no un ID de publicador estable. No se crea elegibilidad sin conciliación humana individual.', jsonReady: 'Este formato tiene IDs estables y podrá pasar más adelante a previsualización/conciliación en servidor; este paso sigue sin escribir datos.', noUnknown: 'Ninguno', close: 'Cerrar', privacy: 'Datos sensibles: no incluya el archivo en tickets, capturas de pantalla ni commits.', reset: 'Elegir otro origen' },
} as const;
type InspectorCopy = (typeof copy)[Locale];

export function acceptsHourglassFilename(source: HourglassImportSource, filename: string): boolean {
  const normalized = filename.toLocaleLowerCase();
  return source === 'json' ? normalized.endsWith('.json') : normalized.endsWith('.csv');
}

export function inspectHourglassSelectedSource(source: HourglassImportSource, text: string): Inspection {
  if (source === 'json') return parseHourglassJsonText(text);
  if (source === 'contacts-csv') return inspectHourglassContactListCsv(text);
  return inspectHourglassPrivilegesCsv(text);
}

function isHourglassJsonInspection(value: Inspection): value is Readonly<HourglassImportInspection> { return 'report' in value; }
function isHourglassPrivilegesInspection(value: Inspection): value is Readonly<HourglassPrivilegesCsvInspection> { return 'privilegeColumns' in value; }

export function HourglassImportInspector({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<HourglassImportSource>('json');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'unsafe' | 'too-large' | null>(null);

  const resetInspection = (nextSource?: HourglassImportSource) => {
    if (nextSource) setSource(nextSource);
    setInspection(null);
    setError(null);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setInspection(null);
    setError(null);
    if (file.size > MAX_BYTES) { setError('too-large'); return; }
    if (!acceptsHourglassFilename(source, file.name)) { setError('unsafe'); return; }
    setLoading(true);
    try {
      const contents = await file.text();
      setInspection(inspectHourglassSelectedSource(source, contents));
    } catch { setError('unsafe'); }
    finally { setLoading(false); }
  };

  const sourceLabel = source === 'json' ? text.json : source === 'contacts-csv' ? text.csv : text.privilegesCsv;
  const format = inspection ? (isHourglassJsonInspection(inspection) ? inspection.report.format : inspection.format) : undefined;

  return <Modal open={open} onCancel={() => !loading && onClose()} width={760} title={text.title} footer={<Button onClick={onClose} disabled={loading}>{text.close}</Button>} destroyOnHidden>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="warning" showIcon title={text.privacy} />
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>{text.subtitle}</Paragraph>
      <Steps size="small" current={inspection ? 1 : 0} items={[{ title: text.sourceStep }, { title: text.inspectStep }]} />
      <Card size="small" title={text.source}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented block value={source} onChange={value => resetInspection(value as HourglassImportSource)} options={[{ value: 'json', label: text.json }, { value: 'contacts-csv', label: text.csv }, { value: 'privileges-csv', label: text.privilegesCsv }]} />
          <Text type="secondary">{sourceLabel}</Text>
          <input ref={inputRef} type="file" accept={source === 'json' ? 'application/json,.json' : 'text/csv,.csv'} hidden onChange={event => void onFile(event)} />
          <Button type="primary" onClick={() => inputRef.current?.click()} disabled={loading} block>{text.choose}</Button>
        </Space>
      </Card>
      {loading ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 4 }} /></div> : null}
      {error ? <Alert type="error" showIcon title={error === 'too-large' ? text.tooLarge : text.unsupported} /> : null}
      {inspection ? <Card title={<Space wrap><span>{sourceLabel}</span><Tag>{format}</Tag></Space>} extra={<Button type="link" onClick={() => resetInspection()}>{text.reset}</Button>}>
        {isHourglassJsonInspection(inspection) ? <JsonSummary inspection={inspection} text={text} /> : null}
        {isHourglassPrivilegesInspection(inspection) ? <PrivilegesSummary inspection={inspection} text={text} /> : null}
        {!isHourglassJsonInspection(inspection) && !isHourglassPrivilegesInspection(inspection) ? <ContactSummary inspection={inspection} text={text} /> : null}
      </Card> : null}
    </Space>
  </Modal>;
}

function JsonSummary({ inspection, text }: { inspection: Readonly<HourglassImportInspection>; text: InspectorCopy }) {
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} size="small"><Descriptions.Item label={text.publishers}>{inspection.report.publisherCount}</Descriptions.Item><Descriptions.Item label={text.groups}>{inspection.report.groupCount}</Descriptions.Item><Descriptions.Item label={text.privileges}>{inspection.report.explicitPrivilegeCount}</Descriptions.Item></Descriptions><UnknownList label={text.unrecognized} values={inspection.report.unknownTopLevelSections} emptyLabel={text.noUnknown} /><UnknownList label={text.fields} values={[...inspection.report.unknownPublisherFields, ...inspection.report.unknownGroupFields]} emptyLabel={text.noUnknown} /><Alert type="info" showIcon title={text.jsonReady} /></Space>;
}
function PrivilegesSummary({ inspection, text }: { inspection: Readonly<HourglassPrivilegesCsvInspection>; text: InspectorCopy }) {
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} size="small"><Descriptions.Item label={text.records}>{inspection.recordCount}</Descriptions.Item><Descriptions.Item label={text.privilegeTypes}>{inspection.privilegeColumns.length}</Descriptions.Item></Descriptions><UnknownList label={text.fields} values={inspection.unknownColumns} emptyLabel={text.noUnknown} /><Alert type="info" showIcon title={text.privilegeCsvLimitation} /></Space>;
}
function ContactSummary({ inspection, text }: { inspection: Readonly<HourglassContactListCsvInspection>; text: InspectorCopy }) {
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} size="small"><Descriptions.Item label={text.records}>{inspection.recordCount}</Descriptions.Item></Descriptions><UnknownList label={text.fields} values={inspection.unknownHeaders} emptyLabel={text.noUnknown} /><Alert type="info" showIcon title={text.csvLimitation} /></Space>;
}
function UnknownList({ label, values, emptyLabel }: { label: string; values: readonly string[]; emptyLabel: string }) {
  return <Space direction="vertical" size="small"><Text type="secondary">{label}</Text>{values.length ? <Space wrap>{values.map(value => <Tag key={value}>{value}</Tag>)}</Space> : <Text>{emptyLabel}</Text>}</Space>;
}
