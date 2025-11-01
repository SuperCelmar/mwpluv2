'use client';

import { Sparkles } from 'lucide-react';

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
      <div className="mb-6">
        <Sparkles className="h-16 w-16 text-[#0066CC] mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Bienvenue sur MWPLU 👋
        </h2>
        <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
          Entrez l'adresse de votre projet pour commencer l'analyse du PLU.
        </p>
      </div>
    </div>
  );
}
