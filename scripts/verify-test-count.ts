/**
 * RubyLingo — Lưới an toàn cho cổng CI: kiểm rằng MỌI file test trên đĩa đã THỰC SỰ CHẠY.
 *
 * ⚠️ VÌ SAO CẦN SCRIPT NÀY:
 *   Vitest có thể **âm thầm bỏ qua** một file test. Khi chạy song song trên máy dev này
 *   (WorkBuddy sandbox trên Windows), tiến trình con ghi cache vào thư mục tạm bị chặn
 *   (`EPERM`) và file test biến mất khỏi kết quả — không báo lỗi, không báo đỏ. Đo thực tế
 *   3 lần liên tiếp: 4, 5, 5 file, trong khi trên đĩa có 6.
 *
 *   Hệ quả: `vitest run` in ra "Test Files 5 passed (5)" và CI báo XANH trong khi một phần
 *   test chưa hề chạy. Đây là kiểu thất bại tệ nhất — nó phá đúng thứ mà cổng CI sinh ra
 *   để bảo vệ, và không ai biết cho tới khi lỗi lọt ra production.
 *
 *   `vite.config.ts` đã đặt `fileParallelism: false` để chữa triệu chứng. Script này là
 *   lớp thứ hai: dù nguyên nhân là gì, nếu số file chạy được KHÁC số file trên đĩa thì
 *   cổng CI phải đỏ.
 *
 * Cách dùng (đã nối sẵn vào `npm run ci`):
 *   vitest run --reporter=default --reporter=json --outputFile.json=.vitest-report.json
 *   tsx scripts/verify-test-count.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TESTS_DIR = join(REPO_ROOT, 'tests', 'unit');
const REPORT_PATH = join(REPO_ROOT, '.vitest-report.json');

/** Đuôi file test — phải khớp `test.include` trong `vite.config.ts`. */
const TEST_SUFFIXES = ['.test.ts', '.test.tsx'];

/**
 * Liệt kê đệ quy mọi file test trong `tests/unit`.
 *
 * Tự đi bộ thay vì dùng `fs.globSync` (còn thử nghiệm ở Node 20) hay `fast-glob` (phụ thuộc
 * thêm) — chỉ mất vài dòng và không có gì để hỏng.
 */
function findTestFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findTestFiles(full));
    } else if (TEST_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
      found.push(full);
    }
  }
  return found;
}

/** Chuẩn hoá đường dẫn về dạng `tests/unit/...` với dấu `/` — để so sánh được với báo cáo. */
function normalize(absPath: string): string {
  return relative(REPO_ROOT, absPath).split(sep).join('/');
}

interface VitestJsonReport {
  testResults?: { name?: string }[];
  numTotalTestSuites?: number;
}

function main(): void {
  const onDisk = findTestFiles(TESTS_DIR).map(normalize).sort();

  if (onDisk.length === 0) {
    console.error('❌ Không tìm thấy file test nào trong tests/unit — kiểm lại cấu hình.');
    process.exit(1);
  }

  let report: VitestJsonReport;
  try {
    report = JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as VitestJsonReport;
  } catch {
    console.error(
      `❌ Không đọc được báo cáo JSON của Vitest tại ${normalize(REPORT_PATH)}.\n` +
        '   Script này phải chạy SAU khi vitest đã ghi báo cáo. Xem `test:ci` trong package.json.',
    );
    process.exit(1);
  }

  // Vitest ghi đường dẫn tuyệt đối trong `testResults[].name`; quy về dạng tương đối để so.
  const ran = new Set(
    (report.testResults ?? [])
      .map((r) => r.name)
      .filter((n): n is string => typeof n === 'string')
      .map((n) => normalize(n)),
  );

  const missing = onDisk.filter((f) => !ran.has(f));

  if (missing.length > 0) {
    console.error(
      `\n❌ CÓ FILE TEST KHÔNG HỀ CHẠY (${missing.length}/${onDisk.length} file bị bỏ qua):\n` +
        missing.map((f) => `     • ${f}`).join('\n') +
        '\n\n   Kết quả "passed" ở trên là KHÔNG ĐÁNG TIN: những file này chưa được kiểm.\n' +
        '   Nguyên nhân thường gặp: Vitest chạy song song bị chặn ghi cache (EPERM) và âm thầm\n' +
        '   bỏ file. Kiểm `fileParallelism` trong vite.config.ts, và đối chiếu số file báo cáo\n' +
        '   với số file thật trên đĩa trước khi tin bất kỳ kết quả nào.\n',
    );
    process.exit(1);
  }

  console.log(`✅ Đã chạy đủ ${onDisk.length}/${onDisk.length} file test trong tests/unit.`);
}

main();
