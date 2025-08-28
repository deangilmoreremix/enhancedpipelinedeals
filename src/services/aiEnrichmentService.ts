import { useOpenAI } from './openaiService';
import { useGeminiAI } from './geminiService';
import { IntelligentAIService } from './intelligentAIService';

export interface ContactEnrichmentData {
  name?: string;
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
  extraData?: Record<string, any>;
}

class AIEnrichmentService {
  private intelligentAI: IntelligentAIService;

  constructor() {
    const openaiService = useOpenAI();
    const geminiService = useGeminiAI();
    this.intelligentAI = new IntelligentAIService(openaiService, geminiService);
  }

  async enrichContact(contactData: Partial<ContactEnrichmentData>): Promise<ContactEnrichmentData> {
    console.log('🔍 Enriching contact data...');
    try {
      // Call the AI enrichment edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-enrichment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: contactData,
          entityType: 'contact',
          taskType: 'enrich'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Enrichment failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let enrichmentResult;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        enrichmentResult = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        enrichmentResult = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }

      // Add AI image enhancement if no avatar provided
      if (!enrichmentResult.avatar && !contactData.avatarSrc) {
        const seed = (contactData.firstName || contactData.name || 'user').toLowerCase();
        enrichmentResult.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;
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
        aiProvider: '❌ GPT-5 + Gemma Enrichment Failed',
        notes: 'Failed to enrich contact data. Please try again later.'
      };
    }
  }

  async enrichCompany(companyData: Partial<CompanyEnrichmentData>): Promise<CompanyEnrichmentData> {
    console.log('🔍 Enriching company data...');
    try {
      // Call the AI enrichment edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-enrichment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: companyData,
          entityType: 'company',
          taskType: 'enrich'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Company enrichment failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let enrichmentResult;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        enrichmentResult = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        enrichmentResult = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }

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
      // Call the AI enrichment edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-enrichment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          entityData: dealData,
          entityType: 'deal',
          taskType: 'enrich'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Deal enrichment failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract content from AI response
      let enrichmentResult;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        enrichmentResult = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        enrichmentResult = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format');
      }

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
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}${company ? '-' + company : ''}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444`;
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