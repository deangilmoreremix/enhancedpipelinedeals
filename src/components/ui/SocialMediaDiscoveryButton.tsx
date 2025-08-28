/**
 * Social Media Discovery Button Component
 * Provides UI for triggering Gemma-powered social media channel discovery
 */

import React, { useState } from 'react';
import { useSocialMediaDiscovery } from '../../hooks/useSocialMediaDiscovery';
import { ModernButton } from './ModernButton';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  RefreshCw,
  ExternalLink,
  Share2,
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube
} from 'lucide-react';

interface SocialMediaDiscoveryButtonProps {
  entityType: 'company' | 'contact' | 'app';
  entityData: any;
  onChannelsDiscovered?: (channels: any[]) => void;
  onError?: (error: string) => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showResults?: boolean;
  className?: string;
}

const platformIcons: { [key: string]: React.ComponentType<any> } = {
  linkedin: Linkedin,
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  default: Globe
};

export const SocialMediaDiscoveryButton: React.FC<SocialMediaDiscoveryButtonProps> = ({
  entityType,
  entityData,
  onChannelsDiscovered,
  onError,
  variant = 'primary',
  size = 'md',
  showResults = true,
  className = ''
}) => {
  const { 
    discoverCompanyChannels, 
    discoverContactChannels, 
    enrichAppSocialChannels,
    isDiscovering, 
    lastDiscovery, 
    discoveryError 
  } = useSocialMediaDiscovery();
  
  const [showDiscoveryResults, setShowDiscoveryResults] = useState(false);

  const handleDiscovery = async () => {
    try {
      let result;
      
      switch (entityType) {
        case 'company':
          result = await discoverCompanyChannels(entityData);
          break;
        case 'contact':
          result = await discoverContactChannels(entityData);
          break;
        case 'app':
          result = await enrichAppSocialChannels(entityData);
          break;
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }

      if (onChannelsDiscovered) {
        onChannelsDiscovered(result.channels);
      }
      
      if (showResults) {
        setShowDiscoveryResults(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Discovery failed';
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  return (
    <div className={className}>
      <ModernButton
        variant={variant}
        size={size}
        onClick={handleDiscovery}
        loading={isDiscovering}
        className="flex items-center space-x-2"
      >
        {isDiscovering ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Discovering...</span>
          </>
        ) : lastDiscovery && !discoveryError ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>
              {entityType === 'app' ? 'App Channels' : 
               entityType === 'company' ? 'Company Channels' : 
               'Contact Channels'} ({lastDiscovery.channels.length})
            </span>
          </>
        ) : discoveryError ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Retry Discovery</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>Discover Social Channels</span>
            <Sparkles className="w-3 h-3 text-yellow-300" />
          </>
        )}
      </ModernButton>

      {/* Discovery Results Panel */}
      {showDiscoveryResults && lastDiscovery && (
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-purple-900 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Gemma Social Discovery Results
            </h4>
            <button
              onClick={() => setShowDiscoveryResults(false)}
              className="text-purple-600 hover:text-purple-800"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {lastDiscovery.channels.length > 0 ? (
              <>
                <div className="text-sm text-purple-700 mb-2">
                  Found {lastDiscovery.channels.length} social channels ({lastDiscovery.confidence}% confidence)
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {lastDiscovery.channels.map((channel, index) => {
                    const IconComponent = platformIcons[channel.platform.toLowerCase()] || platformIcons.default;
                    
                    return (
                      <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-purple-200">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-gray-900">{channel.platform}</span>
                          <span className="text-xs text-gray-500">{channel.confidence}%</span>
                          {channel.verified && (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-800 flex items-center space-x-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
                
                {lastDiscovery.brandedHashtags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-purple-800 mb-1">Branded Hashtags:</p>
                    <div className="flex flex-wrap gap-1">
                      {lastDiscovery.brandedHashtags.map((hashtag, index) => (
                        <span key={index} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {hashtag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-purple-600 mt-2">
                  Social Presence Score: {lastDiscovery.socialPresenceScore}/100 • {lastDiscovery.aiProvider}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-purple-700">
                <Share2 className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-sm">No social channels discovered</p>
                <p className="text-xs mt-1">Try refining the search criteria</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {discoveryError && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700">{discoveryError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialMediaDiscoveryButton;