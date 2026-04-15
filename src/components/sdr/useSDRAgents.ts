import { useState, useEffect } from 'react';
import { sdrPreferencesService } from '../../services/sdrPreferencesService';

// Interfaces moved to types.ts
export type { SDRAgentMetadata, SDRAgentAnalytics } from './types';
export type { SDRRunResponse } from './types';
export type { SDRFilterOptions } from './types';
export type { SDRBatchOperation } from './types';

export const useSDRAgents = () => {
  const [agents, setAgents] = useState<SDRAgentMetadata[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(SDR_AGENTS[0]?.id ?? '');
  const [contactId, setContactId] = useState('');
  const [dealId, setDealId] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SDRRunResponse | null>(null);
  const [resultHistory, setResultHistory] = useState<SDRRunResponse[]>([]);
  const [filters, setFilters] = useState<SDRFilterOptions>({});
  const [batchOperations, setBatchOperations] = useState<SDRBatchOperation[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, SDRAgentAnalytics>>({});

  // Load user preferences and usage data on mount
  useEffect(() => {
    loadAgentData();
  }, []);

  const loadAgentData = async () => {
    try {
      // Load favorites and usage stats for all agents
      const updatedAgents = await Promise.all(
        SDR_AGENTS.map(async (agent) => {
          const prefs = await sdrPreferencesService.getUserPreferences('user-1', agent.id);
          return {
            ...agent,
            favorite: prefs?.favorite || false,
            usageCount: prefs?.usageCount || 0,
            lastUsed: prefs?.lastUsed ? new Date(prefs.lastUsed) : undefined,
            agent: agent.agent
          };
        })
      );
      setAgents(updatedAgents);
    } catch (error) {
      console.error('Failed to load agent data:', error);
    }
  };

  const runAgent = async (agentId: string, contactId: string, dealId?: string) => {
    setError(null);
    setRunning(true);
    const startTime = Date.now();

    try {
      const res = await fetch("/.netlify/functions/sdr-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          contactId,
          dealId: dealId || undefined
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json() as SDRRunResponse;
      const responseTime = Date.now() - startTime;
      const resultWithTimestamp = {
        ...data,
        timestamp: new Date(),
        success: true,
        responseTime
      };

      setResponse(resultWithTimestamp);
      setResultHistory(prev => [resultWithTimestamp, ...prev.slice(0, 49)]); // Keep last 50 results

      // Update usage stats and analytics
      await updateAgentUsage(agentId, true, responseTime);

      return resultWithTimestamp;
    } catch (e: any) {
      const responseTime = Date.now() - startTime;
      console.error("SDR run error:", e);
      const errorMessage = e.message || "Failed to run SDR agent";
      setError(errorMessage);

      // Track failed run
      await updateAgentUsage(agentId, false, responseTime);

      throw new Error(errorMessage);
    } finally {
      setRunning(false);
    }
  };

  const updateAgentUsage = async (agentId: string, success: boolean = true, responseTime: number = 0) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const updatedAgent = {
      ...agent,
      usageCount: (agent.usageCount || 0) + 1,
      lastUsed: new Date()
    };

    setAgents(prev => prev.map(a => a.id === agentId ? updatedAgent : a));

    // Update analytics
    setAnalytics(prev => {
      const current = prev[agentId] || {
        agentId,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageResponseTime: 0,
        lastUsed: null,
        categories: [agent.category],
        successRate: 0,
        favorite: agent.favorite || false
      };

      const newTotalRuns = current.totalRuns + 1;
      const newSuccessfulRuns = current.successfulRuns + (success ? 1 : 0);
      const newFailedRuns = current.failedRuns + (success ? 0 : 1);
      const newAverageResponseTime = ((current.averageResponseTime * current.totalRuns) + responseTime) / newTotalRuns;
      const newSuccessRate = (newSuccessfulRuns / newTotalRuns) * 100;

      return {
        ...prev,
        [agentId]: {
          ...current,
          totalRuns: newTotalRuns,
          successfulRuns: newSuccessfulRuns,
          failedRuns: newFailedRuns,
          averageResponseTime: newAverageResponseTime,
          lastUsed: new Date(),
          successRate: newSuccessRate
        }
      };
    });

    try {
      const prefs = await sdrPreferencesService.getUserPreferences('user-1', agentId) || {};
      await sdrPreferencesService.saveUserPreferences('user-1', agentId, {
        ...prefs,
        favorite: updatedAgent.favorite,
        usageCount: updatedAgent.usageCount,
        lastUsed: updatedAgent.lastUsed.toISOString()
      });
    } catch (error) {
      console.error('Failed to save usage stats:', error);
    }
  };

  const toggleFavorite = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const newFavorite = !agent.favorite;
    const updatedAgent = { ...agent, favorite: newFavorite };

    setAgents(prev => prev.map(a => a.id === agentId ? updatedAgent : a));

    try {
      const prefs = await sdrPreferencesService.getUserPreferences('user-1', agentId) || {};
      await sdrPreferencesService.saveUserPreferences('user-1', agentId, {
        ...prefs,
        favorite: newFavorite
      });
    } catch (error) {
      console.error('Failed to save favorite:', error);
      // Revert on error
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, favorite: !newFavorite } : a));
    }
  };

  const runBatchOperation = async (agentIds: string[], contactId: string, dealId?: string) => {
    const batchOp: SDRBatchOperation = {
      agentIds,
      contactId,
      dealId,
      status: 'running',
      results: [],
      progress: 0
    };

    setBatchOperations(prev => [...prev, batchOp]);

    try {
      const results: SDRRunResponse[] = [];
      for (let i = 0; i < agentIds.length; i++) {
        const agentId = agentIds[i];
        const result = await runAgent(agentId, contactId, dealId);
        results.push(result);

        // Update progress
        setBatchOperations(prev =>
          prev.map(op =>
            op === batchOp ? { ...op, results: [...results], progress: ((i + 1) / agentIds.length) * 100 } : op
          )
        );
      }

      setBatchOperations(prev =>
        prev.map(op =>
          op === batchOp ? { ...op, status: 'completed', results, progress: 100 } : op
        )
      );

      return results;
    } catch (error) {
      setBatchOperations(prev =>
        prev.map(op =>
          op === batchOp ? { ...op, status: 'failed' } : op
        )
      );
      throw error;
    }
  };

  const getFilteredAgents = (): SDRAgentMetadata[] => {
    let filtered = [...agents];

    if (filters.category) {
      filtered = filtered.filter(agent => agent.category === filters.category);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.label.toLowerCase().includes(searchLower) ||
        agent.short.toLowerCase().includes(searchLower) ||
        agent.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    if (filters.favorites) {
      filtered = filtered.filter(agent => agent.favorite);
    }

    const sortBy = filters.sortBy || 'name';
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'recency': {
          const aTime = a.lastUsed?.getTime() || 0;
          const bTime = b.lastUsed?.getTime() || 0;
          return bTime - aTime;
        }
        case 'name':
        default:
          return a.label.localeCompare(b.label);
      }
    });

    // Ensure each agent has agent object reference
    return filtered.map(agent => ({
      ...agent,
      agent: SDR_AGENTS.find(a => a.id === agent.id)?.agent
    }));
  };

  const clearResults = () => {
    setResponse(null);
    setError(null);
  };

  const clearHistory = () => {
    setResultHistory([]);
  };

  const getAnalytics = () => {
    const analyticsArray = Object.values(analytics);
    const totalRuns = analyticsArray.reduce((sum, a) => sum + a.totalRuns, 0);
    const totalSuccessful = analyticsArray.reduce((sum, a) => sum + a.successfulRuns, 0);
    const totalFailed = analyticsArray.reduce((sum, a) => sum + a.failedRuns, 0);
    const overallSuccessRate = totalRuns > 0 ? (totalSuccessful / totalRuns) * 100 : 0;
    const averageResponseTime = analyticsArray.length > 0
      ? analyticsArray.reduce((sum, a) => sum + a.averageResponseTime, 0) / analyticsArray.length
      : 0;

    return {
      totalRuns,
      totalSuccessful,
      totalFailed,
      overallSuccessRate,
      averageResponseTime,
      agentAnalytics: analyticsArray.sort((a, b) => b.totalRuns - a.totalRuns)
    };
  };

  const getTopAgents = (limit: number = 5) => {
    return Object.values(analytics)
      .sort((a, b) => b.totalRuns - a.totalRuns)
      .slice(0, limit);
  };

  const getAgentsBySuccessRate = () => {
    return Object.values(analytics)
      .filter(a => a.totalRuns > 0)
      .sort((a, b) => b.successRate - a.successRate);
  };

  return {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    contactId,
    setContactId,
    dealId,
    setDealId,
    running,
    error,
    response,
    resultHistory,
    filters,
    setFilters,
    batchOperations,
    runAgent,
    runBatchOperation,
    toggleFavorite,
    getFilteredAgents,
    clearResults,
    clearHistory,
    loadUserPreferences: loadAgentData,
    analytics,
    getAnalytics,
    getTopAgents,
    getAgentsBySuccessRate
  };
};