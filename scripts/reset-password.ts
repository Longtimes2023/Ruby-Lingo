#!/usr/bin/env tsx
/**
 * RubyLingo — CLI đặt lại mật khẩu phụ huynh (đường lui cuối cùng).
 *
 * DÙNG KHI NÀO:
 *   Phụ huynh mất CẢ mật khẩu LẪN mã khôi phục. Lúc đó không còn đường nào qua giao diện,
 *   nên cần người vận hành (chủ VPS) đặt lại trực tiếp trong DB.
 *
 *   Trường hợp thường gặp (chỉ quên mật khẩu) thì dùng chức năng "Quên mật khẩu" trên web —
 *   KHÔNG cần script này.
 *
 * CÁCH DÙNG:
 *   npm run reset-password -- --email bo@example.com --password 'matkhaumoi123'
 *   npm run reset-password -- --email bo@example.com          # sẽ hỏi mật khẩu
 *   npm run reset-password -- --email bo@example.com --list-only
 *
 * ⚠️ Script này GHI TRỰC TIẾP vào DB nên phải chạy trên máy có file DB. Trên VPS:
 *    cd /opt/rubylingo && npm run reset-password -- --email ...
 *
 * ⚠️ Script này KHÔNG in mật khẩu ra log và KHÔNG ghi mật khẩu vào lịch sử shell nếu bạn
 *    dùng chế độ hỏi (không truyền `--password`).
 */

import { createInterface } from 'node:readline';
import { getDb, closeDb } from '../server/db/connection.js';
import { newIdWithPrefix, newRecoveryCode } from '../server/lib/ids.js';
import {
  assertPasswordLength,
  hashPassword,
  normalizeRecoveryCode,
  sha256,
} from '../server/lib/password.js';
import { nowIso } from '../server/lib/time.js';
import type { Db } from '../server/db/connection.js';

interface ParentRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

interface ResetOutcome {
  parentId: string;
  email: string;
  sessionsRevoked: number;
  recoveryCode: string;
}

/**
 * Đặt lại mật khẩu trực tiếp trong DB.
 *
 * Tách khỏi phần đọc tham số dòng lệnh để TEST được: test gọi hàm này với một DB tạm, còn
 * CLI chỉ lo parse tham số và in kết quả.
 *
 * Vì sao cũng phát mã khôi phục MỚI: sau khi đặt lại bằng tay, tài khoản vẫn nên có một
 * đường lui. Nếu chỉ đổi mật khẩu thì lần sau quên lại phải nhờ can thiệp thủ công nữa.
 *
 * Vì sao XOÁ MỌI PHIÊN: mục đích của việc đặt lại là giành lại quyền kiểm soát tài khoản.
 * Để phiên cũ còn sống thì người đang đăng nhập (có thể là người lạ) vẫn tiếp tục dùng được.
 */
export async function resetPasswordDirect(
  db: Db,
  email: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const normalizedEmail = email.trim().toLowerCase();
  const parent = db
    .prepare('SELECT id, email, display_name, created_at FROM parent_account WHERE email = ?')
    .get(normalizedEmail) as ParentRow | undefined;

  if (!parent) throw new Error(`Không tìm thấy tài khoản với email "${normalizedEmail}"`);

  // Kiểm độ dài theo CÙNG chính sách với web — nếu không, script này là lỗ hổng để đặt
  // mật khẩu 1 ký tự.
  assertPasswordLength(newPassword);
  const passwordHash = await hashPassword(newPassword);
  const recoveryCode = newRecoveryCode();
  const now = nowIso();

  // Ghi trong một transaction: hoặc đổi được hết, hoặc không đổi gì.
  const run = db.transaction(() => {
    db.prepare('UPDATE parent_account SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      now,
      parent.id,
    );
    const revoked = db.prepare('DELETE FROM session WHERE parent_id = ?').run(parent.id).changes;
    db.prepare(
      'INSERT INTO recovery_code (id, parent_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
    ).run(newIdWithPrefix('rec'), parent.id, sha256(normalizeRecoveryCode(recoveryCode)), now);
    return revoked;
  });

  const sessionsRevoked = run();

  return { parentId: parent.id, email: parent.email, sessionsRevoked, recoveryCode };
}

// =============================================================================
// Phần CLI
// =============================================================================

interface Args {
  email?: string;
  password?: string;
  listOnly: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { listOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' || a === '-e') {
      args.email = argv[++i];
    } else if (a === '--password' || a === '-p') {
      args.password = argv[++i];
    } else if (a === '--list-only') {
      args.listOnly = true;
    }
  }
  return args;
}

/** Hỏi mật khẩu mà KHÔNG hiện lên màn hình. */
async function promptPassword(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  // Tạm thay `_writeToOutput` để không hiện ký tự đang gõ. Cách này không che được với mọi
  // terminal, nên vẫn khuyến nghị dùng biến môi trường hoặc `--password` khi cần chắc chắn.
  const stdout = process.stdout as unknown as { _writeToOutput?: (s: string) => void };
  const original = stdout._writeToOutput;
  stdout._writeToOutput = function (s: string) {
    if (s.includes('\n')) original?.call(stdout, s);
  };

  const answer = await new Promise<string>((resolve) => {
    rl.question('Mật khẩu mới: ', resolve);
  });

  stdout._writeToOutput = original;
  rl.close();
  process.stdout.write('\n');
  return answer;
}

function usage(): void {
  console.log(
    [
      '',
      'RubyLingo — đặt lại mật khẩu phụ huynh',
      '',
      'Dùng:',
      '  npm run reset-password -- --email <email> --password <mật-khẩu-mới>',
      '  npm run reset-password -- --email <email>            (sẽ hỏi mật khẩu)',
      '  npm run reset-password -- --list-only                (liệt kê tài khoản)',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const db = getDb();

  if (args.listOnly) {
    const rows = db
      .prepare('SELECT id, email, display_name, created_at FROM parent_account ORDER BY created_at ASC')
      .all() as ParentRow[];
    if (rows.length === 0) {
      console.log('Chưa có tài khoản phụ huynh nào trong DB này.');
    } else {
      console.log(`\n${rows.length} tài khoản phụ huynh:\n`);
      for (const r of rows) {
        console.log(`  ${r.email}${r.display_name ? `  (${r.display_name})` : ''}  — tạo ${r.created_at}`);
      }
      console.log('');
    }
    return;
  }

  if (!args.email) {
    usage();
    process.exitCode = 1;
    return;
  }

  const password = args.password ?? (await promptPassword());
  if (!password) {
    console.error('❌ Chưa nhập mật khẩu.');
    process.exitCode = 1;
    return;
  }

  const outcome = await resetPasswordDirect(db, args.email, password);

  console.log('\n✅ Đã đặt lại mật khẩu cho:', outcome.email);
  console.log(`   Phiên cũ đã thu hồi: ${outcome.sessionsRevoked}`);
  console.log('\n   MÃ KHÔI PHỤC MỚI (chỉ hiện một lần — hãy lưu lại):');
  console.log(`   ${outcome.recoveryCode}\n`);
}

// Chỉ tự chạy khi được gọi trực tiếp, KHÔNG chạy khi bị `import` từ test.
// Nhận biết bằng cách so đường dẫn của module chính với đường dẫn file này.
const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('reset-password.ts') || process.argv[1].endsWith('reset-password.js'));

if (invokedDirectly) {
  main()
    .catch((err: unknown) => {
      console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(() => {
      closeDb();
    });
}
