import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@mui/material';
import type { Locale } from './lib/preferences';
import {
  congregationSettingsApi,
  type CongregationSettingsDto,
  type Weekday,
} from './lib/congregationSettingsApi';
import { Stack, Typography } from './ui/MuiCompat';

const copy = {
  'pt-PT': {
    title: 'Configurações da congregação',
    subtitle: 'Perfil operacional da congregação e horários regulares. O acesso continua protegido pelas permissões do servidor.',
    loading: 'A carregar configurações…',
    unavailable: 'Não foi possível carregar as configurações da congregação.',
    retry: 'Tentar novamente',
    notConfigured: 'Ainda não existe um perfil configurado. Preenche os dados abaixo para criar o primeiro.',
    saved: 'Configurações guardadas.',
    name: 'Nome da congregação',
    timezone: 'Fuso horário IANA',
    defaultLocale: 'Idioma predefinido',
    midweek: 'Reunião do meio da semana',
    weekend: 'Reunião do fim de semana',
    weekday: 'Dia da semana',
    time: 'Hora local',
    close: 'Fechar',
    save: 'Guardar configurações',
    saving: 'A guardar…',
    weekdays: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  },
  en: {
    title: 'Congregation settings',
    subtitle: 'Congregation operating profile and regular meeting times. Server-side permissions remain authoritative.',
    loading: 'Loading settings…',
    unavailable: 'Congregation settings could not be loaded.',
    retry: 'Try again',
    notConfigured: 'No congregation profile exists yet. Complete the fields below to create the first one.',
    saved: 'Settings saved.',
    name: 'Congregation name',
    timezone: 'IANA timezone',
    defaultLocale: 'Default language',
    midweek: 'Midweek meeting',
    weekend: 'Weekend meeting',
    weekday: 'Weekday',
    time: 'Local time',
    close: 'Close',
    save: 'Save settings',
    saving: 'Saving…',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  es: {
    title: 'Configuración de la congregación',
    subtitle: 'Perfil operativo de la congregación y horarios regulares. Los permisos del servidor siguen siendo la autoridad.',
    loading: 'Cargando configuración…',
    unavailable: 'No se pudo cargar la configuración de la congregación.',
    retry: 'Intentar de nuevo',
    notConfigured: 'Todavía no existe un perfil de congregación. Completa los datos para crear el primero.',
    saved: 'Configuración guardada.',
    name: 'Nombre de la congregación',
    timezone: 'Zona horaria IANA',
    defaultLocale: 'Idioma predeterminado',
    midweek: 'Reunión de entre semana',
    weekend: 'Reunión del fin de semana',
    weekday: 'Día de la semana',
    time: 'Hora local',
    close: 'Cerrar',
    save: 'Guardar configuración',
    saving: 'Guardando…',
    weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  },
} as const;

function initialSettings(locale: Locale): CongregationSettingsDto {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }
  return {
    name: '',
    timezone,
    defaultLocale: locale,
    midweekMeeting: { weekday: 2, localTime: '19:30' },
    weekendMeeting: { weekday: 0, localTime: '10:00' },
  };
}

export function CongregationSettingsDialog({
  locale,
  open,
  onClose,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const text = copy[locale];
  const [form, setForm] = useState<CongregationSettingsDto>(() => initialSettings(locale));
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoaded(false);
    setError(null);
    setNotice(null);
    try {
      const settings = await congregationSettingsApi.get(signal);
      if (settings) {
        setForm(settings);
        setNotConfigured(false);
      } else {
        setForm(initialSettings(locale));
        setNotConfigured(true);
      }
      setLoaded(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [open, locale]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await congregationSettingsApi.save(form);
      setForm(saved);
      setNotConfigured(false);
      setNotice(text.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.unavailable);
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(
    form.name.trim() &&
    form.timezone.trim() &&
    form.defaultLocale.trim() &&
    form.midweekMeeting.localTime &&
    form.weekendMeeting.localTime,
  );

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="md"
      aria-labelledby="congregation-settings-title"
    >
      <Box component="form" onSubmit={submit}>
        <DialogTitle id="congregation-settings-title">{text.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography color="text.secondary">{text.subtitle}</Typography>

            {loading ? (
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" role="status" sx={{ py: 5 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{text.loading}</Typography>
              </Stack>
            ) : null}

            {!loading && error && !loaded ? (
              <Alert
                severity="warning"
                action={<Button color="inherit" size="small" onClick={() => void load()}>{text.retry}</Button>}
              >
                {error}
              </Alert>
            ) : null}

            {loaded ? (
              <>
                {notConfigured ? <Alert severity="info">{text.notConfigured}</Alert> : null}
                {error ? <Alert severity="warning">{error}</Alert> : null}
                {notice ? <Alert severity="success">{notice}</Alert> : null}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label={text.name}
                    value={form.name}
                    onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                    required
                    autoFocus
                    slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'organization' } }}
                  />
                  <TextField
                    label={text.timezone}
                    value={form.timezone}
                    onChange={event => setForm(current => ({ ...current, timezone: event.target.value }))}
                    required
                    slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'off' } }}
                  />
                  <TextField
                    label={text.defaultLocale}
                    value={form.defaultLocale}
                    onChange={event => setForm(current => ({ ...current, defaultLocale: event.target.value }))}
                    required
                    slotProps={{ htmlInput: { maxLength: 35, autoComplete: 'off' } }}
                  />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
                  <MeetingEditor
                    title={text.midweek}
                    weekdayLabel={text.weekday}
                    timeLabel={text.time}
                    weekdays={text.weekdays}
                    value={form.midweekMeeting}
                    onWeekday={weekday => setForm(current => ({
                      ...current,
                      midweekMeeting: { ...current.midweekMeeting, weekday },
                    }))}
                    onTime={localTime => setForm(current => ({
                      ...current,
                      midweekMeeting: { ...current.midweekMeeting, localTime },
                    }))}
                  />
                  <MeetingEditor
                    title={text.weekend}
                    weekdayLabel={text.weekday}
                    timeLabel={text.time}
                    weekdays={text.weekdays}
                    value={form.weekendMeeting}
                    onWeekday={weekday => setForm(current => ({
                      ...current,
                      weekendMeeting: { ...current.weekendMeeting, weekday },
                    }))}
                    onTime={localTime => setForm(current => ({
                      ...current,
                      weekendMeeting: { ...current.weekendMeeting, localTime },
                    }))}
                  />
                </Box>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>{text.close}</Button>
          <Button type="submit" variant="contained" disabled={!loaded || saving || !canSave}>
            {saving ? text.saving : text.save}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function MeetingEditor({
  title,
  weekdayLabel,
  timeLabel,
  weekdays,
  value,
  onWeekday,
  onTime,
}: {
  title: string;
  weekdayLabel: string;
  timeLabel: string;
  weekdays: readonly string[];
  value: CongregationSettingsDto['midweekMeeting'];
  onWeekday: (weekday: Weekday) => void;
  onTime: (time: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6" fontWeight={750}>{title}</Typography>
        <FormControl fullWidth>
          <InputLabel>{weekdayLabel}</InputLabel>
          <Select
            label={weekdayLabel}
            value={value.weekday}
            onChange={event => onWeekday(Number(event.target.value) as Weekday)}
          >
            {weekdays.map((label, index) => <MenuItem key={label} value={index}>{label}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          label={timeLabel}
          type="time"
          value={value.localTime}
          onChange={event => onTime(event.target.value)}
          required
          slotProps={{ htmlInput: { step: 60 } }}
        />
      </Stack>
    </Paper>
  );
}
