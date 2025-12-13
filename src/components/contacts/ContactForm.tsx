import React, { useState, useCallback } from 'react';
import { RefreshCw, UserPlus, AlertCircle } from 'lucide-react';
import { Contact } from '../../types/contact';
import { AIEnrichmentData } from '../../services/enhancedContactImportService';
import { validateString, validateEmail } from '../../utils/validation';

interface ContactFormProps {
  initialData?: Partial<Contact>;
  onSubmit: (contact: Contact & AIEnrichmentData) => Promise<void>;
  onCancel: () => void;
  enrichmentOptions: {
    enrichCompanyData: boolean;
    discoverSocialProfiles: boolean;
    analyzeBuyingSignals: boolean;
    generateLeadScoring: boolean;
    includeWebResearch: boolean;
    maxResearchResults: number;
  };
  isLoading?: boolean;
}

interface FormErrors {
  [key: string]: string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  enrichmentOptions,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<Partial<Contact>>(initialData);
  const [aiSuggestions, setAiSuggestions] = useState<Partial<AIEnrichmentData>>({});
  const [isEnriching, setIsEnriching] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Real-time AI enrichment as user types
  const handleFieldChange = useCallback(async (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Trigger AI enrichment for certain fields
    if (field === 'company' && value.length > 2 && enrichmentOptions.enrichCompanyData) {
      setIsEnriching(true);
      try {
        const enrichment = await getAISuggestions(field, value, formData);
        setAiSuggestions(prev => ({ ...prev, ...enrichment }));
      } catch (error) {
        console.warn('AI enrichment failed:', error);
      } finally {
        setIsEnriching(false);
      }
    }
  }, [errors, enrichmentOptions.enrichCompanyData, formData]);

  // Get AI suggestions (mock implementation - would integrate with actual AI service)
  const getAISuggestions = async (field: string, value: string, currentData: Partial<Contact>): Promise<Partial<AIEnrichmentData>> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (field === 'company') {
      // Mock AI enrichment response
      return {
        enrichedCompanyData: {
          industry: 'Technology',
          size: 'SMB',
          revenue: '$5M - $25M',
          competitors: ['Competitor A', 'Competitor B'],
          founded: '2015',
          description: `${value} is a technology company specializing in innovative solutions.`,
          headquarters: 'San Francisco, CA',
          funding: 'Series A'
        }
      };
    }

    return {};
  };

  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required field validations
    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email?.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailValidation = validateEmail(formData.email);
      if (!emailValidation.isValid) {
        newErrors.email = emailValidation.error || 'Invalid email format';
      }
    }

    if (!formData.company?.trim()) {
      newErrors.company = 'Company is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Create contact object
      const contact: Contact = {
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email || '',
        phone: formData.phone || '',
        title: formData.title || '',
        company: formData.company || '',
        industry: formData.industry || '',
        status: formData.status || 'lead',
        interestLevel: formData.interestLevel || 'medium',
        sources: ['Manual Entry'],
        notes: formData.notes || '',
        tags: formData.tags || [],
        customFields: formData.customFields || {},
        socialProfiles: formData.socialProfiles || {},
        aiScore: formData.aiScore || 50,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Combine contact with AI enrichment data
      const enrichedContact: Contact & AIEnrichmentData = {
        ...contact,
        ...aiSuggestions,
        enrichmentMetadata: {
          sourcesUsed: ['manual-entry'],
          confidence: 0.9,
          lastEnriched: new Date(),
          enrichmentDuration: 0
        }
      };

      await onSubmit(enrichedContact);
    } catch (error) {
      console.error('Form submission failed:', error);
      setErrors({ submit: 'Failed to create contact. Please try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={formData.firstName || ''}
            onChange={(e) => handleFieldChange('firstName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
              errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {errors.firstName && (
            <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={formData.lastName || ''}
            onChange={(e) => handleFieldChange('lastName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
              errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {errors.lastName && (
            <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email with validation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email Address *
        </label>
        <input
          type="email"
          value={formData.email || ''}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
          required
        />
        {errors.email && (
          <p className="text-red-500 text-sm mt-1">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => handleFieldChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Job Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Job Title
        </label>
        <input
          type="text"
          value={formData.title || ''}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Company with AI suggestions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Company *
        </label>
        <div className="relative">
          <input
            type="text"
            value={formData.company || ''}
            onChange={(e) => handleFieldChange('company', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
              errors.company ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {isEnriching && (
            <div className="absolute right-3 top-3">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            </div>
          )}
        </div>
        {errors.company && (
          <p className="text-red-500 text-sm mt-1">{errors.company}</p>
        )}

        {/* AI Suggestions */}
        {aiSuggestions.enrichedCompanyData && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>AI Suggestion:</strong> {aiSuggestions.enrichedCompanyData.description}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded">
                {aiSuggestions.enrichedCompanyData.industry}
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded">
                {aiSuggestions.enrichedCompanyData.size}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Industry
        </label>
        <select
          value={formData.industry || ''}
          onChange={(e) => handleFieldChange('industry', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Industry</option>
          <option value="Technology">Technology</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Finance">Finance</option>
          <option value="Manufacturing">Manufacturing</option>
          <option value="Retail">Retail</option>
          <option value="Education">Education</option>
          <option value="Real Estate">Real Estate</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Status and Interest Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={formData.status || 'lead'}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="lead">Lead</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Interest Level
          </label>
          <select
            value={formData.interestLevel || 'medium'}
            onChange={(e) => handleFieldChange('interestLevel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="hot">Hot</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="cold">Cold</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Add any additional notes about this contact..."
        />
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700 dark:text-red-300 text-sm">{errors.submit}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
              Creating Contact...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2 inline" />
              Create Contact
            </>
          )}
        </button>
      </div>
    </form>
  );
};