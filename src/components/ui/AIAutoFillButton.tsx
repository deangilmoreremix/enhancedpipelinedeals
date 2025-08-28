import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  Bot, 
  Wand2, 
  RefreshCw, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { aiEnrichmentService, ContactEnrichmentData } from '../../services/aiEnrichmentService';

interface AIAutoFillButtonProps {
  formData: any;
  onAutoFill: (enrichmentData: ContactEnrichmentData) => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AIAutoFillButton: React.FC<AIAutoFillButtonProps> = ({
  formData,
  onAutoFill,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasEnriched, setHasEnriched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      // Determine what data we have to work with
      const searchData: ContactEnrichmentData = {};
      
      // Populate with available form data
      if (formData.firstName && formData.lastName) {
        searchData.name = `${formData.firstName} ${formData.lastName}`;
      } else if (formData.firstName) {
        searchData.name = formData.firstName;
      } else if (formData.lastName) {
        searchData.name = formData.lastName;
      }

      if (formData.email) searchData.email = formData.email;
      if (formData.company) searchData.company = formData.company;
      
      if (formData.socialProfiles?.linkedin) {
        searchData.linkedinUrl = formData.socialProfiles.linkedin;
      }

      // Check if we have minimum required data
      if (!searchData.name && !searchData.email && !searchData.linkedinUrl) {
        throw new Error('Please provide at least a name or email to auto-fill');
      }

      // Use the AI enrichment service
      const enrichedData = await aiEnrichmentService.enrichContact(searchData);

      if (enrichedData && enrichedData.confidence && enrichedData.confidence > 0) {
        onAutoFill(enrichedData);
        setHasEnriched(true);
      } else {
        throw new Error('Could not find enough information to enrich contact');
      }
    } catch (error) {
      console.error('Auto-fill failed:', error);
      setError(error instanceof Error ? error.message : 'Auto-fill failed');
    } finally {
      setIsProcessing(false);
      
      // Reset success state after 3 seconds
      if (hasEnriched) {
        setTimeout(() => {
          setHasEnriched(false);
        }, 3000);
      }
    }
  };

  // Button appearance based on state
  let buttonStyle = '';
  let Icon = Wand2;
  let buttonText = 'AI Auto-Fill';

  if (isProcessing) {
    Icon = Loader2;
    buttonText = 'Processing...';
  } else if (hasEnriched) {
    Icon = CheckCircle;
    buttonText = 'Enriched!';
    buttonStyle = 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800';
  } else if (error) {
    Icon = AlertCircle;
    buttonText = 'Try Again';
    buttonStyle = 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800';
  } else {
    // Default styling based on variant
    switch(variant) {
      case 'primary':
        buttonStyle = 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white dark:from-purple-700 dark:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800';
        break;
      case 'secondary':
        buttonStyle = 'bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-700 dark:hover:bg-gray-800';
        break;
      case 'outline':
        buttonStyle = 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 dark:bg-gray-800 dark:border-purple-500 dark:text-purple-400 dark:hover:bg-gray-700';
        break;
    }
  }

  // Size classes
  let sizeClasses = '';
  switch(size) {
    case 'sm':
      sizeClasses = 'px-3 py-1.5 text-sm';
      break;
    case 'md':
      sizeClasses = 'px-4 py-2 text-sm';
      break;
    case 'lg':
      sizeClasses = 'px-6 py-3 text-base';
      break;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      className={`
        flex items-center space-x-2 rounded-lg font-medium transition-all duration-200
        ${buttonStyle} 
        ${sizeClasses}
        ${isProcessing ? 'opacity-80 cursor-wait' : ''}
        ${className}
      `}
    >
      <Icon className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
      <span>{buttonText}</span>
      {!isProcessing && !hasEnriched && !error && (
        <Sparkles className="w-3 h-3 text-yellow-300" />
      )}
    </button>
  );
};

export default AIAutoFillButton;