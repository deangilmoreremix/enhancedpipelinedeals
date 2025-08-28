import { useGamification } from '../contexts/GamificationContext';
import { useContactStore } from '../store/contactStore';
import { Deal } from '../types';

interface DealUpdate {
  dealId: string;
  previousStage?: Deal['stage'];
  newStage: Deal['stage'];
  dealValue: number;
  assignedToId?: string;
}

export const useGamificationUpdates = () => {
  const { updateTeamMemberStats, awardAchievement, teamMembers, hasAchievement } = useGamification();
  const { contacts, updateContact } = useContactStore();

  const updateTeamMemberFromDeal = async (update: DealUpdate) => {
    const { dealId, previousStage, newStage, dealValue, assignedToId } = update;
    
    if (!assignedToId) {
      console.log('No assigned team member for deal:', dealId);
      return;
    }

    // Find the team member
    const teamMember = teamMembers.find(member => member.id === assignedToId);
    if (!teamMember || !teamMember.gamificationStats) {
      console.log('Team member not found or has no gamification stats:', assignedToId);
      return;
    }

    const stats = teamMember.gamificationStats;
    let updatedStats = { ...stats };
    let newAchievements: string[] = [];

    // Deal won - update positive stats
    if (newStage === 'closed-won' && previousStage !== 'closed-won') {
      console.log(`🎉 Deal won by ${teamMember.name}: $${dealValue.toLocaleString()}`);
      
      // Update core stats
      updatedStats.totalDeals = (stats.totalDeals || 0) + 1;
      updatedStats.totalRevenue = (stats.totalRevenue || 0) + dealValue;
      updatedStats.monthlyProgress = (stats.monthlyProgress || 0) + dealValue;
      
      // Update streak
      updatedStats.currentStreak = (stats.currentStreak || 0) + 1;
      updatedStats.longestStreak = Math.max(updatedStats.currentStreak, stats.longestStreak || 0);
      
      // Calculate win rate
      const totalDealsAttempted = updatedStats.totalDeals + (stats.totalLost || 0);
      updatedStats.winRate = totalDealsAttempted > 0 ? Math.round((updatedStats.totalDeals / totalDealsAttempted) * 100) : 100;
      
      // Award points based on deal value
      const basePoints = 100; // Base points for closing any deal
      const valuePoints = Math.floor(dealValue / 1000); // 1 point per $1k
      const bonusPoints = dealValue >= 50000 ? 50 : dealValue >= 25000 ? 25 : 0; // Bonus for large deals
      const totalPoints = basePoints + valuePoints + bonusPoints;
      
      updatedStats.points = (stats.points || 0) + totalPoints;
      updatedStats.level = Math.floor(updatedStats.points / 1000) + 1;
      
      // Check for achievements using the enhanced logic
      const earnedAchievements = await checkAndAwardAchievements(assignedToId, updatedStats, dealValue);
      console.log(`🏆 ${teamMember.name} earned achievements:`, earnedAchievements);
    }
    
    // Deal lost - update negative stats
    else if (newStage === 'closed-lost' && previousStage !== 'closed-lost') {
      console.log(`😞 Deal lost by ${teamMember.name}: $${dealValue.toLocaleString()}`);
      
      // Reset streak
      updatedStats.currentStreak = 0;
      
      // Track lost deals (add this field if not exists)
      updatedStats.totalLost = (stats.totalLost || 0) + 1;
      
      // Recalculate win rate
      const totalDealsAttempted = (stats.totalDeals || 0) + updatedStats.totalLost;
      updatedStats.winRate = totalDealsAttempted > 0 ? Math.round(((stats.totalDeals || 0) / totalDealsAttempted) * 100) : 0;
    }
    
    // Deal reopened (moved from closed back to active)
    else if (previousStage === 'closed-won' && newStage !== 'closed-won') {
      console.log(`🔄 Deal reopened by ${teamMember.name}: $${dealValue.toLocaleString()}`);
      
      // Reverse the won deal stats
      updatedStats.totalDeals = Math.max((stats.totalDeals || 0) - 1, 0);
      updatedStats.totalRevenue = Math.max((stats.totalRevenue || 0) - dealValue, 0);
      updatedStats.monthlyProgress = Math.max((stats.monthlyProgress || 0) - dealValue, 0);
      
      // Recalculate win rate
      const totalDealsAttempted = updatedStats.totalDeals + (stats.totalLost || 0);
      updatedStats.winRate = totalDealsAttempted > 0 ? Math.round((updatedStats.totalDeals / totalDealsAttempted) * 100) : 0;
      
      // Note: We don't remove achievements or reset streaks for reopened deals
    }
    
    else if (previousStage === 'closed-lost' && newStage !== 'closed-lost') {
      console.log(`🔄 Lost deal reopened by ${teamMember.name}: $${dealValue.toLocaleString()}`);
      
      // Reverse the lost deal stats
      updatedStats.totalLost = Math.max((stats.totalLost || 0) - 1, 0);
      
      // Recalculate win rate
      const totalDealsAttempted = (stats.totalDeals || 0) + updatedStats.totalLost;
      updatedStats.winRate = totalDealsAttempted > 0 ? Math.round(((stats.totalDeals || 0) / totalDealsAttempted) * 100) : 0;
    }

    // Update the team member's stats
    try {
      await updateTeamMemberStats(assignedToId, updatedStats);
      
      console.log(`✅ Updated gamification stats for ${teamMember.name}:`, updatedStats);
    } catch (error) {
      console.error('Failed to update team member stats:', error);
    }
  };

  // Enhanced achievement checking with comprehensive logic
  const checkAndAwardAchievements = async (contactId: string, updatedStats: any, dealValue?: number) => {
    const newAchievements: string[] = [];
    
    // First Deal Achievement
    if (updatedStats.totalDeals === 1 && !hasAchievement(contactId, 'first-deal')) {
      newAchievements.push('first-deal');
    }
    
    // Deal Streak Achievement
    if (updatedStats.currentStreak >= 5 && !hasAchievement(contactId, 'deal-streak-5')) {
      newAchievements.push('deal-streak-5');
    }
    
    // Revenue Milestone Achievement
    if (updatedStats.totalRevenue >= 100000 && !hasAchievement(contactId, 'revenue-milestone-100k')) {
      newAchievements.push('revenue-milestone-100k');
    }
    
    // Big Deal Closer Achievement
    if (dealValue && dealValue >= 50000 && !hasAchievement(contactId, 'big-deal-closer')) {
      newAchievements.push('big-deal-closer');
    }
    
    // Pipeline Master Achievement (10+ deals)
    if (updatedStats.totalDeals >= 10 && !hasAchievement(contactId, 'pipeline-master')) {
      newAchievements.push('pipeline-master');
    }
    
    // Award all new achievements
    for (const achievementId of newAchievements) {
      await awardAchievement(contactId, achievementId);
    }
    
    return newAchievements;
  };
  const handleDealStageChange = async (deal: Deal, previousStage?: Deal['stage']) => {
    if (!deal.assignedToId) return;
    
    await updateTeamMemberFromDeal({
      dealId: deal.id,
      previousStage,
      newStage: deal.stage,
      dealValue: deal.value,
      assignedToId: deal.assignedToId
    });
  };

  const handleDealValueChange = async (deal: Deal, previousValue: number) => {
    if (!deal.assignedToId || deal.stage !== 'closed-won') return;
    
    // If the value changed on a won deal, update the revenue difference
    const valueDifference = deal.value - previousValue;
    
    const teamMember = teamMembers.find(member => member.id === deal.assignedToId);
    if (!teamMember?.gamificationStats) return;
    
    const updatedStats = {
      ...teamMember.gamificationStats,
      totalRevenue: (teamMember.gamificationStats.totalRevenue || 0) + valueDifference,
      monthlyProgress: (teamMember.gamificationStats.monthlyProgress || 0) + valueDifference
    };
    
    await updateTeamMemberStats(deal.assignedToId, updatedStats);
    console.log(`💰 Updated revenue for ${teamMember.name}: ${valueDifference > 0 ? '+' : ''}$${valueDifference.toLocaleString()}`);
  };

  return {
    handleDealStageChange,
    handleDealValueChange,
    updateTeamMemberFromDeal
  };
};