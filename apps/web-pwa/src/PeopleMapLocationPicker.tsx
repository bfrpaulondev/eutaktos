import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

interface PeopleMapLocationPickerProps {
  readonly latitude?: number;
  readonly longitude?: number;
  readonly label: string;
  readonly markerLabel: string;
  readonly disabled?: boolean;
  onChange(latitude: number, longitude: number): void;
}

const DEFAULT_CENTER: [number, number] = [39.5, -8];
const DEFAULT_ZOOM = 6;
const PICKED_ZOOM = 15;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LeafletModule = typeof import('leaflet');

function validCoordinatePair(latitude?: number, longitude?: number): latitude is number {
  return typeof latitude === 'number' && Number.isFinite(latitude)
    && typeof longitude === 'number' && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function PeopleMapLocationPicker({ latitude, longitude, label, markerLabel, disabled = false, onChange }: PeopleMapLocationPickerProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const [ready, setReady] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then(module => {
      if (disposed || !elementRef.current) return;
      const hasPoint = validCoordinatePair(latitude, longitude);
      const center: [number, number] = hasPoint ? [latitude, longitude as number] : DEFAULT_CENTER;
      const map = module.map(elementRef.current, { keyboard: true, scrollWheelZoom: true }).setView(center, hasPoint ? PICKED_ZOOM : DEFAULT_ZOOM);
      module.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }).addTo(map);
      map.on('click', event => {
        if (disabledRef.current) return;
        onChangeRef.current(event.latlng.lat, event.latlng.lng);
      });
      leafletRef.current = module;
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map) return;
    if (!validCoordinatePair(latitude, longitude)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const point: [number, number] = [latitude, longitude as number];
    if (!markerRef.current) {
      const marker = leaflet.marker(point, {
        draggable: !disabled,
        keyboard: true,
        title: markerLabel,
        alt: markerLabel,
        icon: leaflet.divIcon({
          className: 'people-map-picker-marker',
          html: '<span aria-hidden="true" style="display:block;width:100%;height:100%;box-sizing:border-box;border-radius:999px;background:#ff7875;border:3px solid #a8071a;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      });
      marker.on('dragend', () => {
        if (disabledRef.current) return;
        const next = marker.getLatLng();
        onChangeRef.current(next.lat, next.lng);
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(point);
      if (disabled) markerRef.current.dragging?.disable();
      else markerRef.current.dragging?.enable();
    }
    map.setView(point, Math.max(map.getZoom(), PICKED_ZOOM));
  }, [disabled, latitude, longitude, markerLabel, ready]);

  return <div
    ref={elementRef}
    role="region"
    aria-label={label}
    aria-disabled={disabled || undefined}
    tabIndex={0}
    style={{ minHeight: 320, width: '100%', borderRadius: 8, overflow: 'hidden', outlineOffset: 3 }}
  />;
}
