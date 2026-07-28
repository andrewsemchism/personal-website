'use client';

import dynamic from 'next/dynamic';

// Canvas, localStorage and WebAudio all need the browser, so the game is client-only.
const JoSimulator = dynamic(() => import('./JoSimulator'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <span className="font-mono text-sm text-[#888e9e]">Jo se sprema…</span>
    </div>
  ),
});

export default function JoSimulatorPage() {
  return <JoSimulator />;
}
