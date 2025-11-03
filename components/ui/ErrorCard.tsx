'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
      <p className="text-sm text-red-800 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

