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
  // Track if Supabase is available to avoid repeated failures
  private static supabaseAvailable: boolean | null = null;

  async getAllAchievements(): Promise<Achievement[]> {
    // If Supabase was marked unavailable, return empty array immediately
    if (GamificationService.supabaseAvailable === false) {
      return [];
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        GamificationService.supabaseAvailable = false;
        return [];
      }

      const { data, error } = await supabase.client
        .from('achievements')
        .select('*')
        .order('points', { ascending: false });

      if (error) {
        GamificationService.supabaseAvailable = false;
        console.warn('GamificationService: Achievements not available:', error.message);
        return [];
      }

      GamificationService.supabaseAvailable = true;
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
      GamificationService.supabaseAvailable = false;
      return [];
    }
  }

  async getUserAchievements(contactId: string): Promise<Achievement[]> {
    if (GamificationService.supabaseAvailable === false) {
      return [];
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        return [];
      }

      const { data, error } = await supabase.client
        .from('user_achievements')
        .select(`
          id,
          unlocked_at,
          achievement:achievements(*)
        `)
        .eq('user_id', contactId);

      if (error) {
        console.warn('GamificationService: User achievements not available');
        return [];
      }

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
      console.warn('GamificationService: User achievements error');
      return [];
    }
  }

  async unlockAchievement(contactId: string, achievementId: string): Promise<void> {
    if (GamificationService.supabaseAvailable === false) {
      return;
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        return;
      }

      const { error } = await supabase.client
        .from('user_achievements')
        .insert({
          user_id: contactId,
          achievement_id: achievementId,
          unlocked_at: new Date().toISOString(),
        });

      if (error && error.code !== '23505') {
        console.warn('GamificationService: Failed to unlock achievement');
      }
    } catch (error) {
      console.warn('GamificationService: Unlock achievement error');
    }
  }

  async getActiveChallenges(): Promise<Challenge[]> {
    if (GamificationService.supabaseAvailable === false) {
      return [];
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        GamificationService.supabaseAvailable = false;
        return [];
      }

      const { data, error } = await supabase.client
        .from('challenges')
        .select('*')
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: true });

      if (error) {
        GamificationService.supabaseAvailable = false;
        console.warn('GamificationService: Challenges not available:', error.message);
        return [];
      }

      GamificationService.supabaseAvailable = true;
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
      GamificationService.supabaseAvailable = false;
      return [];
    }
  }

  async updateChallengeProgress(challengeId: string, progress: number): Promise<void> {
    if (GamificationService.supabaseAvailable === false) {
      return;
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        return;
      }

      const { error } = await supabase.client
        .from('challenges')
        .update({ current_progress: progress })
        .eq('id', challengeId);

      if (error) {
        console.warn('GamificationService: Failed to update challenge');
      }
    } catch (error) {
      console.warn('GamificationService: Update challenge error');
    }
  }

  async getRecentTeamAchievements(limit: number = 10): Promise<Array<{
    contactId: string;
    contactName: string;
    achievementTitle: string;
    achievementIcon: string;
    unlockedAt: Date;
  }>> {
    if (GamificationService.supabaseAvailable === false) {
      return [];
    }

    try {
      const supabase = getSupabaseService();
      if (!supabase.client) {
        return [];
      }

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

      if (error) {
        console.warn('GamificationService: Recent achievements not available');
        return [];
      }

      return (data || []).map((item: any) => ({
        contactId: item.user_id,
        contactName: item.contact?.name || 'Unknown User',
        achievementTitle: item.achievement?.title || 'Unknown Achievement',
        achievementIcon: item.achievement?.icon || '🏆',
        unlockedAt: new Date(item.unlocked_at),
      }));
    } catch (error) {
      console.warn('GamificationService: Recent achievements error');
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