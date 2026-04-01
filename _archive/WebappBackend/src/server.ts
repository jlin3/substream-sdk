import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import rateLimit from 'express-rate-limit';
import signaling from './signaling';
import { log, LogLevel } from './log';
import Options from './class/options';
import { reset as resetHandler } from './class/httphandler';
import { trackStreamMetrics } from './middleware/metrics';
import sessionRoutes from './routes/sessions';
import recordingRoutes from './routes/recordings';

const cors = require('cors');

export const createServer = (config: Options): express.Application => {
  const app: express.Application = express();
  
  // Initialize Sentry if DSN is provided
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
    log(LogLevel.info, 'Sentry error tracking initialized');
  }
  
  resetHandler(config.mode);
  
  // Logging http access
  if (config.logging != "none") {
    app.use(morgan(config.logging));
  }
  
  // Metrics tracking
  app.use(trackStreamMetrics);
  
  // CORS - restrict origins in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));
  
  // Body parsing
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  
  // Rate limiting for API routes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', apiLimiter);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      features: {
        database: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
        storage: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        notifications: !!process.env.SENDGRID_API_KEY,
        auth: !!process.env.JWT_SECRET
      }
    });
  });
  
  // API routes
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/recordings', recordingRoutes);
  
  // Legacy config endpoint
  app.get('/config', (req, res) => res.json({ 
    useWebSocket: config.type == 'websocket', 
    startupMode: config.mode, 
    logging: config.logging 
  }));
  
  // Legacy signaling endpoint
  app.use('/signaling', signaling);
  
  // Static files
  app.use(express.static(path.join(__dirname, '../client/public')));
  app.use('/module', express.static(path.join(__dirname, '../client/src')));
  
  // Main page
  app.get('/', (req, res) => {
    const indexPagePath: string = path.join(__dirname, '../client/public/index.html');
    fs.access(indexPagePath, (err) => {
      if (err) {
        log(LogLevel.warn, `Can't find file ' ${indexPagePath}`);
        res.status(404).send(`Can't find file ${indexPagePath}`);
      } else {
        res.sendFile(indexPagePath);
      }
    });
  });
  
  // Error handler (must be after all routes)
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }
  
  // Generic error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });
  
  return app;
};
