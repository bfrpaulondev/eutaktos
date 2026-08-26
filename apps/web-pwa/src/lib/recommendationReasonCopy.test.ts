import { describe, expect, it } from 'vitest';
import type { RecommendationReasonCode, RecommendationWarningCode } from '@eutaktos/application';
import type { Locale } from './preferences';
import {
  RECOMMENDATION_REASON_TEXT,
  RECOMMENDATION_WARNING_TEXT,
  recommendationReasonText,
  recommendationWarningText,
} from './recommendationReasonCopy';

const LOCALES = ['pt-PT', 'en', 'es'] as const satisfies readonly Locale[];

const REASON_CODES = [
  'ELIGIBLE',
  'AVAILABLE',
  'NO_MEETING_CONFLICT',
  'NO_WEEKLY_ASSIGNMENT',
  'LONGER_SINCE_LAST_ASSIGNMENT',
  'MEETS_REQUIRED_RESPONSIBILITY',
  'AWAY_DURING_MEETING',
  'NOT_ELIGIBLE',
  'CONFLICTING_ASSIGNMENT',
  'INACTIVE',
  'MISSING_REQUIRED_RESPONSIBILITY',
] as const satisfies readonly RecommendationReasonCode[];

const WARNING_CODES = [
  'HAS_WEEKLY_ASSIGNMENT',
  'NO_COMPLETED_ASSIGNMENT_HISTORY',
] as const satisfies readonly RecommendationWarningCode[];

function expectHumanCopy(value: string, rawCode: string): void {
  expect(value).toBe(value.trim());
  expect(value.length).toBeGreaterThan(8);
  expect(value).not.toBe(rawCode);
  expect(value).not.toMatch(/^[A-Z0-9_]+$/);
}

describe('C5.4 PX7 recommendation reason localization', () => {
  it('keeps the runtime catalog aligned with every currently supported reason and warning code', () => {
    expect(Object.keys(RECOMMENDATION_REASON_TEXT).sort()).toEqual([...REASON_CODES].sort());
    expect(Object.keys(RECOMMENDATION_WARNING_TEXT).sort()).toEqual([...WARNING_CODES].sort());
  });

  it.each(LOCALES)('provides clear human copy for every reason in %s', locale => {
    for (const code of REASON_CODES) {
      const value = recommendationReasonText(code, locale);
      expect(value).toBe(RECOMMENDATION_REASON_TEXT[code][locale]);
      expectHumanCopy(value, code);
    }
  });

  it.each(LOCALES)('provides clear human copy for every warning in %s', locale => {
    for (const code of WARNING_CODES) {
      const value = recommendationWarningText(code, locale);
      expect(value).toBe(RECOMMENDATION_WARNING_TEXT[code][locale]);
      expectHumanCopy(value, code);
    }
  });

  it('preserves important PX7 semantics instead of turning missing evidence into a recommendation', () => {
    expect(recommendationReasonText('LONGER_SINCE_LAST_ASSIGNMENT', 'pt-PT')).toContain('histórico comparável');
    expect(recommendationReasonText('LONGER_SINCE_LAST_ASSIGNMENT', 'en')).toContain('comparable history');
    expect(recommendationReasonText('LONGER_SINCE_LAST_ASSIGNMENT', 'es')).toContain('historial comparable');

    expect(recommendationWarningText('NO_COMPLETED_ASSIGNMENT_HISTORY', 'pt-PT')).toContain('não é possível comparar');
    expect(recommendationWarningText('NO_COMPLETED_ASSIGNMENT_HISTORY', 'en')).toContain('cannot be compared');
    expect(recommendationWarningText('NO_COMPLETED_ASSIGNMENT_HISTORY', 'es')).toContain('no se puede comparar');
  });

  it('keeps exclusion and warning wording distinct from positive evidence', () => {
    expect(recommendationReasonText('NOT_ELIGIBLE', 'pt-PT')).toContain('Não está elegível');
    expect(recommendationReasonText('AWAY_DURING_MEETING', 'pt-PT')).toContain('indisponível');
    expect(recommendationReasonText('CONFLICTING_ASSIGNMENT', 'pt-PT')).toContain('conflito');
    expect(recommendationWarningText('HAS_WEEKLY_ASSIGNMENT', 'pt-PT')).toContain('Já tem outra designação');
  });
});
