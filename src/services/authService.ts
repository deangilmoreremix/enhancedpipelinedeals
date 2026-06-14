/**
 * Authentication Service - Production-ready user authentication
 * Integrates with Supabase Auth for secure user management
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { supabase as sharedSupabase } from '../lib/core/supabaseClient';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: 'admin' | 'user' | 'agent';
  createdAt: string;
  lastLogin?: string;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

class AuthService {
  private supabase: SupabaseClient;
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false
  };
  private listeners: Set<(state: AuthState) => void> = new Set();

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase configuration missing. Auth service running in demo mode.');
      this.supabase = null as any;
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false
      });
      return;
    }

    try {
      // Reuse the shared singleton to avoid duplicate GoTrueClient instances
      if (sharedSupabase) {
        this.supabase = sharedSupabase;
      } else {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        });
      }

      this.initialize();
    } catch (error) {
      console.warn('⚠️ Failed to initialize auth service:', error);
      this.supabase = null as any;
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false
      });
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Get initial session
      const { data: { session }, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('Auth initialization error:', error);
        this.updateAuthState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false
        });
        return;
      }

      if (session?.user) {
        const user = await this.createAuthUser(session.user);
        this.updateAuthState({
          user,
          session,
          isLoading: false,
          isAuthenticated: true
        });
      } else {
        this.updateAuthState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false
        });
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        if (session?.user) {
          const user = await this.createAuthUser(session.user);
          this.updateAuthState({
            user,
            session,
            isLoading: false,
            isAuthenticated: true
          });
        } else {
          this.updateAuthState({
            user: null,
            session: null,
            isLoading: false,
            isAuthenticated: false
          });
        }
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false
      });
    }
  }

  private async createAuthUser(supabaseUser: User): Promise<AuthUser> {
    // Get additional user data from profiles table
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
      avatar: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url,
      role: profile?.role || 'user',
      createdAt: supabaseUser.created_at,
      lastLogin: new Date().toISOString()
    };
  }

  private updateAuthState(newState: Partial<AuthState>): void {
    this.authState = { ...this.authState, ...newState };
    this.listeners.forEach(listener => listener(this.authState));
  }

  // Authentication methods
  async signUp(email: string, password: string, metadata?: { name?: string }): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const user = await this.createAuthUser(data.user);
        return { user, error: null };
      }

      return { user: null, error: 'Signup failed' };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Signup failed' };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        const user = await this.createAuthUser(data.user);
        return { user, error: null };
      }

      return { user: null, error: 'Signin failed' };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Signin failed' };
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase.auth.signOut();
      return { error: error?.message || null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Signout failed' };
    }
  }

  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      return { error: error?.message || null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Password reset failed' };
    }
  }

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword
      });
      return { error: error?.message || null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Password update failed' };
    }
  }

  async updateProfile(updates: { name?: string; avatar?: string }): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .upsert({
          id: this.authState.user?.id,
          ...updates,
          updated_at: new Date().toISOString()
        });

      if (error) {
        return { error: error.message };
      }

      // Update local state
      if (this.authState.user) {
        this.updateAuthState({
          user: { ...this.authState.user, ...updates }
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Profile update failed' };
    }
  }

  // State management
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Permission checks
  hasRole(role: string): boolean {
    return this.authState.user?.role === role;
  }

  hasPermission(permission: string): boolean {
    const userRole = this.authState.user?.role;

    const permissions: Record<string, string[]> = {
      admin: ['*'],
      user: ['read', 'write', 'ai_agents'],
      agent: ['read', 'ai_agents']
    };

    return permissions[userRole || '']?.includes(permission) ||
           permissions[userRole || '']?.includes('*') ||
           false;
  }

  // Utility methods
  getCurrentUser(): AuthUser | null {
    return this.authState.user;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  isLoading(): boolean {
    return this.authState.isLoading;
  }

  // Supabase-compatible methods for AuthProvider
  async getCurrentSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      return { data: { session }, error };
    } catch (error) {
      return { data: { session: null }, error: error as Error };
    }
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } } {
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            if (subscription && typeof subscription.unsubscribe === 'function') {
              subscription.unsubscribe();
            }
          }
        }
      }
    };
  }

  // Supabase client access for other services
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

// Singleton instance
let authService: AuthService | null = null;

export const getAuthService = (): AuthService => {
  if (!authService) {
    authService = new AuthService();
  }
  return authService;
};

export { AuthService };
export type { AuthUser, AuthState };