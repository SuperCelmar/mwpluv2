import type { ConversationBranch } from '@/types/enrichment';

interface BranchParams {
  isRnu: boolean;
  hasAnalysis: boolean;
}

export function determineConversationBranch({ isRnu, hasAnalysis }: BranchParams): ConversationBranch {
  if (isRnu) {
    return 'rnu';
  }

  if (hasAnalysis) {
    return 'non_rnu_analysis';
  }

  return 'non_rnu_source';
}
