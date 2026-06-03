import React from 'react';
import { Settings, Star, StarOff, TrendingUp } from 'lucide-react';
import { SDRAgentMeta, SDRAgentMetadata } from './types';

interface SDRAgentCardProps {
  agent: SDRAgentMeta;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onConfigure: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  showUsageStats?: boolean;
}

export const SDRAgentCard: React.FC<SDRAgentCardProps> = ({
  agent,
  isSelected,
  onSelect,
  onConfigure,
  onToggleFavorite,
  showUsageStats = true
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onSelect(agent.id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        padding: 12,
        borderRadius: 12,
        border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
        background: isSelected ? '#ebf8ff' : '#ffffff',
        boxShadow: isSelected ? '0 0 0 1px rgba(49,130,206,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: showUsageStats ? 140 : 120
      }}
    >
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(agent.id);
          }}
          style={{
            padding: 4,
            borderRadius: 6,
            border: 'none',
            background: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={agent.favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {agent.favorite ? (
            <Star size={14} color="#fbbf24" fill="#fbbf24" />
          ) : (
            <StarOff size={14} color="#9ca3af" />
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfigure(agent.id);
          }}
          style={{
            padding: 4,
            borderRadius: 6,
            border: 'none',
            background: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={`Configure ${agent.label}`}
        >
          <Settings size={14} color="#4a5568" />
        </button>
      </div>

      <div style={{ display: 'inline-block', width: '100%' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: getCategoryColor(agent.category), marginBottom: 8 }}>
          {agent.category}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: '#1a202c' }}>{agent.label}</div>
        <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 8 }}>{agent.short}</div>
        {showUsageStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#718096' }}>
            {agent.usageCount !== undefined && agent.usageCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TrendingUp size={10} />
                <span>Used {agent.usageCount}x</span>
              </div>
            )}
            {agent.lastUsed && <div>Last: {formatLastUsed(agent.lastUsed)}</div>}
          </div>
        )}
        {agent.tags && agent.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {agent.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
                {tag}
              </span>
            ))}
            {agent.tags.length > 3 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{agent.tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

function formatLastUsed(date: Date | undefined) {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default SDRAgentCard;