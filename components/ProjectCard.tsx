'use client';

import { useRouter } from 'next/navigation';
import { MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectCardProps {
  project: Project;
  lastMessage?: string;
}

export function ProjectCard({ project, lastMessage }: ProjectCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/project/${project.id}`);
  };

  const timeAgo = formatDistanceToNow(new Date(project.updated_at), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="text-xl">{project.name}</CardTitle>
        {project.address && (
          <CardDescription className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {project.address}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {lastMessage && (
          <p className="text-sm text-gray-600 line-clamp-2">
            {lastMessage}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Mis à jour {timeAgo}</span>
        </div>
      </CardContent>
    </Card>
  );
}
