import { supabase } from '../supabase';
import { fetchZoneUrba, fetchMunicipality, fetchDocument } from '../carto-api';
import { getOrCreateCity, getOrCreateZoning, getOrCreateZone } from '../geo-enrichment';
import { setCachedConversationData } from '../utils/conversationCache';
import { logChatEvent } from '../analytics';
import { ConversationBranch } from '@/types/enrichment';
import { buildDocumentMetadataPayload } from '@/lib/utils/branchMetadata';

async function ensureDocumentLinks({
  conversationId,
  projectId,
  documentId,
}: {
  conversationId: string;
  projectId?: string | null;
  documentId: string;
}) {
  try {
    await supabase
      .from('v2_conversation_documents')
      .upsert(
        {
          conversation_id: conversationId,
          document_id: documentId,
          added_by: 'ai_auto',
        },
        { onConflict: 'conversation_id,document_id' }
      );

    if (projectId) {
      await supabase
        .from('v2_project_documents')
        .upsert(
          {
            project_id: projectId,
            document_id: documentId,
          },
          { onConflict: 'project_id,document_id' }
        );
    }
  } catch (linkError) {
    console.error('[ENRICHMENT_WORKER] Failed to persist document links:', linkError);
  }
}

/**
 * Operation names for enrichment tracking
 */
export type EnrichmentOperation = 
  | 'zones' 
  | 'municipality' 
  | 'city' 
  | 'zoning' 
  | 'zone' 
  | 'document' 
  | 'map';

export interface EnrichConversationOptions {
  onProgress?: (partial: Partial<EnrichmentResult>, meta?: { operation?: EnrichmentOperation }) => void;
}

/**
 * Result of enrichment operation
 */
export interface EnrichmentResult {
  cityId: string | null;
  zoneId: string | null;
  zoningId: string | null;
  documentData: {
    htmlContent: string | null;
    documentId: string | null;
    hasAnalysis: boolean;
    sourceUrl: string | null;
  } | null;
  mapGeometry: any | null;
  branchType: ConversationBranch | null;
  errors: Record<EnrichmentOperation, Error | null>;
  operationTimes: Record<EnrichmentOperation, number | null>;
}

/**
 * Enriches a conversation with all required data in parallel
 * Runs all enrichment operations concurrently without blocking
 * 
 * @param conversationId - UUID of the conversation to enrich
 * @returns Promise resolving to enrichment result with all IDs and data
 */
