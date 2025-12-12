/**
 * Tests for Data Sync Service
 * Verifies data synchronization between database and local storage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock supabaseService
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({
    isConnectedToDatabase: jest.fn(() => true),
    getContacts: jest.fn(() => Promise.resolve([])),
    getDeals: jest.fn(() => Promise.resolve([])),
    createContact: jest.fn((contact) => Promise.resolve({ ...contact, id: 'db-contact-1', createdAt: new Date(), updatedAt: new Date() })),
    createDeal: jest.fn((deal) => Promise.resolve({ ...deal, id: 'db-deal-1', createdAt: new Date(), updatedAt: new Date() })),
    updateContact: jest.fn((id, updates) => Promise.resolve({ id, ...updates, updatedAt: new Date() })),
    updateDeal: jest.fn((id, updates) => Promise.resolve({ id, ...updates, updatedAt: new Date() })),
    deleteContact: jest.fn(() => Promise.resolve()),
    deleteDeal: jest.fn(() => Promise.resolve())
  })
}));

import { getDataSyncService } from '../services/dataSyncService';

describe('Data Sync Service', () => {
  let dataSyncService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    dataSyncService = getDataSyncService();
  });

  describe('Contact Operations', () => {
    it('should get contacts combining mock and database data', async () => {
      const result = await dataSyncService.getContacts();

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.isFromDatabase).toBe(true);
    });

    it('should create contact in database when connected', async () => {
      const contactData = {
        name: 'Test Contact',
        email: 'test@example.com',
        company: 'Test Corp'
      };

      const contact = await dataSyncService.createContact(contactData);

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe(contactData.name);
      expect(contact.createdAt).toBeDefined();
      expect(contact.updatedAt).toBeDefined();
    });

    it('should update contact in database', async () => {
      const updates = { name: 'Updated Name' };
      const contact = await dataSyncService.updateContact('db-contact-1', updates);

      expect(contact.name).toBe('Updated Name');
      expect(contact.updatedAt).toBeDefined();
    });

    it('should delete contact from database', async () => {
      await expect(dataSyncService.deleteContact('db-contact-1')).resolves.toBeUndefined();
    });
  });

  describe('Deal Operations', () => {
    it('should get deals combining mock and database data', async () => {
      const result = await dataSyncService.getDeals();

      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
      expect(result.isFromDatabase).toBe(true);
    });

    it('should create deal in database when connected', async () => {
      const dealData = {
        title: 'Test Deal',
        value: 50000,
        stage: 'proposal'
      };

      const deal = await dataSyncService.createDeal(dealData);

      expect(deal.id).toBeDefined();
      expect(deal.title).toBe(dealData.title);
      expect(deal.createdAt).toBeDefined();
      expect(deal.updatedAt).toBeDefined();
    });

    it('should update deal in database', async () => {
      const updates = { title: 'Updated Deal' };
      const deal = await dataSyncService.updateDeal('db-deal-1', updates);

      expect(deal.title).toBe('Updated Deal');
      expect(deal.updatedAt).toBeDefined();
    });

    it('should delete deal from database', async () => {
      await expect(dataSyncService.deleteDeal('db-deal-1')).resolves.toBeUndefined();
    });
  });

  describe('Sync Status', () => {
    it('should provide sync status information', () => {
      const status = dataSyncService.getSyncStatus();

      expect(status).toHaveProperty('contactsConnected');
      expect(status).toHaveProperty('dealsConnected');
      expect(status).toHaveProperty('contactsCount');
      expect(status).toHaveProperty('dealsCount');
      expect(status).toHaveProperty('lastSync');
    });

    it('should check database connection status', () => {
      const isConnected = dataSyncService.isDatabaseConnected();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database disconnection
      const mockSupabase = {
        isConnectedToDatabase: jest.fn(() => false),
        getContacts: jest.fn(() => Promise.reject(new Error('Connection failed'))),
        getDeals: jest.fn(() => Promise.reject(new Error('Connection failed')))
      };

      // Temporarily replace the service
      const originalGetSupabaseService = jest.requireMock('../services/supabaseService').getSupabaseService;
      jest.requireMock('../services/supabaseService').getSupabaseService = () => mockSupabase;

      const result = await dataSyncService.getContacts();

      expect(result.data).toBeDefined();
      expect(result.isFromDatabase).toBe(false);
      expect(result.error).toBeDefined();

      // Restore
      jest.requireMock('../services/supabaseService').getSupabaseService = originalGetSupabaseService;
    });
  });
});