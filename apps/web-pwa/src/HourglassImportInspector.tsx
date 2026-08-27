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
import {
  hourglassImportPreviewApi,
  HourglassPreviewApiError,
  type HourglassPreviewDto,
  type HourglassPreviewReasonCode,
} from './lib/hourglassImportPreviewApi';
import type { Locale } from './lib/preferences';

type Inspection = Readonly<HourglassImportInspection> | Readonly<HourglassContactListCsvInspection> | Readonly<HourglassPrivilegesCsvInspection>;
export type HourglassImportSource = 'json' | 'contacts-csv' | 'privileges-csv';
type PreviewState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';
const MAX_BYTES = 5_000_000;
const { Paragraph, Text } = Typography;

const copy = {
  'pt-PT': {
    title: 'Inspeção de export Hourglass', subtitle: 'Escolha primeiro a origem. O ficheiro é analisado apenas nesta sessão e nada é guardado nesta etapa.', sourceStep: 'Origem', inspectStep: 'Inspeção', source: 'Formato suportado', json: 'Export JSON Hourglass', csv: 'Contact list CSV', privilegesCsv: 'Matriz CSV de privilégios', choose: 'Escolher ficheiro', loading: 'A analisar ficheiro…', unsupported: 'O ficheiro não corresponde ao formato escolhido ou não pôde ser analisado com segurança.', tooLarge: 'O ficheiro excede o limite de segurança de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilégios explícitos', privilegeTypes: 'Tipos de privilégio marcados', records: 'Registos encontrados', unrecognized: 'Secções não reconhecidas', fields: 'Campos não reconhecidos', csvLimitation: 'Este CSV de contactos não tem um ID de publicador estável comprovado. Pode ser inspecionado, mas não será enviado para reconciliação automática.', privilegeCsvLimitation: 'A matriz tem marcadores de privilégio explícitos, mas não um ID de publicador estável. Nenhuma elegibilidade será criada nem o CSV enviado para reconciliação automática.', jsonReady: 'Este formato tem IDs estáveis comprovados. Pode comparar explicitamente com o Eutaktos; esta prévia continua sem escrita.', noUnknown: 'Nenhum', close: 'Fechar', privacy: 'Dados sensíveis: não inclua o ficheiro em tickets, screenshots ou commits.', reset: 'Escolher outra origem', compare: 'Comparar com Eutaktos', comparing: 'A comparar com dados autorizados…', retry: 'Tentar novamente', previewError: 'Não foi possível confirmar a prévia de reconciliação.', preview401: 'A sessão terminou antes da comparação.', preview403: 'Não tem permissão para comparar estes dados.', matchingPolicy: 'A correspondência usa apenas o ID externo Hourglass já ligado dentro desta congregação. Nomes nunca são usados para associar ou deduplicar pessoas.', previewTitle: 'Prévia de reconciliação', create: 'Novas', unchanged: 'Sem alteração', conflict: 'Conflitos', linked: 'Ligada', unlinked: 'Nova referência', displayNameDiffers: 'O nome difere da pessoa Eutaktos já ligada.', eligibilityDiffers: 'A elegibilidade explícita difere da importação Hourglass.', noConflicts: 'Nenhum conflito detetado.', readOnly: 'Prévia apenas. Nenhuma pessoa, elegibilidade ou ligação externa é alterada nesta etapa.' },
  en: {
    title: 'Hourglass export inspector', subtitle: 'Choose the source first. The file is analyzed only in this session and nothing is saved at this step.', sourceStep: 'Source', inspectStep: 'Inspection', source: 'Supported format', json: 'Hourglass JSON export', csv: 'Contact list CSV', privilegesCsv: 'Privilege matrix CSV', choose: 'Choose file', loading: 'Analyzing file…', unsupported: 'The file does not match the selected format or could not be analyzed safely.', tooLarge: 'The file exceeds the 5 MB safety limit.', publishers: 'Publishers found', groups: 'Groups found', privileges: 'Explicit privileges', privilegeTypes: 'Marked privilege types', records: 'Records found', unrecognized: 'Unrecognized sections', fields: 'Unrecognized fields', csvLimitation: 'This contact-list CSV has no proven stable publisher ID. It can be inspected but is not sent for automatic reconciliation.', privilegeCsvLimitation: 'The matrix has explicit privilege markers but no stable publisher ID. No eligibility is created and the CSV is not sent for automatic reconciliation.', jsonReady: 'This format has proven stable IDs. You may explicitly compare it with Eutaktos; this preview still performs no writes.', noUnknown: 'None', close: 'Close', privacy: 'Sensitive data: do not include this file in tickets, screenshots or commits.', reset: 'Choose another source', compare: 'Compare with Eutaktos', comparing: 'Comparing with authorized data…', retry: 'Try again', previewError: 'The reconciliation preview could not be confirmed.', preview401: 'Your session ended before the comparison.', preview403: 'You do not have permission to compare these data.', matchingPolicy: 'Matching uses only an already-linked Hourglass external ID inside this congregation. Names are never used to link or deduplicate people.', previewTitle: 'Reconciliation preview', create: 'New', unchanged: 'Unchanged', conflict: 'Conflicts', linked: 'Linked', unlinked: 'New reference', displayNameDiffers: 'The name differs from the already-linked Eutaktos person.', eligibilityDiffers: 'Explicit eligibility differs from the Hourglass import.', noConflicts: 'No conflicts detected.', readOnly: 'Preview only. No person, eligibility decision or external link is changed at this step.' },
  es: {
    title: 'Inspector de exportación Hourglass', subtitle: 'Elija primero el origen. El archivo se analiza solo en esta sesión y no se guarda nada en este paso.', sourceStep: 'Origen', inspectStep: 'Inspección', source: 'Formato compatible', json: 'Exportación JSON Hourglass', csv: 'CSV de lista de contactos', privilegesCsv: 'CSV de matriz de privilegios', choose: 'Elegir archivo', loading: 'Analizando archivo…', unsupported: 'El archivo no coincide con el formato elegido o no se pudo analizar de forma segura.', tooLarge: 'El archivo supera el límite de seguridad de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilegios explícitos', privilegeTypes: 'Tipos de privilegio marcados', records: 'Registros encontrados', unrecognized: 'Secciones no reconocidas', fields: 'Campos no reconocidos', csvLimitation: 'Este CSV de contactos no tiene un ID de publicador estable comprobado. Puede inspeccionarse, pero no se envía para conciliación automática.', privilegeCsvLimitation: 'La matriz tiene marcadores explícitos de privilegio, pero no un ID estable. No se crea elegibilidad ni se envía el CSV para conciliación automática.', jsonReady: 'Este formato tiene IDs estables comprobados. Puede compararlo explícitamente con Eutaktos; esta vista previa sigue sin escribir datos.', noUnknown: 'Ninguno', close: 'Cerrar', privacy: 'Datos sensibles: no incluya el archivo en tickets, capturas de pantalla ni commits.', reset: 'Elegir otro origen', compare: 'Comparar con Eutaktos', comparing: 'Comparando con datos autorizados…', retry: 'Intentar de nuevo', previewError: 'No se pudo confirmar la vista previa de conciliación.', preview401: 'La sesión terminó antes de la comparación.', preview403: 'No tiene permiso para comparar estos datos.', matchingPolicy: 'La coincidencia usa solo un ID externo Hourglass ya vinculado dentro de esta congregación. Los nombres nunca se usan para vincular o deduplicar personas.', previewTitle: 'Vista previa de conciliación', create: 'Nuevas', unchanged: 'Sin cambios', conflict: 'Conflictos', linked: 'Vinculada', unlinked: 'Nueva referencia', displayNameDiffers: 'El nombre difiere de la persona Eutaktos ya vinculada.', eligibilityDiffers: 'La elegibilidad explícita difiere de la importación Hourglass.', noConflicts: 'No se detectaron conflictos.', readOnly: 'Solo vista previa. En este paso no se modifica ninguna persona, elegibilidad ni vínculo externo.' },
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
  const previewControllerRef = useRef<AbortController | null>(null);
  const previewVersionRef = useRef(0);
  const [source, setSource] = useState<HourglassImportSource>('json');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [jsonPayload, setJsonPayload] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'unsafe' | 'too-large' | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [preview, setPreview] = useState<HourglassPreviewDto | null>(null);

  const cancelPreview = () => {
    previewVersionRef.current += 1;
    previewControllerRef.current?.abort();
    previewControllerRef.current = null;
    setPreviewState('idle');
    setPreview(null);
  };

  const resetInspection = (nextSource?: HourglassImportSource) => {
    cancelPreview();
    if (nextSource) setSource(nextSource);
    setInspection(null);
    setJsonPayload(undefined);
    setError(null);
  };

  const close = () => {
    if (loading || previewState === 'loading') return;
    cancelPreview();
    setInspection(null);
    setJsonPayload(undefined);
    setError(null);
    onClose();
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    cancelPreview();
    setInspection(null);
    setJsonPayload(undefined);
    setError(null);
    if (file.size > MAX_BYTES) { setError('too-large'); return; }
    if (!acceptsHourglassFilename(source, file.name)) { setError('unsafe'); return; }
    setLoading(true);
    try {
      const contents = await file.text();
      const nextInspection = inspectHourglassSelectedSource(source, contents);
      setInspection(nextInspection);
      if (source === 'json') setJsonPayload(JSON.parse(contents) as unknown);
    } catch { setError('unsafe'); }
    finally { setLoading(false); }
  };

  const compare = async () => {
    if (source !== 'json' || jsonPayload === undefined || previewState === 'loading') return;
    const requestVersion = ++previewVersionRef.current;
    previewControllerRef.current?.abort();
    const controller = new AbortController();
    previewControllerRef.current = controller;
    setPreview(null);
    setPreviewState('loading');
    try {
      const value = await hourglassImportPreviewApi.preview(jsonPayload, controller.signal);
      if (controller.signal.aborted || requestVersion !== previewVersionRef.current) return;
      setPreview(value);
      setPreviewState('ready');
    } catch (reason) {
      if (controller.signal.aborted || requestVersion !== previewVersionRef.current) return;
      if (reason instanceof HourglassPreviewApiError && reason.status === 401) setPreviewState('unauthenticated');
      else if (reason instanceof HourglassPreviewApiError && reason.status === 403) setPreviewState('forbidden');
      else setPreviewState('error');
    } finally {
      if (requestVersion === previewVersionRef.current) previewControllerRef.current = null;
    }
  };

  const sourceLabel = source === 'json' ? text.json : source === 'contacts-csv' ? text.csv : text.privilegesCsv;
  const format = inspection ? (isHourglassJsonInspection(inspection) ? inspection.report.format : inspection.format) : undefined;

  return <Modal open={open} onCancel={close} width={760} title={text.title} footer={<Button onClick={close} disabled={loading || previewState === 'loading'}>{text.close}</Button>} destroyOnHidden>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="warning" showIcon title={text.privacy} />
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>{text.subtitle}</Paragraph>
      <Steps size="small" current={inspection ? 1 : 0} items={[{ title: text.sourceStep }, { title: text.inspectStep }]} />
      <Card size="small" title={text.source}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented block value={source} disabled={previewState === 'loading'} onChange={value => resetInspection(value as HourglassImportSource)} options={[{ value: 'json', label: text.json }, { value: 'contacts-csv', label: text.csv }, { value: 'privileges-csv', label: text.privilegesCsv }]} />
          <Text type="secondary">{sourceLabel}</Text>
          <input ref={inputRef} type="file" accept={source === 'json' ? 'application/json,.json' : 'text/csv,.csv'} hidden onChange={event => void onFile(event)} />
          <Button type="primary" onClick={() => inputRef.current?.click()} disabled={loading || previewState === 'loading'} block>{text.choose}</Button>
        </Space>
      </Card>
      {loading ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 4 }} /></div> : null}
      {error ? <Alert type="error" showIcon title={error === 'too-large' ? text.tooLarge : text.unsupported} /> : null}
      {inspection ? <Card title={<Space wrap><span>{sourceLabel}</span><Tag>{format}</Tag></Space>} extra={<Button type="link" onClick={() => resetInspection()} disabled={previewState === 'loading'}>{text.reset}</Button>}>
        {isHourglassJsonInspection(inspection) ? <JsonSummary inspection={inspection} text={text} onCompare={() => void compare()} previewState={previewState} preview={preview} /> : null}
        {isHourglassPrivilegesInspection(inspection) ? <PrivilegesSummary inspection={inspection} text={text} /> : null}
        {!isHourglassJsonInspection(inspection) && !isHourglassPrivilegesInspection(inspection) ? <ContactSummary inspection={inspection} text={text} /> : null}
      </Card> : null}
    </Space>
  </Modal>;
}

