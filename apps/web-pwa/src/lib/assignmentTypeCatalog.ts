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
  // Built-in parts
  'builtin:opening-remarks': { 'pt-PT': 'Comentários iniciais', en: 'Opening remarks', es: 'Comentarios iniciales' },
  'builtin:treasures-from-gods-word': { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' },
  'builtin:spiritual-gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'builtin:bible-reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  'builtin:apply-yourself-to-the-ministry': { 'pt-PT': 'Empenhe-se na leitura e no ensino', en: 'Apply Yourself to Reading and Teaching', es: 'Seamos mejores maestros' },
  'builtin:living-as-christians': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'builtin:congregation-bible-study': { 'pt-PT': 'Estudo Bíblico de Congregação', en: 'Congregation Bible Study', es: 'Estudio bíblico de la congregación' },

  // Base roles & assignment names
  'chairman': { 'pt-PT': 'Presidente', en: 'Chairman', es: 'Presidente' },
  'opening-prayer': { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' },
  'closing-prayer': { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' },
  'prayer': { 'pt-PT': 'Oração', en: 'Prayer', es: 'Oración' },
  'bible-reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  'reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  'reader': { 'pt-PT': 'Leitor', en: 'Reader', es: 'Lector' },
  'treasures': { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' },
  'gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'spiritual_gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'living': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'living_as_christians': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'talk': { 'pt-PT': 'Discurso', en: 'Talk', es: 'Discurso' },
  'student-talk': { 'pt-PT': 'Discurso de estudante', en: 'Student talk', es: 'Discurso de estudiante' },
  'assistant': { 'pt-PT': 'Ajudante', en: 'Assistant', es: 'Ayudante' },
  'attendant': { 'pt-PT': 'Indicador', en: 'Attendant', es: 'Acomodador' },
  'microphones': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'microphone': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'mics': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'stage': { 'pt-PT': 'Palco / Plataforma', en: 'Stage / Platform', es: 'Plataforma' },
  'audio': { 'pt-PT': 'Operador de áudio / Som', en: 'Audio operator', es: 'Operador de audio' },
  'sound': { 'pt-PT': 'Operador de áudio / Som', en: 'Sound operator', es: 'Operador de sonido' },
  'video': { 'pt-PT': 'Operador de vídeo', en: 'Video operator', es: 'Operador de video' },
  'console': { 'pt-PT': 'Operador de som / Mesa de som', en: 'Sound console operator', es: 'Operador de sonido / Consola' },
  'cleaning': { 'pt-PT': 'Limpeza', en: 'Cleaning', es: 'Limpieza' },
  'hospitality': { 'pt-PT': 'Hospitalidade', en: 'Hospitality', es: 'Hospitalidad' },
  'parking': { 'pt-PT': 'Estacionamento', en: 'Parking', es: 'Aparcamiento' },
  'public-talk': { 'pt-PT': 'Discurso público', en: 'Public talk', es: 'Discurso público' },
  'watchtower-reader': { 'pt-PT': 'Leitor de A Sentinela', en: 'Watchtower reader', es: 'Lector de La Atalaya' },
  'watchtower-conductor': { 'pt-PT': 'Dirigente do Estudo de A Sentinela', en: 'Watchtower Study conductor', es: 'Conductor del Estudio de La Atalaya' },
  'cbs-conductor': { 'pt-PT': 'Dirigente do Estudo Bíblico de Congregação', en: 'Congregation Bible Study conductor', es: 'Conductor del Estudio bíblico de la congregación' },
  'cbs-reader': { 'pt-PT': 'Leitor do Estudo Bíblico de Congregação', en: 'Congregation Bible Study reader', es: 'Lector del Estudio bíblico de la congregación' },

  // Hourglass exported/imported privilege identifiers (hourglass:...)
  'hourglass:attendant': { 'pt-PT': 'Indicador', en: 'Attendant', es: 'Acomodador' },
  'hourglass:aux_chairman': { 'pt-PT': 'Conselheiro da Sala Auxiliar (2ª Sala)', en: 'Auxiliary classroom counselor', es: 'Consejero de sala auxiliar' },
  'hourglass:cbs_reader': { 'pt-PT': 'Leitor do Estudo Bíblico de Congregação', en: 'Congregation Bible Study reader', es: 'Lector del Estudio bíblico de la congregación' },
  'hourglass:cbs_conductor': { 'pt-PT': 'Dirigente do Estudo Bíblico de Congregação', en: 'Congregation Bible Study conductor', es: 'Conductor del Estudio bíblico de la congregación' },
  'hourglass:chairman': { 'pt-PT': 'Presidente da Reunião', en: 'Meeting Chairman', es: 'Presidente de la reunión' },
  'hourglass:chairman2': { 'pt-PT': 'Presidente da Sala Auxiliar (2ª Sala)', en: 'Auxiliary classroom chairman (Class 2)', es: 'Presidente (Sala 2)' },
  'hourglass:chairman3': { 'pt-PT': 'Presidente da Sala Auxiliar (3ª Sala)', en: 'Auxiliary classroom chairman (Class 3)', es: 'Presidente (Sala 3)' },
  'hourglass:cleaning': { 'pt-PT': 'Limpeza', en: 'Cleaning', es: 'Limpieza' },
  'hourglass:closeprayer': { 'pt-PT': 'Oração final', en: 'Closing prayer', es: 'Oración final' },
  'hourglass:conductFS': { 'pt-PT': 'Dirigente da Reunião de Serviço de Campo', en: 'Field service meeting conductor', es: 'Conductor de la reunión para el servicio del campo' },
  'hourglass:console': { 'pt-PT': 'Operador de som / Mesa de som', en: 'Sound console operator', es: 'Operador de sonido / Consola' },
  'hourglass:dfg': { 'pt-PT': 'Fazer discípulos / Explicar crenças', en: 'Making disciples / Explaining beliefs', es: 'Hacer discípulos / Explicar creencias' },
  'hourglass:hh': { 'pt-PT': 'De casa em casa', en: 'House to house', es: 'De casa en casa' },
  'hourglass:initcall': { 'pt-PT': 'Iniciar conversas / Primeiro contacto', en: 'Starting conversations / Initial call', es: 'Primera conversación / Contacto inicial' },
  'hourglass:mics': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'hourglass:microphone': { 'pt-PT': 'Microfones', en: 'Microphones', es: 'Micrófonos' },
  'hourglass:openprayer': { 'pt-PT': 'Oração inicial', en: 'Opening prayer', es: 'Oración inicial' },
  'hourglass:prayer': { 'pt-PT': 'Oração', en: 'Prayer', es: 'Oración' },
  'hourglass:pt': { 'pt-PT': 'Discurso público', en: 'Public talk', es: 'Discurso público' },
  'hourglass:publicMinistry': { 'pt-PT': 'Testemunho público', en: 'Public witnessing', es: 'Testimonio público' },
  'hourglass:reading': { 'pt-PT': 'Leitura da Bíblia', en: 'Bible reading', es: 'Lectura de la Biblia' },
  'hourglass:reader': { 'pt-PT': 'Leitor', en: 'Reader', es: 'Lector' },
  'hourglass:rv': { 'pt-PT': 'Cultivar o interesse / Revisita', en: 'Following up / Return visit', es: 'Cultivar el interés / Revisita' },
  'hourglass:stage': { 'pt-PT': 'Palco / Plataforma', en: 'Stage / Platform', es: 'Plataforma' },
  'hourglass:study': { 'pt-PT': 'Estudo bíblico / Curso bíblico', en: 'Bible study', es: 'Curso bíblico' },
  'hourglass:stutalk': { 'pt-PT': 'Discurso de estudante', en: 'Student talk', es: 'Discurso de estudiante' },
  'hourglass:treasures': { 'pt-PT': 'Tesouros da Palavra de Deus', en: "Treasures From God's Word", es: 'Tesoros de la Palabra de Dios' },
  'hourglass:gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'hourglass:spiritual_gems': { 'pt-PT': 'Pérolas espirituais', en: 'Spiritual gems', es: 'Perlas espirituales' },
  'hourglass:living': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'hourglass:living_as_christians': { 'pt-PT': 'A nossa vida cristã', en: 'Living as Christians', es: 'Nuestra vida cristiana' },
  'hourglass:video': { 'pt-PT': 'Operador de vídeo', en: 'Video operator', es: 'Operador de video' },
  'hourglass:wm_chairman': { 'pt-PT': 'Presidente da Reunião de Fim de Semana', en: 'Weekend meeting chairman', es: 'Presidente de la reunión del fin de semana' },
  'hourglass:wm_reader': { 'pt-PT': 'Leitor de A Sentinela', en: 'Watchtower reader', es: 'Lector de La Atalaya' },
  'hourglass:wt_conductor': { 'pt-PT': 'Dirigente do Estudo de A Sentinela', en: 'Watchtower Study conductor', es: 'Conductor del Estudio de La Atalaya' },
  'hourglass:zoom_attendant': { 'pt-PT': 'Assistente de videoconferência (Zoom)', en: 'Zoom / streaming attendant', es: 'Asistente de videoconferencia (Zoom)' },
  'hourglass:hospitality': { 'pt-PT': 'Hospitalidade', en: 'Hospitality', es: 'Hospitalidad' },
  'hourglass:interpreter': { 'pt-PT': 'Intérprete', en: 'Interpreter', es: 'Intérprete' },
  'hourglass:assistant': { 'pt-PT': 'Ajudante', en: 'Assistant', es: 'Ayudante' },
  'hourglass:talk': { 'pt-PT': 'Discurso', en: 'Talk', es: 'Discurso' },
  'hourglass:sound': { 'pt-PT': 'Operador de áudio / Som', en: 'Sound operator', es: 'Operador de sonido' },
  'hourglass:audio': { 'pt-PT': 'Operador de áudio / Som', en: 'Audio operator', es: 'Operador de audio' },
  'hourglass:parking': { 'pt-PT': 'Estacionamento', en: 'Parking', es: 'Aparcamiento' },
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
