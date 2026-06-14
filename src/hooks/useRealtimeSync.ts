import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseService';
import { enhancedActivityService } from '../services/enhancedActivityService';
import { Deal } from '../types';

export interface RealtimeSyncOptions {
  dealId: string;
  onActivitiesChange?: (activities: any[]) => void;
  onSyncVersionChange?: (version: number) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export const useRealtimeSync = ({
  dealId,
  onActivitiesChange,
  onSyncVersionChange,
  onError,
  enabled = true
}: RealtimeSyncOptions) => {
  const subscriptionRef = useRef<any>(null);
  const lastVersionRef = useRef<number>(0);

  // Initialize sync version
  const initializeSyncVersion = useCallback(async () => {
    try {
      const version = await enhancedActivityService.getSyncVersion('deal', dealId);
      lastVersionRef.current = version;
      onSyncVersionChange?.(version);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [dealId, onSyncVersionChange, onError]);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(async (payload: any) => {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Increment sync version
      const newVersion = await enhancedActivityService.incrementSyncVersion('deal', dealId);
      lastVersionRef.current = newVersion;
      onSyncVersionChange?.(newVersion);

      // Handle different types of changes
      if (eventType === 'INSERT' && newRecord.deal_id === dealId) {
        // New activity created
        const activities = await enhancedActivityService.getActivitiesForDeal(dealId, { limit: 50 });
        onActivitiesChange?.(activities.activities);
      } else if (eventType === 'UPDATE' && newRecord.deal_id === dealId) {
        // Activity updated
        const activities = await enhancedActivityService.getActivitiesForDeal(dealId, { limit: 50 });
        onActivitiesChange?.(activities.activities);
      } else if (eventType === 'DELETE' && oldRecord.deal_id === dealId) {
        // Activity deleted
        const activities = await enhancedActivityService.getActivitiesForDeal(dealId, { limit: 50 });
        onActivitiesChange?.(activities.activities);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [dealId, onActivitiesChange, onSyncVersionChange, onError]);

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!enabled || !supabase) return;

    // Subscribe to enhanced_activities table changes
    subscriptionRef.current = supabase
      .channel(`deal_activities_${dealId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enhanced_activities',
          filter: `deal_id=eq.${dealId}`
        },
        handleRealtimeUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to real-time updates for deal ${dealId}`);
        } else if (status === 'CHANNEL_ERROR') {
          onError?.(new Error('Failed to subscribe to real-time updates'));
        } else if (status === 'TIMED_OUT') {
          onError?.(new Error('Real-time subscription timed out'));
        } else if (status === 'CLOSED') {
          console.log(`Real-time subscription closed for deal ${dealId}`);
        }
      });
  }, [dealId, enabled, handleRealtimeUpdate, onError]);

  // Cleanup subscription
  const cleanupSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  }, []);

  // Manual sync trigger
  const triggerManualSync = useCallback(async () => {
    try {
      const newVersion = await enhancedActivityService.incrementSyncVersion('deal', dealId);
      lastVersionRef.current = newVersion;
      onSyncVersionChange?.(newVersion);

      const activities = await enhancedActivityService.getActivitiesForDeal(dealId, { limit: 50 });
      onActivitiesChange?.(activities.activities);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [dealId, onActivitiesChange, onSyncVersionChange]);

  // Initialize on mount
  useEffect(() => {
    if (enabled) {
      initializeSyncVersion();
      setupRealtimeSubscription();
    }

    return cleanupSubscription;
  }, [enabled, initializeSyncVersion, setupRealtimeSubscription, cleanupSubscription]);

  return {
    currentVersion: lastVersionRef.current,
    triggerManualSync,
    cleanupSubscription
  };
};

// Hook for activity subscriptions management
export const useActivitySubscriptions = (userId: string) => {
  const getSubscriptions = useCallback(async () => {
    return await enhancedActivityService.getSubscriptions(userId);
  }, [userId]);

  const updateSubscription = useCallback(async (subscriptionId: string, updates: any) => {
    return await enhancedActivityService.updateSubscription(subscriptionId, updates);
  }, []);

  return {
    getSubscriptions,
    updateSubscription
  };
};

// Hook for activity statistics
export const useActivityStats = (dealId: string) => {
  const getStats = useCallback(async (dateRange?: { from: string; to: string }) => {
    return await enhancedActivityService.getActivityStats(dealId, dateRange);
  }, [dealId]);

  return { getStats };
};