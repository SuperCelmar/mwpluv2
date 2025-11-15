'use client';

import { useRouter } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { V2Project, V2Conversation } from '@/lib/supabase';

interface ConversationBreadcrumbProps {
  project: V2Project | null;
  conversation: V2Conversation;
}

export function ConversationBreadcrumb({
  project,
  conversation,
}: ConversationBreadcrumbProps) {
  const router = useRouter();

  // Get conversation name from title or initial_address
  const conversationName =
    conversation.title ||
    (conversation.context_metadata as any)?.initial_address ||
    'Conversation';

  // Get project name (default to "Untitled Project" if null)
  const projectName = project?.name || 'Untitled Project';

  // Determine if project link should be clickable
  const hasProject = project !== null;

  return (
    <div
      className="border-b bg-white dark:bg-neutral-900 px-4 py-3"
      data-testid="conversation-breadcrumb"
    >
      <Breadcrumb>
        <BreadcrumbList className="items-center">
          {/* Project breadcrumb */}
          {hasProject ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/project/${project.id}`);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {projectName}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : (
            <>
              <BreadcrumbItem>
                <span className="text-muted-foreground">{projectName}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          {/* Conversation breadcrumb */}
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium text-foreground">
              {conversationName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

