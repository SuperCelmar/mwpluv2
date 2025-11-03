'use client';

import { Map } from 'lucide-react';

export function MapSkeleton() {
  return (
    <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-gray-400">
        <Map className="h-12 w-12" />
      </div>
    </div>
  );
}

