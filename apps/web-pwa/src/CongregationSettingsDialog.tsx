import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Locale } from './lib/preferences';
import { congregationSettingsApi, type CongregationSettingsDto, type Weekday } from './lib/congregationSettingsApi';

const copy = {
  'pt-PT': { title: 'Configurações da congregação', subtitle: 'Perfil operacional e horários regulares. As permissões do servidor continuam a ser a autoridade.', loading: 'A carregar configurações…', unavailable: 'Não foi possível carregar as configurações da congregação. Tenta novamente.', saveError: 'Não foi possível guardar as configurações. Tenta novamente.', retry: 'Tentar novamente', notConfigured: 'Ainda não existe um perfil configurado. Preenche os dados abaixo para criar o primeiro.', saved: 'Configurações guardadas.', unsaved: 'Existem alterações não guardadas.', profile: 'Perfil da congregação', profileHint: 'Usa o nome que deve aparecer nas interfaces da congregação.', timeAndLanguage: 'Horário e idioma', timeAndLanguageHint: 'O fuso horário e o idioma predefinido afetam a apresentação local, não as permissões.', regularMeetings: 'Reuniões regulares', meetingsHint: 'Indica apenas os horários regulares que já estão definidos pela congregação.', name: 'Nome da congregação', nameHelp: 'Até 120 caracteres.', timezone: 'Fuso horário IANA', timezoneHelp: 'Por exemplo, Europe/Lisbon ou UTC.', defaultLocale: 'Idioma predefinido', defaultLocaleHelp: 'Usado como predefinição onde aplicável.', midweek: 'Reunião do meio da semana', weekend: 'Reunião do fim de semana', weekday: 'Dia da semana', time: 'Hora local', timeHelp: 'Formato de 24 horas.', close: 'Fechar', save: 'Guardar configurações', saving: 'A guardar…', cancel: 'Cancelar', discardTitle: 'Descartar alterações não guardadas?', discardBody: 'As alterações feitas neste formulário serão perdidas. Esta ação não altera as configurações já guardadas.', discard: 'Descartar alterações', weekdays: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'], localeOptions: { 'pt-PT': 'Português (Portugal)', en: 'English', es: 'Español' } },
  en: { title: 'Congregation settings', subtitle: 'Operating profile and regular meeting times. Server-side permissions remain authoritative.', loading: 'Loading settings…', unavailable: 'Congregation settings could not be loaded. Please try again.', saveError: 'Settings could not be saved. Please try again.', retry: 'Try again', notConfigured: 'No profile exists yet. Complete the fields below to create the first one.', saved: 'Settings saved.', unsaved: 'There are unsaved changes.', profile: 'Congregation profile', profileHint: 'Use the name that should appear in congregation interfaces.', timeAndLanguage: 'Time and language', timeAndLanguageHint: 'Timezone and default language affect local presentation, not permissions.', regularMeetings: 'Regular meetings', meetingsHint: 'Enter only regular times already established by the congregation.', name: 'Congregation name', nameHelp: 'Up to 120 characters.', timezone: 'IANA timezone', timezoneHelp: 'For example, Europe/Lisbon or UTC.', defaultLocale: 'Default language', defaultLocaleHelp: 'Used as the default where applicable.', midweek: 'Midweek meeting', weekend: 'Weekend meeting', weekday: 'Weekday', time: 'Local time', timeHelp: '24-hour format.', close: 'Close', save: 'Save settings', saving: 'Saving…', cancel: 'Cancel', discardTitle: 'Discard unsaved changes?', discardBody: 'Changes made in this form will be lost. This does not change settings that have already been saved.', discard: 'Discard changes', weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], localeOptions: { 'pt-PT': 'Português (Portugal)', en: 'English', es: 'Español' } },
  es: { title: 'Configuración de la congregación', subtitle: 'Perfil operativo y horarios regulares. Los permisos del servidor siguen siendo la autoridad.', loading: 'Cargando configuración…', unavailable: 'No se pudo cargar la configuración de la congregación. Inténtalo de nuevo.', saveError: 'No se pudo guardar la configuración. Inténtalo de nuevo.', retry: 'Intentar de nuevo', notConfigured: 'Todavía no existe un perfil. Completa los datos para crear el primero.', saved: 'Configuración guardada.', unsaved: 'Hay cambios sin guardar.', profile: 'Perfil de la congregación', profileHint: 'Usa el nombre que debe aparecer en las interfaces de la congregación.', timeAndLanguage: 'Hora e idioma', timeAndLanguageHint: 'La zona horaria y el idioma predeterminado afectan a la presentación local, no a los permisos.', regularMeetings: 'Reuniones regulares', meetingsHint: 'Indica solo horarios regulares ya establecidos por la congregación.', name: 'Nombre de la congregación', nameHelp: 'Hasta 120 caracteres.', timezone: 'Zona horaria IANA', timezoneHelp: 'Por ejemplo, Europe/Lisbon o UTC.', defaultLocale: 'Idioma predeterminado', defaultLocaleHelp: 'Se usa como predeterminado cuando corresponda.', midweek: 'Reunión de entre semana', weekend: 'Reunión del fin de semana', weekday: 'Día de la semana', time: 'Hora local', timeHelp: 'Formato de 24 horas.', close: 'Cerrar', save: 'Guardar configuración', saving: 'Guardando…', cancel: 'Cancelar', discardTitle: '¿Descartar cambios sin guardar?', discardBody: 'Los cambios realizados en este formulario se perderán. Esto no modifica la configuración ya guardada.', discard: 'Descartar cambios', weekdays: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], localeOptions: { 'pt-PT': 'Português (Portugal)', en: 'English', es: 'Español' } },
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

