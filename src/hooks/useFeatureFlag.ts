import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '../services/featureFlagService';

export const useFeatureFlag = (featureKey: string): boolean => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const result = await isFeatureEnabled(featureKey);
        setEnabled(result);
      } catch (error) {
        console.error(`Failed to check feature flag ${featureKey}:`, error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();
  }, [featureKey]);

  return enabled;
};

export const useMultipleFeatureFlags = (featureKeys: string[]): Record<string, boolean> => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeatures = async () => {
      try {
        const results: Record<string, boolean> = {};
        await Promise.all(
          featureKeys.map(async (key) => {
            try {
              results[key] = await isFeatureEnabled(key);
            } catch (error) {
              console.error(`Failed to check feature flag ${key}:`, error);
              results[key] = false;
            }
          })
        );
        setFlags(results);
      } catch (error) {
        console.error('Failed to check multiple feature flags:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFeatures();
  }, [featureKeys]);

  return flags;
};