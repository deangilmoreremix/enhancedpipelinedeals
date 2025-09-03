import React from 'react';
import { ExternalLink, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface CitationBadgeProps {
  citation: {
    url: string;
    title: string;
    domain: string;
    sourceType: string;
    credibilityScore: number;
    timestamp: string;
    snippet?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

const sourceTypeConfig = {
  news: {
    color: 'bg-blue-500',
    icon: Info,
    label: 'News'
  },
  company: {
    color: 'bg-green-500',
    icon: CheckCircle,
    label: 'Company'
  },
  social: {
    color: 'bg-purple-500',
    icon: ExternalLink,
    label: 'Social'
  },
  academic: {
    color: 'bg-indigo-500',
    icon: CheckCircle,
    label: 'Academic'
  },
  government: {
    color: 'bg-red-500',
    icon: CheckCircle,
    label: 'Government'
  },
  industry: {
    color: 'bg-orange-500',
    icon: CheckCircle,
    label: 'Industry'
  },
  blog: {
    color: 'bg-yellow-500',
    icon: AlertTriangle,
    label: 'Blog'
  },
  other: {
    color: 'bg-gray-500',
    icon: Info,
    label: 'Other'
  }
};

const getCredibilityColor = (score: number): string => {
  if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

const getCredibilityLabel = (score: number): string => {
  if (score >= 90) return 'High';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Medium';
  return 'Low';
};

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  size = 'md',
  showTooltip = true,
  onClick
}) => {
  const config = sourceTypeConfig[citation.sourceType as keyof typeof sourceTypeConfig] || sourceTypeConfig.other;
  const Icon = config.icon;
  const credibilityColor = getCredibilityColor(citation.credibilityScore);
  const credibilityLabel = getCredibilityLabel(citation.credibilityScore);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      window.open(citation.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        className={`
          ${sizeClasses[size]}
          ${credibilityColor}
          border rounded-lg font-medium
          hover:shadow-md transition-all duration-200
          flex items-center space-x-2
          cursor-pointer group
        `}
        title={showTooltip ? `${citation.title} (${citation.domain}) - ${credibilityLabel} credibility` : undefined}
      >
        {/* Source Type Icon */}
        <div className={`p-1 rounded ${config.color} text-white`}>
          <Icon className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </div>

        {/* Domain */}
        <span className="truncate max-w-24">{citation.domain}</span>

        {/* Credibility Score */}
        <span className="font-bold text-xs">
          {citation.credibilityScore}
        </span>

        {/* External Link Indicator */}
        <ExternalLink className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} opacity-60 group-hover:opacity-100 transition-opacity`} />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 min-w-max">
          <div className="font-semibold mb-1">{citation.title}</div>
          <div className="text-gray-300 text-xs mb-2">{citation.domain}</div>
          <div className="flex items-center space-x-2 text-xs">
            <span className={`px-2 py-0.5 rounded ${config.color} text-white`}>
              {config.label}
            </span>
            <span className={`px-2 py-0.5 rounded ${credibilityColor.replace('text-', 'bg-').replace('bg-', 'bg-').replace('-600', '-500').replace('-50', '')} text-white`}>
              {credibilityLabel}
            </span>
          </div>
          {citation.snippet && (
            <div className="mt-2 text-xs text-gray-400 max-w-xs line-clamp-2">
              {citation.snippet}
            </div>
          )}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

interface CitationSummaryProps {
  citations: Array<{
    url: string;
    title: string;
    domain: string;
    sourceType: string;
    credibilityScore: number;
    timestamp: string;
    snippet?: string;
  }>;
  maxDisplay?: number;
  showStats?: boolean;
}

export const CitationSummary: React.FC<CitationSummaryProps> = ({
  citations,
  maxDisplay = 5,
  showStats = true
}) => {
  const displayedCitations = citations.slice(0, maxDisplay);
  const remainingCount = citations.length - maxDisplay;

  // Calculate statistics
  const sourceTypeStats = citations.reduce((acc, citation) => {
    acc[citation.sourceType] = (acc[citation.sourceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const averageCredibility = citations.length > 0
    ? Math.round(citations.reduce((sum, c) => sum + c.credibilityScore, 0) / citations.length)
    : 0;

  return (
    <div className="space-y-3">
      {/* Citation List */}
      <div className="flex flex-wrap gap-2">
        {displayedCitations.map((citation, index) => (
          <CitationBadge
            key={`${citation.url}-${index}`}
            citation={citation}
            size="sm"
          />
        ))}
        {remainingCount > 0 && (
          <div className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg border border-gray-200">
            +{remainingCount} more
          </div>
        )}
      </div>

      {/* Statistics */}
      {showStats && citations.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Citation Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Citations:</span>
              <span className="font-semibold ml-2">{citations.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Avg Credibility:</span>
              <span className={`font-semibold ml-2 ${getCredibilityColor(averageCredibility)} px-2 py-0.5 rounded text-xs`}>
                {averageCredibility}
              </span>
            </div>
          </div>

          {/* Source Type Breakdown */}
          <div className="mt-3">
            <span className="text-sm text-gray-600">Source Types:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(sourceTypeStats).map(([type, count]) => {
                const config = sourceTypeConfig[type as keyof typeof sourceTypeConfig] || sourceTypeConfig.other;
                return (
                  <span
                    key={type}
                    className={`px-2 py-0.5 text-xs rounded ${config.color} text-white`}
                  >
                    {config.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CitationModalProps {
  citations: Array<{
    url: string;
    title: string;
    domain: string;
    sourceType: string;
    credibilityScore: number;
    timestamp: string;
    snippet?: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const CitationModal: React.FC<CitationModalProps> = ({
  citations,
  isOpen,
  onClose,
  title = "Source Citations"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {citations.map((citation, index) => (
              <div key={`${citation.url}-${index}`} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{citation.title}</h3>
                    <p className="text-sm text-gray-600">{citation.domain}</p>
                  </div>
                  <CitationBadge citation={citation} size="sm" showTooltip={false} />
                </div>

                {citation.snippet && (
                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">{citation.snippet}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(citation.timestamp).toLocaleDateString()}</span>
                  <button
                    onClick={() => window.open(citation.url, '_blank', 'noopener,noreferrer')}
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>View Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};