export interface Deal {
  id: string;
  title?: string; // Optional title field for deal naming
  company: string;
  contact: string;
  contactId?: string;
  assignedToId?: string; // Links to team member's contact ID
  assignedTo?: string; // Team member's name for display
  value: number;
  stage: 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  contactAvatar?: string;
  companyAvatar?: string;
  lastActivity?: string;
  tags?: string[];
  
  // AI and enhanced features
  isFavorite?: boolean;
  customFields?: Record<string, string | number | boolean>;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
  };
  lastEnrichment?: {
    confidence: number;
    aiProvider?: string;
    timestamp?: Date;
  };
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
  }>;
  links?: Array<{
    title: string;
    url: string;
    type?: string;
    createdAt?: string;
  }>;
  nextFollowUp?: string;
  aiScore?: number;
}

export interface PipelineColumn {
  id: string;
  title: string;
  dealIds: string[];
  color: string;
}

export interface PipelineStats {
  totalValue: number;
  totalDeals: number;
  averageDealSize: number;
  conversionRate: number;
  stageValues: Record<string, number>;
}

export interface AIInsight {
  dealId: string;
  score: number;
  recommendations: string[];
  riskFactors: string[];
  nextBestActions: string[];
  probability: number;
}