'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RenameConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string | null;
  onSave: (newTitle: string) => Promise<void>;
}

export function RenameConversationDialog({
  open,
  onOpenChange,
  currentTitle,
  onSave,
}: RenameConversationDialogProps) {
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setNewTitle(currentTitle || '');
      setError('');
    } else {
      setNewTitle('');
      setError('');
    }
  }, [open, currentTitle]);

  const handleSave = async () => {
    if (!newTitle.trim()) {
      setError('Le nom de la conversation est requis');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave(newTitle.trim());
      onOpenChange(false);
    } catch (err) {
      console.error('Error renaming conversation:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Renommer la conversation</DialogTitle>
          <DialogDescription>
            Modifiez le nom de cette conversation. Ce nom sera utilisé pour
            l'identifier dans votre liste de conversations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="conversation-title">
              Nom de la conversation <span className="text-red-500">*</span>
            </Label>
            <Input
              id="conversation-title"
              placeholder="Ex: Analyse PLU - Rue de la Paix"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                setError('');
              }}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) {
                  handleSave();
                }
              }}
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

