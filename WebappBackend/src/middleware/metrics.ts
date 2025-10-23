import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware to track request metrics
 */
export function trackStreamMetrics(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const authReq = req as AuthRequest;
    
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

