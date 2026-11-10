import { useOpenAI } from './openaiService';
import { IntelligentAIService } from './intelligentAIService';
import { callAI } from './aiClient';
import { initialsAvatar } from '../utils/avatar';
import { supabase } from '../lib/core/supabaseClient';

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

export interface PublicContactResearch {
  found: boolean;
  confidence: number;
  profile: {
    title?: string | null; company?: string | null; industry?: string | null; location?: string | null; bio?: string | null;
    website?: string | null; linkedin_url?: string | null; twitter_url?: string | null; github_url?: string | null;
  };
  companyInfo: { website?: string | null; industry?: string | null; size?: string | null; headquarters?: string | null; description?: string | null };
  recentNews: Array<{ headline: string; url: string; date: string | null }>;
  notes: string;
  sources: Array<{ url: string; title: string | null }>;
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

  /**
   * Finds PUBLIC, professional information about a contact with the OpenAI Responses API `web_search`
   * tool (server-side via the Netlify gateway). Every returned field is backed by a cited source.
   */
  async researchContactPublicInfo(contact: Partial<ContactEnrichmentData> & { email?: string }): Promise<PublicContactResearch> {
    const emailDomain = contact.email?.split('@')[1];
    const generic = /^(gmail|yahoo|outlook|hotmail|icloud|proton|aol)\./i;
    const result = await callAI<any>('contact_public_enrichment', {
      input: `Find public professional information about this person and report what you can verify.`,
      context: {
        name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
        company: contact.company,
        title: contact.title,
        industry: contact.industry,
        location: contact.location,
        emailDomain: emailDomain && !generic.test(emailDomain) ? emailDomain : undefined,
        knownProfiles: contact.socialProfiles,
        website: contact.website,
      },
    });
    const d = result.data;
    if (!d) throw new Error('Research returned no structured result');
    return {
      found: Boolean(d.found),
      confidence: Number(d.confidence) || 0,
      profile: d.profile ?? {},
      companyInfo: d.company_info ?? {},
      recentNews: d.recent_news ?? [],
      notes: d.notes ?? '',
      sources: result.citations ?? [],
    };
  }

  async enrichContact(contactData: Partial<ContactEnrichmentData>): Promise<ContactEnrichmentData> {
    console.log('🔍 Researching public information for contact...');
    try {
      const r = await this.researchContactPublicInfo(contactData);
      if (!r.found) {
        return {
          ...contactData,
          confidence: r.confidence,
          aiProvider: 'OpenAI web search',
          notes: r.notes || 'No reliable public information was found for this contact.',
          extraData: { sources: r.sources },
        };
      }
      const p = r.profile;
      const social: Record<string, string> = { ...(contactData.socialProfiles || {}) };
      if (p.linkedin_url) social.linkedin = p.linkedin_url;
      if (p.twitter_url) social.twitter = p.twitter_url;
      if (p.github_url) social.github = p.github_url;

      return {
        ...contactData,
        title: p.title ?? contactData.title,
        company: p.company ?? contactData.company,
        industry: p.industry ?? contactData.industry,
        location: p.location ?? contactData.location,
        website: p.website ?? contactData.website,
        linkedinUrl: p.linkedin_url ?? contactData.linkedinUrl,
        twitterUrl: p.twitter_url ?? contactData.twitterUrl,
        socialProfiles: social,
        notes: p.bio ?? undefined,
        confidence: r.confidence,
        aiProvider: 'OpenAI web search',
        extraData: { companyInfo: r.companyInfo, recentNews: r.recentNews, sources: r.sources, researchNotes: r.notes },
      };
    } catch (error) {
      console.error('❌ Contact enrichment failed:', error);
      return {
        ...contactData,
        confidence: 0,
        aiProvider: '❌ Enrichment Failed',
        notes: 'Failed to research contact. Please try again later.'
      };
    }
  }

