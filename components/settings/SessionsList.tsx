'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getActiveSessions } from '@/lib/supabase/queries-profile';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Monitor, Smartphone, Tablet, LogOut, Loader2 } from 'lucide-react';
import { formatLastLogin } from '@/lib/utils/profile-helpers';

export function SessionsList() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const { sessions: userSessions, error } = await getActiveSessions();
    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les sessions actives',
        variant: 'destructive',
      });
    } else {
      setSessions(userSessions || []);
    }
    setLoading(false);
  };

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      // Note: Supabase doesn't have a direct API to revoke specific sessions
      // We can sign out all sessions except the current one
      // For now, we'll show a message that this feature requires backend support
      toast({
        title: 'Information',
        description: 'La révocation de sessions individuelles nécessite une configuration backend supplémentaire.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de révoquer la session',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return Monitor;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return Smartphone;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return Tablet;
    }
    return Monitor;
  };

  const getDeviceName = (userAgent: string | null) => {
    if (!userAgent) return 'Appareil inconnu';
    // Simple device detection
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Navigateur';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessions actives</CardTitle>
          <CardDescription>Gérez les appareils connectés à votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessions actives</CardTitle>
          <CardDescription>Gérez les appareils connectés à votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune session active</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions actives</CardTitle>
        <CardDescription>Gérez les appareils connectés à votre compte</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.user_agent);
            const deviceName = getDeviceName(session.user_agent);
            const isCurrentSession = session.id === (sessions[0]?.id); // Assume first is current

            return (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <DeviceIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{deviceName}</span>
                      {isCurrentSession && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Session actuelle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatLastLogin(session.created_at)}
                    </p>
                  </div>
                </div>
                {!isCurrentSession && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                  >
                    {revoking === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="h-4 w-4 mr-2" />
                        Révoquer
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

