'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { exportUserData } from '@/lib/supabase/queries-profile';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataExportDialogProps {
  userId: string;
  children: React.ReactNode;
}

export function DataExportDialog({ userId, children }: DataExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await exportUserData(userId);
      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No data to export');
      }

      // Create download
      const blob = new Blob(
        [format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data)],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mwplu-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: 'Vos données ont été téléchargées avec succès.',
      });

      setOpen(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter vos données. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any): string => {
    // Simple CSV conversion for main data
    const lines: string[] = [];
    
    // Profile
    if (data.profile) {
      lines.push('Type,Field,Value');
      Object.entries(data.profile).forEach(([key, value]) => {
        lines.push(`Profile,${key},"${value}"`);
      });
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      lines.push('');
      lines.push('Projects');
      const headers = Object.keys(data.projects[0]).join(',');
      lines.push(headers);
      data.projects.forEach((project: any) => {
        lines.push(Object.values(project).map(v => `"${v}"`).join(','));
      });
    }

    return lines.join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Télécharger mes données</DialogTitle>
          <DialogDescription>
            Téléchargez une copie de toutes vos données au format JSON ou CSV.
            Cela inclut votre profil, projets, conversations et messages.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Format d'export</label>
            <Select value={format} onValueChange={(value: 'json' | 'csv') => setFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON (recommandé)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Les données exportées incluront :
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Informations de profil</li>
              <li>Tous vos projets</li>
              <li>Toutes vos conversations</li>
              <li>Tous vos messages</li>
              <li>Vos paramètres</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Télécharger
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

