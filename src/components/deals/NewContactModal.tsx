import React, { useState } from 'react';
import { ModernButton } from '../ui/ModernButton';
import { AIAutoFillButton } from '../ui/AIAutoFillButton';
import { AIResearchButton } from '../ui/AIResearchButton';
import { useContactStore } from '../../store/contactStore';
import { ContactEnrichmentData } from '../../services/aiEnrichmentService';
import { Contact } from '../../types/contact';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Tag, 
  Globe, 
  Target,
  Save,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Heart,
  MessageSquare,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Plus,
  Database,
  Smartphone,
  Clock,
  Star,
  Briefcase,
  MapPin,
  Calendar,
  Brain,
  Sparkles,
  Wand2,
  RefreshCw,
  Camera
} from 'lucide-react';

interface NewContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const interestLevels = [
  { value: 'hot', label: 'Hot Client', color: 'bg-red-500' },
  { value: 'medium', label: 'Medium Interest', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low Interest', color: 'bg-blue-500' },
  { value: 'cold', label: 'Non Interest', color: 'bg-gray-400' }
];

const statusOptions = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'churned', label: 'Churned' }
];

const sourceOptions = [
  'LinkedIn', 'Facebook', 'Email', 'Website', 'Referral', 'Typeform', 'Cold Call', 
  'Trade Show', 'Webinar', 'Advertisement', 'Google Ads', 'Social Media', 'Blog', 
  'Podcast', 'YouTube', 'Direct Mail', 'Partnership'
];

const industryOptions = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 
  'Real Estate', 'Consulting', 'Media', 'Transportation', 'Energy', 'Agriculture',
  'Construction', 'Entertainment', 'Government', 'Non-Profit', 'Other'
];

