/**
 * Security Configuration for Production Hardening
 * Implements Content Security Policy, security headers, and other security measures
 */

interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

interface SecurityConfig {
  csp: CSPDirectives;
  headers: Record<string, string>;
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  apiKeys: {
    rotationInterval: number; // days
    maxAge: number; // days
  };
}

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

// Content Security Policy configuration
const cspConfig: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for some React features, consider removing in production
    "'unsafe-eval'", // Required for some bundlers, consider removing in production
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : [])
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components, consider removing
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net"
  ],
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https://images.unsplash.com",
    "https://avatars.githubusercontent.com",
    "https://*.supabase.co",
    "https://*.openai.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "https://cdn.jsdelivr.net"
  ],
  'connect-src': [
    "'self'",
    "https://api.openai.com",
    "https://generativelanguage.googleapis.com",
    "https://*.supabase.co",
    "https://api.sendgrid.com",
    "https://*.serpapi.com",
    "https://*.googleapis.com",
    "https://*.bing.com",
    ...(isDevelopment ? ["http://localhost:*", "ws://localhost:*"] : [])
  ],
  'media-src': [
    "'self'",
    "blob:",
    "https://*.supabase.co"
  ],
  'object-src': ["'none'"],
  'frame-src': [
    "'self'",
    "https://www.youtube.com",
    "https://player.vimeo.com"
  ],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': isProduction,
  'block-all-mixed-content': isProduction
};

// Generate CSP header string
const generateCSPHeader = (directives: CSPDirectives): string => {
  const cspString = Object.entries(directives)
    .map(([directive, values]) => {
      if (typeof values === 'boolean') {
        return values ? directive : null;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .filter(Boolean)
    .join('; ');

  return cspString;
};

// Security headers configuration
const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ].join(', '),
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin'
};

// Add CSP header
securityHeaders['Content-Security-Policy'] = generateCSPHeader(cspConfig);

// CORS configuration
const corsConfig = {
  origins: isProduction
    ? [
        "https://yourdomain.com",
        "https://app.yourdomain.com",
        "https://*.yourdomain.com"
      ]
    : [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
      ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true
};

// Rate limiting configuration
const rateLimitingConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // requests per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false
};

// API key management configuration
const apiKeyConfig = {
  rotationInterval: 90, // days
  maxAge: 365 // days
};

// Complete security configuration
export const securityConfig: SecurityConfig = {
  csp: cspConfig,
  headers: securityHeaders,
  cors: corsConfig,
  rateLimiting: rateLimitingConfig,
  apiKeys: apiKeyConfig
};

// Utility functions
export const getSecurityHeaders = (): Record<string, string> => {
  return { ...securityConfig.headers };
};

export const getCSPHeader = (): string => {
  return securityConfig.headers['Content-Security-Policy'];
};

export const isOriginAllowed = (origin: string): boolean => {
  return securityConfig.cors.origins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace('*', '.*');
      return new RegExp(pattern).test(origin);
    }
    return allowedOrigin === origin;
  });
};

export const validateAPIKey = (apiKey: string, createdAt: Date): boolean => {
  const now = new Date();
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  return ageInDays <= securityConfig.apiKeys.maxAge;
};

export const shouldRotateAPIKey = (createdAt: Date): boolean => {
  const now = new Date();
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  return ageInDays >= securityConfig.apiKeys.rotationInterval;
};

// Security middleware for API routes (if using a backend)
export const createSecurityMiddleware = () => {
  return (req: any, res: any, next: any) => {
    // Set security headers
    Object.entries(securityConfig.headers).forEach(([header, value]) => {
      res.setHeader(header, value);
    });

    // CORS handling
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', securityConfig.cors.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', securityConfig.cors.headers.join(', '));
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    next();
  };
};

// Client-side security utilities
export const sanitizeHTML = (html: string): string => {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
};

export const validateFileUpload = (file: File): boolean => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];

  const maxSize = 10 * 1024 * 1024; // 10MB

  return allowedTypes.includes(file.type) && file.size <= maxSize;
};

export const generateSecureRandom = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};