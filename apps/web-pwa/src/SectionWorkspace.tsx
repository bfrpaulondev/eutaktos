import { useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper } from '@mui/material';
import { AccessManagementDialog } from './AccessManagementDialog';
import { AuditHistoryDialog } from './AuditHistoryDialog';
import { HouseholdsSection } from './HouseholdsSection';
import { HourglassImportInspector } from './HourglassImportInspector';
import { PeopleDirectory } from './PeopleDirectory';
import { ResponsibilitiesSection } from './ResponsibilitiesSection';
import { ServiceGroupsSection } from './ServiceGroupsSection';
import type { Locale } from './lib/preferences';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';
import { Stack, Typography } from './ui/MuiCompat';

interface SectionWorkspaceProps { locale: Locale; section: WorkspaceSection }
type OrganizationView = 'people' | 'households' | 'groups' | 'responsibilities';

const copy = {
  'pt-PT': {
    organization: 'Organização', organizationTitle: 'Pessoas e organização', organizationSubtitle: 'Mantém perfis, agregados, grupos, responsabilidades, ausências e permissões no mesmo contexto.', people: 'Pessoas', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglass: 'Inspecionar export Hourglass', schedule: 'Agenda', assignments: 'Designações', waitingForRealData: 'A aguardar dados reais', agendaUnavailableTitle: 'Agenda ainda indisponível', agendaUnavailableDetail: 'As reuniões reais serão apresentadas aqui quando a consulta de agenda estiver disponível. Nenhuma reunião demonstrativa é mostrada.', assignmentsUnavailableTitle: 'Gestão de designações ainda indisponível', assignmentsUnavailableDetail: 'As partes, titulares, ajudantes, conflitos e estados reais serão apresentados aqui quando a consulta de designações estiver disponível. Não são apresentadas recomendações nem dados demonstrativos.'
  },
  en: {
    organization: 'Organization', organizationTitle: 'People and organization', organizationSubtitle: 'Keep profiles, households, groups, responsibilities, absences and permissions in the same context.', people: 'People', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', audit: 'Audit history', access: 'Manage access', hourglass: 'Inspect Hourglass export', schedule: 'Agenda', assignments: 'Assignments', waitingForRealData: 'Waiting for real data', agendaUnavailableTitle: 'Agenda is not available yet', agendaUnavailableDetail: 'Real meetings will appear here when the agenda query is available. No demonstration meetings are shown.', assignmentsUnavailableTitle: 'Assignment management is not available yet', assignmentsUnavailableDetail: 'Real parts, assignees, assistants, conflicts and meeting states will appear here when the assignment query is available. No recommendations or demonstration data are shown.'
  },
  es: {
    organization: 'Organización', organizationTitle: 'Personas y organización', organizationSubtitle: 'Mantén perfiles, grupos familiares, grupos, responsabilidades, ausencias y permisos en el mismo contexto.', people: 'Personas', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglass: 'Inspeccionar exportación Hourglass', schedule: 'Agenda', assignments: 'Asignaciones', waitingForRealData: 'Esperando datos reales', agendaUnavailableTitle: 'La Agenda aún no está disponible', agendaUnavailableDetail: 'Las reuniones reales aparecerán aquí cuando esté disponible la consulta de agenda. No se muestran reuniones de demostración.', assignmentsUnavailableTitle: 'La gestión de asignaciones aún no está disponible', assignmentsUnavailableDetail: 'Las partes, titulares, ayudantes, conflictos y estados reales aparecerán aquí cuando esté disponible la consulta de asignaciones. No se muestran recomendaciones ni datos de demostración.'
  },
} as const;

function OrganizationWorkspace({ locale }: { locale: Locale }) {
  const [view, setView] = useState<OrganizationView>('people');
  const [auditOpen, setAuditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [hourglassOpen, setHourglassOpen] = useState(false);
  const text = copy[locale];
  const views: readonly OrganizationView[] = ['people', 'households', 'groups', 'responsibilities'];
  const labels: Record<OrganizationView, string> = { people: text.people, households: text.households, groups: text.groups, responsibilities: text.responsibilities };

  return <Stack spacing={2}>
    <Paper component="section" aria-labelledby="organization-title" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={2.25}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'flex-end' }}>
          <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.organization}</Typography><Typography variant="h2" id="organization-title" sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{text.organizationTitle}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{text.organizationSubtitle}</Typography></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}><Button variant="outlined" onClick={() => setHourglassOpen(true)}>{text.hourglass}</Button><Button variant="outlined" onClick={() => setAuditOpen(true)}>{text.audit}</Button><Button variant="outlined" onClick={() => setAccessOpen(true)}>{text.access}</Button></Stack>
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
    <HourglassImportInspector locale={locale} open={hourglassOpen} onClose={() => setHourglassOpen(false)} />
  </Stack>;
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  if (section === 'people') return <OrganizationWorkspace locale={locale} />;
  const content = getWorkspaceCopy(locale, section);
  const text = copy[locale];
  const title = section === 'agenda' ? text.schedule : text.assignments;
  const unavailableTitle = section === 'agenda' ? text.agendaUnavailableTitle : text.assignmentsUnavailableTitle;
  const unavailableDetail = section === 'agenda' ? text.agendaUnavailableDetail : text.assignmentsUnavailableDetail;

  return <Box component="section" aria-labelledby={`section-${section}-title`}>
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
        <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{content.eyebrow}</Typography><Typography variant="h2" id={`section-${section}-title`} sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{content.subtitle}</Typography></Box><Chip label={text.waitingForRealData} variant="outlined" color="info" />
      </Stack>
    </Paper>
    <Alert severity="info" role="status" aria-live="polite">
      <Typography variant="subtitle2" fontWeight={700}>{unavailableTitle}</Typography>
      <Typography variant="body2">{unavailableDetail}</Typography>
    </Alert>
  </Box>;
}
