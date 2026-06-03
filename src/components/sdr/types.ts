import React from 'react';

export interface SDRAgentMeta {
  id: string;
  label: string;
  short: string;
  category: string;
  tags?: string[];
  usageCount?: number;
  lastUsed?: Date;
  favorite?: boolean;
  agent?: any;
}

export interface SDRRunResponse {
  agentId: string;
  contactId: string;
  dealId: string | null;
  result: Record<string, unknown>;
  timestamp?: Date;
  agentLabel?: string;
  success?: boolean;
  responseTime?: number; // in milliseconds
}

export interface SDRFilterOptions {
  category?: string;
  search?: string;
  favorites?: boolean;
  sortBy?: 'name' | 'usage' | 'recency';
}

export interface SDRBatchOperation {
  agentIds: string[];
  contactId: string;
  dealId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: SDRRunResponse[];
  progress?: number;
}

export interface SDRAgentAnalytics {
  agentId: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageResponseTime: number;
  lastUsed: Date | null;
  categories: string[];
  successRate: number;
  favorite: boolean;
}

export type SDRAgentMetadata = {
  id: string;
  label: string;
  short: string;
  category: string;
  tags?: string[];
  usageCount?: number;
  lastUsed?: Date;
  favorite?: boolean;
  agent?: any;
};