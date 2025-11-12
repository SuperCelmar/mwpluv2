'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsRow({ label, description, children, className }: SettingsRowProps) {
  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {children}
        </div>
      </div>
      <Separator className="mt-4" />
    </div>
  );
}

