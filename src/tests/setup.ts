// Jest setup file for environment mocking
import { jest } from '@jest/globals';

// Mock import.meta.env
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_SUPABASE_URL: 'test-supabase-url',
        VITE_SUPABASE_ANON_KEY: 'test-supabase-anon-key',
        VITE_OPENAI_API_KEY: 'test-openai-key',
        VITE_GEMINI_API_KEY: 'test-gemini-key',
        // Add other environment variables as needed
      }
    }
  }
});

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