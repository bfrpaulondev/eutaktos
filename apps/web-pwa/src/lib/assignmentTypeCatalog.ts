import type { Locale } from './preferences';

export type BuiltinPart = Readonly<{
  id: string;
  titleKey: string;
  durationMinutes: number;
  studentNeeded: boolean;
  assistantRequirement: 'none' | 'optional' | 'required';
  label: Readonly<Record<Locale, string>>;
}>;

export type AssignmentTypeOption = Readonly<{
  id: string;
  kind: 'student-part' | 'role';
  label: Readonly<Record<Locale, string>>;
}>;

const label = (pt: string, en: string, es: string): Readonly<Record<Locale, string>> => Object.freeze({ 'pt-PT': pt, en, es });

/** Operational schedule parts. Their IDs are history/scheduling identities, not eligibility grants. */
export const BUILTIN_PARTS: readonly BuiltinPart[] = Object.freeze([
  Object.freeze({ id: 'builtin:opening-remarks', titleKey: 'midweek.parts.openingRemarks', durationMinutes: 5, studentNeeded: false, assistantRequirement: 'none', label: label('Comentários iniciais', 'Opening remarks', 'Comentarios iniciales') }),
  Object.freeze({ id: 'midweek:treasures-talk', titleKey: 'midweek.parts.treasuresTalk', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: label('Tesouros da Palavra de Deus — discurso', "Treasures From God's Word — talk", 'Tesoros de la Biblia — discurso') }),
  Object.freeze({ id: 'midweek:spiritual-gems', titleKey: 'midweek.parts.spiritualGems', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: label('Pérolas espirituais', 'Spiritual Gems', 'Busquemos perlas escondidas') }),
  Object.freeze({ id: 'midweek:bible-reading', titleKey: 'midweek.parts.bibleReading', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'none', label: label('Leitura da Bíblia', 'Bible reading', 'Lectura de la Biblia') }),
  Object.freeze({ id: 'midweek:initial-call', titleKey: 'midweek.parts.initialCall', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'optional', label: label('Iniciar conversas', 'Starting a conversation', 'Empiece conversaciones') }),
  Object.freeze({ id: 'midweek:return-visit', titleKey: 'midweek.parts.returnVisit', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'optional', label: label('Cultivar o interesse', 'Following up', 'Haga revisitas') }),
  Object.freeze({ id: 'midweek:make-disciples', titleKey: 'midweek.parts.makeDisciples', durationMinutes: 5, studentNeeded: true, assistantRequirement: 'optional', label: label('Fazer discípulos', 'Making disciples', 'Haga discípulos') }),
  Object.freeze({ id: 'midweek:student-talk', titleKey: 'midweek.parts.studentTalk', durationMinutes: 5, studentNeeded: true, assistantRequirement: 'none', label: label('Discurso de estudante', 'Student talk', 'Discurso de estudiante') }),
  Object.freeze({ id: 'midweek:living-christians-part', titleKey: 'midweek.parts.livingChristiansPart', durationMinutes: 15, studentNeeded: false, assistantRequirement: 'none', label: label('Viver como Cristãos — parte', 'Living as Christians — part', 'Nuestra vida cristiana — parte') }),
  Object.freeze({ id: 'midweek:congregation-bible-study', titleKey: 'midweek.parts.congregationBibleStudy', durationMinutes: 30, studentNeeded: false, assistantRequirement: 'none', label: label('Estudo bíblico de congregação', 'Congregation Bible Study', 'Estudio bíblico de la congregación') }),
  Object.freeze({ id: 'midweek:congregation-bible-study-reader', titleKey: 'midweek.parts.congregationBibleStudyReader', durationMinutes: 30, studentNeeded: false, assistantRequirement: 'none', label: label('Leitor do estudo bíblico de congregação', 'Congregation Bible Study reader', 'Lector del estudio bíblico de la congregación') }),
]);

/** Legacy section-level definitions are accepted only when reading older schedules. */
const LEGACY_PARTS: readonly BuiltinPart[] = Object.freeze([
  Object.freeze({ id: 'builtin:treasures-from-gods-word', titleKey: 'midweek.parts.treasuresFromGodsWord', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: label('Tesouros da Palavra de Deus', "Treasures From God's Word", 'Tesoros de la Palabra de Dios') }),
  Object.freeze({ id: 'builtin:apply-yourself-to-the-ministry', titleKey: 'midweek.parts.applyYourselfToTheMinistry', durationMinutes: 30, studentNeeded: true, assistantRequirement: 'optional', label: label('Empenhe-se na leitura e no ensino', 'Apply Yourself to Reading and Teaching', 'Seamos mejores maestros') }),
  Object.freeze({ id: 'builtin:living-as-christians', titleKey: 'midweek.parts.livingAsChristians', durationMinutes: 30, studentNeeded: true, assistantRequirement: 'required', label: label('A nossa vida cristã', 'Living as Christians', 'Nuestra vida cristiana') }),
]);

