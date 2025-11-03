'use client';

import { cn } from '@/lib/utils';
import { AnalysisSkeleton } from './skeletons/AnalysisSkeleton';
import { MapSkeleton } from './skeletons/MapSkeleton';
import { DocumentSkeleton } from './skeletons/DocumentSkeleton';

interface ArtifactSkeletonProps {
  type: 'analysis' | 'map' | 'document';
  className?: string;
}

export function ArtifactSkeleton({ type, className }: ArtifactSkeletonProps) {
  switch (type) {
    case 'analysis':
      return <AnalysisSkeleton className={className} />;
    case 'map':
      return <MapSkeleton className={className} />;
    case 'document':
      return <DocumentSkeleton className={className} />;
    default:
      return null;
  }
}

