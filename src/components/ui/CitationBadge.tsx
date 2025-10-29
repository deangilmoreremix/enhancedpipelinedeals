import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Citation } from '../../types/citation';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  onClick?: () => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  index,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
      title={citation.title}
    >
      <FileText className="w-3 h-3" />
      <span>[{index + 1}]</span>
    </button>
  );
};

interface CitationSummaryProps {
  citations: Citation[];
  className?: string;
}

export const CitationSummary: React.FC<CitationSummaryProps> = ({
  citations,
  className = ''
}) => {
  if (!citations || citations.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sources</h4>
      <div className="space-y-2">
        {citations.map((citation, index) => (
          <div
            key={citation.id}
            className="flex items-start space-x-2 p-2 bg-gray-50 dark:bg-gray-800 rounded"
          >
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              [{index + 1}]
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
              >
                <span className="truncate">{citation.title}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {citation.snippet && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {citation.snippet}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
