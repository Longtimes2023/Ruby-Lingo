// @vitest-environment node
/**
 * RubyLingo — chốt chặn cho `shared/content/content-index.json` (bản chiếu SINH TỰ ĐỘNG).
 *
 * ⭐⭐ VÌ SAO CẦN TỆP NÀY — CÙNG HỌ LỖI VỚI `word-assets.test.ts`:
 *
 *   Server chấm hai nhiệm vụ cần CÂY NỘI DUNG: `complete_theme` (chủ đề có mấy bài, bài nào)
 *   và `unlock_theme` (chủ đề nào có game). Cây thật nằm ở `src/data/levels/**`, mà server
 *   KHÔNG đọc được (`tsconfig.server.json` không gom `src/`, còn `src/data/index.ts` dùng
 *   `import.meta.glob` — API của Vite). Nên có một tệp JSON sinh sẵn trong `shared/`.
 *
 *   Lệch nhau thì KHÔNG có gì báo lỗi: `tsc` xanh, `eslint` xanh, build xanh. Bé sẽ thấy
 *   nhiệm vụ "hoàn thành cả chủ đề" đứng im mãi (nếu `lessonIds` rỗng) hoặc xong ngay khi
 *   chưa học gì (nếu danh sách sai) — và không ai biết.
 *
 * ⚠️ TỆP NÀY QUÉT LẠI `src/data/` BẰNG MÃ RIÊNG CỦA NÓ, KHÔNG GỌI `gen-content-index.ts`.
 *    Đó chính là điểm mấu chốt: `npm run gen:content-index` (chế độ kiểm) dùng CHÍNH hàm dựng
 *    của script, nên nếu hàm đó có bug thì cả hai bên cùng sai và CI vẫn xanh. Ở đây ta đi
 *    đường thứ hai — đọc đĩa, dựng kỳ vọng từ đầu, đối chiếu TỪNG trường. Hai đường, một đáp
 *    số. Cùng mô hình `tokens.css` ↔ `gen-theme-colors.ts` và `word-assets.json` ↔ `convert_words.py`.
 *
 * ⚠️ Test đỏ thì sửa NGUỒN (`src/data/`) rồi chạy `npm run gen:content-index -- --apply`,
 *    TUYỆT ĐỐI không sửa tay `shared/content/content-index.json` và không nới test ra.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONTENT_LEVEL_ID,
  getThemeIndex,
  levelThemeIds,
  themeIdsWithGames,
  themesForLevel,
} from '../../../shared/content/content-index.js';
import { levelSchema, themeFileSchema } from '../../../shared/schemas/content.js';
import type { ContentIndexFile, ThemeFile } from '../../../shared/schemas/content.js';
import type { UnlockCondition } from '../../../shared/types/content.js';

/**
 * Gốc repo `rubylingo/`.
 *
 * ⚠️ KHÔNG dùng `fileURLToPath(new URL(…, import.meta.url))`: dưới Vitest `import.meta.url`
 *    không mang scheme `file:` ⇒ `TypeError: The URL must be of scheme file`. Bẫy đã trả giá ở
 *    `styles-fonts.test.ts`, và `word-assets.test.ts` cũng ghi lại điều này.
 */
const ROOT = `${process.cwd()}/`;
const LEVELS_DIR = join(ROOT, 'src/data/levels');
const INDEX_PATH = join(ROOT, 'shared/content/content-index.json');

/** Một chủ đề như chỉ mục PHẢI ghi — đúng bảy trường, không hơn. */
interface ExpectedTheme {
  id: string;
  levelId: string;
  index: number;
  lessonIds: string[];
  wordCount: number;
  hasGames: boolean;
  unlock: UnlockCondition;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/**
 * Quét `src/data/levels/**` và dựng chỉ mục kỳ vọng — độc lập với script sinh.
 *
 * Luật sao chép ở đây phải GIỐNG luật đã chốt trong `src/data/index.ts`:
 *   • thứ tự cấp = `level.order`; thứ tự chủ đề = vị trí trong `level.themeIds`;
 *   • `index` = vị trí + 1 (khớp `ThemeMapItem.index`);
 *   • `wordCount` = số từ DUY NHẤT hợp `lesson.wordIds` theo thứ tự bài — KHÔNG lấy
 *     `words.length`, vì một từ có thể được dạy ở chủ đề khác với nơi định nghĩa nó;
 *   • `hasGames` = chủ đề có ít nhất một `exercise` (đây là tín hiệu cho `unlock_theme`).
 */
function scanSource(): {
  levels: ContentIndexFile['levels'];
  themes: ExpectedTheme[];
  words: Array<{ id: string; en: string; vi: string }>;
} {
  if (!existsSync(LEVELS_DIR)) throw new Error(`không tìm thấy ${LEVELS_DIR}`);

  const levelDirs = readdirSync(LEVELS_DIR)
    .sort()
    .filter((name) => existsSync(join(LEVELS_DIR, name, 'level.json')))
    .map((dirName) => ({
      dirName,
      level: levelSchema.parse(readJson(join(LEVELS_DIR, dirName, 'level.json'))),
    }))
    .sort((a, b) => a.level.order - b.level.order || a.level.id.localeCompare(b.level.id));

  const levels: ContentIndexFile['levels'] = [];
  const themes: ExpectedTheme[] = [];

  /**
   * ⭐ CHỮ CỦA TỪ (T073) — kỳ vọng dựng ĐỘC LẬP với `gen-content-index.ts`.
   *
   *   Gom từ MỌI tệp chủ đề (một từ có thể được DẠY ở chủ đề khác nơi ĐỊNH NGHĨA nó), khử trùng
   *   theo `id`, và hai nơi cùng `id` mà chữ khác nhau ⇒ NÉM. Bộ sinh cũng ném trong trường hợp
   *   đó; nếu chỉ một bên ném thì cổng này không còn là "hai đường, một đáp số".
   */
  const wordById = new Map<string, { id: string; en: string; vi: string }>();

  for (const { dirName, level } of levelDirs) {
    levels.push({ id: level.id, themeIds: [...level.themeIds] });

    const themesDir = join(LEVELS_DIR, dirName, 'themes');
    if (!existsSync(themesDir)) throw new Error(`không tìm thấy thư mục chủ đề: ${themesDir}`);

    // Khoá theo `theme.id` (dữ liệu), KHÔNG theo tên tệp (quy ước).
    const byThemeId = new Map<string, ThemeFile>();
    for (const fileName of readdirSync(themesDir).sort()) {
      if (!fileName.endsWith('.json')) continue;
      const parsed = themeFileSchema.parse(readJson(join(themesDir, fileName)));
      byThemeId.set(parsed.theme.id, parsed);

      for (const word of parsed.words) {
        const previous = wordById.get(word.id);
        if (!previous) wordById.set(word.id, { id: word.id, en: word.en, vi: word.vi });
        else if (previous.en !== word.en || previous.vi !== word.vi) {
          throw new Error(
            `từ "${word.id}" được định nghĩa với chữ KHÁC NHAU ở hai tệp chủ đề — ` +
              'một id từ phải có đúng một chữ',
          );
        }
      }
    }

    level.themeIds.forEach((themeId, position) => {
      const file = byThemeId.get(themeId);
      if (!file) {
        throw new Error(`level "${level.id}" khai themeIds có "${themeId}" nhưng thiếu tệp chủ đề`);
      }

      const lessonById = new Map(file.lessons.map((lesson) => [lesson.id, lesson]));
      const seen = new Set<string>();
      for (const lessonId of file.theme.lessonIds) {
        const lesson = lessonById.get(lessonId);
        if (!lesson) continue; // validator V8 mới là nơi báo lỗi bài thiếu.
        for (const wordId of lesson.wordIds) seen.add(wordId);
      }

      themes.push({
        id: themeId,
        levelId: level.id,
        index: position + 1,
        lessonIds: [...file.theme.lessonIds],
        wordCount: seen.size,
        hasGames: file.exercises.length > 0,
        unlock: file.theme.unlockCondition,
      });
    });
  }

  return { levels, themes, words: [...wordById.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

const expected = scanSource();
const onDisk = readJson(INDEX_PATH) as ContentIndexFile;
const keyOf = (entry: { levelId: string; id: string }): string => `${entry.levelId}/${entry.id}`;

describe('content-index.json — bản chiếu của src/data/ phải khớp TỪNG trường', () => {
  it('① có nội dung THẬT để kiểm (chống test rỗng tự khen mình)', () => {
    expect(expected.levels.length).toBeGreaterThan(0);
    expect(expected.themes.length).toBeGreaterThanOrEqual(11);
    expect(onDisk.themes.length).toBeGreaterThanOrEqual(11);
  });

  it('② `levels` khớp: id VÀ THỨ TỰ `themeIds` (thứ tự này là luật `previous_theme`)', () => {
    expect(onDisk.levels).toEqual(expected.levels);
  });

  it('③ không thiếu, không thừa chủ đề', () => {
    expect(onDisk.themes.map(keyOf).sort()).toEqual(expected.themes.map(keyOf).sort());
  });

  it('④ từng trường của TỪNG chủ đề khớp `src/data/`', () => {
    const got = new Map(onDisk.themes.map((entry) => [keyOf(entry), entry]));
    for (const want of expected.themes) {
      const key = keyOf(want);
      expect(got.get(key), key).toMatchObject({
        id: want.id,
        levelId: want.levelId,
        index: want.index,
        lessonIds: want.lessonIds,
        wordCount: want.wordCount,
        hasGames: want.hasGames,
        unlock: want.unlock,
      });
    }
  });

  it('⑤ mỗi chủ đề CHỈ có bảy trường — không chép `words`/`exercises` vào', () => {
    // Mỗi trường thừa là một trường có thể lệch với `src/data/` mà lại không ai đọc.
    const expectedKeys = ['hasGames', 'id', 'index', 'lessonIds', 'levelId', 'unlock', 'wordCount'];
    for (const entry of onDisk.themes) {
      expect(Object.keys(entry).sort(), keyOf(entry)).toEqual([...expectedKeys].sort());
    }
  });

  it('⑥ `hasGames` phải là tín hiệu THẬT: có cả chủ đề có game lẫn chưa có', () => {
    // Nếu mọi giá trị đều `false` thì `unlock_theme` không bao giờ xong — và test ④ vẫn xanh.
    expect(expected.themes.some((entry) => entry.hasGames)).toBe(true);
    expect(expected.themes.some((entry) => !entry.hasGames)).toBe(true);
  });

  it('⑦ `lessonIds` không rỗng ở mọi chủ đề — danh sách rỗng làm `complete_theme` bất khả thi', () => {
    for (const entry of onDisk.themes) {
      expect(entry.lessonIds.length, keyOf(entry)).toBeGreaterThan(0);
    }
  });

  it('⑧ ⭐ `words` khớp TỪNG TỪ với `src/data/`: cả `id` LẪN `en`/`vi`, không thiếu không thừa', () => {
    // So ĐÚNG MẢNG (đã sắp theo id ở cả hai phía) — không chỉ đếm số lượng. Chỉ đếm thì một từ
    // bị gán sai chữ (hoặc tráo chữ hai từ cho nhau) vẫn xanh, và báo cáo phụ huynh sẽ gọi tên
    // từ bằng nghĩa mà bé chưa từng học.
    expect(expected.words.length).toBeGreaterThan(0);
    expect(onDisk.words).toEqual(expected.words);
  });

  it('⑨ mỗi `id` từ chỉ xuất hiện MỘT lần trong chỉ mục (khử trùng đã xảy ra ở bộ sinh)', () => {
    const ids = onDisk.words.map((word) => word.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('content-index.ts — API đọc chỉ mục (server dùng khi chấm nhiệm vụ)', () => {
  it('getThemeIndex: trả đúng chủ đề, `undefined` khi không có', () => {
    const zoo = getThemeIndex('at-the-zoo');
    expect(zoo).toBeDefined();
    expect(zoo?.levelId).toBe(DEFAULT_CONTENT_LEVEL_ID);

    // ⚠️ `undefined` chứ KHÔNG ném lỗi: nhiệm vụ trỏ tới chủ đề đã bị đổi tên chỉ nên đứng
    //    yên. `scripts/validate-content.ts` (V16b) là nơi bắt lỗi gõ sai id, lúc build.
    expect(getThemeIndex('chu-de-khong-ton-tai')).toBeUndefined();
  });

  it('themesForLevel: theo ĐÚNG thứ tự bản đồ và khớp `levelThemeIds`', () => {
    const ids = levelThemeIds();
    expect(ids).toEqual(onDisk.levels.find((level) => level.id === DEFAULT_CONTENT_LEVEL_ID)?.themeIds);
    expect(themesForLevel().map((entry) => entry.id)).toEqual(ids);
  });

  it('themeIdsWithGames: CHỈ gồm chủ đề có game — đây là định nghĩa của `unlock_theme`', () => {
    const want = expected.themes
      .filter((entry) => entry.levelId === DEFAULT_CONTENT_LEVEL_ID && entry.hasGames)
      .map((entry) => entry.id);
    expect(themeIdsWithGames()).toEqual(want);
    // Tín hiệu phải có thật, nếu không thì nhiệm vụ "Mở khoá 1 chủ đề" vô nghĩa.
    expect(want.length).toBeGreaterThan(0);
  });

  it('cấp không tồn tại ⇒ trả rỗng, KHÔNG ném lỗi', () => {
    expect(levelThemeIds('movers-chua-co')).toEqual([]);
    expect(themesForLevel('movers-chua-co')).toEqual([]);
    expect(themeIdsWithGames('movers-chua-co')).toEqual([]);
  });
});
