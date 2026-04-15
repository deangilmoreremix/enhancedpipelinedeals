// Jest setup file for environment mocking
import '@testing-library/jest-dom';

// Mock import.meta.env for Vite compatibility
const mockImportMeta = {
  env: {
    VITE_SUPABASE_URL: 'test-supabase-url',
    VITE_SUPABASE_ANON_KEY: 'test-supabase-anon-key',
    VITE_OPENAI_API_KEY: 'test-openai-key',
    VITE_GEMINI_API_KEY: 'test-gemini-key',
    VITE_SENDGRID_API_KEY: 'test-sendgrid-key',
    VITE_FROM_EMAIL: 'test@example.com',
    VITE_CRM_API_URL: 'test-crm-url',
    VITE_CRM_API_KEY: 'test-crm-key',
    VITE_WEB_SEARCH_API_KEY: 'test-search-key',
    VITE_WEB_SEARCH_PROVIDER: 'serpapi',
    ENVIRONMENT: 'test',
    AGENTMAIL_API_KEY: 'test-agentmail-key',
    PUBLIC_API_URL: 'https://test-api.example.com',
    VITE_GEMINI_MODEL: 'gemma-2-27b-it',
    VITE_GPT5_MODEL: 'gpt-5',
    VITE_GPT5_REASONING_EFFORT: 'medium',
    VITE_OPENAI_MODEL: 'gpt-5'
  }
};

// Mock import.meta on the global object
(global as any).import = { meta: mockImportMeta };

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock File and FileReader for tests
global.File = class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;

  constructor(bits: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = bits.reduce((acc, bit) => acc + (typeof bit === 'string' ? bit.length : bit.size || 0), 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
} as any;

global.FileReader = class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;

  readAsDataURL(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: {
            result: `data:${file.type};base64,testdata`
          }
        });
      }
    }, 10);
  }

  abort() {
    if (this.onabort) {
      this.onabort(new Event('abort'));
    }
  }
} as any;