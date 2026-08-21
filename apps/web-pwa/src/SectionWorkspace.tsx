import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Divider, Paper } from '@mui/material';
import { AccessManagementDialog } from './AccessManagementDialog';
import { AuditHistoryDialog } from './AuditHistoryDialog';
import { HouseholdsSection } from './HouseholdsSection';
import { PeopleDirectory } from './PeopleDirectory';
import { ResponsibilitiesSection } from './ResponsibilitiesSection';
import { ServiceGroupsSection } from './ServiceGroupsSection';
import type { Locale } from './lib/preferences';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';
import { Stack, Typography } from './ui/MuiCompat';

interface SectionWorkspaceProps { locale: Locale; section: WorkspaceSection }
type OrganizationView = 'people' | 'households' | 'groups' | 'responsibilities';

const copy = {
  'pt-PT': { organization: 'Organização', organizationTitle: 'Pessoas e organização', organizationSubtitle: 'Mantém perfis, agregados, grupos, responsabilidades, ausências e permissões no mesmo contexto.', people: 'Pessoas', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', audit: 'Histórico de auditoria', access: 'Gerir acessos', preview: 'Pré-visualização', previewDetail: 'Esta área prepara o fluxo para o Scheduling Core. As ações só aparecem quando existe um percurso funcional disponível.', schedule: 'Agenda', assignments: 'Designações' },
  en: { organization: 'Organization', organizationTitle: 'People and organization', organizationSubtitle: 'Keep profiles, households, groups, responsibilities, absences and permissions in the same context.', people: 'People', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', audit: 'Audit history', access: 'Manage access', preview: 'Preview', previewDetail: 'This area prepares the flow for Scheduling Core. Actions appear only when a functional journey is available.', schedule: 'Agenda', assignments: 'Assignments' },
  es: { organization: 'Organización', organizationTitle: 'Personas y organización', organizationSubtitle: 'Mantén perfiles, grupos familiares, grupos, responsabilidades, ausencias y permisos en el mismo contexto.', people: 'Personas', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', audit: 'Historial de auditoría', access: 'Gestionar accesos', preview: 'Previsualización', previewDetail: 'Esta área prepara el flujo para Scheduling Core. Las acciones aparecen solo cuando existe un recorrido funcional disponible.', schedule: 'Agenda', assignments: 'Asignaciones' },
} as const;

function OrganizationWorkspace({ locale }: { locale: Locale }) {
  const [view, setView] = useState<OrganizationView>('people');
  const [auditOpen, setAuditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const text = copy[locale];
  const views: readonly OrganizationView[] = ['people', 'households', 'groups', 'responsibilities'];
  const labels: Record<OrganizationView, string> = { people: text.people, households: text.households, groups: text.groups, responsibilities: text.responsibilities };

  return <Stack spacing={2}>
    <Paper component="section" aria-labelledby="organization-title" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={2.25}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}>
          <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.organization}</Typography><Typography variant="h2" id="organization-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.organizationTitle}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.organizationSubtitle}</Typography></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}><Button variant="outlined" onClick={() => setAuditOpen(true)}>{text.audit}</Button><Button variant="outlined" onClick={() => setAccessOpen(true)}>{text.access}</Button></Stack>
        </Stack>
        <Divider />
        <Stack component="nav" aria-label={text.organizationTitle} direction="row" gap={0.75} flexWrap="wrap" useFlexGap>{views.map(item => <Button key={item} variant={view === item ? 'contained' : 'text'} aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>{labels[item]}</Button>)}</Stack>
      </Stack>
    </Paper>
    {view === 'people' ? <PeopleDirectory locale={locale} /> : null}
    {view === 'households' ? <HouseholdsSection locale={locale} /> : null}
    {view === 'groups' ? <ServiceGroupsSection locale={locale} /> : null}
    {view === 'responsibilities' ? <ResponsibilitiesSection locale={locale} /> : null}
    <AuditHistoryDialog locale={locale} open={auditOpen} onClose={() => setAuditOpen(false)} />
    <AccessManagementDialog locale={locale} open={accessOpen} onClose={() => setAccessOpen(false)} />
  </Stack>;
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  if (section === 'people') return <OrganizationWorkspace locale={locale} />;
  const content = getWorkspaceCopy(locale, section);
  const text = copy[locale];
  const title = section === 'agenda' ? text.schedule : text.assignments;

  return <Box component="section" aria-labelledby={`section-${section}-title`}>
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
        <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.preview}</Typography><Typography variant="h2" id={`section-${section}-title`} sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{content.subtitle}</Typography></Box><Chip label={text.preview} variant="outlined" color="info" />
      </Stack>
      <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}><Typography variant="body2" color="text.secondary">{text.previewDetail}</Typography></Paper>
    </Paper>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {content.cards.map((card, index) => <Card component="article" key={`${section}-${index}`}><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}><Box><Typography variant="overline" color="text.secondary">{card.meta}</Typography><Typography variant="h5" fontWeight={750}>{card.title}</Typography></Box>{card.status ? <Chip label={card.status} size="small" variant="outlined" /> : null}</Stack><Typography color="text.secondary">{card.detail}</Typography><Typography variant="caption" color="info.main">{text.preview}</Typography></Stack></CardContent></Card>)}
    </Box>
  </Box>;
}
