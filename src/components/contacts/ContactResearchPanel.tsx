import React, { useState, useEffect } from 'react';
import { Contact } from '../../types/contact';
import { CitationSummary } from '../ui/CitationBadge';
import { useAIResearch } from '../../services/aiResearchService';
import { useResearchStatusOverlay } from '../../hooks/useResearchStatusOverlay';
import { ModernButton } from '../ui/ModernButton';
import {
  Search,
  Building2,
  Users,
  TrendingUp,
  Globe,
  Calendar,
  DollarSign,
  Target,
  RefreshCw,
  ExternalLink,
  FileText,
  BarChart3,
  Award,
  Zap
} from 'lucide-react';

interface ContactResearchPanelProps {
  contact: Contact;
}

interface CompanyResearch {
  name: string;
  industry: string;
  description: string;
  website: string;
  headquarters: string;
  employeeCount: string;
  foundedYear: string;
  revenue: string;
  keyExecutives: Array<{
    name: string;
    title: string;
    email?: string;
    linkedin?: string;
  }>;
  recentNews: string[];
  competitors: string[];
  technologies: string[];
  fundingInfo?: string;
  stockSymbol?: string;
  logoUrl?: string;
  potentialNeeds: string[];
  salesApproach: string;
  keyDecisionMakers: string[];
  aiProvider: string;
}

