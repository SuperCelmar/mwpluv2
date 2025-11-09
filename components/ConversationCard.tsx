'use client';

import { useRouter } from 'next/navigation';
import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatConversation } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConversationCardProps {
  Conversation: ChatConversation;
  lastMessage?: string;
}

export function ConversationCard({ Conversation, lastMessage }: ConversationCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/chat/${Conversation.id}`);
  };

  const timeAgo = formatDistanceToNow(new Date(Conversation.last_message_at || Conversation.created_at), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
      onClick={handleClick}
    >
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-sm sm:text-base font-medium">Conversation</CardTitle>
        <CardDescription className="flex items-center gap-1.5 text-xs sm:text-sm">
          <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
          Document PLU
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3 pt-0 sm:p-6 sm:pt-0 sm:space-y-2">
        {lastMessage && (
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
            {lastMessage}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[0.6875rem] sm:text-xs text-gray-500">
          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          <span>Mis à jour {timeAgo}</span>
        </div>
      </CardContent>
    </Card>
  );
}
