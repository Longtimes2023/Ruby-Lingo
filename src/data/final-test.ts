/**
 * RubyLingo — Đọc NỘI DUNG bài thi cuối khoá (Starters) từ đĩa.
 *
 * ⭐ VÌ SAO LÀ MỘT TỆP RIÊNG, KHÔNG NHÉT VÀO `src/data/index.ts`:
 *   `index.ts` lo nội dung HỌC (level → theme → lesson → word → exercise). Bài thi là MIỀN DỮ
 *   LIỆU RIÊNG (xem `shared/schemas/final-test.ts`) — nó có `part`/`item`, không có theme/lesson,
 *   không có sao, không đi qua `game_result`. Trộn vào `readLevelBundle` sẽ buộc `LevelBundle`
 *   phải "hiểu" một khái niệm nó không có, đúng loại lỗi im lặng mà dự án đang chống.
 *
 * ⭐ VÌ SAO DÙNG `import.meta.glob` (không import tay):
 *   Cùng lý do đã ghi ở đầu `src/data/index.ts`: sửa đề (đổi số part, thêm câu) phải chỉ là sửa
 *   JSON — KHÔNG phải sửa code. Thả tệp vào đúng thư mục là app đọc được.
 *
 * ⚠️ CHỈ CHẠY TRÊN CLIENT (Vite). Tầng build (`scripts/validate-content.ts`) và server đọc đề
 *    bằng đường riêng (`scripts/gen-content-index.ts` + `shared/content/content-index.ts`) —
 *    server chỉ cần TÓM TẮT (mấy phần, mấy câu), KHÔNG cần từng item.
 *
 * ⚠️ KHÔNG import React / `fetch` / `Date.now` — thuần đọc dữ liệu, test được trên Node.
 */

import type { FinalTestManifest, FinalTestSectionFile } from '@shared/schemas/final-test.js';
import type { FinalTestSectionId } from '@shared/schemas/final-test.js';
import {
  finalTestManifestSchema,
  finalTestSectionFileSchema,
} from '@shared/schemas/final-test.js';

import { DEFAULT_LEVEL_ID } from './index.js';

/**
 * Nạp MỌI tệp `.json` của mọi `final-test/` (manifest + 3 phần). Lọc theo tên tệp ở dưới:
 * `manifest.json` là metadata, các tệp còn lại là phần thi.
 */
const FINAL_TEST_MODULES = import.meta.glob<Record<string, unknown>>(
  './levels/*/final-test/*.json',
  { eager: true, import: 'default' },
);

/** './levels/starters/final-test/listening.json' → ['starters', 'listening'] */
const FINAL_TEST_PATH_RE = /^\.\/levels\/([^/]+)\/final-test\/([^/]+)\.json$/;

/** Tệp metadata — không phải một phần thi. */
const MANIFEST_FILE = 'manifest';

/** Gộp mọi module của một level thành map `tên-tệp → dữ liệu thô`. */
function filesForLevel(levelId: string): Map<string, Record<string, unknown>> {
  const files = new Map<string, Record<string, unknown>>();
  for (const [path, data] of Object.entries(FINAL_TEST_MODULES)) {
    const match = FINAL_TEST_PATH_RE.exec(path);
    if (!match || match[1] !== levelId) continue;
    const name = match[2];
    if (name === undefined) continue;
    files.set(name, data);
  }
  return files;
}

/**
 * Đọc manifest của level, hoặc `null` nếu chưa có (level chưa soạn bài thi).
 *
 * ⚠️ Parse bằng schema DÙNG CHUNG (`finalTestManifestSchema`): nếu JSON sai hình dạng, lỗi phải
 *    lộ ra NGAY ở đây thay vì để một `undefined` chảy vào màn hình.
 */
export function readFinalTestManifest(levelId: string = DEFAULT_LEVEL_ID): FinalTestManifest | null {
  const raw = filesForLevel(levelId).get(MANIFEST_FILE);
  if (raw === undefined) return null;
  return finalTestManifestSchema.parse(raw);
}

/** Đọc MỘT phần thi (listening / reading-writing / speaking), hoặc `null` nếu chưa có. */
export function readFinalTestSection(
  section: FinalTestSectionId,
  levelId: string = DEFAULT_LEVEL_ID,
): FinalTestSectionFile | null {
  const raw = filesForLevel(levelId).get(section);
  if (raw === undefined) return null;
  return finalTestSectionFileSchema.parse(raw);
}

/**
 * Đọc MỌI phần thi của level, theo ĐÚNG thứ tự khai trong manifest (`listening` →
 * `reading-writing` → `speaking`), KHÔNG theo thứ tự tên tệp.
 *
 * ⚠️ Thứ tự lấy từ manifest là nguồn chân lý — cùng lối với `level.themeIds` ở `src/data/index.ts`.
 *    Duyệt theo tên tệp sẽ cho đúng thứ tự chỉ vì may mắn về bảng chữ cái; đổi tên tệp là thứ tự
 *    đổi mà không ai báo.
 */
export function readFinalTestSections(levelId: string = DEFAULT_LEVEL_ID): FinalTestSectionFile[] {
  const manifest = readFinalTestManifest(levelId);
  if (!manifest) return [];
  const files = filesForLevel(levelId);

  const out: FinalTestSectionFile[] = [];
  for (const summary of manifest.sections) {
    const raw = files.get(summary.section);
    if (raw === undefined) continue; // thiếu tệp ⇒ bỏ qua (validator V21 đã chặn ở build).
    out.push(finalTestSectionFileSchema.parse(raw));
  }
  return out;
}
