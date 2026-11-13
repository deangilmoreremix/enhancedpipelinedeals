// Standalone OpenAI connectivity test using the Responses API (server-side key).
// Run with:  node --env-file=.env.local scripts/test-openai.mjs
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL_DEFAULT || 'gpt-6.1-sol';

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY — set it in .env.local (server-side only, never VITE_)');
  process.exit(1);
}

console.log(`Testing OpenAI Responses API with model "${model}" ...`);

const res = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    instructions: 'You are a CRM assistant.',
    input: 'In 6 words, confirm the API works.',
    reasoning: { effort: 'low' },
    max_output_tokens: 200,
    store: false,
  }),
});

console.log('HTTP status:', res.status);
const data = await res.json();

if (!res.ok) {
  console.error('OpenAI request failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}

const text = data.output_text ?? data.output?.flatMap((o) => o.content ?? []).map((c) => c.text).filter(Boolean).join('') ?? '';
console.log('SUCCESS. Model replied:');
console.log(text || '(no content)');
console.log('usage:', JSON.stringify(data.usage));
