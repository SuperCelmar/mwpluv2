'use client';

import { cn } from '@/lib/utils';

interface DocumentSkeletonProps {
  className?: string;
}

export function DocumentSkeleton({ className }: DocumentSkeletonProps) {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm p-4 animate-pulse', className)}>
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>

        {/* Row 3 */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>

        {/* Row 4 */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
        </div>

        {/* Row 5 */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

