'use client'
import { useState } from 'react'
import { enrichConversation } from '@/lib/workers/conversationEnrichment'
import { supabase } from '@/lib/supabase'

export default function TestEnrichmentPage() {
  const [conversationId, setConversationId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbState, setDbState] = useState<any>(null)

  const runTest = async () => {
    if (!conversationId) {
      alert('Please enter a conversation ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setDbState(null)

    try {
      console.log('🧪 Starting enrichment for:', conversationId)
      
      // Run enrichment
      const enrichmentResult = await enrichConversation(conversationId)
      setResult(enrichmentResult)
      console.log('✅ Enrichment result:', enrichmentResult)

      // Check database state
      // Note: city_id and zone_id are stored in v2_research_history, not v2_conversations
      const { data: conversationData, error: convError } = await supabase
        .from('v2_conversations')
        .select('enrichment_status, context_metadata, updated_at')
        .eq('id', conversationId)
        .single()

      if (convError) throw convError

      // Also query research_history for city_id and zone_id
      const { data: researchData } = await supabase
        .from('v2_research_history')
        .select('city_id, zone_id')
        .eq('conversation_id', conversationId)
        .maybeSingle()

      const dbState = {
        ...conversationData,
        city_id: researchData?.city_id || null,
        zone_id: researchData?.zone_id || null,
      }

      setDbState(dbState)
      console.log('📊 Database state:', dbState)

    } catch (err: any) {
      console.error('❌ Test failed:', err)
      let errorMessage = err.message || 'Unknown error'
      
      // If it's a missing data error, provide helpful context
      if (errorMessage.includes('Missing required data')) {
        // Try to get the actual conversation data to show what's missing
        try {
          const { data: convData } = await supabase
            .from('v2_conversations')
            .select('context_metadata')
            .eq('id', conversationId)
            .single()
          
          const metadata = convData?.context_metadata as any
          const missing = []
          if (!metadata?.insee_code) missing.push('insee_code')
          if (!metadata?.geocoded?.lon) missing.push('geocoded.lon')
          if (!metadata?.geocoded?.lat) missing.push('geocoded.lat')
          
          errorMessage += `\n\nMissing fields: ${missing.join(', ')}\n\nExpected structure:\n{\n  "insee_code": "75056",\n  "geocoded": {\n    "lon": 2.3364,\n    "lat": 48.8606\n  }\n}\n\nActual structure:\n${JSON.stringify(metadata, null, 2)}`
        } catch (e) {
          // If we can't fetch the data, just show the original error
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createTestConversation = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in first')
        return
      }

      // FIXED: Create conversation with ALL required data
      const { data, error } = await supabase
        .from('v2_conversations')
        .insert({
          user_id: user.id,
          context_metadata: {
            initial_address: '1 Rue de Rivoli, 75001 Paris',
            geocoded: {
              lon: 2.3364,
              lat: 48.8606
            },
            insee_code: '75056', // ✅ Required for enrichment
            city: 'Paris', // Optional but helpful
            zone_label: 'UA' // Will be enriched/confirmed
          }
        })
        .select()
        .single()

      if (error) throw error

      setConversationId(data.id)
      console.log('✅ Test conversation created:', data.id)
      alert(`Test conversation created: ${data.id}`)
    } catch (err: any) {
      console.error('❌ Failed to create test conversation:', err)
      alert(`Failed to create test conversation: ${err.message}`)
    }
  }

  const useExistingConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in first')
        return
      }

      // Find any existing conversation for this user
      const { data, error } = await supabase
        .from('v2_conversations')
        .select('id, context_metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        alert('No existing conversations found. Create a test one first.')
        return
      }

      setConversationId(data.id)
      console.log('📋 Using existing conversation:', data.id)
      console.log('Context metadata:', data.context_metadata)
      
      // Check if structure needs fixing
      const metadata = data.context_metadata as any
      if (metadata?.coordinates && !metadata?.geocoded) {
        const needsFix = confirm(
          '⚠️ This conversation uses the old structure (coordinates).\n\n' +
          'Would you like to migrate it to the new structure (geocoded)?'
        )
        
        if (needsFix) {
          await fixConversationStructure(data.id, metadata)
        }
      }
      
      alert(`Using existing conversation: ${data.id}`)
    } catch (err: any) {
      alert(`Failed to find conversation: ${err.message}`)
    }
  }

  const fixConversationStructure = async (convId: string, oldMetadata: any) => {
    try {
      const newMetadata = {
        ...oldMetadata,
        geocoded: oldMetadata.coordinates || oldMetadata.geocoded || {
          lon: oldMetadata.geocoded?.lon,
          lat: oldMetadata.geocoded?.lat,
        },
        // Remove old coordinates field
        coordinates: undefined,
      }
      
      // Clean up undefined values
      delete newMetadata.coordinates
      
      const { error } = await supabase
        .from('v2_conversations')
        .update({ context_metadata: newMetadata })
        .eq('id', convId)
      
      if (error) throw error
      
      console.log('✅ Conversation structure fixed:', convId)
      alert('✅ Conversation structure has been updated!')
    } catch (err: any) {
      console.error('❌ Failed to fix structure:', err)
      alert(`Failed to fix structure: ${err.message}`)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Enrichment Worker Test</h1>

      {/* Create test conversation */}
      <div className="mb-8 p-4 bg-blue-50 rounded">
        <h2 className="text-lg font-semibold mb-2">Step 1: Get a Test Conversation</h2>
        <div className="flex gap-2">
          <button 
            onClick={createTestConversation}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create New Test Conversation
          </button>
          <button 
            onClick={useExistingConversation}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Use Existing Conversation
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          ℹ️ Test conversation will have Paris coordinates (Rue de Rivoli)
        </p>
      </div>

      {/* Input conversation ID */}
      <div className="mb-8 p-4 bg-gray-50 rounded">
        <h2 className="text-lg font-semibold mb-2">Step 2: Run Enrichment Test</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            placeholder="Enter conversation ID or use buttons above"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={runTest}
            disabled={loading || !conversationId}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Run Test'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-4 bg-yellow-50 rounded mb-4">
          <p className="text-yellow-800">⏳ Enrichment in progress...</p>
          <p className="text-sm text-yellow-600">This may take 5-10 seconds (multiple API calls)</p>
          <p className="text-sm text-yellow-600">Check browser console for detailed logs</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 rounded mb-4">
          <h3 className="font-semibold text-red-800">❌ Error</h3>
          <pre className="text-sm text-red-600 mt-2 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded">
            <h3 className="font-semibold text-green-800 mb-2">✅ Enrichment Result</h3>
            <pre className="text-sm bg-white p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {dbState && (
            <div className="p-4 bg-blue-50 rounded">
              <h3 className="font-semibold text-blue-800 mb-2">📊 Database State</h3>
              <pre className="text-sm bg-white p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(dbState, null, 2)}
              </pre>
              
              <div className="mt-4 space-y-1 text-sm">
                <p className={dbState.city_id ? 'text-green-600' : 'text-red-600'}>
                  {dbState.city_id ? '✅' : '❌'} city_id: {dbState.city_id || 'null'}
                </p>
                <p className={dbState.zone_id ? 'text-green-600' : 'text-red-600'}>
                  {dbState.zone_id ? '✅' : '❌'} zone_id: {dbState.zone_id || 'null'}
                </p>
                <p className={dbState.status === 'enriched' ? 'text-green-600' : 'text-yellow-600'}>
                  {dbState.status === 'enriched' ? '✅' : '⚠️'} status: {dbState.status || 'null'}
                </p>
                {dbState.context_metadata?.enrichment_cache && (
                  <p className="text-green-600">
                    ✅ enrichment_cache: present
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">📝 What to Look For:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>✅ cityId, zoneId, zoningId should be populated</li>
          <li>✅ Partial results shown even if some operations fail</li>
          <li>✅ Database updated with city_id, zone_id</li>
          <li>✅ status changed to 'enriched'</li>
          <li>✅ context_metadata contains enrichment_cache</li>
          <li>⚠️ errors object shows which operations failed (if any)</li>
        </ul>
      </div>

      {/* Debug helper */}
      <div className="mt-8 p-4 bg-purple-50 rounded">
        <h3 className="font-semibold mb-2">🔧 Debug: Check Conversation Data</h3>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!conversationId) {
                alert('Enter a conversation ID first')
                return
              }
              const { data } = await supabase
                .from('v2_conversations')
                .select('context_metadata')
                .eq('id', conversationId)
                .single()
              
              console.log('📋 Current context_metadata:', data?.context_metadata)
              alert(`Check console for context_metadata`)
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            View Conversation Metadata
          </button>
          <button
            onClick={async () => {
              if (!conversationId) {
                alert('Enter a conversation ID first')
                return
              }
              const { data } = await supabase
                .from('v2_conversations')
                .select('context_metadata')
                .eq('id', conversationId)
                .single()
              
              const metadata = data?.context_metadata as any
              const missing = []
              
              if (!metadata?.insee_code) missing.push('insee_code')
              if (!metadata?.geocoded?.lon) missing.push('geocoded.lon')
              if (!metadata?.geocoded?.lat) missing.push('geocoded.lat')
              
              if (missing.length > 0) {
                alert(`❌ Missing required fields:\n${missing.join('\n')}\n\nCurrent structure:\n${JSON.stringify(metadata, null, 2)}`)
              } else {
                alert(`✅ All required fields present!\n\ninsee_code: ${metadata.insee_code}\nlon: ${metadata.geocoded.lon}\nlat: ${metadata.geocoded.lat}`)
              }
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Validate Data Structure
          </button>
        </div>
      </div>
    </div>
  )
}