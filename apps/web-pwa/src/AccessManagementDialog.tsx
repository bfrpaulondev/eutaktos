import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from './lib/preferences';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { accessGrantApi, type AccessGrantDto, type Capability } from './lib/accessGrantApi';

const SENSITIVE = new Set<Capability>(['eligibility.write', 'emergency-contacts.read', 'emergency-contacts.write', 'map.read', 'map.write', 'delegations.read', 'delegations.write', 'review.read', 'review.write', 'audit.read', 'access.manage', 'tenant.manage']);
const GROUPS: readonly { key: 'people' | 'availability' | 'map' | 'operations' | 'review' | 'administration'; capabilities: readonly Capability[] }[] = [
  { key: 'people', capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write', 'emergency-contacts.read', 'emergency-contacts.write'] },
  { key: 'availability', capabilities: ['availability.read', 'availability.write'] },
  { key: 'map', capabilities: ['map.read', 'map.write'] },
  { key: 'operations', capabilities: ['responsibilities.read', 'responsibilities.write', 'delegations.read', 'delegations.write', 'schedule.read', 'schedule.write', 'reports.read', 'reports.write'] },
  { key: 'review', capabilities: ['review.read', 'review.write', 'audit.read'] },
  { key: 'administration', capabilities: ['access.manage', 'tenant.manage'] },
];

const copy = {
  'pt-PT': { title: 'Gestão de acessos', subtitle: 'Concede capabilities explícitas. Nenhuma função ou qualificação é inferida automaticamente.', person: 'Pessoa', searchPerson: 'Procurar pessoa', capability: 'Capability a conceder', selectCapability: 'Seleciona primeiro uma capability explícita.', grant: 'Conceder acesso', granting: 'A conceder…', active: 'Ativo', revoked: 'Revogado', sensitive: 'Sensível', revoke: 'Revogar', revoking: 'A revogar…', choosePerson: 'Seleciona uma pessoa para consultar os acessos.', noGrants: 'Nenhum acesso explícito registado para esta pessoa.', directoryLoading: 'A carregar pessoas…', grantsLoading: 'A carregar acessos…', retry: 'Tentar novamente', close: 'Fechar', unavailable: 'Não foi possível carregar a gestão de acessos. Tenta novamente.', grantError: 'Não foi possível conceder o acesso. Tenta novamente.', revokeError: 'Não foi possível revogar o acesso. Tenta novamente.', grantSuccess: 'Acesso concedido com sucesso.', revokeSuccess: 'Acesso revogado com sucesso.', directoryHint: 'A listagem de pessoas exige people.read separadamente de access.manage.', groups: { people: 'Pessoas e dados sensíveis', availability: 'Disponibilidade', map: 'Mapa de pessoas', operations: 'Operações', review: 'Revisão e auditoria', administration: 'Administração' }, grantTitle: 'Confirmar concessão de acesso', grantBody: 'Confirma que pretende conceder esta capability explícita à pessoa selecionada. A ação não altera outras capabilities.', revokeTitle: 'Confirmar revogação de acesso', revokeBody: 'Confirma que pretende revogar esta capability explícita. A pessoa deixará de ter este acesso após a confirmação.', confirmGrant: 'Sim, conceder', confirmRevoke: 'Sim, revogar', cancel: 'Cancelar', tenantWarning: 'tenant.manage não concede acesso universal; aplica-se somente às verificações de autorização do servidor.' },
  en: { title: 'Access management', subtitle: 'Grant explicit capabilities. No role or qualification is inferred automatically.', person: 'Person', searchPerson: 'Search people', capability: 'Capability to grant', selectCapability: 'Select an explicit capability first.', grant: 'Grant access', granting: 'Granting…', active: 'Active', revoked: 'Revoked', sensitive: 'Sensitive', revoke: 'Revoke', revoking: 'Revoking…', choosePerson: 'Select a person to inspect access.', noGrants: 'No explicit access is recorded for this person.', directoryLoading: 'Loading people…', grantsLoading: 'Loading access…', retry: 'Try again', close: 'Close', unavailable: 'Access management could not be loaded. Please try again.', grantError: 'Access could not be granted. Please try again.', revokeError: 'Access could not be revoked. Please try again.', grantSuccess: 'Access granted successfully.', revokeSuccess: 'Access revoked successfully.', directoryHint: 'Listing people requires people.read separately from access.manage.', groups: { people: 'People and sensitive data', availability: 'Availability', map: 'People map', operations: 'Operations', review: 'Review and audit', administration: 'Administration' }, grantTitle: 'Confirm access grant', grantBody: 'Confirm that you want to grant this explicit capability to the selected person. This does not change any other capabilities.', revokeTitle: 'Confirm access revocation', revokeBody: 'Confirm that you want to revoke this explicit capability. The person will no longer have this access after confirmation.', confirmGrant: 'Yes, grant', confirmRevoke: 'Yes, revoke', cancel: 'Cancel', tenantWarning: 'tenant.manage does not grant universal access; it applies only to server-side authorization checks.' },
  es: { title: 'Gestión de accesos', subtitle: 'Concede capabilities explícitas. No se infiere automáticamente ningún rol ni cualificación.', person: 'Persona', searchPerson: 'Buscar personas', capability: 'Capability para conceder', selectCapability: 'Selecciona primero una capability explícita.', grant: 'Conceder acceso', granting: 'Concediendo…', active: 'Activo', revoked: 'Revogado', sensitive: 'Sensible', revoke: 'Revocar', revoking: 'Revocando…', choosePerson: 'Selecciona una persona para consultar los accesos.', noGrants: 'No hay acceso explícito registrado para esta persona.', directoryLoading: 'Cargando personas…', grantsLoading: 'Cargando accesos…', retry: 'Intentar de nuevo', close: 'Cerrar', unavailable: 'No se pudo cargar la gestión de accesos. Inténtalo de nuevo.', grantError: 'No se pudo conceder el acceso. Inténtalo de nuevo.', revokeError: 'No se pudo revocar el acceso. Inténtalo de nuevo.', grantSuccess: 'Acceso concedido correctamente.', revokeSuccess: 'Acceso revogado correctamente.', directoryHint: 'Listar personas requiere people.read por separado de access.manage.', groups: { people: 'Personas y datos sensibles', availability: 'Disponibilidad', map: 'Mapa de personas', operations: 'Operaciones', review: 'Revisión y auditoría', administration: 'Administración' }, grantTitle: 'Confirmar concesión de acceso', grantBody: 'Confirma que deseas conceder esta capability explícita a la persona seleccionada. La acción no cambia otras capabilities.', revokeTitle: 'Confirmar revocación de acceso', revokeBody: 'Confirma que deseas revocar esta capability explícita. La persona dejará de tener este acceso después de confirmar.', confirmGrant: 'Sí, conceder', confirmRevoke: 'Sí, revocar', cancel: 'Cancelar', tenantWarning: 'tenant.manage no concede acceso universal; se aplica únicamente a las comprobaciones de autorización del servidor.' },
} as const;

export function capabilityGroup(capability: Capability): (typeof GROUPS)[number]['key'] {
  return GROUPS.find(group => group.capabilities.includes(capability))?.key ?? 'administration';
}

export function isSensitiveCapability(capability: Capability): boolean {
  return SENSITIVE.has(capability);
}

export function canConfirmAccessGrant(personId: string, capability: Capability | '', grantsReady: boolean, activeCapabilities: ReadonlySet<Capability>, granting: boolean): boolean {
  return Boolean(personId && capability && grantsReady && !activeCapabilities.has(capability) && !granting);
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value;
}

export function AccessManagementDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [personId, setPersonId] = useState('');
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState<Capability | ''>('');
  const [grants, setGrants] = useState<readonly AccessGrantDto[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsReady, setGrantsReady] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [grantConfirmation, setGrantConfirmation] = useState(false);
  const [revokeCandidate, setRevokeCandidate] = useState<AccessGrantDto | null>(null);
  const [error, setError] = useState<'load' | 'grant' | 'revoke' | null>(null);
  const [notice, setNotice] = useState<'grant' | 'revoke' | null>(null);
  const grantRef = useRef(false);
  const revokeRef = useRef(false);
  const grantButtonRef = useRef<HTMLButtonElement | null>(null);
  const revokeButtonRef = useRef<HTMLElement | null>(null);

  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return !needle ? people : people.filter(person => person.displayName.toLocaleLowerCase(locale).includes(needle));
  }, [locale, people, query]);
  const selectedPerson = people.find(person => person.id === personId) ?? null;
  const activeCapabilities = new Set(grants.filter(item => !item.revokedAt).map(item => item.capability));
  const canConfirmGrant = canConfirmAccessGrant(personId, capability, grantsReady, activeCapabilities, granting);
  const canClose = !granting && revokingId === null && !grantConfirmation && !revokeCandidate;

  const loadDirectory = useCallback(async (signal?: AbortSignal) => {
    setDirectoryLoading(true);
    setError(null);
    try {
      setPeople((await peopleApi.list(signal)).filter(person => person.active));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError('load');
    } finally {
      if (!signal?.aborted) setDirectoryLoading(false);
    }
  }, []);

  const loadGrants = useCallback(async (subjectId: string, signal?: AbortSignal) => {
    if (!subjectId) {
      setGrants([]);
      setGrantsReady(false);
      return;
    }
    setGrants([]);
    setGrantsReady(false);
    setGrantsLoading(true);
    setError(null);
    try {
      setGrants(await accessGrantApi.list(subjectId, signal));
      setGrantsReady(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError('load');
    } finally {
      if (!signal?.aborted) setGrantsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadDirectory(controller.signal);
    return () => controller.abort();
  }, [loadDirectory, open]);

  useEffect(() => {
    if (!open || !personId) return;
    const controller = new AbortController();
    void loadGrants(personId, controller.signal);
    return () => controller.abort();
  }, [loadGrants, open, personId]);

  const grantAccess = async () => {
    if (!personId || !capability || grantRef.current) return;
    grantRef.current = true;
    setGranting(true);
    setError(null);
    setNotice(null);
    try {
      const granted = await accessGrantApi.grant(personId, capability);
      setGrants(current => [...current.filter(item => item.id !== granted.id), granted].sort((first, second) => first.capability.localeCompare(second.capability)));
      setGrantConfirmation(false);
      setNotice('grant');
      setCapability('');
      window.requestAnimationFrame(() => grantButtonRef.current?.focus());
    } catch {
      setGrantConfirmation(false);
      setError('grant');
      window.requestAnimationFrame(() => grantButtonRef.current?.focus());
    } finally {
      grantRef.current = false;
      setGranting(false);
    }
  };

  const revoke = async () => {
    if (!revokeCandidate || revokeRef.current) return;
    revokeRef.current = true;
    setRevokingId(revokeCandidate.id);
    setError(null);
    setNotice(null);
    try {
      const revoked = await accessGrantApi.revoke(revokeCandidate.id);
      setGrants(current => current.map(item => item.id === revoked.id ? revoked : item));
      setRevokeCandidate(null);
      setNotice('revoke');
      window.requestAnimationFrame(() => revokeButtonRef.current?.focus());
    } catch {
      setRevokeCandidate(null);
      setError('revoke');
      window.requestAnimationFrame(() => revokeButtonRef.current?.focus());
    } finally {
      revokeRef.current = false;
      setRevokingId(null);
    }
  };

  const retry = () => {
    if (personId) void loadGrants(personId);
    else void loadDirectory();
  };
  const closeGrantConfirmation = () => {
    if (granting) return;
    setGrantConfirmation(false);
    window.requestAnimationFrame(() => grantButtonRef.current?.focus());
  };
  const closeRevokeConfirmation = () => {
    if (revokingId) return;
    setRevokeCandidate(null);
    window.requestAnimationFrame(() => revokeButtonRef.current?.focus());
  };
  const errorMessage = error === 'grant' ? text.grantError : error === 'revoke' ? text.revokeError : text.unavailable;
  const close = () => {
    if (canClose) onClose();
  };

  const capabilityOptions = GROUPS.map(group => ({
    label: text.groups[group.key],
    options: group.capabilities.map(value => ({
      value,
      label: `${value}${isSensitiveCapability(value) ? ` · ${text.sensitive}` : ''}`,
      disabled: activeCapabilities.has(value),
    })),
  }));

  return <>
    <Modal
      open={open}
      destroyOnHidden
      width={760}
      title={<div id="access-management-title"><Typography.Title level={4} style={{ margin: 0 }}>{text.title}</Typography.Title><Typography.Text type="secondary">{text.subtitle}</Typography.Text></div>}
      aria-labelledby="access-management-title"
      onCancel={close}
      maskClosable={canClose}
      keyboard={canClose}
      footer={<Button onClick={close} disabled={!canClose}>{text.close}</Button>}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={text.directoryHint} />
        {notice ? <Alert type="success" showIcon closable onClose={() => setNotice(null)} title={notice === 'grant' ? text.grantSuccess : text.revokeSuccess} /> : null}
        {error ? <Alert type="warning" showIcon title={errorMessage} action={error === 'load' ? <Button size="small" disabled={directoryLoading || grantsLoading} onClick={retry}>{text.retry}</Button> : undefined} /> : null}

        {directoryLoading ? <div role="status" aria-label={text.directoryLoading}><Skeleton active paragraph={{ rows: 3 }} /></div> : <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <label>
            <Typography.Text>{text.searchPerson}</Typography.Text>
            <Input.Search aria-label={text.searchPerson} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" style={{ marginTop: 6 }} />
          </label>
          <label>
            <Typography.Text>{text.person}</Typography.Text>
            <Select
              aria-label={text.person}
              style={{ width: '100%', marginTop: 6 }}
              value={personId || undefined}
              allowClear
              onChange={value => {
                setPersonId(value ?? '');
                setGrants([]);
                setGrantsReady(false);
                setCapability('');
                setNotice(null);
              }}
              options={filteredPeople.map(person => ({ value: person.id, label: person.displayName }))}
            />
          </label>
        </Space>}

        {personId ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Card size="small">
            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              <label>
                <Typography.Text>{text.capability}</Typography.Text>
                <Select
                  aria-label={text.capability}
                  style={{ width: '100%', marginTop: 6 }}
                  value={capability || undefined}
                  placeholder={text.selectCapability}
                  onChange={value => setCapability(value)}
                  options={capabilityOptions}
                />
              </label>
              {capability === 'tenant.manage' ? <Alert type="warning" showIcon title={text.tenantWarning} /> : null}
              <div><Button ref={grantButtonRef} type="primary" onClick={() => setGrantConfirmation(true)} disabled={!canConfirmGrant} loading={granting}>{granting ? text.granting : text.grant}</Button></div>
            </Space>
          </Card>

          {grantsLoading ? <div role="status" aria-label={text.grantsLoading}><Skeleton active paragraph={{ rows: 3 }} /></div> : grants.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.noGrants} /> : <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            {grants.map(item => <Card key={item.id} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <Space wrap size="small">
                    <Typography.Text strong>{item.capability}</Typography.Text>
                    {isSensitiveCapability(item.capability) ? <Tag color="warning">{text.sensitive}</Tag> : null}
                    <Tag color={item.revokedAt ? 'default' : 'processing'}>{item.revokedAt ? text.revoked : text.active}</Tag>
                  </Space>
                  <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatDate(item.grantedAt, locale)}</Typography.Text></div>
                </div>
                {!item.revokedAt ? <Button danger disabled={revokingId !== null} loading={revokingId === item.id} onClick={event => { revokeButtonRef.current = event.currentTarget; setError(null); setRevokeCandidate(item); }}>{revokingId === item.id ? text.revoking : text.revoke}</Button> : null}
              </div>
            </Card>)}
          </Space>}
        </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.choosePerson} />}
      </Space>
    </Modal>

    <Modal
      open={grantConfirmation}
      destroyOnHidden
      width={480}
      title={<span id="access-grant-title">{text.grantTitle}</span>}
      aria-labelledby="access-grant-title"
      aria-describedby="access-grant-confirmation"
      onCancel={closeGrantConfirmation}
      maskClosable={!granting}
      keyboard={!granting}
      footer={[
        <Button key="cancel" disabled={granting} onClick={closeGrantConfirmation}>{text.cancel}</Button>,
        <Button key="confirm" type="primary" loading={granting} disabled={!canConfirmGrant} onClick={() => void grantAccess()}>{granting ? text.granting : text.confirmGrant}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Paragraph id="access-grant-confirmation" style={{ marginBottom: 0 }}>{text.grantBody}</Typography.Paragraph>
        <Typography.Text strong>{selectedPerson?.displayName} · {capability}</Typography.Text>
        {capability && isSensitiveCapability(capability) ? <Tag color="warning">{text.sensitive}</Tag> : null}
      </Space>
    </Modal>

    <Modal
      open={revokeCandidate !== null}
      destroyOnHidden
      width={480}
      title={<span id="access-revoke-title">{text.revokeTitle}</span>}
      aria-labelledby="access-revoke-title"
      aria-describedby="access-revoke-confirmation"
      onCancel={closeRevokeConfirmation}
      maskClosable={revokingId === null}
      keyboard={revokingId === null}
      footer={[
        <Button key="cancel" disabled={revokingId !== null} onClick={closeRevokeConfirmation}>{text.cancel}</Button>,
        <Button key="confirm" danger type="primary" loading={revokingId !== null} disabled={revokingId !== null} onClick={() => void revoke()}>{revokingId ? text.revoking : text.confirmRevoke}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Paragraph id="access-revoke-confirmation" style={{ marginBottom: 0 }}>{text.revokeBody}</Typography.Paragraph>
        <Typography.Text strong>{revokeCandidate?.capability}</Typography.Text>
        {revokeCandidate && isSensitiveCapability(revokeCandidate.capability) ? <Tag color="warning">{text.sensitive}</Tag> : null}
      </Space>
    </Modal>
  </>;
}
