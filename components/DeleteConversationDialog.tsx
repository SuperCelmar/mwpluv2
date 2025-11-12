'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationName: string;
  projectName: string | null;
  onConfirm: (alsoDeleteProject: boolean) => void;
  deleting?: boolean;
}

export function DeleteConversationDialog({ 
  open, 
  onOpenChange, 
  conversationName, 
  projectName,
  onConfirm,
  deleting = false
}: DeleteConversationDialogProps) {
  const handleDeleteConversationOnly = () => {
    onConfirm(false);
  };

  const handleDeleteConversationAndProject = () => {
    onConfirm(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!deleting) {
      onOpenChange(newOpen);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {projectName 
              ? 'Supprimer la conversation et le projet ?' 
              : 'Supprimer la conversation ?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {projectName ? (
              <>
                Cette conversation est la seule conversation du projet "{projectName}".
                <br /><br />
                Voulez-vous supprimer uniquement la conversation ou également le projet associé ?
                <br /><br />
                Cette action est irréversible.
              </>
            ) : (
              <>
                Êtes-vous sûr de vouloir supprimer la conversation "{conversationName}" ?
                <br />
                Cette action est irréversible.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className={projectName ? 'flex-col sm:flex-row gap-2' : ''}>
          <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
          {projectName ? (
            <>
              <AlertDialogAction 
                onClick={handleDeleteConversationOnly} 
                disabled={deleting}
                className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer la conversation uniquement'}
              </AlertDialogAction>
              <AlertDialogAction 
                onClick={handleDeleteConversationAndProject} 
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer la conversation et le projet'}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction 
              onClick={handleDeleteConversationOnly} 
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

