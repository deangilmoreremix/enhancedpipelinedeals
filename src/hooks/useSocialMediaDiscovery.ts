/**
 * Social Media Discovery Hook
 * Provides easy access to Gemma-powered social media channel discovery
 */

import { useState } from 'react';
import { getSocialMediaDiscoveryService, SocialMediaDiscoveryResult } from '../services/socialMediaDiscoveryService';

interface SocialMediaDiscoveryHook {
  discoverCompanyChannels: (companyData: any) => Promise<SocialMediaDiscoveryResult>;
  discoverContactChannels: (contactData: any) => Promise<SocialMediaDiscoveryResult>;
  enrichAppSocialChannels: (appData: any) => Promise<SocialMediaDiscoveryResult>;
  validateChannels: (channels: any[]) => Promise<any[]>;
  isDiscovering: boolean;
  lastDiscovery: SocialMediaDiscoveryResult | null;
  discoveryError: string | null;
}

export const useSocialMediaDiscovery = (): SocialMediaDiscoveryHook => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastDiscovery, setLastDiscovery] = useState<SocialMediaDiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const discoveryService = getSocialMediaDiscoveryService();

  const discoverCompanyChannels = async (companyData: any): Promise<SocialMediaDiscoveryResult> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    
    try {
      console.log(`🔍 Starting Gemma social discovery for company: ${companyData.name}`);
      
      const result = await discoveryService.discoverCompanyChannels(companyData);
      setLastDiscovery(result);
      
      console.log(`✅ Gemma discovered ${result.channels.length} social channels with ${result.confidence}% confidence`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Social media discovery failed';
      setDiscoveryError(errorMessage);
      console.error('❌ Gemma social discovery failed:', error);
      throw error;
    } finally {
      setIsDiscovering(false);
    }
  };

  const discoverContactChannels = async (contactData: any): Promise<SocialMediaDiscoveryResult> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    
    try {
      console.log(`🔍 Starting Gemma social discovery for contact: ${contactData.firstName} ${contactData.lastName}`);
      
      const result = await discoveryService.discoverContactChannels(contactData);
      setLastDiscovery(result);
      
      console.log(`✅ Gemma discovered ${result.channels.length} social channels for contact`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Contact social discovery failed';
      setDiscoveryError(errorMessage);
      console.error('❌ Gemma contact social discovery failed:', error);
      throw error;
    } finally {
      setIsDiscovering(false);
    }
  };

  const enrichAppSocialChannels = async (appData: any): Promise<SocialMediaDiscoveryResult> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    
    try {
      console.log(`🔍 Starting Gemma app social enrichment for: ${appData.name}`);
      
      const result = await discoveryService.enrichAppSocialChannels(appData);
      setLastDiscovery(result);
      
      console.log(`✅ Gemma enriched app with ${result.channels.length} social channels`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'App social enrichment failed';
      setDiscoveryError(errorMessage);
      console.error('❌ Gemma app social enrichment failed:', error);
      throw error;
    } finally {
      setIsDiscovering(false);
    }
  };

  const validateChannels = async (channels: any[]): Promise<any[]> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    
    try {
      console.log(`🔍 Validating ${channels.length} social media channels with Gemma`);
      
      const result = await discoveryService.validateChannels(channels);
      
      console.log(`✅ Gemma validated ${result.length} channels`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Channel validation failed';
      setDiscoveryError(errorMessage);
      console.error('❌ Gemma channel validation failed:', error);
      throw error;
    } finally {
      setIsDiscovering(false);
    }
  };

  return {
    discoverCompanyChannels,
    discoverContactChannels,
    enrichAppSocialChannels,
    validateChannels,
    isDiscovering,
    lastDiscovery,
    discoveryError
  };
};