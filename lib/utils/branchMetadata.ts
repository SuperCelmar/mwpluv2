import { determineConversationBranch } from '@/lib/utils/enrichmentBranches';
import type { ConversationBranch } from '@/types/enrichment';

interface BranchDescriptor {
  branchType?: ConversationBranch | null;
  hasAnalysis?: boolean;
  isRnu?: boolean;
}

type PanelTab = 'map' | 'document';

type ArtifactPanelStatus = 'loading' | 'ready' | 'error';

interface PanelArtifactSnapshot {
  status?: ArtifactPanelStatus;
  rendering_status?: 'pending' | 'rendering' | 'complete';
  updated_at?: string;
}

interface PanelArtifactsSnapshot {
  map?: PanelArtifactSnapshot;
  document?: PanelArtifactSnapshot;
}

interface PanelStateSnapshot {
  panel_state?: {
    active_tab?: PanelTab;
    updated_at?: string;
  };
  artifacts?: PanelArtifactsSnapshot;
  branch_type?: ConversationBranch;
}

interface PanelStateUpdate {
  activeTab?: PanelTab;
  artifacts?: PanelArtifactsSnapshot;
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

  const enrichedAt = input.timestamp ?? new Date().toISOString();

  return {
    branch_type: input.branchType,
    document_id: input.documentId ?? null,
    zone_code: input.zoneCode ?? null,
    zone_name: input.zoneName ?? null,
    city_name: input.cityName ?? null,
    source_plu_url: input.sourceUrl ?? null,
    map_geometry_available: input.mapGeometryAvailable ?? false,
    enriched_at: enrichedAt,
    artifacts: {
      map: {
        status: input.mapGeometryAvailable ? 'ready' : 'loading',
        updated_at: enrichedAt,
      },
      document: {
        status: input.documentId ? 'ready' : 'loading',
        updated_at: enrichedAt,
      },
    },
  };
}

interface BranchCopyInput extends BranchDescriptor {
  zoneName?: string | null;
}

interface BranchLoadingMessages {
  step1: string;
  step2: string;
  step3?: string;
}

export function getBranchLoadingMessages(
  descriptor: BranchDescriptor
): BranchLoadingMessages {
  const branch = normalizeBranchType(descriptor);

  const base: BranchLoadingMessages = {
    step1: 'Vérification de la zone concernée...',
    step2:
      branch === 'rnu'
        ? 'Récupération du RNU...'
        : "Vérification de la présence d'analyse...",
  };

  if (branch === 'non_rnu_analysis') {
    base.step3 = "Récupération de l'analyse correspondante...";
  }

  return base;
}

interface FinalAssistantCopy {
  title: string;
  description?: string;
}

export function getFinalAssistantCopy(
  descriptor: BranchCopyInput
): FinalAssistantCopy {
  const branch = normalizeBranchType(descriptor);
  if (branch === 'rnu') {
    return { title: 'Voici le RNU.' };
  }

  if (branch === 'non_rnu_analysis') {
    const zoneSegment = descriptor.zoneName
      ? ` de la zone ${descriptor.zoneName}`
      : ' de cette zone';
    return { title: `Voici l'analyse${zoneSegment}.` };
  }

  return {
    title: "Nous n'avons pas encore couvert cette zone.",
    description: 'Voici le lien vers le document source.',
  };
}

export function resolvePanelState(
  metadata?: PanelStateSnapshot | null
): { activeTab: PanelTab } {
  if (!metadata) {
    return { activeTab: 'map' };
  }

  const persisted = metadata.panel_state?.active_tab;
  if (persisted === 'map' || persisted === 'document') {
    return { activeTab: persisted };
  }

  const branch = metadata.branch_type;
  const documentReady =
    metadata.artifacts?.document?.status === 'ready' ||
    branch === 'non_rnu_analysis';

  if (documentReady) {
    return { activeTab: 'document' };
  }

  return { activeTab: 'map' };
}

export function mergePanelStateMetadata(
  current: Record<string, any> | null | undefined,
  updates: PanelStateUpdate
): Record<string, any> {
  const next = { ...(current ?? {}) };
  const timestamp = new Date().toISOString();

  if (updates.activeTab) {
    next.panel_state = {
      ...(next.panel_state ?? {}),
      active_tab: updates.activeTab,
      updated_at: timestamp,
    };
  }

  if (updates.artifacts) {
    const existingArtifacts = next.artifacts ?? {};
    const merged: PanelArtifactsSnapshot = { ...existingArtifacts };

    (['map', 'document'] as const).forEach((key) => {
      if (updates.artifacts?.[key]) {
        merged[key] = {
          ...existingArtifacts[key],
          ...updates.artifacts?.[key],
          updated_at: timestamp,
        };
      }
    });

    next.artifacts = merged;
  }

  return next;
}

