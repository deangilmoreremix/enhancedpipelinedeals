// Mock for supabaseService.ts
const mockSupabase = {
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
};

const mockService = {
  supabase: mockSupabase,
  getContacts: jest.fn(),
  createContact: jest.fn(),
  updateContact: jest.fn(),
  deleteContact: jest.fn(),
  getDeals: jest.fn(),
  createDeal: jest.fn(),
  updateDeal: jest.fn(),
  deleteDeal: jest.fn(),
  getActivities: jest.fn(),
  createActivity: jest.fn(),
};

const SupabaseService = jest.fn().mockImplementation(() => mockService);
const getSupabaseService = jest.fn(() => mockService);

export { SupabaseService, getSupabaseService };