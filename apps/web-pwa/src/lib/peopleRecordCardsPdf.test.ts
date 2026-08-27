import { describe, expect, it } from 'vitest';
import { buildPdfFromJpegPages } from './peopleRecordCardsPdf';

function text(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

describe('Record Cards PDF export', () => {
  it('builds a direct binary PDF with one image-backed page per rendered page', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdfFromJpegPages([
      { bytes: jpeg, width: 1240, height: 1754 },
      { bytes: jpeg, width: 1240, height: 1754 },
    ]);
    const value = text(pdf);
    expect(value.startsWith('%PDF-1.4')).toBe(true);
    expect(value).toContain('/Count 2');
    expect(value.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(value).toContain('xref');
    expect(value.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('refuses an empty artifact instead of fabricating an invalid PDF', () => {
    expect(() => buildPdfFromJpegPages([])).toThrow('PDF requires at least one page');
  });
});