function JsonSummary({ inspection, text, onCompare, previewState, preview }: { inspection: Readonly<HourglassImportInspection>; text: InspectorCopy; onCompare: () => void; previewState: PreviewState; preview: HourglassPreviewDto | null }) {
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Descriptions column={1} size="small"><Descriptions.Item label={text.publishers}>{inspection.report.publisherCount}</Descriptions.Item><Descriptions.Item label={text.groups}>{inspection.report.groupCount}</Descriptions.Item><Descriptions.Item label={text.privileges}>{inspection.report.explicitPrivilegeCount}</Descriptions.Item></Descriptions>
    <UnknownList label={text.unrecognized} values={inspection.report.unknownTopLevelSections} emptyLabel={text.noUnknown} />
    <UnknownList label={text.fields} values={[...inspection.report.unknownPublisherFields, ...inspection.report.unknownGroupFields]} emptyLabel={text.noUnknown} />
    <Alert type="info" showIcon title={text.jsonReady} />
    <Alert type="warning" showIcon title={text.matchingPolicy} />
    <Button type="primary" onClick={onCompare} loading={previewState === 'loading'} disabled={previewState === 'loading'}>{text.compare}</Button>
    {previewState === 'loading' ? <div role="status" aria-label={text.comparing}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}
    {previewState === 'unauthenticated' ? <Alert type="error" showIcon title={text.preview401} /> : null}
    {previewState === 'forbidden' ? <Alert type="warning" showIcon title={text.preview403} /> : null}
    {previewState === 'error' ? <Alert type="warning" showIcon title={text.previewError} action={<Button size="small" onClick={onCompare}>{text.retry}</Button>} /> : null}
    {previewState === 'ready' && preview ? <PreviewSummary preview={preview} text={text} /> : null}
  </Space>;
}

