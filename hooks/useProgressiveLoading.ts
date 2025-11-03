'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * Status of an individual loader
 */
type LoaderStatus = 'pending' | 'loading' | 'success' | 'error';

/**
 * Return type for useProgressiveLoading hook
 */
export interface UseProgressiveLoadingReturn<T extends Record<string, any>> {
  /** Loaded data, keyed by loader name */
  data: Partial<T>;
  /** Status of each loader */
  status: Record<keyof T, LoaderStatus>;
  /** Errors for each loader, null if no error */
  errors: Record<keyof T, Error | null>;
  /** True when all loaders have completed (success or error) */
  isAllComplete: boolean;
  /** Refresh a single loader by key */
  refresh: (key: keyof T) => void;
  /** Refresh all loaders */
  refreshAll: () => void;
}

/**
 * React hook for managing multiple parallel async loaders with independent status tracking.
 * 
 * Starts all loaders in parallel on mount and updates state independently as each completes.
 * Supports individual and batch retry capabilities with proper cleanup on unmount.
 * 
 * @template T - Object type where keys are loader names and values are the loaded data types
 * @param loaders - Record of loader functions, each returning a Promise
 * @returns Object with data, status, errors, completion flag, and refresh functions
 * 
 * @example
 * ```typescript
 * const { data, status, errors, isAllComplete, refresh, refreshAll } = useProgressiveLoading({
 *   zones: () => fetchZones(coordinates),
 *   documents: () => fetchDocuments(zoneId),
 *   map: () => fetchMapGeometry(zoneId)
 * });
 * 
 * // Render based on individual status:
 * {status.zones === 'loading' && <Skeleton />}
 * {status.zones === 'success' && <ZoneCard data={data.zones} />}
 * {status.zones === 'error' && <ErrorCard error={errors.zones} />}
 * 
 * // Retry a single loader:
 * <button onClick={() => refresh('zones')}>Retry Zones</button>
 * 
 * // Retry all:
 * <button onClick={refreshAll}>Retry All</button>
 * ```
 */
export function useProgressiveLoading<T extends Record<string, any>>(
  loaders: Record<keyof T, () => Promise<any>>
): UseProgressiveLoadingReturn<T> {
  // Store loaders in ref to prevent infinite loops when object reference changes
  const loadersRef = useRef(loaders);
  loadersRef.current = loaders;

  // Initialize state with all loaders in 'loading' state (since we start immediately)
  // Use function initializer to avoid dependency issues
  const [data, setData] = useState<Partial<T>>({});
  const [status, setStatus] = useState<Record<keyof T, LoaderStatus>>(() => {
    const initial = {} as Record<keyof T, LoaderStatus>;
    for (const key in loaders) {
      initial[key] = 'loading';
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<keyof T, Error | null>>(() => {
    const initial = {} as Record<keyof T, Error | null>;
    for (const key in loaders) {
      initial[key] = null;
    }
    return initial;
  });

  /**
   * Execute a single loader and update its state
   */
  const executeLoader = useCallback(
    async (key: keyof T, mounted: { current: boolean }) => {
      // Update status to loading
      if (mounted.current) {
        setStatus((prev) => ({ ...prev, [key]: 'loading' }));
        setErrors((prev) => ({ ...prev, [key]: null }));
      }

      try {
        // Use ref to get current loaders to avoid dependency issues
        const loader = loadersRef.current[key];
        if (!loader) {
          throw new Error(`No loader found for key: ${String(key)}`);
        }

        const result = await loader();

        // Only update state if component is still mounted
        if (mounted.current) {
          setData((prev) => ({ ...prev, [key]: result }));
          setStatus((prev) => ({ ...prev, [key]: 'success' }));
          setErrors((prev) => ({ ...prev, [key]: null }));
        }
      } catch (error) {
        // Only update state if component is still mounted
        if (mounted.current) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          setStatus((prev) => ({ ...prev, [key]: 'error' }));
          setErrors((prev) => ({ ...prev, [key]: errorObj }));
          // Clear data for this key on error (optional - could keep previous data)
          setData((prev) => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        }
      }
    },
    [] // No dependencies - use ref instead
  );

  /**
   * Execute all loaders in parallel
   */
  const executeAllLoaders = useCallback(
    async (mounted: { current: boolean }) => {
      // Use ref to get current loader keys to avoid dependency issues
      const keys = Object.keys(loadersRef.current) as Array<keyof T>;
      
      // Start all loaders in parallel using Promise.allSettled
      // We don't wait for all to complete - each updates independently
      const promises = keys.map((key) => executeLoader(key, mounted));
      
      // Fire and forget - each promise handles its own state updates
      Promise.allSettled(promises).catch((error) => {
        // This shouldn't happen, but log if it does
        console.error('[useProgressiveLoading] Unexpected error in Promise.allSettled:', error);
      });
    },
    [executeLoader] // Only depends on executeLoader, which is stable now
  );

  // Execute all loaders once on mount only
  useEffect(() => {
    const mounted = { current: true };

    executeAllLoaders(mounted);

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  /**
   * Refresh a single loader
   */
  const refresh = useCallback(
    (key: keyof T) => {
      const mounted = { current: true };
      executeLoader(key, mounted);
    },
    [executeLoader]
  );

  /**
   * Refresh all loaders
   */
  const refreshAll = useCallback(() => {
    const mounted = { current: true };
    executeAllLoaders(mounted);
  }, [executeAllLoaders]);

  /**
   * Compute if all loaders are complete (success or error)
   */
  const isAllComplete = useMemo(() => {
    const statuses = Object.values(status);
    return (
      statuses.length > 0 &&
      statuses.every((s) => s === 'success' || s === 'error')
    );
  }, [status]);

  return {
    data,
    status,
    errors,
    isAllComplete,
    refresh,
    refreshAll,
  };
}

