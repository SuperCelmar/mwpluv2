'use client';

import { cn } from '@/lib/utils';

interface AnalysisSkeletonProps {
  className?: string;
}

export function AnalysisSkeleton({ className }: AnalysisSkeletonProps) {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white shadow-sm p-4 animate-pulse', className)}>
      <div className="space-y-4">
        {/* Header - title */}
        <div className="h-5 bg-gray-300 rounded w-3/4" />

        {/* Body - 3 lines of varying widths */}
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/5" />
        </div>

        {/* Footer - metadata */}
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}

