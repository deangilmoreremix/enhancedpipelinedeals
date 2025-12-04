import React from 'react';
import { Contact } from '../types/contact';

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
  selectedContactId?: string;
}

export const ContactsModal: React.FC<ContactsModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
  selectedContactId
}) => {
  if (!isOpen) return null;

  // Mock contacts for now - in a real app this would come from a store or API
  const mockContacts: Contact[] = [
    {
      id: '1',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      company: 'Tech Corp',
      title: 'CEO',
      phone: '+1-555-0123',
      status: 'lead',
      interestLevel: 'hot',
      sources: ['LinkedIn'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'Jane Smith',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      company: 'Design Studio',
      title: 'Designer',
      phone: '+1-555-0124',
      status: 'lead',
      interestLevel: 'medium',
      sources: ['Website'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">Select Contact</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            ✕
          </button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {mockContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium dark:text-white">{contact.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{contact.title} at {contact.company}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};