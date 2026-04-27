import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import schemas and resolvers
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';

// Import middleware
import { restRoutes } from './rest/routes';
import { webhookRoutes } from './webhooks/routes';
import { integrationRoutes } from './integrations/routes';

// Import services
import { initializeDatabase } from './services/database';
import { initializeWebhooks } from './webhooks/service';
import { initializeIntegrations } from './integrations/service';
import { initializeSync } from './sync/service';
import { featureFlags } from './features/flags';

dotenv.config();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function startServer() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize database connection
  await initializeDatabase();

  // GraphQL Schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Apollo Server setup
  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      // Extract user from JWT token
      const token = req.headers.authorization?.replace('Bearer ', '');
      let user = null;

      if (token) {
        try {
          user = jwt.verify(token, JWT_SECRET);
        } catch (error) {
          console.error('Invalid token:', error);
        }
      }

      return { user, featureFlags };
    },
    introspection: true, // Enable GraphQL playground
    playground: true,
  });

  await server.start();

  // Apply GraphQL middleware
  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: false // disabled because we already set cors
  });

  // REST API routes
  app.use('/api/v1', restRoutes);

  // Webhook routes
  app.use('/webhooks', webhookRoutes);

  // Integration routes
  app.use('/integrations', integrationRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // API Documentation (Swagger)
  if (featureFlags.isEnabled('api_documentation')) {
    const swaggerSpec = require('./docs/swagger').default;
    app.use('/api-docs', require('swagger-ui-express').serve, require('swagger-ui-express').setup(swaggerSpec));
  }

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      console.log('Received:', message.toString());
      // Handle WebSocket messages for real-time sync
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Initialize services
  await initializeWebhooks();
  await initializeIntegrations();
  await initializeSync();

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`);
    console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`📚 API documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🔗 REST API: http://localhost:${PORT}/api/v1`);
    console.log(`🎣 Webhooks: http://localhost:${PORT}/webhooks`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});