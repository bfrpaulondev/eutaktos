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

const label = (pt: string, en: string, es: string): Readonly<Record<Locale, string>> =>
  Object.freeze({ 'pt-PT': pt, en, es });

/** Operational schedule parts. Their IDs are scheduling/history identities, never eligibility grants. */
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

/** Legacy section-level definitions remain readable so older schedules keep rendering correctly. */
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
 * Canonical explicit eligibility categories consumed by scheduling.
 * These IDs are privileges, deliberately distinct from schedule-part IDs.
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

export const KNOWN_ASSIGNMENT_TYPE_LABELS: Readonly<Record<string, Readonly<Record<Locale, string>>>> = Object.freeze({
  'builtin:opening-remarks': label('Comentários iniciais', 'Opening remarks', 'Comentarios iniciales'),
  'builtin:treasures-from-gods-word': label('Tesouros da Palavra de Deus', "Treasures From God's Word", 'Tesoros de la Palabra de Dios'),
  'builtin:spiritual-gems': label('Pérolas espirituais', 'Spiritual gems', 'Perlas espirituales'),
  'builtin:bible-reading': label('Leitura da Bíblia', 'Bible reading', 'Lectura de la Biblia'),
  'builtin:apply-yourself-to-the-ministry': label('Empenhe-se na leitura e no ensino', 'Apply Yourself to Reading and Teaching', 'Seamos mejores maestros'),
  'builtin:living-as-christians': label('A nossa vida cristã', 'Living as Christians', 'Nuestra vida cristiana'),
  'builtin:congregation-bible-study': label('Estudo Bíblico de Congregação', 'Congregation Bible Study', 'Estudio bíblico de la congregación'),
  chairman: label('Presidente', 'Chairman', 'Presidente'),
  'opening-prayer': label('Oração inicial', 'Opening prayer', 'Oración inicial'),
  'closing-prayer': label('Oração final', 'Closing prayer', 'Oración final'),
  prayer: label('Oração', 'Prayer', 'Oración'),
  'bible-reading': label('Leitura da Bíblia', 'Bible reading', 'Lectura de la Biblia'),
  reading: label('Leitura da Bíblia', 'Bible reading', 'Lectura de la Biblia'),
  reader: label('Leitor', 'Reader', 'Lector'),
  treasures: label('Tesouros da Palavra de Deus', "Treasures From God's Word", 'Tesoros de la Palabra de Dios'),
  gems: label('Pérolas espirituais', 'Spiritual gems', 'Perlas espirituales'),
  spiritual_gems: label('Pérolas espirituais', 'Spiritual gems', 'Perlas espirituales'),
  living: label('A nossa vida cristã', 'Living as Christians', 'Nuestra vida cristiana'),
  living_as_christians: label('A nossa vida cristã', 'Living as Christians', 'Nuestra vida cristiana'),
  talk: label('Discurso', 'Talk', 'Discurso'),
  'student-talk': label('Discurso de estudante', 'Student talk', 'Discurso de estudiante'),
  assistant: label('Ajudante', 'Assistant', 'Ayudante'),
  attendant: label('Indicador', 'Attendant', 'Acomodador'),
  microphones: label('Microfones', 'Microphones', 'Micrófonos'),
  microphone: label('Microfones', 'Microphones', 'Micrófonos'),
  mics: label('Microfones', 'Microphones', 'Micrófonos'),
  stage: label('Palco', 'Stage', 'Plataforma'),
  audio: label('Áudio', 'Audio', 'Audio'),
  sound: label('Áudio', 'Audio', 'Audio'),
  video: label('Vídeo', 'Video', 'Vídeo'),
  console: label('Áudio', 'Audio', 'Audio'),
  cleaning: label('Limpeza', 'Cleaning', 'Limpieza'),
  hospitality: label('Hospitalidade', 'Hospitality', 'Hospitalidad'),
  parking: label('Estacionamento', 'Parking', 'Aparcamiento'),
  'public-talk': label('Discurso público', 'Public talk', 'Discurso público'),
  'watchtower-reader': label('Leitor de A Sentinela', 'Watchtower reader', 'Lector de La Atalaya'),
  'watchtower-conductor': label('Dirigente de A Sentinela', 'Watchtower Study conductor', 'Conductor del Estudio de La Atalaya'),
  'cbs-conductor': label('Estudo Bíblico de Congregação', 'Congregation Bible Study', 'Estudio bíblico de la congregación'),
  'cbs-reader': label('Leitor do Estudo Bíblico de Congregação', 'Congregation Bible Study reader', 'Lector del Estudio bíblico de la congregación'),
  'hourglass:attendant': label('Indicador', 'Attendant', 'Acomodador'),
  'hourglass:aux_chairman': label('Conselheiro da Sala Auxiliar (2ª Sala)', 'Auxiliary classroom counselor', 'Consejero de sala auxiliar'),
  'hourglass:cbs': label('Estudo Bíblico de Congregação', 'Congregation Bible Study', 'Estudio bíblico de la congregación'),
  'hourglass:cbs_reader': label('Leitor do Estudo Bíblico de Congregação', 'Congregation Bible Study reader', 'Lector del Estudio bíblico de la congregación'),
  'hourglass:chairman': label('Presidente da Reunião de Semana', 'Midweek meeting chairman', 'Presidente de la reunión de entre semana'),
  'hourglass:chairman2': label('Conselheiro da Sala Auxiliar (2ª Sala)', 'Auxiliary classroom counselor (Class 2)', 'Consejero de sala auxiliar (Sala 2)'),
  'hourglass:chairman3': label('Conselheiro da Sala Auxiliar (3ª Sala)', 'Auxiliary classroom counselor (Class 3)', 'Consejero de sala auxiliar (Sala 3)'),
  'hourglass:cleaning': label('Limpeza', 'Cleaning', 'Limpieza'),
  'hourglass:closeprayer': label('Oração final', 'Closing prayer', 'Oración final'),
  'hourglass:conductFS': label('Dirigente da Reunião de Serviço de Campo', 'Field service meeting conductor', 'Conductor de la reunión para el servicio del campo'),
  'hourglass:console': label('Áudio', 'Audio', 'Audio'),
  'hourglass:dfg': label('Pérolas espirituais', 'Spiritual Gems', 'Busquemos perlas escondidas'),
  'hourglass:fm_discussion': label('Contacto inicial (vídeo)', 'Initial call (video)', 'Primera conversación (vídeo)'),
  'hourglass:fs_assistant': label('Ajudante da Reunião de Serviço de Campo', 'Field service meeting assistant', 'Ayudante de la reunión para el servicio del campo'),
  'hourglass:hh': label('Ajudante', 'Assistant', 'Ayudante'),
  'hourglass:host': label('Hospitalidade', 'Hospitality', 'Hospitalidad'),
  'hourglass:initcall': label('Iniciar conversas', 'Starting conversations', 'Empiece conversaciones'),
  'hourglass:interpreter': label('Intérprete', 'Interpreter', 'Intérprete'),
  'hourglass:lac': label('Viver como Cristãos', 'Living as Christians', 'Nuestra vida cristiana'),
  'hourglass:localneeds': label('Necessidades locais', 'Local needs', 'Necesidades locales'),
  'hourglass:mics': label('Microfones', 'Microphones', 'Micrófonos'),
  'hourglass:mm_chairman': label('Presidente da Reunião de Semana', 'Midweek meeting chairman', 'Presidente de la reunión de entre semana'),
  'hourglass:none': label('Sem designação', 'No assignment', 'Sin asignación'),
  'hourglass:openprayer': label('Oração inicial', 'Opening prayer', 'Oración inicial'),
  'hourglass:prayer': label('Oração', 'Prayer', 'Oración'),
  'hourglass:pt': label('Discursos Públicos', 'Public talks', 'Discursos públicos'),
  'hourglass:pt_out': label('Discursos Públicos - Fora', 'Public talks - Away', 'Discursos públicos - Fuera'),
  'hourglass:publicMinistry': label('Testemunho Público', 'Public witnessing', 'Testimonio público'),
  'hourglass:reading': label('Leitor da Bíblia', 'Bible reader', 'Lector de la Biblia'),
  'hourglass:rv': label('Cultivar o interesse', 'Following up', 'Haga revisitas'),
  'hourglass:security_attendant': label('Indicador entrada', 'Entrance attendant', 'Acomodador de entrada'),
  'hourglass:stage': label('Palco', 'Stage', 'Plataforma'),
  'hourglass:stream': label('Streaming', 'Streaming', 'Streaming'),
  'hourglass:study': label('Fazer discípulos', 'Making disciples', 'Haga discípulos'),
  'hourglass:stutalk': label('Discurso de Estudante', 'Student talk', 'Discurso de estudiante'),
  'hourglass:treasures': label('Tesouros da Palavra de Deus', "Treasures From God's Word", 'Tesoros de la Biblia'),
  'hourglass:video': label('Vídeo', 'Video', 'Vídeo'),
  'hourglass:wm_chairman': label('Presidente da Reunião de Fim de Semana', 'Weekend meeting chairman', 'Presidente de la reunión del fin de semana'),
  'hourglass:wm_reader': label('Leitor de A Sentinela', 'Watchtower reader', 'Lector de La Atalaya'),
  'hourglass:wt_conductor': label('Dirigente de A Sentinela', 'Watchtower Study conductor', 'Conductor del Estudio de La Atalaya'),
  'hourglass:zoom_attendant': label('Assistente Zoom', 'Zoom attendant', 'Asistente Zoom'),
});

