import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ContactsModal } from './contacts/ContactsModal';
import { TeamModal } from './team/TeamModal';
import { ImportDealsModal } from './modals/ImportContactsModal';
import { useSmartAI } from '../hooks/useSmartAI';
import { useGamificationUpdates } from '../hooks/useGamificationUpdates';
import AddDealModal from './deals/AddDealModal';
import { DealCard } from './ui/DealCard';
import { ExportModal } from './modals/ExportModal';
import { ImportModal } from './modals/ImportModal';
import { ImageUpload } from './ui/ImageUpload';
import { AIEnhancedDealCard } from './AIEnhancedDealCard';
import { EnhancedAIStatusIndicator } from './ui/EnhancedAIStatusIndicator';
import DealDetail from './DealDetail';
import PipelineStats from './PipelineStats';
import DealAnalytics from './DealAnalytics';
import { mockColumns, columnOrder } from '../data/mockDeals';
import { getDataSyncService } from '../services/dataSyncService';
import { getSupabaseService } from '../services/supabaseService';
import { getOpenAIFunctionService } from '../services/openaiFunctionCallingService';
import { Contact } from '../types/contact';
import { Deal, PipelineColumn } from '../types';
import { DealListView } from './deals/DealListView';
import { DealTableView } from './deals/DealTableView';
import { DealCalendarView } from './deals/DealCalendarView';
import { DealTimelineView } from './deals/DealTimelineView';
import { DealDashboardView } from './deals/DealDashboardView';
import { useViewPreferences, DealViewType } from '../hooks/useViewPreferences';
import { Tooltip } from './ui/Tooltip';
import { 
  Search, Upload, Download, Brain, Sparkles, Plus, Filter, BarChart3, 
  Settings, Grid, List, Target, Zap, TrendingUp, Users, Calendar,
  Mail, Phone, CheckCircle, AlertCircle, Clock, DollarSign, Crown,
  Loader2, X, Table, BarChart, Activity
} from 'lucide-react';

