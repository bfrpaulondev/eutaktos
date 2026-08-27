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
import {
  hourglassImportExecutionApi,
  HourglassExecutionApiError,
  type HourglassExecutionResultDto,
  type HourglassPreparedExecutionDto,
  type HourglassRollbackResultDto,
} from './lib/hourglassImportExecutionApi';
import type { Locale } from './lib/preferences';

type Inspection = Readonly<HourglassImportInspection> | Readonly<HourglassContactListCsvInspection> | Readonly<HourglassPrivilegesCsvInspection>;
export type HourglassImportSource = 'json' | 'contacts-csv' | 'privileges-csv';
type PreviewState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';
type ExecuteState = 'idle' | 'preparing' | 'prepared' | 'executing' | 'success' | 'error' | 'unauthenticated' | 'forbidden';
type RollbackState = 'idle' | 'rolling-back' | 'success' | 'error' | 'unauthenticated' | 'forbidden';
const MAX_BYTES = 5_000_000;
const { Paragraph, Text } = Typography;

const copy = {
  'pt-PT': {
    title: 'Inspeção de export Hourglass', subtitle: 'Escolha primeiro a origem. O ficheiro é analisado apenas nesta sessão e nada é guardado até confirmar explicitamente a importação.', sourceStep: 'Origem', inspectStep: 'Inspeção', source: 'Formato suportado', json: 'Export JSON Hourglass', csv: 'Contact list CSV', privilegesCsv: 'Matriz CSV de privilégios', choose: 'Escolher ficheiro', loading: 'A analisar ficheiro…', unsupported: 'O ficheiro não corresponde ao formato escolhido ou não pôde ser analisado com segurança.', tooLarge: 'O ficheiro excede o limite de segurança de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilégios explícitos', privilegeTypes: 'Tipos de privilégio marcados', records: 'Registos encontrados', unrecognized: 'Secções não reconhecidas', fields: 'Campos não reconhecidos', csvLimitation: 'Este CSV de contactos não tem um ID de publicador estável comprovado. Pode ser inspecionado, mas não será enviado para reconciliação automática.', privilegeCsvLimitation: 'A matriz tem marcadores de privilégio explícitos, mas não um ID de publicador estável. Nenhuma elegibilidade será criada nem o CSV enviado para reconciliação automática.', jsonReady: 'Este formato tem IDs estáveis comprovados. Pode comparar explicitamente com o Eutaktos antes de qualquer escrita.', noUnknown: 'Nenhum', close: 'Fechar', privacy: 'Dados sensíveis: não inclua o ficheiro em tickets, screenshots ou commits.', reset: 'Escolher outra origem', compare: 'Comparar com Eutaktos', comparing: 'A comparar com dados autorizados…', retry: 'Tentar novamente', previewError: 'Não foi possível confirmar a prévia de reconciliação.', preview401: 'A sessão terminou antes da comparação.', preview403: 'Não tem permissão para comparar estes dados.', matchingPolicy: 'A correspondência usa apenas o ID externo Hourglass já ligado dentro desta congregação. Nomes nunca são usados para associar ou deduplicar pessoas.', previewTitle: 'Prévia de reconciliação', create: 'Novas', unchanged: 'Sem alteração', conflict: 'Conflitos', linked: 'Ligada', unlinked: 'Nova referência', displayNameDiffers: 'O nome difere da pessoa Eutaktos já ligada.', eligibilityDiffers: 'A elegibilidade explícita difere da importação Hourglass.', noConflicts: 'Nenhum conflito detetado.', readOnly: 'Prévia apenas. Nenhuma pessoa, elegibilidade ou ligação externa é alterada nesta etapa.', prepare: 'Preparar importação', preparing: 'A preparar confirmação…', prepared: 'A confirmação foi vinculada a esta prévia pelo servidor.', execute: 'Confirmar e importar', executing: 'A aplicar importação…', executeTitle: 'Confirmar importação Hourglass', executeConfirm: 'Esta ação cria os registos indicados na prévia. Confirme apenas se reviu estes dados.', executeError: 'Não foi possível concluir a importação. Pode tentar novamente sem criar uma segunda importação.', execute401: 'A sessão terminou antes da importação.', execute403: 'Não tem permissão para executar esta importação.', blocked: 'Existem conflitos. Resolva-os e faça uma nova comparação antes de importar.', success: 'Importação aplicada com sucesso.', alreadyApplied: 'A importação já tinha sido aplicada; o estado anterior foi recuperado com segurança.', created: 'Criadas', unchangedResult: 'Sem alteração', rollback: 'Reverter importação', rollbackTitle: 'Reverter esta importação?', rollbackConfirm: 'Esta ação remove apenas os registos criados por esta importação create-only. Confirme apenas se pretende desfazer esta importação.', rollingBack: 'A reverter importação…', rollbackSuccess: 'Importação revertida com sucesso.', rollbackAlready: 'Esta importação já tinha sido revertida.', rollbackError: 'Não foi possível reverter a importação.', removed: 'Removidos' },
  en: {
    title: 'Hourglass export inspector', subtitle: 'Choose the source first. The file is analyzed only in this session and nothing is saved until you explicitly confirm the import.', sourceStep: 'Source', inspectStep: 'Inspection', source: 'Supported format', json: 'Hourglass JSON export', csv: 'Contact list CSV', privilegesCsv: 'Privilege matrix CSV', choose: 'Choose file', loading: 'Analyzing file…', unsupported: 'The file does not match the selected format or could not be analyzed safely.', tooLarge: 'The file exceeds the 5 MB safety limit.', publishers: 'Publishers found', groups: 'Groups found', privileges: 'Explicit privileges', privilegeTypes: 'Marked privilege types', records: 'Records found', unrecognized: 'Unrecognized sections', fields: 'Unrecognized fields', csvLimitation: 'This contact-list CSV has no proven stable publisher ID. It can be inspected but is not sent for automatic reconciliation.', privilegeCsvLimitation: 'The matrix has explicit privilege markers but no stable publisher ID. No eligibility is created and the CSV is not sent for automatic reconciliation.', jsonReady: 'This format has proven stable IDs. You may explicitly compare it with Eutaktos before any write.', noUnknown: 'None', close: 'Close', privacy: 'Sensitive data: do not include this file in tickets, screenshots or commits.', reset: 'Choose another source', compare: 'Compare with Eutaktos', comparing: 'Comparing with authorized data…', retry: 'Try again', previewError: 'The reconciliation preview could not be confirmed.', preview401: 'Your session ended before the comparison.', preview403: 'You do not have permission to compare these data.', matchingPolicy: 'Matching uses only an already-linked Hourglass external ID inside this congregation. Names are never used to link or deduplicate people.', previewTitle: 'Reconciliation preview', create: 'New', unchanged: 'Unchanged', conflict: 'Conflicts', linked: 'Linked', unlinked: 'New reference', displayNameDiffers: 'The name differs from the already-linked Eutaktos person.', eligibilityDiffers: 'Explicit eligibility differs from the Hourglass import.', noConflicts: 'No conflicts detected.', readOnly: 'Preview only. No person, eligibility decision or external link is changed at this step.', prepare: 'Prepare import', preparing: 'Preparing confirmation…', prepared: 'The server bound this confirmation to the exact preview shown here.', execute: 'Confirm and import', executing: 'Applying import…', executeTitle: 'Confirm Hourglass import', executeConfirm: 'This action creates the records shown in the preview. Confirm only after reviewing these data.', executeError: 'The import could not be completed. You may retry without creating a second import.', execute401: 'Your session ended before the import.', execute403: 'You do not have permission to execute this import.', blocked: 'Conflicts remain. Resolve them and run a new comparison before importing.', success: 'Import applied successfully.', alreadyApplied: 'The import had already been applied; the prior result was recovered safely.', created: 'Created', unchangedResult: 'Unchanged', rollback: 'Roll back import', rollbackTitle: 'Roll back this import?', rollbackConfirm: 'This removes only records created by this create-only import. Confirm only if you intend to undo this import.', rollingBack: 'Rolling back import…', rollbackSuccess: 'Import rolled back successfully.', rollbackAlready: 'This import had already been rolled back.', rollbackError: 'The import could not be rolled back.', removed: 'Removed' },
  es: {
    title: 'Inspector de exportación Hourglass', subtitle: 'Elija primero el origen. El archivo se analiza solo en esta sesión y no se guarda nada hasta confirmar explícitamente la importación.', sourceStep: 'Origen', inspectStep: 'Inspección', source: 'Formato compatible', json: 'Exportación JSON Hourglass', csv: 'CSV de lista de contactos', privilegesCsv: 'CSV de matriz de privilegios', choose: 'Elegir archivo', loading: 'Analizando archivo…', unsupported: 'El archivo no coincide con el formato elegido o no se pudo analizar de forma segura.', tooLarge: 'El archivo supera el límite de seguridad de 5 MB.', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilegios explícitos', privilegeTypes: 'Tipos de privilegio marcados', records: 'Registros encontrados', unrecognized: 'Secciones no reconocidas', fields: 'Campos no reconocidos', csvLimitation: 'Este CSV de contactos no tiene un ID de publicador estable comprobado. Puede inspeccionarse, pero no se envía para conciliación automática.', privilegeCsvLimitation: 'La matriz tiene marcadores explícitos de privilegio, pero no un ID estable. No se crea elegibilidad ni se envía el CSV para conciliación automática.', jsonReady: 'Este formato tiene IDs estables comprobados. Puede compararlo explícitamente con Eutaktos antes de cualquier escritura.', noUnknown: 'Ninguno', close: 'Cerrar', privacy: 'Datos sensibles: no incluya el archivo en tickets, capturas de pantalla ni commits.', reset: 'Elegir otro origen', compare: 'Comparar con Eutaktos', comparing: 'Comparando con datos autorizados…', retry: 'Intentar de nuevo', previewError: 'No se pudo confirmar la vista previa de conciliación.', preview401: 'La sesión terminó antes de la comparación.', preview403: 'No tiene permiso para comparar estos datos.', matchingPolicy: 'La coincidencia usa solo un ID externo Hourglass ya vinculado dentro de esta congregación. Los nombres nunca se usan para vincular o deduplicar personas.', previewTitle: 'Vista previa de conciliación', create: 'Nuevas', unchanged: 'Sin cambios', conflict: 'Conflictos', linked: 'Vinculada', unlinked: 'Nueva referencia', displayNameDiffers: 'El nombre difiere de la persona Eutaktos ya vinculada.', eligibilityDiffers: 'La elegibilidad explícita difiere de la importación Hourglass.', noConflicts: 'No se detectaron conflictos.', readOnly: 'Solo vista previa. En este paso no se modifica ninguna persona, elegibilidad ni vínculo externo.', prepare: 'Preparar importación', preparing: 'Preparando confirmación…', prepared: 'El servidor vinculó esta confirmación a la vista previa exacta mostrada.', execute: 'Confirmar e importar', executing: 'Aplicando importación…', executeTitle: 'Confirmar importación Hourglass', executeConfirm: 'Esta acción crea los registros mostrados en la vista previa. Confirme solo después de revisar estos datos.', executeError: 'No se pudo completar la importación. Puede reintentar sin crear una segunda importación.', execute401: 'La sesión terminó antes de la importación.', execute403: 'No tiene permiso para ejecutar esta importación.', blocked: 'Quedan conflictos. Resuélvalos y haga una nueva comparación antes de importar.', success: 'Importación aplicada correctamente.', alreadyApplied: 'La importación ya se había aplicado; el resultado anterior se recuperó de forma segura.', created: 'Creadas', unchangedResult: 'Sin cambios', rollback: 'Revertir importación', rollbackTitle: '¿Revertir esta importación?', rollbackConfirm: 'Esta acción elimina solo los registros creados por esta importación create-only. Confirme solo si desea deshacerla.', rollingBack: 'Revirtiendo importación…', rollbackSuccess: 'Importación revertida correctamente.', rollbackAlready: 'Esta importación ya se había revertido.', rollbackError: 'No se pudo revertir la importación.', removed: 'Eliminados' },
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
function mutationId(): string { return `hourglass-ui-${crypto.randomUUID()}`; }

export function HourglassImportInspector({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const mutationIdRef = useRef(mutationId());
  const [source, setSource] = useState<HourglassImportSource>('json');
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [jsonPayload, setJsonPayload] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'unsafe' | 'too-large' | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [preview, setPreview] = useState<HourglassPreviewDto | null>(null);
  const [executeState, setExecuteState] = useState<ExecuteState>('idle');
  const [prepared, setPrepared] = useState<HourglassPreparedExecutionDto | null>(null);
  const [result, setResult] = useState<HourglassExecutionResultDto | null>(null);
  const [rollbackState, setRollbackState] = useState<RollbackState>('idle');
  const [rollbackResult, setRollbackResult] = useState<HourglassRollbackResultDto | null>(null);

  const cancelRequests = () => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  };
  const clearExecution = () => {
    setExecuteState('idle');
    setPrepared(null);
    setResult(null);
    setRollbackState('idle');
    setRollbackResult(null);
    mutationIdRef.current = mutationId();
  };
  const cancelPreview = () => {
    cancelRequests();
    setPreviewState('idle');
    setPreview(null);
    clearExecution();
  };
  const resetInspection = (nextSource?: HourglassImportSource) => {
    cancelPreview();
    if (nextSource) setSource(nextSource);
    setInspection(null);
    setJsonPayload(undefined);
    setError(null);
  };
  const busy = loading || previewState === 'loading' || executeState === 'preparing' || executeState === 'executing' || rollbackState === 'rolling-back';
  const close = () => {
    if (busy) return;
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
    if (source !== 'json' || jsonPayload === undefined || busy) return;
    clearExecution();
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPreview(null);
    setPreviewState('loading');
    try {
      const value = await hourglassImportPreviewApi.preview(jsonPayload, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setPreview(value);
      setPreviewState('ready');
    } catch (reason) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      if (reason instanceof HourglassPreviewApiError && reason.status === 401) setPreviewState('unauthenticated');
      else if (reason instanceof HourglassPreviewApiError && reason.status === 403) setPreviewState('forbidden');
      else setPreviewState('error');
    } finally { if (requestVersion === requestVersionRef.current) controllerRef.current = null; }
  };
  const prepare = async () => {
    if (jsonPayload === undefined || previewState !== 'ready' || busy) return;
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setExecuteState('preparing');
    setPrepared(null);
    setResult(null);
    setRollbackState('idle');
    setRollbackResult(null);
    try {
      const value = await hourglassImportExecutionApi.prepare(jsonPayload, mutationIdRef.current, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setPrepared(value);
      setPreview(value.preview);
      setExecuteState('prepared');
    } catch (reason) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      if (reason instanceof HourglassExecutionApiError && reason.status === 401) setExecuteState('unauthenticated');
      else if (reason instanceof HourglassExecutionApiError && reason.status === 403) setExecuteState('forbidden');
      else setExecuteState('error');
    } finally { if (requestVersion === requestVersionRef.current) controllerRef.current = null; }
  };
  const execute = async () => {
    if (!prepared || !prepared.canExecute || jsonPayload === undefined || busy) return;
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setExecuteState('executing');
    try {
      const value = await hourglassImportExecutionApi.execute(jsonPayload, prepared.executionId, prepared.confirmationDigest, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setResult(value);
      setExecuteState('success');
      setRollbackState('idle');
      setRollbackResult(null);
    } catch (reason) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      if (reason instanceof HourglassExecutionApiError && reason.status === 401) setExecuteState('unauthenticated');
      else if (reason instanceof HourglassExecutionApiError && reason.status === 403) setExecuteState('forbidden');
      else setExecuteState('error');
    } finally { if (requestVersion === requestVersionRef.current) controllerRef.current = null; }
  };
  const rollback = async () => {
    if (!result?.migrationId || busy || rollbackState === 'success') return;
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRollbackState('rolling-back');
    try {
      const value = await hourglassImportExecutionApi.rollback(result.migrationId, controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setRollbackResult(value);
      setRollbackState('success');
    } catch (reason) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      if (reason instanceof HourglassExecutionApiError && reason.status === 401) setRollbackState('unauthenticated');
      else if (reason instanceof HourglassExecutionApiError && reason.status === 403) setRollbackState('forbidden');
      else setRollbackState('error');
    } finally { if (requestVersion === requestVersionRef.current) controllerRef.current = null; }
  };
  const confirmExecute = () => {
    if (!prepared?.canExecute || busy) return;
    Modal.confirm({ title: text.executeTitle, content: text.executeConfirm, okText: text.execute, cancelText: text.close, okButtonProps: { danger: false }, onOk: () => execute() });
  };
  const confirmRollback = () => {
    if (!result?.migrationId || busy || rollbackState === 'success') return;
    Modal.confirm({ title: text.rollbackTitle, content: text.rollbackConfirm, okText: text.rollback, cancelText: text.close, okButtonProps: { danger: true }, onOk: () => rollback() });
  };

  const sourceLabel = source === 'json' ? text.json : source === 'contacts-csv' ? text.csv : text.privilegesCsv;
  const format = inspection ? (isHourglassJsonInspection(inspection) ? inspection.report.format : inspection.format) : undefined;

  return <Modal open={open} onCancel={close} width={760} title={text.title} footer={<Button onClick={close} disabled={busy}>{text.close}</Button>} destroyOnHidden>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="warning" showIcon title={text.privacy} />
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>{text.subtitle}</Paragraph>
      <Steps size="small" current={inspection ? 1 : 0} items={[{ title: text.sourceStep }, { title: text.inspectStep }]} />
      <Card size="small" title={text.source}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented block value={source} disabled={busy} onChange={value => resetInspection(value as HourglassImportSource)} options={[{ value: 'json', label: text.json }, { value: 'contacts-csv', label: text.csv }, { value: 'privileges-csv', label: text.privilegesCsv }]} />
          <Text type="secondary">{sourceLabel}</Text>
          <input ref={inputRef} type="file" accept={source === 'json' ? 'application/json,.json' : 'text/csv,.csv'} hidden onChange={event => void onFile(event)} />
          <Button type="primary" onClick={() => inputRef.current?.click()} disabled={busy} block>{text.choose}</Button>
        </Space>
      </Card>
      {loading ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 4 }} /></div> : null}
      {error ? <Alert type="error" showIcon title={error === 'too-large' ? text.tooLarge : text.unsupported} /> : null}
      {inspection ? <Card title={<Space wrap><span>{sourceLabel}</span><Tag>{format}</Tag></Space>} extra={<Button type="link" onClick={() => resetInspection()} disabled={busy}>{text.reset}</Button>}>
        {isHourglassJsonInspection(inspection) ? <JsonSummary inspection={inspection} text={text} onCompare={() => void compare()} onPrepare={() => void prepare()} onExecute={confirmExecute} onRollback={confirmRollback} previewState={previewState} preview={preview} executeState={executeState} prepared={prepared} result={result} rollbackState={rollbackState} rollbackResult={rollbackResult} /> : null}
        {isHourglassPrivilegesInspection(inspection) ? <PrivilegesSummary inspection={inspection} text={text} /> : null}
        {!isHourglassJsonInspection(inspection) && !isHourglassPrivilegesInspection(inspection) ? <ContactSummary inspection={inspection} text={text} /> : null}
      </Card> : null}
    </Space>
  </Modal>;
}

