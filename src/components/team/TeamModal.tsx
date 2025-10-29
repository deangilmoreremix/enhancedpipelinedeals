import React, { useState, useMemo, useEffect } from 'react';
import { TeamMemberCard } from './TeamMemberCard';
import { AchievementPanel } from '../gamification/AchievementPanel';
import { useContactStore } from '../../store/contactStore';
import { useGamification } from '../../contexts/GamificationContext';
import { useOpenAI } from '../../services/openaiService';
import { useSmartAI } from '../../hooks/useSmartAI';
import { Contact } from '../../types/contact';
import AddContactModal from '../deals/AddContactModal';
import Fuse from 'fuse.js';
import { 
  X, Search, Filter, Plus, Users, ChevronDown, Brain, Download, Upload, Zap, CheckCheck,
  Grid, List, Settings, UserPlus, Crown, Star, Loader2, Sparkles, RefreshCw, Trophy,
  Award, Target, TrendingUp, BarChart3, Calendar, DollarSign, ArrowRight,
  ArrowUp, ArrowDown, Flame, Zap as ZapIcon, Activity, Clock, User, CheckCircle
} from 'lucide-react';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const { contacts, isLoading, updateContact, fetchContacts } = useContactStore();
  const { teamMembers, addTeamMember, removeTeamMember, leaderboard, challenges, achievements } = useGamification();
  const openai = useOpenAI();
  const { smartScoreContact } = useSmartAI();
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [analyzingMemberIds, setAnalyzingMemberIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'members' | 'leaderboard' | 'achievements' | 'challenges'>('members');
  const [sortBy, setSortBy] = useState<'name' | 'points' | 'level' | 'winRate' | 'revenue'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  
  // Team Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [aiResults, setAiResults] = useState<{success: number, failed: number} | null>(null);

  // Load contacts on mount
  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen, fetchContacts]);

  // Initialize Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(teamMembers, {
      keys: ['name', 'company', 'title', 'email'],
      threshold: 0.3,
    });
  }, [teamMembers]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.keyCode === 27) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc, false);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc, false);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Filter and search team members
  const filteredMembers = useMemo(() => {
    let result = teamMembers;

    // Apply search
    if (searchTerm.trim()) {
      const searchResults = fuse.search(searchTerm);
      result = searchResults.map(result => result.item);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'points':
          aValue = a.gamificationStats?.points || 0;
          bValue = b.gamificationStats?.points || 0;
          break;
        case 'level':
          aValue = a.gamificationStats?.level || 0;
          bValue = b.gamificationStats?.level || 0;
          break;
        case 'winRate':
          aValue = a.gamificationStats?.winRate || 0;
          bValue = b.gamificationStats?.winRate || 0;
          break;
        case 'revenue':
          aValue = a.gamificationStats?.totalRevenue || 0;
          bValue = b.gamificationStats?.totalRevenue || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [teamMembers, searchTerm, sortBy, sortOrder, fuse]);

  // Team member management
  const handleMemberSelect = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === filteredMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(filteredMembers.map(m => m.id));
    }
  };

  const handleRemoveFromTeam = async (memberId: string) => {
    await removeTeamMember(memberId);
  };

  const handleAddToTeam = async (contactId: string) => {
    await addTeamMember(contactId);
  };

  // AI Analysis Functions
  const handleAnalyzeMember = async (member: Contact) => {
    setAnalyzingMemberIds(prev => [...prev, member.id]);
    try {
      const analysis = await smartScoreContact(member.id, member, 'medium');
      await updateContact(member.id, {
        aiScore: Math.round(analysis.results.contact_scoring.score),
        notes: member.notes ?
          `${member.notes}\n\nTeam Analysis: ${analysis.results.contact_scoring.insights.join('. ')}` :
          `Team Analysis: ${analysis.results.contact_scoring.insights.join('. ')}`
      });
      return true;
    } catch (error) {
      console.error('Analysis failed:', error);
      return false;
    } finally {
      setAnalyzingMemberIds(prev => prev.filter(id => id !== member.id));
    }
  };

  const handleAnalyzeAllMembers = async () => {
    if (teamMembers.length === 0) {
      alert('No team members to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: teamMembers.length });
    setAiResults(null);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < teamMembers.length; i++) {
      const member = teamMembers[i];
      setAnalysisProgress({ current: i + 1, total: teamMembers.length });

      const success = await handleAnalyzeMember(member);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }

      // Small delay to prevent overwhelming the UI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setAiResults({ success: successCount, failed: failedCount });
    setAnalysisProgress(null);
    setIsAnalyzing(false);
  };

  // Calculate team stats
  const teamStats = useMemo(() => {
    const totalRevenue = teamMembers.reduce((sum, member) => 
      sum + (member.gamificationStats?.totalRevenue || 0), 0);
    const totalDeals = teamMembers.reduce((sum, member) => 
      sum + (member.gamificationStats?.totalDeals || 0), 0);
    const avgWinRate = teamMembers.length > 0 
      ? teamMembers.reduce((sum, member) => sum + (member.gamificationStats?.winRate || 0), 0) / teamMembers.length
      : 0;
    const totalPoints = teamMembers.reduce((sum, member) => 
      sum + (member.gamificationStats?.points || 0), 0);

    return {
      totalRevenue,
      totalDeals,
      avgWinRate,
      totalPoints,
      teamSize: teamMembers.length
    };
  }, [teamMembers]);

  const handleContactCreated = (contact: Contact) => {
    // Auto-add to team and close modal
    handleAddToTeam(contact.id);
    setShowAddMemberModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col animate-slide-in shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  Team Management Dashboard
                </h2>
                <p className="text-gray-600">
                  {teamStats.teamSize} team members • ${teamStats.totalRevenue.toLocaleString()} total revenue • {teamStats.totalDeals} deals closed
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* AI Analysis Button */}
              <button
                onClick={handleAnalyzeAllMembers}
                disabled={isAnalyzing || teamMembers.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border border-purple-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                <span>
                  {isAnalyzing ? 'Analyzing...' : `AI Analyze Team (${teamMembers.length})`}
                </span>
                <Sparkles className="w-3 h-3 text-yellow-300" />
              </button>

              <button 
                onClick={() => setShowAddMemberModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Team Stats Bar */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{teamStats.teamSize}</div>
                <div className="text-sm opacity-90">Team Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">${(teamStats.totalRevenue / 1000).toFixed(0)}K</div>
                <div className="text-sm opacity-90">Total Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{teamStats.totalDeals}</div>
                <div className="text-sm opacity-90">Deals Closed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{teamStats.avgWinRate.toFixed(0)}%</div>
                <div className="text-sm opacity-90">Avg Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{teamStats.totalPoints.toLocaleString()}</div>
                <div className="text-sm opacity-90">Total Points</div>
              </div>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {[
              { id: 'members', label: 'Team Members', icon: Users },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'achievements', label: 'Achievements', icon: Award },
              { id: 'challenges', label: 'Challenges', icon: Target }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium transition-colors ${
                    activeView === tab.id 
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* AI Analysis Progress */}
          {(isAnalyzing || analysisProgress || aiResults) && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200">
              {analysisProgress && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin duration-700" />
                    <span className="font-medium text-purple-900">
                      Analyzing team members... ({analysisProgress.current}/{analysisProgress.total})
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
                      Team analysis complete: {aiResults.success} successful, {aiResults.failed} failed
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeView === 'members' && (
              <div className="p-6">
                {/* Search and Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-64 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    
                    {/* Sort */}
                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setSortBy(field as typeof sortBy);
                        setSortOrder(order as typeof sortOrder);
                      }}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="points-desc">Highest Points</option>
                      <option value="points-asc">Lowest Points</option>
                      <option value="level-desc">Highest Level</option>
                      <option value="revenue-desc">Highest Revenue</option>
                      <option value="winRate-desc">Highest Win Rate</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                    </select>

                    {/* Select All */}
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>{selectedMembers.length === filteredMembers.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                  </div>
                </div>

                {/* Team Members Grid */}
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading team members...</p>
                    </div>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Crown className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-600 mb-2">No team members found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm ? 'Try adjusting your search criteria' : 'Add contacts to your team to get started'}
                    </p>
                    <button
                      onClick={() => setShowAddMemberModal(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Team Member</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredMembers.map((member) => (
                      <TeamMemberCard
                        key={member.id}
                        member={member}
                        isSelected={selectedMembers.includes(member.id)}
                        onSelect={() => handleMemberSelect(member.id)}
                        onClick={() => {
                          // Handle click to view member details
                        }}
                        onRemove={() => handleRemoveFromTeam(member.id)}
                        onAnalyze={() => handleAnalyzeMember(member)}
                        isAnalyzing={analyzingMemberIds.includes(member.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'leaderboard' && (
              <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                    <h3 className="text-xl font-bold flex items-center">
                      <Trophy className="w-6 h-6 mr-2 text-yellow-300" />
                      Team Leaderboard
                    </h3>
                    <p className="text-indigo-100 mt-1">Performance rankings and competition</p>
                  </div>
                  
                  {leaderboard.length === 0 ? (
                    <div className="p-8 text-center">
                      <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-700 mb-2">No Leaderboard Data</h4>
                      <p className="text-gray-500">Add team members with performance data to see rankings.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {leaderboard.map((entry, index) => (
                        <div key={entry.contactId} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="text-center w-8">
                              {index === 0 ? (
                                <Crown className="w-6 h-6 text-yellow-500 mx-auto" />
                              ) : index === 1 ? (
                                <Award className="w-6 h-6 text-gray-400 mx-auto" />
                              ) : index === 2 ? (
                                <Award className="w-6 h-6 text-orange-400 mx-auto" />
                              ) : (
                                <span className="text-xl font-bold text-gray-400">#{index + 1}</span>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              {entry.avatarSrc ? (
                                <img 
                                  src={entry.avatarSrc}
                                  alt={entry.name}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-indigo-600" />
                                </div>
                              )}
                              
                              <div>
                                <h4 className="font-semibold text-gray-900">{entry.name}</h4>
                                <p className="text-sm text-gray-500 capitalize">{entry.role}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-600">{entry.score}</div>
                            <div className="text-sm text-gray-500">points</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'achievements' && (
              <div className="p-6">
                <div className="space-y-6">
                  {/* Team Achievements Overview */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                      <Award className="w-6 h-6 mr-2 text-yellow-500" />
                      Team Achievement Progress
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {achievements.map((achievement) => {
                        // Count how many team members have this achievement
                        const membersWithAchievement = teamMembers.filter(member => 
                          member.gamificationStats?.achievements?.includes(achievement.id)
                        ).length;
                        
                        return (
                          <div 
                            key={achievement.id} 
                            className={`p-4 rounded-lg border-2 transition-all ${
                              membersWithAchievement > 0 
                                ? 'border-yellow-300 bg-yellow-50' 
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-2xl">{achievement.icon}</div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                membersWithAchievement > 0 
                                  ? 'bg-yellow-200 text-yellow-800' 
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {membersWithAchievement} earned
                              </span>
                            </div>
                            <h4 className="font-semibold text-gray-900 mb-1">{achievement.name}</h4>
                            <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">{achievement.points} points</span>
                              {membersWithAchievement > 0 && (
                                <div className="flex -space-x-1">
                                  {teamMembers
                                    .filter(member => member.gamificationStats?.achievements?.includes(achievement.id))
                                    .slice(0, 3)
                                    .map((member, idx) => (
                                      <img
                                        key={member.id}
                                        src={member.avatarSrc || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                                        alt={member.name}
                                        className="w-6 h-6 rounded-full border-2 border-white"
                                        title={member.name}
                                      />
                                    ))
                                  }
                                  {membersWithAchievement > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                                      +{membersWithAchievement - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Individual Member Achievement Progress */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Achievement Progress</h3>
                    
                    <div className="space-y-4">
                      {teamMembers.map((member) => {
                        const memberAchievements = member.gamificationStats?.achievements || [];
                        const completionRate = (memberAchievements.length / achievements.length) * 100;
                        
                        return (
                          <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={member.avatarSrc || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                                  alt={member.name}
                                  className="w-10 h-10 rounded-full border border-gray-200"
                                />
                                <div>
                                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                                  <p className="text-sm text-gray-600">{member.title}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-indigo-600">
                                  {memberAchievements.length}/{achievements.length}
                                </div>
                                <div className="text-xs text-gray-500">Achievements</div>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Progress</span>
                                <span>{completionRate.toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${completionRate}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Achievement Icons */}
                            <div className="flex flex-wrap gap-1">
                              {achievements.map((achievement) => {
                                const hasAchievement = memberAchievements.includes(achievement.id);
                                return (
                                  <div
                                    key={achievement.id}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                                      hasAchievement 
                                        ? 'bg-yellow-100 border-yellow-300' 
                                        : 'bg-gray-100 border-gray-300 opacity-50'
                                    }`}
                                    title={`${achievement.name}: ${achievement.description}`}
                                  >
                                    {achievement.icon}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'challenges' && (
              <div className="p-6">
                <div className="space-y-6">
                  {/* Active Challenges */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                      <Target className="w-6 h-6 mr-2 text-green-500" />
                      Active Team Challenges
                    </h3>
                    
                    {challenges.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-700 mb-2">No Active Challenges</h4>
                        <p className="text-gray-500">Create team challenges to motivate your team and boost performance.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {challenges.map((challenge) => (
                          <div key={challenge.id} className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                            <h4 className="font-bold text-gray-900 mb-2">{challenge.title}</h4>
                            <p className="text-gray-700 mb-4">{challenge.description}</p>
                            
                            {/* Progress Bar */}
                            <div className="mb-4">
                              <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>Progress</span>
                                <span>{challenge.current} / {challenge.target}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                  className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, (challenge.current / challenge.target) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full">
                                <Award className="w-4 h-4 mr-2 text-yellow-600" />
                                <span className="font-medium">{challenge.reward}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                {challenge.endDate.toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Team Member Modal */}
      <AddContactModal 
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        onSave={handleContactCreated}
        selectAfterCreate={true}
      />
    </>
  );
};