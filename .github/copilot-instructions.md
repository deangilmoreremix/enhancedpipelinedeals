# SmartCRM AI Sales OS - AI Agent Instructions

## Project Overview

SmartCRM is a production-ready AI-powered CRM with 71 React components, 25 service modules, and 14 autonomous SDR agents. The system features intelligent AI routing (GPT-5 primary, Gemini fallback), real-time collaboration via Supabase, and a hybrid data sync architecture with automatic offline support.

## Architecture Patterns

### AI Gateway Service (`src/services/aiGatewayService.ts`)
All AI requests MUST route through `aiGatewayService` - never call OpenAI/Gemini APIs directly. The gateway:
- Routes to Supabase Edge Functions (`/functions/v1/ai-gateway`) to keep API keys secure
- Automatically handles provider failover (GPT-5 → Gemini models)
- Uses `import.meta.env.VITE_*` variables (never hardcode keys)

Example:
```typescript
const response = await aiGatewayService.makeRequest({
  provider: 'openai',
  model: 'gpt-5',
  taskType: 'contact-analysis',
  aiRequestData: { /* your data */ }
});
```

### Unified Button System (`src/hooks/useButtonActions.ts`)
**Critical**: Use `UnifiedActionButton` and `useButtonActions` hook for ALL interactive buttons:
- 25+ pre-registered actions in `src/components/ui/ButtonRegistry.tsx`
- Automatic analytics tracking, accessibility, and permission checking
- See `BUTTON_USAGE_GUIDELINES.md` for complete migration guide

```typescript
const { executeAction } = useButtonActions({ deal, contact, onUpdateDeal });
<UnifiedActionButton action="email-ai" deal={deal} contact={contact} />
```

## SDR Agent Integration (`src/lib/agents/sdr/`)

14 specialized autonomous sales agents with context-aware execution:

### Agent Execution Flow
```typescript
// 1. Context-aware button detection in DealDetailView
const showSDRAgents = useMemo(() => {
  if (deal.notes?.includes('competitor')) return ['sdr-competitor-aware'];
  if (deal.stage === 'negotiation') return ['sdr-objection-handling'];
  if (deal.lastActivity > 7) return ['sdr-follow-up'];
  return ['sdr-data-enrichment', 'sdr-cold-email'];
}, [deal]);

// 2. Netlify function execution
const response = await fetch('/.netlify/functions/sdr-run', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'sdr-follow-up',
    dealId,
    contactId,
    context: { deal, contact }
  })
});

// 3. AgentMail integration for email delivery
const agentMailClient = new AgentMailClient();
await agentMailClient.sendEmail({
  to: contact.email,
  subject: agentResponse.subject,
  html: agentResponse.html,
  agentId: agentId
});
```

### Adding Custom SDR Agents
1. **Create agent implementation** in `src/lib/agents/sdr/`:
```typescript
export const customSDRAgent = {
  id: 'sdr-custom',
  name: 'Custom SDR Agent',
  description: 'Handles specific sales scenarios',
  execute: async (context: SDRContext) => {
    const aiResponse = await aiGatewayService.makeRequest({
      provider: 'openai',
      model: 'gpt-5',
      taskType: 'custom-sdr',
      aiRequestData: context
    });
    return aiResponse;
  }
};
```

2. **Register in registry** (`src/lib/agents/sdr/registry.ts`):
```typescript
export const sdrAgentRegistry: Record<string, any> = {
  // ... existing agents
  "sdr-custom": customSDRAgent,
};
```

3. **Add to Netlify function** (`netlify/functions/sdr-run.ts`):
```typescript
case 'sdr-custom':
  result = await customSDRAgent.execute(context);
  break;
```

### AgentMail Integration
- **Webhook Handler**: `supabase/functions/agentmail/webhook/index.ts`
- **Client Library**: `src/lib/agentmailClient.ts`
- **Webhook Registration**: `scripts/registerAgentMailWebhook.ts`
- **Email Delivery**: All SDR agents use AgentMail for production email sending

## Database Schema Patterns

### Supabase Table Structure
Core tables follow consistent patterns:

#### Deals Table
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT,
  value DECIMAL(10,2),
  stage TEXT CHECK (stage IN ('prospect', 'qualified', 'proposal', 'negotiation', 'closed')),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  contact_id UUID REFERENCES contacts(id),
  user_id UUID REFERENCES auth.users(id),
  ai_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own deals" ON deals
  FOR ALL USING (auth.uid() = user_id);
