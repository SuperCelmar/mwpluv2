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
      <AlertDialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
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
        <AlertDialogFooter className={projectName ? '!flex-col !sm:flex-row gap-2 sm:justify-end' : ''}>
          {projectName ? (
            <>
              <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto order-3 sm:order-1">Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConversationOnly} 
                disabled={deleting}
                className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 w-full sm:w-auto order-2"
              >
                {deleting ? 'Suppression...' : 'Supprimer la conversation uniquement'}
              </AlertDialogAction>
              <AlertDialogAction 
                onClick={handleDeleteConversationAndProject} 
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 w-full sm:w-auto order-1 sm:order-3"
              >
                {deleting ? 'Suppression...' : 'Supprimer la conversation et le projet'}
              </AlertDialogAction>
            </>
          ) : (
            <>
              <AlertDialogAction 
                onClick={handleDeleteConversationOnly} 
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </AlertDialogAction>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

