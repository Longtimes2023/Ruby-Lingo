/**
 * RubyLingo — Logger (pino) có REDACT.
 *
 * Quan trọng: log KHÔNG bao giờ được chứa mật khẩu, token phiên, mã khôi phục hay PIN
 * của phụ huynh. `redact` lo việc đó ở tầng logger nên lập trình viên không thể vô tình lộ.
 */

import { pino } from 'pino';
import { config } from '../config.js';

/** Các đường dẫn bị thay bằng [REDACTED] trước khi ghi log. */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'recoveryCode',
  'recoveryCodeHash',
  'token',
  'gateToken',
  'sessionToken',
  'pin',
  'pinHash',
  '*.password',
  '*.newPassword',
  '*.recoveryCode',
  '*.token',
  '*.pin',
];

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: { service: 'rubylingo' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