const socialPlatforms = [
  { key: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', placeholder: '+1-555-0123' },
  { key: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-500', placeholder: 'https://linkedin.com/in/username' },
  { key: 'twitter', name: 'Twitter', icon: Twitter, color: 'bg-blue-400', placeholder: 'https://twitter.com/username' },
  { key: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-700', placeholder: 'https://facebook.com/username' },
  { key: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500', placeholder: 'https://instagram.com/username' },
  { key: 'website', name: 'Website', icon: Globe, color: 'bg-purple-500', placeholder: 'https://company.com' }
];

export const NewContactModal: React.FC<NewContactModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    // Basic Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarSrc: '',
    
    // Professional Information
    title: '',
    company: '',
    industry: '',
    department: '',
    
    // Location Information
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    
    // Lead Information
    interestLevel: 'medium' as const,
    status: 'lead' as const,
    sources: [] as string[],
    
    // Personal Details
    birthday: '',
    timezone: '',
    preferredContact: 'email',
    
    // Social & Contact
    socialProfiles: {
      whatsapp: '',
      linkedin: '',
      twitter: '',
      facebook: '',
      instagram: '',
      website: ''
    },
    
    // Additional Information
    notes: '',
    tags: '',
    isFavorite: false,
    
    // Custom Fields
    customFields: {} as Record<string, string>
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newCustomField, setNewCustomField] = useState({ name: '', value: '' });
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [lastEnrichmentData, setLastEnrichmentData] = useState<ContactEnrichmentData | null>(null);
  
  const { createContact } = useContactStore();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.company) {
      newErrors.company = 'Company is required';
    }
    
    if (!formData.title) {
      newErrors.title = 'Title is required';
    }
    
    // Validate social profile URLs
    Object.entries(formData.socialProfiles).forEach(([key, value]) => {
      if (value && key !== 'whatsapp' && !value.startsWith('http')) {
        newErrors[`social_${key}`] = `${key} must be a valid URL`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSocialProfileChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialProfiles: {
        ...prev.socialProfiles,
        [platform]: value
      }
    }));
    if (errors[`social_${platform}`]) {
      setErrors(prev => ({ ...prev, [`social_${platform}`]: '' }));
    }
  };

  const handleSourceToggle = (source: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source]
    }));
  };

  const handleAddCustomField = () => {
    if (newCustomField.name && newCustomField.value) {
      setFormData(prev => ({
        ...prev,
        customFields: {
          ...prev.customFields,
          [newCustomField.name]: newCustomField.value
        }
      }));
      setNewCustomField({ name: '', value: '' });
    }
  };

  const handleRemoveCustomField = (fieldName: string) => {
    setFormData(prev => ({
      ...prev,
      customFields: Object.fromEntries(
        Object.entries(prev.customFields).filter(([key]) => key !== fieldName)
      )
    }));
  };

  const handleAIAutoFill = (enrichmentData: ContactEnrichmentData) => {
    setLastEnrichmentData(enrichmentData);
    
    // Apply enrichment data to form
    const updates: any = {};
    
    if (enrichmentData.firstName && !formData.firstName) {
      updates.firstName = enrichmentData.firstName;
    }
    if (enrichmentData.lastName && !formData.lastName) {
      updates.lastName = enrichmentData.lastName;
    }
    if (enrichmentData.email && !formData.email) {
      updates.email = enrichmentData.email;
    }
    if (enrichmentData.phone && !formData.phone) {
      updates.phone = enrichmentData.phone;
    }
    if (enrichmentData.title && !formData.title) {
      updates.title = enrichmentData.title;
    }
    if (enrichmentData.company && !formData.company) {
      updates.company = enrichmentData.company;
    }
    if (enrichmentData.industry && !formData.industry) {
      updates.industry = enrichmentData.industry;
    }
    if (enrichmentData.avatar && !formData.avatarSrc) {
      updates.avatarSrc = enrichmentData.avatar;
    }
    
    // Location data
    if (enrichmentData.location) {
      if (enrichmentData.location.city && !formData.city) {
        updates.city = enrichmentData.location.city;
      }
      if (enrichmentData.location.state && !formData.state) {
        updates.state = enrichmentData.location.state;
      }
      if (enrichmentData.location.country && !formData.country) {
        updates.country = enrichmentData.location.country;
      }
    }
    
    // Social profiles
    if (enrichmentData.socialProfiles) {
      const socialUpdates: any = {};
      Object.entries(enrichmentData.socialProfiles).forEach(([key, value]) => {
        if (value && !formData.socialProfiles[key as keyof typeof formData.socialProfiles]) {
          socialUpdates[key] = value;
        }
      });
      if (Object.keys(socialUpdates).length > 0) {
        updates.socialProfiles = { ...formData.socialProfiles, ...socialUpdates };
      }
    }
    
    // Notes
    if (enrichmentData.notes && !formData.notes) {
      updates.notes = enrichmentData.notes;
    } else if (enrichmentData.bio && !formData.notes) {
      updates.notes = enrichmentData.bio;
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const contactData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone || undefined,
        title: formData.title,
        company: formData.company,
        industry: formData.industry || undefined,
        avatarSrc: formData.avatarSrc || `https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2`,
        sources: formData.sources.length > 0 ? formData.sources : ['Manual Entry'],
        interestLevel: formData.interestLevel,
        status: formData.status,
        notes: formData.notes || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        isFavorite: formData.isFavorite,
        socialProfiles: Object.fromEntries(
          Object.entries(formData.socialProfiles).filter(([_, value]) => value)
        ),
        customFields: Object.keys(formData.customFields).length > 0 ? formData.customFields : undefined
      };
      
      await createContact(contactData);
      setIsSuccess(true);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to create contact:', error);
      setErrors({ submit: 'Failed to create contact. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', avatarSrc: '', title: '', company: '',
      industry: '', department: '', address: '', city: '', state: '', country: '',
      zipCode: '', interestLevel: 'medium', status: 'lead', sources: [], birthday: '',
      timezone: '', preferredContact: 'email', socialProfiles: { whatsapp: '', linkedin: '',
      twitter: '', facebook: '', instagram: '', website: '' }, notes: '', tags: '',
      isFavorite: false, customFields: {}
    });
    setErrors({});
    setIsSubmitting(false);
    setIsSuccess(false);
    setNewCustomField({ name: '', value: '' });
    setShowCustomFields(false);
    setLastEnrichmentData(null);
    onClose();
  };

  if (!isOpen) return null;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-green-900 mb-2">Contact Created!</h3>
          <p className="text-green-700 mb-4">
            {formData.firstName} {formData.lastName} has been added to your contacts.
          </p>
          {lastEnrichmentData && (
            <p className="text-sm text-gray-600 mb-4">
              ✨ Enhanced with AI research data
            </p>
          )}
          <ModernButton variant="primary" onClick={handleClose}>
            Close
          </ModernButton>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header with AI Features */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-600 rounded-xl text-white">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                New Contact
                <Sparkles className="w-5 h-5 ml-2 text-yellow-500" />
              </h2>
              <p className="text-gray-600">Add a contact with AI-powered research and auto-fill</p>
            </div>
          </div>
          
          {/* AI Quick Actions */}
          <div className="flex items-center space-x-3">
            <AIAutoFillButton
              formData={formData}
              onAutoFill={handleAIAutoFill}
              size="sm"
            />
            
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* AI-Enhanced Basic Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2 text-blue-500" />
                  Personal Information
                </h3>
                {(formData.email || formData.firstName) && (
                  <div className="flex items-center space-x-2">
                    <AIResearchButton
                      searchType="auto"
                      searchQuery={{
                        email: formData.email,
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        company: formData.company
                      }}
                      onDataFound={handleAIAutoFill}
                      variant="outline"
                      size="sm"
                      className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-blue-100"
                    />
                  </div>
                )}
              </div>
              
              {/* Avatar Section with AI Image Search */}
              {formData.avatarSrc && (
                <div className="flex items-center justify-center mb-6">
                  <div className="relative">
                    <img
                      src={formData.avatarSrc}
                      alt="Contact Avatar"
                      className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // Trigger new image search
                        if (formData.firstName || formData.lastName) {
                          // Find new image logic would go here
                          console.log('Finding new image...');
                        }
                      }}
                      className="absolute -bottom-1 -right-1 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Birthday
                  </label>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => handleInputChange('birthday', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter email address"
                    />
                    {formData.email && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <Brain className="w-4 h-4 text-purple-500" title="AI Research Available" />
                      </div>
                    )}
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1-555-0123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Contact Method
                  </label>
                  <select
                    value={formData.preferredContact}
                    onChange={(e) => handleInputChange('preferredContact', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="text">Text Message</option>
                    <option value="social">Social Media</option>
                  </select>
                </div>
              </div>

              {/* AI Enhancement Indicator */}
              {lastEnrichmentData && (
                <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">
                      Enhanced with AI Research
                    </span>
                    <span className="text-xs text-purple-600">
                      ({lastEnrichmentData.confidence}% confidence)
                    </span>
                  </div>
                </div>
              )}

              {/* Favorite Toggle */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFavorite}
                    onChange={(e) => handleInputChange('isFavorite', e.target.checked)}
                    className="text-red-600 rounded"
                  />
                  <Heart className={`w-5 h-5 ${formData.isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700">Add to Favorites</span>
                </label>
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="w-5 h-5 mr-2 text-green-500" />
                Professional Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.company ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter company name"
                  />
                  {errors.company && (
                    <p className="text-sm text-red-600 mt-1">{errors.company}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter job title"
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600 mt-1">{errors.title}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry
                  </label>
                  <select
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Industry</option>
                    {industryOptions.map((industry) => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Sales, Marketing, IT"
                  />
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-red-500" />
                Location Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Street address"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="State or Province"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP/Postal Code
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ZIP or Postal Code"
                  />
                </div>
              </div>
            </div>

            {/* Lead Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-orange-500" />
                Lead Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Interest Level
                  </label>
                  <div className="space-y-3">
                    {interestLevels.map((level) => (
                      <label key={level.value} className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="interestLevel"
                          value={level.value}
                          checked={formData.interestLevel === level.value}
                          onChange={(e) => handleInputChange('interestLevel', e.target.value)}
                          className="text-blue-600"
                        />
                        <div className={`w-3 h-3 rounded-full ${level.color}`}></div>
                        <span className="text-sm font-medium text-gray-700">{level.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sources */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-purple-500" />
                Lead Sources
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sourceOptions.map((source) => (
                  <label key={source} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.sources.includes(source)}
                      onChange={() => handleSourceToggle(source)}
                      className="text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* AI-Enhanced Social Profiles */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-500" />
                  Social Profiles & Contact Methods
                </h3>
                {formData.socialProfiles.linkedin && (
                  <AIResearchButton
                    searchType="linkedin"
                    searchQuery={{ linkedinUrl: formData.socialProfiles.linkedin }}
                    onDataFound={handleAIAutoFill}
                    variant="outline"
                    size="sm"
                    className="bg-blue-50 border-blue-200 text-blue-700"
                  />
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {socialPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div key={platform.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <div className={`${platform.color} p-1 rounded mr-2`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        {platform.name}
                        {platform.key === 'linkedin' && formData.socialProfiles[platform.key] && (
                          <Brain className="w-3 h-3 ml-1 text-purple-500" title="AI research available" />
                        )}
                      </label>
                      <input
                        type={platform.key === 'whatsapp' ? 'tel' : 'url'}
                        value={formData.socialProfiles[platform.key as keyof typeof formData.socialProfiles]}
                        onChange={(e) => handleSocialProfileChange(platform.key, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors[`social_${platform.key}`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder={platform.placeholder}
                      />
                      {errors[`social_${platform.key}`] && (
                        <p className="text-sm text-red-600 mt-1">{errors[`social_${platform.key}`]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Fields */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Database className="w-5 h-5 mr-2 text-purple-500" />
                  Custom Fields
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCustomFields(!showCustomFields)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Field</span>
                </button>
              </div>
              
              {/* Existing Custom Fields */}
              {Object.keys(formData.customFields).length > 0 && (
                <div className="space-y-3 mb-4">
                  {Object.entries(formData.customFields).map(([fieldName, fieldValue]) => (
                    <div key={fieldName} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Field Name</label>
                          <p className="text-sm font-medium text-gray-900">{fieldName}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Value</label>
                          <p className="text-sm text-gray-700">{fieldValue}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(fieldName)}
                        className="p-1 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add New Custom Field */}
              {showCustomFields && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Field name"
                      value={newCustomField.name}
                      onChange={(e) => setNewCustomField(prev => ({ ...prev, name: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Field value"
                      value={newCustomField.value}
                      onChange={(e) => setNewCustomField(prev => ({ ...prev, value: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <ModernButton 
                      type="button"
                      variant="primary" 
                      size="sm" 
                      onClick={handleAddCustomField}
                      disabled={!newCustomField.name || !newCustomField.value}
                    >
                      Add Field
                    </ModernButton>
                    <ModernButton 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowCustomFields(false)}
                    >
                      Cancel
                    </ModernButton>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Tag className="w-5 h-5 mr-2 text-yellow-500" />
                Additional Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleInputChange('tags', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enterprise, VIP, High Priority, Decision Maker"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes about this contact, their preferences, important details, meeting notes, etc."
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700">{errors.submit}</p>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Brain className="w-4 h-4 text-purple-500" />
                <span>Powered by OpenAI & Gemini AI</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <ModernButton
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  className="flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Create Contact</span>
                </ModernButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};