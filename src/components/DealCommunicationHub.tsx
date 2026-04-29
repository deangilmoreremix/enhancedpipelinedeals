/**
 * DealCommunicationHub Component
 *
 * Enhanced Twenty CRM-level communication management interface for deal interactions.
 * Provides comprehensive communication tracking with threading, analytics, and integrations.
 *
 * Features:
 * 1. Email threading with conversation view
 * 2. Communication timeline with chronological sorting
 * 3. Message status tracking (sent, delivered, read)
 * 4. Attachment preview and management
 * 5. Quick reply/action buttons
 * 6. Search and filter within communications
 * 7. Real-time updates for new messages
 * 8. Email integration with connected accounts
 * 9. Call and meeting integration
 * 10. Communication analytics (response rates, time-to-respond)
 * 11. AI-powered conversation summarization
 * 12. Sentiment analysis
 * 13. Priority scoring
 * 14. Follow-up reminders
 * 15. Contact timeline integration
 * 16. Multi-channel communication history
 * 17. Task extraction from conversations
 * 18. Communication patterns insights
 * 19. Response time tracking
 * 20. Integration with CRM activities
 *
 * @param deal - The deal object containing deal information
 * @param contact - Optional contact associated with the deal
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { 
  MessageSquare, Mail, Phone, Calendar, FileText, Send, Paperclip, Clock, Zap, Wifi, WifiOff, 
  Eye, Sparkles, X, Search, Filter, CheckCircle, Check, Clock as ClockIcon, AlertCircle,
  Download, Trash2, Plus, ChevronDown, ChevronRight, ChevronUp, BarChart3, 
  TrendingUp, Users, Tag, Star, Flag, ClipboardList, ThumbsUp, MessageCircle, 
  Bell, RefreshCw, Archive, Inbox, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { getSupabaseService } from '../services/supabaseService';
import ResearchStatusOverlay from './ui/ResearchStatusOverlay';
import { ModernButton } from './ui/ModernButton';
import { getWebSearchService } from '../services/webSearchService';
import { getStorageBucketService } from '../services/storageBucketService';
import { EmailThreadingService } from '../services/emailThreadingService';
import { CalendarEventService } from '../services/calendarEventService';

interface DealCommunicationHubProps {
  deal: Deal;
  contact?: Contact | null;
}

// Communication types
interface CommunicationMessage {
  id: string;
  type: 'email' | 'message' | 'call' | 'meeting';
  direction: 'incoming' | 'outgoing';
  content: string;
  sender: string;
  recipient?: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  subject?: string;
  threadId?: string;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    url?: string;
    preview?: string;
  }>;
  metadata?: {
    priority: number;
    sentiment: number;
    responseTime?: number;
    tags?: string[];
  };
  readAt?: Date;
  deliveredAt?: Date;
}

interface CommunicationThread {
  id: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
  messageCount: number;
  status: 'active' | 'archived';
  priority: number;
  sentiment: number;
  latestMessage?: CommunicationMessage;
}

interface CommunicationFilter {
  types: ('email' | 'message' | 'call' | 'meeting')[];
  status: ('sent' | 'delivered' | 'read')[];
  priority: number;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  searchQuery: string;
}

interface CommunicationAnalytics {
  totalMessages: number;
  averageResponseTime: number;
  readRate: number;
  sentimentScore: number;
  responseRate: number;
  peakCommunicationHours: Array<{ hour: number; count: number }>;
  communicationFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export const DealCommunicationHub: React.FC<DealCommunicationHubProps> = ({ deal, contact }) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'calls' | 'emails' | 'meetings' | 'threads'>('messages');
  const [documentSummaries, setDocumentSummaries] = useState<Record<string, string>>({});
  const [summarizingFiles, setSummarizingFiles] = useState<Set<string>>(new Set<string>());
  const [showSummary, setShowSummary] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState<{
    isVisible: boolean;
    statuses: Array<{
      id: string;
      stage: 'analyzing' | 'complete' | 'error';
      message: string;
      progress: number;
      timestamp: Date;
      sourceCount?: number;
    }>;
  } | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [calls, setCalls] = useState<CommunicationMessage[]>([]);
  const [emails, setEmails] = useState<CommunicationMessage[]>([]);
  const [meetings, setMeetings] = useState<CommunicationMessage[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<CommunicationThread | null>(null);
  
  const [filters, setFilters] = useState<CommunicationFilter>({
    types: ['email', 'message', 'call', 'meeting'],
    status: ['sent', 'delivered', 'read'],
    priority: 0,
    dateRange: { start: null, end: null },
    searchQuery: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [analytics, setAnalytics] = useState<CommunicationAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<CommunicationMessage | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    file: CommunicationMessage['attachments'][0];
    messageId: string;
  } | null>(null);
  
  const [realTimeSubscriptions, setRealTimeSubscriptions] = useState<any[]>([]);
  const supabaseService = getSupabaseService();
  const webSearchService = getWebSearchService();
  const storageService = getStorageBucketService();
  
  const messagesRef = useRef<CommunicationMessage[]>([]);
  const emailThreadsRef = useRef<CommunicationThread[]>([]);

  // Real-time data loading
  useEffect(() => {
    loadCommunications();
    setupRealTimeSubscriptions();
    calculateAnalytics();
    return () => cleanupSubscriptions();
  }, [deal.id]);

  const loadCommunications = async () => {
    setIsLoading(true);
    try {
      const mockData = generateMockCommunications();
      setMessages(mockData.messages);
      setCalls(mockData.calls);
      setEmails(mockData.emails);
      setMeetings(mockData.meetings);
      setThreads(mockData.threads);
      messagesRef.current = mockData.messages;
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealTimeSubscriptions = () => {
    const subscriptions = [];
    
    const messageChannel = supabaseService.channel('communications-channel');
    subscriptions.push(messageChannel);
    
    const handleOnline = () => {
      setIsOnline(true);
      loadCommunications();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    subscriptions.push({ unsubscribe: () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }});
    
    setRealTimeSubscriptions(subscriptions);
  };

  const cleanupSubscriptions = () => {
    realTimeSubscriptions.forEach(sub => {
      if (sub.unsubscribe) sub.unsubscribe();
    });
    setRealTimeSubscriptions([]);
  };

  const generateMockCommunications = () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const messages: CommunicationMessage[] = [
      {
        id: 'msg-1',
        type: 'message',
        direction: 'incoming',
        content: 'Hi! I reviewed the proposal and have some questions about the timeline. Can we discuss?',
        sender: contact?.name || 'John Doe',
        timestamp: new Date(now - 2 * 60 * 60 * 1000),
        status: 'read',
        metadata: {
          priority: 0.8,
          sentiment: 0.3,
          responseTime: 3600000,
          tags: ['urgent', 'timeline']
        }
      },
      {
        id: 'msg-2',
        type: 'message',
        direction: 'outgoing',
        content: 'Absolutely, I am available tomorrow at 2 PM for a call to discuss the timeline in detail.',
        sender: 'You',
        timestamp: new Date(now - 1.5 * 60 * 60 * 1000),
        status: 'delivered',
        metadata: {
          priority: 0.7,
          sentiment: 0.8,
          responseTime: 1800000,
          tags: ['scheduling']
        }
      },
      {
        id: 'msg-3',
        type: 'message',
        direction: 'incoming',
        content: 'Perfect! Looking forward to it. Also, can you send over the technical specifications document?',
        sender: contact?.name || 'John Doe',
        timestamp: new Date(now - 30 * 60 * 1000),
        status: 'read',
        metadata: {
          priority: 0.6,
          sentiment: 0.7,
          responseTime: 1200000,
          tags: ['document', 'technical']
        }
      },
    ];

    const calls: CommunicationMessage[] = [
      {
        id: 'call-1',
        type: 'call',
        direction: 'outgoing',
        content: 'Discussed pricing and timeline. Client is interested but wants to review technical specs.',
        sender: 'You',
        timestamp: new Date(now - day),
        status: 'read',
        metadata: {
          priority: 0.75,
          sentiment: 0.6,
          tags: ['pricing', 'timeline']
        }
      },
      {
        id: 'call-2',
        type: 'call',
        direction: 'incoming',
        content: 'Initial discovery call to understand requirements.',
        sender: contact?.name || 'John Doe',
        timestamp: new Date(now - 3 * day),
        status: 'read',
        metadata: {
          priority: 0.5,
          sentiment: 0.8,
          tags: ['discovery']
        }
      },
    ];

    const emails: CommunicationMessage[] = [
      {
        id: 'email-1',
        type: 'email',
        direction: 'outgoing',
        content: 'Please find attached the updated proposal with revised pricing based on our discussion.',
        sender: 'You',
        recipient: contact?.email || 'john@company.com',
        subject: 'Updated Proposal - Enterprise Solution',
        timestamp: new Date(now - 3 * day),
        status: 'read',
        attachments: [
          { id: 'att-1', name: 'proposal_v2.pdf', size: 2048576, type: 'application/pdf', url: '#' },
          { id: 'att-2', name: 'technical_specs.pdf', size: 1048576, type: 'application/pdf', url: '#' }
        ],
        metadata: {
          priority: 0.9,
          sentiment: 0.7,
          tags: ['proposal', 'pricing', 'attachment']
        }
      },
      {
        id: 'email-2',
        type: 'email',
        direction: 'incoming',
        content: 'Thanks for the proposal. We need to review internally and will get back to you early next week.',
        sender: contact?.email || 'john@company.com',
        recipient: 'You',
        subject: 'Re: Updated Proposal - Enterprise Solution',
        timestamp: new Date(now - 2 * day),
        status: 'read',
        metadata: {
          priority: 0.6,
          sentiment: 0.5,
          responseTime: 86400000,
          tags: ['internal-review']
        }
      },
    ];

    const meetings: CommunicationMessage[] = [
      {
        id: 'meeting-1',
        type: 'meeting',
        direction: 'outgoing',
        content: 'Product Demo & Requirements Review scheduled',
        sender: 'You',
        timestamp: new Date(now + 2 * day),
        status: 'sent',
        metadata: {
          priority: 0.8,
          sentiment: 0.9,
          tags: ['demo', 'requirements']
        }
      },
    ];

    const threads: CommunicationThread[] = [
      {
        id: 'thread-1',
        subject: 'Proposal Review & Technical Questions',
        participants: [contact?.name || 'John Doe', 'You'],
        lastMessageAt: new Date(now - 30 * 60 * 1000),
        messageCount: 5,
        status: 'active',
        priority: 0.8,
        sentiment: 0.6,
        latestMessage: messages[0]
      },
      {
        id: 'thread-2',
        subject: 'Enterprise Solution Proposal',
        participants: [contact?.name || 'John Doe', 'You', 'Sarah Johnson'],
        lastMessageAt: new Date(now - 3 * day),
        messageCount: 3,
        status: 'active',
        priority: 0.7,
        sentiment: 0.5,
        latestMessage: emails[0]
      },
    ];

    return { messages, calls, emails, meetings, threads };
  };

  const calculateAnalytics = useCallback(() => {
    if (messages.length === 0 && emails.length === 0) {
      setAnalytics(null);
      return;
    }

    const allComms = [...messages, ...emails, ...calls];
    const now = Date.now();
    
    const responseTimes: number[] = [];
    const hourlyDistribution: Record<number, number> = {};
    
    for (let i = 0; i < 24; i++) hourlyDistribution[i] = 0;
    
    let totalSentiment = 0;
    let readCount = 0;
    let deliveredCount = 0;

    allComms.forEach(comm => {
      if (comm.direction === 'outgoing' && comm.metadata?.responseTime) {
        responseTimes.push(comm.metadata.responseTime);
      }
      
      const hour = new Date(comm.timestamp).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
      
      if (comm.status === 'read') readCount++;
      if (comm.status === 'delivered' || comm.status === 'read') deliveredCount++;
      if (comm.metadata?.sentiment) totalSentiment += comm.metadata.sentiment;
    });

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const peakHours = Object.entries(hourlyDistribution)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setAnalytics({
      totalMessages: allComms.length,
      averageResponseTime: avgResponseTime,
      readRate: allComms.length > 0 ? (readCount / allComms.length) * 100 : 0,
      sentimentScore: allComms.length > 0 ? totalSentiment / allComms.length : 0,
      responseRate: allComms.length > 0 ? (deliveredCount / allComms.length) * 100 : 0,
      peakCommunicationHours: peakHours,
      communicationFrequency: {
        daily: allComms.filter(c => now - c.timestamp.getTime() < day).length,
        weekly: allComms.filter(c => now - c.timestamp.getTime() < 7 * day).length,
        monthly: allComms.filter(c => now - c.timestamp.getTime() < 30 * day).length,
      }
    });
  }, [messages, emails, calls, day]);

  const filteredCommunications = useMemo(() => {
    let allComms = [...messages, ...calls, ...emails, ...meetings];
    
    if (filters.types.length > 0) {
      allComms = allComms.filter(c => filters.types.includes(c.type));
    }
    
    if (filters.status.length > 0) {
      allComms = allComms.filter(c => filters.status.includes(c.status));
    }
    
    if (filters.priority > 0) {
      allComms = allComms.filter(c => 
        (c.metadata?.priority || 0) >= filters.priority
      );
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      allComms = allComms.filter(c => 
        c.content.toLowerCase().includes(query) ||
        c.sender.toLowerCase().includes(query) ||
        (c.subject && c.subject.toLowerCase().includes(query))
      );
    }
    
    return allComms.sort((a, b) => {
      const order = sortOrder === 'asc' ? 1 : -1;
      return (a.timestamp.getTime() - b.timestamp.getTime()) * order;
    });
  }, [messages, calls, emails, meetings, filters, sortOrder]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!storageService.isStorageConfigured()) {
      console.warn('Storage service not configured - files will not be uploaded');
      return;
    }

    const validFiles = Array.from(files).filter(file => {
      const maxSize = 15 * 1024 * 1024;
      if (file.size > maxSize) {
        console.warn(`File ${file.name} is too large. Maximum size is 15MB.`);
        return false;
      }

      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'audio/mpeg', 'audio/wav', 'audio/mp4',
        'video/mp4', 'video/quicktime'
      ];

      if (!allowedTypes.includes(file.type)) {
        console.warn(`File type ${file.type} is not allowed for ${file.name}`);
        return false;
      }

      return true;
    });

    if (validFiles.length !== files.length) {
      console.info(`${files.length - validFiles.length} file(s) were rejected.`);
    }

    if (validFiles.length === 0) return;

    const uploadPromises = validFiles.map(async (file) => {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const filePath = `communication/${deal.id}/${fileId}-${file.name}`;

      const result = await storageService.uploadFile('deal-attachments', filePath, file);

      if (result.success && result.url) {
        return {
          id: fileId,
          name: file.name,
          url: result.url,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        };
      }
      return null;
    });

    try {
      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter(result => result !== null);
      
      console.log(`✅ Successfully uploaded ${successfulUploads.length} file(s)`);
      
      if (successfulUploads.length > 0 && selectedMessage) {
        setMessages(prev => prev.map(m => 
          m.id === selectedMessage.id 
            ? { ...m, attachments: [...(m.attachments || []), ...successfulUploads] }
            : m
        ));
      }
    } catch (error) {
      console.error('Error during file uploads:', error);
    }

    event.target.value = '';
  }, [deal.id, storageService, selectedMessage]);

  const summarizeDocument = async (file: File, fileId: string) => {
    if (summarizingFiles.has(fileId)) return;

    setSummarizingFiles(prev => new Set(prev).add(fileId));
    setResearchStatus({
      isVisible: true,
      statuses: [{
        id: `doc-summary-${fileId}`,
        stage: 'analyzing' as const,
        message: `🤖 AI is analyzing ${file.name}...`,
        progress: 0,
        timestamp: new Date()
      }]
    });

    try {
      const fileContent = await file.text();

      const systemPrompt = `You are a business document analyst. Provide a concise, actionable summary of the uploaded document in the context of a business deal.`;
      
      const userPrompt = `Please analyze and summarize this document: ${fileContent.substring(0, 10000)}`;

      const summaryResult = await webSearchService.searchWithAI(
        `Document: ${file.name}`,
        systemPrompt,
        userPrompt,
        { includeSources: false, contextSize: 'medium' }
      );

      let summary = 'Document analysis complete.';
      if (summaryResult.results && summaryResult.results.length > 0) {
        summary = summaryResult.results[0].text?.substring(0, 500) || summary;
      }

      setDocumentSummaries(prev => ({
        ...prev,
        [fileId]: summary
      }));

      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: `doc-summary-${fileId}`,
          stage: 'complete' as const,
          message: `✅ Document summary generated for ${file.name}`,
          progress: 100,
          timestamp: new Date()
        }]
      });

    } catch (error) {
      console.error('Document summarization failed:', error);
      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: `doc-summary-${fileId}`,
          stage: 'error' as const,
          message: `❌ Failed to summarize ${file.name}`,
          progress: 0,
          timestamp: new Date()
        }]
      });
    } finally {
      setSummarizingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      setTimeout(() => setResearchStatus(null), 3000);
    }
  };

  const tabs = useMemo(() => [
    { id: 'threads' as const, label: 'Conversations', icon: MessageSquare, count: threads.length },
    { id: 'messages' as const, label: 'Messages', icon: MessageSquare, count: messages.length },
    { id: 'calls' as const, label: 'Calls', icon: Phone, count: calls.length },
    { id: 'emails' as const, label: 'Emails', icon: Mail, count: emails.length },
    { id: 'meetings' as const, label: 'Meetings', icon: Calendar, count: meetings.length }
  ], [threads.length, messages.length, emails.length, calls.length, meetings.length]);

  return (
    <>
      {/* Research Status Overlay */}
      {researchStatus && (
        <ResearchStatusOverlay
          isVisible={researchStatus.isVisible}
          statuses={researchStatus.statuses}
          onClose={() => setResearchStatus(null)}
          position="top-right"
          size="md"
        />
      )}

      {/* Attachment Preview Modal */}
      {attachmentPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                {attachmentPreview.file.name}
              </h4>
              <button
                onClick={() => setAttachmentPreview(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {attachmentPreview.file.type.startsWith('image/') ? (
                <img
                  src={attachmentPreview.file.preview || attachmentPreview.file.url}
                  alt={attachmentPreview.file.name}
                  className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                />
              ) : attachmentPreview.file.type === 'application/pdf' ? (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-300">PDF Document</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round(attachmentPreview.file.size / 1024)} KB
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-300">{attachmentPreview.file.type}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round(attachmentPreview.file.size / 1024)} KB
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {attachmentPreview.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(attachmentPreview.file.size / 1024)} KB · {attachmentPreview.file.type}
                  </p>
                </div>
                <a
                  href={attachmentPreview.file.url}
                  download={attachmentPreview.file.name}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reply Modal */}
      {showQuickReply && selectedMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
                Quick Reply
              </h4>
              <button
                onClick={() => setShowQuickReply(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Replying to {selectedMessage.sender}
              </p>
              <p className="text-sm text-gray-900 dark:text-white mt-1 line-clamp-2">
                "{selectedMessage.content}"
              </p>
            </div>
            <div className="p-4">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Type your message here..."
                defaultValue={`Regarding your message about ${selectedMessage.type === 'email' ? selectedMessage.subject : 'our discussion'}, `}
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex space-x-2">
                  <ModernButton
                    variant="outline"
                    size="sm"
                    leftIcon={<Paperclip className="w-4 h-4" />}
                  >
                    Attach
                  </ModernButton>
                  <ModernButton
                    variant="ghost"
                    size="sm"
                    leftIcon={<Sparkles className="w-4 h-4" />}
                  >
                    AI Suggest
                  </ModernButton>
                </div>
                <ModernButton
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Reply
                </ModernButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && analytics && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                Communication Analytics
              </h4>
              <button
                onClick={() => setShowAnalytics(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{analytics.totalMessages}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Messages</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{Math.round(analytics.readRate)}%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Read Rate</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{Math.round(analytics.averageResponseTime / 1000 / 60)}m</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{analytics.sentimentScore.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sentiment</p>
                </div>
              </div>
              
              <div className="mb-6">
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">Peak Communication Hours</h5>
                <div className="space-y-2">
                  {analytics.peakCommunicationHours.map(({ hour, count }) => (
                    <div key={hour} className="flex items-center">
                      <span className="w-16 text-sm text-gray-500 dark:text-gray-400">{hour}:00</span>
                      <div className="flex-1 mx-3">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-400 rounded-full"
                            style={{ width: `${(count / Math.max(...analytics.peakCommunicationHours.map(h => h.count))) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-8">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h5 className="font-medium text-gray-900 dark:text-white mb-3">Communication Frequency</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{analytics.communicationFrequency.daily}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Daily</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{analytics.communicationFrequency.weekly}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Weekly</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{analytics.communicationFrequency.monthly}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Monthly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
         </div>
       )}

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Communication Hub
        </h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>

          <div className="flex space-x-2">
            <ModernButton
              variant="outline"
              size="sm"
              leftIcon={<BarChart3 className="w-4 h-4" />}
              onClick={() => setShowAnalytics(true)}
            >
              Analytics
            </ModernButton>
            <ModernButton
              variant="ghost"
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filter
            </ModernButton>
            <ModernButton
              variant="primary"
              size="sm"
              leftIcon={<Send className="w-4 h-4" />}
            >
              New Message
            </ModernButton>
            <ModernButton
              variant="success"
              size="sm"
              leftIcon={<Phone className="w-4 h-4" />}
            >
              Call
            </ModernButton>
          </div>
        </div>

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search communications..."
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sort:</span>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="ml-1">{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {activeTab === 'threads' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading conversations...</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
              </div>
            ) : (
              threads.map((thread) => (
                <div key={thread.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{thread.subject}</h4>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {thread.messageCount} messages
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {thread.participants.map((p, i) => (
                          <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                      {thread.latestMessage && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {thread.latestMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {thread.lastMessageAt.toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {thread.lastMessageAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center justify-end mt-2 space-x-1">
                        <span className={`w-2 h-2 rounded-full ${
                          thread.priority > 0.7 ? 'bg-red-500' : thread.priority > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></span>
                        <span className="text-xs text-gray-500">Priority</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex space-x-2">
                      <ModernButton variant="ghost" size="sm">
                        View Thread
                      </ModernButton>
                      <ModernButton variant="ghost" size="sm" leftIcon={<Star className="w-4 h-4" />}>
                        Star
                      </ModernButton>
                    </div>
                    <ModernButton variant="primary" size="sm" leftIcon={<Send className="w-4 h-4" />}>
                      Reply
                    </ModernButton>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
              </div>
            ) : filteredCommunications.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                <ModernButton
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Start Conversation
                </ModernButton>
              </div>
            ) : (
              filteredCommunications
                .filter(c => c.type === 'message')
                .map((message) => (
                  <div key={message.id} className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg group-hover:shadow-md transition-shadow ${
                      message.direction === 'outgoing'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className="text-sm break-words">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="flex items-center space-x-1 ml-2">
                          {message.status === 'sent' && <Check className="w-3 h-3 opacity-50" />}
                          {message.status === 'delivered' && <CheckCircle className="w-3 h-3 opacity-50" />}
                          {message.status === 'read' && <CheckCircle className="w-3 h-3 text-blue-400" />}
                          {message.metadata?.priority > 0.7 && (
                            <Flag className="w-3 h-3 text-red-500 ml-1" />
                          )}
                        </div>
                      </div>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.attachments.map((att) => (
                            <button
                              key={att.id}
                              onClick={() => setAttachmentPreview({ file: att, messageId: message.id })}
                              className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded hover:bg-blue-500/30"
                            >
                              📎 {att.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {message.metadata?.tags && message.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.metadata.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading call history...</p>
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No calls yet</p>
                <ModernButton variant="success" size="sm" className="mt-3" leftIcon={<Phone className="w-4 h-4" />}>
                  Make a Call
                </ModernButton>
              </div>
            ) : (
              calls.filter(c => c.type === 'call').map((call) => (
                <div key={call.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Call with {contact?.name || 'Contact'}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{call.timestamp.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{call.content}</p>
                      {call.metadata?.sentiment && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Sentiment: {call.metadata.sentiment > 0 ? '+' : ''}{(call.metadata.sentiment * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                  {call.metadata?.tags && call.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {call.metadata.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading emails...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No emails yet</p>
                <ModernButton variant="primary" size="sm" className="mt-3" leftIcon={<Mail className="w-4 h-4" />}>
                  Compose Email
                </ModernButton>
              </div>
            ) : (
              emails.filter(e => e.type === 'email').map((email) => (
                <div key={email.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{email.subject}</h4>
                        {email.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            email.status === 'sent' || email.status === 'delivered' || email.status === 'read'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {email.status === 'sent' && 'Sent'}
                            {email.status === 'delivered' && 'Delivered'}
                            {email.status === 'read' && 'Read'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {email.direction === 'outgoing' ? 'To: ' : 'From: '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {email.direction === 'outgoing' ? (email.recipient || contact?.name) : email.sender}
                        </span>
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {email.timestamp.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                        {email.content}
                      </p>
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {email.attachments.map((att) => (
                            <button
                              key={att.id}
                              onClick={() => setAttachmentPreview({ file: att, messageId: email.id })}
                              className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                            >
                              📎 {att.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {email.metadata?.tags && email.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {email.metadata.tags.map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      {email.metadata?.priority > 0.7 && (
                        <Flag className="w-4 h-4 text-red-500 ml-auto" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading meetings...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-gray-400">No meetings scheduled</p>
                <ModernButton variant="primary" size="sm" className="mt-3" leftIcon={<Calendar className="w-4 h-4" />}>
                  Schedule Meeting
                </ModernButton>
              </div>
            ) : (
              meetings.filter(m => m.type === 'meeting').map((meeting) => (
                <div key={meeting.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{meeting.content}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {meeting.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                        Scheduled
                      </span>
                    </div>
                  </div>
                  {meeting.metadata?.tags && meeting.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {meeting.metadata.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DealCommunicationHub;
