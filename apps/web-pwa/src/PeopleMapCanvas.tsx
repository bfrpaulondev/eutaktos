import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { PeopleMapPointDto } from './lib/peopleMapApi';

interface PeopleMapCanvasProps {
  readonly points: readonly PeopleMapPointDto[];
  readonly selectedPersonId?: string;
  onSelect(personId: string): void;
  readonly label: string;
}

const DEFAULT_CENTER: [number, number] = [39.5, -8];
const DEFAULT_ZOOM = 6;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LeafletModule = typeof import('leaflet');

export function PeopleMapCanvas({ points, selectedPersonId, onSelect, label }: PeopleMapCanvasProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then(module => {
      if (disposed || !elementRef.current) return;
      const map = module.map(elementRef.current, { keyboard: true, scrollWheelZoom: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      module.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
        crossOrigin: 'anonymous',
        referrerPolicy: 'no-referrer',
      }).addTo(map);
      leafletRef.current = module;
      mapRef.current = map;
      markersRef.current = module.layerGroup().addTo(map);
      setReady(true);
    });

    return () => {
      disposed = true;
      markersRef.current?.clearLayers();
      markersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!ready || !leaflet || !map || !markers) return;

    markers.clearLayers();
    const bounds: [number, number][] = [];
    for (const point of points) {
      const selected = point.personId === selectedPersonId;
      const marker = leaflet.marker([point.latitude, point.longitude], {
        keyboard: true,
        title: point.displayName,
        alt: point.displayName,
        icon: leaflet.divIcon({
          className: selected ? 'people-map-marker people-map-marker-selected' : 'people-map-marker',
          html: `<span aria-hidden="true" style="display:block;width:100%;height:100%;box-sizing:border-box;border-radius:999px;background:${selected ? '#69b1ff' : '#91caff'};border:${selected ? '3px solid #0958d9' : '2px solid #1677ff'};box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`,
          iconSize: selected ? [20, 20] : [14, 14],
          iconAnchor: selected ? [10, 10] : [7, 7],
        }),
      });
      const selectPoint = () => onSelectRef.current(point.personId);
      marker.bindTooltip(point.displayName, { direction: 'top', opacity: 0.9 });
      marker.on('click', selectPoint);
      marker.addTo(markers);
      // Leaflet exposes a focusable marker element but does not consistently emit
      // a layer click for Enter/Space across browsers and headless Chromium.
      marker.getElement()?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectPoint();
        }
      });
      bounds.push([point.latitude, point.longitude]);
    }

    if (bounds.length === 1) map.setView(bounds[0], 10);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
    else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }, [points, ready, selectedPersonId]);

  return <div
    ref={elementRef}
    role="region"
    aria-label={label}
    tabIndex={0}
    style={{ minHeight: 340, width: '100%', borderRadius: 8, overflow: 'hidden', outlineOffset: 3 }}
  />;
}
