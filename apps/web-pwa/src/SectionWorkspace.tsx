import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Box, Button, Divider, Paper } from '@mui/material';
import { AccessManagementDialog } from './AccessManagementDialog';
import { AuditHistoryDialog } from './AuditHistoryDialog';
import { HouseholdsSection } from './HouseholdsSection';
import { HourglassImportInspector } from './HourglassImportInspector';
import { MidweekWorkspace } from './MidweekWorkspace';
import { PeopleDirectory } from './PeopleDirectory';
import { ResponsibilitiesSection } from './ResponsibilitiesSection';
import { ServiceGroupsSection } from './ServiceGroupsSection';
import type { Locale } from './lib/preferences';
import { peopleWorkspaceSearchForView, peopleWorkspaceViewFromSearch, type PeopleWorkspaceView } from './lib/peopleWorkspaceRoute';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';
import { Stack, Typography } from './ui/MuiCompat';

interface SectionWorkspaceProps { locale: Locale; section: WorkspaceSection }

const PeopleOverview = lazy(async () => {
  const module = await import('./PeopleOverview');
  return { default: module.PeopleOverview };
});

const copy = {
  'pt-PT': { organization: 'Organização', organizationTitle: 'Pessoas e organização', organizationSubtitle: 'Mantém perfis, agregados, grupos, responsabilidades, ausências e permissões no mesmo contexto.', overview: 'Visão geral', directory: 'Diretório', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglass: 'Inspecionar export Hourglass', overviewLoading: 'A carregar Pessoas…' },
  en: { organization: 'Organization', organizationTitle: 'People and organization', organizationSubtitle: 'Keep profiles, households, groups, responsibilities, away periods and permissions in the same context.', overview: 'Overview', directory: 'Directory', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', audit: 'Audit history', access: 'Manage access', hourglass: 'Inspect Hourglass export', overviewLoading: 'Loading People…' },
  es: { organization: 'Organización', organizationTitle: 'Personas y organización', organizationSubtitle: 'Mantén perfiles, grupos familiares, grupos, responsabilidades, ausencias y permisos en el mismo contexto.', overview: 'Vista general', directory: 'Directorio', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglass: 'Inspeccionar exportación Hourglass', overviewLoading: 'Cargando Personas…' },
} as const;

function peopleViewFromLocation(): PeopleWorkspaceView {
  return peopleWorkspaceViewFromSearch(window.location.search);
}

function pushPeopleView(next: PeopleWorkspaceView): void {
  const search = peopleWorkspaceSearchForView(window.location.search, next);
  const target = `${window.location.pathname}${search}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target !== current) {
    window.history.pushState({ peopleView: next }, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function OrganizationWorkspace({ locale }: { locale: Locale }) {
  const [view, setView] = useState<PeopleWorkspaceView>(peopleViewFromLocation);
  const [createRequest, setCreateRequest] = useState(0);
  const [auditOpen, setAuditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [hourglassOpen, setHourglassOpen] = useState(false);
  const auditButtonRef = useRef<HTMLButtonElement | null>(null);
  const accessButtonRef = useRef<HTMLButtonElement | null>(null);
  const text = copy[locale];
  const views: readonly PeopleWorkspaceView[] = ['overview', 'directory', 'households', 'groups', 'responsibilities'];
  const labels: Record<PeopleWorkspaceView, string> = { overview: text.overview, directory: text.directory, households: text.households, groups: text.groups, responsibilities: text.responsibilities };

  useEffect(() => {
    const onPopState = () => setView(peopleViewFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectView = (next: PeopleWorkspaceView) => {
    pushPeopleView(next);
    setView(next);
  };

  const openCreate = () => {
    pushPeopleView('directory');
    setView('directory');
    window.requestAnimationFrame(() => setCreateRequest(current => current + 1));
  };

  if (view === 'overview') return <Suspense fallback={<Box component="section" role="status" sx={{ py: 4 }}><Typography color="text.secondary">{text.overviewLoading}</Typography></Box>}><PeopleOverview locale={locale} onOpenDirectory={() => selectView('directory')} onAddPerson={openCreate} /></Suspense>;

  return <Stack spacing={2}>
    <Paper component="section" aria-labelledby="organization-title" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={2.25}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}>
          <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.organization}</Typography><Typography variant="h2" id="organization-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.organizationTitle}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.organizationSubtitle}</Typography></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}><Button variant="outlined" onClick={() => setHourglassOpen(true)}>{text.hourglass}</Button><Button ref={auditButtonRef} variant="outlined" onClick={() => setAuditOpen(true)}>{text.audit}</Button><Button ref={accessButtonRef} variant="outlined" onClick={() => setAccessOpen(true)}>{text.access}</Button></Stack>
        </Stack>
        <Divider />
        <Stack component="nav" aria-label={text.organizationTitle} direction="row" gap={0.75} flexWrap="wrap" useFlexGap>{views.map(item => <Button key={item} variant={view === item ? 'contained' : 'text'} aria-current={view === item ? 'page' : undefined} onClick={() => selectView(item)}>{labels[item]}</Button>)}</Stack>
      </Stack>
    </Paper>
    {view === 'directory' ? <PeopleDirectory locale={locale} createRequest={createRequest} /> : null}
    {view === 'households' ? <HouseholdsSection locale={locale} /> : null}
    {view === 'groups' ? <ServiceGroupsSection locale={locale} /> : null}
    {view === 'responsibilities' ? <ResponsibilitiesSection locale={locale} /> : null}
    <AuditHistoryDialog locale={locale} open={auditOpen} onClose={() => { setAuditOpen(false); window.requestAnimationFrame(() => auditButtonRef.current?.focus()); }} />
    <AccessManagementDialog locale={locale} open={accessOpen} onClose={() => { setAccessOpen(false); window.requestAnimationFrame(() => accessButtonRef.current?.focus()); }} />
    <HourglassImportInspector locale={locale} open={hourglassOpen} onClose={() => setHourglassOpen(false)} />
  </Stack>;
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  if (section === 'people') return <OrganizationWorkspace locale={locale} />;
  if (section === 'agenda' || section === 'assignments') return <MidweekWorkspace locale={locale} section={section} />;

  const content = getWorkspaceCopy(locale, section);
  return <Box component="section" aria-labelledby={`section-${section}-title`}>
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Typography variant="overline" color="primary.main">{content.eyebrow}</Typography>
      <Typography variant="h2" id={`section-${section}-title`} sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{content.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>{content.subtitle}</Typography>
    </Paper>
  </Box>;
}
