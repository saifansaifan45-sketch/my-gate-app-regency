import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { prisma } from './prisma';
import authRoutes from './routes/auth';
import managerRoutes from './routes/manager';
import ticketsRoutes from './routes/tickets';
import notificationsRoutes from './routes/notifications';
import propertiesRoutes from './routes/properties';
import communityRoutes from './routes/community';
import visitorsRoutes, { reconcileVisitorLifecycle } from './routes/visitors';
import leadershipRoutes from './routes/leadership';
import workforceRoutes from './routes/workforce';
import emergencyRoutes from './routes/emergency';
import householdRoutes from './routes/household';
import activityLogRoutes from './routes/activity-log';
import chatRoutes from './routes/chat';
import invitationsRoutes from './routes/invitations';
import accessGrantRoutes from './routes/access-grants';
import ownershipTransferRoutes from './routes/ownership-transfers';
import profileAvailabilityRoutes from './routes/profile-availability';
import { setupChatWebSocketServer } from './services/chatSocket';

dotenv.config();

const app = express();

// Trust proxy for accurate IP detection behind load balancers/CDNs
// In production, set to the number of proxies or specific subnet
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081']; // Default Expo web port

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // In development, allow all localhost and LAN IP origins for easy Expo testing
    if (process.env.NODE_ENV !== 'production' && (
      origin.startsWith('http://localhost:') ||
      origin.match(/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+/)
    )) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Health Check with Database Connectivity Verification
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.error('Database connection failure in /health:', dbErr);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

app.post('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/auth', authRoutes);
app.use('/manager', managerRoutes);
app.use('/leadership', leadershipRoutes);
app.use('/work', workforceRoutes);
app.use('/tickets', ticketsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/properties', propertiesRoutes);
app.use('/community', communityRoutes);
app.use('/visitors', visitorsRoutes);
app.use('/emergency', emergencyRoutes);
app.use('/household', householdRoutes);
app.use('/activity-log', activityLogRoutes);
app.use('/chat', chatRoutes);
app.use('/invitations', invitationsRoutes);
app.use('/access-grants', accessGrantRoutes);
app.use('/ownership-transfers', ownershipTransferRoutes);
app.use('/profile', profileAvailabilityRoutes);

// Keep time-bound gate passes accurate even when no watchman is actively viewing the queue.
const visitorLifecycleTimer = setInterval(() => {
  reconcileVisitorLifecycle().catch((error) => console.error('Visitor lifecycle reconciliation failed:', error));
}, 60_000);
visitorLifecycleTimer.unref?.();

// Clean up expired idempotency keys daily
const idempotencyCleanupTimer = setInterval(async () => {
  try {
    await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (error) {
    console.error('Idempotency key cleanup failed:', error);
  }
}, 24 * 60 * 60 * 1000);
idempotencyCleanupTimer.unref?.();

// Centralized safe error handling — never leaks raw Zod or Prisma objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((_err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Extract clean message from Zod validation errors
  if (_err?.name === 'ZodError' || Array.isArray(_err?.issues)) {
    const firstIssue = _err.issues?.[0];
    const message = firstIssue?.message || 'Invalid input details provided';
    return res.status(400).json({
      error: { message },
      message,
    });
  }

  const statusCode = typeof _err.status === 'number' && _err.status >= 400 && _err.status < 600 ? _err.status : 500;
  const safeMessage = statusCode >= 500 ? 'Internal Server Error' : (_err.message || 'An unexpected error occurred');

  res.status(statusCode).json({
    error: {
      message: safeMessage,
    },
    message: safeMessage,
  });
});

const server = http.createServer(app);
setupChatWebSocketServer(server);

export { server };
export default app;

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
  });
}
