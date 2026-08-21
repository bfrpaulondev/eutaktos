import type { MigrationPersonRow } from './migration-schema';
export const PEOPLE_CSV_COLUMNS=Object.freeze(['externalId','displayName','active','preferredLocale'] as const);
function spreadsheetSafe(value:string):string{return /^[=+\-@]/.test(value)?`'${value}`:value;}
function escape(value:string):string{const safe=spreadsheetSafe(value);return /[",\r\n]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;}
export function exportPeopleCsv(rows:readonly MigrationPersonRow[]):string{const lines=[PEOPLE_CSV_COLUMNS.join(',')];for(const row of rows){if(!row.isValid)throw new Error(`Cannot export invalid migration row${row.sourceRow?` ${row.sourceRow}`:''}`);const values=[row.externalId,row.displayName,row.active?'true':'false',row.preferredLocale??''];lines.push(values.map(escape).join(','));}return `${lines.join('\r\n')}\r\n`;}
