'use client';

import { cn } from '@/lib/utils';
import { Loader2, Map, FileText } from 'lucide-react';

type ArtifactStatus = 'idle' | 'loading' | 'ready';

interface InlineArtifactCardProps {
  title: string;
  description: string;
  status: ArtifactStatus;
  onOpen: () => void;
  testId: string;
  kind: 'map' | 'document';
}

export function InlineArtifactCard({ title, description, status, onOpen, testId, kind }: InlineArtifactCardProps) {
  const isReady = status === 'ready';
  const isLoading = status === 'loading';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onOpen}
      disabled={!isReady}
      className={cn(
        'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-all duration-200',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] disabled:cursor-not-allowed disabled:opacity-60'
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            kind === 'map' ? 'bg-[#E6F0FF] text-[#0066CC]' : 'bg-gray-100 text-gray-600'
          )}
        >
          {kind === 'map' ? <Map className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-600">{description}</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          {isReady ? (
            <span className="font-medium text-[#0066CC]">Ouvrir</span>
          ) : (
            <>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
              <span className="text-gray-500">{status === 'idle' ? 'En attente...' : 'Chargement...'}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

