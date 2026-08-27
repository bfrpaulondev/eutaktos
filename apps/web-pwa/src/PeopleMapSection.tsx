import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
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
import { peopleMapApi, PeopleMapApiError, type PeopleMapPointDto, type PeopleMapSearchResultDto } from './lib/peopleMapApi';
import type { Locale } from './lib/preferences';
import { serviceGroupsApi, type ServiceGroupDto } from './lib/serviceGroupsApi';
import { sessionApi } from './lib/sessionApi';

const PeopleMapCanvas = lazy(async () => {
  const module = await import('./PeopleMapCanvas');
  return { default: module.PeopleMapCanvas };
});

const PeopleMapLocationPicker = lazy(async () => {
  const module = await import('./PeopleMapLocationPicker');
  return { default: module.PeopleMapLocationPicker };
});

const ALL_GROUPS = '__eutaktos_all_groups__';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';
type GroupLoadState = 'idle' | 'loading' | 'ready' | 'error';
type EditorState = 'closed' | 'open';
type PlaceSearchState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'invalid';

const copy = {
  'pt-PT': {
    title: 'Mapa de pessoas',
    intro: 'Veja localizações aproximadas escolhidas explicitamente. O Eutaktos nunca copia automaticamente a morada de Contactos nem usa a geolocalização do dispositivo.',
    approximate: 'Localização aproximada',
    manual: 'A localização guardada é sempre aproximada e confirmada manualmente.',
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
    searchTitle: 'Encontrar uma zona no mapa',
    searchLabel: 'Pesquisar rua, código postal, localidade ou endereço',
    searchPlaceholder: 'Ex.: Rua do Comércio, Setúbal',
    search: 'Pesquisar',
    searching: 'A pesquisar…',
    searchPrivacy: 'A pesquisa só é enviada quando carregar em Pesquisar. A morada guardada em Contactos nunca é lida nem enviada automaticamente.',
    searchProvider: 'A pesquisa de lugares usa Photon com dados OpenStreetMap. O texto pesquisado não é guardado pelo Eutaktos nem associado à pessoa.',
    searchInvalid: 'Escreva pelo menos 2 caracteres para pesquisar.',
    searchError: 'Não foi possível pesquisar este local agora. Tente novamente.',
    searchEmpty: 'Não encontrámos resultados. Tente uma rua, código postal ou localidade diferente.',
    searchResults: 'Resultados de pesquisa',
    useResult: 'Usar este local',
    pickerTitle: 'Confirmar no mapa',
    pickerHint: 'Clique no mapa para escolher a zona aproximada ou arraste o marcador para ajustar.',
    pickerLabel: 'Mapa para escolher a localização aproximada',
    pickerMarker: 'Localização aproximada selecionada',
    advancedCoordinates: 'Ajuste avançado por coordenadas',
    advancedHint: 'Opcional. A pesquisa e o mapa são a forma recomendada; estas coordenadas existem apenas como ajuste avançado.',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeHint: 'Entre -90 e 90',
    longitudeHint: 'Entre -180 e 180',
    invalidCoordinates: 'Escolha um local no mapa ou indique latitude e longitude válidas.',
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
    intro: 'View approximate locations chosen explicitly. Eutaktos never automatically copies the Contact address or uses device geolocation.',
    approximate: 'Approximate location',
    manual: 'The saved location is always approximate and manually confirmed.',
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
    searchTitle: 'Find an area on the map',
    searchLabel: 'Search street, postcode, locality or address',
    searchPlaceholder: 'E.g. High Street, Setúbal',
    search: 'Search',
    searching: 'Searching…',
    searchPrivacy: 'The search is sent only after you press Search. The Contact address is never read or sent automatically.',
    searchProvider: 'Place search uses Photon with OpenStreetMap data. Eutaktos does not store the search text or associate it with the person.',
    searchInvalid: 'Enter at least 2 characters to search.',
    searchError: 'This place could not be searched right now. Try again.',
    searchEmpty: 'No results were found. Try a different street, postcode or locality.',
    searchResults: 'Search results',
    useResult: 'Use this place',
    pickerTitle: 'Confirm on the map',
    pickerHint: 'Click the map to choose the approximate area or drag the marker to adjust it.',
    pickerLabel: 'Map for choosing an approximate location',
    pickerMarker: 'Selected approximate location',
    advancedCoordinates: 'Advanced coordinate adjustment',
    advancedHint: 'Optional. Search and map selection are recommended; coordinates remain available only as an advanced adjustment.',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeHint: 'Between -90 and 90',
    longitudeHint: 'Between -180 and 180',
    invalidCoordinates: 'Choose a place on the map or enter valid latitude and longitude values.',
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
    intro: 'Consulta ubicaciones aproximadas elegidas explícitamente. Eutaktos nunca copia automáticamente la dirección de Contactos ni usa la geolocalización del dispositivo.',
    approximate: 'Ubicación aproximada',
    manual: 'La ubicación guardada siempre es aproximada y se confirma manualmente.',
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
    searchTitle: 'Encontrar una zona en el mapa',
    searchLabel: 'Buscar calle, código postal, localidad o dirección',
    searchPlaceholder: 'Ej.: Calle Mayor, Setúbal',
    search: 'Buscar',
    searching: 'Buscando…',
    searchPrivacy: 'La búsqueda solo se envía cuando pulsa Buscar. La dirección guardada en Contactos nunca se lee ni se envía automáticamente.',
    searchProvider: 'La búsqueda de lugares usa Photon con datos OpenStreetMap. Eutaktos no guarda el texto buscado ni lo asocia a la persona.',
    searchInvalid: 'Escriba al menos 2 caracteres para buscar.',
    searchError: 'No se pudo buscar este lugar ahora. Inténtelo de nuevo.',
    searchEmpty: 'No encontramos resultados. Pruebe otra calle, código postal o localidad.',
    searchResults: 'Resultados de búsqueda',
    useResult: 'Usar este lugar',
    pickerTitle: 'Confirmar en el mapa',
    pickerHint: 'Pulse en el mapa para elegir la zona aproximada o arrastre el marcador para ajustarla.',
    pickerLabel: 'Mapa para elegir la ubicación aproximada',
    pickerMarker: 'Ubicación aproximada seleccionada',
    advancedCoordinates: 'Ajuste avanzado por coordenadas',
    advancedHint: 'Opcional. La búsqueda y el mapa son la forma recomendada; las coordenadas quedan solo como ajuste avanzado.',
    latitude: 'Latitud',
    longitude: 'Longitud',
    latitudeHint: 'Entre -90 y 90',
    longitudeHint: 'Entre -180 y 180',
    invalidCoordinates: 'Elija un lugar en el mapa o indique valores válidos de latitud y longitud.',
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
  const searchControllerRef = useRef<AbortController | null>(null);
  const searchRequestVersionRef = useRef(0);
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
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearchState, setPlaceSearchState] = useState<PlaceSearchState>('idle');
  const [placeResults, setPlaceResults] = useState<readonly PeopleMapSearchResultDto[]>([]);
  const [selectedPlaceResultId, setSelectedPlaceResultId] = useState<string | undefined>();
  const [validationError, setValidationError] = useState(false);
  const [mutation, setMutation] = useState<'idle' | 'save' | 'remove'>('idle');
  const [mutationError, setMutationError] = useState<'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<'save' | 'remove' | null>(null);

  const groupLegend = useMemo(() => peopleMapGroupLegend(points, groups), [groups, points]);
  const ungroupedCount = useMemo(() => peopleMapUngroupedCount(points, groups), [groups, points]);
  const visiblePoints = useMemo(() => filterPeopleMapPoints(points, groups, groupFilter), [groupFilter, groups, points]);
  const draftCoordinates = useMemo(() => parseCoordinates(latitude, longitude), [latitude, longitude]);

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
      searchRequestVersionRef.current += 1;
      mutationVersionRef.current += 1;
      requestControllerRef.current?.abort();
      groupControllerRef.current?.abort();
      searchControllerRef.current?.abort();
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

  const resetPlaceSearch = () => {
    searchRequestVersionRef.current += 1;
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
    setPlaceQuery('');
    setPlaceSearchState('idle');
    setPlaceResults([]);
    setSelectedPlaceResultId(undefined);
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
    resetPlaceSearch();
    setEditor('open');
    void preparePeople();
  };

  const closeEditor = () => {
    if (mutationInFlightRef.current) return;
    resetPlaceSearch();
    setEditor('closed');
    setValidationError(false);
    setMutationError(null);
  };

  const updateDraftLocation = (nextLatitude: number, nextLongitude: number) => {
    setLatitude(draftCoordinate(nextLatitude));
    setLongitude(draftCoordinate(nextLongitude));
    setValidationError(false);
  };

  const searchPlaces = async () => {
    const query = placeQuery.trim().replace(/\s+/g, ' ');
    if (query.length < 2) {
      setPlaceSearchState('invalid');
      setPlaceResults([]);
      return;
    }
    const version = ++searchRequestVersionRef.current;
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setPlaceSearchState('loading');
    setPlaceResults([]);
    setSelectedPlaceResultId(undefined);
    try {
      const result = await peopleMapApi.search(query, controller.signal);
      if (controller.signal.aborted || version !== searchRequestVersionRef.current || !mountedRef.current) return;
      setPlaceResults(result.results);
      setPlaceSearchState(result.results.length ? 'ready' : 'empty');
    } catch {
      if (controller.signal.aborted || version !== searchRequestVersionRef.current || !mountedRef.current) return;
      setPlaceSearchState('error');
    } finally {
      if (version === searchRequestVersionRef.current) searchControllerRef.current = null;
    }
  };

  const selectPlaceResult = (result: PeopleMapSearchResultDto) => {
    setSelectedPlaceResultId(result.id);
    updateDraftLocation(result.latitude, result.longitude);
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
      resetPlaceSearch();
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
      resetPlaceSearch();
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
        <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
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

          <Card size="small" title={text.searchTitle}>
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Typography.Text type="secondary">{text.searchPrivacy}</Typography.Text>
              <Typography.Text type="secondary">{text.searchProvider}</Typography.Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  aria-label={text.searchLabel}
                  value={placeQuery}
                  placeholder={text.searchPlaceholder}
                  maxLength={200}
                  disabled={mutation !== 'idle' || placeSearchState === 'loading'}
                  onChange={event => { setPlaceQuery(event.target.value); if (placeSearchState !== 'loading') setPlaceSearchState('idle'); }}
                  onPressEnter={() => void searchPlaces()}
                />
                <Button type="primary" loading={placeSearchState === 'loading'} disabled={mutation !== 'idle'} onClick={() => void searchPlaces()}>
                  {placeSearchState === 'loading' ? text.searching : text.search}
                </Button>
              </Space.Compact>
              {placeSearchState === 'invalid' ? <Alert type="warning" showIcon title={text.searchInvalid} /> : null}
              {placeSearchState === 'error' ? <Alert type="error" showIcon title={text.searchError} action={<Button size="small" onClick={() => void searchPlaces()}>{text.retry}</Button>} /> : null}
              {placeSearchState === 'empty' ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.searchEmpty} /> : null}
              {placeSearchState === 'ready' ? <div aria-label={text.searchResults}>
                <Typography.Text strong>{text.searchResults}</Typography.Text>
                <List
                  size="small"
                  dataSource={[...placeResults]}
                  renderItem={result => <List.Item key={result.id}>
                    <Button
                      type={selectedPlaceResultId === result.id ? 'primary' : 'default'}
                      aria-pressed={selectedPlaceResultId === result.id}
                      style={{ width: '100%', whiteSpace: 'normal', height: 'auto', minHeight: 40, textAlign: 'left' }}
                      onClick={() => selectPlaceResult(result)}
                    >
                      {result.label}
                    </Button>
                  </List.Item>}
                />
              </div> : null}
            </Space>
          </Card>

          <Card size="small" title={text.pickerTitle}>
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Typography.Text type="secondary">{text.pickerHint}</Typography.Text>
              <Suspense fallback={<div role="status" aria-label={text.canvasLoading}><Skeleton active paragraph={{ rows: 6 }} /></div>}>
                <PeopleMapLocationPicker
                  latitude={draftCoordinates?.latitude}
                  longitude={draftCoordinates?.longitude}
                  label={text.pickerLabel}
                  markerLabel={text.pickerMarker}
                  disabled={mutation !== 'idle'}
                  onChange={updateDraftLocation}
                />
              </Suspense>
            </Space>
          </Card>

          <Card size="small" title={text.advancedCoordinates}>
            <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
              <Typography.Text type="secondary">{text.advancedHint}</Typography.Text>
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
            </Space>
          </Card>

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
