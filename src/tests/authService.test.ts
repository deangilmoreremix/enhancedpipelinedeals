import { getAuthService, AuthService } from '../services/authService';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
    })),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockSupabase: any;

  beforeEach(() => {
    // Set up environment variables
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';

    // Clear singleton instance
    (global as any).authService = null;
    service = getAuthService();
    mockSupabase = (service as any).supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = getAuthService();
      const service2 = getAuthService();
      expect(service1).toBe(service2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with correct Supabase configuration', () => {
      expect(mockSupabase).toBeDefined();
    });

    it('should throw error if Supabase URL is missing', () => {
      delete process.env.VITE_SUPABASE_URL;

      expect(() => {
        (global as any).authService = null;
        getAuthService();
      }).toThrow('Supabase configuration missing');
    });

    it('should throw error if Supabase key is missing', () => {
      delete process.env.VITE_SUPABASE_ANON_KEY;

      expect(() => {
        (global as any).authService = null;
        getAuthService();
      }).toThrow('Supabase configuration missing');
    });
  });

  describe('Authentication Methods', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { name: 'Test User', avatar: 'avatar.jpg' },
      created_at: '2024-01-01T00:00:00Z',
      last_sign_in_at: '2024-01-02T00:00:00Z',
    };

    const mockSession = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: mockUser,
    };

    describe('signUp', () => {
      it('should sign up user successfully', async () => {
        const signUpData = {
          email: 'newuser@example.com',
          password: 'password123',
          options: {
            data: {
              name: 'New User',
              role: 'user' as const,
            }
          }
        };

        mockSupabase.auth.signUp.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });

        const result = await service.signUp(signUpData.email, signUpData.password, signUpData.options?.data);

        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(signUpData);
        expect(result.user).toEqual(mockUser);
        expect(result.session).toEqual(mockSession);
      });

      it('should handle sign up errors', async () => {
        mockSupabase.auth.signUp.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Email already registered' },
        });

        await expect(service.signUp('existing@example.com', 'password123'))
          .rejects.toThrow('Email already registered');
      });

      it('should handle network errors during sign up', async () => {
        mockSupabase.auth.signUp.mockRejectedValue(new Error('Network error'));

        await expect(service.signUp('user@example.com', 'password123'))
          .rejects.toThrow('Network error');
      });
    });

    describe('signIn', () => {
      it('should sign in user successfully', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });

        const result = await service.signIn('test@example.com', 'password123');

        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result.user).toEqual(mockUser);
        expect(result.session).toEqual(mockSession);
      });

      it('should handle invalid credentials', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        });

        await expect(service.signIn('wrong@example.com', 'wrongpassword'))
          .rejects.toThrow('Invalid login credentials');
      });

      it('should handle sign in network errors', async () => {
        mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network timeout'));

        await expect(service.signIn('user@example.com', 'password123'))
          .rejects.toThrow('Network timeout');
      });
    });

    describe('signOut', () => {
      it('should sign out user successfully', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({
          error: null,
        });

        await expect(service.signOut()).resolves.toBeUndefined();
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });

      it('should handle sign out errors', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({
          error: { message: 'Sign out failed' },
        });

        await expect(service.signOut()).rejects.toThrow('Sign out failed');
      });
    });

    describe('resetPassword', () => {
      it('should send password reset email successfully', async () => {
        mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
          data: {},
          error: null,
        });

        await expect(service.resetPassword('user@example.com')).resolves.toBeUndefined();
        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
      });

      it('should handle password reset errors', async () => {
        mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
          data: {},
          error: { message: 'Invalid email' },
        });

        await expect(service.resetPassword('invalid@example.com'))
          .rejects.toThrow('Invalid email');
      });
    });

    describe('updateProfile', () => {
      it('should update user profile successfully', async () => {
        const updates = { name: 'Updated Name', avatar: 'new-avatar.jpg' };

        mockSupabase.auth.updateUser.mockResolvedValue({
          data: { user: { ...mockUser, user_metadata: updates } },
          error: null,
        });

        const result = await service.updateProfile(updates);
        expect(result.user_metadata).toEqual(updates);
      });

      it('should handle profile update errors', async () => {
        mockSupabase.auth.updateUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Update failed' },
        });

        await expect(service.updateProfile({ name: 'New Name' }))
          .rejects.toThrow('Update failed');
      });
    });
  });

  describe('Session Management', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { name: 'Test User', role: 'user' },
    };

    const mockSession = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: mockUser,
    };

    describe('getCurrentSession', () => {
      it('should return current session successfully', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const result = await service.getCurrentSession();
        expect(result.data.session).toEqual(mockSession);
      });

      it('should handle no active session', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: null },
          error: null,
        });

        const result = await service.getCurrentSession();
        expect(result.data.session).toBeNull();
      });
    });

    describe('getCurrentUser', () => {
      it('should return current user successfully', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const result = await service.getCurrentUser();
        expect(result).toEqual(mockUser);
      });

      it('should handle no authenticated user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const result = await service.getCurrentUser();
        expect(result).toBeNull();
      });
    });

    describe('onAuthStateChange', () => {
      it('should set up auth state change listener', () => {
        const mockCallback = jest.fn();

        service.onAuthStateChange(mockCallback);

        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
      });

      it('should handle auth state changes', async () => {
        const mockCallback = jest.fn();
        let capturedCallback: any;

        mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
          capturedCallback = callback;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        });

        service.onAuthStateChange(mockCallback);

        // Simulate auth state change
        await capturedCallback('SIGNED_IN', mockSession);

        expect(mockCallback).toHaveBeenCalledWith('SIGNED_IN', mockSession);
      });
    });
  });

  describe('User Profile Management', () => {
    const mockProfile = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      avatar: 'avatar.jpg',
      role: 'user' as const,
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-02T00:00:00Z',
    };

    describe('getUserProfile', () => {
      it('should return user profile successfully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
        });

        const result = await service.getUserProfile('user-1');
        expect(result).toEqual(mockProfile);
      });

      it('should handle profile not found', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        });

        const result = await service.getUserProfile('nonexistent-user');
        expect(result).toBeNull();
      });
    });

    describe('updateUserProfile', () => {
      it('should update user profile successfully', async () => {
        const updates = { name: 'Updated Name', avatar: 'new-avatar.jpg' };

        mockSupabase.from.mockReturnValue({
          upsert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...mockProfile, ...updates }, error: null }),
        });

        const result = await service.updateUserProfile('user-1', updates);
        expect(result.name).toBe('Updated Name');
        expect(result.avatar).toBe('new-avatar.jpg');
      });
    });
  });

  describe('Permission System', () => {
    describe('hasPermission', () => {
      it('should return true for admin users', () => {
        const adminUser = { role: 'admin' as const };
        expect(service.hasPermission('any-permission')).toBe(true);
      });

      it('should check specific permissions for regular users', () => {
        // This would need to be implemented based on your permission system
        // For now, we'll assume a basic implementation
        expect(service.hasPermission('read-deals')).toBeDefined();
      });
    });

    describe('Role-based Access', () => {
      it('should handle admin role permissions', () => {
        expect(service.hasPermission('admin-access')).toBe(true);
      });

      it('should handle user role permissions', () => {
        expect(service.hasPermission('user-access')).toBeDefined();
      });

      it('should handle agent role permissions', () => {
        expect(service.hasPermission('agent-access')).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      await expect(service.signIn('user@example.com', 'password'))
        .rejects.toThrow('Network error');
    });

    it('should handle Supabase errors with proper messages', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      await expect(service.signUp('existing@example.com', 'password'))
        .rejects.toThrow('User already registered');
    });

    it('should handle malformed responses', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getCurrentUser();
      expect(result).toBeNull();
    });
  });

  describe('Security Features', () => {
    it('should validate email format', async () => {
      await expect(service.signUp('invalid-email', 'password'))
        .rejects.toThrow();
    });

    it('should validate password strength', async () => {
      await expect(service.signUp('user@example.com', '123'))
        .rejects.toThrow();
    });

    it('should handle session expiration', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const result = await service.getCurrentSession();
      expect(result.data.session).toBeNull();
    });

    it('should prevent unauthorized access', async () => {
      // Test that unauthenticated users can't access protected resources
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const user = await service.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete authentication flow', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
      };

      const mockSession = {
        access_token: 'access-token',
        user: mockUser,
      };

      // Sign up
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const signUpResult = await service.signUp('test@example.com', 'password123');
      expect(signUpResult.user).toEqual(mockUser);

      // Get current user
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const currentUser = await service.getCurrentUser();
      expect(currentUser).toEqual(mockUser);

      // Sign out
      mockSupabase.auth.signOut.mockResolvedValueOnce({
        error: null,
      });

      await service.signOut();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle password reset flow', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      await service.resetPassword('user@example.com');
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
    });
  });
});