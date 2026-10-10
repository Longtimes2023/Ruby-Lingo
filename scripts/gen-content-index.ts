#!/usr/bin/env tsx
/**
 * gen-content-index.ts — SINH và KIỂM `shared/content/content-index.json`.
 *
 * ⭐ VÌ SAO CÓ TỆP NÀY:
 *   Server phải chấm được hai nhiệm vụ cần CÂY NỘI DUNG chứ không chỉ một sự kiện:
 *     • `complete_theme` — "hoàn thành cả chủ đề" cần biết chủ đề có mấy bài và bài nào.
 *     • `unlock_theme`   — cần biết chủ đề nào có game và điều kiện mở khoá của nó.
 *   Cây thật nằm ở `src/data/levels/*`, mà `tsconfig.server.json` KHÔNG gom `src/` và
 *   `src/data/index.ts` dùng `import.meta.glob` (API của Vite, không có khi chạy `tsx`/`node`).
 *   Nên server không có đường nào tự đọc cây đó. Tệp này bắc cầu: quét `src/data/` ở ĐÂY,
 *   ở thời điểm BUILD, và ghi ra một tệp nằm trong `shared/` — thư mục mà cả server lẫn
 *   client đều biên dịch chung.
 *
 * ⚠️ TỆP SINH RA KHÔNG PHẢI "NGUỒN CHÂN LÝ THỨ HAI":
 *   Nguồn chân lý vẫn là `src/data/`. Tệp JSON chỉ là bản chiếu có cổng kiểm:
 *     • chạy `npm run gen:content-index` (không `--apply`) = CHẾ ĐỘ KIỂM. Lệch một trường
 *       cũng exit 1. `npm run ci` chạy đúng lệnh đó.
 *     • `tests/unit/content/content-index.test.ts` kiểm ĐỘC LẬP: nó đọc lại `src/data/`
 *       từ đĩa và đối chiếu từng trường. Hai đường, một đáp số — đúng mô hình của
 *       `tokens.css` ↔ `gen-theme-colors.ts` và `word-assets.json` ↔ `convert_words.py`.
 *   Sửa tay tệp JSON chỉ làm CI đỏ chứ không "sửa được" nội dung: phải sửa `src/data/`.
 *
 * ⚠️ CHỈ CHÉP THỨ SERVER CẦN — VÀ NAY `words` NẰM TRONG SỐ ĐÓ (T073).
 *   Ban đầu tệp này cố ý BỎ `words`/`exercises` ("mỗi trường thừa là một trường có thể lệch với
 *   `src/data/`, mà lại không ai đọc"). Báo cáo phụ huynh (T073) là người ĐỌC ĐẦU TIÊN của chữ
 *   của từ, nên `words` (id + en + vi) được sinh vào đây. `exercises` VẪN bỏ — vẫn không ai đọc.
 *   Thêm bất cứ trường nào nữa thì phải trả lời được: "ai đọc nó?".
 *
 * DÙNG:
 *   npx tsx scripts/gen-content-index.ts --apply   # ghi lại tệp JSON
 *   npx tsx scripts/gen-content-index.ts           # kiểm (mặc định) — `npm run ci` dùng lệnh này
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentIndexFileSchema, levelSchema, themeFileSchema } from '../shared/schemas/content.js';
import type { ContentIndexFile, ThemeFile } from '../shared/schemas/content.js';
import { finalTestManifestSchema, finalTestSectionFileSchema } from '../shared/schemas/final-test.js';
import type { FinalTestIndexEntry, FinalTestSectionId } from '../shared/schemas/final-test.js';
import { PLAYABLE_GAME_TYPES } from '../shared/types/content.js';
import type { GameType } from '../shared/types/content.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS_DIR = join(ROOT, 'src', 'data', 'levels');
const OUT_PATH = join(ROOT, 'shared', 'content', 'content-index.json');

/** Ném lỗi kèm ngữ cảnh — script sinh tệp không được đoán mò khi dữ liệu nguồn sai. */
function fail(message: string): never {
  console.error(`\n✗ gen-content-index: ${message}`);
  process.exit(1);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (e) {
    fail(`${path} không đọc được: ${(e as Error).message}`);
  }
}