```

#### Real-Time Subscriptions
```typescript
// In supabaseService.ts
subscribeToDealChanges(callback: (deal: Deal) => void) {
  return this.supabase
    .channel('deal-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'deals'
    }, callback)
    .subscribe();
}
```

### Migration Patterns
- **Schema changes**: Update `supabase/schema.sql`
- **Type generation**: `supabase gen types typescript --local > src/types/supabase.ts`
- **Migrations**: Use `supabase db diff` for incremental changes
- **Seed data**: `supabase/seed.sql` for initial data

### Hybrid Sync Architecture
```typescript
// Automatic fallback pattern
async getDeals(): Promise<Deal[]> {
  if (this.isConnected) {
    try {
      const { data } = await this.supabase.from('deals').select('*');
      localStorage.setItem('deals_backup', JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn('Supabase offline, using localStorage');
      return JSON.parse(localStorage.getItem('deals_backup') || '[]');
    }
  }
  return JSON.parse(localStorage.getItem('deals_backup') || '[]');
}
```

## Testing Strategy Details

### Test File Organization
```
src/tests/
├── components/          # Component tests
│   ├── ButtonRegistry.test.tsx
│   └── UnifiedActionButton.test.tsx
├── services/           # Service layer tests
│   ├── aiGatewayService.test.ts
│   └── supabaseService.test.ts
├── hooks/             # Custom hook tests
│   └── useButtonActions.test.ts
├── agents/            # SDR agent tests
│   └── sdr/
└── utils/             # Utility function tests
```

### Mocking Patterns
```typescript
// Supabase mocking
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: [{}], error: null }),
      update: jest.fn().mockResolvedValue({ data: [{}], error: null }),
      delete: jest.fn().mockResolvedValue({ data: null, error: null })
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis()
    }))
  }))
}));

// AI Gateway mocking
jest.mock('../services/aiGatewayService', () => ({
  makeRequest: jest.fn().mockResolvedValue({
    provider: 'openai',
    model: 'gpt-5',
    response: 'Mock AI response'
  })
}));
```

### Component Testing Patterns
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedActionButton } from '../components/ui/UnifiedActionButton';

describe('UnifiedActionButton', () => {
  it('executes action on click', async () => {
    const mockExecuteAction = jest.fn();
    const mockUseButtonActions = jest.spyOn(require('../hooks/useButtonActions'), 'useButtonActions');
    mockUseButtonActions.mockReturnValue({ executeAction: mockExecuteAction });

    render(<UnifiedActionButton action="email-ai" deal={mockDeal} contact={mockContact} />);
    
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mockExecuteAction).toHaveBeenCalledWith('email-ai'));
  });
});
```

### Coverage Targets
- **Components**: >80% coverage (focus on user interactions)
- **Services**: >90% coverage (critical business logic)
- **Hooks**: >85% coverage (state management logic)
- **Agents**: >75% coverage (AI integration testing)
- **Overall**: >70% target with `npm run test:coverage`

### Test Execution
```bash
npm run test                    # Run all tests
npm run test:coverage          # Generate coverage report
npm run test -- --watch        # Watch mode for development
npm run test -- --testPathPattern=services  # Run specific test group
```

### Supabase Hybrid Sync (`src/services/supabaseService.ts`)
Data operations automatically fallback to localStorage when offline:
- Always use `supabaseService.{getDeals|addDeal|updateDeal|deleteContact}` methods
- Never call `supabase.from()` directly - the service handles connection detection
- Real-time subscriptions: `subscribeToDealChanges()`, `subscribeToContactChanges()`
- Connection status: Check `supabaseService.isConnected` before optional operations

## Critical Workflows

