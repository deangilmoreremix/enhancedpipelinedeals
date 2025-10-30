import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useContactStore } from '../store/contactStore';
import { Contact } from '../types/contact';
import { getGamificationService } from '../services/gamificationService';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  unlocked?: boolean;
  unlockedAt?: Date;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  reward: string;
  endDate: Date;
}

interface LeaderboardEntry {
  contactId: string;
  name: string;
  role: string;
  avatarSrc?: string;
  score: number;
  recentAchievement?: string;
}

interface GamificationContextType {
  achievements: Achievement[];
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  teamMembers: Contact[];
  isTeamMember: (contactId: string) => boolean;
  addTeamMember: (contactId: string) => Promise<void>;
  removeTeamMember: (contactId: string) => Promise<void>;
  updateTeamMemberStats: (contactId: string, updates: Partial<Contact['gamificationStats']>) => Promise<void>;
  awardAchievement: (contactId: string, achievementId: string) => Promise<void>;
}

// Create the context with default values
const GamificationContext = createContext<GamificationContextType>({
  achievements: [],
  challenges: [],
  leaderboard: [],
  teamMembers: [],
  isTeamMember: () => false,
  addTeamMember: async () => {},
  removeTeamMember: async () => {},
  updateTeamMemberStats: async () => {},
  awardAchievement: async () => {},
});

// Sample achievements data
const sampleAchievements: Achievement[] = [
  {
    id: 'first-deal',
    name: 'First Deal',
    description: 'Closed your first deal',
    icon: '🎯',
    points: 100,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'deal-streak-5',
    name: '5 Deal Streak',
    description: 'Closed 5 deals in a row',
    icon: '🔥',
    points: 250,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'revenue-milestone-100k',
    name: '$100K Milestone',
    description: 'Generated $100,000 in revenue',
    icon: '💰',
    points: 500,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'pipeline-master',
    name: 'Pipeline Master',
    description: 'Manage 10+ active deals simultaneously',
    icon: '🧠',
    points: 300,
    unlocked: false
  },
  {
    id: 'quick-closer',
    name: 'Quick Closer',
    description: 'Close a deal in under 14 days',
    icon: '⚡',
    points: 200,
    unlocked: false
  }
];

// Sample challenges data
const sampleChallenges: Challenge[] = [
  {
    id: 'weekly-revenue-push',
    title: 'Weekly Revenue Push',
    description: 'Close $50,000 in deals this week',
    target: 50000,
    current: 32500,
    reward: '500 points + Top Closer badge',
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: 'team-qualification-sprint',
    title: 'Qualification Sprint',
    description: 'Team goal: Qualify 20 new leads this month',
    target: 20,
    current: 12,
    reward: '300 points + Team bonus',
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  }
];

export const GamificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { contacts, updateContact, updateTeamMemberStats: updateContactStats } = useContactStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<Contact[]>([]);
  const gamificationService = getGamificationService();

  // Load achievements and challenges from database
  useEffect(() => {
    const loadGamificationData = async () => {
      const [dbAchievements, dbChallenges] = await Promise.all([
        gamificationService.getAllAchievements(),
        gamificationService.getActiveChallenges(),
      ]);
      setAchievements(dbAchievements);
      setChallenges(dbChallenges);
    };
    loadGamificationData();
  }, []);

  // Update team members whenever contacts change
  useEffect(() => {
    const filteredTeamMembers = contacts.filter(contact => contact.isTeamMember);
    setTeamMembers(filteredTeamMembers);
    
    // Update leaderboard
    const leaderboardData = filteredTeamMembers
      .map(member => ({
        contactId: member.id,
        name: member.name,
        role: member.role || 'sales-rep',
        avatarSrc: member.avatarSrc,
        score: member.gamificationStats?.points || 0,
        recentAchievement: member.gamificationStats?.achievements?.length 
          ? member.gamificationStats.achievements[member.gamificationStats.achievements.length - 1] 
          : undefined
      }))
      .sort((a, b) => b.score - a.score);
    
    setLeaderboard(leaderboardData);
  }, [contacts]);

  const isTeamMember = (contactId: string) => {
    return teamMembers.some(member => member.id === contactId);
  };

  const addTeamMember = async (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) throw new Error('Contact not found');

    await updateContact(contactId, {
      isTeamMember: true,
      role: 'sales-rep',
      gamificationStats: {
        totalDeals: 0,
        totalRevenue: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        points: 0,
        achievements: [],
        monthlyGoal: 50000,
        monthlyProgress: 0
      }
    });
  };

  const removeTeamMember = async (contactId: string) => {
    await updateContact(contactId, {
      isTeamMember: false,
      role: undefined,
      gamificationStats: undefined
    });
  };

  const updateTeamMemberStats = async (contactId: string, updates: Partial<Contact['gamificationStats']>) => {
    await updateContactStats(contactId, updates);
  };

  const awardAchievement = async (contactId: string, achievementId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || !contact.gamificationStats) throw new Error('Contact not found or not a team member');

    // Check if achievement already earned
    if (contact.gamificationStats.achievements?.includes(achievementId)) {
      return;
    }

    // Find achievement to get points
    const achievement = achievements.find(a => a.id === achievementId);
    if (!achievement) throw new Error('Achievement not found');

    // Update achievement list and add points
    const newAchievements = [...(contact.gamificationStats.achievements || []), achievementId];
    const newPoints = (contact.gamificationStats.points || 0) + achievement.points;

    // Calculate level (every 1000 points = 1 level)
    const newLevel = Math.floor(newPoints / 1000) + 1;

    await updateContactStats(contactId, {
      achievements: newAchievements,
      points: newPoints,
      level: newLevel,
      lastAchievementDate: new Date()
    });

    // Save to database
    try {
      await gamificationService.unlockAchievement(contactId, achievementId);
    } catch (error) {
      console.error('Failed to save achievement to database:', error);
    }

    // Update achievement list to mark it as unlocked
    setAchievements(prev => prev.map(a =>
      a.id === achievementId
        ? { ...a, unlocked: true, unlockedAt: new Date() }
        : a
    ));
  };

  const hasAchievement = (contactId: string, achievementId: string): boolean => {
    const member = teamMembers.find(m => m.id === contactId);
    return member?.gamificationStats?.achievements?.includes(achievementId) || false;
  };

  return (
    <GamificationContext.Provider 
      value={{ 
        achievements, 
        challenges, 
        leaderboard,
        teamMembers,
        isTeamMember,
        addTeamMember,
        removeTeamMember,
        updateTeamMemberStats,
        awardAchievement,
        hasAchievement: hasAchievement, // Explicitly include hasAchievement in the context value
        getAchievementsForMember: (contactId: string) => {
          const member = teamMembers.find(m => m.id === contactId);
          return achievements.filter(a => member?.gamificationStats?.achievements?.includes(a.id));
        }
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);