import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockFetch = jest.fn() as jest.Mock<(...a: any[]) => Promise<any>>;
let demo = false;
jest.mock('../services/aiClient', () => ({ authedFetch: (...a: unknown[]) => (mockFetch as any)(...a) }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { __resetDemoKeys, createApiKey, curlExamples, keyStatus, listApiKeys, revokeApiKey, validateKeyInput } from '../services/apiKeyService';

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

describe('apiKeyService', () => {
  beforeEach(() => { mockFetch.mockReset(); demo = false; __resetDemoKeys(); });

  it('validates name and scopes', () => {
    expect(validateKeyInput('', ['read'])).toMatch(/name/i);
    expect(validateKeyInput('x'.repeat(61), ['read'])).toMatch(/60/);
    expect(validateKeyInput('ok', [])).toMatch(/scope/i);
    expect(validateKeyInput('ok', ['admin'])).toMatch(/unknown/i);
    expect(validateKeyInput(' ok ', ['read', 'write'])).toBeNull();
  });

  it('creates a key through POST /api/keys and returns the plaintext once', async () => {
    mockFetch.mockResolvedValueOnce(res(201, { ok: true, id: 'k1', name: 'Zap', prefix: 'abcd1234', scopes: ['read'], key: 'cb_live_abcd1234SECRET' }));
    const k = await createApiKey('  Zap ', ['read']);
    expect(mockFetch).toHaveBeenCalledWith('/api/keys', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Zap', scopes: ['read'] }) }));
    expect(k.key).toBe('cb_live_abcd1234SECRET');
    expect(k.prefix).toBe('abcd1234');
  });

  it('surfaces server errors and refuses a response without a key', async () => {
    mockFetch.mockResolvedValueOnce(res(403, { ok: false, error: 'Admin or manager role required' }));
    await expect(createApiKey('Zap', ['read'])).rejects.toThrow('Admin or manager role required');
    mockFetch.mockResolvedValueOnce(res(201, { ok: true, id: 'k' }));
    await expect(createApiKey('Zap', ['read'])).rejects.toThrow(/did not return a key/);
  });

  it('lists keys from either {keys} or {data} and never exposes a key field', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { ok: true, keys: [{ id: 'a', name: 'A', prefix: 'p', scopes: ['read'], created_at: 't', last_used_at: null, revoked_at: null, key_hash: 'zzz' }] }));
    const rows = await listApiKeys();
    expect(rows[0]).not.toHaveProperty('key_hash');
    expect(rows[0]).not.toHaveProperty('key');
    mockFetch.mockResolvedValueOnce(res(200, { data: [{ id: 'b', name: 'B', prefix: 'q', scopes: ['write'], created_at: 't' }] }));
    expect((await listApiKeys())[0].id).toBe('b');
  });

  it('revokes via DELETE /api/keys?id=', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { ok: true }));
    await revokeApiKey('a b');
    expect(mockFetch).toHaveBeenCalledWith('/api/keys?id=a%20b', { method: 'DELETE' });
    mockFetch.mockResolvedValueOnce(res(404, { error: 'API key not found' }));
    await expect(revokeApiKey('x')).rejects.toThrow('API key not found');
  });

  it('demo mode keeps keys in memory without calling the server', async () => {
    demo = true;
    const k = await createApiKey('Demo', ['read']);
    expect(k.key.startsWith('cb_live_')).toBe(true);
    expect((await listApiKeys())).toHaveLength(1);
    await revokeApiKey(k.id);
    expect(keyStatus((await listApiKeys())[0])).toBe('revoked');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('builds curl examples that target /api/v1/deals', () => {
    const ex = curlExamples('https://app.example.com');
    expect(ex.every(e => e.code.includes('https://app.example.com/api/v1/deals'))).toBe(true);
    expect(ex.every(e => e.code.includes('Authorization: Bearer'))).toBe(true);
  });
});
