'use client';

import { MapPin, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/lib/store';

export function ContextBadge() {
  const { getActiveConversation } = useChatStore();
  const conversation = getActiveConversation();

  if (!conversation) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
      <Badge variant="outline" className="gap-1 bg-white">
        <MapPin className="h-3 w-3" />
        {conversation.zoneLabel}
      </Badge>
      <Badge variant="outline" className="gap-1 bg-white">
        <Home className="h-3 w-3" />
        PLU de {conversation.city}
      </Badge>
    </div>
  );
}
