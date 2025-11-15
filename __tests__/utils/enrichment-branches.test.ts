import { describe, it, expect } from 'vitest';
import { determineConversationBranch } from '@/lib/utils/enrichmentBranches';

describe('determineConversationBranch', () => {
  it('returns rnu when municipality is RNU regardless of analysis', () => {
    expect(
      determineConversationBranch({ isRnu: true, hasAnalysis: false })
    ).toBe('rnu');
    expect(
      determineConversationBranch({ isRnu: true, hasAnalysis: true })
    ).toBe('rnu');
  });

  it('returns analysis branch when not RNU but analysis exists', () => {
    expect(
      determineConversationBranch({ isRnu: false, hasAnalysis: true })
    ).toBe('non_rnu_analysis');
  });

  it('returns source branch when neither RNU nor analysis available', () => {
    expect(
      determineConversationBranch({ isRnu: false, hasAnalysis: false })
    ).toBe('non_rnu_source');
  });
});