### Development Commands
```bash
npm run dev                  # Start Vite dev server (port 5173)
npm run build               # Production build + sitemap generation
npm run test                # Jest unit tests
npm run test:coverage       # Coverage report → coverage/lcov-report/index.html
npm run lint:fix            # Auto-fix ESLint issues
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Required variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Optional: `VITE_OPENAI_API_KEY` (enables AI), `VITE_GEMINI_API_KEY` (fallback)
4. Frontend uses `VITE_*` prefix; Netlify functions use direct env vars

### Netlify Functions (`/netlify/functions/`)
Serverless functions deployed to production:
- `pipelineAI.ts` - Full pipeline AI analysis
- `sdr-run.ts` - SDR agent execution engine
- `agentmail-webhook.ts` - AgentMail webhook handler
- Functions use `OPENAI_API_KEY` and `SUPABASE_SERVICE_KEY` (no VITE_ prefix)

## Component Patterns

### State Management (Zustand)
Two main stores in `src/store/`:
- `dealStore.ts` - Deals, pipeline view mode, filters
- `contactStore.ts` - Contacts, search, favorites

Access via hooks:
```typescript
const deals = useDealStore(state => state.deals);
const addDeal = useDealStore(state => state.addDeal);
```

### AI Panel Components
10+ specialized AI panels (`src/components/`):
- `AutopilotPanel` - Autonomous sales automation
- `SDRAgentsPanel` - 14 SDR agent dashboard
- `MemoryPanel` - Context retention system
- `VoiceAgentPanel` - AI voice messaging
- `HeatmapPanel` - Deal performance analytics

All follow pattern: State hooks → AI service calls → Loading states → Results display

### Supabase Edge Functions (`/supabase/functions/`)
Local development: `supabase functions serve`
- `automation-engine/index.ts` - Workflow automation orchestrator
- Uses Deno runtime (not Node.js)
- Import from `https://esm.sh/` for external packages

## Project-Specific Conventions

### TypeScript Types
- `src/types/index.ts` - Deal, Activity, Pipeline types
- `src/types/contact.ts` - Contact, ContactPsychology types
- All components must have explicit types (no implicit `any`)

### Service Layer Pattern
Services in `src/services/` are singletons with factory functions:
```typescript
// ❌ Don't: new OpenAIService()
// ✅ Do: getOpenAIService()
const aiService = getEnhancedOpenAIService();
```

### Error Handling
- All async operations wrapped in try-catch
- User-facing errors: Toast notifications via `errorReportingService`
- Log context: `console.error('[ServiceName]:', error)`

### CSS & Styling
- **Only use Tailwind classes** - no custom CSS files
- Dark mode: `dark:` prefix (theme controlled by `useDarkMode` hook)
- Responsive: Mobile-first (`sm:`, `md:`, `lg:`, `xl:`)
- Animations: Tailwind's `transition-all duration-200`

### Testing Standards
Jest with React Testing Library:
- Test files: `*.test.ts(x)` in `src/tests/`
- Mock Supabase: `jest.mock('@supabase/supabase-js')`
- Run before PRs: `npm run test:coverage` (aim for >70%)

## Key Files to Reference

- **Button System**: `BUTTON_USAGE_GUIDELINES.md` - Complete button architecture
- **SDR Integration**: `SDR_AGENT_INTEGRATION_COMMIT.md` - Agent system design
- **AI Panels**: `AI_PANELS_ECOSYSTEM_COMMIT.md` - Panel implementation patterns
- **Test Report**: `COMPREHENSIVE_TEST_REPORT.md` - Testing strategy
- **README**: Exhaustive feature documentation and setup guide

## Common Pitfalls

1. **AI API Keys in Frontend**: Never use API keys directly - always route through `aiGatewayService`
2. **Direct Supabase Calls**: Use `supabaseService` wrapper to get automatic offline fallback
3. **Button Duplication**: Don't create custom buttons - use `UnifiedActionButton` with registered actions
4. **Missing Error Boundaries**: Wrap components with `ErrorBoundary` for production resilience
5. **Hardcoded Env Values**: Always use `import.meta.env.VITE_*` for configuration
6. **Ignoring Dark Mode**: Test all UI changes in both light and dark themes

## AI Development Guidelines

- **AI Scoring**: Use `aiFunctionOrchestrator` for batch operations, not individual calls
- **Citation Tracking**: Always store citations via `citationService` when AI generates factual content
- **Web Search**: Route through `webSearchService` for research - includes credibility scoring
- **AgentMail**: SDR agents use AgentMail for email delivery - see `src/lib/agentmailClient.ts`

## Quick Reference

**Add new service**: Create in `src/services/`, export factory function, follow singleton pattern  
**Add new AI panel**: Use existing panels as template, integrate with appropriate service layer  
**Add new SDR agent**: Extend `base.ts` interface, register in `sdr/registry.ts`, add to `sdr-run.ts` switch  
**Update database schema**: Modify `supabase/schema.sql`, sync types in `src/types/`  
**Deploy**: Commits to `main` auto-deploy via Netlify (build + functions)