const Pipeline: React.FC = () => {
  // Modal states
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNewImportModal, setShowNewImportModal] = useState(false);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [contactsModalInitialView, setContactsModalInitialView] = useState<'external' | 'team'>('external');

  // Pipeline states
  const [deals, setDeals] = useState<Record<string, Deal>>({});
  const [columns, setColumns] = useState(mockColumns);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<DealViewType>('kanban');
  const [showStats, setShowStats] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value' | 'probability' | 'updated'>('updated');
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'database' | 'mock'>('mock');
  const [dataError, setDataError] = useState<string | null>(null);

  // AI states
  const [aiResearching, setAiResearching] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [aiResults, setAiResults] = useState<{success: number, failed: number} | null>(null);
  const [openAIFunctionCalling, setOpenAIFunctionCalling] = useState<string[]>([]);
  const [openAIResults, setOpenAIResults] = useState<{[key: string]: any}>({});

  // Smart AI hook
  const { smartScoreContact } = useSmartAI();

  // Gamification hook
  const { handleDealStageChange: updateGamification, handleDealValueChange: updateGamificationValue } = useGamificationUpdates();

  // View preferences hook
  const { preferences, isLoading: preferencesLoading, setDefaultView } = useViewPreferences();

  // Data sync service
  const dataSyncService = getDataSyncService();

  // OpenAI Function Calling service
  const openAIFunctionService = getOpenAIFunctionService();

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      console.log('🔄 Pipeline: Loading data...');
      try {
        setIsLoading(true);
        setDataError(null);

        const dealsResult = await dataSyncService.getDeals();
        console.log('📊 Pipeline: Deals loaded:', dealsResult.data ? Object.keys(dealsResult.data).length : 0, 'deals');
        setDeals(dealsResult.data);
        setDataSource(dealsResult.isFromDatabase ? 'database' : 'mock');
        console.log('💾 Pipeline: Data source:', dealsResult.isFromDatabase ? 'database' : 'mock');

        if (dealsResult.error) {
          console.error('❌ Pipeline: Data loading error:', dealsResult.error);
          setDataError(dealsResult.error);
        }
      } catch (error) {
        console.error('❌ Pipeline: Failed to load data:', error);
        setDataError('Failed to load data');
        setDataSource('mock');
      } finally {
        setIsLoading(false);
        console.log('✅ Pipeline: Data loading complete');
      }
    };

    loadData();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!dataSyncService.isDatabaseConnected()) {
      console.log('🔄 Pipeline: Database not connected, skipping subscription setup');
      return;
    }

    console.log('🔄 Pipeline: Setting up real-time subscription for dataSource:', dataSource);

    const supabase = getSupabaseService();

    // Subscribe to deals changes
    const dealsSubscription = supabase.subscribeToDeals((payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      console.log('📡 Pipeline: Received real-time update:', eventType, newRecord?.id || oldRecord?.id);

      setDeals(prev => {
        switch (eventType) {
          case 'INSERT':
            console.log('📡 Pipeline: Inserting deal:', newRecord.id);
            return { ...prev, [newRecord.id]: newRecord };
          case 'UPDATE':
            console.log('📡 Pipeline: Updating deal:', newRecord.id);
            return { ...prev, [newRecord.id]: newRecord };
          case 'DELETE':
            console.log('📡 Pipeline: Deleting deal:', oldRecord.id);
            const newDeals = { ...prev };
            delete newDeals[oldRecord.id];
            return newDeals;
          default:
            console.log('📡 Pipeline: Unknown event type:', eventType);
            return prev;
        }
      });
    });

    console.log('✅ Pipeline: Real-time subscription established');

    return () => {
      console.log('🔄 Pipeline: Cleaning up real-time subscription');
      dealsSubscription.unsubscribe();
    };
  }, [dataSource]);

  // Set initial view from preferences
  useEffect(() => {
    if (!preferencesLoading && preferences.defaultView !== currentView) {
      setCurrentView(preferences.defaultView);
    }
  }, [preferences.defaultView, preferencesLoading]);

  // Save view preference when changed
  const handleViewChange = (view: DealViewType) => {
    setCurrentView(view);
    setDefaultView(view);
  };

  // Filter and search deals
  const filteredDeals = useMemo(() => {
    let result = Object.values(deals);

    // Apply search
    if (searchTerm.trim()) {
      result = result.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply stage filter
    if (filterStage !== 'all') {
      result = result.filter(deal => deal.stage === filterStage);
    }

    return result;
  }, [deals, searchTerm, filterStage]);

  // Calculate pipeline statistics
  const pipelineStats = useMemo(() => {
    const allDeals = Object.values(deals);
    const totalValue = allDeals.reduce((sum, deal) => sum + deal.value, 0);
    const totalDeals = allDeals.length;
    const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    const wonDeals = allDeals.filter(deal => deal.stage === 'closed-won').length;
    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    return {
      totalValue,
      totalDeals,
      averageDealSize,
      conversionRate
    };
  }, [deals]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];

    // Update deal stage
    const updatedDeal = {
      ...deals[draggableId],
      stage: destination.droppableId as Deal['stage'],
      updatedAt: new Date()
    };

    // Update deals
    setDeals(prev => ({
      ...prev,
      [draggableId]: updatedDeal
    }));

    // Update columns
    if (source.droppableId === destination.droppableId) {
      // Reordering within same column
      const newDealIds = Array.from(sourceColumn.dealIds);
      newDealIds.splice(source.index, 1);
      newDealIds.splice(destination.index, 0, draggableId);

      setColumns(prev => ({
        ...prev,
        [source.droppableId]: {
          ...sourceColumn,
          dealIds: newDealIds
        }
      }));
    } else {
      // Moving between columns
      const sourceDealIds = Array.from(sourceColumn.dealIds);
      const destDealIds = Array.from(destColumn.dealIds);

      sourceDealIds.splice(source.index, 1);
      destDealIds.splice(destination.index, 0, draggableId);

      setColumns(prev => ({
        ...prev,
        [source.droppableId]: {
          ...sourceColumn,
          dealIds: sourceDealIds
        },
        [destination.droppableId]: {
          ...destColumn,
          dealIds: destDealIds
        }
      }));
    }
  };

  const handleDealUpdate = async (id: string, updates: Partial<Deal>) => {
    try {
      // If database is connected, update via data sync service
      if (dataSyncService.isDatabaseConnected()) {
        await dataSyncService.updateDeal(id, updates);
      }

      // Update local state
      setDeals(prev => ({
        ...prev,
        [id]: { ...prev[id], ...updates, updatedAt: new Date() }
      }));

      // Trigger gamification updates for value changes
      const previousDeal = deals[id];
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stageId: string) => {
    const colors: Record<string, string> = {
      'qualification': 'border-blue-500 bg-blue-50',
      'proposal': 'border-indigo-500 bg-indigo-50',
      'negotiation': 'border-purple-500 bg-purple-50',
      'closed-won': 'border-green-500 bg-green-50',
      'closed-lost': 'border-red-500 bg-red-50'
    };
    return colors[stageId] || 'border-gray-500 bg-gray-50';
  };

  const handleImportDeals = () => {
    setShowNewImportModal(true);
  };

  const handleExportDeals = () => {
    setShowExportModal(true);
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

      setDeals({});
      await loadDeals();

      console.log('✅ All data cleared successfully');
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  };

  const handleImportComplete = (data: Deal[] | Contact[]) => {
    // Handle imported deals
    if (data.length > 0 && 'value' in data[0]) {
      const importedDeals = data as Deal[];
      const newDealsMap = importedDeals.reduce((acc, deal) => {
        acc[deal.id] = deal;
        return acc;
      }, {} as Record<string, Deal>);

      setDeals(prev => ({ ...prev, ...newDealsMap }));
    }
    // Note: Contact import would be handled by the ContactsModal component
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
      if (dataSyncService.isDatabaseConnected()) {
        await dataSyncService.deleteDeal(dealId);
      }

      const { [dealId]: removed, ...remainingDeals } = deals;
      setDeals(remainingDeals);

      console.log(`✅ Deal deleted: ${dealId}`);
    } catch (error) {
      console.error('Failed to delete deal:', error);
    }
  };

  const handleAddDeal = async (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (dataSyncService.isDatabaseConnected()) {
        // Create deal in database
        const newDeal = await dataSyncService.createDeal(dealData);

        // Add deal to state
        setDeals(prev => ({
          ...prev,
          [newDeal.id]: newDeal
        }));

        // Add deal to appropriate column
        setColumns(prev => ({
          ...prev,
          [newDeal.stage]: {
            ...prev[newDeal.stage],
            dealIds: [...prev[newDeal.stage].dealIds, newDeal.id]
          }
        }));
      } else {
        // Fallback to local state only (mock mode)
        const newDeal: Deal = {
          ...dealData,
          id: `deal-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        setDeals(prev => ({
          ...prev,
          [newDeal.id]: newDeal
        }));

        setColumns(prev => ({
          ...prev,
          [newDeal.stage]: {
            ...prev[newDeal.stage],
            dealIds: [...prev[newDeal.stage].dealIds, newDeal.id]
          }
        }));
      }

      setShowAddDealModal(false);
    } catch (error) {
      console.error('Failed to create deal:', error);
      // Still close modal but show error
      setShowAddDealModal(false);
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

          {/* Team Management */}
          <Tooltip content="Gamification Dashboard - View leaderboard, achievements, and team performance metrics" position="bottom">
            <button
              onClick={() => {
                setShowTeamModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-colors font-medium shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Gamification Dashboard</span>
            </button>
          </Tooltip>

          <Tooltip content="Create New Deal - Add a new deal to your pipeline with AI-powered insights" position="bottom">
            <button
              onClick={() => setShowAddDealModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Deal</span>
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
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </Tooltip>
          
          {/* Stage Filter */}
          <Tooltip content="Filter by pipeline stage - narrow down deals by their current position in the sales process" position="bottom">
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Stages</option>
              <option value="qualification">Qualification</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed-won">Closed Won</option>
              <option value="closed-lost">Closed Lost</option>
            </select>
          </Tooltip>

          {/* Contact Management Buttons */}
          <Tooltip content="Import Contacts - Upload contacts from CSV, Excel, or other CRM systems" position="bottom">
            <button
              onClick={handleImportDeals}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Import Contacts</span>
            </button>
          </Tooltip>
          
          <Tooltip content="Export Contacts - Download your contacts as CSV, Excel, or JSON for backup or analysis" position="bottom">
            <button
              onClick={handleExportDeals}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/60 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Export Contacts</span>
            </button>
          </Tooltip>

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

          {/* Contacts & Team Management */}
          <Tooltip content="Manage Contacts - View, edit, and organize all your contacts with AI enrichment" position="bottom">
            <button
              onClick={() => {
                setContactsModalInitialView('external');
                setShowContactsModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/60 transition-colors font-medium"
            >
              <Target className="w-4 h-4" />
              <span>Manage Contacts</span>
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center space-x-2">
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

      {/* AI Analysis Progress */}
      {(isAnalyzing || analysisProgress || aiResults) && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200 mb-6">
          {analysisProgress && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin duration-700" />
                <span className="font-medium text-purple-900">
                  Analyzing deals... ({analysisProgress.current}/{analysisProgress.total})
                </span>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          {aiResults && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Analysis complete: {aiResults.success} successful, {aiResults.failed} failed
                </span>
              </div>
              <button
                onClick={() => setAiResults(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {(() => {
        const commonProps = {
          deals,
          onDealClick: handleDealClick,
          onDealUpdate: handleDealUpdate,
          searchTerm,
          filterStage
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
            return <DealDashboardView deals={deals} contacts={[]} />;
          
          case 'kanban':
          default:
            return (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[600px]">
            {columnOrder.map((columnId) => {
              const column = columns[columnId];
              const columnDeals = column.dealIds
                .map(dealId => deals[dealId])
                .filter(Boolean)
                .filter(deal => filteredDeals.some(fd => fd.id === deal.id));
              
              const columnValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);

              return (
                <div key={column.id} className={`bg-white dark:bg-gray-800 rounded-xl border-2 ${getStageColor(column.id)} shadow-sm`}>
                  {/* Column Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{column.title}</h3>
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md text-xs font-medium">
                        {columnDeals.length}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(columnValue)}
                    </div>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-4 min-h-[500px] space-y-3 ${
                          snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        {columnDeals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`${
                                  snapshot.isDragging ? 'rotate-2 shadow-xl' : ''
                                }`}
                              >
                                <AIEnhancedDealCard
                                   deal={deal}
                                   onClick={() => handleDealClick(deal.id)}
                                   onAnalyze={handleAIResearch}
                                   isAnalyzing={aiResearching.includes(deal.id)}
                                   onToggleFavorite={async (deal) => {
                                     await handleDealUpdate(deal.id, { isFavorite: !deal.isFavorite });
                                   }}
                                   onFindNewImage={async (deal) => {
                                     // Simulate finding new image
                                     const newSeed = Date.now().toString();
                                     const newAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${newSeed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;
                                     await handleDealUpdate(deal.id, { companyAvatar: newAvatar });
                                   }}
                                   onEdit={(deal) => {
                                     // For now, just open the deal detail modal for editing
                                     setSelectedDealId(deal.id);
                                   }}
                                   onDelete={handleDealDelete}
                                   isOpenAIFunctionCalling={openAIFunctionCalling.includes(deal.id)}
                                   openAIResult={openAIResults[deal.id]}
                                 />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {/* Add Deal Button */}
                        <button className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Deal
                        </button>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
            );
        }
      })()}

      {/* Deal Detail Modal */}
      {selectedDealId && (
        <DealDetail
          dealId={selectedDealId}
          onClose={() => setSelectedDealId(null)}
        />
      )}

      {/* Contact Modals */}
      <ContactsModal 
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
      />
      
      {/* Team/Gamification Modal */}
      <TeamModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
      />
      
      <ImportDealsModal 
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      
      {/* Add Deal Modal */}
      <AddDealModal 
        isOpen={showAddDealModal}
        onClose={() => setShowAddDealModal(false)}
        onSave={handleAddDeal}
      />
      
      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={Object.values(deals)}
        dataType="deals"
      />
      
      {/* Import Modal */}
      <ImportModal
        isOpen={showNewImportModal}
        onClose={() => setShowNewImportModal(false)}
        dataType="deals"
        onImportComplete={handleImportComplete}
      />

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
    </div>
  );
};

export default Pipeline;