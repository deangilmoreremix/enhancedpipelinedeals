import { useOpenAI } from './openaiService';
import { IntelligentAIService } from './intelligentAIService';
import { callAI } from './aiClient';
import { initialsAvatar } from '../utils/avatar';

export interface ContactEnrichmentData {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  industry?: string;
  phone?: string;
  email?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  website?: string;
  location?: string;
  avatar?: string;
  avatarSrc?: string;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  notes?: string;
  confidence?: number;
  aiProvider?: string;
  extraData?: Record<string, any>;
}

export interface CompanyEnrichmentData {
  name?: string;
  domain?: string;
  industry?: string;
  description?: string;
  size?: string;
  founded?: string;
  headquarters?: string;
  logo?: string;
  revenue?: string;
  keyPeople?: Array<{name: string; title: string}>;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  competitors?: string[];
  technologiesUsed?: string[];
  fundingHistory?: string;
  confidence?: number;
  aiProvider?: string;
  notes?: string;
  extraData?: Record<string, any>;
}

export interface DealEnrichmentData {
  title?: string;
  company?: string;
  contact?: string;
  value?: number;
  probability?: number;
  insights?: string[];
  risks?: string[];
  recommendations?: string[];
  suggestedNextSteps?: string[];
  similarDeals?: Array<{title: string; outcome: string; value: number}>;
  confidence?: number;
  aiProvider?: string;
  notes?: string;
  extraData?: Record<string, any>;
}

class AIEnrichmentService {
  private intelligentAI: IntelligentAIService;

  constructor() {
    this.intelligentAI = new IntelligentAIService();
  }

  async enrichContact(contactData: Partial<ContactEnrichmentData>): Promise<ContactEnrichmentData> {
    console.log('🔍 Enriching contact data...');
    try {
      // Enrich via the server-side Responses API gateway
      const result = await callAI('enrichment', {
        context: { entityType: 'contact', entity: contactData },
        input: 'Enrich this contact record. Return JSON only.',
      });
      if (!result.data) throw new Error('Invalid response format');
      const enrichmentResult: any = result.data;

      // Add AI image enhancement if no avatar provided
      if (!enrichmentResult.avatar && !contactData.avatarSrc) {
        const seed = (contactData.firstName || contactData.name || 'user').toLowerCase();
        enrichmentResult.avatar = initialsAvatar(seed);
      }

      return {
        ...contactData,
        ...enrichmentResult
      };
    } catch (error) {
      console.error('❌ Contact enrichment failed:', error);
      return {
        ...contactData,
        confidence: 0,
        aiProvider: '❌ Enrichment Failed',
        notes: 'Failed to enrich contact data. Please try again later.'
      };
    }
  }

  async enrichCompany(companyData: Partial<CompanyEnrichmentData>): Promise<CompanyEnrichmentData> {
    console.log('🔍 Enriching company data...');
    try {
      // Enrich via the server-side Responses API gateway
      const result = await callAI('enrichment', {
        context: { entityType: 'company', entity: companyData },
        input: 'Enrich this company record. Return JSON only.',
      });
      if (!result.data) throw new Error('Invalid response format');
      const enrichmentResult: any = result.data;

      return {
        ...companyData,
        ...enrichmentResult
      };
    } catch (error) {
      console.error('❌ Company enrichment failed:', error);
      return {
        ...companyData,
        confidence: 0,
        aiProvider: '❌ Enrichment Failed',
        notes: 'Failed to enrich company data. Please try again later.'
      };
    }
  }

  async enrichDeal(dealData: Partial<DealEnrichmentData>): Promise<DealEnrichmentData> {
    console.log('🔍 Enriching deal data...');
    try {
      // Enrich via the server-side Responses API gateway
      const result = await callAI('enrichment', {
        context: { entityType: 'deal', entity: dealData },
        input: 'Enrich this deal record. Return JSON only.',
      });
      if (!result.data) throw new Error('Invalid response format');
      const enrichmentResult: any = result.data;

      return {
        ...dealData,
        ...enrichmentResult
      };
    } catch (error) {
      console.error('❌ Deal enrichment failed:', error);
      return {
        ...dealData,
        confidence: 0,
        aiProvider: '❌ Enrichment Failed',
        notes: 'Failed to enrich deal data. Please try again later.'
      };
    }
  }

  async findContactImage(name: string, company?: string): Promise<string> {
    // For demonstration, generate an avatar URL
    // In a real implementation, this could use profile photo search APIs
    const seed = name.toLowerCase().replace(/\s+/g, '');
    const style = Math.random() > 0.5 ? 'avataaars' : 'micah';
    return initialsAvatar(style);
  }
}

// Singleton instance
let aiEnrichmentServiceInstance: AIEnrichmentService | null = null;

export const getAIEnrichmentService = (): AIEnrichmentService => {
  if (!aiEnrichmentServiceInstance) {
    aiEnrichmentServiceInstance = new AIEnrichmentService();
  }
  return aiEnrichmentServiceInstance;
};

// For direct importing
export const aiEnrichmentService = getAIEnrichmentService();