/**
 * Sắp xếp khoá của mọi object theo alphabet, đệ quy.
 *
 * ⭐ Vì sao cần: chế độ KIỂM so SÂU hai cấu trúc. So bằng `JSON.stringify` thô thì chỉ cần ai
 *   đó sắp xếp lại khoá trong tệp JSON là CI báo "lệch" trong khi nội dung y hệt — một cảnh
 *   báo giả, và cảnh báo giả là thứ dạy người ta bỏ qua cảnh báo thật.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** 3 section của bài thi cuối khoá — ĐÚNG thứ tự này trong `manifest.sections` (V21 kiểm). */
const FINAL_TEST_SECTIONS: readonly FinalTestSectionId[] = ['listening', 'reading-writing', 'speaking'];

/**
 * Dựng tóm tắt bài thi cuối khoá của MỘT cấp, đọc từ `final-test/`. Trả `null` nếu cấp chưa có đề.
 *
 * ⚠️ Số part/item tính TỪ CHÍNH CÁC FILE SECTION (không tin số trong manifest) — index phải phản ánh
 *    SỰ THẬT trên đĩa. `manifest.sections` lệch với file là lỗi V21, do validator bắt.
 */
function buildFinalTestEntry(levelDirName: string): FinalTestIndexEntry | null {
  const dir = join(LEVELS_DIR, levelDirName, 'final-test');
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  const manifest = finalTestManifestSchema.safeParse(readJson(manifestPath));
  if (!manifest.success) {
    fail(
      `src/data/levels/${levelDirName}/final-test/manifest.json không hợp lệ: ` +
        manifest.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }

  const sections = FINAL_TEST_SECTIONS.map((section) => {
    const filePath = join(dir, `${section}.json`);
    const parsedFile = finalTestSectionFileSchema.safeParse(readJson(filePath));
    if (!parsedFile.success) {
      fail(
        `src/data/levels/${levelDirName}/final-test/${section}.json không hợp lệ: ` +
          parsedFile.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    const file = parsedFile.data;
    const itemCount = file.parts.reduce((sum, part) => sum + part.items.length, 0);
    return {
      section,
      partCount: file.parts.length,
      itemCount,
      autoScored: file.autoScored,
    };
  });

  return { id: manifest.data.id, version: manifest.data.version, sections };
}

/** Quét `src/data/levels/*` và dựng chỉ mục. Thứ tự đầu ra là XÁC ĐỊNH (không phụ thuộc đĩa). */
function buildIndex(): ContentIndexFile {
  if (!existsSync(LEVELS_DIR)) {
    fail(`không tìm thấy ${LEVELS_DIR}. Chạy script từ gốc repo rubylingo/.`);
  }

  const levels: ContentIndexFile['levels'] = [];
  const themes: ContentIndexFile['themes'] = [];
  /**
   * ⭐ CHỮ CỦA TỪ (T073) — gom từ MỌI tệp chủ đề, KHÔNG chỉ chủ đề level đã khai.
   *
   *   Lý do: một từ có thể được ĐỊNH NGHĨA ở chủ đề này nhưng được DẠY ở chủ đề khác (cùng lý do
   *   khiến `wordCount` hợp `lesson.wordIds` chứ không lấy `words.length`). Chỉ quét chủ đề đã
   *   khai sẽ THIẾU chữ của những từ như vậy, và báo cáo phụ huynh sẽ không gọi tên được chúng.
   */
  const wordById = new Map<string, { id: string; en: string; vi: string }>();

  const levelDirs: Array<{ dirName: string; path: string; order: number; id: string }> = [];

  for (const dirName of readdirSync(LEVELS_DIR).sort()) {
    const levelPath = join(LEVELS_DIR, dirName, 'level.json');
    if (!existsSync(levelPath)) continue;

    const parsed = levelSchema.safeParse(readJson(levelPath));
    if (!parsed.success) {
      fail(
        `src/data/levels/${dirName}/level.json không hợp lệ: ` +
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      );
    }
    if (parsed.data.id !== dirName) {
      fail(
        `thư mục "src/data/levels/${dirName}" chứa level.id = "${parsed.data.id}". ` +
          'Hai giá trị này phải trùng nhau, nếu không thì đường dẫn tới themes/ sẽ trỏ sai chỗ.',
      );
    }
    levelDirs.push({
      dirName,
      path: levelPath,
      order: parsed.data.order,
      id: parsed.data.id,
    });
  }

  if (levelDirs.length === 0) fail(`${LEVELS_DIR} không có level nào.`);

  // `level.order` là thứ tự cấp học (Starters=1, Movers=2…); `id` chỉ để phá thế bằng.
  levelDirs.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  for (const level of levelDirs) {
    const parsed = levelSchema.parse(readJson(level.path));

    /** Mọi exercise của cấp — để suy `requiredExerciseIds` (chỉ giữ game CHƠI ĐƯỢC). */
    const exercises: Array<{ id: string; gameType: GameType }> = [];

    const themesDir = join(LEVELS_DIR, level.dirName, 'themes');
    if (!existsSync(themesDir)) fail(`không tìm thấy thư mục chủ đề: ${themesDir}`);

    // Khoá theo `theme.id` (KHÔNG theo tên tệp): tên tệp là quy ước, `theme.id` là dữ liệu.
    const byThemeId = new Map<string, ThemeFile>();
    for (const fileName of readdirSync(themesDir).sort()) {
      if (!fileName.endsWith('.json')) continue;
      const filePath = join(themesDir, fileName);
      const themeParsed = themeFileSchema.safeParse(readJson(filePath));
      if (!themeParsed.success) {
        fail(
          `src/data/levels/${level.dirName}/themes/${fileName} không hợp lệ: ` +
            themeParsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        );
      }
      byThemeId.set(themeParsed.data.theme.id, themeParsed.data);
      for (const exercise of themeParsed.data.exercises) {
        exercises.push({ id: exercise.id, gameType: exercise.gameType });
      }

      /**
       * ⭐ Gom chữ của từ + KHỬ TRÙNG THEO `id`. Hai nơi định nghĩa cùng `id` mà `en`/`vi` KHÁC
       *    nhau ⇒ **NÉM LỖI NGAY**, không lặng lẽ lấy cái đầu.
       *
       *   Vì sao phải ồn ào: nếu ta lấy bừa một trong hai, báo cáo phụ huynh sẽ gọi tên một từ
       *   bằng NGHĨA MÀ BÉ CHƯA TỪNG ĐƯỢC HỌC — và không có lỗi nào nổi lên, vì cả hai nghĩa đều
       *   "hợp lệ" về hình thức. Đây đúng họ lỗi im lặng mà dự án đang chống: hai nguồn cho một
       *   sự thật thì phải để cổng bắt, chứ không tự phân xử.
       */
      for (const word of themeParsed.data.words) {
        const previous = wordById.get(word.id);
        if (!previous) {
          wordById.set(word.id, { id: word.id, en: word.en, vi: word.vi });
        } else if (previous.en !== word.en || previous.vi !== word.vi) {
          fail(
            `từ "${word.id}" được định nghĩa với CHỮ KHÁC NHAU ở hai nơi: ` +
              `"${previous.en}"/"${previous.vi}" và "${word.en}"/"${word.vi}". ` +
              'Mỗi id từ phải có ĐÚNG MỘT chữ — nếu không, báo cáo phụ huynh có thể gọi tên từ ' +
              'bằng nghĩa mà bé chưa từng được học.',
          );
        }
      }
    }

    parsed.themeIds.forEach((themeId, position) => {
      const file = byThemeId.get(themeId);
      if (!file) {
        fail(
          `level "${parsed.id}" khai themeIds có "${themeId}" nhưng không có tệp chủ đề tương ứng ` +
            `(themes/${themeId}.json). Validator V2 sẽ báo lỗi này.`,
        );
      }

      // Đếm từ theo ĐÚNG luật của `src/data/index.ts`: hợp `lesson.wordIds` theo thứ tự bài,
      // KHÔNG lấy `words.length` (một từ có thể được dạy ở chủ đề khác với nơi định nghĩa nó).
      const lessonById = new Map(file.lessons.map((lesson) => [lesson.id, lesson]));
      const seen = new Set<string>();
      for (const lessonId of file.theme.lessonIds) {
        const lesson = lessonById.get(lessonId);
        if (!lesson) continue; // V8 chặn ở validator; ở đây bỏ qua để tệp vẫn sinh được.
        for (const wordId of lesson.wordIds) {
          if (!seen.has(wordId)) seen.add(wordId);
        }
      }

      themes.push({
        id: themeId,
        levelId: parsed.id,
        index: position + 1,
        lessonIds: [...file.theme.lessonIds],
        wordCount: seen.size,
        hasGames: file.exercises.length > 0,
        unlock: file.theme.unlockCondition,
      });
    });

    // Chỉ giữ exercise có game CHƠI ĐƯỢC (có component). Đòi bé "chơi hết" một trò chưa tồn tại
    // sẽ khiến cổng mở khoá bài thi BẤT KHẢ THI — xem `PLAYABLE_GAME_TYPES`.
    const requiredExerciseIds = exercises
      .filter((exercise) => PLAYABLE_GAME_TYPES.includes(exercise.gameType))
      .map((exercise) => exercise.id)
      .sort();

    levels.push({
      id: parsed.id,
      themeIds: [...parsed.themeIds],
      requiredExerciseIds,
      finalTest: buildFinalTestEntry(level.dirName),
    });
  }

  const index: ContentIndexFile = {
    note:
      'SINH TỰ ĐỘNG bởi scripts/gen-content-index.ts từ src/data/levels/**. KHÔNG sửa tay — ' +
      'sửa src/data/ rồi chạy `npm run gen:content-index -- --apply`.',
    levels,
    themes,
    // Sắp theo `id` để thứ tự đầu ra XÁC ĐỊNH (không phụ thuộc thứ tự đọc đĩa/Map).
    words: [...wordById.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };

  // Tự kiểm trước khi ghi: một chỉ mục hỏng phải làm script đỏ, không được ghi ra đĩa.
  const checked = contentIndexFileSchema.safeParse(index);
  if (!checked.success) {
    fail(
      'chỉ mục vừa dựng không khớp contentIndexFileSchema: ' +
        checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  }
  return index;
}

// =============================================================================
// So với tệp đang có trên đĩa
// =============================================================================

const built = buildIndex();
const pretty = `${JSON.stringify(built, null, 2)}\n`;
const apply = process.argv.includes('--apply');

if (apply) {
  writeFileSync(OUT_PATH, pretty, 'utf8');
  console.log(
    `→ Đã ghi shared/content/content-index.json: ` +
      `${built.levels.length} cấp, ${built.themes.length} chủ đề.`,
  );
  process.exit(0);
}

if (!existsSync(OUT_PATH)) {
  console.error(
    `\n✗ Thiếu ${OUT_PATH}.\n` +
      '   Chạy `npx tsx scripts/gen-content-index.ts --apply` để sinh, rồi commit tệp đó.',
  );
  process.exit(1);
}

const onDisk = readJson(OUT_PATH);
if (stableStringify(onDisk) !== stableStringify(built)) {
  // Chỉ ra chủ đề nào lệch — không in cả tệp.
  const asMap = (v: unknown): Map<string, string> => {
    const out = new Map<string, string>();
    const themes = (v as ContentIndexFile)?.themes ?? [];
    for (const t of themes) out.set(`${t.levelId}/${t.id}`, stableStringify(t));
    return out;
  };
  const before = asMap(onDisk);
  const after = asMap(built);
  const diff: string[] = [];
  for (const [key, want] of after) {
    const now = before.get(key);
    if (now !== want) diff.push(`  ${key}: ${now ? 'nội dung khác' : 'THIẾU'}`);
  }
  for (const key of before.keys()) if (!after.has(key)) diff.push(`  ${key}: THỪA (không còn trong src/data)`);

  console.error(
    `\n✗ shared/content/content-index.json LỆCH khỏi src/data/.\n` +
      (diff.length > 0 ? `${diff.join('\n')}\n` : '') +
      '⇒ tệp nói "do script sinh" nhưng không còn đúng.\n' +
      '   Chạy `npx tsx scripts/gen-content-index.ts --apply` để ghi lại.',
  );
  process.exit(1);
}

console.log(
  `✓ shared/content/content-index.json khớp src/data/ ` +
    `(${built.levels.length} cấp, ${built.themes.length} chủ đề).`,
);
