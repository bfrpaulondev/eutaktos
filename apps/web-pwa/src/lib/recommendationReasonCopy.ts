import type { RecommendationReasonCode, RecommendationWarningCode } from '@eutaktos/application';
import type { Locale } from './preferences';

type LocalizedRecommendationText = Readonly<Record<Locale, string>>;

function localized(ptPT: string, en: string, es: string): LocalizedRecommendationText {
  return Object.freeze({ 'pt-PT': ptPT, en, es });
}

/**
 * Presentation-only copy for the structured PX7 evidence contract.
 *
 * The recommendation engine remains authoritative for which codes are emitted.
 * This module must never infer eligibility, availability, conflicts, workload,
 * responsibility or history facts on its own.
 *
 * `satisfies Record<...>` intentionally makes a newly-added engine code fail
 * typecheck until every supported locale receives explicit UI wording.
 */
export const RECOMMENDATION_REASON_TEXT = Object.freeze({
  ELIGIBLE: localized(
    'Elegível para este tipo de designação.',
    'Eligible for this assignment type.',
    'Elegible para este tipo de asignación.',
  ),
  AVAILABLE: localized(
    'Disponível no horário desta designação.',
    'Available during this assignment time.',
    'Disponible durante el horario de esta asignación.',
  ),
  NO_MEETING_CONFLICT: localized(
    'Sem conflito com outra designação neste horário.',
    'No conflict with another assignment at this time.',
    'Sin conflicto con otra asignación en este horario.',
  ),
  NO_WEEKLY_ASSIGNMENT: localized(
    'Sem outra designação na semana desta reunião.',
    'No other assignment in the week of this meeting.',
    'Sin otra asignación en la semana de esta reunión.',
  ),
  LONGER_SINCE_LAST_ASSIGNMENT: localized(
    'Maior intervalo desde a última designação concluída entre os candidatos com histórico comparável.',
    'Longest interval since the last completed assignment among candidates with comparable history.',
    'Mayor intervalo desde la última asignación completada entre los candidatos con historial comparable.',
  ),
  MEETS_REQUIRED_RESPONSIBILITY: localized(
    'Tem a responsabilidade exigida para esta designação.',
    'Has the responsibility required for this assignment.',
    'Tiene la responsabilidad requerida para esta asignación.',
  ),
  AWAY_DURING_MEETING: localized(
    'Está indisponível durante o horário desta designação.',
    'Unavailable during this assignment time.',
    'No está disponible durante el horario de esta asignación.',
  ),
  NOT_ELIGIBLE: localized(
    'Não está elegível para este tipo de designação.',
    'Not eligible for this assignment type.',
    'No es elegible para este tipo de asignación.',
  ),
  CONFLICTING_ASSIGNMENT: localized(
    'Tem outra designação com horário em conflito.',
    'Has another assignment with a conflicting time.',
    'Tiene otra asignación con un horario en conflicto.',
  ),
  INACTIVE: localized(
    'A pessoa está inativa.',
    'The person is inactive.',
    'La persona está inactiva.',
  ),
  MISSING_REQUIRED_RESPONSIBILITY: localized(
    'Não tem a responsabilidade exigida para esta designação.',
    'Does not have the responsibility required for this assignment.',
    'No tiene la responsabilidad requerida para esta asignación.',
  ),
} as const satisfies Record<RecommendationReasonCode, LocalizedRecommendationText>);

export const RECOMMENDATION_WARNING_TEXT = Object.freeze({
  HAS_WEEKLY_ASSIGNMENT: localized(
    'Já tem outra designação na semana desta reunião.',
    'Already has another assignment in the week of this meeting.',
    'Ya tiene otra asignación en la semana de esta reunión.',
  ),
  NO_COMPLETED_ASSIGNMENT_HISTORY: localized(
    'Sem histórico de designações concluídas; não é possível comparar o intervalo desde a última designação.',
    'No completed assignment history; the interval since the last assignment cannot be compared.',
    'Sin historial de asignaciones completadas; no se puede comparar el intervalo desde la última asignación.',
  ),
} as const satisfies Record<RecommendationWarningCode, LocalizedRecommendationText>);

export function recommendationReasonText(code: RecommendationReasonCode, locale: Locale): string {
  return RECOMMENDATION_REASON_TEXT[code][locale];
}

export function recommendationWarningText(code: RecommendationWarningCode, locale: Locale): string {
  return RECOMMENDATION_WARNING_TEXT[code][locale];
}
