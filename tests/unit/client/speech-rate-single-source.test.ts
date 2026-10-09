/**
 * Test canh giữ **NGUỒN DUY NHẤT** cho khoảng tốc độ đọc (T080 — do rà soát phát hiện 2026-10-09).
 *
 * ⚠️ VÌ SAO CẦN TEST NÀY:
 *   Cùng một khoảng số nằm ở BA nơi, và cả ba đều "đúng" theo cách riêng của chúng:
 *     1. `shared/constants.ts`        — bản chuẩn; `shared/schemas/settings.ts` import từ đây.
 *     2. `src/store/settingsStore.ts`  — thanh trượt (`ParentSettingsPage`) + `SpeechService` kẹp.
 *     3. `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` trong `migrations/002_child.sql`.
 *
 *   Chỗ số 2 TRƯỚC ĐÂY khai lại `0.5`/`1.2` bằng tay (nay đã tái xuất từ nguồn chuẩn).
 *   Chỗ số 3 KHÔNG THỂ sửa tại chỗ: migration là bất biến — muốn đổi khoảng phải viết migration mới.
 *
 *   ⚠️ HỆ QUẢ KHI LỆCH — và đây là lý do test tồn tại: nếu ai đó nới hằng số mà không viết migration,
 *   thanh trượt cho phụ huynh chọn một giá trị, schema cho qua, rồi **SQLite từ chối** ⇒ phụ huynh
 *   nhận lỗi 500 cho một ô nhập trông hoàn toàn hợp lệ. Không thông báo nào chỉ ra nguyên nhân,
 *   vì mỗi tầng đều nhất quán với chính nó.
 *
 *   ⇒ Test này ĐỌC THẲNG tệp migration và so ba con số. Một trong ba đổi mà hai chỗ kia không đổi
 *     ⇒ ĐỎ. Đây là loại lỗi mà không tầng nào tự phát hiện được.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '@/store/settingsStore.js';
import {
  SPEECH_RATE_MAX as CANONICAL_MAX,
  SPEECH_RATE_MIN as CANONICAL_MIN,
} from '@shared/constants.js';

/** `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` — bắt cả hai vế và hai con số. */
const CHECK_RE = /CHECK\s*\(\s*speech_rate\s*>=\s*([0-9.]+)\s+AND\s+speech_rate\s*<=\s*([0-9.]+)\s*\)/;

const MIGRATION_PATH = join(process.cwd(), 'server/db/migrations/002_child.sql');

/**
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL(…, import.meta.url))` — đã thử và hỏng ĐÚNG như ghi chú có
 *   sẵn ở `tests/unit/client/styles-tokens.test.ts:52`: dưới Vitest (môi trường jsdom),
 *   `import.meta.url` KHÔNG mang scheme `file:` ⇒ `TypeError: The URL must be of scheme file`.
 *   Đây là bẫy của MÔI TRƯỜNG TEST, không phải của tệp cần đọc.
 *   `process.cwd()` là gốc repo khi vitest chạy — cùng cách `styles-tokens.test.ts` và
 *   `content-index.test.ts` đang dùng.
 */

describe('khoảng tốc độ đọc — ba nơi phải khớp nhau', () => {
  it('`settingsStore` TÁI XUẤT đúng giá trị chuẩn (không được khai lại bằng tay)', () => {
    /*
      ⚠️ Nếu ai đó quay lại viết `export const SPEECH_RATE_MIN = 0.5;` trong `settingsStore.ts`,
      phép so này vẫn xanh hôm nay (cùng giá trị) — nhưng lần sau người ta chỉ sửa MỘT nơi.
      Cách phát hiện thật là đọc mã nguồn; điều test này khoá được là "giá trị đang chạy phải bằng
      nguồn chuẩn", tức là mọi lệch hôm nay đều bị chặn.
    */
    expect(SPEECH_RATE_MIN).toBe(CANONICAL_MIN);
    expect(SPEECH_RATE_MAX).toBe(CANONICAL_MAX);
  });

  it('⚠️ `CHECK` trong migration 002 khớp ĐÚNG hằng số đang chạy', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const match = CHECK_RE.exec(sql);

    // Không tìm thấy ràng buộc nghĩa là nó đã bị gỡ/diễn đạt lại ⇒ test phải đỏ, không được "bỏ qua".
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(CANONICAL_MIN);
    expect(Number(match![2])).toBe(CANONICAL_MAX);
  });

  it('hằng số là số hữu hạn và min < max (một khoảng rỗng sẽ vô hiệu hoá thanh trượt)', () => {
    expect(Number.isFinite(CANONICAL_MIN)).toBe(true);
    expect(Number.isFinite(CANONICAL_MAX)).toBe(true);
    expect(CANONICAL_MIN).toBeLessThan(CANONICAL_MAX);
  });
});
