import type { ConversationBranch } from '@/types/enrichment';

interface BranchParams {
  isRnu: boolean;
  hasAnalysis: boolean;
}

export function determineConversationBranch({ isRnu, hasAnalysis }: BranchParams): ConversationBranch {
  throw new Error('determineConversationBranch not implemented yet');
}