function JsonSummary({ inspection, text, onCompare, onPrepare, onExecute, onRollback, previewState, preview, executeState, prepared, result, rollbackState, rollbackResult }: { inspection: Readonly<HourglassImportInspection>; text: InspectorCopy; onCompare: () => void; onPrepare: () => void; onExecute: () => void; onRollback: () => void; previewState: PreviewState; preview: HourglassPreviewDto | null; executeState: ExecuteState; prepared: HourglassPreparedExecutionDto | null; result: HourglassExecutionResultDto | null; rollbackState: RollbackState; rollbackResult: HourglassRollbackResultDto | null }) {
  const busy = previewState === 'loading' || executeState === 'preparing' || executeState === 'executing' || rollbackState === 'rolling-back';
  return <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    <Descriptions column={1} size="small"><Descriptions.Item label={text.publishers}>{inspection.report.publisherCount}</Descriptions.Item><Descriptions.Item label={text.groups}>{inspection.report.groupCount}</Descriptions.Item><Descriptions.Item label={text.privileges}>{inspection.report.explicitPrivilegeCount}</Descriptions.Item></Descriptions>
    <UnknownList label={text.unrecognized} values={inspection.report.unknownTopLevelSections} emptyLabel={text.noUnknown} />
    <UnknownList label={text.fields} values={[...inspection.report.unknownPublisherFields, ...inspection.report.unknownGroupFields]} emptyLabel={text.noUnknown} />
    <Alert type="info" showIcon title={text.jsonReady} />
    <Alert type="warning" showIcon title={text.matchingPolicy} />
    <Button type="primary" onClick={onCompare} loading={previewState === 'loading'} disabled={busy}>{text.compare}</Button>
    {previewState === 'loading' ? <div role="status" aria-label={text.comparing}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}
    {previewState === 'unauthenticated' ? <Alert type="error" showIcon title={text.preview401} /> : null}
    {previewState === 'forbidden' ? <Alert type="warning" showIcon title={text.preview403} /> : null}
    {previewState === 'error' ? <Alert type="warning" showIcon title={text.previewError} action={<Button size="small" onClick={onCompare}>{text.retry}</Button>} /> : null}
    {previewState === 'ready' && preview ? <PreviewSummary preview={preview} text={text} /> : null}
    {previewState === 'ready' && preview && executeState === 'idle' ? <Button onClick={onPrepare} disabled={busy}>{text.prepare}</Button> : null}
    {executeState === 'preparing' ? <div role="status" aria-label={text.preparing}><Skeleton active paragraph={{ rows: 2 }} /></div> : null}
    {executeState === 'prepared' && prepared ? <><Alert type={prepared.canExecute ? 'warning' : 'error'} showIcon title={prepared.canExecute ? text.prepared : text.blocked} /><Button type="primary" onClick={onExecute} disabled={!prepared.canExecute || busy}>{text.execute}</Button></> : null}
    {executeState === 'executing' ? <div role="status" aria-label={text.executing}><Skeleton active paragraph={{ rows: 2 }} /></div> : null}
    {executeState === 'unauthenticated' ? <Alert type="error" showIcon title={text.execute401} /> : null}
    {executeState === 'forbidden' ? <Alert type="warning" showIcon title={text.execute403} /> : null}
    {executeState === 'error' ? <Alert type="error" showIcon title={text.executeError} action={prepared ? <Button size="small" onClick={onExecute}>{text.retry}</Button> : <Button size="small" onClick={onPrepare}>{text.retry}</Button>} /> : null}
    {executeState === 'success' && result ? <Alert type="success" showIcon title={result.outcome === 'already-applied' ? text.alreadyApplied : text.success} description={`${text.created}: ${result.createdCount} · ${text.unchangedResult}: ${result.unchangedCount}`} /> : null}
    {executeState === 'success' && result?.migrationId && rollbackState === 'idle' ? <Button danger onClick={onRollback} disabled={busy}>{text.rollback}</Button> : null}
    {rollbackState === 'rolling-back' ? <div role="status" aria-label={text.rollingBack}><Skeleton active paragraph={{ rows: 2 }} /></div> : null}
    {rollbackState === 'unauthenticated' ? <Alert type="error" showIcon title={text.execute401} /> : null}
    {rollbackState === 'forbidden' ? <Alert type="warning" showIcon title={text.execute403} /> : null}
    {rollbackState === 'error' ? <Alert type="error" showIcon title={text.rollbackError} action={<Button size="small" danger onClick={onRollback}>{text.retry}</Button>} /> : null}
    {rollbackState === 'success' && rollbackResult ? <Alert type="success" showIcon title={rollbackResult.outcome === 'already-rolled-back' ? text.rollbackAlready : text.rollbackSuccess} description={`${text.removed}: ${rollbackResult.removedCount}`} /> : null}
  </Space>;
}

