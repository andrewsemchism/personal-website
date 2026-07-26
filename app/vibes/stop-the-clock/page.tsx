'use client';

import dynamic from 'next/dynamic';

// Score history lives in localStorage, so the game only renders on the client.
const StopTheClock = dynamic(() => import('./StopTheClock'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-[#888e9e] font-mono text-sm">Loading…</span>
    </div>
  ),
});

export default function StopTheClockPage() {
  return <StopTheClock />;
}
