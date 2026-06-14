# Smart CRM - AI-Powered Sales Pipeline & Contact Management

AI-enhanced CRM with pipeline management, deal tracking, gamification, and a user-configurable API key settings flow.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5176`.

## Configuration

### Settings UI
Open the **gear icon** in the header to configure:
- OpenAI API key
- Google AI API key
- Anthropic API key
- Supabase project URL (optional)

Keys are stored in browser `localStorage` and take priority over `.env` values.

### Environment Variables
See `.env.example` for all options. The most important:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`

## Database

Migrations are in `supabase/migrations/`. RLS policies allow anonymous read access where required for demo mode.

## Production Notes

- Replace placeholder API keys with real keys
- Configure proper auth if multi-user access is required
- Keep service role keys server-side only