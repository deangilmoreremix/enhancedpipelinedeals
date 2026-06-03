import React, { useState, useEffect, useCallback } from 'react';
import { EmailThreadingService, EmailThread, Email } from '../../services/emailThreadingService';
import { CalendarEventService } from '../../services/calendarEventService';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Mail, Calendar, Users, Clock, Link as LinkIcon, ExternalLink } from 'lucide-react';

interface EmailIntegrationPanelProps {
  recordType: 'deal' | 'contact';
  recordId: string;
  className?: string;
}

export const EmailIntegrationPanel: React.FC<EmailIntegrationPanelProps> = ({
  recordType,
  recordId,
  className = ''
}) => {
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Feature flags
  const emailThreadingEnabled = useFeatureFlag('email_threading_auto_linking');

  // Load email threads for the record
  const loadEmailThreads = useCallback(async () => {
    if (!emailThreadingEnabled) return;

    setLoading(true);
    try {
      const threads = await EmailThreadingService.getEmailThreads({
        [recordType === 'deal' ? 'dealId' : 'contactId']: recordId,
        limit: 50
      });
      setEmailThreads(threads);
    } catch (error) {
      console.error('Failed to load email threads:', error);
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId, emailThreadingEnabled]);

  // Load emails in a thread
  const loadThreadEmails = useCallback(async (threadId: string) => {
    try {
      const emails = await EmailThreadingService.getEmailsInThread(threadId);
      setThreadEmails(emails);
    } catch (error) {
      console.error('Failed to load thread emails:', error);
    }
  }, []);

  useEffect(() => {
    loadEmailThreads();
  }, [loadEmailThreads]);

  useEffect(() => {
    if (selectedThread) {
      loadThreadEmails(selectedThread.id);
    }
  }, [selectedThread, loadThreadEmails]);

  // Filter threads based on search
  const filteredThreads = emailThreads.filter(thread =>
    thread.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.participants.some(p =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (!emailThreadingEnabled) {
    return (
      <div className={`flex items-center justify-center h-32 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <Mail className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Email integration coming soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Email Communication</h2>
          <Badge variant="secondary">{emailThreads.length}</Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search emails..."
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
            className="w-48"
          />
        </div>
      </div>

      <div className="flex h-96">
        {/* Email Threads List */}
        <div className="w-1/3 border-r overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Mail className="mx-auto h-8 w-8 mb-2" />
                <p>No emails found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 ${
                    selectedThread?.id === thread.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedThread(thread)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {thread.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {thread.participants.slice(0, 2).map(p => p.name || p.email).join(', ')}
                        {thread.participants.length > 2 && ` +${thread.participants.length - 2} more`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end ml-2">
                      <span className="text-xs text-gray-500">
                        {thread.lastMessageAt.toLocaleDateString()}
                      </span>
                      <Badge
                        variant={thread.priorityScore && thread.priorityScore > 0.7 ? 'destructive' : 'secondary'}
                        className="text-xs mt-1"
                      >
                        {thread.messageCount}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Thread Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedThread ? (
            <div className="p-4">
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-medium text-gray-900">{selectedThread.subject}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{selectedThread.participants.length} participants</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Mail className="h-4 w-4" />
                    <span>{selectedThread.messageCount} messages</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Last: {selectedThread.lastMessageAt.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {threadEmails.map((email) => (
                  <Card key={email.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {email.fromEmail}
                          </span>
                          <span className="text-sm text-gray-500">to</span>
                          <span className="text-sm text-gray-700">
                            {email.toEmails.join(', ')}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          {email.bodyText || email.bodyHtml?.replace(/<[^>]*>/g, '').slice(0, 200)}
                          {(email.bodyText || email.bodyHtml)?.length > 200 && '...'}
                        </div>
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="mt-2 flex items-center space-x-1 text-xs text-gray-500">
                            <LinkIcon className="h-3 w-3" />
                            <span>{email.attachments.length} attachment(s)</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end ml-4">
                        <span className="text-xs text-gray-500">
                          {email.sentAt.toLocaleString()}
                        </span>
                        {email.aiSummary && (
                          <Badge variant="outline" className="text-xs mt-1">
                            AI Summary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Mail className="mx-auto h-12 w-12 mb-4" />
                <p>Select an email thread to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};</content>
<parameter name="filePath">/workspaces/enhancedpipelinedeals/src/components/email/EmailIntegrationPanel.tsx