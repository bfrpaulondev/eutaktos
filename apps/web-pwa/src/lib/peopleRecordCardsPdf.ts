import type { PeopleRecordCardsDto } from './peopleRecordCardsApi';
import type { Locale } from './preferences';

interface JpegPage {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

const encoder = new TextEncoder();

function ascii(value: string): Uint8Array {
  return encoder.encode(value);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function buildPdfFromJpegPages(pages: readonly JpegPage[]): Uint8Array {
  if (!pages.length) throw new Error('PDF requires at least one page');
  const chunks: Uint8Array[] = [ascii('%PDF-1.4\n%PDFBIN\n')];
  const offsets: number[] = [0];
  let cursor = chunks[0].length;
  const pageObjectIds = pages.map((_, index) => 3 + index * 3);
  const objectCount = 2 + pages.length * 3;

  const pushObject = (id: number, body: readonly Uint8Array[]) => {
    offsets[id] = cursor;
    const object = concat([ascii(`${id} 0 obj\n`), ...body, ascii('\nendobj\n')]);
    chunks.push(object);
    cursor += object.length;
  };

  pushObject(1, [ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
  pushObject(2, [ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>`)]);

  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const stream = ascii('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n');
    pushObject(pageId, [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)]);
    pushObject(imageId, [
      ascii(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`),
      page.bytes,
      ascii('\nendstream'),
    ]);
    pushObject(contentId, [ascii(`<< /Length ${stream.length} >>\nstream\n`), stream, ascii('endstream')]);
  });

  const xrefOffset = cursor;
  const xref: string[] = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n'];
  for (let id = 1; id <= objectCount; id += 1) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  chunks.push(ascii(xref.join('')));
  return concat(chunks);
}

function jpegBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',', 2)[1];
  if (!encoded) throw new Error('Canvas did not produce JPEG data');
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function renderPages(data: PeopleRecordCardsDto, locale: Locale, title: string): readonly JpegPage[] {
  const width = 1240;
  const height = 1754;
  const margin = 80;
  const bottom = height - margin;
  const pages: JpegPage[] = [];
  let canvas: HTMLCanvasElement;
  let context: CanvasRenderingContext2D;
  let y = margin;

  const begin = () => {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const next = canvas.getContext('2d');
    if (!next) throw new Error('Canvas is unavailable');
    context = next;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111111';
    y = margin;
    context.font = '700 34px sans-serif';
    context.fillText(title, margin, y);
    y += 52;
    context.font = '22px sans-serif';
    context.fillText(`${data.period.from} — ${data.period.to}`, margin, y);
    y += 52;
  };

  const finish = () => {
    pages.push(Object.freeze({ bytes: jpegBytes(canvas.toDataURL('image/jpeg', 0.92)), width, height }));
  };

  const ensure = (heightNeeded: number) => {
    if (y + heightNeeded <= bottom) return;
    finish();
    begin();
  };

  begin();
  for (const card of data.cards) {
    ensure(88);
    context.font = '700 25px sans-serif';
    context.fillText(card.displayName, margin, y);
    y += 38;
    context.font = '20px sans-serif';
    for (const record of card.records) {
      ensure(34);
      const date = new Date(`${record.meetingDate}T00:00:00`).toLocaleDateString(locale);
      context.fillText(`${date} — ${record.partType}`, margin + 24, y);
      y += 32;
    }
    y += 24;
  }
  finish();
  return Object.freeze(pages);
}

export async function downloadPeopleRecordCardsPdf(data: PeopleRecordCardsDto, locale: Locale, title: string): Promise<void> {
  const pdf = buildPdfFromJpegPages(renderPages(data, locale, title));
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eutaktos-record-cards-${data.period.from}-${data.period.to}.pdf`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
