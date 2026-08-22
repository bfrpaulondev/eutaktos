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
    agenda: { eyebrow: 'Calendário pessoal', title: 'Agenda', subtitle: 'As reuniões reais serão apresentadas quando a consulta de agenda estiver disponível.', cards: [] },
    assignments: { eyebrow: 'Planeamento', title: 'Designações', subtitle: 'As designações reais serão apresentadas quando a consulta de designações estiver disponível.', cards: [] },
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
    agenda: { eyebrow: 'Personal calendar', title: 'Agenda', subtitle: 'Real meetings will appear when the agenda query is available.', cards: [] },
    assignments: { eyebrow: 'Planning', title: 'Assignments', subtitle: 'Real assignments will appear when the assignment query is available.', cards: [] },
    people: { eyebrow: 'Directory', title: 'People', subtitle: 'Operational information organized by permissions with minimal, auditable access.', cards: [
      { title: 'Carlos Almeida', meta: 'Group 2', detail: 'School · reading · AV' }, { title: 'André Silva', meta: 'Group 1', detail: 'School · microphones' }, { title: 'Bruno Costa', meta: 'Group 3', detail: 'AV · sound · video' },
    ] },
    preferences: { eyebrow: 'Just for you', title: 'Preferences', subtitle: 'Language, appearance, contrast, motion and transparency belong to the user, not the congregation.', cards: [
      { title: 'Personal language', meta: 'Português · English · Español', detail: 'Independent from the congregation language' }, { title: 'Visual comfort', meta: 'Light · Dark · System', detail: 'High contrast and reduced transparency available' }, { title: 'Motion and density', meta: 'Comfortable · Compact', detail: 'Non-essential animation can be reduced' },
    ] },
  },
  es: {
    agenda: { eyebrow: 'Calendario personal', title: 'Agenda', subtitle: 'Las reuniones reales aparecerán cuando esté disponible la consulta de agenda.', cards: [] },
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
