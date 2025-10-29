import React, { useState, useMemo, useEffect } from 'react';
import { useContactStore } from '../../store/contactStore';
import { Contact } from '../../types/contact';
import { 
  X, 
  Search, 
  User, 
  Building2, 
  Mail, 
  Phone,
  Check,
  Plus,
  MailCheck,
  UserCircle
} from 'lucide-react';
import AddContactForm from './AddContactForm';

interface SelectContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
  selectedContactId?: string;
}

export const SelectContactModal: React.FC<SelectContactModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
  selectedContactId
}) => {
  const { contacts, fetchContacts, createContact, isLoading } = useContactStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddContactForm, setShowAddContactForm] = useState(false);

  // Load contacts when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      
      // Pre-select the current contact if provided
      if (selectedContactId) {
        const currentContact = contacts.find(c => c.id === selectedContactId);
        if (currentContact) {
          setSelectedContact(currentContact);
        }
      }
    }
  }, [isOpen, selectedContactId, contacts, fetchContacts]);

  // Filter contacts based on search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    
    return contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contacts, searchTerm]);

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleConfirm = () => {
    if (selectedContact) {
      onSelectContact(selectedContact);
      onClose();
      setSelectedContact(null);
      setSearchTerm('');
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedContact(null);
    setSearchTerm('');
  };

  const handleAddNewContact = () => {
    setShowAddContactForm(true);
  };

  const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newContact = await createContact(contactData);
      // Auto-select the newly created contact
      setSelectedContact(newContact);
      setShowAddContactForm(false);
      return newContact;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            {showAddContactForm ? 'Add New Contact' : 'Select Contact'}
          </h3>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showAddContactForm ? (
          /* Add Contact Form */
          <div className="max-h-[calc(80vh-130px)] overflow-y-auto">
            <AddContactForm 
              onSubmit={handleSaveContact}
              onCancel={() => setShowAddContactForm(false)}
            />
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search contacts by name, company, email, or title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto max-h-96 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading contacts...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">
                    {searchTerm ? 'No contacts found' : 'No contacts available'}
                  </h4>
                  <p className="text-gray-500 text-sm mb-4">
                    {searchTerm 
                      ? 'Try adjusting your search terms or create a new contact.'
                      : 'Start by adding some contacts to your CRM.'
                    }
                  </p>
                  <button
                    onClick={handleAddNewContact}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Contact
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => handleContactSelect(contact)}
                      className={`
                        p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md
                        ${selectedContact?.id === contact.id 
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                        ${selectedContactId === contact.id 
                          ? 'ring-2 ring-green-100 bg-green-50 border-green-300' 
                          : ''
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {contact.avatarSrc ? (
                            <img 
                              src={contact.avatarSrc} 
                              alt={contact.name}
                              className="w-10 h-10 rounded-full border border-gray-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900 truncate">{contact.name}</h4>
                              {selectedContactId === contact.id && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{contact.title}</p>
                            
                            <div className="flex items-center space-x-4 mt-2">
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Building2 className="w-3 h-3" />
                                <span className="truncate">{contact.company}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                              {contact.phone && (
                                <div className="flex items-center space-x-1 text-xs text-gray-500">
                                  <Phone className="w-3 h-3" />
                                  <span className="truncate">{contact.phone}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 mt-2">
                              <span className={`
                                px-2 py-0.5 text-xs rounded-full font-medium
                                ${contact.status === 'customer' ? 'bg-green-100 text-green-700' :
                                  contact.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                                  contact.status === 'lead' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }
                              `}>
                                {contact.status}
                              </span>
                              <span className={`
                                px-2 py-0.5 text-xs rounded-full font-medium
                                ${contact.interestLevel === 'hot' ? 'bg-red-100 text-red-700' :
                                  contact.interestLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  contact.interestLevel === 'low' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }
                              `}>
                                {contact.interestLevel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {selectedContact?.id === contact.id && (
                          <div className="ml-3 flex-shrink-0">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleAddNewContact}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Contact</span>
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedContact}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Select Contact
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectContactModal;