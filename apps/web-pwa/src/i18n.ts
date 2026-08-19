export type Locale = 'pt-PT' | 'en' | 'es';

export const locales: Record<Locale, Record<string, string>> = {
  'pt-PT': {
    home: 'Início', agenda: 'Agenda', assignments: 'Designações', people: 'Pessoas', preferences: 'Preferências',
    today: 'Hoje', greeting: 'Tudo o que precisa da tua atenção.', subtitle: 'O Eutaktos mostra primeiro o que é importante agora.',
    nextAssignment: 'Próxima designação', spiritualGems: 'Pérolas Espirituais', midweek: 'Reunião do meio da semana', confirmed: 'Confirmada',
    pending: 'Por confirmar', openRoles: 'Funções por preencher', smartAssign: 'Smart Assign', fairness: 'Equilíbrio de designações',
    fairnessText: 'As recomendações usam elegibilidade, disponibilidade, histórico e carga. A decisão continua humana.',
    language: 'Idioma', theme: 'Tema', system: 'Sistema', light: 'Claro', dark: 'Escuro',
  },
  en: {
    home: 'Home', agenda: 'Agenda', assignments: 'Assignments', people: 'People', preferences: 'Preferences',
    today: 'Today', greeting: 'Everything that needs your attention.', subtitle: 'Eutaktos surfaces what matters now.',
    nextAssignment: 'Next assignment', spiritualGems: 'Spiritual Gems', midweek: 'Midweek meeting', confirmed: 'Confirmed',
    pending: 'Awaiting confirmation', openRoles: 'Unfilled roles', smartAssign: 'Smart Assign', fairness: 'Assignment balance',
    fairnessText: 'Recommendations use eligibility, availability, history and workload. The decision remains human.',
    language: 'Language', theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark',
  },
  es: {
    home: 'Inicio', agenda: 'Agenda', assignments: 'Asignaciones', people: 'Personas', preferences: 'Preferencias',
    today: 'Hoy', greeting: 'Todo lo que necesita tu atención.', subtitle: 'Eutaktos muestra primero lo importante.',
    nextAssignment: 'Próxima asignación', spiritualGems: 'Perlas espirituales', midweek: 'Reunión de entre semana', confirmed: 'Confirmada',
    pending: 'Por confirmar', openRoles: 'Funciones sin asignar', smartAssign: 'Smart Assign', fairness: 'Equilibrio de asignaciones',
    fairnessText: 'Las recomendaciones usan elegibilidad, disponibilidad, historial y carga. La decisión sigue siendo humana.',
    language: 'Idioma', theme: 'Tema', system: 'Sistema', light: 'Claro', dark: 'Oscuro',
  },
};
