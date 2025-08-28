export interface Contact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title: string;
  company: string;
  industry?: string;
  avatarSrc?: string;
  status: 'lead' | 'prospect' | 'customer' | 'churned';
  interestLevel: 'hot' | 'medium' | 'low' | 'cold';
  sources: string[];
  socialProfiles?: Record<string, string>;
  customFields?: Record<string, string | number | boolean>;
  notes?: string;
  aiScore?: number;
  lastConnected?: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  isFavorite?: boolean;
  lastEnrichment?: {
    confidence: number;
    aiProvider?: string;
    timestamp?: Date;
  };
  
  // Enhanced AI Analysis Fields
  psychologicalProfile?: {
    personalityTraits: string[];
    communicationStyle: 'formal' | 'casual' | 'technical' | 'relationship-focused';
    decisionMakingStyle: 'analytical' | 'intuitive' | 'consensus-driven' | 'authoritative';
    motivations: string[];
    potentialObjections: string[];
    psychologicalTriggers: string[];
    influenceLevel: 'high' | 'medium' | 'low';
    riskTolerance: 'high' | 'medium' | 'low';
    urgencyLevel: 'immediate' | 'planned' | 'exploratory';
    generatedAt: Date;
    confidence: number;
  };
  
  aiScoreRationale?: {
    score: number;
    narrative: string;
    keyFactors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      weight: number;
      explanation: string;
    }>;
    warningFlags: string[];
    opportunityFlags: string[];
    recommendedActions: string[];
    generatedAt: Date;
    aiProvider: string;
  };
  
  behavioralInsights?: {
    engagementPatterns: string[];
    preferredChannels: string[];
    responseTimings: string[];
    contentPreferences: string[];
    buyingSignals: string[];
    disengagementRisks: string[];
    generatedAt: Date;
  };
  
  // Team-related fields
  isTeamMember?: boolean;
  role?: 'sales-rep' | 'manager' | 'executive' | 'admin';
  gamificationStats?: {
    totalDeals: number;
    totalRevenue: number;
    totalLost?: number;
    winRate: number;
    currentStreak: number;
    longestStreak: number;
    level: number;
    points: number;
    achievements: string[];
    lastAchievementDate?: Date;
    monthlyGoal?: number;
    monthlyProgress?: number;
  };
}

export interface ContactFilters {
  search: string;
  interestLevel: string;
  status: string;
  source: string;
  company: string;
  isTeamMember?: boolean;
}

export interface AIContactAnalysis {
  score: number;
  insights: string[];
  recommendations: string[];
  riskFactors: string[];
}

export interface TeamChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  startDate: Date;
  endDate: Date;
  reward: string;
  participants: string[];
  type: 'revenue' | 'deals' | 'streak' | 'conversion';
}

export interface GamificationContextType {
  achievements: Achievement[];
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  teamMembers: Contact[];
  isTeamMember: (contactId: string) => boolean;
  addTeamMember: (contactId: string) => Promise<void>;
  removeTeamMember: (contactId: string) => Promise<void>;
  updateTeamMemberStats: (contactId: string, updates: Partial<Contact['gamificationStats']>) => Promise<void>;
  awardAchievement: (contactId: string, achievementId: string) => Promise<void>;
  hasAchievement: (contactId: string, achievementId: string) => boolean;
  getAchievementsForMember: (contactId: string) => Achievement[];
}