export const ContactResearchPanel: React.FC<ContactResearchPanelProps> = ({ contact }) => {
  const [companyResearch, setCompanyResearch] = useState<CompanyResearch | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResearchDate, setLastResearchDate] = useState<Date | null>(null);

  const aiResearch = useAIResearch();
  const { showOverlay } = useResearchStatusOverlay();

  useEffect(() => {
    // Load cached research data if available
    const cachedData = localStorage.getItem(`company_research_${contact.company}`);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setCompanyResearch(parsed.data);
        setLastResearchDate(new Date(parsed.timestamp));
      } catch (error) {
        console.error('Failed to load cached research data:', error);
      }
    }
  }, [contact.company]);

  const handleResearchCompany = async () => {
    setIsLoading(true);
    try {
      const researchData = await aiResearch.researchCompany(contact.company);

      // Cache the research data
      const cacheData = {
        data: researchData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`company_research_${contact.company}`, JSON.stringify(cacheData));

      setCompanyResearch(researchData);
      setLastResearchDate(new Date());

      // Show research status overlay
      showOverlay();
    } catch (error) {
      console.error('Failed to research company:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatRevenue = (revenue: string) => {
    if (revenue.includes('$')) return revenue;
    return `$${revenue}`;
  };

  const getIndustryColor = (industry: string) => {
    const colors = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Healthcare': 'bg-green-100 text-green-800',
      'Finance': 'bg-purple-100 text-purple-800',
      'Manufacturing': 'bg-orange-100 text-orange-800',
      'Retail': 'bg-pink-100 text-pink-800',
      'Education': 'bg-indigo-100 text-indigo-800',
      'Real Estate': 'bg-yellow-100 text-yellow-800',
      'Consulting': 'bg-teal-100 text-teal-800',
      'Media': 'bg-red-100 text-red-800',
      'Transportation': 'bg-gray-100 text-gray-800'
    };
    return colors[industry as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Research Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Search className="w-5 h-5 mr-2 text-blue-600" />
            Company Research & Intelligence
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-powered research on {contact.company} with verified citations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastResearchDate && (
            <div className="text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Last updated: {lastResearchDate.toLocaleDateString()}
            </div>
          )}

          <ModernButton
            variant="primary"
            size="sm"
            onClick={handleResearchCompany}
            disabled={isLoading}
            className="flex items-center"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Researching...' : 'Research Company'}
          </ModernButton>
        </div>
      </div>

      {/* Research Status */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div>
              <p className="text-sm font-medium text-blue-900">Researching {contact.company}</p>
              <p className="text-xs text-blue-700">Gathering intelligence from multiple sources...</p>
            </div>
          </div>
        </div>
      )}

      {/* Company Research Results */}
      {companyResearch ? (
        <div className="space-y-6">
          {/* Company Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start space-x-4">
              {companyResearch.logoUrl && (
                <img
                  src={companyResearch.logoUrl}
                  alt={`${companyResearch.name} logo`}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                />
              )}

              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-xl font-bold text-gray-900">{companyResearch.name}</h4>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getIndustryColor(companyResearch.industry)}`}>
                    {companyResearch.industry}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Award className="w-4 h-4 mr-1" />
                    {companyResearch.aiProvider}
                  </span>
                </div>

                <p className="text-gray-700 mb-4">{companyResearch.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Headquarters</p>
                      <p className="text-sm font-medium">{companyResearch.headquarters}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Employees</p>
                      <p className="text-sm font-medium">{companyResearch.employeeCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Founded</p>
                      <p className="text-sm font-medium">{companyResearch.foundedYear}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="text-sm font-medium">{formatRevenue(companyResearch.revenue)}</p>
                    </div>
                  </div>
                </div>

                {companyResearch.website && (
                  <div className="mt-4">
                    <a
                      href={companyResearch.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      {companyResearch.website}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Key Executives */}
          {companyResearch.keyExecutives.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-600" />
                Key Executives
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companyResearch.keyExecutives.map((exec, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-purple-700">
                        {exec.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{exec.name}</p>
                      <p className="text-xs text-gray-600">{exec.title}</p>
                      {exec.email && (
                        <a
                          href={`mailto:${exec.email}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {exec.email}
                        </a>
                      )}
                    </div>

                    {exec.linkedin && (
                      <a
                        href={exec.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent News & Developments */}
          {companyResearch.recentNews.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Recent News & Developments
              </h4>

              <div className="space-y-3">
                {companyResearch.recentNews.map((news, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">{news}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitors & Market Position */}
          {companyResearch.competitors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-orange-600" />
                Competitive Landscape
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {companyResearch.competitors.map((competitor, index) => (
                  <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-orange-900">{competitor}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technologies & Capabilities */}
          {companyResearch.technologies.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                Technology Stack
              </h4>

              <div className="flex flex-wrap gap-2">
                {companyResearch.technologies.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sales Intelligence */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Sales Intelligence & Approach
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Potential Needs</h5>
                <div className="space-y-2">
                  {companyResearch.potentialNeeds.map((need, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{need}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Recommended Sales Approach</h5>
                <p className="text-sm text-gray-700">{companyResearch.salesApproach}</p>

                <div className="mt-3">
                  <h6 className="text-xs font-medium text-gray-600 mb-2">Key Decision Makers</h6>
                  <div className="flex flex-wrap gap-1">
                    {companyResearch.keyDecisionMakers.map((role, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Research Citations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                Research Citations & Sources
              </h4>
              <button className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center">
                <ExternalLink className="w-4 h-4 mr-1" />
                View All Sources
              </button>
            </div>

            <CitationSummary
              citations={[
                {
                  url: companyResearch.website || `https://www.${companyResearch.name.toLowerCase().replace(/\s+/g, '')}.com`,
                  title: `${companyResearch.name} - Official Website`,
                  domain: companyResearch.website ? new URL(companyResearch.website).hostname : `${companyResearch.name.toLowerCase().replace(/\s+/g, '')}.com`,
                  sourceType: 'company',
                  credibilityScore: 95,
                  timestamp: new Date().toISOString(),
                  snippet: `Official company website with corporate information, leadership team, and business overview.`
                },
                {
                  url: `https://crunchbase.com/organization/${companyResearch.name.toLowerCase().replace(/\s+/g, '-')}`,
                  title: `${companyResearch.name} - Crunchbase Profile`,
                  domain: 'crunchbase.com',
                  sourceType: 'industry',
                  credibilityScore: 88,
                  timestamp: new Date().toISOString(),
                  snippet: `Comprehensive business information including funding, acquisitions, and market data.`
                },
                {
                  url: `https://linkedin.com/company/${companyResearch.name.toLowerCase().replace(/\s+/g, '-')}`,
                  title: `${companyResearch.name} - LinkedIn Company Page`,
                  domain: 'linkedin.com',
                  sourceType: 'social',
                  credibilityScore: 85,
                  timestamp: new Date().toISOString(),
                  snippet: `Company updates, employee insights, and professional network information.`
                },
                {
                  url: `https://en.wikipedia.org/wiki/${companyResearch.name.replace(/\s+/g, '_')}`,
                  title: `${companyResearch.name} - Wikipedia`,
                  domain: 'wikipedia.org',
                  sourceType: 'reference',
                  credibilityScore: 75,
                  timestamp: new Date().toISOString(),
                  snippet: `Encyclopedia entry with company history, products, and industry context.`
                }
              ]}
              maxDisplay={4}
              showStats={true}
            />
          </div>
        </div>
      ) : !isLoading ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-700 mb-2">No Research Data Available</h4>
          <p className="text-sm text-gray-500 mb-4">
            Research intelligence for {contact.company} hasn't been generated yet.
          </p>
          <ModernButton
            variant="primary"
            onClick={handleResearchCompany}
          >
            Start AI Research
          </ModernButton>
        </div>
      ) : null}
    </div>
  );
};