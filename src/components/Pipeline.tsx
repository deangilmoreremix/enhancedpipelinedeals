import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSmartAI } from '../hooks/useSmartAI';
import { useGamificationUpdates } from '../hooks/useGamificationUpdates';
import { ImageUpload } from './ui/ImageUpload';
import { AIEnhancedDealCard } from './AIEnhancedDealCard';
import { EnhancedAIStatusIndicator } from './ui/EnhancedAIStatusIndicator';
import DealDetail from './DealDetail';
import PipelineStats from './PipelineStats';
import DealAnalytics from './DealAnalytics';
import { useDealStore } from '../store/dealStore';
import { isDemoMode } from '../config/demoMode';

// Lazy load view components for code splitting
const DealListView = React.lazy(() => import('./DealListView').then(module => ({ default: module.DealListView })));
const DealTableView = React.lazy(() => import('./DealTableView').then(module => ({ default: module.DealTableView })));
const DealCalendarView = React.lazy(() => import('./DealCalendarView').then(module => ({ default: module.DealCalendarView })));
const DealTimelineView = React.lazy(() => import('./DealTimelineView').then(module => ({ default: module.DealTimelineView })));
const DealDashboardView = React.lazy(() => import('./DealDashboardView').then(module => ({ default: module.DealDashboardView })));
import { getSupabaseService } from '../services/supabaseService';
import { getOpenAIFunctionService } from '../services/openaiFunctionCallingService';
import { Contact } from '../types/contact';
import { Deal } from '../types';
import { Tooltip } from './ui/Tooltip';
import {
  Search, Upload, Download, Brain, Sparkles, Plus, Filter, BarChart3,
  Settings, Grid, List, Target, Zap, TrendingUp, Users, Calendar,
  Mail, Phone, CheckCircle, AlertCircle, Clock, DollarSign, Crown,
  Loader2, X, Table, BarChart, Activity, Heart
} from 'lucide-react';

// Twenty CRM enhanced kanban imports
import { StageManagerModal } from './pipeline/kanban/CustomColumnManager';
import DealToasts from './deals/DealToasts';
import { HotkeysHelp } from './pipeline/HotkeysHelp';
import { useContactStore } from '../store/contactStore';
import { stageKeysWhere } from '../utils/stageUtils';
import { BOARD_SORT_OPTIONS, BoardSortKey } from './pipeline/kanban/kanbanUtils';
import { KanbanBoard } from './pipeline/KanbanBoard';
import PipelineSummaryBar from './pipeline/PipelineSummaryBar';
import { BoardToolbar } from './pipeline/BoardToolbar';
import { BoardToolbarExport } from './pipeline/BoardToolbarExport';
import { FilterBar } from './pipeline/FilterBar';
import { NewDealDialog } from './pipeline/NewDealDialog';
import { DealImportWizard } from './import/DealImportWizard';
import DealTrashPanel from './deals/DealTrashPanel';
import MergeDealsModal from './deals/MergeDealsModal';
import { findDuplicateGroups } from '../services/dealMergeService';
import { useBoardFilters } from '../hooks/useBoardFilters';
import { BoardViewType, presetForSorting, useBoardViewStore } from '../store/boardViewStore';
import { isFeatureEnabled } from '../services/featureFlagService';
import { initialsAvatar } from '../utils/avatar';

type DealViewType = BoardViewType;