  /**
   * Researches a contact on the web and returns the updates to apply.
   * - Only EMPTY fields are filled; existing values are never overwritten (differences are returned as `suggestions`).
   * - A sourced note is appended to `notes`; social profiles are merged.
   * - The raw research with citations is stored in `data_enrichments`.
   */
  async enrichContactFromWeb(contact: {
    id: string; name?: string; firstName?: string; lastName?: string; email?: string; title?: string; company?: string;
    industry?: string; notes?: string; socialProfiles?: Record<string, string>;
  }): Promise<{ applied: Record<string, any>; suggestions: Record<string, string>; research: PublicContactResearch }> {
    const research = await this.researchContactPublicInfo(contact as any);
    const applied: Record<string, any> = {};
    const suggestions: Record<string, string> = {};

    if (research.found) {
      const p = research.profile;
      for (const key of ['title', 'company', 'industry'] as const) {
        const found = p[key];
        if (!found) continue;
        if (!(contact as any)[key]) applied[key] = found;
        else if ((contact as any)[key].toLowerCase() !== found.toLowerCase()) suggestions[key] = found;
      }
      const social = { ...(contact.socialProfiles || {}) };
      const add = (k: string, v?: string | null) => { if (v && !social[k]) social[k] = v; };
      add('linkedin', p.linkedin_url); add('twitter', p.twitter_url); add('github', p.github_url); add('website', p.website);
      if (JSON.stringify(social) !== JSON.stringify(contact.socialProfiles || {})) applied.socialProfiles = social;

      const lines: string[] = [];
      if (p.bio) lines.push(p.bio);
      if (p.location) lines.push(`Location: ${p.location}`);
      for (const n of research.recentNews.slice(0, 3)) lines.push(`News: ${n.headline}${n.date ? ` (${n.date})` : ''} — ${n.url}`);
      if (research.sources.length) lines.push(`Sources: ${research.sources.slice(0, 5).map(s => s.url).join(', ')}`);
      if (lines.length) {
        const stamp = `Public research (${new Date().toISOString().slice(0, 10)}):`;
        applied.notes = [contact.notes, `${stamp}\n${lines.join('\n')}`].filter(Boolean).join('\n\n');
      }
      applied.lastEnrichment = { confidence: research.confidence, aiProvider: 'OpenAI web search', timestamp: new Date() };
    }

    // Persist the research with its citations (non-fatal if the table is unavailable)
    try {
      await supabase.from('data_enrichments').insert({
        entity_id: contact.id,
        entity_type: 'contact',
        enrichment_type: 'social',
        source: 'openai_web_search',
        data: { profile: research.profile, companyInfo: research.companyInfo, recentNews: research.recentNews, sources: research.sources, notes: research.notes, found: research.found },
        confidence: research.confidence,
        ai_provider: 'openai',
        status: 'completed',
      });
    } catch (e) {
      console.warn('Could not store enrichment record:', e);
    }

    return { applied, suggestions, research };
  }

  async enrichCompany(companyData: Partial<CompanyEnrichmentData>): Promise<CompanyEnrichmentData> {
    console.log('🔍 Researching company with web search...');
    try {
      const result = await callAI<any>('company_public_enrichment', {
        input: 'Research this company and report verified public facts.',
        context: { name: companyData.name, domain: companyData.domain, industry: companyData.industry },
      });
      const d = result.data;
      if (!d || !d.found) {
        return {
          ...companyData,
          confidence: d?.confidence ?? 0,
          aiProvider: 'OpenAI web search',
          notes: 'No reliable public information was found for this company.',
          extraData: { sources: result.citations },
        };
      }
      return {
        ...companyData,
        name: d.name ?? companyData.name,
        domain: d.website ?? companyData.domain,
        industry: d.industry ?? companyData.industry,
        size: d.size ?? companyData.size,
        revenue: d.revenue ?? companyData.revenue,
        founded: d.founded ?? companyData.founded,
        headquarters: d.headquarters ?? companyData.headquarters,
        fundingHistory: d.funding ?? companyData.fundingHistory,
        description: d.description ?? companyData.description,
        competitors: d.competitors?.length ? d.competitors : companyData.competitors,
        confidence: d.confidence,
        aiProvider: 'OpenAI web search',
        extraData: { sources: result.citations },
      };
    } catch (error) {
      console.error('❌ Company enrichment failed:', error);
      return {
        ...companyData,
        confidence: 0,
        aiProvider: '❌ Enrichment Failed',
        notes: 'Failed to research company. Please try again later.'
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