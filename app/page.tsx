'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the Player component with no SSR
const Player = dynamic(() => import('../components/Player'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Suspense fallback={<div>Loading player...</div>}>
        <Player />
      </Suspense>
    </main>
  );
} 