export async function enrichConversation(
  conversationId: string,
  options?: EnrichConversationOptions
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  console.log('[ENRICHMENT_WORKER] Starting enrichment for conversation:', conversationId);

  // Initialize result structure
  const result: EnrichmentResult = {
    cityId: null,
    zoneId: null,
    zoningId: null,
    documentData: null,
    mapGeometry: null,
    branchType: null,
    errors: {
      zones: null,
      municipality: null,
      city: null,
      zoning: null,
      zone: null,
      document: null,
      map: null,
    },
    operationTimes: {
      zones: null,
      municipality: null,
      city: null,
      zoning: null,
      zone: null,
      document: null,
      map: null,
    },
  };

  try {
    // Step 1: Load conversation and extract context
    const { data: conversation, error: convError } = await supabase
      .from('v2_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error(`Failed to load conversation: ${convError?.message || 'Not found'}`);
    }

    // Update status to in_progress
    await supabase
      .from('v2_conversations')
      .update({ enrichment_status: 'in_progress' })
      .eq('id', conversationId);

    const contextMetadata = conversation.context_metadata as any;
    const inseeCode = contextMetadata?.insee_code || '';
    const lon = contextMetadata?.geocoded?.lon;
    const lat = contextMetadata?.geocoded?.lat;
    const addressInput = contextMetadata?.initial_address || '';
    const communeName = contextMetadata?.city?.toLowerCase() || '';

    if (!inseeCode || lon === undefined || lat === undefined) {
      throw new Error('Missing required data: insee_code, lon, or lat');
    }

    console.log('[ENRICHMENT_WORKER] Context extracted:', { inseeCode, lon, lat, addressInput });

    // Step 2: Create/ensure project and research_history exist
    let projectId = conversation.project_id;
    let researchId: string | null = null;

    if (!projectId) {
      console.log('[ENRICHMENT_WORKER] Creating project');
      const { data: project, error: projectError } = await supabase
        .from('v2_projects')
        .insert({
          user_id: conversation.user_id,
          status: 'draft',
          main_address: addressInput,
          geo_lon: lon,
          geo_lat: lat,
        })
        .select('id')
        .single();

      if (projectError || !project) {
        throw new Error(`Failed to create project: ${projectError?.message}`);
      }

      projectId = project.id;
      await supabase
        .from('v2_conversations')
        .update({ project_id: projectId })
        .eq('id', conversationId);
    }

    // Check for existing research history
    const { data: existingResearch } = await supabase
      .from('v2_research_history')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingResearch) {
      researchId = existingResearch.id;
    } else {
      console.log('[ENRICHMENT_WORKER] Creating research_history');
      const { data: newResearch, error: researchError } = await supabase
        .from('v2_research_history')
        .insert({
          user_id: conversation.user_id,
          conversation_id: conversationId,
          project_id: projectId,
          address_input: addressInput,
          geo_lon: lon,
          geo_lat: lat,
          success: true,
        })
        .select('id')
        .single();

      if (!researchError && newResearch) {
        researchId = newResearch.id;
      }
    }

    // Step 3: Fetch municipality first to determine branch flow
    console.log('[ENRICHMENT_WORKER] Fetching municipality from API');
    const municipalityStart = Date.now();
    let municipality: any = null;
    try {
      municipality = await fetchMunicipality({ insee_code: inseeCode });
      result.operationTimes.municipality = Date.now() - municipalityStart;
      if (!municipality) {
        throw new Error('Municipality not found');
      }
    } catch (error) {
      result.errors.municipality = error instanceof Error ? error : new Error(String(error));
      result.operationTimes.municipality = Date.now() - municipalityStart;
      throw error;
    }

    const isRnu = municipality?.properties?.is_rnu === true;
    if (isRnu) {
      result.branchType = 'rnu';
    }

    let zones: any[] | null = null;
    let typezone: string | null = null;
    let zoneCode: string | null = null;
    let zoneName: string | null = null;
    let zoneGeometry: any | null = null;

    if (!isRnu) {
      console.log('[ENRICHMENT_WORKER] Fetching zones from API');
      const zonesStart = Date.now();
      try {
        zones = await fetchZoneUrba({ lon, lat });
        result.operationTimes.zones = Date.now() - zonesStart;

        if (zones && zones.length > 0) {
          const firstZone = zones[0];
          typezone = firstZone.properties?.typezone || null;
          zoneCode = firstZone.properties?.libelle || null;
          zoneName = firstZone.properties?.libelong || firstZone.properties?.libelle || null;
          zoneGeometry = firstZone.geometry || null;

          if (zoneGeometry) {
            options?.onProgress?.({ mapGeometry: zoneGeometry }, { operation: 'map' });
          }
        } else {
          throw new Error('No zones found');
        }
      } catch (error) {
        result.errors.zones = error instanceof Error ? error : new Error(String(error));
        result.operationTimes.zones = Date.now() - zonesStart;
        throw error;
      }
    } else {
      result.operationTimes.zones = 0;
    }

    // Dependent operations - these need results from independent operations
    const dependentOps = {
      city: async () => {
        const opStart = Date.now();
        try {
          console.log('[ENRICHMENT_WORKER] Checking/creating city');
          const finalCommuneName = municipality?.properties?.name?.toLowerCase() || communeName;
          if (!finalCommuneName || !inseeCode) {
            throw new Error('Missing commune name or INSEE code');
          }
          
          const cityId = await getOrCreateCity(inseeCode, finalCommuneName);
          result.cityId = cityId;
          result.operationTimes.city = Date.now() - opStart;
          return cityId;
        } catch (error) {
          result.errors.city = error instanceof Error ? error : new Error(String(error));
          result.operationTimes.city = Date.now() - opStart;
          throw error;
        }
      },

      zoning: async () => {
        const opStart = Date.now();
        try {
          // Wait for city to be created - check result.cityId with a small delay
          // to allow the city operation to complete (they run in parallel)
          let retries = 10;
          while (!result.cityId && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries--;
          }

          if (!result.cityId) {
            throw new Error('City ID required for zoning creation');
          }

          console.log('[ENRICHMENT_WORKER] Checking/creating zoning');
          const zoningId = await getOrCreateZoning(result.cityId, typezone || undefined, isRnu);
          result.zoningId = zoningId;
          result.operationTimes.zoning = Date.now() - opStart;
          return zoningId;
        } catch (error) {
          result.errors.zoning = error instanceof Error ? error : new Error(String(error));
          result.operationTimes.zoning = Date.now() - opStart;
          throw error;
        }
      },

      zone: async () => {
        const opStart = Date.now();
        try {
          console.log('[ENRICHMENT_WORKER] Zone operation started');
          
          // Wait for zoning to be created by the parallel zoning operation
          let retries = 20; // 2 seconds total
          while (!result.zoningId && retries > 0) {
            console.log(`[ENRICHMENT_WORKER] Waiting for zoningId... (retries left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, 100));
            retries--;
          }

          // If still no zoningId, try to create it ourselves as fallback
          if (!result.zoningId) {
            console.log('[ENRICHMENT_WORKER] zoningId not set by parallel operation, attempting fallback creation');
            if (result.cityId && (typezone || isRnu)) {
              console.log('[ENRICHMENT_WORKER] Creating zoning as fallback', { cityId: result.cityId, typezone, isRnu });
              result.zoningId = await getOrCreateZoning(result.cityId, typezone || undefined, isRnu);
              console.log('[ENRICHMENT_WORKER] Fallback zoning created:', result.zoningId);
            } else {
              console.error('[ENRICHMENT_WORKER] Cannot create zoning: missing cityId or zone type data', {
                hasCityId: !!result.cityId,
                typezone,
                isRnu,
              });
            }
          }

          // Log validation state before checking
          console.log('[ENRICHMENT_WORKER] Zone operation validation:', {
            zoningId: result.zoningId,
            zoneCode,
            zoneName,
            hasGeometry: !!zoneGeometry,
          });

          if (!result.zoningId || !zoneCode) {
            throw new Error(`Zoning ID and zone code required for zone creation. zoningId=${result.zoningId}, zoneCode=${zoneCode}`);
          }

          console.log('[ENRICHMENT_WORKER] Checking/creating zone');
          const zoneId = await getOrCreateZone(result.zoningId, zoneCode, zoneName || zoneCode, zoneGeometry);
          result.zoneId = zoneId;
          console.log('[ENRICHMENT_WORKER] Zone created/found, zone_id:', zoneId);
          result.operationTimes.zone = Date.now() - opStart;
          return zoneId;
        } catch (error) {
          console.error('[ENRICHMENT_WORKER] Zone operation failed:', error);
          result.errors.zone = error instanceof Error ? error : new Error(String(error));
          result.operationTimes.zone = Date.now() - opStart;
          throw error;
        }
      },

      document: async () => {
        const opStart = Date.now();
        try {
          // Wait for zone/zoning to be available
          let finalZoneId = result.zoneId;
          let finalZoningId = result.zoningId;

          if (!finalZoneId && !finalZoningId) {
            // Wait a bit for zone/zoning to be created
            await new Promise(resolve => setTimeout(resolve, 500));
            finalZoneId = result.zoneId;
            finalZoningId = result.zoningId;
          }

          console.log('[ENRICHMENT_WORKER] Checking documents table for existing analysis');
          
          // Check documents table first - need at least one filter to avoid multiple rows
          if (!finalZoneId && !finalZoningId) {
            console.log('[ENRICHMENT_WORKER] No zone_id or zoning_id available, skipping document check');
            result.operationTimes.document = Date.now() - opStart;
            return null;
          }

          let documentQuery = supabase.from('documents').select('*');
          if (finalZoneId) {
            documentQuery = documentQuery.eq('zone_id', finalZoneId);
          }
          if (finalZoningId) {
            documentQuery = documentQuery.eq('zoning_id', finalZoningId);
          }

          // Add limit(1) before maybeSingle() to ensure we only get one result
          const { data: document, error: queryError } = await documentQuery.limit(1).maybeSingle();

          if (queryError) {
            console.warn('[ENRICHMENT_WORKER] Document query error:', queryError);
          }

          if (document) {
            const hasContentJson = !!document.content_json;
            const hasHtmlContent = !!document.html_content;

            if (hasContentJson || hasHtmlContent) {
              console.log('[ENRICHMENT_WORKER] Analysis found in database');
              result.documentData = {
                htmlContent: document.html_content || null,
                documentId: document.id,
                hasAnalysis: true,
                sourceUrl: document.source_plu_url || null,
              };
              result.branchType = isRnu ? 'rnu' : 'non_rnu_analysis';
              options?.onProgress?.(
                {
                  documentData: result.documentData,
                  branchType: result.branchType,
                },
                { operation: 'document' }
              );
              result.operationTimes.document = Date.now() - opStart;
              return result.documentData;
            }
          }

          // If no analysis found and not RNU, try to fetch documents
          if (!isRnu && inseeCode) {
            console.log('[ENRICHMENT_WORKER] No analysis found, fetching documents from API');
            const documents = await fetchDocument({ insee_code: inseeCode });
            
            if (documents && documents.length > 0) {
              const sourcePluUrl = documents[0].properties?.document_url || null;
              
              // Create placeholder document if we have zone/zoning
              if ((finalZoneId || finalZoningId) && sourcePluUrl) {
                const typologyId = '7c0f2830-f3fc-4c69-911c-470286f91982';
                const { data: newDocument } = await supabase
                  .from('documents')
                  .insert({
                    zoning_id: finalZoningId,
                    zone_id: finalZoneId,
                    typology_id: typologyId,
                    source_plu_url: sourcePluUrl,
                  })
                  .select()
                  .single();

                if (newDocument) {
                  result.documentData = {
                    htmlContent: null,
                    documentId: newDocument.id,
                    hasAnalysis: false,
                    sourceUrl: sourcePluUrl,
                  };
                  result.branchType = isRnu ? 'rnu' : 'non_rnu_source';
                  options?.onProgress?.(
                    {
                      documentData: result.documentData,
                      branchType: result.branchType,
                    },
                    { operation: 'document' }
                  );
                }
              }
            }
          }

          if (!result.branchType) {
            result.branchType = isRnu ? 'rnu' : 'non_rnu_source';
          }

          result.operationTimes.document = Date.now() - opStart;
          return result.documentData;
        } catch (error) {
          result.errors.document = error instanceof Error ? error : new Error(String(error));
          result.operationTimes.document = Date.now() - opStart;
          throw error;
        }
      },

      map: async () => {
        const opStart = Date.now();
        try {
          // Use zone geometry from API if available, otherwise fetch from database
          if (zoneGeometry) {
            result.mapGeometry = zoneGeometry;
            options?.onProgress?.({ mapGeometry: zoneGeometry }, { operation: 'map' });
            result.operationTimes.map = Date.now() - opStart;
            return zoneGeometry;
          }

          // Try to get from database
          if (result.zoneId) {
            console.log('[ENRICHMENT_WORKER] Fetching zone geometry from database');
            const { data: zoneRecord } = await supabase
              .from('zones')
              .select('geometry')
              .eq('id', result.zoneId)
              .maybeSingle();

            if (zoneRecord && zoneRecord.geometry) {
              result.mapGeometry = zoneRecord.geometry;
              options?.onProgress?.({ mapGeometry: zoneRecord.geometry }, { operation: 'map' });
              result.operationTimes.map = Date.now() - opStart;
              return zoneRecord.geometry;
            }
          }

          // If still no geometry, use zone geometry from API response (should have been set above)
          result.mapGeometry = zoneGeometry;
          result.operationTimes.map = Date.now() - opStart;
          return zoneGeometry;
        } catch (error) {
          result.errors.map = error instanceof Error ? error : new Error(String(error));
          result.operationTimes.map = Date.now() - opStart;
          throw error;
        }
      },
    };

    // Run dependent operations in parallel
    console.log('[ENRICHMENT_WORKER] Starting dependent operations in parallel');
    const dependentTasks = [
      dependentOps.city(),
      dependentOps.zoning(),
      dependentOps.document(),
      dependentOps.map(),
    ];

    if (!isRnu && zoneCode) {
      dependentTasks.push(dependentOps.zone());
    }

    await Promise.allSettled(dependentTasks);

    // Determine final branch type
    if (!result.branchType) {
      if (isRnu) {
        result.branchType = 'rnu';
      } else if (result.documentData?.hasAnalysis) {
        result.branchType = 'non_rnu_analysis';
      } else {
        result.branchType = 'non_rnu_source';
      }
    }

    const documentMetadataPayload = buildDocumentMetadataPayload({
      branchType: result.branchType,
      documentId: result.documentData?.documentId,
      zoneCode: zoneCode || undefined,
      zoneName: zoneName || undefined,
      cityName: municipality?.properties?.name || communeName || undefined,
      sourceUrl: result.documentData?.sourceUrl,
      mapGeometryAvailable: !!result.mapGeometry,
    });

    // Step 4: Update database with enriched data
    console.log('[ENRICHMENT_WORKER] Updating database with enriched data');

    // Update research_history
    if (researchId) {
      const researchUpdate: Record<string, any> = {
        geocoded_address: municipality?.properties?.name?.toLowerCase() || communeName,
        branch_type: result.branchType,
        has_analysis: result.documentData?.hasAnalysis || false,
        is_rnu: isRnu,
        primary_document_id: result.documentData?.documentId || null,
      };

      if (documentMetadataPayload) {
        researchUpdate.document_metadata = documentMetadataPayload;
      }
      if (result.cityId) {
        researchUpdate.city_id = result.cityId;
      }
      if (result.zoneId) {
        researchUpdate.zone_id = result.zoneId;
      }
      if (result.documentData?.documentId) {
        researchUpdate.documents_found = [result.documentData.documentId];
      }

      await supabase
        .from('v2_research_history')
        .update(researchUpdate)
        .eq('id', researchId);
    }

    if (result.documentData?.documentId) {
      await ensureDocumentLinks({
        conversationId,
        projectId,
        documentId: result.documentData.documentId,
      });
    }

    // Update conversation context_metadata with enrichment data
    const updatedMetadata = {
      ...contextMetadata,
      enrichment: {
        city_id: result.cityId,
        zone_id: result.zoneId,
        zoning_id: result.zoningId,
        enriched_at: new Date().toISOString(),
        branch_type: result.branchType,
        has_analysis: result.documentData?.hasAnalysis || false,
        is_rnu: isRnu,
      },
    };

    await supabase
      .from('v2_conversations')
      .update({
        context_metadata: updatedMetadata,
        enrichment_status: 'completed',
        branch_type: result.branchType,
        has_analysis: result.documentData?.hasAnalysis || false,
        is_rnu: isRnu,
        primary_document_id: result.documentData?.documentId || null,
        document_metadata: documentMetadataPayload,
      })
      .eq('id', conversationId);

    // Step 5: Cache results
    if (result.cityId && result.zoneId && zoneCode) {
      try {
        const cityName = municipality?.properties?.name || communeName;
        await setCachedConversationData(conversationId, {
          zone_geometry: result.mapGeometry,
          zone_name: zoneCode,
          city_name: cityName,
          insee_code: inseeCode,
          has_analysis: result.documentData?.hasAnalysis || false,
          branch_type: result.branchType,
          document_summary: result.documentData?.htmlContent ? 'Analysis available' : undefined,
          cache_version: 1,
          document_metadata: documentMetadataPayload ?? undefined,
        });
      } catch (cacheError) {
        console.error('[ENRICHMENT_WORKER] Error caching results:', cacheError);
        // Don't throw - caching is non-critical
      }
    }

    // Step 6: Log analytics
    const totalTime = Date.now() - startTime;
    const successCount = Object.values(result.errors).filter(e => e === null).length;
    const failureCount = Object.values(result.errors).filter(e => e !== null).length;

    try {
      await logChatEvent({
        conversation_id: conversationId,
        message_id: conversationId, // Use conversation ID as message ID for enrichment events
        user_id: conversation.user_id,
        response_time_ms: totalTime,
        metadata: {
          enrichment_operations: {
            success: successCount,
            failed: failureCount,
            operation_times: result.operationTimes,
          },
          enrichment_result: {
            has_city: !!result.cityId,
            has_zone: !!result.zoneId,
            has_zoning: !!result.zoningId,
            has_document: !!result.documentData,
            has_geometry: !!result.mapGeometry,
          },
        },
      });
    } catch (analyticsError) {
      console.error('[ENRICHMENT_WORKER] Error logging analytics:', analyticsError);
      // Don't throw - analytics is non-critical
    }

    console.log('[ENRICHMENT_WORKER] Enrichment completed successfully', {
      totalTime,
      successCount,
      failureCount,
    });

    return result;
  } catch (error) {
    console.error('[ENRICHMENT_WORKER] Fatal error in enrichment:', error);
    
    // Update status to failed
    await supabase
      .from('v2_conversations')
      .update({ enrichment_status: 'failed' })
      .eq('id', conversationId);

    // Re-throw after updating status
    throw error;
  }
}

