// Mock the service module
jest.mock('../services/supabaseService');

import { getSupabaseService, SupabaseService } from '../services/supabaseService';
import { Contact } from '../types/contact';
import { Deal } from '../types';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockReturnThis(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    })),
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
  })),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;
  let mockSupabase: any;

  beforeEach(() => {
    // Clear singleton instance
    (global as any).supabaseService = null;
    service = getSupabaseService();
    mockSupabase = (service as any).supabase;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = getSupabaseService();
      const service2 = getSupabaseService();
      expect(service1).toBe(service2);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
      });

      const result = await service.checkConnection();
      expect(result).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
      });

      const result = await service.checkConnection();
      expect(result).toBe(false);
    });
  });

  describe('Contact Operations', () => {
    const mockContact: Contact = {
      id: 'contact-1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Test Corp',
      phone: '+1234567890',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    describe('getContacts', () => {
      it('should return contacts successfully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [mockContact], error: null }),
        });

        const result = await service.getContacts();
        expect(result).toEqual([mockContact]);
      });

      it('should handle errors gracefully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
        });

        const result = await service.getContacts();
        expect(result).toEqual([]);
      });
    });

    describe('createContact', () => {
      it('should create contact successfully', async () => {
        const newContact = { name: 'Jane Doe', email: 'jane@example.com' };
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...newContact, id: 'new-id' }, error: null }),
        });

        const result = await service.createContact(newContact);
        expect(result.id).toBe('new-id');
        expect(result.name).toBe('Jane Doe');
      });

      it('should handle creation errors', async () => {
        const newContact = { name: 'Jane Doe', email: 'jane@example.com' };
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockRejectedValue(new Error('Creation failed')),
        });

        await expect(service.createContact(newContact)).rejects.toThrow('Creation failed');
      });
    });

    describe('updateContact', () => {
      it('should update contact successfully', async () => {
        const updates = { name: 'Updated Name' };
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...mockContact, ...updates }, error: null }),
        });

        const result = await service.updateContact('contact-1', updates);
        expect(result.name).toBe('Updated Name');
      });
    });

    describe('deleteContact', () => {
      it('should delete contact successfully', async () => {
        mockSupabase.from.mockReturnValue({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect(service.deleteContact('contact-1')).resolves.toBeUndefined();
      });
    });

    describe('searchContacts', () => {
      it('should search contacts successfully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockResolvedValue({ data: [mockContact], error: null }),
        });

        const result = await service.searchContacts('John');
        expect(result).toEqual([mockContact]);
      });
    });
  });

  describe('Deal Operations', () => {
    const mockDeal: Deal = {
      id: 'deal-1',
      title: 'Test Deal',
      company: 'Test Corp',
      value: 50000,
      stage: 'prospect',
      probability: 75,
      contactId: 'contact-1',
      userId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    describe('getDeals', () => {
      it('should return deals successfully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [mockDeal], error: null }),
        });

        const result = await service.getDeals();
        expect(result).toEqual([mockDeal]);
      });

      it('should handle errors and return cached data', async () => {
        // Mock localStorage
        const mockLocalStorage = {
          getItem: jest.fn().mockReturnValue(JSON.stringify([mockDeal])),
          setItem: jest.fn(),
        };
        Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
        });

        const result = await service.getDeals();
        expect(result).toEqual([mockDeal]);
      });
    });

    describe('createDeal', () => {
      it('should create deal successfully', async () => {
        const newDeal = { title: 'New Deal', value: 25000 };
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...newDeal, id: 'new-deal-id' }, error: null }),
        });

        const result = await service.createDeal(newDeal);
        expect(result.id).toBe('new-deal-id');
        expect(result.title).toBe('New Deal');
      });
    });

    describe('updateDeal', () => {
      it('should update deal successfully', async () => {
        const updates = { title: 'Updated Deal' };
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { ...mockDeal, ...updates }, error: null }),
        });

        const result = await service.updateDeal('deal-1', updates);
        expect(result.title).toBe('Updated Deal');
      });
    });

    describe('deleteDeal', () => {
      it('should delete deal successfully', async () => {
        mockSupabase.from.mockReturnValue({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect(service.deleteDeal('deal-1')).resolves.toBeUndefined();
      });
    });
  });

  describe('Activity Operations', () => {
    describe('getActivities', () => {
      it('should return activities successfully', async () => {
        const mockActivity = {
          id: 'activity-1',
          type: 'call',
          entity_type: 'contact',
          entity_id: 'contact-1',
          description: 'Test activity',
          created_at: new Date().toISOString(),
          user_id: 'user-1',
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [mockActivity], error: null }),
        });

        const result = await service.getActivities('contact', 'contact-1');
        expect(result).toEqual([mockActivity]);
      });
    });
  });

  describe('Communication Records', () => {
    describe('getCommunicationRecords', () => {
      it('should return communication records successfully', async () => {
        const mockRecord = {
          id: 'record-1',
          contact_id: 'contact-1',
          type: 'email',
          direction: 'outgoing',
          subject: 'Test email',
          timestamp: new Date().toISOString(),
          user_id: 'user-1',
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [mockRecord], error: null }),
        });

        const result = await service.getCommunicationRecords('contact-1');
        expect(result).toEqual([mockRecord]);
      });
    });
  });

  describe('Settings Operations', () => {
    describe('getSetting', () => {
      it('should return setting value successfully', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { value: 'test-value' }, error: null }),
        });

        const result = await service.getSetting('test-key', 'user-1');
        expect(result).toBe('test-value');
      });

      it('should return default value when setting not found', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        });

        const result = await service.getSetting('test-key', 'user-1');
        expect(result).toBeNull();
      });
    });

    describe('saveSetting', () => {
      it('should save setting successfully', async () => {
        mockSupabase.from.mockReturnValue({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect(service.saveSetting('test-key', 'test-value', 'user-1')).resolves.toBeUndefined();
      });
    });

    describe('deleteSetting', () => {
      it('should delete setting successfully', async () => {
        mockSupabase.from.mockReturnValue({
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect(service.deleteSetting('test-key', 'user-1')).resolves.toBeUndefined();
      });
    });
  });

  describe('AI Usage Metrics', () => {
    describe('getAIUsageMetrics', () => {
      it('should return AI usage metrics successfully', async () => {
        const mockMetric = {
          id: 'metric-1',
          user_id: 'user-1',
          model: 'gpt-4',
          tokens_used: 1000,
          cost: 0.02,
          created_at: new Date().toISOString(),
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [mockMetric], error: null }),
        });

        const result = await service.getAIUsageMetrics('user-1', 50);
        expect(result).toEqual([mockMetric]);
      });
    });
  });

  describe('Authentication', () => {
    describe('getCurrentUser', () => {
      it('should return current user', async () => {
        const mockUser = { id: 'user-1', email: 'user@example.com' };
        mockSupabase.auth.getUser = jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null });

        const result = await service.getCurrentUser();
        expect(result).toEqual(mockUser);
      });
    });

    describe('signOut', () => {
      it('should sign out successfully', async () => {
        mockSupabase.auth.signOut = jest.fn().mockResolvedValue({ error: null });

        await expect(service.signOut()).resolves.toBeUndefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await service.getContacts();
      expect(result).toEqual([]);
    });

    it('should handle Supabase errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Supabase error')),
      });

      const result = await service.getContacts();
      expect(result).toEqual([]);
    });
  });

  describe('Offline Support', () => {
    it('should cache data when online', async () => {
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      const mockDeals = [{ id: 'deal-1', title: 'Test Deal' }];
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockDeals, error: null }),
      });

      await service.getDeals();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('deals_backup', JSON.stringify(mockDeals));
    });

    it('should return cached data when offline', async () => {
      const mockDeals = [{ id: 'deal-1', title: 'Test Deal' }];
      const mockLocalStorage = {
        getItem: jest.fn().mockReturnValue(JSON.stringify(mockDeals)),
        setItem: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      // Simulate offline by making Supabase fail
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      const result = await service.getDeals();
      expect(result).toEqual(mockDeals);
    });
  });
});