function PreviewSummary({ preview, text }: { preview: HourglassPreviewDto; text: InspectorCopy }) {
  const conflicts = preview.persons.filter(person => person.action === 'conflict');
  return <Card size="small" title={text.previewTitle}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.readOnly} />
      <Descriptions size="small" column={3}><Descriptions.Item label={text.create}>{preview.counts.create}</Descriptions.Item><Descriptions.Item label={text.unchanged}>{preview.counts.unchanged}</Descriptions.Item><Descriptions.Item label={text.conflict}>{preview.counts.conflict}</Descriptions.Item></Descriptions>
      {preview.persons.map(person => <Card key={`${person.displayName}:${person.action}`} size="small">
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space wrap><Text strong>{person.displayName}</Text><Tag color={person.action === 'conflict' ? 'warning' : person.action === 'unchanged' ? 'success' : 'processing'}>{person.action === 'conflict' ? text.conflict : person.action === 'unchanged' ? text.unchanged : text.create}</Tag><Tag>{person.linked ? text.linked : text.unlinked}</Tag></Space>
          {person.reasonCodes.map(code => <Text key={code} type="secondary">{reasonText(code, text)}</Text>)}
        </Space>
      </Card>)}
      {!conflicts.length ? <Text type="secondary">{text.noConflicts}</Text> : null}
    </Space>
  </Card>;
}

function reasonText(code: HourglassPreviewReasonCode, text: InspectorCopy): string {
  return code === 'DISPLAY_NAME_DIFFERS' ? text.displayNameDiffers : text.eligibilityDiffers;
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
