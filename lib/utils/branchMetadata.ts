import { determineConversationBranch } from '@/lib/utils/enrichmentBranches';
import type { ConversationBranch } from '@/types/enrichment';

interface BranchDescriptor {
  branchType?: ConversationBranch | null;
  hasAnalysis?: boolean;
  isRnu?: boolean;
}

const branchBadgeMap: Record<ConversationBranch, string> = {
  rnu: 'Branche RNU',
  non_rnu_analysis: 'Branche Analyse disponible',
  non_rnu_source: 'Branche Document source',
};

function normalizeBranchType(descriptor: BranchDescriptor): ConversationBranch {
  if (descriptor.branchType && descriptor.branchType !== 'pending') {
    return descriptor.branchType;
  }

  return determineConversationBranch({
    isRnu: descriptor.isRnu ?? false,
    hasAnalysis: descriptor.hasAnalysis ?? false,
  });
}

export function formatBranchBadge(descriptor: BranchDescriptor): string {
  const branch = normalizeBranchType(descriptor);
  return branchBadgeMap[branch];
}

interface DuplicateHintInput extends BranchDescriptor {
  addressLabel?: string | null;
  zoneName?: string | null;
  documentTitle?: string | null;
  lastUpdatedAt?: string | null;
}

export interface DuplicateHintMessage {
  title: string;
  subtitle: string;
}

export function buildDuplicateHintMessage(input: DuplicateHintInput): DuplicateHintMessage {
  const badge = formatBranchBadge(input);
  const subtitleParts = [badge];

  if (input.zoneName) {
    subtitleParts.push(`Zone ${input.zoneName}`);
  }

  if (input.documentTitle) {
    subtitleParts.push(input.documentTitle);
  }

  if (input.lastUpdatedAt) {
    const formattedDate = new Date(input.lastUpdatedAt).toLocaleDateString('fr-FR');
    subtitleParts.push(`MàJ ${formattedDate}`);
  }

  const title = input.addressLabel
    ? `Analyse existante – ${input.addressLabel}`
    : 'Analyse existante';

  return {
    title,
    subtitle: subtitleParts.join(' · '),
  };
}

interface DocumentMetadataInput {
  branchType: ConversationBranch;
  documentId?: string | null;
  zoneCode?: string | null;
  zoneName?: string | null;
  cityName?: string | null;
  sourceUrl?: string | null;
  mapGeometryAvailable?: boolean;
  timestamp?: string;
}

export function buildDocumentMetadataPayload(
  input: DocumentMetadataInput
): Record<string, any> | null {
  const hasContent =
    input.documentId ||
    input.zoneCode ||
    input.zoneName ||
    input.cityName ||
    input.sourceUrl;

  if (!hasContent) {
    return null;
  }

  return {
    branch_type: input.branchType,
    document_id: input.documentId ?? null,
    zone_code: input.zoneCode ?? null,
    zone_name: input.zoneName ?? null,
    city_name: input.cityName ?? null,
    source_plu_url: input.sourceUrl ?? null,
    map_geometry_available: input.mapGeometryAvailable ?? false,
    enriched_at: input.timestamp ?? new Date().toISOString(),
  };
}

