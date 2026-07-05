'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';
import { Store, StoreIndex, distanceColor } from './heatUtils';

export type Mode = 'density' | 'distance';

// Distance (km) at which the distance-to-nearest ramp saturates to red.
const MAX_DISTANCE_KM = 50;
// Pixel block size for the distance overlay (bigger = faster, blockier).
const BLOCK_PX = 8;

export default function MapView({
  mode,
  onLoaded,
}: {
  mode: Mode;
  onLoaded?: (count: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const indexRef = useRef<StoreIndex | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const applyModeRef = useRef<((m: Mode) => void) | null>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  // Init map + load data once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [58, -96],
      zoom: 4,
      minZoom: 3,
      worldCopyJump: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // Canvas overlay for the distance-to-nearest field. Lives in the overlay
    // pane so it pans with the map; redrawn on moveend/zoomend/resize.
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'none';
    map.getPanes().overlayPane.appendChild(canvas);
    canvasRef.current = canvas;

    const drawDistance = () => {
      const index = indexRef.current;
      if (!index || canvas.style.display === 'none') return;
      const size = map.getSize();
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      canvas.width = size.x;
      canvas.height = size.y;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size.x, size.y);
      // Coarsen the grid when zoomed out so a country-wide view doesn't sample
      // hundreds of thousands of cells.
      const block = map.getZoom() <= 5 ? BLOCK_PX * 2 : BLOCK_PX;
      for (let py = 0; py < size.y; py += block) {
        for (let px = 0; px < size.x; px += block) {
          const ll = map.containerPointToLatLng([px + block / 2, py + block / 2]);
          // Pass the ramp's max as a search cap so far-from-any-store pixels
          // stop searching early instead of scanning the whole index.
          const km = index.nearestKm(ll.lat, ll.lng, MAX_DISTANCE_KM);
          const [r, g, b] = distanceColor(km, MAX_DISTANCE_KM);
          ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
          ctx.fillRect(px, py, block, block);
        }
      }
    };
    map.on('moveend zoomend resize', drawDistance);

    const applyMode = (m: Mode) => {
      // Density heat layer
      if (heatRef.current) {
        if (m === 'density') heatRef.current.addTo(map);
        else if (map.hasLayer(heatRef.current)) map.removeLayer(heatRef.current);
      }
      // Distance canvas
      canvas.style.display = m === 'distance' ? 'block' : 'none';
      if (m === 'distance') drawDistance();
    };
    applyModeRef.current = applyMode;

    let cancelled = false;
    fetch('/vibes/dollarama-stores.json')
      .then((r) => r.json())
      .then((stores: Store[]) => {
        if (cancelled) return;
        heatRef.current = L.heatLayer(
          stores.map((s) => [s.lat, s.lng, 1] as [number, number, number]),
          { radius: 16, blur: 14, maxZoom: 9 },
        );
        indexRef.current = new StoreIndex(stores);
        onLoaded?.(stores.length);
        applyMode(modeRef.current);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map.off('moveend zoomend resize', drawDistance);
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
      indexRef.current = null;
      canvasRef.current = null;
      applyModeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap layers when the mode toggles.
  useEffect(() => {
    applyModeRef.current?.(mode);
  }, [mode]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