function normalizeSettings(settings: CongregationSettingsDto): CongregationSettingsDto {
  return {
    name: settings.name.trim(),
    timezone: settings.timezone.trim(),
    defaultLocale: settings.defaultLocale.trim(),
    midweekMeeting: { ...settings.midweekMeeting },
    weekendMeeting: { ...settings.weekendMeeting },
  };
}

export function settingsAreEqual(first: CongregationSettingsDto, second: CongregationSettingsDto): boolean {
  return first.name === second.name
    && first.timezone === second.timezone
    && first.defaultLocale === second.defaultLocale
    && first.midweekMeeting.weekday === second.midweekMeeting.weekday
    && first.midweekMeeting.localTime === second.midweekMeeting.localTime
    && first.weekendMeeting.weekday === second.weekendMeeting.weekday
    && first.weekendMeeting.localTime === second.weekendMeeting.localTime;
}

export function canSaveCongregationSettings(form: CongregationSettingsDto, saving: boolean): boolean {
  return !saving
    && Boolean(
      form.name.trim()
      && form.timezone.trim()
      && form.defaultLocale.trim()
      && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.midweekMeeting.localTime)
      && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.weekendMeeting.localTime),
    );
}

export function CongregationSettingsDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const [form, setForm] = useState<CongregationSettingsDto>(() => initialSettings(locale));
  const [savedForm, setSavedForm] = useState<CongregationSettingsDto>(() => initialSettings(locale));
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoaded(false);
    setLoadError(false);
    setSaveError(false);
    setNotice(false);
    try {
      const settings = await congregationSettingsApi.get(signal);
      const next = settings ?? initialSettings(locale);
      setForm(next);
      setSavedForm(next);
      setNotConfigured(!settings);
      setLoaded(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setLoadError(true);
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

  const dirty = loaded && !settingsAreEqual(form, savedForm);
  const requestClose = () => {
    if (saving) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (!canSaveCongregationSettings(form, saving) || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    setNotice(false);
    try {
      const saved = await congregationSettingsApi.save(normalizeSettings(form));
      setForm(saved);
      setSavedForm(saved);
      setNotConfigured(false);
      setNotice(true);
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return <>
    <Modal
      open={open}
      destroyOnHidden
      width={860}
      title={<div id="congregation-settings-title"><Typography.Title level={4} style={{ margin: 0 }}>{text.title}</Typography.Title></div>}
      aria-labelledby="congregation-settings-title"
      onCancel={requestClose}
      maskClosable={!saving}
      keyboard={!saving}
      footer={[
        <Button key="close" disabled={saving} onClick={requestClose}>{text.close}</Button>,
        <Button key="save" type="primary" htmlType="submit" form="congregation-settings-form" loading={saving} disabled={!loaded || !canSaveCongregationSettings(form, saving)}>{saving ? text.saving : text.save}</Button>,
      ]}
    >
      <form id="congregation-settings-form" onSubmit={onSubmit}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{text.subtitle}</Typography.Text>

          {loading ? <div role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 6 }} /></div> : null}
          {!loading && loadError ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}

          {loaded ? <>
            {notConfigured ? <Alert type="info" showIcon title={text.notConfigured} /> : null}
            {dirty ? <Alert type="info" showIcon title={text.unsaved} /> : null}
            {saveError ? <Alert type="error" showIcon title={text.saveError} /> : null}
            {notice ? <Alert type="success" showIcon closable onClose={() => setNotice(false)} title={text.saved} /> : null}

            <SettingsSection title={text.profile} hint={text.profileHint}>
              <Field label={text.name} help={text.nameHelp}>
                <Input
                  aria-label={text.name}
                  value={form.name}
                  maxLength={120}
                  autoComplete="organization"
                  required
                  autoFocus
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                />
              </Field>
            </SettingsSection>

            <SettingsSection title={text.timeAndLanguage} hint={text.timeAndLanguageHint}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <Field label={text.timezone} help={text.timezoneHelp}>
                  <Input
                    aria-label={text.timezone}
                    value={form.timezone}
                    maxLength={100}
                    autoComplete="off"
                    spellCheck={false}
                    required
                    onChange={event => setForm(current => ({ ...current, timezone: event.target.value }))}
                  />
                </Field>
                <Field label={text.defaultLocale} help={text.defaultLocaleHelp}>
                  <Select
                    aria-label={text.defaultLocale}
                    style={{ width: '100%' }}
                    value={form.defaultLocale}
                    onChange={value => setForm(current => ({ ...current, defaultLocale: value }))}
                    options={(['pt-PT', 'en', 'es'] as const).map(value => ({ value, label: text.localeOptions[value] }))}
                  />
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection title={text.regularMeetings} hint={text.meetingsHint}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <MeetingEditor
                  title={text.midweek}
                  weekdayLabel={text.weekday}
                  timeLabel={text.time}
                  timeHelp={text.timeHelp}
                  weekdays={text.weekdays}
                  value={form.midweekMeeting}
                  onWeekday={weekday => setForm(current => ({ ...current, midweekMeeting: { ...current.midweekMeeting, weekday } }))}
                  onTime={localTime => setForm(current => ({ ...current, midweekMeeting: { ...current.midweekMeeting, localTime } }))}
                />
                <MeetingEditor
                  title={text.weekend}
                  weekdayLabel={text.weekday}
                  timeLabel={text.time}
                  timeHelp={text.timeHelp}
                  weekdays={text.weekdays}
                  value={form.weekendMeeting}
                  onWeekday={weekday => setForm(current => ({ ...current, weekendMeeting: { ...current.weekendMeeting, weekday } }))}
                  onTime={localTime => setForm(current => ({ ...current, weekendMeeting: { ...current.weekendMeeting, localTime } }))}
                />
              </div>
            </SettingsSection>
          </> : null}
        </Space>
      </form>
    </Modal>

    <Modal
      open={confirmDiscard}
      destroyOnHidden
      width={440}
      title={<span id="settings-discard-title">{text.discardTitle}</span>}
      aria-labelledby="settings-discard-title"
      aria-describedby="settings-discard-description"
      onCancel={() => { if (!saving) setConfirmDiscard(false); }}
      maskClosable={!saving}
      keyboard={!saving}
      footer={[
        <Button key="cancel" disabled={saving} onClick={() => setConfirmDiscard(false)}>{text.cancel}</Button>,
        <Button key="discard" danger type="primary" disabled={saving} onClick={() => { setConfirmDiscard(false); onClose(); }}>{text.discard}</Button>,
      ]}
    >
      <Typography.Paragraph id="settings-discard-description" style={{ marginBottom: 0 }}>{text.discardBody}</Typography.Paragraph>
    </Modal>
  </>;
}

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return <label style={{ display: 'block' }}>
    <Typography.Text strong>{label}</Typography.Text>
    <div style={{ marginTop: 6 }}>{children}</div>
    <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{help}</Typography.Text>
  </label>;
}

function SettingsSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return <Card size="small">
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{hint}</Typography.Paragraph>
      </div>
      {children}
    </Space>
  </Card>;
}

function MeetingEditor({ title, weekdayLabel, timeLabel, timeHelp, weekdays, value, onWeekday, onTime }: {
  title: string;
  weekdayLabel: string;
  timeLabel: string;
  timeHelp: string;
  weekdays: readonly string[];
  value: CongregationSettingsDto['midweekMeeting'];
  onWeekday: (weekday: Weekday) => void;
  onTime: (time: string) => void;
}) {
  return <Card size="small" title={title}>
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <label style={{ display: 'block' }}>
        <Typography.Text>{weekdayLabel}</Typography.Text>
        <Select
          aria-label={`${title} · ${weekdayLabel}`}
          style={{ width: '100%', marginTop: 6 }}
          value={value.weekday}
          onChange={weekday => onWeekday(weekday as Weekday)}
          options={weekdays.map((label, index) => ({ value: index, label }))}
        />
      </label>
      <Field label={timeLabel} help={timeHelp}>
        <Input
          aria-label={`${title} · ${timeLabel}`}
          type="time"
          value={value.localTime}
          step={60}
          required
          onChange={event => onTime(event.target.value)}
        />
      </Field>
    </Space>
  </Card>;
}
