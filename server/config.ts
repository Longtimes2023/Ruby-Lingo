/**
 * RubyLingo — Cấu hình server: đọc `.env` và KIỂM TRA NGAY khi khởi động.
 *
 * Nguyên tắc: thiếu cấu hình bắt buộc ⇒ **dừng ngay lúc boot**, không để app chạy
 * với giá trị mặc định nguy hiểm (ví dụ SESSION_SECRET mặc định ⇒ ai cũng đoán được).
 */

import { config as loadEnv } from 'dotenv';
import { resolve, isAbsolute } from 'node:path';
import { z } from 'zod';

loadEnv();

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DB_PATH: z.string().default('./data/rubylingo.db'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET phải dài ít nhất 32 ký tự'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(90),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  PUBLIC_ORIGIN: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // ⚠️⚠️ HẠN MỨC TOÀN CỤC — CHỈ áp cho `/api/**` (xem `allowList` ở `plugins/security.ts`).
  //   Vì sao tách riêng khỏi `AUTH_RATE_LIMIT_MAX`: đây là hai câu hỏi KHÁC NHAU. Ngưỡng auth
  //   trả lời "một người được thử mật khẩu mấy lần"; ngưỡng này trả lời "một IP được gọi API
  //   mấy lần". Gộp chúng làm một con số khiến việc nới cái này vô tình nới luôn cái kia (và
  //   ngược lại) — mà chúng có lý do đúng hoàn toàn khác nhau.
  //
  //   ⚠️ VÌ SAO CẦN ĐƯA RA CONFIG, KHÔNG GHIM HẰNG SỐ TRONG PLUGIN: test phải hạ được ngưỡng
  //     xuống nhỏ (vài đơn vị) để TÁI HIỆN được cảnh vượt hạn mức trong vài request, thay vì
  //     gửi 300 request mỗi lượt chạy. Một hằng số không đổi được là một hành vi không kiểm được.
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`);
  console.error(
    '\n❌ Cấu hình môi trường không hợp lệ — server không thể khởi động:\n' +
      lines.join('\n') +
      '\n\n👉 Sao chép `.env.example` thành `.env` rồi điền giá trị.\n',
  );
  process.exit(1);
}

const env = parsed.data;

// --- Cảnh báo an toàn ở production -----------------------------------------
const securityWarnings: string[] = [];
if (isProd) {
  if (env.SESSION_SECRET.includes('doi-thanh') || env.SESSION_SECRET.includes('change-me')) {
    securityWarnings.push(
      'SESSION_SECRET vẫn là giá trị mẫu trong .env.example. Hãy sinh khoá thật: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  if (!env.COOKIE_SECURE) {
    securityWarnings.push('COOKIE_SECURE=false ở production ⇒ cookie phiên có thể bị gửi qua HTTP. Phải là true khi chạy sau HTTPS.');
  }
  if (env.PUBLIC_ORIGIN.startsWith('http://')) {
    securityWarnings.push('PUBLIC_ORIGIN đang là http:// ở production. Phải là https:// (SpeechRecognition và PWA yêu cầu HTTPS).');
  }
}
for (const w of securityWarnings) console.warn(`⚠️  ${w}`);

/** Đường dẫn DB tuyệt đối — tránh lỗi khi systemd chạy với cwd khác. */
const dbPath = isAbsolute(env.DB_PATH) ? env.DB_PATH : resolve(process.cwd(), env.DB_PATH);

export const config = {
  ...env,
  isProd,
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  dbPath,
  sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  /** Cookie phiên — httpOnly + SameSite=Lax để chống XSS đọc token và CSRF cơ bản. */
  cookie: {
    name: 'rubylingo_session',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.COOKIE_SECURE,
    path: '/',
  },
  securityWarnings,
} as const;

export type Config = typeof config;
