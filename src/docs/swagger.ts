import { OpenAPIV3 } from 'openapi-types';

// We build the spec object in code rather than YAML so it stays type-checked.
export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'EVE Healthcare Backend API',
    description:
      'Diagnostic test bookings, simulated payments & idempotent webhook processing.\n\n' +
      '**Auth**: Use `POST /api/v1/auth/login` to get a JWT, then set it via the Authorize button (Bearer token).',
    version: '1.0.0',
    contact: { name: 'EVE Healthcare' },
  },
  servers: [{ url: '/api/v1', description: 'v1 API' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'email: Invalid email address' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 50 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions (ADMIN required)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Conflict: {
        description: 'Conflict (duplicate, invalid state transition)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ValidationError: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Too many requests',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        headers: {
          'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait' },
        },
      },
    },
  },
  paths: {
    // ── Auth ──
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Jane Doe' },
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  password: { type: 'string', minLength: 8, example: 'pass1234' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created with JWT' },
          '409': { $ref: '#/components/responses/Conflict' },
          '422': { $ref: '#/components/responses/ValidationError' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@eve.com' },
                  password: { type: 'string', example: 'admin1234' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'JWT returned' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Centres ──
    '/centres': {
      get: {
        tags: ['Centres'],
        summary: 'List diagnostic centres',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'location', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of centres',
            headers: { 'X-Cache': { schema: { type: 'string', enum: ['HIT', 'MISS'] } } },
          },
        },
      },
      post: {
        tags: ['Centres'],
        summary: 'Create a centre (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'location'],
                properties: {
                  name: { type: 'string', example: 'Apollo Diagnostics' },
                  location: { type: 'string', example: 'Mumbai' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Centre created' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/centres/{id}': {
      get: {
        tags: ['Centres'],
        summary: 'Get centre by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Centre details', headers: { 'X-Cache': { schema: { type: 'string' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Centres'],
        summary: 'Update centre (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  location: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Centre updated' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Centres'],
        summary: 'Delete centre (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Centre deleted' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Centre Tests ──
    '/centres/{id}/tests': {
      get: {
        tags: ['Centre Tests'],
        summary: 'List tests at a centre with prices',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'List of tests at the centre' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Centre Tests'],
        summary: 'Add test to centre with price (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['testId', 'price'],
                properties: {
                  testId: { type: 'string', format: 'uuid' },
                  price: { type: 'number', minimum: 0.01, example: 1500 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Test added to centre' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Diagnostic Tests ──
    '/tests': {
      get: {
        tags: ['Tests'],
        summary: 'List diagnostic tests',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'List of tests' } },
      },
      post: {
        tags: ['Tests'],
        summary: 'Create a test (ADMIN)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'code'],
                properties: {
                  name: { type: 'string', example: 'Complete Blood Count' },
                  code: { type: 'string', example: 'CBC' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Test created' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Bookings ──
    '/bookings': {
      post: {
        tags: ['Bookings'],
        summary: 'Create a booking',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['centreId', 'testId', 'appointmentAt'],
                properties: {
                  centreId: { type: 'string', format: 'uuid' },
                  testId: { type: 'string', format: 'uuid' },
                  appointmentAt: { type: 'string', format: 'date-time', example: '2026-11-15T10:00:00Z' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Booking created' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
          '422': { $ref: '#/components/responses/ValidationError' },
        },
      },
      get: {
        tags: ['Bookings'],
        summary: 'List my bookings',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'] } },
        ],
        responses: { '200': { description: 'Paginated bookings' } },
      },
    },
    '/bookings/{id}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking by ID (own only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Booking details' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/bookings/{id}/cancel': {
      post: {
        tags: ['Bookings'],
        summary: 'Cancel a booking',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Booking cancelled' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },

    // ── Payments ──
    '/payments': {
      post: {
        tags: ['Payments'],
        summary: 'Create a payment for a booking',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bookingId'],
                properties: {
                  bookingId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Payment created' },
          '200': { description: 'Existing payment returned (idempotent)' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/payments/webhook': {
      post: {
        tags: ['Payments'],
        summary: 'Payment webhook (from simulated provider)',
        description: 'Protected by X-Webhook-Secret header. Returns 202 when using BullMQ, 200 when inline.',
        parameters: [
          {
            name: 'X-Webhook-Secret',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Shared webhook secret from env',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['eventId', 'paymentId', 'status'],
                properties: {
                  eventId: { type: 'string', example: 'evt_001' },
                  paymentId: { type: 'string', format: 'uuid' },
                  status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Event processed (inline) or duplicate' },
          '202': { description: 'Event accepted for async processing (BullMQ)' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },

    // ── Admin ──
    '/admin/webhook-events': {
      get: {
        tags: ['Admin'],
        summary: 'List webhook events (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['RECEIVED', 'PROCESSED', 'FAILED'] } },
        ],
        responses: { '200': { description: 'Paginated webhook events' } },
      },
    },
    '/admin/webhook-events/{eventId}/retry': {
      post: {
        tags: ['Admin'],
        summary: 'Retry a failed webhook event (ADMIN)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Event retried' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Centres', description: 'Diagnostic centre management' },
    { name: 'Tests', description: 'Diagnostic test management' },
    { name: 'Centre Tests', description: 'Tests available at a centre (with prices)' },
    { name: 'Bookings', description: 'Booking management' },
    { name: 'Payments', description: 'Payment & webhook processing' },
    { name: 'Admin', description: 'Admin-only endpoints' },
  ],
};
