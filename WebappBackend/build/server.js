"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const express_1 = __importDefault(require("express"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const morgan_1 = __importDefault(require("morgan"));
const Sentry = __importStar(require("@sentry/node"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const signaling_1 = __importDefault(require("./signaling"));
const log_1 = require("./log");
const httphandler_1 = require("./class/httphandler");
const metrics_1 = require("./middleware/metrics");
const sessions_1 = __importDefault(require("./routes/sessions"));
const recordings_1 = __importDefault(require("./routes/recordings"));
const cors = require('cors');
const createServer = (config) => {
    const app = (0, express_1.default)();
    // Initialize Sentry if DSN is provided
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: 0.1
        });
        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.tracingHandler());
        (0, log_1.log)(log_1.LogLevel.info, 'Sentry error tracking initialized');
    }
    (0, httphandler_1.reset)(config.mode);
    // Logging http access
    if (config.logging != "none") {
        app.use((0, morgan_1.default)(config.logging));
    }
    // Metrics tracking
    app.use(metrics_1.trackStreamMetrics);
    // CORS - restrict origins in production
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    app.use(cors({
        origin: allowedOrigins,
        credentials: true
    }));
    // Body parsing
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use(express_1.default.json());
    // Rate limiting for API routes
    const apiLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
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
    app.use('/api/sessions', sessions_1.default);
    app.use('/api/recordings', recordings_1.default);
    // Legacy config endpoint
    app.get('/config', (req, res) => res.json({
        useWebSocket: config.type == 'websocket',
        startupMode: config.mode,
        logging: config.logging
    }));
    // Legacy signaling endpoint
    app.use('/signaling', signaling_1.default);
    // Static files
    app.use(express_1.default.static(path.join(__dirname, '../client/public')));
    app.use('/module', express_1.default.static(path.join(__dirname, '../client/src')));
    // Main page
    app.get('/', (req, res) => {
        const indexPagePath = path.join(__dirname, '../client/public/index.html');
        fs.access(indexPagePath, (err) => {
            if (err) {
                (0, log_1.log)(log_1.LogLevel.warn, `Can't find file ' ${indexPagePath}`);
                res.status(404).send(`Can't find file ${indexPagePath}`);
            }
            else {
                res.sendFile(indexPagePath);
            }
        });
    });
    // Error handler (must be after all routes)
    if (process.env.SENTRY_DSN) {
        app.use(Sentry.Handlers.errorHandler());
    }
    // Generic error handler
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });
    return app;
};
exports.createServer = createServer;
//# sourceMappingURL=server.js.map