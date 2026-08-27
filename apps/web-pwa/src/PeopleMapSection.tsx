import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import InputNumber from 'antd/es/input-number';
import List from 'antd/es/list';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { filterPeopleMapPoints, PEOPLE_MAP_UNGROUPED, peopleMapGroupLegend, peopleMapUngroupedCount } from './lib/peopleMapGroups';
import { peopleMapApi, PeopleMapApiError, type PeopleMapPointDto } from './lib/peopleMapApi';
import type { Locale } from './lib/preferences';
import { serviceGroupsApi, type ServiceGroupDto } from './lib/serviceGroupsApi';
import { sessionApi } from './lib/sessionApi';

const PeopleMapCanvas = lazy(async () => {
  const module = await import('./PeopleMapCanvas');
  return { default: module.PeopleMapCanvas };
});

const ALL_GROUPS = '__eutaktos_all_groups__';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';
type GroupLoadState = 'idle' | 'loading' | 'ready' | 'error';
type EditorState = 'closed' | 'open';

const copy = {
  'pt-PT': {
    title: 'Mapa de pessoas',
    intro: 'Veja somente localizações aproximadas fornecidas manualmente. O mapa não usa moradas, geolocalização do dispositivo nem inferências de perfil.',
    approximate: 'Localização aproximada',
    manual: 'Esta localização é aproximada e fornecida manualmente.',
    loading: 'A carregar localizações aproximadas…',
    canvasLoading: 'A preparar mapa…',
    empty: 'Ainda não existem localizações aproximadas no mapa.',
    retry: 'Tentar novamente',
    error: 'Não foi possível carregar o mapa de pessoas.',
    unauthenticated: 'A sessão terminou antes de carregar o mapa.',
    forbidden: 'Não tem permissão para consultar o mapa de pessoas.',
    listTitle: 'Lista de localizações aproximadas',
    mapLabel: 'Mapa com localizações aproximadas de pessoas',
    selected: 'Selecionada',
    selectPerson: 'Selecionar pessoa',
    editLocation: 'Editar localização',
    addLocation: 'Adicionar localização aproximada',
    noActivePeople: 'Não foi possível preparar a lista de pessoas ativas para edição.',
    person: 'Pessoa',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeHint: 'Entre -90 e 90',
    longitudeHint: 'Entre -180 e 180',
    invalidCoordinates: 'Indique latitude e longitude finitas dentro dos limites permitidos.',
    save: 'Guardar localização',
    saving: 'A guardar…',
    remove: 'Remover localização',
    removing: 'A remover…',
    cancel: 'Cancelar',
    mutationError: 'Não foi possível guardar a localização. Tente novamente.',
    removeError: 'Não foi possível remover a localização. Tente novamente.',
    updateSuccess: 'Localização aproximada atualizada.',
    removeSuccess: 'Localização aproximada removida.',
    readOnly: 'Tem acesso de consulta. A edição exige as permissões explícitas para editar Pessoas e gerir localizações do mapa.',
    location: 'Localização aproximada',
    locations: 'localizações',
    groupFilter: 'Filtrar por grupo',
    allGroups: 'Todas as localizações',
    groupLegend: 'Legenda de grupos',
    ungrouped: 'Sem grupo',
    groupLoading: 'A carregar grupos…',
    groupError: 'Não foi possível carregar os grupos. O mapa continua disponível sem filtro.',
    groupRetry: 'Carregar grupos novamente',
    filterEmpty: 'Não existem localizações aproximadas para este grupo.',
  },
  en: {
    title: 'People map',
    intro: 'View only manually provided approximate locations. The map does not use postal addresses, device geolocation or profile inferences.',
    approximate: 'Approximate location',
    manual: 'This location is approximate and manually provided.',
    loading: 'Loading approximate locations…',
    canvasLoading: 'Preparing map…',
    empty: 'No approximate map locations have been added yet.',
    retry: 'Try again',
    error: 'The People map could not be loaded.',
    unauthenticated: 'Your session ended before the map was loaded.',
    forbidden: 'You do not have permission to view the People map.',
    listTitle: 'Approximate locations list',
    mapLabel: 'Map with approximate people locations',
    selected: 'Selected',
    selectPerson: 'Select person',
    editLocation: 'Edit location',
    addLocation: 'Add approximate location',
    noActivePeople: 'The active people list could not be prepared for editing.',
    person: 'Person',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeHint: 'Between -90 and 90',
    longitudeHint: 'Between -180 and 180',
    invalidCoordinates: 'Enter finite latitude and longitude values within the allowed limits.',
    save: 'Save location',
    saving: 'Saving…',
    remove: 'Remove location',
    removing: 'Removing…',
    cancel: 'Cancel',
    mutationError: 'The location could not be saved. Try again.',
    removeError: 'The location could not be removed. Try again.',
    updateSuccess: 'Approximate location updated.',
    removeSuccess: 'Approximate location removed.',
    readOnly: 'You have view access. Editing requires the explicit permissions to edit People and manage map locations.',
    location: 'Approximate location',
    locations: 'locations',
    groupFilter: 'Filter by group',
    allGroups: 'All locations',
    groupLegend: 'Group legend',
    ungrouped: 'No group',
    groupLoading: 'Loading groups…',
    groupError: 'Groups could not be loaded. The map remains available without a filter.',
    groupRetry: 'Load groups again',
    filterEmpty: 'There are no approximate locations for this group.',
  },
  es: {
    title: 'Mapa de personas',
    intro: 'Consulta únicamente ubicaciones aproximadas proporcionadas manualmente. El mapa no usa direcciones postales, geolocalización del dispositivo ni inferencias del perfil.',
    approximate: 'Ubicación aproximada',
    manual: 'Esta ubicación es aproximada y se proporciona manualmente.',
    loading: 'Cargando ubicaciones aproximadas…',
    canvasLoading: 'Preparando mapa…',
    empty: 'Todavía no se han añadido ubicaciones aproximadas al mapa.',
    retry: 'Intentar de nuevo',
    error: 'No se pudo cargar el mapa de personas.',
    unauthenticated: 'La sesión terminó antes de cargar el mapa.',
    forbidden: 'No tiene permiso para consultar el mapa de personas.',
    listTitle: 'Lista de ubicaciones aproximadas',
    mapLabel: 'Mapa con ubicaciones aproximadas de personas',
    selected: 'Seleccionada',
    selectPerson: 'Seleccionar persona',
    editLocation: 'Editar ubicación',
    addLocation: 'Añadir ubicación aproximada',
    noActivePeople: 'No se pudo preparar la lista de personas activas para editar.',
    person: 'Persona',
    latitude: 'Latitud',
    longitude: 'Longitud',
    latitudeHint: 'Entre -90 y 90',
    longitudeHint: 'Entre -180 y 180',
    invalidCoordinates: 'Indique valores finitos de latitud y longitud dentro de los límites permitidos.',
    save: 'Guardar ubicación',
    saving: 'Guardando…',
    remove: 'Eliminar ubicación',
    removing: 'Eliminando…',
    cancel: 'Cancelar',
    mutationError: 'No se pudo guardar la ubicación. Inténtelo de nuevo.',
    removeError: 'No se pudo eliminar la ubicación. Inténtelo de nuevo.',
    updateSuccess: 'Ubicación aproximada actualizada.',
    removeSuccess: 'Ubicación aproximada eliminada.',
    readOnly: 'Tiene acceso de consulta. Editar exige los permisos explícitos para editar Personas y gestionar ubicaciones del mapa.',
    location: 'Ubicación aproximada',
    locations: 'ubicaciones',
    groupFilter: 'Filtrar por grupo',
    allGroups: 'Todas las ubicaciones',
    groupLegend: 'Leyenda de grupos',
    ungrouped: 'Sin grupo',
    groupLoading: 'Cargando grupos…',
    groupError: 'No se pudieron cargar los grupos. El mapa sigue disponible sin filtro.',
    groupRetry: 'Cargar grupos de nuevo',
    filterEmpty: 'No hay ubicaciones aproximadas para este grupo.',
  },
} as const;

