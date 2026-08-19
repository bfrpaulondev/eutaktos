(() => {
  'use strict';

  const STORAGE_KEY = 'eutaktos-preview-preferences-v1';
  const supportedViews = new Set(['home', 'agenda', 'assignments', 'people', 'settings']);
  const placeholderViews = new Set(['service', 'territories', 'reports', 'review']);

  const translations = {
    'pt-PT': {
      tagline: 'Everything in good order.', navHome: 'Início', navAgenda: 'Agenda', navAssignments: 'Designações', navPeople: 'Pessoas', navService: 'Serviço', navTerritories: 'Territórios', navReports: 'Relatórios', navSettings: 'Preferências', privacyLabel: 'Privacidade primeiro', congregation: 'Congregação Exemplo', homeTitle: 'Hoje', welcomeEyebrow: 'Quarta-feira, 19 de agosto', welcomeTitle: 'Tudo o que precisa da tua atenção.', welcomeSubtitle: 'Sem procurar em vários menus. O Eutaktos reúne o que importa agora.', prepareMeeting: 'Preparar próxima reunião', pendingConfirmations: 'Por confirmar', pendingConfirmationsSub: 'designações', needsReplacement: 'Precisa substituto', needsReplacementSub: 'esta semana', missingReports: 'Relatórios em falta', missingReportsSub: 'mês atual', reviewSuggestions: 'Sugestões de análise', reviewSuggestionsSub: 'acesso restrito', nextEyebrow: 'A seguir', nextTitle: 'Próximas designações', seeAgenda: 'Ver agenda', aug: 'AGO', confirmed: 'Confirmada', treasures: 'Pérolas Espirituais', midweekMeeting: 'Reunião do meio da semana', openDetails: 'Ver detalhes', addCalendar: 'Adicionar ao calendário', awaiting: 'Aguardando confirmação', audio: 'Áudio', weekendMeeting: 'Reunião do fim de semana', confirm: 'Confirmar', cantDo: 'Não posso', smartEyebrow: 'Smart Assign', smartTitle: 'Equilíbrio da Escola', smartText: 'Há irmãos elegíveis que não recebem uma leitura há bastante mais tempo do que a média.', eligibleReading: 'Elegível para leitura', days: 'dias', generateBalanced: 'Gerar proposta equilibrada', humanDecision: 'O sistema recomenda. O responsável decide.', weekEyebrow: 'Esta semana', weekTitle: 'Cobertura da reunião', almostReady: 'Quase pronta', sound: 'Som', video: 'Vídeo', microphone1: 'Microfone 1', attendant2: 'Indicador 2', notAssigned: 'Ainda sem designação', resolve: 'Resolver', agendaEyebrow: 'Calendário pessoal', agendaTitle: 'Agenda', agendaSubtitle: 'Designações, reuniões e tarefas numa única linha temporal.', syncCalendar: 'Sincronizar calendário', info: 'Informação', fieldService: 'Serviço de campo', groupMeeting: 'Saída do grupo 2', assignmentsEyebrow: 'Planeamento inteligente', assignmentsTitle: 'Designações', assignmentsSubtitle: 'Histórico, disponibilidade e equilíbrio visíveis antes de decidir.', generateSchedule: 'Gerar setembro', example: 'Exemplo', candidateTitle: 'Leitura da Bíblia — candidatos', decisionSupport: 'Apoio à decisão', person: 'Pessoa', lastReading: 'Última leitura', daysWithout: 'Dias sem leitura', assignments90: 'Designações 90d', availability: 'Disponível', recommendation: 'Recomendação', yes: 'Sim', whyCarlos: 'Por que Carlos aparece primeiro?', whyCarlosText: 'Está elegível, disponível, sem conflito nessa semana e é quem está há mais tempo sem esta designação entre os candidatos apresentados.', peopleEyebrow: 'Diretório', peopleTitle: 'Pessoas', peopleSubtitle: 'Informação operacional com permissões e auditoria.', addPerson: 'Adicionar pessoa', group1: 'Grupo 1', group2: 'Grupo 2', group3: 'Grupo 3', student: 'Estudante', av: 'AV', microphones: 'Microfones', settingsEyebrow: 'Só para ti', settingsTitle: 'Preferências', settingsSubtitle: 'Estas opções não alteram a experiência dos outros utilizadores.', language: 'Idioma', appLanguage: 'Idioma da aplicação', languageHelp: 'Independente do idioma definido para a congregação.', appearance: 'Aparência', theme: 'Tema', light: 'Claro', dark: 'Escuro', system: 'Sistema', accent: 'Cor de destaque', reading: 'Leitura e conforto', textSize: 'Tamanho do texto', normal: 'Normal', readableFont: 'Fonte de alta legibilidade', readableFontHelp: 'Mais espaço entre letras e linhas.', highContrast: 'Contraste elevado', highContrastHelp: 'Reforça bordas e contraste visual.', interaction: 'Interação', reducedMotion: 'Reduzir movimento', reducedMotionHelp: 'Evita animações não essenciais.', density: 'Densidade', comfortable: 'Confortável', compact: 'Compacta', previewTitle: 'Módulo em protótipo', previewText: 'Esta área fará parte da PWA completa. O preview concentra-se primeiro na experiência, acessibilidade e Smart Assign.', backHome: 'Voltar ao início', proposalTitle: 'Proposta para setembro', assignmentsCreated: 'designações propostas', conflicts: 'conflitos', balance: 'equilíbrio', proposalCarlos: 'Leitura — 15/09 · 126 dias desde a última leitura · sem conflitos', proposalAndre: 'Leitura — 29/09 · 98 dias projetados · nenhuma outra designação na semana', why: 'Por quê?', transparentReasons: 'Razões transparentes', transparentReasonsText: 'Elegibilidade e disponibilidade são regras obrigatórias. A ordenação usa histórico e carga para ajudar o responsável, nunca para decidir qualificação espiritual.', cancel: 'Cancelar', reviewDraft: 'Rever proposta completa', quickSearch: 'Pesquisa rápida', search: 'Pesquisar', searchPersonHint: 'Pessoa · Grupo 2 · últimas designações', audioSeptember: 'Áudio · setembro', searchScheduleHint: 'Programa · 4 semanas', toastSaved: 'Preferência guardada.', toastPrototype: 'Esta ação é apenas demonstrativa no preview.', toastConfirmed: 'Designação confirmada no protótipo.', toastMeeting: 'Verificação concluída: 1 confirmação pendente e 1 função por preencher.', toastDraft: 'Proposta gerada. Nenhuma alteração real foi publicada.', pageAgenda: 'Agenda', pageAssignments: 'Designações', pagePeople: 'Pessoas', pageSettings: 'Preferências', pageService: 'Serviço', pageTerritories: 'Territórios', pageReports: 'Relatórios', pageReview: 'Review Center', textSmall: 'Pequeno', textNormal: 'Normal', textLarge: 'Grande'
    },
    en: {
      tagline: 'Everything in good order.', navHome: 'Home', navAgenda: 'Agenda', navAssignments: 'Assignments', navPeople: 'People', navService: 'Service', navTerritories: 'Territories', navReports: 'Reports', navSettings: 'Preferences', privacyLabel: 'Privacy first', congregation: 'Example Congregation', homeTitle: 'Today', welcomeEyebrow: 'Wednesday, 19 August', welcomeTitle: 'Everything that needs your attention.', welcomeSubtitle: 'No hunting through menus. Eutaktos brings forward what matters now.', prepareMeeting: 'Prepare next meeting', pendingConfirmations: 'Awaiting confirmation', pendingConfirmationsSub: 'assignments', needsReplacement: 'Needs replacement', needsReplacementSub: 'this week', missingReports: 'Missing reports', missingReportsSub: 'current month', reviewSuggestions: 'Review suggestions', reviewSuggestionsSub: 'restricted access', nextEyebrow: 'Up next', nextTitle: 'Upcoming assignments', seeAgenda: 'View agenda', aug: 'AUG', confirmed: 'Confirmed', treasures: 'Spiritual Gems', midweekMeeting: 'Midweek meeting', openDetails: 'View details', addCalendar: 'Add to calendar', awaiting: 'Awaiting confirmation', audio: 'Audio', weekendMeeting: 'Weekend meeting', confirm: 'Confirm', cantDo: 'I cannot do it', smartEyebrow: 'Smart Assign', smartTitle: 'School balance', smartText: 'Some eligible brothers have gone significantly longer than average without a reading assignment.', eligibleReading: 'Eligible for reading', days: 'days', generateBalanced: 'Generate balanced draft', humanDecision: 'The system recommends. The responsible brother decides.', weekEyebrow: 'This week', weekTitle: 'Meeting coverage', almostReady: 'Almost ready', sound: 'Sound', video: 'Video', microphone1: 'Microphone 1', attendant2: 'Attendant 2', notAssigned: 'Not assigned yet', resolve: 'Resolve', agendaEyebrow: 'Personal calendar', agendaTitle: 'Agenda', agendaSubtitle: 'Assignments, meetings and tasks in one timeline.', syncCalendar: 'Sync calendar', info: 'Information', fieldService: 'Field service', groupMeeting: 'Group 2 meeting', assignmentsEyebrow: 'Intelligent planning', assignmentsTitle: 'Assignments', assignmentsSubtitle: 'History, availability and balance visible before you decide.', generateSchedule: 'Generate September', example: 'Example', candidateTitle: 'Bible Reading — candidates', decisionSupport: 'Decision support', person: 'Person', lastReading: 'Last reading', daysWithout: 'Days since reading', assignments90: 'Assignments 90d', availability: 'Available', recommendation: 'Recommendation', yes: 'Yes', whyCarlos: 'Why is Carlos first?', whyCarlosText: 'He is eligible, available, has no conflict that week and has gone the longest without this assignment among the candidates shown.', peopleEyebrow: 'Directory', peopleTitle: 'People', peopleSubtitle: 'Operational information with permissions and audit history.', addPerson: 'Add person', group1: 'Group 1', group2: 'Group 2', group3: 'Group 3', student: 'Student', av: 'AV', microphones: 'Microphones', settingsEyebrow: 'Just for you', settingsTitle: 'Preferences', settingsSubtitle: 'These options do not change anyone else’s experience.', language: 'Language', appLanguage: 'App language', languageHelp: 'Independent from the congregation language.', appearance: 'Appearance', theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System', accent: 'Accent color', reading: 'Reading comfort', textSize: 'Text size', normal: 'Normal', readableFont: 'High-readability font', readableFontHelp: 'More spacing between letters and lines.', highContrast: 'High contrast', highContrastHelp: 'Strengthens borders and visual contrast.', interaction: 'Interaction', reducedMotion: 'Reduce motion', reducedMotionHelp: 'Avoids non-essential animation.', density: 'Density', comfortable: 'Comfortable', compact: 'Compact', previewTitle: 'Module in prototype', previewText: 'This area will be part of the complete PWA. The preview currently focuses on experience, accessibility and Smart Assign.', backHome: 'Back home', proposalTitle: 'September proposal', assignmentsCreated: 'proposed assignments', conflicts: 'conflicts', balance: 'balance', proposalCarlos: 'Reading — 15/09 · 126 days since last reading · no conflicts', proposalAndre: 'Reading — 29/09 · 98 projected days · no other assignment that week', why: 'Why?', transparentReasons: 'Transparent reasons', transparentReasonsText: 'Eligibility and availability are hard rules. Ranking uses history and workload to assist the responsible brother, never to decide spiritual qualification.', cancel: 'Cancel', reviewDraft: 'Review full proposal', quickSearch: 'Quick search', search: 'Search', searchPersonHint: 'Person · Group 2 · recent assignments', audioSeptember: 'Audio · September', searchScheduleHint: 'Schedule · 4 weeks', toastSaved: 'Preference saved.', toastPrototype: 'This action is demonstrative in the preview.', toastConfirmed: 'Assignment confirmed in the prototype.', toastMeeting: 'Check complete: 1 confirmation pending and 1 role unfilled.', toastDraft: 'Draft generated. No real data was published.', pageAgenda: 'Agenda', pageAssignments: 'Assignments', pagePeople: 'People', pageSettings: 'Preferences', pageService: 'Service', pageTerritories: 'Territories', pageReports: 'Reports', pageReview: 'Review Center', textSmall: 'Small', textNormal: 'Normal', textLarge: 'Large'
    },
    es: {
      tagline: 'Everything in good order.', navHome: 'Inicio', navAgenda: 'Agenda', navAssignments: 'Asignaciones', navPeople: 'Personas', navService: 'Servicio', navTerritories: 'Territorios', navReports: 'Informes', navSettings: 'Preferencias', privacyLabel: 'Privacidad primero', congregation: 'Congregación Ejemplo', homeTitle: 'Hoy', welcomeEyebrow: 'Miércoles, 19 de agosto', welcomeTitle: 'Todo lo que necesita tu atención.', welcomeSubtitle: 'Sin buscar entre muchos menús. Eutaktos muestra primero lo importante.', prepareMeeting: 'Preparar próxima reunión', pendingConfirmations: 'Por confirmar', pendingConfirmationsSub: 'asignaciones', needsReplacement: 'Necesita sustituto', needsReplacementSub: 'esta semana', missingReports: 'Informes pendientes', missingReportsSub: 'mes actual', reviewSuggestions: 'Sugerencias de análisis', reviewSuggestionsSub: 'acceso restringido', nextEyebrow: 'A continuación', nextTitle: 'Próximas asignaciones', seeAgenda: 'Ver agenda', aug: 'AGO', confirmed: 'Confirmada', treasures: 'Perlas espirituales', midweekMeeting: 'Reunión de entre semana', openDetails: 'Ver detalles', addCalendar: 'Añadir al calendario', awaiting: 'Esperando confirmación', audio: 'Audio', weekendMeeting: 'Reunión del fin de semana', confirm: 'Confirmar', cantDo: 'No puedo', smartEyebrow: 'Smart Assign', smartTitle: 'Equilibrio de la Escuela', smartText: 'Hay hermanos elegibles que llevan bastante más tiempo que el promedio sin una lectura.', eligibleReading: 'Elegible para lectura', days: 'días', generateBalanced: 'Generar propuesta equilibrada', humanDecision: 'El sistema recomienda. El responsable decide.', weekEyebrow: 'Esta semana', weekTitle: 'Cobertura de la reunión', almostReady: 'Casi lista', sound: 'Sonido', video: 'Vídeo', microphone1: 'Micrófono 1', attendant2: 'Acomodador 2', notAssigned: 'Aún sin asignar', resolve: 'Resolver', agendaEyebrow: 'Calendario personal', agendaTitle: 'Agenda', agendaSubtitle: 'Asignaciones, reuniones y tareas en una sola línea temporal.', syncCalendar: 'Sincronizar calendario', info: 'Información', fieldService: 'Servicio del campo', groupMeeting: 'Salida del grupo 2', assignmentsEyebrow: 'Planificación inteligente', assignmentsTitle: 'Asignaciones', assignmentsSubtitle: 'Historial, disponibilidad y equilibrio visibles antes de decidir.', generateSchedule: 'Generar septiembre', example: 'Ejemplo', candidateTitle: 'Lectura de la Biblia — candidatos', decisionSupport: 'Apoyo a la decisión', person: 'Persona', lastReading: 'Última lectura', daysWithout: 'Días sin lectura', assignments90: 'Asignaciones 90d', availability: 'Disponible', recommendation: 'Recomendación', yes: 'Sí', whyCarlos: '¿Por qué Carlos aparece primero?', whyCarlosText: 'Está habilitado, disponible, sin conflicto esa semana y es quien lleva más tiempo sin esta asignación entre los candidatos mostrados.', peopleEyebrow: 'Directorio', peopleTitle: 'Personas', peopleSubtitle: 'Información operativa con permisos y auditoría.', addPerson: 'Añadir persona', group1: 'Grupo 1', group2: 'Grupo 2', group3: 'Grupo 3', student: 'Estudiante', av: 'AV', microphones: 'Micrófonos', settingsEyebrow: 'Solo para ti', settingsTitle: 'Preferencias', settingsSubtitle: 'Estas opciones no cambian la experiencia de los demás usuarios.', language: 'Idioma', appLanguage: 'Idioma de la aplicación', languageHelp: 'Independiente del idioma de la congregación.', appearance: 'Apariencia', theme: 'Tema', light: 'Claro', dark: 'Oscuro', system: 'Sistema', accent: 'Color de acento', reading: 'Lectura y comodidad', textSize: 'Tamaño del texto', normal: 'Normal', readableFont: 'Fuente de alta legibilidad', readableFontHelp: 'Más espacio entre letras y líneas.', highContrast: 'Contraste alto', highContrastHelp: 'Refuerza bordes y contraste visual.', interaction: 'Interacción', reducedMotion: 'Reducir movimiento', reducedMotionHelp: 'Evita animaciones no esenciales.', density: 'Densidad', comfortable: 'Cómoda', compact: 'Compacta', previewTitle: 'Módulo en prototipo', previewText: 'Esta área formará parte de la PWA completa. El preview se centra primero en experiencia, accesibilidad y Smart Assign.', backHome: 'Volver al inicio', proposalTitle: 'Propuesta para septiembre', assignmentsCreated: 'asignaciones propuestas', conflicts: 'conflictos', balance: 'equilibrio', proposalCarlos: 'Lectura — 15/09 · 126 días desde la última lectura · sin conflictos', proposalAndre: 'Lectura — 29/09 · 98 días proyectados · ninguna otra asignación esa semana', why: '¿Por qué?', transparentReasons: 'Razones transparentes', transparentReasonsText: 'Elegibilidad y disponibilidad son reglas obligatorias. La ordenación usa historial y carga para ayudar al responsable, nunca para decidir cualificación espiritual.', cancel: 'Cancelar', reviewDraft: 'Revisar propuesta completa', quickSearch: 'Búsqueda rápida', search: 'Buscar', searchPersonHint: 'Persona · Grupo 2 · asignaciones recientes', audioSeptember: 'Audio · septiembre', searchScheduleHint: 'Programa · 4 semanas', toastSaved: 'Preferencia guardada.', toastPrototype: 'Esta acción es solo demostrativa en el preview.', toastConfirmed: 'Asignación confirmada en el prototipo.', toastMeeting: 'Comprobación terminada: 1 confirmación pendiente y 1 función sin cubrir.', toastDraft: 'Propuesta generada. No se publicó ningún dato real.', pageAgenda: 'Agenda', pageAssignments: 'Asignaciones', pagePeople: 'Personas', pageSettings: 'Preferencias', pageService: 'Servicio', pageTerritories: 'Territorios', pageReports: 'Informes', pageReview: 'Review Center', textSmall: 'Pequeño', textNormal: 'Normal', textLarge: 'Grande'
    }
  };

  const defaults = {
    language: 'pt-PT', theme: 'system', accent: 'green', textSize: 'normal', readableFont: false, highContrast: false, reducedMotion: false, density: 'comfortable'
  };

  const loadPreferences = () => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return { ...defaults }; }
  };

  let prefs = loadPreferences();
  let activeView = 'home';
  let toastTimer = null;

  const t = (key) => translations[prefs.language]?.[key] || translations['pt-PT'][key] || key;

  function savePreferences() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function applyTranslations() {
    document.documentElement.lang = prefs.language;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      if (translations[prefs.language]?.[key]) node.textContent = translations[prefs.language][key];
    });
    updatePageTitle(activeView);
    updateTextSizeOutput();
  }

  function applyPreferences() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.accent = prefs.accent;
    root.dataset.textSize = prefs.textSize;
    root.dataset.readableFont = String(prefs.readableFont);
    root.dataset.contrast = prefs.highContrast ? 'high' : 'normal';
    root.dataset.reducedMotion = String(prefs.reducedMotion);
    root.dataset.density = prefs.density;

    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.classList.toggle('is-selected', button.dataset.themeChoice === prefs.theme));
    document.querySelectorAll('[data-density-choice]').forEach((button) => button.classList.toggle('is-selected', button.dataset.densityChoice === prefs.density));
    document.querySelectorAll('[data-accent]').forEach((button) => button.classList.toggle('is-selected', button.dataset.accent === prefs.accent));

    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) languageSelect.value = prefs.language;
    const size = document.getElementById('textSize');
    if (size) size.value = ({ small: 0, normal: 1, large: 2 })[prefs.textSize];
    const readable = document.getElementById('readableFont');
    if (readable) readable.checked = prefs.readableFont;
    const contrast = document.getElementById('highContrast');
    if (contrast) contrast.checked = prefs.highContrast;
    const motion = document.getElementById('reducedMotion');
    if (motion) motion.checked = prefs.reducedMotion;

    applyTranslations();
  }

  function updateTextSizeOutput() {
    const output = document.getElementById('textSizeValue');
    if (!output) return;
    const key = prefs.textSize === 'small' ? 'textSmall' : prefs.textSize === 'large' ? 'textLarge' : 'textNormal';
    output.textContent = t(key);
  }

  function updatePageTitle(view) {
    const title = document.getElementById('page-title');
    const map = { home: 'homeTitle', agenda: 'pageAgenda', assignments: 'pageAssignments', people: 'pagePeople', settings: 'pageSettings', service: 'pageService', territories: 'pageTerritories', reports: 'pageReports', review: 'pageReview' };
    if (title) title.textContent = t(map[view] || 'homeTitle');
    document.title = `${title?.textContent || 'Eutaktos'} — Eutaktos Preview`;
  }

  function switchView(view, pushHash = true) {
    activeView = view;
    const targetId = supportedViews.has(view) ? `view-${view}` : 'view-placeholder';
    document.querySelectorAll('.view').forEach((node) => node.classList.toggle('is-visible', node.id === targetId));
    document.querySelectorAll('[data-view]').forEach((button) => {
      const isCurrent = button.dataset.view === view;
      button.classList.toggle('is-active', isCurrent);
      if (isCurrent) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (placeholderViews.has(view)) {
      const heading = document.getElementById('placeholder-heading');
      if (heading) heading.textContent = t({ service: 'pageService', territories: 'pageTerritories', reports: 'pageReports', review: 'pageReview' }[view]);
    }
    updatePageTitle(view);
    if (pushHash) history.replaceState(null, '', `#${view}`);
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefs.reducedMotion ? 'auto' : 'smooth' });
  }

  function wireNavigation() {
    document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    document.querySelectorAll('[data-view-jump]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewJump)));
    document.querySelectorAll('[data-target]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.target)));
  }

  function wirePreferences() {
    document.getElementById('languageSelect')?.addEventListener('change', (event) => {
      prefs.language = event.target.value;
      savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    });
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => {
      prefs.theme = button.dataset.themeChoice; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    }));
    document.querySelectorAll('[data-density-choice]').forEach((button) => button.addEventListener('click', () => {
      prefs.density = button.dataset.densityChoice; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    }));
    document.querySelectorAll('[data-accent]').forEach((button) => button.addEventListener('click', () => {
      prefs.accent = button.dataset.accent; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    }));
    document.getElementById('textSize')?.addEventListener('input', (event) => {
      prefs.textSize = ({ 0: 'small', 1: 'normal', 2: 'large' })[event.target.value];
      savePreferences(); applyPreferences();
    });
    document.getElementById('readableFont')?.addEventListener('change', (event) => {
      prefs.readableFont = event.target.checked; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    });
    document.getElementById('highContrast')?.addEventListener('change', (event) => {
      prefs.highContrast = event.target.checked; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    });
    document.getElementById('reducedMotion')?.addEventListener('change', (event) => {
      prefs.reducedMotion = event.target.checked; savePreferences(); applyPreferences(); showToast(t('toastSaved'));
    });
  }

  function wirePrototypeActions() {
    const smartDialog = document.getElementById('smartDialog');
    ['openSmartAssign', 'openSmartAssign2'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => smartDialog?.showModal()));
    document.getElementById('acceptDraft')?.addEventListener('click', () => showToast(t('toastDraft')));
    document.querySelectorAll('[data-i18n="why"]').forEach((button) => button.addEventListener('click', () => document.getElementById('dialogExplanation')?.scrollIntoView({ behavior: prefs.reducedMotion ? 'auto' : 'smooth', block: 'center' })));
    document.getElementById('prepareMeeting')?.addEventListener('click', () => showToast(t('toastMeeting')));

    document.querySelectorAll('.assignment-card .button').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.i18n === 'confirm') {
          const card = button.closest('.assignment-card');
          const badge = card?.querySelector('.badge');
          if (badge) { badge.className = 'badge success'; badge.dataset.i18n = 'confirmed'; badge.textContent = t('confirmed'); }
          showToast(t('toastConfirmed'));
        } else showToast(t('toastPrototype'));
      });
    });

    document.querySelectorAll('.section-heading .button, .people-grid .icon-button, .coverage-row .text-button').forEach((button) => button.addEventListener('click', () => showToast(t('toastPrototype'))));

    const searchDialog = document.getElementById('searchDialog');
    const searchInput = document.getElementById('searchInput');
    document.getElementById('quickSearch')?.addEventListener('click', () => { searchDialog?.showModal(); setTimeout(() => searchInput?.focus(), 30); });
    document.addEventListener('keydown', (event) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) { event.preventDefault(); searchDialog?.showModal(); setTimeout(() => searchInput?.focus(), 30); }
    });

    searchInput?.addEventListener('input', (event) => {
      const query = event.target.value.toLocaleLowerCase(prefs.language).trim();
      document.querySelectorAll('.search-results button').forEach((button) => button.hidden = query && !button.textContent.toLocaleLowerCase(prefs.language).includes(query));
    });
  }

  function initFromHash() {
    const requested = location.hash.replace('#', '');
    if (supportedViews.has(requested) || placeholderViews.has(requested)) activeView = requested;
    switchView(activeView, false);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  applyPreferences();
  wireNavigation();
  wirePreferences();
  wirePrototypeActions();
  initFromHash();
  registerServiceWorker();
})();
