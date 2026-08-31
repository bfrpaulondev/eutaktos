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

export const KNOWN_ASSIGNMENT_TYPE_LABELS: Readonly<Record<string, Readonly<Record<Locale, string>>>> = Object.freeze({
  'builtin:opening-remarks': { 'pt-PT': 'Comentários iniciais', en: 'Opening remarks', es: 'Comentarios iniciales' },
  'builtin:treasures-from-gods-word': { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' },
  'builtin:spiritual-gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'builtin:bible-reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  'builtin:apply-yourself-to-the-ministry': { 'pt-PT': 'Empenhe-se na leitura e no ensino', en: 'Apply Yourself to Reading and Teaching', es: 'Seamos mejores maestros' },
  'builtin:living-as-christians': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'builtin:congregation-bible-study': { 'pt-PT': 'Estudo Bíblico de Congregação', en: 'Congregation Bible Study', es: 'Estudio bíblico de la congregación' },

  chairman: { 'pt-PT': 'Presidente', en: 'Chairman', es: 'Presidente' },
  'opening-prayer': { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' },
  'closing-prayer': { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' },
  prayer: { 'pt-PT': 'Oração', en: 'Prayer', es: 'Oración' },
  'bible-reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  reading: { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  reader: { 'pt-PT': 'Leitor', en: 'Reader', es: 'Lector' },
  treasures: { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' },
  gems: { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  spiritual_gems: { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  living: { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  living_as_christians: { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  talk: { 'pt-PT': 'Discurso', en: 'Talk', es: 'Discurso' },
  'student-talk': { 'pt-PT': 'Discurso de estudante', en: 'Student talk', es: 'Discurso de estudiante' },
  assistant: { 'pt-PT': 'Ajudante', en: 'Assistant', es: 'Ayudante' },
  attendant: { 'pt-PT': 'Indicador', en: 'Attendant', es: 'Acomodador' },
  microphones: { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  microphone: { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  mics: { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  stage: { 'pt-PT': 'Palco', en: 'Stage', es: 'Plataforma' },
  audio: { 'pt-PT': 'Áudio', en: 'Audio', es: 'Audio' },
  sound: { 'pt-PT': 'Áudio', en: 'Audio', es: 'Audio' },
  video: { 'pt-PT': 'Vídeo', en: 'Video', es: 'Vídeo' },
  console: { 'pt-PT': 'Áudio', en: 'Audio', es: 'Audio' },
  cleaning: { 'pt-PT': 'Limpeza', en: 'Cleaning', es: 'Limpieza' },
  hospitality: { 'pt-PT': 'Hospitalidade', en: 'Hospitality', es: 'Hospitalidad' },
  parking: { 'pt-PT': 'Estacionamento', en: 'Parking', es: 'Aparcamiento' },
  'public-talk': { 'pt-PT': 'Discurso público', en: 'Public talk', es: 'Discurso público' },
  'watchtower-reader': { 'pt-PT': 'Leitor de A Sentinela', en: 'Watchtower reader', es: 'Lector de La Atalaya' },
  'watchtower-conductor': { 'pt-PT': 'Dirigente de A Sentinela', en: 'Watchtower Study conductor', es: 'Conductor del Estudio de La Atalaya' },
  'cbs-conductor': { 'pt-PT': 'Estudo Bíblico de Congregação', en: 'Congregation Bible Study', es: 'Estudio bíblico de la congregación' },
  'cbs-reader': { 'pt-PT': 'Leitor do Estudo Bíblico de Congregação', en: 'Congregation Bible Study reader', es: 'Lector del Estudio bíblico de la congregación' },

  'hourglass:attendant': { 'pt-PT': 'Indicador', en: 'Attendant', es: 'Acomodador' },
  'hourglass:aux_chairman': { 'pt-PT': 'Conselheiro da Sala Auxiliar (2ª Sala)', en: 'Auxiliary classroom counselor', es: 'Consejero de sala auxiliar' },
  'hourglass:cbs': { 'pt-PT': 'Estudo Bíblico de Congregação', en: 'Congregation Bible Study', es: 'Estudio bíblico de la congregación' },
  'hourglass:cbs_reader': { 'pt-PT': 'Leitor do Estudo Bíblico de Congregação', en: 'Congregation Bible Study reader', es: 'Lector del Estudio bíblico de la congregación' },
  'hourglass:chairman': { 'pt-PT': 'Presidente da Reunião de Semana', en: 'Midweek meeting chairman', es: 'Presidente de la reunión de entre semana' },
  'hourglass:chairman2': { 'pt-PT': 'Conselheiro da Sala Auxiliar (2ª Sala)', en: 'Auxiliary classroom counselor (Class 2)', es: 'Consejero de sala auxiliar (Sala 2)' },
  'hourglass:chairman3': { 'pt-PT': 'Conselheiro da Sala Auxiliar (3ª Sala)', en: 'Auxiliary classroom counselor (Class 3)', es: 'Consejero de sala auxiliar (Sala 3)' },
  'hourglass:cleaning': { 'pt-PT': 'Limpeza', en: 'Cleaning', es: 'Limpieza' },
  'hourglass:closeprayer': { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' },
  'hourglass:conductFS': { 'pt-PT': 'Dirigente da Reunião de Serviço de Campo', en: 'Field service meeting conductor', es: 'Conductor de la reunión para el servicio del campo' },
  'hourglass:console': { 'pt-PT': 'Áudio', en: 'Audio', es: 'Audio' },
  'hourglass:dfg': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual Gems', es: 'Busquemos perlas escondidas' },
  'hourglass:fm_discussion': { 'pt-PT': 'Contacto inicial (vídeo)', en: 'Initial call (video)', es: 'Primera conversación (vídeo)' },
  'hourglass:fs_assistant': { 'pt-PT': 'Ajudante da Reunião de Serviço de Campo', en: 'Field service meeting assistant', es: 'Ayudante de la reunión para el servicio del campo' },
  'hourglass:hh': { 'pt-PT': 'Ajudante', en: 'Assistant', es: 'Ayudante' },
  'hourglass:host': { 'pt-PT': 'Hospitalidade', en: 'Hospitality', es: 'Hospitalidad' },
  'hourglass:initcall': { 'pt-PT': 'Iniciar conversas', en: 'Starting conversations', es: 'Empiece conversaciones' },
  'hourglass:interpreter': { 'pt-PT': 'Intérprete', en: 'Interpreter', es: 'Intérprete' },
  'hourglass:lac': { 'pt-PT': 'Viver como Cristãos', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'hourglass:localneeds': { 'pt-PT': 'Necessidades locais', en: 'Local needs', es: 'Necesidades locales' },
  'hourglass:mics': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'hourglass:mm_chairman': { 'pt-PT': 'Presidente da Reunião de Semana', en: 'Midweek meeting chairman', es: 'Presidente de la reunión de entre semana' },
  'hourglass:none': { 'pt-PT': 'Sem designação', en: 'No assignment', es: 'Sin asignación' },
  'hourglass:openprayer': { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' },
  'hourglass:prayer': { 'pt-PT': 'Oração', en: 'Prayer', es: 'Oración' },
  'hourglass:pt': { 'pt-PT': 'Discursos Públicos', en: 'Public talks', es: 'Discursos públicos' },
  'hourglass:pt_out': { 'pt-PT': 'Discursos Públicos - Fora', en: 'Public talks - Away', es: 'Discursos públicos - Fuera' },
  'hourglass:publicMinistry': { 'pt-PT': 'Testemunho Público', en: 'Public witnessing', es: 'Testimonio público' },
  'hourglass:reading': { 'pt-PT': 'Leitor da Bíblia', en: 'Bible reader', es: 'Lector de la Biblia' },
  'hourglass:rv': { 'pt-PT': 'Cultivar o interesse', en: 'Following up', es: 'Haga revisitas' },
  'hourglass:security_attendant': { 'pt-PT': 'Indicador entrada', en: 'Entrance attendant', es: 'Acomodador de entrada' },
  'hourglass:stage': { 'pt-PT': 'Palco', en: 'Stage', es: 'Plataforma' },
  'hourglass:stream': { 'pt-PT': 'Streaming', en: 'Streaming', es: 'Streaming' },
  'hourglass:study': { 'pt-PT': 'Fazer discípulos', en: 'Making disciples', es: 'Haga discípulos' },
  'hourglass:stutalk': { 'pt-PT': 'Discurso de Estudante', en: 'Student talk', es: 'Discurso de estudiante' },
  'hourglass:treasures': { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Biblia' },
  'hourglass:video': { 'pt-PT': 'Vídeo', en: 'Video', es: 'Vídeo' },
  'hourglass:wm_chairman': { 'pt-PT': 'Presidente da Reunião de Fim de Semana', en: 'Weekend meeting chairman', es: 'Presidente de la reunión del fin de semana' },
  'hourglass:wm_reader': { 'pt-PT': 'Leitor de A Sentinela', en: 'Watchtower reader', es: 'Lector de La Atalaya' },
  'hourglass:wt_conductor': { 'pt-PT': 'Dirigente de A Sentinela', en: 'Watchtower Study conductor', es: 'Conductor del Estudio de La Atalaya' },
  'hourglass:zoom_attendant': { 'pt-PT': 'Assistente Zoom', en: 'Zoom attendant', es: 'Asistente Zoom' },
});

function humanizeAssignmentTypeId(id: string): string {
  const stripped = id.replace(/^(hourglass|builtin|custom):/, '');
  const spaced = stripped.replace(/[-_]+/g, ' ').trim();
  return spaced.replace(/\b\w/g, char => char.toLocaleUpperCase());
}

export function builtinPart(id: string | undefined): BuiltinPart | undefined {
  return id ? BUILTIN_PARTS.find(part => part.id === id) : undefined;
}

export function slotAllowsStudentAssignment(partDefinitionId: string | undefined): boolean {
  return builtinPart(partDefinitionId)?.studentNeeded === true;
}

export function assignmentTypeLabel(assignmentTypeId: string, locale: Locale): string {
  const catalogued = ELIGIBILITY_ASSIGNMENT_TYPES.find(option => option.id === assignmentTypeId);
  if (catalogued) return catalogued.label[locale];

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
