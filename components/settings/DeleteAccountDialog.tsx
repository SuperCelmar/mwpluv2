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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { requestAccountDeletion } from '@/lib/supabase/queries-profile';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DeleteAccountDialogProps {
  userId: string;
  children: React.ReactNode;
}

export function DeleteAccountDialog({ userId, children }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible après 30 jours.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await requestAccountDeletion(userId, reason || undefined);
      if (error) {
        throw error;
      }

      toast({
        title: 'Demande de suppression enregistrée',
        description: 'Votre compte sera supprimé dans 30 jours. Vous pouvez annuler cette action depuis votre profil.',
      });

      setOpen(false);
      setReason('');
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de traiter la demande de suppression. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <DialogTitle>Supprimer mon compte</DialogTitle>
          </div>
          <DialogDescription>
            La suppression de votre compte est définitive après un délai de 30 jours.
            Toutes vos données seront supprimées de manière permanente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Attention :</strong> Cette action est irréversible. Tous vos projets,
              conversations et données seront définitivement supprimés après 30 jours.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Raison (optionnel)</Label>
            <Textarea
              id="reason"
              placeholder="Pourquoi souhaitez-vous supprimer votre compte ?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              'Confirmer la suppression'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

