import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ContactsModal } from './contacts/ContactsModal';
import { TeamModal } from './team/TeamModal';
import { ImportDealsModal } from './modals/ImportContactsModal';
import { useSmartAI } from '../hooks/useSmartAI';
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
import { mockDeals, mockColumns, columnOrder } from '../data/mockDeals';
import { mockContacts } from '../data/mockContacts';
import { Deal, PipelineColumn } from '../types';
import { useContactStore } from '../store/contactStore';
import { DealListView } from './deals/DealListView';
import { DealTableView } from './deals/DealTableView';
import { DealCalendarView } from './deals/DealCalendarView';
import { DealTimelineView } from './deals/DealTimelineView';
import { DealDashboardView } from './deals/DealDashboardView';
import { useViewPreferences, DealViewType } from '../hooks/useViewPreferences';
import { 
  Search, Upload, Download, Brain, Sparkles, Plus, Filter, BarChart3, 
  Settings, Grid, List, Target, Zap, TrendingUp, Users, Calendar,
  Mail, Phone, CheckCircle, AlertCircle, Clock, DollarSign, Crown, Database,
  Loader2, X, Table, BarChart, Activity
} from 'lucide-react';

const Pipeline: React.FC = () => {
  // Supabase connection status
  const { isConnectedToDatabase } = useContactStore();
  
  // Modal states
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNewImportModal, setShowNewImportModal] = useState(false);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [contactsModalInitialView, setContactsModalInitialView] = useState<'external' | 'team'>('external');
  
  // Pipeline states
  const [deals, setDeals] = useState(mockDeals);
  const [columns, setColumns] = useState(mockColumns);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<DealViewType>('kanban');
  const [showStats, setShowStats] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value' | 'probability' | 'updated'>('updated');

  // AI states
  const [aiResearching, setAiResearching] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [aiResults, setAiResults] = useState<{success: number, failed: number} | null>(null);

  // Smart AI hook
  const { smartScoreContact } = useSmartAI();

  // View preferences hook
  const { preferences, isLoading: preferencesLoading, setDefaultView } = useViewPreferences();

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
    const previousDeal = deals[id];
    const previousValue = previousDeal?.value || 0;
    
    setDeals(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates, updatedAt: new Date() }
    }));
    
    // Trigger gamification updates for value changes
    if (updates.value && updates.value !== previousValue) {
      const updatedDeal = { ...previousDeal, ...updates };
      handleDealValueChange(updatedDeal, previousValue);
    }
    
    // Trigger gamification updates for stage changes
    if (updates.stage && updates.stage !== previousDeal?.stage) {
      const updatedDeal = { ...previousDeal, ...updates };
      handleDealStageChange(updatedDeal, previousDeal?.stage);
    }
  };

  const handleAIResearch = async (deal: Deal) => {
    setAiResearching(prev => [...prev, deal.id]);
    
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

  const handleImportComplete = (importedDeals: Deal[]) => {
    // Add imported deals to state
    const newDealsMap = importedDeals.reduce((acc, deal) => {
      acc[deal.id] = deal;
      return acc;
    }, {} as Record<string, Deal>);
    
    setDeals(prev => ({ ...prev, ...newDealsMap }));
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

  const handleAddDeal = (dealData: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
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
    
    setShowAddDealModal(false);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sales Pipeline</h1>
          <div className="flex items-center space-x-3 mt-1">
            <p className="text-gray-600 dark:text-gray-300">
              Track and manage your deals through the sales process
            </p>
            <div className="flex items-center space-x-2">
              <Database className={`w-4 h-4 ${isConnectedToDatabase ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                isConnectedToDatabase 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {isConnectedToDatabase ? 'Database Connected' : 'Database Disconnected'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Selection Buttons */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 space-x-1">
            <button
              onClick={() => handleViewChange('kanban')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'kanban' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Kanban Board View"
            >
              <Grid className="w-4 h-4" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => handleViewChange('list')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'list' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span>List</span>
            </button>
            <button
              onClick={() => handleViewChange('table')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'table' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
              <span>Table</span>
            </button>
            <button
              onClick={() => handleViewChange('calendar')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'calendar' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Calendar View"
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => handleViewChange('dashboard')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'dashboard' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Dashboard/Analytics View"
            >
              <BarChart className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => handleViewChange('timeline')}
              className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center space-x-2 ${
                currentView === 'timeline' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'
              }`}
              title="Timeline View"
            >
              <Activity className="w-4 h-4" />
              <span>Timeline</span>
            </button>
          </div>

          {/* Team Management */}
          <button
            onClick={() => {
              setShowTeamModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-colors font-medium shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Gamification Dashboard</span>
          </button>

          <button 
            onClick={() => setShowAddDealModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Deal</span>
          </button>
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
          
          {/* Stage Filter */}
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

          {/* Contact Management Buttons */}
          <button
            onClick={handleImportDeals}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            <span>Import Contacts</span>
          </button>
          
          <button
            onClick={handleExportDeals}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/60 transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            <span>Export Contacts</span>
          </button>
          
          <button
            onClick={handleAIScoreAll}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-colors font-medium shadow-sm"
          >
            <Brain className="w-4 h-4" />
            <span>AI Score All</span>
            <Sparkles className="w-3 h-3 text-yellow-300" />
          </button>

          {/* Contacts & Team Management */}
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
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowStats(!showStats)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Statistics"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
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
          onDealClick: (dealId: string) => setSelectedDealId(dealId),
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
            return <DealDashboardView deals={deals} contacts={mockContacts} />;
          
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
                                  onClick={() => setSelectedDealId(deal.id)}
                                  onUpdate={handleDealUpdate}
                                  onAIResearch={handleAIResearch}
                                  isResearching={aiResearching.includes(deal.id)}
                                  onToggleFavorite={async (deal) => {
                                    await handleDealUpdate(deal.id, { isFavorite: !deal.isFavorite });
                                  }}
                                  onFindNewImage={async (deal) => {
                                    // Simulate finding new image
                                    const newSeed = Date.now().toString();
                                    const newAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${newSeed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;
                                    await handleDealUpdate(deal.id, { companyAvatar: newAvatar });
                                  }}
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
        initialView="overview"
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
    </div>
  );
};

export default Pipeline;