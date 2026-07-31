'use client';

import dynamic from 'next/dynamic';

// WebGL, canvas textures and a saved birthday — all of it is client-only.
const PoolOfLife = dynamic(() => import('./PoolOfLife'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050e18',
        color: '#6f93aa',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      Filling…
    </div>
  ),
});

export default function PoolOfLifePage() {
  return <PoolOfLife />;
}
