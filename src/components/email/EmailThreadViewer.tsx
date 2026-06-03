import React, { useState, useEffect, useCallback } from 'react';
import { EmailThreadingService, EmailThread, Email } from '../../services/emailThreadingService';
import { ModernButton } from '../ui/ModernButton';
import { Mail, Reply, Forward, Archive, MoreHorizontal, Search } from 'lucide-react';

interface EmailThreadViewerProps {
  recordType?: 'deal' | 'contact' | 'company';
  recordId?: string;
  threadId?: string;
  onThreadSelect?: (thread: EmailThread) => void;
  className?: string;
}

export const EmailThreadViewer: React.FC<EmailThreadViewerProps> = ({
  recordType,
  recordId,
  threadId,
  onThreadSelect,
  className = ''
}) => {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const filters = recordType === 'deal' && recordId ? { dealId: recordId } :
                    recordType === 'contact' && recordId ? { contactId: recordId } : {};
      
      const data = await EmailThreadingService.getEmailThreads({
        ...filters,
        limit: 50
      });
      setThreads(data);
    } catch (error) {
      console.error('Failed to load email threads:', error);
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleThreadSelect = useCallback(async (thread: EmailThread) => {
    setSelectedThread(thread);
    onThreadSelect?.(thread);
    
    try {
      const emails = await EmailThreadingService.getEmailsInThread(thread.id);
      setThreadEmails(emails);
    } catch (error) {
      console.error('Failed to load thread emails:', error);
    }
  }, [onThreadSelect]);

  useEffect(() => {
    if (threadId && !selectedThread) {
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        handleThreadSelect(thread);
      }
    }
  }, [threadId, threads, handleThreadSelect, selectedThread]);

  const filteredThreads = threads.filter(thread =>
    thread.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.participants.some(p =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex h-full bg-white rounded-lg shadow ${className}`}>
      <div className="w-1/3 border-r overflow-y-auto">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredThreads.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No email threads found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredThreads.map(thread => (
              <div
                key={thread.id}
                onClick={() => handleThreadSelect(thread)}
                className={`p-3 cursor-pointer hover:bg-gray-50 ${
                  selectedThread?.id === thread.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-medium text-gray-900 text-sm line-clamp-1">
                    {thread.subject}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  {thread.participants.slice(0, 2).map(p => p.name || p.email).join(', ')}
                  {thread.participants.length > 2 && ` +${thread.participants.length - 2}`}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {thread.messageCount} messages
                  </span>
                  {thread.priorityScore && thread.priorityScore > 0.7 && (
                    <span className="text-xs text-red-600 font-medium">High priority</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            <div className="p-4 border-b flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedThread.subject}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedThread.participants.map(p => p.name || p.email).join(', ')}
                </div>
              </div>
              <div className="flex space-x-1">
                <ModernButton variant="ghost" size="sm">
                  <Reply className="w-4 h-4" />
                </ModernButton>
                <ModernButton variant="ghost" size="sm">
                  <Forward className="w-4 h-4" />
                </ModernButton>
                <ModernButton variant="ghost" size="sm">
                  <Archive className="w-4 h-4" />
                </ModernButton>
                <ModernButton variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </ModernButton>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {threadEmails.map(email => (
                <div key={email.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-gray-900">{email.fromEmail}</div>
                      <div className="text-sm text-gray-600">
                        to: {email.toEmails.join(', ')}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(email.sentAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {email.bodyText || email.bodyHtml?.replace(/<[^>]*>/g, '')}
                  </div>

                  {email.attachments && email.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-500">
                        Attachments: {email.attachments.length}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a thread to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};