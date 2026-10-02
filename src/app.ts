import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { generalRateLimit } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth.routes';
import centreRoutes from './routes/centre.routes';
import testRoutes from './routes/test.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';

// Swagger
import { swaggerSpec } from './docs/swagger';

const app = express();

// ── Global middleware ──
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(generalRateLimit);

// ── API docs ──
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'EVE Healthcare API Docs',
}));

// ── Health ──
app.use('/health', healthRoutes);

// ── API v1 routes ──
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/centres', centreRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// ── 404 fallback ──
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ── Central error handler (must be last) ──
app.use(errorHandler);

export { app };