function draftCoordinate(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseCoordinates(latitude: string, longitude: string): Readonly<{ latitude: number; longitude: number }> | undefined {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) return undefined;
  if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) return undefined;
  return Object.freeze({ latitude: parsedLatitude, longitude: parsedLongitude });
}

function locationText(point: PeopleMapPointDto): string {
  return `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`;
}

export function PeopleMapSection({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const groupControllerRef = useRef<AbortController | null>(null);
  const groupRequestVersionRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [state, setState] = useState<LoadState>('idle');
  const [points, setPoints] = useState<readonly PeopleMapPointDto[]>([]);
  const [groups, setGroups] = useState<readonly ServiceGroupDto[]>([]);
  const [groupState, setGroupState] = useState<GroupLoadState>('idle');
  const [groupFilter, setGroupFilter] = useState<string | undefined>();
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>();
  const [canWrite, setCanWrite] = useState(false);
  const [editor, setEditor] = useState<EditorState>('closed');
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState(false);
  const [editorPersonId, setEditorPersonId] = useState<string | undefined>();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [validationError, setValidationError] = useState(false);
  const [mutation, setMutation] = useState<'idle' | 'save' | 'remove'>('idle');
  const [mutationError, setMutationError] = useState<'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<'save' | 'remove' | null>(null);

  const groupLegend = useMemo(() => peopleMapGroupLegend(points, groups), [groups, points]);
  const ungroupedCount = useMemo(() => peopleMapUngroupedCount(points, groups), [groups, points]);
  const visiblePoints = useMemo(() => filterPeopleMapPoints(points, groups, groupFilter), [groupFilter, groups, points]);

  const load = useCallback(async () => {
    const version = ++requestVersionRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setState('loading');
    setMutationError(null);
    try {
      const result = await peopleMapApi.list(controller.signal);
      if (controller.signal.aborted || version !== requestVersionRef.current || !mountedRef.current) return;
      setPoints(result.points);
      setSelectedPersonId(current => result.points.some(point => point.personId === current) ? current : undefined);
      setState('ready');
    } catch (reason) {
      if (controller.signal.aborted || version !== requestVersionRef.current || !mountedRef.current) return;
      if (reason instanceof PeopleMapApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleMapApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally {
      if (version === requestVersionRef.current) requestControllerRef.current = null;
    }
  }, []);

  const loadGroups = useCallback(async () => {
    const version = ++groupRequestVersionRef.current;
    groupControllerRef.current?.abort();
    const controller = new AbortController();
    groupControllerRef.current = controller;
    setGroupState('loading');
    try {
      const result = await serviceGroupsApi.list(controller.signal);
      if (controller.signal.aborted || version !== groupRequestVersionRef.current || !mountedRef.current) return;
      setGroups(Object.freeze([...result].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))));
      setGroupState('ready');
    } catch {
      if (controller.signal.aborted || version !== groupRequestVersionRef.current || !mountedRef.current) return;
      setGroups([]);
      setGroupFilter(undefined);
      setGroupState('error');
    } finally {
      if (version === groupRequestVersionRef.current) groupControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    void loadGroups();
    const controller = new AbortController();
    void sessionApi.current(controller.signal).then(session => {
      if (!controller.signal.aborted && mountedRef.current) {
        const capabilities = new Set(session.capabilities);
        setCanWrite(capabilities.has('people.write') && capabilities.has('map.write'));
      }
    }).catch(() => {
      if (!controller.signal.aborted && mountedRef.current) setCanWrite(false);
    });
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      groupRequestVersionRef.current += 1;
      mutationVersionRef.current += 1;
      requestControllerRef.current?.abort();
      groupControllerRef.current?.abort();
      controller.abort();
    };
  }, [load, loadGroups]);

  useEffect(() => {
    if (selectedPersonId && !visiblePoints.some(point => point.personId === selectedPersonId)) {
      setSelectedPersonId(undefined);
    }
  }, [selectedPersonId, visiblePoints]);

  useEffect(() => {
    if (!groupFilter) return;
    if (groupFilter === PEOPLE_MAP_UNGROUPED) {
      if (groupState === 'ready' && ungroupedCount === 0) setGroupFilter(undefined);
      return;
    }
    if (groupState === 'ready' && !groupLegend.some(entry => entry.id === groupFilter)) setGroupFilter(undefined);
  }, [groupFilter, groupLegend, groupState, ungroupedCount]);

  useEffect(() => {
    if (editor !== 'open') return;
    const person = points.find(point => point.personId === editorPersonId);
    if (!person) return;
    setLatitude(draftCoordinate(person.latitude));
    setLongitude(draftCoordinate(person.longitude));
    setValidationError(false);
  }, [editor, editorPersonId, points]);

  const preparePeople = async () => {
    if (people.length || peopleLoading) return;
    setPeopleLoading(true);
    setPeopleError(false);
    try {
      const result = await peopleApi.list();
      if (!mountedRef.current) return;
      setPeople(result.filter(person => person.active).sort((left, right) => left.displayName.localeCompare(right.displayName)));
    } catch {
      if (mountedRef.current) setPeopleError(true);
    } finally {
      if (mountedRef.current) setPeopleLoading(false);
    }
  };

  const openEditor = (personId?: string) => {
    if (!canWrite || mutationInFlightRef.current) return;
    const target = personId ?? selectedPersonId;
    setEditorPersonId(target);
    const point = points.find(item => item.personId === target);
    setLatitude(draftCoordinate(point?.latitude ?? null));
    setLongitude(draftCoordinate(point?.longitude ?? null));
    setValidationError(false);
    setMutationError(null);
    setNotice(null);
    setEditor('open');
    void preparePeople();
  };

  const closeEditor = () => {
    if (mutationInFlightRef.current) return;
    setEditor('closed');
    setValidationError(false);
    setMutationError(null);
  };

  const save = async () => {
    const target = editorPersonId;
    const coordinates = parseCoordinates(latitude, longitude);
    if (!target || !coordinates || !canWrite || mutationInFlightRef.current) {
      setValidationError(true);
      return;
    }
    const version = ++mutationVersionRef.current;
    mutationInFlightRef.current = true;
    setMutation('save');
    setMutationError(null);
    setNotice(null);
    try {
      await peopleMapApi.setLocation(target, coordinates.latitude, coordinates.longitude);
      if (version !== mutationVersionRef.current || !mountedRef.current) return;
      setEditor('closed');
      setNotice('save');
      await load();
    } catch {
      if (version !== mutationVersionRef.current || !mountedRef.current) return;
      setMutationError('save');
    } finally {
      if (version === mutationVersionRef.current && mountedRef.current) {
        mutationInFlightRef.current = false;
        setMutation('idle');
      }
    }
  };

  const remove = async () => {
    const target = editorPersonId;
    if (!target || !canWrite || mutationInFlightRef.current) return;
    const version = ++mutationVersionRef.current;
    mutationInFlightRef.current = true;
    setMutation('remove');
    setMutationError(null);
    setNotice(null);
    try {
      await peopleMapApi.removeLocation(target);
      if (version !== mutationVersionRef.current || !mountedRef.current) return;
      setEditor('closed');
      setSelectedPersonId(current => current === target ? undefined : current);
      setNotice('remove');
      await load();
    } catch {
      if (version !== mutationVersionRef.current || !mountedRef.current) return;
      setMutationError('remove');
    } finally {
      if (version === mutationVersionRef.current && mountedRef.current) {
        mutationInFlightRef.current = false;
        setMutation('idle');
      }
    }
  };

  const hasExistingLocation = Boolean(editorPersonId && points.some(point => point.personId === editorPersonId));
  const personOptions = people.map(person => ({ value: person.id, label: person.displayName }));
  const groupOptions = [
    { value: ALL_GROUPS, label: text.allGroups },
    ...groupLegend.map(entry => ({ value: entry.id, label: `${entry.name} (${entry.count})` })),
    ...(ungroupedCount > 0 ? [{ value: PEOPLE_MAP_UNGROUPED, label: `${text.ungrouped} (${ungroupedCount})` }] : []),
  ];

  return <section aria-labelledby="people-map-title">
    <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
      <Card>
        <Space orientation="vertical" size="small" style={{ display: 'flex' }}>
          <Typography.Title level={2} id="people-map-title" style={{ margin: 0 }}>{text.title}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{text.intro}</Typography.Paragraph>
          <Alert type="info" showIcon title={text.manual} />
        </Space>
      </Card>

      {state === 'loading' ? <Card><div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 6 }} /></div></Card> : null}
      {state === 'unauthenticated' ? <Alert type="error" showIcon title={text.unauthenticated} /> : null}
      {state === 'forbidden' ? <Alert type="warning" showIcon title={text.forbidden} /> : null}
      {state === 'error' ? <Alert type="error" showIcon title={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}

      {state === 'ready' ? <>
        {notice ? <Alert type="success" showIcon closable onClose={() => setNotice(null)} title={notice === 'save' ? text.updateSuccess : text.removeSuccess} /> : null}
        {canWrite ? <Button type="primary" onClick={() => openEditor()}>{text.addLocation}</Button> : <Alert type="info" showIcon title={text.readOnly} />}
        {!points.length ? <Card><Empty description={text.empty} /></Card> : <>
          <Card title={text.groupFilter}>
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Select
                aria-label={text.groupFilter}
                style={{ width: '100%', maxWidth: 440 }}
                value={groupFilter ?? ALL_GROUPS}
                options={groupOptions}
                loading={groupState === 'loading'}
                disabled={groupState === 'loading' || groupState === 'error'}
                onChange={value => setGroupFilter(value === ALL_GROUPS ? undefined : value)}
              />
              {groupState === 'loading' ? <Typography.Text type="secondary" role="status">{text.groupLoading}</Typography.Text> : null}
              {groupState === 'error' ? <Alert type="warning" showIcon title={text.groupError} action={<Button size="small" onClick={() => void loadGroups()}>{text.groupRetry}</Button>} /> : null}
              {groupState === 'ready' ? <div aria-label={text.groupLegend}>
                <Typography.Text strong>{text.groupLegend}</Typography.Text>
                <Space wrap style={{ marginTop: 8 }}>
                  {groupLegend.map(entry => <Tag key={entry.id}>{entry.name}: {entry.count}</Tag>)}
                  {ungroupedCount > 0 ? <Tag>{text.ungrouped}: {ungroupedCount}</Tag> : null}
                </Space>
              </div> : null}
            </Space>
          </Card>
          {!visiblePoints.length ? <Card><Empty description={text.filterEmpty} /></Card> : <>
            <Card>
              <Suspense fallback={<div role="status" aria-label={text.canvasLoading}><Skeleton active paragraph={{ rows: 7 }} /></div>}>
                <PeopleMapCanvas points={visiblePoints} selectedPersonId={selectedPersonId} onSelect={setSelectedPersonId} label={text.mapLabel} />
              </Suspense>
            </Card>
            <Card title={text.listTitle} extra={<Tag>{visiblePoints.length} {text.locations}</Tag>}>
              <List
                dataSource={[...visiblePoints]}
                renderItem={point => {
                  const isSelected = point.personId === selectedPersonId;
                  return <List.Item key={point.personId}>
                    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Button type={isSelected ? 'primary' : 'default'} aria-pressed={isSelected} onClick={() => setSelectedPersonId(point.personId)}>
                        {point.displayName}
                      </Button>
                      <Space wrap>
                        <Typography.Text>{text.location}: {locationText(point)}</Typography.Text>
                        {isSelected ? <Tag color="blue">{text.selected}</Tag> : null}
                        {canWrite ? <Button onClick={() => openEditor(point.personId)}>{text.editLocation}</Button> : null}
                      </Space>
                    </Space>
                  </List.Item>;
                }}
              />
            </Card>
          </>}
        </>}
      </> : null}

      {editor === 'open' ? <Card title={hasExistingLocation ? text.editLocation : text.addLocation}>
        <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
          <Alert type="info" showIcon title={text.manual} />
          {peopleError ? <Alert type="error" showIcon title={text.noActivePeople} action={<Button size="small" onClick={() => { setPeople([]); void preparePeople(); }}>{text.retry}</Button>} /> : null}
          <label>
            <Typography.Text>{text.person}</Typography.Text>
            <Select
              aria-label={text.person}
              style={{ width: '100%', marginTop: 6 }}
              value={editorPersonId}
              loading={peopleLoading}
              options={personOptions}
              optionRender={option => option.data.label}
              labelRender={({ value }) => people.find(person => person.id === value)?.displayName ?? text.selectPerson}
              onChange={value => { setEditorPersonId(value); setValidationError(false); }}
              disabled={peopleLoading || mutation !== 'idle'}
              placeholder={text.selectPerson}
            />
          </label>
          <Space wrap style={{ width: '100%' }}>
            <label style={{ flex: '1 1 220px' }}>
              <Typography.Text>{text.latitude}</Typography.Text>
              <InputNumber aria-label={text.latitude} style={{ width: '100%', marginTop: 6 }} value={latitude === '' ? null : Number(latitude)} onChange={value => { setLatitude(draftCoordinate(value)); setValidationError(false); }} disabled={mutation !== 'idle'} min={-90} max={90} step={0.01} placeholder={text.latitudeHint} />
            </label>
            <label style={{ flex: '1 1 220px' }}>
              <Typography.Text>{text.longitude}</Typography.Text>
              <InputNumber aria-label={text.longitude} style={{ width: '100%', marginTop: 6 }} value={longitude === '' ? null : Number(longitude)} onChange={value => { setLongitude(draftCoordinate(value)); setValidationError(false); }} disabled={mutation !== 'idle'} min={-180} max={180} step={0.01} placeholder={text.longitudeHint} />
            </label>
          </Space>
          {validationError ? <Alert type="error" showIcon title={text.invalidCoordinates} /> : null}
          {mutationError ? <Alert type="error" showIcon title={mutationError === 'save' ? text.mutationError : text.removeError} /> : null}
          <Space wrap>
            <Button type="primary" onClick={() => void save()} loading={mutation === 'save'} disabled={mutation !== 'idle'}>{mutation === 'save' ? text.saving : text.save}</Button>
            {hasExistingLocation ? <Button danger onClick={() => void remove()} loading={mutation === 'remove'} disabled={mutation !== 'idle'}>{mutation === 'remove' ? text.removing : text.remove}</Button> : null}
            <Button onClick={closeEditor} disabled={mutation !== 'idle'}>{text.cancel}</Button>
          </Space>
        </Space>
      </Card> : null}
    </Space>
  </section>;
}
