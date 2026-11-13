import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIEmailComposer } from '../components/AIEmailComposer';

jest.mock('../services/aiClient', () => ({
  authHeader: async () => ({ Authorization: 'Bearer t' }),
  authedFetch: (...a: any[]) => (global as any).fetch(...a),
  callAI: jest.fn(),
}));
jest.mock('../components/ui/PersonaSelector', () => ({ PersonaSelector: () => null }));

const enc = (s: string) => new TextEncoder().encode(s);
const streamOf = (chunks: string[]) => {
  let i = 0;
  return { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: enc(chunks[i++]) } : { done: true, value: undefined }) }) };
};
const mockFetch = (res: any) => { (global as any).fetch = jest.fn().mockResolvedValue(res); };
const generate = () => fireEvent.click(screen.getByText(/Generate Email/));
const box = () => screen.getByPlaceholderText(/Start typing your email/) as HTMLTextAreaElement;

describe('AIEmailComposer streaming', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  it('streams content frames into the textarea (frames split across chunks)', async () => {
    mockFetch({ ok: true, status: 200, body: streamOf(['data: {"content":"Hel', 'lo"}\n\ndata: {"content":" there"}\n\n', 'data: [DONE]\n\n']) });
    render(<AIEmailComposer contactId="c1" initialContent="old draft" />);
    generate();
    await waitFor(() => expect(box().value).toBe('Hello there'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces an {"error"} SSE frame inline and keeps the existing draft', async () => {
    mockFetch({ ok: true, status: 200, body: streamOf(['data: {"content":"partial"}\n\n', 'data: {"error":"model overloaded"}\n\n', 'data: [DONE]\n\n']) });
    render(<AIEmailComposer contactId="c1" initialContent="my draft" />);
    generate();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('model overloaded');
    expect(box().value).toBe('my draft');
  });

  it('shows the server error message for a non-OK response and keeps the draft', async () => {
    mockFetch({ ok: false, status: 429, body: {}, json: async () => ({ error: 'Rate limit exceeded' }) });
    render(<AIEmailComposer contactId="c1" initialContent="keep me" />);
    generate();
    expect(await screen.findByRole('alert')).toHaveTextContent('Rate limit exceeded');
    expect(box().value).toBe('keep me');
  });

  it('falls back to a status message when the error body is not JSON, and handles network failures', async () => {
    mockFetch({ ok: false, status: 502, body: null, json: async () => { throw new Error('not json'); } });
    const { unmount } = render(<AIEmailComposer contactId="c1" initialContent="d" />);
    generate();
    expect(await screen.findByRole('alert')).toHaveTextContent('Compose failed (502)');
    unmount();

    (global as any).fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    render(<AIEmailComposer contactId="c1" initialContent="d2" />);
    generate();
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(box().value).toBe('d2');
  });

  it('clears a previous error on the next attempt', async () => {
    mockFetch({ ok: false, status: 500, body: {}, json: async () => ({ error: 'boom' }) });
    render(<AIEmailComposer contactId="c1" initialContent="x" />);
    generate();
    await screen.findByRole('alert');
    mockFetch({ ok: true, status: 200, body: streamOf(['data: {"content":"ok"}\n\n']) });
    generate();
    await waitFor(() => expect(box().value).toBe('ok'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
