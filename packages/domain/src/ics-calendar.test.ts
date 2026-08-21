import { describe, it, expect } from 'vitest';
import { serializeIcs } from './ics-calendar';

describe('serializeIcs', () => {
  const base = {
    uid: 'evt-123@example.com',
    summary: 'Midweek Meeting',
    start: '2026-08-25T19:00:00Z',
    end: '2026-08-25T20:30:00Z',
  };

  it('produces valid VCALENDAR structure', () => {
    const ics = serializeIcs(base);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Eutaktos//EN');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('METHOD:PUBLISH');
  });

  it('includes UID and SUMMARY', () => {
    const ics = serializeIcs(base);
    expect(ics).toContain('UID:evt-123@example.com');
    expect(ics).toContain('SUMMARY:Midweek Meeting');
  });

  it('UTC dates', () => {
    const ics = serializeIcs(base);
    expect(ics).toContain('DTSTART:20260825T190000Z');
    expect(ics).toContain('DTEND:20260825T203000Z');
  });

  it('timezone-aware dates', () => {
    const ics = serializeIcs({ ...base, timezone: 'America/Sao_Paulo', start: '2026-08-25T19:00:00-03:00', end: '2026-08-25T20:30:00-03:00' });
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20260825T190000');
    expect(ics).toContain('DTEND;TZID=America/Sao_Paulo:20260825T203000');
  });

  it('includes LOCATION when provided', () => {
    const ics = serializeIcs({ ...base, location: 'Kingdom Hall' });
    expect(ics).toContain('LOCATION:Kingdom Hall');
  });

  it('escapes commas in location', () => {
    const ics = serializeIcs({ ...base, location: 'Kingdom Hall, Main St' });
    expect(ics).toContain('LOCATION:Kingdom Hall\\, Main St');
  });

  it('includes DESCRIPTION when provided', () => {
    const ics = serializeIcs({ ...base, description: 'Weekly meeting' });
    expect(ics).toContain('DESCRIPTION:Weekly meeting');
  });

  it('escapes semicolons and backslashes', () => {
    const ics = serializeIcs({ ...base, summary: 'Test; value', description: 'a\\b' });
    expect(ics).toContain('SUMMARY:Test\\; value');
    expect(ics).toContain('DESCRIPTION:a\\\\b');
  });

  it('escapes newlines in description', () => {
    const ics = serializeIcs({ ...base, description: 'Line1\nLine2' });
    expect(ics).toContain('DESCRIPTION:Line1\\nLine2');
  });

  it('folds long lines', () => {
    const ics = serializeIcs({ ...base, summary: 'x'.repeat(100), location: 'y'.repeat(100) });
    // Check that CRLF + space folding exists
    expect(ics).toContain('\r\n ');
    // No line should exceed 75 octets (after folding)
    const lines = ics.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(' ')) continue; // continuation lines are 74 octets of content
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('handles Unicode', () => {
    const ics = serializeIcs({ ...base, summary: 'Reunião de Meio de Semana', location: 'São Paulo' });
    expect(ics).toContain('SUMMARY:Reunião de Meio de Semana');
    expect(ics).toContain('LOCATION:São Paulo');
  });

  it('handles DST edge', () => {
    // DST transition in São Paulo: 3rd Sunday of February
    const ics = serializeIcs({
      ...base,
      timezone: 'America/Sao_Paulo',
      start: '2026-02-15T02:00:00-03:00',
      end: '2026-02-15T04:00:00-03:00',
    });
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:');
  });

  it('leap year', () => {
    const ics = serializeIcs({ ...base, start: '2028-02-29T19:00:00Z', end: '2028-02-29T20:30:00Z' });
    expect(ics).toContain('DTSTART:20280229T190000Z');
  });

  it('deterministic output', () => {
    const a = serializeIcs(base);
    const b = serializeIcs(base);
    expect(a).toBe(b);
  });

  it('throws on empty uid', () => {
    expect(() => serializeIcs({ ...base, uid: '' })).toThrow('uid is required');
  });

  it('throws on empty summary', () => {
    expect(() => serializeIcs({ ...base, summary: '' })).toThrow('summary is required');
  });

  it('throws on invalid date', () => {
    expect(() => serializeIcs({ ...base, start: 'bad' })).toThrow('Invalid ISO date');
  });

  it('minimized description (empty string treated as absent)', () => {
    const ics = serializeIcs({ ...base, description: '' });
    expect(ics).not.toContain('DESCRIPTION:');
  });
});