function PreviewSummary({ preview, text }: { preview: HourglassPreviewDto; text: InspectorCopy }) {
  const conflicts = preview.persons.filter(person => person.action === 'conflict');
  return <Card size="small" title={text.previewTitle}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.readOnly} />
      <Descriptions size="small" column={3}><Descriptions.Item label={text.create}>{preview.counts.create}</Descriptions.Item><Descriptions.Item label={text.unchanged}>{preview.counts.unchanged}</Descriptions.Item><Descriptions.Item label={text.conflict}>{preview.counts.conflict}</Descriptions.Item></Descriptions>
      {preview.persons.map(person => <Card key={`${person.displayName}:${person.action}`} size="small"><Space direction="vertical" size="small" style={{ width: '100%' }}><Space wrap><Text strong>{person.displayName}</Text><Tag color={person.action === 'conflict' ? 'warning' : person.action === 'unchanged' ? 'success' : 'processing'}>{person.action === 'conflict' ? text.conflict : person.action === 'unchanged' ? text.unchanged : text.create}</Tag><Tag>{person.linked ? text.linked : text.unlinked}</Tag></Space>{person.reasonCodes.map(code => <Text key={code} type="secondary">{reasonText(code, text)}</Text>)}</Space></Card>)}
      {!conflicts.length ? <Text type="secondary">{text.noConflicts}</Text> : null}
    </Space>
  </Card>;
}
function reasonText(code: HourglassPreviewReasonCode, text: InspectorCopy): string { return code === 'DISPLAY_NAME_DIFFERS' ? text.displayNameDiffers : text.eligibilityDiffers; }
function PrivilegesSummary({ inspection, text }: { inspection: Readonly<HourglassPrivilegesCsvInspection>; text: InspectorCopy }) { return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} size="small"><Descriptions.Item label={text.records}>{inspection.recordCount}</Descriptions.Item><Descriptions.Item label={text.privilegeTypes}>{inspection.privilegeColumns.length}</Descriptions.Item></Descriptions><UnknownList label={text.fields} values={inspection.unknownColumns} emptyLabel={text.noUnknown} /><Alert type="info" showIcon title={text.privilegeCsvLimitation} /></Space>; }
function ContactSummary({ inspection, text }: { inspection: Readonly<HourglassContactListCsvInspection>; text: InspectorCopy }) { return <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} size="small"><Descriptions.Item label={text.records}>{inspection.recordCount}</Descriptions.Item></Descriptions><UnknownList label={text.fields} values={inspection.unknownHeaders} emptyLabel={text.noUnknown} /><Alert type="info" showIcon title={text.csvLimitation} /></Space>; }
function UnknownList({ label, values, emptyLabel }: { label: string; values: readonly string[]; emptyLabel: string }) { return <Space direction="vertical" size="small"><Text type="secondary">{label}</Text>{values.length ? <Space wrap>{values.map(value => <Tag key={value}>{value}</Tag>)}</Space> : <Text>{emptyLabel}</Text>}</Space>; }
