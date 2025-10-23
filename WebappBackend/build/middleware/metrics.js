"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackStreamMetrics = void 0;
/**
 * Middleware to track request metrics
 */
function trackStreamMetrics(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const authReq = req;
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            method: req.method,
            endpoint: req.path,
            duration,
            statusCode: res.statusCode,
            userId: authReq.user?.id || 'anonymous',
            ip: req.ip
        }));
    });
    next();
}
exports.trackStreamMetrics = trackStreamMetrics;
//# sourceMappingURL=metrics.js.map