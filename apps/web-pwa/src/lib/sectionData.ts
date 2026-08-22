import type { Locale } from './preferences';

export type WorkspaceSection = 'agenda' | 'assignments' | 'people' | 'preferences';

export interface WorkspaceCopy {
  title: string;
  subtitle: string;
  eyebrow: string;
  cards: Array<{ title: string; meta: string; detail: string; status?: string }>;
}

const DATA: Record<Locale, Record<WorkspaceSection, WorkspaceCopy>> = {
  'pt-PT': {
    agenda: {
      eyebrow: 'Calendário pessoal', title: 'Agenda', subtitle: 'Reuniões, designações e tarefas importantes numa única linha temporal.',
      cards: [
        { title: 'Reunião do meio da semana', meta: 'Hoje · 20:00', detail: 'Pérolas Espirituais · confirmado', status: 'Confirmado' },
        { title: 'Serviço de campo', meta: 'Sábado · 09:30', detail: 'Grupo 2 · ponto de encontro habitual' },
        { title: 'Reunião do fim de semana', meta: 'Domingo · 10:00', detail: 'Áudio · aguardando confirmação', status: 'Pendente' },
      ],
    },
    assignments: {
      eyebrow: 'Planeamento', title: 'Designações', subtitle: 'As designações reais serão apresentadas quando a consulta de designações estiver disponível.', cards: [],
    },
    people: {
      eyebrow: 'Diretório', title: 'Pessoas', subtitle: 'Informação operacional organizada por permissões, com acesso mínimo e auditável.',
      cards: [
        { title: 'Carlos Almeida', meta: 'Grupo 2', detail: 'Escola · leitura · AV' },
        { title: 'André Silva', meta: 'Grupo 1', detail: 'Escola · microfones' },
        { title: 'Bruno Costa', meta: 'Grupo 3', detail: 'AV · som · vídeo' },
      ],
    },
    preferences: {
      eyebrow: 'Só para ti', title: 'Preferências', subtitle: 'Idioma, aparência, contraste, movimento e transparência pertencem ao utilizador, não à congregação.',
      cards: [
        { title: 'Idioma individual', meta: 'Português · English · Español', detail: 'Independente do idioma da congregação' },
        { title: 'Conforto visual', meta: 'Claro · Escuro · Sistema', detail: 'Contraste elevado e redução de transparência disponíveis' },
        { title: 'Movimento e densidade', meta: 'Confortável · Compacta', detail: 'Animações não essenciais podem ser reduzidas' },
      ],
    },
  },
  en: {
    agenda: { eyebrow: 'Personal calendar', title: 'Agenda', subtitle: 'Meetings, assignments and important tasks in one calm timeline.', cards: [
      { title: 'Midweek meeting', meta: 'Today · 20:00', detail: 'Spiritual Gems · confirmed', status: 'Confirmed' },
      { title: 'Field service', meta: 'Saturday · 09:30', detail: 'Group 2 · regular meeting point' },
      { title: 'Weekend meeting', meta: 'Sunday · 10:00', detail: 'Audio · awaiting confirmation', status: 'Pending' },
    ] },
    assignments: { eyebrow: 'Planning', title: 'Assignments', subtitle: 'Real assignments will appear when the assignment query is available.', cards: [] },
    people: { eyebrow: 'Directory', title: 'People', subtitle: 'Operational information organized by permissions with minimal, auditable access.', cards: [
      { title: 'Carlos Almeida', meta: 'Group 2', detail: 'School · reading · AV' }, { title: 'André Silva', meta: 'Group 1', detail: 'School · microphones' }, { title: 'Bruno Costa', meta: 'Group 3', detail: 'AV · sound · video' },
    ] },
    preferences: { eyebrow: 'Just for you', title: 'Preferences', subtitle: 'Language, appearance, contrast, motion and transparency belong to the user, not the congregation.', cards: [
      { title: 'Personal language', meta: 'Português · English · Español', detail: 'Independent from the congregation language' }, { title: 'Visual comfort', meta: 'Light · Dark · System', detail: 'High contrast and reduced transparency available' }, { title: 'Motion and density', meta: 'Comfortable · Compact', detail: 'Non-essential animation can be reduced' },
    ] },
  },
  es: {
    agenda: { eyebrow: 'Calendario personal', title: 'Agenda', subtitle: 'Reuniones, asignaciones y tareas importantes en una sola línea temporal.', cards: [
      { title: 'Reunión de entre semana', meta: 'Hoy · 20:00', detail: 'Perlas espirituales · confirmada', status: 'Confirmada' }, { title: 'Servicio del campo', meta: 'Sábado · 09:30', detail: 'Grupo 2 · punto de encuentro habitual' }, { title: 'Reunión del fin de semana', meta: 'Domingo · 10:00', detail: 'Audio · esperando confirmación', status: 'Pendiente' },
    ] },
    assignments: { eyebrow: 'Planificación', title: 'Asignaciones', subtitle: 'Las asignaciones reales aparecerán cuando esté disponible la consulta de asignaciones.', cards: [] },
    people: { eyebrow: 'Directorio', title: 'Personas', subtitle: 'Información operativa organizada por permisos, con acceso mínimo y auditable.', cards: [
      { title: 'Carlos Almeida', meta: 'Grupo 2', detail: 'Escuela · lectura · AV' }, { title: 'André Silva', meta: 'Grupo 1', detail: 'Escuela · micrófonos' }, { title: 'Bruno Costa', meta: 'Grupo 3', detail: 'AV · sonido · vídeo' },
    ] },
    preferences: { eyebrow: 'Solo para ti', title: 'Preferencias', subtitle: 'Idioma, apariencia, contraste, movimiento y transparencia pertenecen al usuario, no a la congregación.', cards: [
      { title: 'Idioma individual', meta: 'Português · English · Español', detail: 'Independiente del idioma de la congregación' }, { title: 'Confort visual', meta: 'Claro · Oscuro · Sistema', detail: 'Contraste alto y reducción de transparencia disponibles' }, { title: 'Movimiento y densidad', meta: 'Cómoda · Compacta', detail: 'Las animaciones no esenciales pueden reducirse' },
    ] },
  },
};

export function getWorkspaceCopy(locale: Locale, section: WorkspaceSection): WorkspaceCopy {
  return DATA[locale][section];
}
