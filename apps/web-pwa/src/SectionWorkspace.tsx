import BellOutlined from '@ant-design/icons/es/icons/BellOutlined';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Dropdown from 'antd/es/dropdown';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AccessManagementDialog } from './AccessManagementDialog';
import { AuditHistoryDialog } from './AuditHistoryDialog';
import { HouseholdsSection } from './HouseholdsSection';
import { HourglassImportInspector } from './HourglassImportInspector';
import { MidweekWorkspace } from './MidweekWorkspace';
import { PeopleArchiveDialog } from './PeopleArchiveDialog';
import { PeopleContactListDialog } from './PeopleContactListDialog';
import { PeopleDirectory } from './PeopleDirectory';
import { PeopleRecordCardsDialog } from './PeopleRecordCardsDialog';
import { PeopleRemindersDialog } from './PeopleRemindersDialog';
import { PeopleTransfersDialog } from './PeopleTransfersDialog';
import { ResponsibilitiesSection } from './ResponsibilitiesSection';
import { ServiceGroupsSection } from './ServiceGroupsSection';
import type { Locale } from './lib/preferences';
import { sessionApi } from './lib/sessionApi';
import {
  peopleWorkspaceProfileRefFromSearch,
  peopleWorkspaceSearchForProfile,
  peopleWorkspaceSearchForView,
  peopleWorkspaceViewFromSearch,
  type PeopleWorkspaceView,
} from './lib/peopleWorkspaceRoute';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';

interface SectionWorkspaceProps { locale: Locale; section: WorkspaceSection }
type NavigablePeopleView = Exclude<PeopleWorkspaceView, 'profile'>;

const PeopleOverview = lazy(async () => {
  const module = await import('./PeopleOverview');
  return { default: module.PeopleOverview };
});

const PeopleAssistancePanel = lazy(async () => {
  const module = await import('./PeopleAssistancePanel');
  return { default: module.PeopleAssistancePanel };
});

const PersonProfile = lazy(async () => {
  const module = await import('./PersonProfile');
  return { default: module.PersonProfile };
});

const PersonRecommendationInsight = lazy(async () => {
  const module = await import('./PersonRecommendationInsight');
  return { default: module.PersonRecommendationInsight };
});

const PeopleMapSection = lazy(async () => {
  const module = await import('./PeopleMapSection');
  return { default: module.PeopleMapSection };
});

