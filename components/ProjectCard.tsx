'use client';

import { useRouter } from 'next/navigation';
import { MapPin, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { V2Project, V2Conversation } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectCardProps {
  project: V2Project & {
    conversations?: V2Conversation[];
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  // Get most recent conversation
  const mostRecentConversation = project.conversations && project.conversations.length > 0
    ? project.conversations.sort((a, b) => {
        const timeA = a.last_message_at || a.created_at;
        const timeB = b.last_message_at || b.created_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      })[0]
    : null;

  const conversationCount = project.conversations?.length || 0;
  const lastActivity = mostRecentConversation?.last_message_at || mostRecentConversation?.created_at || project.updated_at;

  const handleClick = () => {
    if (mostRecentConversation) {
      router.push(`/chat/${mostRecentConversation.id}`);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'completed':
        return 'outline';
      case 'archived':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'active':
        return 'Actif';
      case 'completed':
        return 'Terminé';
      case 'archived':
        return 'Archivé';
      default:
        return status;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(lastActivity), {
    addSuffix: true,
    locale: fr,
  });

  const projectName = project.name || 'Sans nom';

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{project.icon || '📁'}</span>
            <CardTitle className="text-xl truncate">{projectName}</CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant(project.status)}>
            {getStatusLabel(project.status)}
          </Badge>
        </div>
        {project.main_address && (
          <CardDescription className="flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{project.main_address}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {conversationCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span>{conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Mis à jour {timeAgo}</span>
        </div>
      </CardContent>
    </Card>
  );
}
