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
      eyebrow: 'Calendário pessoal', title: 'Agenda', subtitle: 'As reuniões reais serão apresentadas quando a consulta de agenda estiver disponível.', cards: [],
    },
    assignments: {
      eyebrow: 'Planeamento', title: 'Designações', subtitle: 'Histórico, disponibilidade e equilíbrio ficam visíveis antes de qualquer decisão.',
      cards: [
        { title: 'Leitura da Bíblia', meta: 'Carlos · 126 dias desde a última', detail: 'Elegível · disponível · sem conflito', status: '92%' },
        { title: 'Leitura da Bíblia', meta: 'André · 98 dias desde a última', detail: 'Elegível · disponível · sem outra designação na semana', status: '86%' },
        { title: 'Microfone 1', meta: 'Próxima reunião', detail: '1 função ainda por preencher', status: 'Atenção' },
      ],
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
    agenda: { eyebrow: 'Personal calendar', title: 'Agenda', subtitle: 'Real meetings will appear when the agenda query is available.', cards: [] },
    assignments: { eyebrow: 'Planning', title: 'Assignments', subtitle: 'History, availability and balance stay visible before a decision is made.', cards: [
      { title: 'Bible Reading', meta: 'Carlos · 126 days since last', detail: 'Eligible · available · no conflict', status: '92%' },
      { title: 'Bible Reading', meta: 'André · 98 days since last', detail: 'Eligible · available · no other assignment that week', status: '86%' },
      { title: 'Microphone 1', meta: 'Next meeting', detail: '1 role still unfilled', status: 'Attention' },
    ] },
    people: { eyebrow: 'Directory', title: 'People', subtitle: 'Operational information organized by permissions with minimal, auditable access.', cards: [
      { title: 'Carlos Almeida', meta: 'Group 2', detail: 'School · reading · AV' }, { title: 'André Silva', meta: 'Group 1', detail: 'School · microphones' }, { title: 'Bruno Costa', meta: 'Group 3', detail: 'AV · sound · video' },
    ] },
    preferences: { eyebrow: 'Just for you', title: 'Preferences', subtitle: 'Language, appearance, contrast, motion and transparency belong to the user, not the congregation.', cards: [
      { title: 'Personal language', meta: 'Português · English · Español', detail: 'Independent from the congregation language' }, { title: 'Visual comfort', meta: 'Light · Dark · System', detail: 'High contrast and reduced transparency available' }, { title: 'Motion and density', meta: 'Comfortable · Compact', detail: 'Non-essential animation can be reduced' },
    ] },
  },
  es: {
    agenda: { eyebrow: 'Calendario personal', title: 'Agenda', subtitle: 'Las reuniones reales aparecerán cuando esté disponible la consulta de agenda.', cards: [] },
    assignments: { eyebrow: 'Planificación', title: 'Asignaciones', subtitle: 'Historial, disponibilidad y equilibrio visibles antes de decidir.', cards: [
      { title: 'Lectura de la Biblia', meta: 'Carlos · 126 días desde la última', detail: 'Elegible · disponible · sin conflicto', status: '92%' }, { title: 'Lectura de la Biblia', meta: 'André · 98 días desde la última', detail: 'Elegible · disponible · sin otra asignación esa semana', status: '86%' }, { title: 'Micrófono 1', meta: 'Próxima reunión', detail: '1 función aún sin asignar', status: 'Atención' },
    ] },
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
