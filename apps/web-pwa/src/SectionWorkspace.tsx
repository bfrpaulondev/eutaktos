import { useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Paper } from '@mui/material';
import { AccessManagementDialog } from './AccessManagementDialog';
import { AuditHistoryDialog } from './AuditHistoryDialog';
import { PeopleDirectory } from './PeopleDirectory';
import type { Locale } from './lib/preferences';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';
import { Stack, Typography } from './ui/MuiCompat';

interface SectionWorkspaceProps {
  locale: Locale;
  section: WorkspaceSection;
}

function PeopleWorkspace({ locale }: { locale: Locale }) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const auditLabel = locale === 'pt-PT' ? 'Histórico de auditoria' : locale === 'es' ? 'Historial de auditoría' : 'Audit history';
  const accessLabel = locale === 'pt-PT' ? 'Gerir acessos' : locale === 'es' ? 'Gestionar accesos' : 'Manage access';

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => setAuditOpen(true)}>{auditLabel}</Button>
        <Button variant="outlined" onClick={() => setAccessOpen(true)}>{accessLabel}</Button>
      </Box>
      <PeopleDirectory locale={locale} />
      <AuditHistoryDialog locale={locale} open={auditOpen} onClose={() => setAuditOpen(false)} />
      <AccessManagementDialog locale={locale} open={accessOpen} onClose={() => setAccessOpen(false)} />
    </Stack>
  );
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  if (section === 'people') return <PeopleWorkspace locale={locale} />;

  const content = getWorkspaceCopy(locale, section);
  const detailsLabel = locale === 'pt-PT' ? 'Ver detalhes' : locale === 'es' ? 'Ver detalles' : 'View details';

  return (
    <Box component="section" aria-labelledby={`section-${section}-title`}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: { xs: 3, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
          <Box>
            <Typography variant="overline" color="text.secondary" fontWeight={800}>{content.eyebrow}</Typography>
            <Typography variant="h2" id={`section-${section}-title`} sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{content.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{content.subtitle}</Typography>
          </Box>
          <Chip label="Preview" variant="outlined" color="primary" />
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {content.cards.map((card, index) => (
          <Card component="article" key={`${section}-${index}`}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">{card.meta}</Typography>
                    <Typography variant="h5" fontWeight={750}>{card.title}</Typography>
                  </Box>
                  {card.status ? <Chip label={card.status} size="small" variant="outlined" /> : null}
                </Stack>
                <Typography color="text.secondary">{card.detail}</Typography>
                <Button variant="text" sx={{ alignSelf: 'flex-start' }}>{detailsLabel} →</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
