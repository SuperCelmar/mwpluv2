'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationModal({ open, onOpenChange }: NewConversationModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ConversationType, setConversationType] = useState<string>('');
  const [client, setClient] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Le nom du projet est requis');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Create v2_project with user-provided name and type
      const { data: project, error: projectError } = await supabase
        .from('v2_projects')
        .insert({
          user_id: user.id,
          name: name.trim(),
          project_type: ConversationType || null,
          status: 'active', // Since user provided a name, project is active
        })
        .select()
        .single();

      if (projectError || !project) {
        throw projectError || new Error('Failed to create project');
      }

      // 2. Create v2_conversation linked to the project
      const { data: conversation, error: conversationError } = await supabase
        .from('v2_conversations')
        .insert({
          user_id: user.id,
          project_id: project.id,
          conversation_type: 'general', // General conversation until address is provided
          title: name.trim(),
          is_active: true,
        })
        .select()
        .single();

      if (conversationError || !conversation) {
        throw conversationError || new Error('Failed to create conversation');
      }

      // 3. Navigate to chat
      onOpenChange(false);
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setConversationType('');
      setClient('');
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet</DialogTitle>
            <DialogDescription>
              Renseignez les informations de votre projet
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nom du projet <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: Rénovation appartement Paris 11ème"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type de projet</Label>
              <Select value={ConversationType} onValueChange={setConversationType} disabled={loading}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="extension">Extension</SelectItem>
                  <SelectItem value="renovation">Rénovation</SelectItem>
                  <SelectItem value="amenagement">Aménagement</SelectItem>
                  <SelectItem value="lotissement">Lotissement</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer le projet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
