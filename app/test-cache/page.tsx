'use client'
import { useConversationCache } from '@/hooks/useConversationCache'

export default function TestCachePage() {
  // Use a valid UUID for testing (replace with a real conversation ID from your database)
  const TEST_CONV_ID = '45309f01-6074-4cc2-9ab2-426f64b4430c'
  const { cachedData, isLoading, refreshCache } = useConversationCache(TEST_CONV_ID)

  const handleSetCache = async () => {
    await refreshCache({
      zone_geometry: {
        type: 'Polygon',
        coordinates: [
          [[2.3397, 48.8606], [2.3397, 48.8606], [2.3397, 48.8606], [2.3397, 48.8606]]
        ]
      },
      zone_name: 'UA',
      city_name: 'Paris',
      insee_code: '75056',
      has_analysis: true,
      document_summary: 'Test document summary',
      cache_version: 1
    })
  }

  return (
    <div className="p-8">
      <h1>Test Conversation Cache</h1>
      <p className="mb-4">Conversation ID: {TEST_CONV_ID}</p>
      {isLoading ? (
        <p>Loading cache...</p>
      ) : (
        <>
          <button onClick={handleSetCache} className="btn mb-4">Set Cache</button>
          <div>
            <h2 className="text-lg font-semibold mb-2">Cached Data:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {cachedData ? JSON.stringify(cachedData, null, 2) : 'No cached data'}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}