import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Twenty CRM API',
      version: '1.0.0',
      description: 'Unified API for Twenty CRM with GraphQL and REST endpoints',
      contact: {
        name: 'Twenty CRM Support',
        email: 'support@twenty.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api.twenty.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Deal: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            company: { type: 'string' },
            contact: { type: 'string' },
            contactId: { type: 'string', format: 'uuid' },
            assignedToId: { type: 'string', format: 'uuid' },
            assignedTo: { type: 'string' },
            value: { type: 'number', format: 'float' },
            stage: {
              type: 'string',
              enum: ['qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
            },
            probability: { type: 'number', format: 'float', minimum: 0, maximum: 100 },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            dueDate: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
            customFields: { type: 'object' },
          },
          required: ['company', 'contact', 'value', 'stage', 'probability', 'priority'],
        },
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            company: { type: 'string' },
            position: { type: 'string' },
            avatar: { type: 'string', format: 'uri' },
            tags: { type: 'array', items: { type: 'string' } },
            customFields: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['name', 'email'],
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            secret: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            lastTriggered: { type: 'string', format: 'date-time' },
            failureCount: { type: 'integer' },
          },
          required: ['name', 'url', 'events', 'secret'],
        },
        Integration: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string' },
            config: { type: 'object' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            lastSync: { type: 'string', format: 'date-time' },
            syncStatus: { type: 'string' },
          },
          required: ['name', 'type', 'config'],
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'integer' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/rest/routes.ts'], // Path to the API routes
};

export default swaggerJsdoc(options);