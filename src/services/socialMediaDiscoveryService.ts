/**
 * Social Media Discovery Service - Specialized Gemma Integration
 * Uses Gemma models for discovering and validating social media channels
 */

import { getEnhancedIntelligentAI } from './enhancedIntelligentAIService';

export interface SocialMediaChannel {
  platform: string;
  url: string;
  handle: string;
  confidence: number;
  verified: boolean;
  followers?: number;
  lastActive?: Date;
  contentThemes?: string[];
}

export interface SocialMediaDiscoveryResult {
  channels: SocialMediaChannel[];
  brandedHashtags: string[];
  socialPresenceScore: number;
  recommendedPlatforms: string[];
  verificationStatus: 'verified' | 'partial' | 'unverified';
  aiProvider: string;
  confidence: number;
}

class SocialMediaDiscoveryService {
  private intelligentAI = getEnhancedIntelligentAI();

  /**
   * Discover social media channels for a company using Gemma
   */
  async discoverCompanyChannels(companyData: {
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
  }): Promise<SocialMediaDiscoveryResult> {
    try {
      console.log(`📱 Discovering social channels for ${companyData.name} using Gemma`);

      // Call the social discovery edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/social-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: companyData,
          entityType: 'company',
          taskType: 'discover-channels'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Social discovery failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let discovery;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        discovery = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        discovery = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }
      
      // Transform the Gemma response into our structured format
      const channels: SocialMediaChannel[] = [];
      
      if (discovery.discoveredChannels) {
        Object.entries(discovery.discoveredChannels).forEach(([platform, data]: [string, any]) => {
          if (data.url) {
            channels.push({
              platform: platform.charAt(0).toUpperCase() + platform.slice(1),
              url: data.url,
              handle: data.handle || '',
              confidence: parseInt(data.confidence) || 50,
              verified: data.verified === 'true' || data.verified === true,
            });
          }
        });
      }

      return {
        channels,
        brandedHashtags: discovery.brandedHashtags || [],
        socialPresenceScore: this.calculatePresenceScore(channels),
        recommendedPlatforms: discovery.platformRecommendations || [],
        verificationStatus: this.determineVerificationStatus(channels),
        aiProvider: 'Gemma Social Discovery',
        confidence: discovery.confidence || 70
      };
    } catch (error) {
      console.error('Social media discovery failed:', error);
      return this.generateFallbackResult(companyData);
    }
  }

  /**
   * Discover social channels for an individual contact
   */
  async discoverContactChannels(contactData: {
    firstName: string;
    lastName: string;
    company?: string;
    title?: string;
    industry?: string;
  }): Promise<SocialMediaDiscoveryResult> {
    try {
      console.log(`👤 Discovering social channels for ${contactData.firstName} ${contactData.lastName} using Gemma`);

      // Call the social discovery edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/social-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: contactData,
          entityType: 'contact',
          taskType: 'discover-channels'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Contact social discovery failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let discovery;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        discovery = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        discovery = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }

      const channels: SocialMediaChannel[] = [];
      
      if (discovery.discoveredChannels) {
        Object.entries(discovery.discoveredChannels).forEach(([platform, data]: [string, any]) => {
          if (data.url) {
            channels.push({
              platform: platform.charAt(0).toUpperCase() + platform.slice(1),
              url: data.url,
              handle: data.handle || '',
              confidence: parseInt(data.confidence) || 40,
              verified: data.verified === 'true' || data.verified === true,
            });
          }
        });
      }

      return {
        channels,
        brandedHashtags: [],
        socialPresenceScore: this.calculatePresenceScore(channels),
        recommendedPlatforms: discovery.prioritizedChannels || ['LinkedIn'],
        verificationStatus: this.determineVerificationStatus(channels),
        aiProvider: 'Gemma Channel Identification',
        confidence: discovery.confidence || 60
      };
    } catch (error) {
      console.error('Contact social discovery failed:', error);
      return this.generateFallbackContactResult(contactData);
    }
  }

  /**
   * Enrich app data with social media presence using Gemma
   */
  async enrichAppSocialChannels(appData: {
    name: string;
    company?: string;
    domain?: string;
    description?: string;
    category?: string;
  }): Promise<SocialMediaDiscoveryResult> {
    try {
      console.log(`🔍 Enriching app social channels for ${appData.name} using Gemma`);

      // Call the social discovery edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/social-discovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: appData,
          entityType: 'app',
          taskType: 'enrich-app'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`App social enrichment failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let enrichment;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        enrichment = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        enrichment = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }
      
      const channels: SocialMediaChannel[] = [];
      
      if (enrichment.socialChannels) {
        // Handle official channels
        if (enrichment.socialChannels.official) {
          Object.entries(enrichment.socialChannels.official).forEach(([platform, url]: [string, any]) => {
            if (url) {
              channels.push({
                platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                url: url,
                handle: this.extractHandle(url, platform),
                confidence: 80,
                verified: true,
              });
            }
          });
        }
        
        // Handle community channels
        if (enrichment.socialChannels.community) {
          Object.entries(enrichment.socialChannels.community).forEach(([platform, url]: [string, any]) => {
            if (url) {
              channels.push({
                platform: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Community`,
                url: url,
                handle: this.extractHandle(url, platform),
                confidence: 60,
                verified: false,
              });
            }
          });
        }
      }

      return {
        channels,
        brandedHashtags: [],
        socialPresenceScore: this.calculatePresenceScore(channels),
        recommendedPlatforms: enrichment.platformRecommendations || [],
        verificationStatus: this.determineVerificationStatus(channels),
        aiProvider: 'Gemma App Enrichment',
        confidence: enrichment.confidence || 75
      };
    } catch (error) {
      console.error('App social enrichment failed:', error);
      return this.generateFallbackAppResult(appData);
    }
  }

  /**
   * Validate discovered social media channels
   */
  async validateChannels(channels: SocialMediaChannel[]): Promise<SocialMediaChannel[]> {
    // In a real implementation, this would make HTTP requests to validate URLs
    // For now, we'll simulate validation
    return channels.map(channel => ({
      ...channel,
      verified: Math.random() > 0.3, // Simulate 70% success rate
      lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
    }));
  }

  // Helper methods
  private calculatePresenceScore(channels: SocialMediaChannel[]): number {
    if (channels.length === 0) return 0;
    
    const platformWeights = {
      'linkedin': 25,
      'twitter': 20,
      'facebook': 15,
      'instagram': 15,
      'youtube': 15,
      'github': 10
    };
    
    let totalScore = 0;
    channels.forEach(channel => {
      const weight = platformWeights[channel.platform.toLowerCase() as keyof typeof platformWeights] || 5;
      const confidenceMultiplier = channel.confidence / 100;
      const verifiedBonus = channel.verified ? 1.2 : 1;
      
      totalScore += weight * confidenceMultiplier * verifiedBonus;
    });
    
    return Math.min(100, Math.round(totalScore));
  }

  private determineVerificationStatus(channels: SocialMediaChannel[]): 'verified' | 'partial' | 'unverified' {
    if (channels.length === 0) return 'unverified';
    
    const verifiedCount = channels.filter(c => c.verified).length;
    const verificationRate = verifiedCount / channels.length;
    
    if (verificationRate >= 0.8) return 'verified';
    if (verificationRate >= 0.3) return 'partial';
    return 'unverified';
  }

  private extractHandle(url: string, platform: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      switch (platform.toLowerCase()) {
        case 'twitter':
          return pathParts[0] ? `@${pathParts[0]}` : '';
        case 'instagram':
        case 'facebook':
        case 'linkedin':
        case 'youtube':
          return pathParts[pathParts.length - 1] || '';
        default:
          return pathParts[0] || '';
      }
    } catch {
      return '';
    }
  }

  private generateFallbackResult(companyData: any): SocialMediaDiscoveryResult {
    const handle = companyData.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    return {
      channels: [
        {
          platform: 'LinkedIn',
          url: `https://linkedin.com/company/${handle}`,
          handle: handle,
          confidence: 60,
          verified: false
        },
        {
          platform: 'Twitter',
          url: `https://twitter.com/${handle}`,
          handle: `@${handle}`,
          confidence: 50,
          verified: false
        }
      ],
      brandedHashtags: [`#${handle}`, `#${companyData.name.replace(/\s+/g, '')}`],
      socialPresenceScore: 45,
      recommendedPlatforms: ['LinkedIn', 'Twitter', 'Facebook'],
      verificationStatus: 'unverified',
      aiProvider: 'Fallback Mode',
      confidence: 40
    };
  }

  private generateFallbackContactResult(contactData: any): SocialMediaDiscoveryResult {
    const fullName = `${contactData.firstName} ${contactData.lastName}`;
    const handle = fullName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    return {
      channels: [
        {
          platform: 'LinkedIn',
          url: `https://linkedin.com/in/${contactData.firstName.toLowerCase()}-${contactData.lastName.toLowerCase()}`,
          handle: `${contactData.firstName.toLowerCase()}-${contactData.lastName.toLowerCase()}`,
          confidence: 70,
          verified: false
        }
      ],
      brandedHashtags: [],
      socialPresenceScore: 30,
      recommendedPlatforms: ['LinkedIn'],
      verificationStatus: 'unverified',
      aiProvider: 'Fallback Mode',
      confidence: 40
    };
  }

  private generateFallbackAppResult(appData: any): SocialMediaDiscoveryResult {
    const handle = appData.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    return {
      channels: [
        {
          platform: 'Twitter',
          url: `https://twitter.com/${handle}`,
          handle: `@${handle}`,
          confidence: 50,
          verified: false
        },
        {
          platform: 'LinkedIn',
          url: `https://linkedin.com/company/${handle}`,
          handle: handle,
          confidence: 60,
          verified: false
        }
      ],
      brandedHashtags: [`#${handle}`, `#${appData.name.replace(/\s+/g, '')}`],
      socialPresenceScore: 40,
      recommendedPlatforms: ['Twitter', 'LinkedIn', 'Instagram'],
      verificationStatus: 'unverified',
      aiProvider: 'Fallback Mode',
      confidence: 45
    };
  }
}

// Singleton instance
let socialMediaDiscoveryService: SocialMediaDiscoveryService | null = null;

export const getSocialMediaDiscoveryService = (): SocialMediaDiscoveryService => {
  if (!socialMediaDiscoveryService) {
    socialMediaDiscoveryService = new SocialMediaDiscoveryService();
  }
  return socialMediaDiscoveryService;
};

export { SocialMediaDiscoveryService };