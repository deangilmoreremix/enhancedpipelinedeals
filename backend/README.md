# Twenty CRM - API & Integration (Phase 9)

This directory contains the backend API implementation for Twenty CRM's Phase 9: API & Integration features.

## Features Implemented

### 1. Unified API Endpoints
- **GraphQL API**: Flexible query language for complex data operations
- **REST API**: Standard RESTful endpoints for integrations
- **Consistent API**: Unified interface across all CRM modules

### 2. Webhook System
- Real-time notifications for cross-module events
- Secure webhook signature validation
- Automatic retry mechanism with exponential backoff
- Webhook management dashboard

### 3. External App Integration
- Pre-built integrations: Slack, HubSpot, Salesforce, Mailchimp, Google Sheets
- OAuth 2.0 authentication flows
- Custom integration framework
- Integration testing and monitoring

### 4. Data Synchronization
- Real-time data sync between CRM modules
- Scheduled synchronization jobs
- Conflict resolution strategies
- Sync status monitoring and reporting

### 5. Auto-Generated Documentation
- Swagger/OpenAPI documentation
- Interactive API playground
- Developer portal with code examples
- SDK generation capabilities

## Project Structure

```
backend/
├── src/
│   ├── graphql/           # GraphQL schema, resolvers, permissions
│   ├── rest/             # REST API routes and controllers
│   ├── webhooks/         # Webhook system implementation
│   ├── integrations/     # External app integrations
│   ├── sync/             # Data synchronization services
│   ├── features/         # Feature flags system
│   ├── docs/             # API documentation
│   ├── services/         # Core business logic services
│   └── middleware/       # Authentication and other middleware
├── .env.example          # Environment variables template
├── nodemon.json          # Development configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase project
- API keys for external integrations (optional)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your environment variables in `.env`

4. Start the development server:
```bash
npm run dev:backend
```

The API will be available at `http://localhost:4000`

## API Endpoints

### GraphQL
- **Endpoint**: `POST /graphql`
- **Playground**: `http://localhost:4000/graphql`

### REST API
- **Base URL**: `/api/v1`
- **Deals**: `/api/v1/deals`
- **Contacts**: `/api/v1/contacts`
- **Webhooks**: `/api/v1/webhooks` (Admin only)
- **Integrations**: `/api/v1/integrations` (Admin only)

### Webhooks
- **Receiver**: `POST /webhooks/receive/:webhookId`
- **Management**: `GET/POST/PUT/DELETE /webhooks`

### Documentation
- **Swagger UI**: `http://localhost:4000/api-docs`

## Authentication

All API endpoints (except webhooks) require JWT authentication:

```
Authorization: Bearer <your-jwt-token>
```

## Feature Flags

The system uses feature flags for gradual rollout:

- `graphql_api`: Enable GraphQL endpoints
- `rest_api`: Enable REST API endpoints
- `webhooks`: Enable webhook system
- `integrations`: Enable external integrations
- `data_sync`: Enable data synchronization
- `api_documentation`: Enable auto-generated docs

## Integration Examples

### Slack Integration
```typescript
// Configure Slack integration
const integration = await createIntegration({
  name: 'Company Slack',
  type: 'slack',
  config: {
    accessToken: 'xoxb-your-slack-token',
    channel: '#deals'
  }
});
```

### Webhook Creation
```typescript
const webhook = await createWebhook({
  name: 'Deal Updates',
  url: 'https://your-app.com/webhooks/deals',
  events: ['deal.created', 'deal.updated'],
  secret: 'your-webhook-secret'
});
```

### GraphQL Query
```graphql
query GetDeals($filter: DealFilter) {
  deals(filter: $filter, pagination: { limit: 10 }) {
    edges {
      node {
        id
        title
        company
        value
        stage
        probability
      }
    }
    totalCount
  }
}
```

## Development

### Scripts
- `npm run dev:backend` - Start development server with hot reload
- `npm run build:backend` - Build for production
- `npm run type-check:backend` - Run TypeScript type checking

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Deployment

1. Build the application:
```bash
npm run build:backend
```

2. Set environment variables for production

3. Start the server:
```bash
npm start
```

## Security

- JWT authentication with configurable expiration
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- Webhook signature verification
- Audit logging for sensitive operations

## Monitoring

- Health check endpoint: `GET /health`
- API metrics and performance monitoring
- Webhook delivery tracking
- Integration sync status monitoring
- Error logging and alerting

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Use feature flags for new functionality
5. Ensure proper error handling and logging

## Support

For questions or issues:
- Check the API documentation at `/api-docs`
- Review the GraphQL playground at `/graphql`
- Contact the development team