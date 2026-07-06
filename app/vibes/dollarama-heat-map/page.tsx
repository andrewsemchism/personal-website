'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Mode } from './MapView';

// Leaflet touches `window`, so the map must only render on the client.
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      <span className="text-[#888e9e] font-mono text-sm">Loading map…</span>
    </div>
  ),
});

export default function DollaramaHeatMap() {
  const [mode, setMode] = useState<Mode>('density');
  const [count, setCount] = useState<number | null>(null);

  return (
    <div className="relative w-screen h-screen bg-[#274156] overflow-hidden">
      <MapView mode={mode} onLoaded={setCount} />

      {/* UI overlay — clicks pass through except on the panels */}
      <div className="pointer-events-none absolute inset-0 z-[1000] p-4 flex flex-col justify-between">
        {/* Top-left control panel */}
        <div className="flex justify-between items-start gap-4">
          <div className="pointer-events-auto bg-[#274156]/90 backdrop-blur-sm border-2 border-[#7796cb] rounded-lg p-5 max-w-sm">
            <h1 className="text-[#fbfcff] font-mono text-2xl font-bold leading-tight">
              Dollarama Heat Map
            </h1>
            <p className="text-[#888e9e] font-sans text-base mt-1">
              Every Dollarama in Canada
              {count !== null && (
                <>
                  {' '}
                  · <span className="text-[#7796cb]">{count.toLocaleString()}</span>{' '}
                  stores
                </>
              )}
            </p>

            <div className="flex gap-2 mt-4">
              {(['density', 'distance'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    'px-4 py-2 font-sans text-base rounded-lg transition-colors ' +
                    (mode === m
                      ? 'bg-[#7796cb] text-[#fbfcff]'
                      : 'bg-[#fbfcff]/5 text-[#888e9e] hover:text-[#fbfcff]')
                  }
                >
                  {m === 'density' ? 'Density' : 'Nearest'}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4">
              {mode === 'density' ? (
                <p className="text-[#888e9e] font-sans text-sm leading-snug">
                  Brighter = more Dollaramas packed together. The glow lights up
                  over cities and fades to nothing in the north.
                </p>
              ) : (
                <>
                  <p className="text-[#888e9e] font-sans text-sm mb-2 leading-snug">
                    Colour = distance to the nearest Dollarama.
                  </p>
                  <div
                    className="h-3 w-full rounded"
                    style={{
                      background:
                        'linear-gradient(to right, rgb(0,200,60), rgb(255,200,60), rgb(255,0,40))',
                    }}
                  />
                  <div className="flex justify-between text-[#888e9e] font-mono text-xs mt-1">
                    <span>close</span>
                    <span>{'≥'}50 km away</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
