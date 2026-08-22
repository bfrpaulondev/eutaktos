import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Paper } from '@mui/material';
import { inspectHourglassContactListCsv, parseHourglassJsonText, type HourglassContactListCsvInspection, type HourglassImportInspection } from '@eutaktos/application';
import type { Locale } from './lib/preferences';
import { Stack, Typography } from './ui/MuiCompat';

type Inspection = Readonly<HourglassImportInspection> | Readonly<HourglassContactListCsvInspection>;
const MAX_BYTES = 5_000_000;
const copy = {
  'pt-PT': { title: 'Inspeção de export Hourglass', subtitle: 'O ficheiro é analisado apenas nesta sessão. Nenhum dado é guardado ou enviado até existir uma confirmação de importação suportada.', choose: 'Escolher export JSON ou CSV', loading: 'A analisar ficheiro…', unsupported: 'O ficheiro não corresponde a um formato Hourglass comprovado ou não pôde ser analisado com segurança.', tooLarge: 'O ficheiro excede o limite de segurança de 5 MB.', json: 'Export JSON Hourglass', csv: 'Contact list CSV Hourglass', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilégios explícitos', records: 'Registos encontrados', unrecognized: 'Secções não reconhecidas', fields: 'Campos não reconhecidos', csvLimitation: 'Este CSV de contactos não tem um ID de publicador estável comprovado. Pode ser inspecionado, mas não será persistido nem reconciliado sozinho.', noUnknown: 'Nenhum', close: 'Fechar', privacy: 'Dados sensíveis: não inclua o ficheiro em tickets, screenshots ou commits.' },
  en: { title: 'Hourglass export inspector', subtitle: 'The file is analyzed only in this session. No data is saved or sent until a supported import confirmation exists.', choose: 'Choose JSON or CSV export', loading: 'Analyzing file…', unsupported: 'The file does not match a proven Hourglass format or could not be analyzed safely.', tooLarge: 'The file exceeds the 5 MB safety limit.', json: 'Hourglass JSON export', csv: 'Hourglass contact list CSV', publishers: 'Publishers found', groups: 'Groups found', privileges: 'Explicit privileges', records: 'Records found', unrecognized: 'Unrecognized sections', fields: 'Unrecognized fields', csvLimitation: 'This contact-list CSV has no proven stable publisher ID. It can be inspected but will not be persisted or reconciled on its own.', noUnknown: 'None', close: 'Close', privacy: 'Sensitive data: do not include this file in tickets, screenshots or commits.' },
  es: { title: 'Inspector de exportación Hourglass', subtitle: 'El archivo se analiza solo en esta sesión. No se guardan ni envían datos hasta que exista una confirmación de importación compatible.', choose: 'Elegir exportación JSON o CSV', loading: 'Analizando archivo…', unsupported: 'El archivo no coincide con un formato Hourglass comprobado o no se pudo analizar de forma segura.', tooLarge: 'El archivo supera el límite de seguridad de 5 MB.', json: 'Exportación JSON Hourglass', csv: 'CSV de lista de contactos Hourglass', publishers: 'Publicadores encontrados', groups: 'Grupos encontrados', privileges: 'Privilegios explícitos', records: 'Registros encontrados', unrecognized: 'Secciones no reconocidas', fields: 'Campos no reconocidos', csvLimitation: 'Este CSV de contactos no tiene un ID de publicador estable comprobado. Puede inspeccionarse, pero no se conservará ni reconciliará por sí solo.', noUnknown: 'Ninguno', close: 'Cerrar', privacy: 'Datos sensibles: no incluyas este archivo en tickets, capturas de pantalla ni commits.' },
} as const;

export function HourglassImportInspector({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'unsafe' | 'too-large' | null>(null);
  const selectFile = () => inputRef.current?.click();
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setInspection(null); setError(null);
    if (file.size > MAX_BYTES) { setError('too-large'); return; }
    setLoading(true);
    try {
      const contents = await file.text();
      const next = file.name.toLocaleLowerCase().endsWith('.csv') ? inspectHourglassContactListCsv(contents) : parseHourglassJsonText(contents);
      setInspection(next);
    } catch { setError('unsafe'); }
    finally { setLoading(false); }
  };

  return <Dialog open={open} onClose={() => !loading && onClose()} fullWidth maxWidth="sm" aria-labelledby="hourglass-inspector-title"><DialogTitle id="hourglass-inspector-title">{text.title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="warning" icon={false}>{text.privacy}</Alert><Typography color="text.secondary">{text.subtitle}</Typography><input ref={inputRef} type="file" accept="application/json,.json,text/csv,.csv" hidden onChange={event => void onFile(event)} /><Button variant="contained" onClick={selectFile} disabled={loading} sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>{text.choose}</Button>{loading ? <Stack direction="row" spacing={1.5} alignItems="center" role="status"><CircularProgress size={22} /><Typography color="text.secondary">{text.loading}</Typography></Stack> : null}{error ? <Alert severity="error">{error === 'too-large' ? text.tooLarge : text.unsupported}</Alert> : null}{inspection ? <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography variant="subtitle1" fontWeight={800}>{isHourglassJsonInspection(inspection) ? text.json : text.csv}</Typography><Chip label={isHourglassJsonInspection(inspection) ? inspection.report.format : inspection.format} size="small" variant="outlined" /></Stack><Divider />{isHourglassJsonInspection(inspection) ? <><Metric label={text.publishers} value={inspection.report.publisherCount} /><Metric label={text.groups} value={inspection.report.groupCount} /><Metric label={text.privileges} value={inspection.report.explicitPrivilegeCount} /><UnknownList label={text.unrecognized} values={inspection.report.unknownTopLevelSections} emptyLabel={text.noUnknown} /><UnknownList label={text.fields} values={[...inspection.report.unknownPublisherFields, ...inspection.report.unknownGroupFields]} emptyLabel={text.noUnknown} /></> : <><Metric label={text.records} value={inspection.recordCount} /><UnknownList label={text.fields} values={inspection.unknownHeaders} emptyLabel={text.noUnknown} /><Alert severity="info">{text.csvLimitation}</Alert></>}</Stack></Paper> : null}</Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={loading}>{text.close}</Button></DialogActions></Dialog>;
}
function isHourglassJsonInspection(value: Inspection): value is Readonly<HourglassImportInspection> { return 'report' in value; }
function Metric({ label, value }: { label: string; value: number }) { return <Stack direction="row" justifyContent="space-between" gap={2}><Typography color="text.secondary">{label}</Typography><Typography fontWeight={800}>{value}</Typography></Stack>; }
function UnknownList({ label, values, emptyLabel }: { label: string; values: readonly string[]; emptyLabel: string }) { return <Stack spacing={0.75}><Typography variant="body2" color="text.secondary">{label}</Typography>{values.length ? <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>{values.map(value => <Chip key={value} label={value} size="small" variant="outlined" />)}</Stack> : <Typography variant="body2">{emptyLabel}</Typography>}</Stack>; }
