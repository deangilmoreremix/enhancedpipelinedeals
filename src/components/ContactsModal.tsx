import { ImportDealsModal } from './ImportContactsModal';
import { NewContactModal } from './NewContactModal';
import { useContactStore } from '../../store/contactStore';
import { useOpenAI } from '../../services/openaiService';
import { aiEnrichmentService, ContactEnrichmentData } from '../../services/aiEnrichmentService';
import { Contact } from '../../types/contact';
import { AIEnhancedContactCard } from '../contacts/AIEnhancedContactCard';
import Fuse from 'fuse.js';

const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
const [aiResults, setAiResults] = useState<{success: number, failed: number} | null>(null);
const [analyzingContactIds, setAnalyzingContactIds] = useState<string[]>([]);
const [isBulkEnriching, setIsBulkEnriching] = useState(false);
const [enrichingContactIds, setEnrichingContactIds] = useState<string[]>([]);

// Modal States
const [isImportModalOpen, setIsImportModalOpen] = useState(false);

const handleBulkAIEnrich = async () => {
    if (selectedContacts.length === 0) {
      alert('Please select contacts to enrich first.');
      return;
    }

    setIsBulkEnriching(true);
    setAnalysisProgress({ current: 0, total: selectedContacts.length });
    setAiResults(null);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selectedContacts.length; i++) {
      const contactId = selectedContacts[i];
      const contact = contacts.find(c => c.id === contactId);
      
      if (contact) {
        setAnalysisProgress({ current: i + 1, total: selectedContacts.length });
        setEnrichingContactIds(prev => [...prev, contactId]);
        
        try {
          // Prepare contact data for enrichment
          const enrichmentData: ContactEnrichmentData = {
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            name: contact.name,
            company: contact.company,
            linkedinUrl: contact.socialProfiles?.linkedin
          };
          
          // Call the AI enrichment service
          const enriched = await aiEnrichmentService.enrichContact(enrichmentData);
          
          // Prepare updates for the contact
          const updates: Partial<Contact> = {
            lastEnrichment: {
              confidence: enriched.confidence || 75,
              aiProvider: enriched.aiProvider || 'AI Assistant',
              timestamp: new Date()
            }
          };
          
          // Update various fields if they're returned by the enrichment
          if (enriched.phone && !contact.phone) updates.phone = enriched.phone;
          if (enriched.industry && !contact.industry) updates.industry = enriched.industry;
          if (enriched.title && !contact.title) updates.title = enriched.title;
          if (enriched.avatar && !contact.avatarSrc) updates.avatarSrc = enriched.avatar;
          
          // Add notes from enrichment
          if (enriched.notes || enriched.bio) {
            const newNote = enriched.notes || enriched.bio;
            updates.notes = contact.notes 
              ? `${contact.notes}\n\nAI Enrichment: ${newNote}`
              : `AI Enrichment: ${newNote}`;
          }
          
          // Add social profiles
          if (enriched.socialProfiles && Object.keys(enriched.socialProfiles).length > 0) {
            updates.socialProfiles = {
              ...(contact.socialProfiles || {}),
              ...enriched.socialProfiles
            };
          }
          
          // Set AI score if confidence is provided
          if (enriched.confidence) {
            updates.aiScore = Math.round(enriched.confidence);
          }
          
          // Update the contact
          await updateContact(contactId, updates);
          successCount++;
        } catch (error) {
          console.error(`Failed to enrich contact ${contactId}:`, error);
          failedCount++;
        } finally {
          setEnrichingContactIds(prev => prev.filter(id => id !== contactId));
        }
      }
      
      // Small delay to prevent overwhelming the UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setAiResults({ success: successCount, failed: failedCount });
    setAnalysisProgress(null);
    setSelectedContacts([]);
    setIsBulkEnriching(false);
};

// Contact Selection Functions
const handleContactSelect = (contactId: string) => {
    setSelectedContacts(prev => 
        prev.includes(contactId)
            ? prev.filter(id => id !== contactId)
            : [...prev, contactId]
    );
};

{/* AI Analysis Progress */}
{(isAnalyzing || isBulkEnriching || analysisProgress || aiResults) && (
    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200">
        {analysisProgress && (
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin duration-700" />
                    <span className="font-medium text-purple-900">
                        {isBulkEnriching ? 'Enriching' : 'Analyzing'} contacts... ({analysisProgress.current}/{analysisProgress.total})
                    </span>
                </div>
                <div className="flex-1 max-w-xs">
                    <button
                        onClick={() => handleStatusFilterClick(option.value)}
                        className={`
                            w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg
                            ${statusFilter === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                        `}
                    >
                        {option.label}
                    </button>
                    <button
                        onClick={handleReanalyzeSelected}
                        disabled={selectedContacts.length === 0 || isAnalyzing}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg disabled:opacity-50"
                    >
                        Re-analyze Selected
                    </button>
                    <button
                        onClick={handleBulkAIEnrich}
                        disabled={isBulkEnriching}
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span>{isBulkEnriching ? 'Enriching...' : 'Bulk AI Enrich'}</span>
                    </button>
                    <button 
                        className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={handleExportContacts}
                    >
                        Export Contacts
                    </button>
                </div>
            </div>
        )}
    </div>
)}

{filteredContacts.map(contact => (
    <AIEnhancedContactCard
        key={contact.id}
        contact={contact}
        isSelected={selectedContacts.includes(contact.id)}
        onSelect={() => handleContactSelect(contact.id)}
        onClick={() => handleContactClick(contact)}
        onAnalyze={handleAnalyzeContact}
        isAnalyzing={analyzingContactIds.includes(contact.id) || enrichingContactIds.includes(contact.id)}
    />
))}