export const STANDARD_NON_STUDENT_ROLES: readonly AssignmentTypeOption[] = Object.freeze([
  Object.freeze({ id: 'chairman', kind: 'role', label: label('Presidente', 'Chairman', 'Presidente') }),
  Object.freeze({ id: 'opening-prayer', kind: 'role', label: label('Oração inicial', 'Opening prayer', 'Oración inicial') }),
  Object.freeze({ id: 'closing-prayer', kind: 'role', label: label('Oração final', 'Closing prayer', 'Oración final') }),
]);

/**
 * Canonical explicit eligibility categories consumed by the server. These are
 * privilege IDs, deliberately distinct from schedule part IDs. This prevents
 * the UI from creating grants that the scheduling service cannot use.
 */
export const ELIGIBILITY_ASSIGNMENT_TYPES: readonly AssignmentTypeOption[] = Object.freeze([
  Object.freeze({ id: 'hourglass:mm_chairman', kind: 'role', label: label('Presidente da reunião de semana', 'Midweek meeting chairman', 'Presidente de la reunión de entre semana') }),
  Object.freeze({ id: 'hourglass:treasures', kind: 'role', label: label('Tesouros da Palavra de Deus', "Treasures From God's Word", 'Tesoros de la Biblia') }),
  Object.freeze({ id: 'hourglass:dfg', kind: 'role', label: label('Pérolas espirituais', 'Spiritual Gems', 'Busquemos perlas escondidas') }),
  Object.freeze({ id: 'hourglass:reading', kind: 'student-part', label: label('Leitura da Bíblia', 'Bible reading', 'Lectura de la Biblia') }),
  Object.freeze({ id: 'hourglass:initcall', kind: 'student-part', label: label('Iniciar conversas', 'Starting a conversation', 'Empiece conversaciones') }),
  Object.freeze({ id: 'hourglass:rv', kind: 'student-part', label: label('Cultivar o interesse', 'Following up', 'Haga revisitas') }),
  Object.freeze({ id: 'hourglass:study', kind: 'student-part', label: label('Fazer discípulos', 'Making disciples', 'Haga discípulos') }),
  Object.freeze({ id: 'hourglass:stutalk', kind: 'student-part', label: label('Discurso de estudante', 'Student talk', 'Discurso de estudiante') }),
  Object.freeze({ id: 'hourglass:hh', kind: 'student-part', label: label('Ajudante', 'Assistant', 'Ayudante') }),
  Object.freeze({ id: 'hourglass:lac', kind: 'role', label: label('Viver como Cristãos', 'Living as Christians', 'Nuestra vida cristiana') }),
  Object.freeze({ id: 'hourglass:cbs', kind: 'role', label: label('Estudo bíblico de congregação', 'Congregation Bible Study', 'Estudio bíblico de la congregación') }),
  Object.freeze({ id: 'hourglass:cbs_reader', kind: 'role', label: label('Leitor do estudo bíblico de congregação', 'Congregation Bible Study reader', 'Lector del estudio bíblico de la congregación') }),
  Object.freeze({ id: 'hourglass:openprayer', kind: 'role', label: label('Oração inicial', 'Opening prayer', 'Oración inicial') }),
  Object.freeze({ id: 'hourglass:closeprayer', kind: 'role', label: label('Oração final', 'Closing prayer', 'Oración final') }),
]);

export const CUSTOM_ASSIGNMENT_TYPE_CHOICE = '__eutaktos_custom_assignment_type__';

export function builtinPart(id: string | undefined): BuiltinPart | undefined {
  if (!id) return undefined;
  return BUILTIN_PARTS.find(part => part.id === id) ?? LEGACY_PARTS.find(part => part.id === id);
}

export function slotAllowsStudentAssignment(partDefinitionId: string | undefined): boolean {
  return builtinPart(partDefinitionId)?.studentNeeded === true;
}

export function assignmentTypeLabel(assignmentTypeId: string, locale: Locale): string {
  return ELIGIBILITY_ASSIGNMENT_TYPES.find(option => option.id === assignmentTypeId)?.label[locale]
    ?? STANDARD_NON_STUDENT_ROLES.find(option => option.id === assignmentTypeId)?.label[locale]
    ?? builtinPart(assignmentTypeId)?.label[locale]
    ?? assignmentTypeId;
}

export function resolveAssignmentTypeChoice(choice: string, customValue: string): string {
  return (choice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? customValue : choice).trim();
}
