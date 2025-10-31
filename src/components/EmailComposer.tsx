import React, { useState } from 'react';
import { Contact } from '../types/contact';
import { Deal } from '../types';
import { X, Send, Paperclip, Bold, Italic, Link, Smile } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { getStorageBucketService } from '../services/storageBucketService';

interface EmailComposerProps {
  contact: Contact;
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  onSend: (emailData: EmailData) => void;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
  attachments?: File[];
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  contact,
  deal,
  isOpen,
  onClose,
  onSend
}) => {
  const [subject, setSubject] = useState(`Regarding ${deal.title}`);
  const [body, setBody] = useState(`Dear ${contact.firstName || contact.name},

I hope this email finds you well. I'm following up regarding our discussion about ${deal.title} at ${deal.company}.

[Your message here]

Best regards,
[Your Name]
[Your Position]
[Your Contact Information]`);

  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    setIsSending(true);
    try {
      const emailData: EmailData = {
        to: contact.email,
        subject: subject.trim(),
        body: body.trim(),
        attachments: attachments.length > 0 ? attachments : undefined
      };

      await onSend(emailData);
      onClose();
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const storageService = getStorageBucketService();
    const isStorageConfigured = storageService.isStorageConfigured();

    const validFiles = Array.from(files).filter(file => {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        console.warn(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        console.warn(`File type ${file.type} is not allowed for ${file.name}`);
        return false;
      }

      return true;
    });

    if (validFiles.length !== files.length) {
      console.info(`${files.length - validFiles.length} file(s) were rejected due to size or type restrictions.`);
    }

    if (validFiles.length === 0) return;

    // If storage is configured, upload files immediately
    if (isStorageConfigured) {
      const uploadPromises = validFiles.map(async (file) => {
        const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const filePath = `email-attachments/${deal.id}/${fileId}-${file.name}`;

        const result = await storageService.uploadFile('deal-attachments', filePath, file);

        if (result.success && result.url) {
          console.log(`✅ Uploaded email attachment ${file.name} to ${result.url}`);
          return {
            ...file,
            id: fileId,
            url: result.url,
            storagePath: filePath
          };
        } else {
          console.error(`❌ Failed to upload ${file.name}:`, result.error);
          return file; // Keep original file if upload fails
        }
      });

      try {
        const uploadedFiles = await Promise.all(uploadPromises);
        setAttachments(prev => [...prev, ...uploadedFiles]);
        console.log(`✅ Successfully processed ${uploadedFiles.length} email attachment(s)`);
      } catch (error) {
        console.error('Error uploading email attachments:', error);
        // Fall back to local files if upload fails
        setAttachments(prev => [...prev, ...validFiles]);
      }
    } else {
      // Storage not configured - use local files only
      console.warn('Storage service not configured - attachments will be local only');
      setAttachments(prev => [...prev, ...validFiles]);
    }

    // Reset input value to allow re-uploading the same file
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">Compose Email</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Form */}
        <div className="flex-1 overflow-y-auto">
          {/* Recipients */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <span className="text-gray-900 dark:text-white">{contact.email}</span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">({contact.name})</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email subject"
                />
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-4">
            <div className="mb-3 flex items-center space-x-2 border-b border-gray-200 dark:border-gray-700 pb-2">
              <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded">
                <Bold className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded">
                <Italic className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded">
                <Link className="w-4 h-4" />
              </button>
              <button className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded">
                <Smile className="w-4 h-4" />
              </button>
              <div className="flex-1"></div>
              <label className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded cursor-pointer">
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  multiple
                  onChange={handleAttachment}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.pptx"
                />
              </label>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Compose your email..."
            />

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Attachments ({attachments.length}):
                </p>
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3">
                      <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                        <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {attachments.length > 5 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    ⚠️ Large number of attachments may affect deliverability
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {body.length} characters
          </div>
          <div className="flex space-x-3">
            <ModernButton
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </ModernButton>
            <ModernButton
              variant="primary"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={handleSend}
              disabled={!subject.trim() || !body.trim()}
              loading={isSending}
            >
              Send Email
            </ModernButton>
          </div>
        </div>
      </div>
    </div>
  );
};