const Pipeline: React.FC = () => {
  // Modal states
  const [showClearDataModal, setShowClearDataModal] = useState(false);

  // Pipeline states
  // Single source of truth: the deal store (deals, stages, optimistic moves, realtime)
  const deals = useDealStore(s => s.deals);
  const stages = useDealStore(s => s.stages);
  const dataError = useDealStore(s => s.error);
  const isConnected = useDealStore(s => s.isConnectedToDatabase);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const fetchStages = useDealStore(s => s.fetchStages);
  const moveDeal = useDealStore(s => s.moveDeal);
  const updateDealInStore = useDealStore(s => s.updateDeal);
  const createDealInStore = useDealStore(s => s.createDeal);
  const softDeleteDeal = useDealStore(s => s.softDeleteDeal);
  const subscribeRealtime = useDealStore(s => s.subscribeRealtime);
  const dataSource: 'database' | 'mock' = isConnected && !isDemoMode() ? 'database' : 'mock';
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [booting, setBooting] = useState(true);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportSignal, setExportSignal] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [mergeIds, setMergeIds] = useState<string[] | null>(null);

  // Search / favorites / filters / sort / group-by live in the board view store (persisted, saved views apply to it)
  const searchTerm = useBoardViewStore(s => s.search);
  const setSearchTerm = useBoardViewStore(s => s.setSearch);
  const favoritesOnly = useBoardViewStore(s => s.favoritesOnly);
  const setFavoritesOnly = useBoardViewStore(s => s.setFavoritesOnly);
  const filters = useBoardViewStore(s => s.filters);
  const addFilter = useBoardViewStore(s => s.addFilter);
  const setFilters = useBoardViewStore(s => s.setFilters);
  const sorting = useBoardViewStore(s => s.sorting);
  const setSortPreset = useBoardViewStore(s => s.setSortPreset);
  const pendingAction = useBoardViewStore(s => s.pendingAction);
  const consumeAction = useBoardViewStore(s => s.consumeAction);
  // The layout lives in the board view store (persisted; saved views carry it)
  const currentView = useBoardViewStore(s => s.currentView);
  const setCurrentView = useBoardViewStore(s => s.setCurrentView);
  // ONE filtered AND sorted list (board.viewDeals) feeds every view
  const board = useBoardFilters(deals, stages);
  const contacts = useContactStore(s => s.contacts);
  const fetchContacts = useContactStore(s => s.fetchContacts);

  // AI states
  const [aiResearching, setAiResearching] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [aiResults, setAiResults] = useState<{success: number, failed: number} | null>(null);
   const [openAIFunctionCalling, setOpenAIFunctionCalling] = useState<string[]>([]);
   const [openAIResults, setOpenAIResults] = useState<{[key: string]: any}>({});

   // Twenty CRM enhanced features states
   const [twentyFeaturesEnabled, setTwentyFeaturesEnabled] = useState({
     health: false,
     stale: false,
     sla: false
   });
   const [showColumnManager, setShowColumnManager] = useState(false);

  // Smart AI hook
  const { smartScoreContact } = useSmartAI();

  // Gamification hook
  const { handleDealStageChange: updateGamification, handleDealValueChange: updateGamificationValue } = useGamificationUpdates();

  // OpenAI Function Calling service
  const openAIFunctionService = getOpenAIFunctionService();

  // Load deals + stages through the store on mount
  useEffect(() => {
    void fetchDeals().finally(() => setBooting(false));
    void fetchStages();
  }, [fetchDeals, fetchStages]);

  // Check Twenty CRM feature flags
  useEffect(() => {
    const checkFeatures = async () => {
      const [health, stale, sla] = await Promise.all([
        isFeatureEnabled('twenty_predictive_analytics'),
        isFeatureEnabled('twenty_pipeline_analytics'),
        isFeatureEnabled('twenty_sla_monitoring')
      ]);

      setTwentyFeaturesEnabled({ health, stale, sla });
    };

     checkFeatures();
   }, []);

  // Real-time subscriptions (deals + stages) via the store
  useEffect(() => subscribeRealtime(), [subscribeRealtime, isConnected]);

  // The dashboard needs real contacts
  useEffect(() => {
    if (currentView === 'dashboard' && contacts.length === 0) void fetchContacts();
  }, [currentView, contacts.length, fetchContacts]);

  // Switching view (persisted in the board view store)
  const handleViewChange = (view: DealViewType) => {
    setCurrentView(view);
  };

  // Deals after search + favorites + filters (chips and advanced groups)
  const filteredDeals = board.deals;
  const viewDeals = board.viewDeals;
  const isFiltered = board.activeFilterCount > 0;
  const sortPreset = presetForSorting(sorting);

  // Quick stage filter = a `stage equals` chip in the filter bar
  const stageFilterValue = (() => {
    const f = filters.find(x => x.field === 'stage' && x.operator === 'equals');
    return typeof f?.value === 'string' ? f.value : 'all';
  })();
  const handleStageFilter = (value: string) => {
    setFilters(filters.filter(f => !(f.field === 'stage' && f.operator === 'equals')));
    if (value !== 'all') addFilter({ field: 'stage', operator: 'equals', value });
  };

  // One-shot requests from the command palette
  useEffect(() => {
    if (!pendingAction) return;
    const action = consumeAction();
    switch (action) {
      case 'new-deal': setShowNewDeal(true); break;
      case 'import': setShowImport(true); break;
      case 'export': setExportSignal(n => n + 1); break;
      case 'show-deleted': setShowTrash(true); break;
      case 'find-duplicates': {
        const group = findDuplicateGroups(Object.values(deals))[0];
        if (group) setMergeIds(group.dealIds);
        else setExportMessage('No duplicate deals found');
        break;
      }
      default: break;
    }
  }, [pendingAction, consumeAction, deals]);

   // Calculate pipeline statistics
  const pipelineStats = useMemo(() => {
    // Computed from the filtered deals so the stats always match what the views show
    const allDeals = filteredDeals;
    const wonKeys = new Set(stageKeysWhere(stages, 'won'));
    const totalValue = allDeals.reduce((sum, deal) => sum + deal.value, 0);
    const totalDeals = allDeals.length;
    const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    const wonDeals = allDeals.filter(deal => wonKeys.has(deal.stage)).length;
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    return {
      totalValue,
      totalDeals,
      averageDealSize,
      conversionRate
    };
  }, [filteredDeals, stages]);

  const handleDealUpdate = async (id: string, updates: Partial<Deal>) => {
    try {
      const previousDeal = deals[id];
      // Optimistic update + persistence handled by the store
      await updateDealInStore(id, updates);

      // Trigger gamification updates for stage changes
      if (updates.stage && updates.stage !== previousDeal?.stage) {
        const updatedDeal = { ...previousDeal, ...updates } as Deal;
        updateGamification(updatedDeal, previousDeal?.stage);
      }

      // Trigger gamification updates for value changes
      if (updates.value && updates.value !== previousDeal?.value && previousDeal?.value) {
        const updatedDeal = { ...previousDeal, ...updates } as Deal;
        updateGamificationValue(updatedDeal, previousDeal.value);
      }
    } catch (error) {
      console.error('Failed to update deal:', error);
      throw error;
    }
  };

  const handleDealClick = async (dealId: string) => {
    const deal = deals[dealId];
    if (!deal) return;

    // Trigger OpenAI function calling for deal analysis
    await handleOpenAIFunctionCall(deal, 'card-click');

    // Open deal detail modal
    setSelectedDealId(dealId);
  };

  const handleAIResearch = async (deal: Deal): Promise<boolean> => {
    setAiResearching(prev => [...prev, deal.id]);

    try {
      // Simulate AI research
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update deal with AI insights
      await handleDealUpdate(deal.id, {
        probability: Math.min(deal.probability + 15, 95),
        notes: deal.notes ?
          `${deal.notes}\n\nAI Research: Company shows strong growth indicators and budget availability.` :
          'AI Research: Company shows strong growth indicators and budget availability.'
      });

      setAiResearching(prev => prev.filter(id => id !== deal.id));
      return true;
    } catch (error) {
      console.error('AI research failed:', error);
      setAiResearching(prev => prev.filter(id => id !== deal.id));
      return false;
    }
  };

  const handleOpenAIFunctionCall = async (deal: Deal, action: string): Promise<void> => {
    if (!openAIFunctionService.isReady()) {
      console.warn('OpenAI Function Calling service not ready');
      return;
    }

    setOpenAIFunctionCalling(prev => [...prev, deal.id]);

    try {
      const context = {
        entityType: 'deal' as const,
        action,
        componentId: 'pipeline-deal-card',
        userId: 'user-1', // This would come from auth context
        timestamp: Date.now()
      };

      const result = await openAIFunctionService.enhanceExistingInteraction(
        action,
        context,
        {
          id: deal.id,
          name: deal.title,
          company: deal.company,
          value: deal.value,
          stage: deal.stage,
          probability: deal.probability,
          contact: deal.contact,
          notes: deal.notes
        }
      );

      if (result.enhanced && result.result) {
        // Store the result for display
        setOpenAIResults(prev => ({
          ...prev,
          [deal.id]: {
            functionCalled: result.functionCalled,
            result: result.result,
            timestamp: Date.now()
          }
        }));

        // Apply insights to the deal if applicable
        if (result.functionCalled === 'comprehensive_deal_analysis' && result.result.insights) {
          const insights = result.result.insights.join('. ');
          await handleDealUpdate(deal.id, {
            notes: deal.notes ?
              `${deal.notes}\n\nAI Analysis: ${insights}` :
              `AI Analysis: ${insights}`
          });
        }
      }

      console.log('OpenAI Function Call Result:', result);
    } catch (error) {
      console.error('OpenAI Function Calling failed:', error);
    } finally {
      setOpenAIFunctionCalling(prev => prev.filter(id => id !== deal.id));
    }
  };

  const showExportMessage = (text: string) => {
    setExportMessage(text);
    window.setTimeout(() => setExportMessage(null), 4000);
  };

  const handleClearAllData = async () => {
    setShowClearDataModal(false);

    try {
      const supabase = getSupabaseService();

      await Promise.all([
        supabase.client.from('deals').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.client.from('contacts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.client.from('user_achievements').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.client.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);

      await fetchDeals();

      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };


  const handleAIScoreAll = async () => {
    // Find deals that don't have AI scores
    const dealsToAnalyze = filteredDeals.filter(deal => !deal.aiScore || deal.aiScore === 0);

    if (dealsToAnalyze.length === 0) {
      alert('All visible deals already have AI scores. Use "Re-analyze Selected" to update existing scores.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: dealsToAnalyze.length });
    setAiResults(null);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dealsToAnalyze.length; i++) {
      const deal = dealsToAnalyze[i];
      setAnalysisProgress({ current: i + 1, total: dealsToAnalyze.length });

      try {
        // Create a mock contact object from deal data for analysis
        const mockContact = {
          id: deal.id,
          name: deal.contact || deal.company,
          firstName: deal.contact ? deal.contact.split(' ')[0] : '',
          lastName: deal.contact ? deal.contact.split(' ').slice(1).join(' ') : '',
          email: `${deal.contact?.toLowerCase().replace(/\s+/g, '.') || 'contact'}@${deal.company.toLowerCase().replace(/\s+/g, '')}.com`,
          title: 'Contact',
          company: deal.company,
          industry: deal.customFields?.Industry as string || 'Business',
          status: 'prospect' as const,
          interestLevel: deal.probability >= 70 ? 'hot' as const : deal.probability >= 40 ? 'medium' as const : 'low' as const,
          sources: deal.tags || ['Deal Pipeline'],
          notes: deal.notes,
          createdAt: deal.createdAt,
          updatedAt: deal.updatedAt
        };

        const analysis = await smartScoreContact(deal.id, mockContact, 'medium');
        
        // Update deal with AI score
        await handleDealUpdate(deal.id, {
          aiScore: Math.round(analysis.score),
          notes: deal.notes ?
            `${deal.notes}\n\nAI Analysis: ${(analysis.insights || []).join('. ')}` :
            `AI Analysis: ${(analysis.insights || []).join('. ')}`
        });
        
        successCount++;
      } catch (error) {
        console.error('Analysis failed for deal:', deal.id, error);
        failedCount++;
      }

      // Small delay to prevent overwhelming the UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setAiResults({ success: successCount, failed: failedCount });
    setAnalysisProgress(null);
    setIsAnalyzing(false);
  };

  const handleDealDelete = async (dealId: string) => {
    try {
      await softDeleteDeal(dealId);
      console.log(`✅ Deal deleted: ${dealId}`);
    } catch (error) {
      console.error('Failed to delete deal:', error);
    }
  };

  const handleAddDeal = async (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createDealInStore(dealData);
      console.log('✅ Deal created successfully');
    } catch (error) {
      console.error('Failed to create deal:', error);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Pipeline</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Track and manage your deals through the sales process
          </p>
          {/* Data Source Indicator */}
          <div className="flex items-center mt-2">
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              dataSource === 'database'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                dataSource === 'database' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              {dataSource === 'database' ? 'Live Database' : 'Demo Data'}
            </div>
            {dataError && (
              <div className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <div className="w-2 h-2 rounded-full mr-2 bg-red-500" />
                {dataError}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Selection Buttons */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 space-x-1">
            <Tooltip content="Kanban Board - Visual pipeline with drag-and-drop cards organized by deal stage" position="bottom">
              <button
                onClick={() => handleViewChange('kanban')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'kanban' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Kanban</span>
              </button>
            </Tooltip>
            <Tooltip content="List View - Compact list showing key deal information in a scrollable format" position="bottom">
              <button
                onClick={() => handleViewChange('list')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'list' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <List className="w-4 h-4" />
                <span>List</span>
              </button>
            </Tooltip>
            <Tooltip content="Table View - Spreadsheet-style display with sortable columns and bulk actions" position="bottom">
              <button
                onClick={() => handleViewChange('table')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'table' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Table className="w-4 h-4" />
                <span>Table</span>
              </button>
            </Tooltip>
            <Tooltip content="Calendar View - Time-based view showing deals by due dates and follow-up schedules" position="bottom">
              <button
                onClick={() => handleViewChange('calendar')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'calendar' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Calendar</span>
              </button>
            </Tooltip>
            <Tooltip content="Dashboard View - Analytics and insights with charts, metrics, and performance trends" position="bottom">
              <button
                onClick={() => handleViewChange('dashboard')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'dashboard' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <BarChart className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            </Tooltip>
            <Tooltip content="Timeline View - Chronological activity feed showing deal progression and history" position="bottom">
              <button
                onClick={() => handleViewChange('timeline')}
                className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                  currentView === 'timeline' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Timeline</span>
              </button>
            </Tooltip>
          </div>

          {/* Pipeline Settings - Twenty Features */}
          <Tooltip content="Manage pipeline stages (add, rename, colour, reorder, probability, won/lost)" position="bottom">
            <button
              type="button"
              aria-label="Manage pipeline stages"
              onClick={() => setShowColumnManager(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip>

        </div>
      </div>

      {/* Stats Section */}
      {showStats && (
        <PipelineStats
          totalValue={pipelineStats.totalValue}
          totalDeals={pipelineStats.totalDeals}
          averageDealSize={pipelineStats.averageDealSize}
          conversionRate={pipelineStats.conversionRate}
        />
      )}

      {/* Collapsible pipeline summary (totals, weighted forecast, win rate, per-stage bar) */}
      {currentView === 'kanban' && (
        <div className="mb-4">
          <PipelineSummaryBar deals={filteredDeals} stages={stages} defaultCollapsed />
        </div>
      )}

      {/* Search and Filter Controls */}
      {currentView !== 'dashboard' && (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {/* Search */}
          <Tooltip content="Search deals by name, company, or contact - supports fuzzy matching" position="bottom">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search deals... (press /)"
                data-board-search
                aria-label="Search deals"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </Tooltip>
          
          {/* Stage Filter */}
          <Tooltip content="Filter by pipeline stage - narrow down deals by their current position in the sales process" position="bottom">
            <select
              value={stageFilterValue}
              aria-label="Filter by stage"
              onChange={(e) => handleStageFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Stages</option>
              {stages.map(st => (
                <option key={st.key} value={st.key}>{st.name}</option>
              ))}
            </select>
          </Tooltip>

          {/* Sort */}
          <Tooltip content="Sort cards within each column" position="bottom">
            <select
              value={sortPreset}
              onChange={(e) => { if (e.target.value !== 'custom') setSortPreset(e.target.value as BoardSortKey); }}
              aria-label="Sort cards"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {BOARD_SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              {sortPreset === 'custom' && <option value="custom">Custom ({sorting.length} rules)</option>}
            </select>
          </Tooltip>

          {/* Favorites filter chip */}
          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            aria-pressed={favoritesOnly}
            className={`flex items-center space-x-1 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
              favoritesOnly
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-current' : ''}`} />
            <span>Favorites only</span>
          </button>

          {/* Import */}
          <Tooltip content="Import deals from CSV, TSV, JSON or Excel" position="bottom">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800/60 transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
          </Tooltip>

          {/* Export (current view or all deals) */}
          <Tooltip content="Export the current view or all deals as CSV, Excel, or JSON" position="bottom">
            <div>
              <BoardToolbarExport
                viewDeals={filteredDeals}
                allDeals={Object.values(deals)}
                onMessage={showExportMessage}
                openSignal={exportSignal}
              />
            </div>
          </Tooltip>
          {exportMessage && (
            <span className="text-sm text-gray-600 dark:text-gray-300" role="status">{exportMessage}</span>
          )}

          <Tooltip content="Clear All Data - Delete all contacts, deals, and achievements from the database" position="bottom">
            <button
              onClick={() => setShowClearDataModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-800/60 transition-colors font-medium"
            >
              <X className="w-4 h-4" />
              <span>Clear All Data</span>
            </button>
          </Tooltip>
          
          <Tooltip content="AI Score All - Analyze all visible deals with AI to generate win probability scores based on multiple factors" position="bottom">
            <button
              onClick={handleAIScoreAll}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors font-medium shadow-sm"
            >
              <Brain className="w-4 h-4" />
              <span>AI Score All</span>
              <Sparkles className="w-3 h-3 text-yellow-300" />
            </button>
          </Tooltip>

        </div>

        <div className="flex items-center space-x-2">
          <HotkeysHelp />
          <Tooltip content="Toggle Statistics - Show or hide pipeline metrics and KPIs" position="left">
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Settings - Configure pipeline preferences, notifications, and integrations" position="left">
            <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      )}

      {/* Saved views, group-by, sort rules and filter chips */}
      {currentView !== 'dashboard' && (
        <>
          <BoardToolbar showGroupBy={currentView === 'kanban'} />
          <FilterBar stages={stages} matchCount={filteredDeals.length} totalCount={board.totalCount} />
        </>
      )}

      {/* AI Analysis Progress */}
      {(isAnalyzing || analysisProgress || aiResults) && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border-b border-purple-200 dark:border-purple-700 mb-6">
          {analysisProgress && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin duration-700" />
                <span className="font-medium text-purple-900 dark:text-purple-200">
                  Analyzing deals... ({analysisProgress.current}/{analysisProgress.total})
                </span>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                  <div 
                    className="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {aiResults && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-200">
                  Analysis complete: {aiResults.success} successful, {aiResults.failed} failed
                </span>
              </div>
              <button
                onClick={() => setAiResults(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600 dark:text-gray-400">Loading view...</p>
          </div>
        </div>
      }>
        {(() => {
          // Every view receives the same filtered AND sorted list
          const commonProps = {
            deals: viewDeals,
            onDealClick: handleDealClick,
            onDealUpdate: handleDealUpdate,
            isFiltered
          };

          switch (currentView) {
            case 'list':
              return <DealListView {...commonProps} />;

            case 'table':
              return <DealTableView {...commonProps} />;

            case 'calendar':
              return <DealCalendarView {...commonProps} />;

            case 'timeline':
              return <DealTimelineView {...commonProps} />;

            case 'dashboard':
              return <DealDashboardView deals={viewDeals} contacts={contacts} />;

            case 'kanban':
            default:
            return (
        <KanbanBoard
          deals={filteredDeals}
          stages={stages}
          sortBy={board.sortBy}
          grouping={board.grouping}
          onEditStages={() => setShowColumnManager(true)}
          isLoading={booting}
          indicators={{
            health: twentyFeaturesEnabled.health,
            stale: twentyFeaturesEnabled.stale,
            sla: twentyFeaturesEnabled.sla
          }}
          onOpenDeal={handleDealClick}
          renderCard={(deal, ctx) => (
            <AIEnhancedDealCard
              deal={deal}
              isSelected={ctx.isSelected}
              isFocused={ctx.isFocused}
              onSelect={ctx.onSelect}
              onRangeSelect={ctx.onRangeSelect}
              indicators={ctx.indicators}
              onClick={() => handleDealClick(deal.id)}
              onQuickUpdate={(updates) => handleDealUpdate(deal.id, updates)}
              onAnalyze={handleAIResearch}
              isAnalyzing={aiResearching.includes(deal.id)}
              onToggleFavorite={async (d) => {
                await handleDealUpdate(d.id, { isFavorite: !d.isFavorite });
              }}
              onFindNewImage={async (d) => {
                // Simulate finding new image
                const newSeed = Date.now().toString();
                const newAvatar = initialsAvatar(newSeed);
                await handleDealUpdate(d.id, { companyAvatar: newAvatar });
              }}
              onEdit={(d) => {
                // For now, just open the deal detail modal for editing
                setSelectedDealId(d.id);
              }}
              onDelete={handleDealDelete}
              isOpenAIFunctionCalling={openAIFunctionCalling.includes(deal.id)}
              openAIResult={openAIResults[deal.id]}
            />
          )}
        />
            );
          }
        })()}
      </Suspense>

      {/* Import wizard, new deal, deleted deals, duplicates */}
      <DealImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={(n) => showExportMessage(`Imported ${n} deal${n === 1 ? '' : 's'}`)}
      />
      <NewDealDialog isOpen={showNewDeal} onClose={() => setShowNewDeal(false)} stages={stages} onCreate={handleAddDeal} />
      <DealTrashPanel isOpen={showTrash} onClose={() => setShowTrash(false)} onRestored={() => setShowTrash(false)} />
      <MergeDealsModal
        isOpen={mergeIds !== null}
        onClose={() => setMergeIds(null)}
        deals={Object.values(deals)}
        initialIds={mergeIds ?? []}
        onMerged={() => setMergeIds(null)}
      />

      {/* Deal Detail Modal */}
      {selectedDealId && (
        <DealDetail
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
        />
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-red-100 rounded-full mr-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Clear All Data?</h3>
            </div>

            <p className="text-gray-600 mb-6">
              This will permanently delete all contacts, deals, achievements, and activities from your database. This action cannot be undone.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearDataModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage manager (add, rename, colour, reorder, hide, delete, WIP, probability, won/lost) */}
      <StageManagerModal isOpen={showColumnManager} onClose={() => setShowColumnManager(false)} />

      {/* Inline-edit errors (cells raise toasts through the record toast store) */}
      {!selectedDealId && <DealToasts />}
    </div>
  );
};

export default Pipeline;