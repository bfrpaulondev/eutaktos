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

/** Operational parts that correspond to explicit eligibility categories. */
export const BUILTIN_PARTS: readonly BuiltinPart[] = Object.freeze([
  Object.freeze({ id: 'builtin:opening-remarks', titleKey: 'midweek.parts.openingRemarks', durationMinutes: 5, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Comentários iniciais', en: 'Opening remarks', es: 'Comentarios iniciales' } }),
  Object.freeze({ id: 'midweek:treasures-talk', titleKey: 'midweek.parts.treasuresTalk', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Tesouros da Palavra de Deus — discurso', en: "Treasures From God's Word — talk", es: 'Tesoros de la Biblia — discurso' } }),
  Object.freeze({ id: 'midweek:spiritual-gems', titleKey: 'midweek.parts.spiritualGems', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual Gems', es: 'Busquemos perlas escondidas' } }),
  Object.freeze({ id: 'midweek:bible-reading', titleKey: 'midweek.parts.bibleReading', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'none', label: { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' } }),
  Object.freeze({ id: 'midweek:initial-call', titleKey: 'midweek.parts.initialCall', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'optional', label: { 'pt-PT': 'Iniciar conversas', en: 'Starting a conversation', es: 'Empiece conversaciones' } }),
  Object.freeze({ id: 'midweek:return-visit', titleKey: 'midweek.parts.returnVisit', durationMinutes: 4, studentNeeded: true, assistantRequirement: 'optional', label: { 'pt-PT': 'Cultivar o interesse', en: 'Following up', es: 'Haga revisitas' } }),
  Object.freeze({ id: 'midweek:make-disciples', titleKey: 'midweek.parts.makeDisciples', durationMinutes: 5, studentNeeded: true, assistantRequirement: 'optional', label: { 'pt-PT': 'Fazer discípulos', en: 'Making disciples', es: 'Haga discípulos' } }),
  Object.freeze({ id: 'midweek:student-talk', titleKey: 'midweek.parts.studentTalk', durationMinutes: 5, studentNeeded: true, assistantRequirement: 'none', label: { 'pt-PT': 'Discurso de estudante', en: 'Student talk', es: 'Discurso de estudiante' } }),
  Object.freeze({ id: 'midweek:living-christians-part', titleKey: 'midweek.parts.livingChristiansPart', durationMinutes: 15, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Viver como Cristãos — parte', en: 'Living as Christians — part', es: 'Nuestra vida cristiana — parte' } }),
  Object.freeze({ id: 'midweek:congregation-bible-study', titleKey: 'midweek.parts.congregationBibleStudy', durationMinutes: 30, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Estudo bíblico de congregação', en: 'Congregation Bible Study', es: 'Estudio bíblico de la congregación' } }),
  Object.freeze({ id: 'midweek:congregation-bible-study-reader', titleKey: 'midweek.parts.congregationBibleStudyReader', durationMinutes: 30, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Leitor do estudo bíblico de congregação', en: 'Congregation Bible Study reader', es: 'Lector del estudio bíblico de la congregación' } }),
]);

export const STANDARD_NON_STUDENT_ROLES: readonly AssignmentTypeOption[] = Object.freeze([
  Object.freeze({ id: 'chairman', kind: 'role', label: { 'pt-PT': 'Presidente', en: 'Chairman', es: 'Presidente' } }),
  Object.freeze({ id: 'opening-prayer', kind: 'role', label: { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' } }),
  Object.freeze({ id: 'closing-prayer', kind: 'role', label: { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' } }),
]);

export const ELIGIBILITY_ASSIGNMENT_TYPES: readonly AssignmentTypeOption[] = Object.freeze([
  ...BUILTIN_PARTS.map(part => Object.freeze({ id: part.id, kind: part.studentNeeded ? 'student-part' as const : 'role' as const, label: part.label })),
  ...STANDARD_NON_STUDENT_ROLES,
]);

export const CUSTOM_ASSIGNMENT_TYPE_CHOICE = '__eutaktos_custom_assignment_type__';

export function builtinPart(id: string | undefined): BuiltinPart | undefined {
  return id ? BUILTIN_PARTS.find(part => part.id === id) : undefined;
}

export function slotAllowsStudentAssignment(partDefinitionId: string | undefined): boolean {
  return builtinPart(partDefinitionId)?.studentNeeded === true;
}

export function assignmentTypeLabel(assignmentTypeId: string, locale: Locale): string {
  return ELIGIBILITY_ASSIGNMENT_TYPES.find(option => option.id === assignmentTypeId)?.label[locale] ?? assignmentTypeId;
}

export function resolveAssignmentTypeChoice(choice: string, customValue: string): string {
  return (choice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? customValue : choice).trim();
}
