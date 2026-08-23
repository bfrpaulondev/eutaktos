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

export const BUILTIN_PARTS: readonly BuiltinPart[] = Object.freeze([
  Object.freeze({ id: 'builtin:opening-remarks', titleKey: 'midweek.parts.openingRemarks', durationMinutes: 5, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Comentários iniciais', en: 'Opening remarks', es: 'Comentarios iniciales' } }),
  Object.freeze({ id: 'builtin:treasures-from-gods-word', titleKey: 'midweek.parts.treasuresFromGodsWord', durationMinutes: 10, studentNeeded: false, assistantRequirement: 'none', label: { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' } }),
  Object.freeze({ id: 'builtin:apply-yourself-to-the-ministry', titleKey: 'midweek.parts.applyYourselfToTheMinistry', durationMinutes: 30, studentNeeded: true, assistantRequirement: 'optional', label: { 'pt-PT': 'Empenhe-se na leitura e no ensino', en: 'Apply Yourself to Reading and Teaching', es: 'Seamos mejores maestros' } }),
  Object.freeze({ id: 'builtin:living-as-christians', titleKey: 'midweek.parts.livingAsChristians', durationMinutes: 30, studentNeeded: true, assistantRequirement: 'required', label: { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' } }),
]);

export const STANDARD_NON_STUDENT_ROLES: readonly AssignmentTypeOption[] = Object.freeze([
  Object.freeze({ id: 'chairman', kind: 'role', label: { 'pt-PT': 'Presidente', en: 'Chairman', es: 'Presidente' } }),
  Object.freeze({ id: 'opening-prayer', kind: 'role', label: { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' } }),
  Object.freeze({ id: 'closing-prayer', kind: 'role', label: { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' } }),
  Object.freeze({ id: 'bible-reading', kind: 'role', label: { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' } }),
]);

export const ELIGIBILITY_ASSIGNMENT_TYPES: readonly AssignmentTypeOption[] = Object.freeze([
  ...BUILTIN_PARTS.filter(part => part.studentNeeded).map(part => Object.freeze({ id: part.id, kind: 'student-part' as const, label: part.label })),
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
  const catalogued = ELIGIBILITY_ASSIGNMENT_TYPES.find(option => option.id === assignmentTypeId);
  return catalogued?.label[locale] ?? assignmentTypeId;
}

export function resolveAssignmentTypeChoice(choice: string, customValue: string): string {
  return (choice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? customValue : choice).trim();
}
