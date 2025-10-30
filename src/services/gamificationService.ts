import { getSupabaseService } from './supabaseService';
import { Achievement, Challenge } from '../types/contact';

interface DbAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'sales' | 'engagement' | 'growth' | 'teamwork';
  created_at: string;
  updated_at: string;
}

interface DbChallenge {
  id: string;
  title: string;
  description: string;
  type: 'revenue' | 'deals' | 'streak' | 'conversion';
  target: number;
  current_progress: number;
  reward: string;
  start_date: string;
  end_date: string;
  participants: string[];
  created_at: string;
  updated_at: string;
}

interface DbUserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export class GamificationService {
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const supabase = getSupabaseService();
      const { data, error } = await supabase.client
        .from('achievements')
        .select('*')
        .order('points', { ascending: false });

      if (error) throw error;

      return (data || []).map((dbAch: DbAchievement) => ({
        id: dbAch.id,
        title: dbAch.title,
        description: dbAch.description || '',
        icon: dbAch.icon,
        points: dbAch.points,
        rarity: dbAch.rarity,
        category: dbAch.category,
      }));
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
      return [];
    }
  }

  async getUserAchievements(contactId: string): Promise<Achievement[]> {
    try {
      const supabase = getSupabaseService();
      const { data, error } = await supabase.client
        .from('user_achievements')
        .select(`
          id,
          unlocked_at,
          achievement:achievements(*)
        `)
        .eq('user_id', contactId);

      if (error) throw error;

      return (data || []).map((ua: any) => ({
        id: ua.achievement.id,
        title: ua.achievement.title,
        description: ua.achievement.description || '',
        icon: ua.achievement.icon,
        points: ua.achievement.points,
        rarity: ua.achievement.rarity,
        category: ua.achievement.category,
        unlockedAt: new Date(ua.unlocked_at),
      }));
    } catch (error) {
      console.error('Failed to fetch user achievements:', error);
      return [];
    }
  }

  async unlockAchievement(contactId: string, achievementId: string): Promise<void> {
    try {
      const supabase = getSupabaseService();

      const { error } = await supabase.client
        .from('user_achievements')
        .insert({
          user_id: contactId,
          achievement_id: achievementId,
          unlocked_at: new Date().toISOString(),
        });

      if (error && error.code !== '23505') {
        throw error;
      }
    } catch (error) {
      console.error('Failed to unlock achievement:', error);
      throw error;
    }
  }

  async getActiveChallenges(): Promise<Challenge[]> {
    try {
      const supabase = getSupabaseService();
      const { data, error } = await supabase.client
        .from('challenges')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((dbCh: DbChallenge) => ({
        id: dbCh.id,
        title: dbCh.title,
        description: dbCh.description || '',
        type: dbCh.type,
        target: Number(dbCh.target),
        reward: dbCh.reward,
        startDate: new Date(dbCh.start_date),
        endDate: new Date(dbCh.end_date),
        participants: dbCh.participants || [],
      }));
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
      return [];
    }
  }

  async updateChallengeProgress(challengeId: string, progress: number): Promise<void> {
    try {
      const supabase = getSupabaseService();

      const { error } = await supabase.client
        .from('challenges')
        .update({ current_progress: progress })
        .eq('id', challengeId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update challenge progress:', error);
      throw error;
    }
  }

  async getRecentTeamAchievements(limit: number = 10): Promise<Array<{
    contactId: string;
    contactName: string;
    achievementTitle: string;
    achievementIcon: string;
    unlockedAt: Date;
  }>> {
    try {
      const supabase = getSupabaseService();
      const { data, error } = await supabase.client
        .from('user_achievements')
        .select(`
          id,
          user_id,
          unlocked_at,
          achievement:achievements(title, icon),
          contact:contacts(name)
        `)
        .order('unlocked_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        contactId: item.user_id,
        contactName: item.contact?.name || 'Unknown User',
        achievementTitle: item.achievement?.title || 'Unknown Achievement',
        achievementIcon: item.achievement?.icon || '🏆',
        unlockedAt: new Date(item.unlocked_at),
      }));
    } catch (error) {
      console.error('Failed to fetch recent team achievements:', error);
      return [];
    }
  }
}

let gamificationServiceInstance: GamificationService | null = null;

export const getGamificationService = (): GamificationService => {
  if (!gamificationServiceInstance) {
    gamificationServiceInstance = new GamificationService();
  }
  return gamificationServiceInstance;
};
