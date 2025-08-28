import React, { useState } from 'react';
import { useAIResearch } from '../../services/aiResearchService';
import { aiEnrichmentService, ContactEnrichmentData, CompanyEnrichmentData } from '../../services/aiEnrichmentService';
import { 
  Search, 
  User, 
  Building2, 
  Sparkles, 
  Brain, 
  Loader2, 
  Bot,
  Mail,
  Check,
  XCircle
} from 'lucide-react';
import { ModernButton } from './ModernButton';

interface AIResearchButtonProps {
  searchType: 'contact' | 'company' | 'auto';
  searchQuery: {
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    domain?: string;
    linkedinUrl?: string;
  };
  onDataFound?: (data: ContactEnrichmentData | CompanyEnrichmentData) => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const AIResearchButton: React.FC<AIResearchButtonProps> = ({
  searchType,
  searchQuery,
  onDataFound,
  onError,
  buttonText,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);

  const aiResearch = useAIResearch();

  const handleResearch = async () => {
    if (isSearching) return;

    setIsSearching(true);
    setSearchFailed(false);
    setSearchResult(null);

    try {
      let result: any;

      if (searchType === 'contact' || (searchType === 'auto' && (searchQuery.firstName || searchQuery.lastName || searchQuery.email))) {
        // Contact research
        const personName = searchQuery.firstName && searchQuery.lastName 
          ? `${searchQuery.firstName} ${searchQuery.lastName}`
          : searchQuery.firstName || searchQuery.lastName || '';

        if (personName || searchQuery.email) {
          // Use AI enrichment service for contact data
          const enrichData: ContactEnrichmentData = {
            name: personName,
            company: searchQuery.company,
            email: searchQuery.email,
            linkedinUrl: searchQuery.linkedinUrl
          };

          result = await aiEnrichmentService.enrichContact(enrichData);
        } else {
          throw new Error('Insufficient contact information for research');
        }
      } else if (searchType === 'company' || (searchType === 'auto' && (searchQuery.company || searchQuery.domain))) {
        // Company research
        if (searchQuery.company || searchQuery.domain) {
          // Use AI enrichment service for company data
          const enrichData: CompanyEnrichmentData = {
            name: searchQuery.company,
            domain: searchQuery.domain
          };

          result = await aiEnrichmentService.enrichCompany(enrichData);
        } else {
          throw new Error('Company name or domain required for research');
        }
      } else {
        throw new Error('Invalid search type or insufficient information');
      }

      setSearchResult(result);
      if (onDataFound) onDataFound(result);
    } catch (error) {
      console.error('AI Research failed:', error);
      setSearchFailed(true);
      if (onError && error instanceof Error) onError(error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <ModernButton
      variant={variant}
      size={size}
      onClick={handleResearch}
      disabled={isSearching} 
      className={`dark:focus:ring-offset-gray-900 ${className}`}
    >
      {isSearching ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span>Researching...</span>
        </>
      ) : searchResult ? (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          <span>{buttonText || 'Enriched'}</span>
        </>
      ) : searchFailed ? (
        <>
          <XCircle className="w-4 h-4 mr-2" />
          <span>Retry</span>
        </>
      ) : (
        <>
          {searchType === 'contact' ? (
            <User className="w-4 h-4 mr-2" />
          ) : searchType === 'company' ? (
            <Building2 className="w-4 h-4 mr-2" />
          ) : (
            <Brain className="w-4 h-4 mr-2" />
          )}
          <span>{buttonText || 'AI Research'}</span>
        </>
      )}
    </ModernButton>
  );
};

export default AIResearchButton;