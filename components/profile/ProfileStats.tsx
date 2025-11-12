'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen, FileText, Clock, Star } from 'lucide-react';
import { calculateHoursSaved } from '@/lib/utils/profile-helpers';

interface ProfileStatsProps {
  projectsCount: number;
  documentsCount: number;
  starredProjectsCount: number;
  loading?: boolean;
}

export function ProfileStats({
  projectsCount,
  documentsCount,
  starredProjectsCount,
  loading = false,
}: ProfileStatsProps) {
  const hoursSaved = calculateHoursSaved(projectsCount, documentsCount);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Projets créés',
      value: projectsCount,
      icon: FolderOpen,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Documents analysés',
      value: documentsCount,
      icon: FileText,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Heures économisées',
      value: `~${hoursSaved}h`,
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Projets favorisés',
      value: starredProjectsCount,
      icon: Star,
      color: 'text-yellow-600 dark:text-yellow-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

