import React from 'react';
import { useState, useEffect } from 'react';
import { DealDetailView } from './DealDetailView';
import { SelectContactModal } from './deals/SelectContactModal';
import { mockDeals } from '../data/mockDeals';
import { useContactStore } from '../store/contactStore';
import { Contact } from '../types/contact';

interface DealDetailProps {
  dealId: string;
  onClose: () => void;
}

const DealDetail: React.FC<DealDetailProps> = ({ dealId, onClose }) => {
  // Fetch contacts to provide the linked contact to DealDetailView
  const { contacts } = useContactStore();
  const [showContactModal, setShowContactModal] = useState(false);
  const deal = mockDeals[dealId];
  
  // Find the associated contact if available
  const contactData: Contact | null = deal?.contactId 
    ? contacts.find(c => c.id === deal.contactId) || null 
    : null;

  if (!deal) return null;

  const handleAddContact = () => {
    console.log('Add contact button clicked, opening modal...');
    setShowContactModal(true);
  };

  const handleSelectContact = (selectedContact: Contact) => {
    // Update the deal with the new contact
    const updatedDeal = { 
      ...deal, 
      contactId: selectedContact.id,
      contact: selectedContact.name,
      updatedAt: new Date() 
    };
    
    // Update the mockDeals object (in a real app, this would be an API call)
    mockDeals[dealId] = updatedDeal;
    
    setShowContactModal(false);
    console.log('Contact selected for deal:', selectedContact.name);
  };

  return (
    <>
      <DealDetailView
        deal={deal}
        isOpen={true}
        onClose={onClose}
        onUpdate={async (id, updates) => {
          // In a real app, this would call an API to update the deal
          const updatedDeal = { ...deal, ...updates, updatedAt: new Date() };
          console.log('Updating deal:', id, updates);
          return updatedDeal;
        }}
        contactData={contactData}
        onAddContact={handleAddContact}
      />
      
      <SelectContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSelectContact={handleSelectContact}
        selectedContactId={deal.contactId}
      />
    </>
  );
};

export default DealDetail;