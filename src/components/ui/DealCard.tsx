import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Deal } from '../../types';
import { getStorageBucketService } from '../../services/storageBucketService';
import {
  DollarSign,
  Edit3,
  Save,
  X,
  Trash2,
  User,
  UserPlus,
  Target,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Star,
  FileText,
  Upload,
  Brain,
  Loader2,
  Mail,
  Phone,
  UserX
} from 'lucide-react';

interface DealCardProps {
  deal: Deal;
  onUpdate?: (id: string, updates: Partial<Deal>) => void;
  onDelete?: (id: string) => void;
  onAIResearch?: (deal: Deal) => void;
  isResearching?: boolean;
  onClick?: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ 
  deal, 
  onUpdate, 
  onDelete, 
  onAIResearch,
  isResearching = false,
  onClick
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Utility functions (defined before useMemo to avoid hoisting issues)
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const isOverdue = useCallback((dateString: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  }, []);

  const getCompanyAvatar = useCallback((companyName: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=3b82f6&color=ffffff&size=40`;
  }, []);

  const getContactAvatar = useCallback((contactName: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=10b981&color=ffffff&size=32`;
  }, []);

  const getStageColor = useCallback((stage: string) => {
    const colors = {
      'lead': 'bg-gray-100 text-gray-800',
      'qualified': 'bg-blue-100 text-blue-800',
      'proposal': 'bg-yellow-100 text-yellow-800',
      'negotiation': 'bg-orange-100 text-orange-800',
      'closed-won': 'bg-green-100 text-green-800',
      'closed-lost': 'bg-red-100 text-red-800'
    };
    return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    const colors = {
      'low': 'text-green-600',
      'medium': 'text-yellow-600',
      'high': 'text-red-600'
    };
    return colors[priority as keyof typeof colors] || 'text-gray-600';
  }, []);