const copy = {
  'pt-PT': { organization: 'Organização', organizationTitle: 'Pessoas e organização', organizationSubtitle: 'Mantém perfis, agregados, grupos, responsabilidades, ausências e permissões no mesmo contexto.', overview: 'Visão geral', directory: 'Diretório', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', map: 'Mapa', mapLoading: 'A carregar mapa…', tools: 'Ferramentas', transfers: 'Transferências', reminders: 'Lembretes', archive: 'Arquivo / A não publicar', contactList: 'Lista de contactos', recordCards: 'Cartões / Registos', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglass: 'Inspecionar export Hourglass', overviewLoading: 'A carregar Pessoas…', profileLoading: 'A carregar perfil…' },
  en: { organization: 'Organization', organizationTitle: 'People and organization', organizationSubtitle: 'Keep profiles, households, groups, responsibilities, away periods and permissions in the same context.', overview: 'Overview', directory: 'Directory', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', map: 'Map', mapLoading: 'Loading map…', tools: 'Tools', transfers: 'Transfers', reminders: 'Reminders', archive: 'Archive / Do not publish', contactList: 'Contact list', recordCards: 'Record cards / Reports', audit: 'Audit history', access: 'Manage access', hourglass: 'Inspect Hourglass export', overviewLoading: 'Loading People…', profileLoading: 'Loading profile…' },
  es: { organization: 'Organización', organizationTitle: 'Personas y organización', organizationSubtitle: 'Mantén perfis, grupos familiares, grupos, responsabilidades, ausencias y permisos en el mismo contexto.', overview: 'Vista general', directory: 'Directorio', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', map: 'Mapa', mapLoading: 'Cargando mapa…', tools: 'Herramientas', transfers: 'Transferencias', reminders: 'Recordatorios', archive: 'Archivo / No publicar', contactList: 'Lista de contactos', recordCards: 'Tarjetas / Registros', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglass: 'Inspeccionar exportación Hourglass', overviewLoading: 'Cargando Personas…', profileLoading: 'Cargando perfil…' },
} as const;

function peopleViewFromLocation(): PeopleWorkspaceView {
  return peopleWorkspaceViewFromSearch(window.location.search);
}

function profileRefFromLocation(): string | undefined {
  return peopleWorkspaceProfileRefFromSearch(window.location.search);
}

function pushPeopleSearch(search: string, state: Readonly<Record<string, unknown>>): void {
  const target = `${window.location.pathname}${search}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target !== current) window.history.pushState(state, '', target);
}

function pushPeopleView(next: NavigablePeopleView): void {
  pushPeopleSearch(peopleWorkspaceSearchForView(window.location.search, next), { peopleView: next });
}

function pushPersonProfile(personRef: string): void {
  pushPeopleSearch(peopleWorkspaceSearchForProfile(window.location.search, personRef), { peopleView: 'profile' });
}

function LoadingSurface({ label, compact = false }: { label: string; compact?: boolean }) {
  return <section role="status" aria-live="polite" style={{ paddingBlock: compact ? 16 : 32 }}>
    <Typography.Text type="secondary">{label}</Typography.Text>
  </section>;
}

function OrganizationWorkspace({ locale }: { locale: Locale }) {
  const [view, setView] = useState<PeopleWorkspaceView>(peopleViewFromLocation);
  const [profileRef, setProfileRef] = useState<string | undefined>(profileRefFromLocation);
  const [profileRefresh, setProfileRefresh] = useState(0);
  const [createRequest, setCreateRequest] = useState(0);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [contactListOpen, setContactListOpen] = useState(false);
  const [recordCardsOpen, setRecordCardsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [hourglassOpen, setHourglassOpen] = useState(false);
  const [canReadMap, setCanReadMap] = useState(false);
  const toolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const auditButtonRef = useRef<HTMLButtonElement | null>(null);
  const accessButtonRef = useRef<HTMLButtonElement | null>(null);
  const text = copy[locale];
  const views: readonly NavigablePeopleView[] = [
    'overview',
    'directory',
    ...(canReadMap ? ['map' as const] : []),
    'households',
    'groups',
    'responsibilities',
  ];
  const labels: Record<NavigablePeopleView, string> = { overview: text.overview, directory: text.directory, map: text.map, households: text.households, groups: text.groups, responsibilities: text.responsibilities };

  useEffect(() => {
    const onPopState = () => {
      setView(peopleViewFromLocation());
      setProfileRef(profileRefFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void sessionApi.current(controller.signal).then(session => {
      if (!controller.signal.aborted) setCanReadMap(session.capabilities.includes('map.read'));
    }).catch(() => {
      if (!controller.signal.aborted) setCanReadMap(false);
    });
    return () => controller.abort();
  }, []);

  const selectView = (next: NavigablePeopleView) => {
    pushPeopleView(next);
    setProfileRef(undefined);
    setView(next);
  };

  const openProfile = (personRef: string) => {
    pushPersonProfile(personRef);
    setProfileRef(personRef);
    setProfileRefresh(0);
    setView('profile');
  };

  const openCreate = () => {
    pushPeopleView('directory');
    setProfileRef(undefined);
    setView('directory');
    window.requestAnimationFrame(() => setCreateRequest(current => current + 1));
  };

  const restoreToolsFocus = () => window.requestAnimationFrame(() => toolsButtonRef.current?.focus());

  if (view === 'overview') return <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
    <Suspense fallback={<LoadingSurface label={text.overviewLoading} />}>
      <PeopleOverview locale={locale} onOpenDirectory={() => selectView('directory')} onAddPerson={openCreate} />
    </Suspense>
    <Suspense fallback={<LoadingSurface label={text.overviewLoading} compact />}>
      <PeopleAssistancePanel locale={locale} />
    </Suspense>
  </Space>;

  const navView: NavigablePeopleView = view === 'profile' ? 'directory' : view;

  return <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
    <Card aria-labelledby="organization-title">
      <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760, minWidth: 0, flex: '1 1 420px' }}>
            <Typography.Text type="secondary" strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>{text.organization}</Typography.Text>
            <Typography.Title level={2} id="organization-title" style={{ marginBlock: '4px 0' }}>{text.organizationTitle}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 0 }}>{text.organizationSubtitle}</Typography.Paragraph>
          </div>
          <Space wrap>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'transfers', label: text.transfers },
                  { key: 'reminders', icon: <BellOutlined />, label: text.reminders },
                  { key: 'archive', label: text.archive },
                  { key: 'contact-list', label: text.contactList },
                  { key: 'record-cards', label: text.recordCards },
                  { key: 'hourglass', label: text.hourglass },
                ],
                onClick: ({ key }) => {
                  if (key === 'transfers') setTransfersOpen(true);
                  if (key === 'reminders') setRemindersOpen(true);
                  if (key === 'archive') setArchiveOpen(true);
                  if (key === 'contact-list') setContactListOpen(true);
                  if (key === 'record-cards') setRecordCardsOpen(true);
                  if (key === 'hourglass') setHourglassOpen(true);
                },
              }}
            >
              <Button ref={toolsButtonRef}>{text.tools}</Button>
            </Dropdown>
            <Button ref={auditButtonRef} onClick={() => setAuditOpen(true)}>{text.audit}</Button>
            <Button ref={accessButtonRef} onClick={() => setAccessOpen(true)}>{text.access}</Button>
          </Space>
        </div>
        <Divider style={{ marginBlock: 0 }} />
        <nav aria-label={text.organizationTitle}>
          <Space wrap size="small">
            {views.map(item => <Button key={item} type={navView === item ? 'primary' : 'text'} aria-current={navView === item ? 'page' : undefined} onClick={() => selectView(item)}>{labels[item]}</Button>)}
          </Space>
        </nav>
      </Space>
    </Card>
    {view === 'directory' ? <PeopleDirectory locale={locale} createRequest={createRequest} onOpenProfile={openProfile} /> : null}
    {view === 'map' ? <Suspense fallback={<LoadingSurface label={text.mapLoading} />}><PeopleMapSection locale={locale} /></Suspense> : null}
    {view === 'profile' && profileRef ? <Suspense fallback={<LoadingSurface label={text.profileLoading} />}><Space key={`${profileRef}:${profileRefresh}`} orientation="vertical" size="large" style={{ display: 'flex' }}><PersonProfile personId={profileRef} locale={locale} onBack={() => selectView('directory')} /><PersonRecommendationInsight personId={profileRef} locale={locale} /></Space></Suspense> : null}
    {view === 'households' ? <HouseholdsSection locale={locale} /> : null}
    {view === 'groups' ? <ServiceGroupsSection locale={locale} /> : null}
    {view === 'responsibilities' ? <ResponsibilitiesSection locale={locale} /> : null}
    <PeopleTransfersDialog locale={locale} open={transfersOpen} onClose={() => { setTransfersOpen(false); restoreToolsFocus(); }} />
    <PeopleRemindersDialog locale={locale} open={remindersOpen} onClose={() => { setRemindersOpen(false); restoreToolsFocus(); }} />
    <PeopleArchiveDialog locale={locale} open={archiveOpen} initialPersonId={view === 'profile' ? profileRef : undefined} onChanged={personId => { if (view === 'profile' && profileRef === personId) setProfileRefresh(current => current + 1); }} onClose={() => { setArchiveOpen(false); }} onAfterClose={restoreToolsFocus} />
    <PeopleContactListDialog locale={locale} open={contactListOpen} onClose={() => { setContactListOpen(false); restoreToolsFocus(); }} />
    <PeopleRecordCardsDialog locale={locale} open={recordCardsOpen} onClose={() => { setRecordCardsOpen(false); restoreToolsFocus(); }} />
    <AuditHistoryDialog locale={locale} open={auditOpen} onClose={() => { setAuditOpen(false); window.requestAnimationFrame(() => auditButtonRef.current?.focus()); }} />
    <AccessManagementDialog locale={locale} open={accessOpen} onClose={() => { setAccessOpen(false); window.requestAnimationFrame(() => accessButtonRef.current?.focus()); }} />
    <HourglassImportInspector locale={locale} open={hourglassOpen} onClose={() => { setHourglassOpen(false); restoreToolsFocus(); }} />
  </Space>;
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  if (section === 'people') return <OrganizationWorkspace locale={locale} />;
  if (section === 'agenda' || section === 'assignments') return <MidweekWorkspace locale={locale} section={section} />;

  const content = getWorkspaceCopy(locale, section);
  return <section aria-labelledby={`section-${section}-title`}>
    <Card>
      <Typography.Text type="secondary" strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>{content.eyebrow}</Typography.Text>
      <Typography.Title level={2} id={`section-${section}-title`}>{content.title}</Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 0 }}>{content.subtitle}</Typography.Paragraph>
    </Card>
  </section>;
}
