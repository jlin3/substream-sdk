/**
 * Structured logger using pino.
 *
 * All application logging should go through this module instead of console.log.
 * In production, outputs JSON to stdout for ingestion by log aggregators.
 * In development, uses pino-pretty for readable colored output.
 */

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
  base: {
    service: 'substream-backend',
    version: '2.0.0',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export default logger;
