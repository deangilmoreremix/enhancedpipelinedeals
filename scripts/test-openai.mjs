// Standalone OpenAI connectivity test — mirrors the request shape used by
// src/services/realOpenAIService.ts (chat/completions). Run with:
//   node --env-file=.env.local scripts/test-openai.mjs
const apiKey = process.env.VITE_OPENAI_API_KEY;
const model = process.env.VITE_OPENAI_MODEL || 'gpt-4o';

if (!apiKey) {
  console.error('Missing VITE_OPENAI_API_KEY — set it in .env.local');
  process.exit(1);
}

console.log(`Testing OpenAI model "${model}" ...`);

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'You are a CRM assistant.' },
      { role: 'user', content: 'In 6 words, confirm the API works.' }
    ],
    max_tokens: 50
  })
});

console.log('HTTP status:', res.status);
const data = await res.json();

if (!res.ok) {
  console.error('OpenAI request failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('SUCCESS. Model replied:');
console.log(data.choices?.[0]?.message?.content ?? '(no content)');
console.log('usage:', JSON.stringify(data.usage));
