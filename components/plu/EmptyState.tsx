'use client';

import Image from 'next/image';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="mb-8">
        <div className="flex justify-center mb-4">
          <Image
            src="/MWPLU.svg"
            alt="MWPLU"
            width={240}
            height={80}
            className="h-16 w-auto"
            priority
          />
        </div>
      </div>
      <h2 className="text-3xl font-semibold text-gray-900 mb-4 max-w-2xl">
        Analysez votre PLU en quelques secondes
      </h2>
      <p className="text-lg text-gray-600 max-w-xl">
        Entrez l'adresse de votre projet pour commencer
      </p>
    </div>
  );
}
