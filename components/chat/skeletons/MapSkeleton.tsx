'use client';

import { Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapSkeletonProps {
  className?: string;
}

export function MapSkeleton({ className }: MapSkeletonProps) {
  return (
    <div
      className={cn(
        'aspect-video rounded-lg border border-gray-200 shadow-sm bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200 flex items-center justify-center relative overflow-hidden',
        className
      )}
    >
      <Map className="h-12 w-12 text-gray-300 animate-pulse" />
    </div>
  );
}

