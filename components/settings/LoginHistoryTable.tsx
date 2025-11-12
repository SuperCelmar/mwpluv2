'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getLoginHistory } from '@/lib/supabase/queries-profile';
import { CheckCircle2, XCircle } from 'lucide-react';
import { formatLastLogin } from '@/lib/utils/profile-helpers';
import { supabase } from '@/lib/supabase';

export function LoginHistoryTable() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { history: loginHistory, error } = await getLoginHistory(user.id, 50);
    if (error) {
      console.error('Error loading login history:', error);
    } else {
      setHistory(loginHistory);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique de connexion</CardTitle>
          <CardDescription>Consultez l'historique de vos tentatives de connexion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique de connexion</CardTitle>
          <CardDescription>Consultez l'historique de vos tentatives de connexion</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucun historique disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique de connexion</CardTitle>
        <CardDescription>Consultez l'historique de vos tentatives de connexion</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Appareil</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {formatLastLogin(entry.created_at)}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {entry.ip_address || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.device_type || entry.user_agent?.substring(0, 50) || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.location || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {entry.success ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm">Réussi</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">{entry.failure_reason || 'Échec'}</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

