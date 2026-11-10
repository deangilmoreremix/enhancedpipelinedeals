/** @jest-environment node */
const create: any = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    responses = { create: (...a: any[]) => create(...a) };
  },
}));

process.env.OPENAI_API_KEY = 'test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod: any = require('../../netlify/functions/_openai');

describe('Responses API helper', () => {
  beforeEach(() => create.mockReset());

  it('builds Responses-shaped params (instructions/input/text.format, no temperature with reasoning)', () => {
    const p = mod.buildParams({
      tier: 'default',
      instructions: 'sys',
      input: 'hi',
      temperature: 0.2,
      jsonSchema: { name: 'x', schema: { type: 'object', properties: {}, required: [], additionalProperties: false } },
    });
    expect(p.model).toBe('gpt-6.1-sol');
    expect(p.instructions).toBe('sys');
    expect(p.input).toBe('hi');
    expect(p.messages).toBeUndefined();
    expect(p.temperature).toBeUndefined();
    expect(p.reasoning.effort).toBe('medium');
    expect(p.text.format).toMatchObject({ type: 'json_schema', name: 'x', strict: true });
  });

  it('never sends effort none to astra/sol and maps minimal to low', () => {
    expect(mod.normalizeEffort('gpt-6-astra', 'none')).toBe('low');
    expect(mod.normalizeEffort('gpt-6.1-sol', 'minimal')).toBe('low');
    expect(mod.normalizeEffort('gpt-6-luna', 'none')).toBe('none');
  });

  it('allows temperature only when effort is none', () => {
    const p = mod.buildParams({ tier: 'fast', input: 'x', temperature: 0.3 });
    expect(p.reasoning.effort).toBe('none');
    expect(p.temperature).toBe(0.3);
  });

  it('parses JSON output and exposes output_text', async () => {
    create.mockResolvedValue({ id: 'r1', model: 'm', output_text: '{"a":1}', output: [] });
    const r = await mod.respond({ input: 'x', jsonObject: true });
    expect(r.json).toEqual({ a: 1 });
    expect(r.text).toBe('{"a":1}');
  });

  it('tool loop returns function_call_output items linked by call_id', async () => {
    create
      .mockResolvedValueOnce({
        id: 'r1', model: 'm', output_text: '',
        output: [{ type: 'function_call', call_id: 'c1', name: 'add', arguments: '{"a":1,"b":2}' }],
      })
      .mockResolvedValueOnce({ id: 'r2', model: 'm', output_text: 'done', output: [] });
    const r = await mod.respondWithTools({
      input: 'go',
      tools: [{ type: 'function', name: 'add', parameters: {} }],
      handlers: { add: ({ a, b }: any) => ({ sum: a + b }) },
    });
    expect(r.text).toBe('done');
    const second = create.mock.calls[1][0];
    expect(second.input).toContainEqual({ type: 'function_call_output', call_id: 'c1', output: '{"sum":3}' });
  });

  it('extracts citations from url_citation annotations and web_search sources (deduplicated)', () => {
    const out = [
      { type: 'web_search_call', action: { type: 'search', sources: [{ url: 'https://a.com/x', title: 'A' }, { url: 'https://b.com' }] } },
      { type: 'message', content: [{ annotations: [{ type: 'url_citation', url: 'https://a.com/x', title: 'A page' }, { type: 'url_citation', url: 'https://c.com', title: 'C' }] }] },
    ];
    const c = mod.extractCitations(out);
    expect(c.map((x: any) => x.url).sort()).toEqual(['https://a.com/x', 'https://b.com', 'https://c.com']);
    expect(c.find((x: any) => x.url === 'https://a.com/x').title).toBe('A page');
  });

  it('passes include and web_search tool through to the request', () => {
    const p = mod.buildParams({
      input: 'x',
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      toolChoice: 'required',
      include: ['web_search_call.action.sources'],
    });
    expect(p.include).toEqual(['web_search_call.action.sources']);
    expect(p.tool_choice).toBe('required');
    expect(p.tools[0].type).toBe('web_search');
  });
});
