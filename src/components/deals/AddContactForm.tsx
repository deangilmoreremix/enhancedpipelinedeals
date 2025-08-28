import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  Tag, 
  Globe, 
  Briefcase, 
  Save,
  XCircle
} from 'lucide-react';

interface AddContactFormProps {
  onSubmit: (contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contact>;
  onCancel: () => void;
  initialData?: Partial<Contact>;
}

const AddContactForm: React.FC<AddContactFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {}
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: initialData.firstName || '',
    lastName: initialData.lastName || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    title: initialData.title || '',
    company: initialData.company || '',
    industry: initialData.industry || '',
    status: initialData.status || 'lead' as Contact['status'],
    interestLevel: initialData.interestLevel || 'medium' as Contact['interestLevel'],
    sources: initialData.sources || [] as string[],
    notes: initialData.notes || ''
  });

  const [sourceInput, setSourceInput] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.company.trim()) errors.company = 'Company is required';
    
    if (formData.email.trim() && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setIsSaving(true);

      // Process source input if there's any text left
      if (sourceInput.trim()) {
        addSource();
      }

      const contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        title: formData.title,
        company: formData.company,
        industry: formData.industry,
        status: formData.status,
        interestLevel: formData.interestLevel,
        sources: formData.sources,
        notes: formData.notes,
        socialProfiles: {},
        customFields: {},
      };
      
      await onSubmit(contactData);
    } catch (error) {
      console.error('Failed to create contact:', error);
      setFormErrors({
        form: 'Failed to create contact. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addSource = () => {
    if (sourceInput.trim() && !formData.sources.includes(sourceInput.trim())) {
      setFormData(prev => ({
        ...prev, 
        sources: [...prev.sources, sourceInput.trim()]
      }));
      setSourceInput('');
    }
  };

  const removeSource = (source: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter(s => s !== source)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {formErrors.form && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {formErrors.form}
        </div>
      )}
      
      {/* Personal Information */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
          <User className="w-4 h-4 mr-2 text-blue-600" />
          Contact Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className={`w-full px-3 py-2 border ${formErrors.firstName ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
              placeholder="John"
            />
            {formErrors.firstName && (
              <p className="mt-1 text-xs text-red-600">{formErrors.firstName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className={`w-full px-3 py-2 border ${formErrors.lastName ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
              placeholder="Doe"
            />
            {formErrors.lastName && (
              <p className="mt-1 text-xs text-red-600">{formErrors.lastName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full pl-10 pr-3 py-2 border ${formErrors.email ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                placeholder="john.doe@example.com"
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="+1 (123) 456-7890"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
          <Building2 className="w-4 h-4 mr-2 text-blue-600" />
          Company Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                className={`w-full pl-10 pr-3 py-2 border ${formErrors.company ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                placeholder="Acme Inc."
              />
            </div>
            {formErrors.company && (
              <p className="mt-1 text-xs text-red-600">{formErrors.company}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Marketing Manager"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Technology"
              />
            </div>
          </div>

          {/* Sources */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={sourceInput}
                    onChange={(e) => setSourceInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSource())}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="LinkedIn, Website, Referral..."
                  />
                </div>
                <button
                  type="button"
                  onClick={addSource}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>

              {formData.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.sources.map((source, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {source}
                      <button
                        type="button"
                        onClick={() => removeSource(source)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Information */}
      <div>
        <h4 className="text-base font-semibold text-gray-900 mb-3">
          Status Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Contact['status'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="customer">Customer</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interest Level
            </label>
            <select
              value={formData.interestLevel}
              onChange={(e) => setFormData(prev => ({ ...prev, interestLevel: e.target.value as Contact['interestLevel'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="hot">Hot</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="cold">Cold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="Add any relevant notes about this contact..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Create Contact</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default AddContactForm;