  const getPriorityIcon = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <Target className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  }, []);

  // Memoized computed values for performance
  const formattedValue = useMemo(() => formatCurrency(deal.value), [deal.value, formatCurrency]);
  const companyAvatar = useMemo(() => deal.companyAvatar || getCompanyAvatar(deal.company), [deal.company, deal.companyAvatar, getCompanyAvatar]);
  const contactAvatar = useMemo(() => getContactAvatar(deal.contact), [deal.contact, getContactAvatar]);
  const stageColor = useMemo(() => getStageColor(deal.stage), [deal.stage, getStageColor]);
  const priorityColor = useMemo(() => getPriorityColor(deal.priority), [deal.priority, getPriorityColor]);
  const priorityIcon = useMemo(() => getPriorityIcon(deal.priority), [deal.priority, getPriorityIcon]);
  const createdDate = useMemo(() => formatDate(deal.createdAt.toISOString()), [deal.createdAt, formatDate]);
  const isNextFollowUpOverdue = useMemo(() => deal.nextFollowUp ? isOverdue(deal.nextFollowUp) : false, [deal.nextFollowUp, isOverdue]);
  
  const [editForm, setEditForm] = useState({
    company: deal.company,
    value: deal.value,
    stage: deal.stage,
    priority: deal.priority,
    contact: deal.contact || '',
    contactId: deal.contactId || '',
    notes: deal.notes || '',
    nextFollowUp: deal.nextFollowUp || '',
    tags: deal.tags || []
  });

  const handleSave = async () => {
    if (!onUpdate) return;
    
    setIsSaving(true);
    try {
      const updates: Partial<Deal> = {
        company: editForm.company,
        value: editForm.value,
        stage: editForm.stage,
        priority: editForm.priority,
        contact: editForm.contact,
        contactId: editForm.contactId,
        notes: editForm.notes,
        nextFollowUp: editForm.nextFollowUp,
        tags: editForm.tags,
        updatedAt: new Date()
      };
      
      await onUpdate(deal.id, updates);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update deal:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      company: deal.company,
      value: deal.value,
      stage: deal.stage,
      priority: deal.priority,
      contact: deal.contact || '',
      contactId: deal.contactId || '',
      notes: deal.notes || '',
      nextFollowUp: deal.nextFollowUp || '',
      tags: deal.tags || []
    });
    setIsEditing(false);
  };

  const handleCardClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Don't trigger the click if the user is clicking on a button or input
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input')
    ) {
      return;
    }

    if (onClick) {
      onClick();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUpdate) return;

    setIsUploading(true);
    const tempId = `temp-${Date.now()}`;

    try {
      // Validate file size and type
      const storageService = getStorageBucketService();
      const bucketConfig = storageService.getBucketConfig('deal-attachments');

      if (bucketConfig && file.size > bucketConfig.fileSizeLimit) {
        alert(`File size exceeds limit of ${bucketConfig.fileSizeLimit / (1024 * 1024)}MB`);
        return;
      }

      if (bucketConfig && !bucketConfig.allowedMimeTypes.includes(file.type)) {
        alert(`File type ${file.type} is not allowed. Allowed types: ${bucketConfig.allowedMimeTypes.join(', ')}`);
        return;
      }

      // Add temporary attachment for UI feedback
      const tempAttachment = {
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      };

      const currentAttachments = deal.attachments || [];
      onUpdate(deal.id, {
        attachments: [...currentAttachments, tempAttachment],
        updatedAt: new Date()
      });

      // Upload file to storage
      const filePath = `deals/${deal.id}/${Date.now()}-${file.name}`;
      const uploadResult = await storageService.uploadFile('deal-attachments', filePath, file);

      if (uploadResult.success && uploadResult.url) {
        // Update attachment with actual URL
        const updatedAttachments = (deal.attachments || []).map(att =>
          att.id === tempId
            ? { ...att, url: uploadResult.url, uploadedAt: new Date().toISOString() }
            : att
        );

        onUpdate(deal.id, {
          attachments: updatedAttachments,
          updatedAt: new Date()
        });
      } else {
        // Remove failed attachment
        const filteredAttachments = (deal.attachments || []).filter(att => att.id !== tempId);
        onUpdate(deal.id, {
          attachments: filteredAttachments,
          updatedAt: new Date()
        });
        alert(`Upload failed: ${uploadResult.error}`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      // Remove failed attachment
      const filteredAttachments = (deal.attachments || []).filter(att => att.id !== tempId);
      onUpdate(deal.id, {
        attachments: filteredAttachments,
        updatedAt: new Date()
      });
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (attachmentId: string) => {
    if (!onUpdate) return;
    
    const updatedAttachments = (deal.attachments || []).filter(
      att => att.id !== attachmentId
    );
    
    onUpdate(deal.id, {
      attachments: updatedAttachments,
      updatedAt: new Date()
    });
  };

  const addTag = (tag: string) => {
    if (!tag.trim() || editForm.tags.includes(tag.trim())) return;
    
    setEditForm(prev => ({
      ...prev,
      tags: [...prev.tags, tag.trim()]
    }));
  };

  const removeTag = (tagToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };


  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Deal card for ${deal.title || deal.company}. Value: ${formatCurrency(deal.value)}, Stage: ${deal.stage}, Probability: ${deal.probability}%`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(e);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img
            src={companyAvatar}
            alt={deal.company}
            className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
          <div>
            {isEditing ? (
              <input
                type="text"
                value={editForm.company}
                onChange={(e) => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                className="text-lg font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:border-blue-500 focus:outline-none dark:focus:border-blue-400"
              />
            ) : (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{deal.title || deal.company}</h3>
            )}
            <div className="flex items-center space-x-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColor}`}>
                {deal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <div className={`flex items-center space-x-1 ${priorityColor} dark:text-opacity-90`}>
                {priorityIcon}
                <span className="text-xs font-medium capitalize">{deal.priority}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onAIResearch && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAIResearch(deal);
              }}
              disabled={isResearching}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700 rounded-lg hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isResearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Researching...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  <span>AI Research</span>
                </>
              )}
            </button>
          )}
          
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={isSaving}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 dark:bg-green-700 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:opacity-50 shadow-sm border border-green-500 dark:border-green-600"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(deal.id);
                  }}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 rounded-lg hover:bg-red-100 dark:hover:bg-red-800/60 border border-red-200 dark:border-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-4 h-4 text-green-600 dark:text-green-500" />
          {isEditing ? (
            <input
              type="number"
              value={editForm.value}
              onChange={(e) => setEditForm(prev => ({ ...prev, value: parseInt(e.target.value) || 0 }))}
              className="text-lg font-semibold text-green-700 dark:text-green-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-lg font-semibold text-green-700 dark:text-green-300">
              {formattedValue}
            </span>
          )}
        </div>
      </div>

      {/* Contact Person (Brief Version) */}
      {deal.contact && (
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-500" />
            <span className="text-sm text-gray-800 dark:text-gray-200">{deal.contact}</span>
          </div>
        </div>
      )}

      {/* Next Follow-up (Brief Version) */}
      {deal.nextFollowUp && (
        <div className="mb-4">
          <div className={`flex items-center space-x-2 ${isNextFollowUpOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              Due: {formatDate(deal.nextFollowUp)}
              {isNextFollowUpOverdue && ' (Overdue)'}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
        <span className="text-gray-600 dark:text-gray-400">{createdDate}</span>
        <span className="text-blue-700 dark:text-blue-300 hover:underline cursor-pointer font-medium">View Details</span>
      </div>
    </div>
  );
};