function humanizeAssignmentTypeId(id: string): string {
  const stripped = id.replace(/^(hourglass|builtin|custom):/, '');
  const spaced = stripped.replace(/[-_]+/g, ' ').trim();
  return spaced.replace(/\b\w/g, char => char.toLocaleUpperCase());
}

export function builtinPart(id: string | undefined): BuiltinPart | undefined {
  if (!id) return undefined;
  return BUILTIN_PARTS.find(part => part.id === id) ?? LEGACY_PARTS.find(part => part.id === id);
}

export function slotAllowsStudentAssignment(partDefinitionId: string | undefined): boolean {
  return builtinPart(partDefinitionId)?.studentNeeded === true;
}

export function assignmentTypeLabel(assignmentTypeId: string, locale: Locale): string {
  const catalogued = ELIGIBILITY_ASSIGNMENT_TYPES.find(option => option.id === assignmentTypeId);
  if (catalogued) return catalogued.label[locale];
  const standard = STANDARD_NON_STUDENT_ROLES.find(option => option.id === assignmentTypeId);
  if (standard) return standard.label[locale];
  const scheduledPart = builtinPart(assignmentTypeId);
  if (scheduledPart) return scheduledPart.label[locale];
  const known = KNOWN_ASSIGNMENT_TYPE_LABELS[assignmentTypeId];
  if (known) return known[locale];
  const unPrefixed = assignmentTypeId.replace(/^(hourglass|builtin|custom):/, '');
  const unPrefixedKnown = KNOWN_ASSIGNMENT_TYPE_LABELS[unPrefixed];
  if (unPrefixedKnown) return unPrefixedKnown[locale];
  return humanizeAssignmentTypeId(assignmentTypeId) || assignmentTypeId;
}

export function resolveAssignmentTypeChoice(choice: string, customValue: string): string {
  return (choice === CUSTOM_ASSIGNMENT_TYPE_CHOICE ? customValue : choice).trim();
}
