'use client'
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading'

export default function TestProgressivePage() {
  const { data, status, isAllComplete } = useProgressiveLoading({
    fast: () => new Promise(resolve => setTimeout(() => resolve('Fast result'), 500)),
    slow: () => new Promise(resolve => setTimeout(() => resolve('Slow result'), 2000)),
    error: () => Promise.reject(new Error('Failed'))
  })

  return (
    <div className="p-8 space-y-4">
      <h1>Test Progressive Loading</h1>
      <p>All complete: {isAllComplete ? 'Yes' : 'No'}</p>
      
      <div>
        <h2>Fast Loader</h2>
        <p>Status: {status.fast}</p>
        <p>Data: {JSON.stringify(data.fast)}</p>
      </div>
      
      <div>
        <h2>Slow Loader</h2>
        <p>Status: {status.slow}</p>
        <p>Data: {JSON.stringify(data.slow)}</p>
      </div>
      
      <div>
        <h2>Error Loader</h2>
        <p>Status: {status.error}</p>
      </div>
    </div>
  )
}