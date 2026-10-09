/**
 * RubyLingo — Registry NỘI DUNG HỌC.
 *
 * Nhiệm vụ: tìm file JSON của một level, lập chỉ mục, và trả về `LevelBundle`.
 * `ContentRepository` là lớp bọc có cache + API tiện dụng; file này là tầng "đọc đĩa".
 *
 * ⭐ VÌ SAO DÙNG `import.meta.glob` MÀ KHÔNG IMPORT TAY TỪNG FILE:
 *    Thêm cấp Movers/Flyers (hoặc thêm chủ đề mới) phải chỉ cần **thả file JSON vào**,
 *    KHÔNG phải sửa code. Import tay thì mỗi lần thêm chủ đề lại phải nhớ sửa file này —
 *    đúng cái bẫy mà kiến trúc "nội dung là dữ liệu" sinh ra để tránh.
 *
 * ⭐ THỨ TỰ CHỦ ĐỀ LẤY TỪ `level.themeIds`, KHÔNG từ tên file:
 *    Đó là nguồn chân lý duy nhất cho bản đồ hành trình và cho luật mở khoá
 *    (`previous_theme`). Trước đây mỗi theme có thêm trường `order` và nó đã lệch
 *    với `themeIds` — nên trường đó đã bị xoá.
 */

import type {
  Exercise,
  Lesson,
  Level,
  LevelBundle,
  Theme,
  ThemeBundle,
  Word,
} from '@shared/types/content.js';
import type { ThemeFile } from '@shared/schemas/content.js';
import { themeFileSchema } from '@shared/schemas/content.js';

// Manifest ảnh từ vựng — do `asset-src/words/convert_words.py` sinh từ đĩa.
import wordAssets from './word-assets.json';

/** Cấp học mặc định khi không truyền gì. */
export const DEFAULT_LEVEL_ID = 'starters';

// --- Nạp module JSON (Vite thay bằng import tĩnh lúc build) -------------------

const LEVEL_MODULES = import.meta.glob<Level>('./levels/*/level.json', {
  eager: true,
  import: 'default',
});

const THEME_MODULES = import.meta.glob<ThemeFile>('./levels/*/themes/*.json', {
  eager: true,
  import: 'default',
});

/** './levels/starters/level.json' → 'starters' */
const LEVEL_PATH_RE = /^\.\/levels\/([^/]+)\/level\.json$/;
/** './levels/starters/themes/at-the-zoo.json' → ['starters', 'at-the-zoo'] */
const THEME_PATH_RE = /^\.\/levels\/([^/]+)\/themes\/([^/]+)\.json$/;

// --- API ---------------------------------------------------------------------

/** Id của mọi level có file trên đĩa (VD: ['starters']). */
export function listLevelIds(): string[] {
  const ids = new Set<string>();
  for (const path of Object.keys(LEVEL_MODULES)) {
    const m = LEVEL_PATH_RE.exec(path);
    if (m?.[1]) ids.add(m[1]);
  }
  return [...ids].sort();
}

export function hasLevel(levelId: string): boolean {
  return listLevelIds().includes(levelId);
}

/**
 * Khoá asset tranh cảnh ⇒ URL công khai.
 *
 * MỘT CHỖ DUY NHẤT quyết định đường dẫn này. Server phục vụ thư mục `assets/` tại
 * `/assets/` (xem `server/app.ts`), nên đổi cách phục vụ chỉ phải sửa hàm này.
 */
export function sceneAssetUrl(key: string): string {
  return `/assets/scenes/${key}.webp`;
}

/**
 * Như `sceneAssetUrl` nhưng trả `null` khi chủ đề CHƯA có tranh (`sceneImage === ''`).
 * UI cần phân biệt "chưa có tranh" với "có tranh" — chuỗi rỗng không được biến thành
 * URL `/assets/scenes/.webp` rồi gây 404 ồn ào.
 */
export function sceneAssetUrlOrNull(key: string): string | null {
  return key.trim() === '' ? null : sceneAssetUrl(key);
}

// --- Hình minh hoạ từ vựng ----------------------------------------------------

/**
 * Danh sách id từ vựng ĐÃ CÓ ảnh.
 *
 * Tệp này do `asset-src/words/convert_words.py` quét ĐĨA rồi sinh, nên nó không thể
 * lệch với thực tế: có tệp `.webp` thì có id, xoá tệp thì id biến mất.
 *
 * ⭐ VÌ SAO PHẢI CÓ DANH SÁCH NÀY, KHÔNG ĐƯỢC ĐOÁN:
 *    Client không `stat` được tệp. Nếu `WordIcon` cứ trỏ `/assets/words/x.webp` cho mọi
 *    từ thì 201 từ chưa sinh xong đều 404 ⇒ bé thấy ô vỡ. Nếu lùi về emoji bằng `onError`
 *    thì hình nhấp nháy, và trong jsdom `onError` không bao giờ chạy ⇒ không test được.
 *    Đọc một danh sách có sẵn là cách duy nhất vừa đúng vừa kiểm chứng được.
 */
const WORD_ASSET_IDS: ReadonlySet<string> = new Set(wordAssets.ids);

/** Đường dẫn ảnh minh hoạ của một từ. Tên tệp = ID ĐẦY ĐỦ (kể cả `starters.`). */
export function wordAssetUrl(wordId: string): string {
  return `/assets/words/${wordId}.webp`;
}

/**
 * URL ảnh minh hoạ, hoặc `null` nếu từ đó CHƯA có ảnh (khi đó UI lùi về emoji).
 *
 * Dùng id đầy đủ chứ không dùng `word.en`: `orange-adj` (màu cam) và `orange-n`
 * (quả cam) là hai từ khác nhau, cùng viết "orange"; `mouse-computer` (chuột máy tính)
 * khác `mouse` (con chuột). Khoá theo `en` sẽ gán nhầm hình cho nhau.
 */
export function wordAssetUrlOrNull(wordId: string): string | null {
  return WORD_ASSET_IDS.has(wordId) ? wordAssetUrl(wordId) : null;
}

/**
 * Đọc + lập chỉ mục một level. Ném lỗi nếu level không tồn tại — đây là lỗi lập trình
 * (gõ sai id), không phải lỗi người dùng, nên phải ồn ào ngay chứ không im lặng trả rỗng.
 */
export function readLevelBundle(levelId: string): LevelBundle {
  const level = findLevelJson(levelId);
  if (!level) {
    throw new Error(
      `Không tìm thấy level "${levelId}". Có sẵn: ${listLevelIds().join(', ') || '(không có)'}. ` +
        'Kiểm tra đã có file src/data/levels/<id>/level.json chưa.',
    );
  }

  const themeFiles = findThemeFiles(levelId);

  // THỨ TỰ theo level.themeIds — xem ghi chú đầu file.
  const themes: Theme[] = [];
  const lessons: Lesson[] = [];
  const words: Word[] = [];
  const exercises: Exercise[] = [];
  const wordIdsByTheme = new Map<string, string[]>();

  const missing: string[] = [];

  for (const themeId of level.themeIds) {
    const file = themeFiles.get(themeId);
    if (!file) {
      // Validator đã chặn trường hợp này (V2). Ở đây chỉ bỏ qua để app vẫn chạy được
      // phần còn lại thay vì trắng màn hình vì một chủ đề thiếu file.
      missing.push(themeId);
      continue;
    }

    themes.push(file.theme);

    // Bài học: thứ tự theo theme.lessonIds (nguồn chân lý duy nhất).
    const lessonById = new Map(file.lessons.map((l) => [l.id, l]));
    const orderedLessons: Lesson[] = [];
    for (const lessonId of file.theme.lessonIds) {
      const lesson = lessonById.get(lessonId);
      if (lesson) orderedLessons.push(lesson);
    }
    lessons.push(...orderedLessons);

    words.push(...file.words);
    exercises.push(...file.exercises);

    // Từ dùng được trong chủ đề = hợp của wordIds các bài, theo thứ tự xuất hiện.
    // KHÔNG lấy theo `word.primaryThemeId`: một từ có thể được DẠY ở chủ đề khác với
    // nơi định nghĩa nó (quy ước "cùng nghĩa ở 2 theme ⇒ định nghĩa MỘT lần").
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const lesson of orderedLessons) {
      for (const wordId of lesson.wordIds) {
        if (seen.has(wordId)) continue;
        seen.add(wordId);
        ids.push(wordId);
      }
    }
    wordIdsByTheme.set(themeId, ids);
  }

  if (missing.length > 0) {
    console.warn(
      `[RubyLingo] Level "${levelId}" thiếu file cho chủ đề: ${missing.join(', ')}. ` +
        'Chạy `npm run validate:content` để xem chi tiết.',
    );
  }

  return {
    level,
    themes,
    lessons,
    words,
    exercises,
    // Trùng id là lỗi dữ liệu (validator V4/V9 chặn). Ở đây "first wins" để hành vi
    // xác định thay vì phụ thuộc thứ tự duyệt.
    wordById: firstWins(words),
    lessonById: firstWins(lessons),
    themeById: firstWins(themes),
    exerciseById: firstWins(exercises),
    wordIdsByTheme,
  };
}

/** Gói nội dung của một chủ đề, tra từ bundle đã lập chỉ mục. */
export function sliceTheme(bundle: LevelBundle, themeId: string): ThemeBundle | null {
  const theme = bundle.themeById.get(themeId);
  if (!theme) return null;

  const lessonIds = new Set(theme.lessonIds);
  const wordIdSet = new Set(bundle.wordIdsByTheme.get(themeId) ?? []);

  return {
    theme,
    lessons: bundle.lessons.filter((l) => lessonIds.has(l.id)),
    words: bundle.words.filter((w) => wordIdSet.has(w.id)),
    exercises: bundle.exercises.filter((e) => lessonIds.has(e.lessonId)),
  };
}

// --- Nội bộ ------------------------------------------------------------------

function findLevelJson(levelId: string): Level | null {
  for (const [path, level] of Object.entries(LEVEL_MODULES)) {
    if (LEVEL_PATH_RE.exec(path)?.[1] === levelId) return level;
  }
  return null;
}

function findThemeFiles(levelId: string): Map<string, ThemeFile> {
  const byThemeId = new Map<string, ThemeFile>();
  for (const [path, file] of Object.entries(THEME_MODULES)) {
    const m = THEME_PATH_RE.exec(path);
    if (!m || m[1] !== levelId) continue;

    if (import.meta.env.DEV) assertValidThemeFile(path, file);
    byThemeId.set(file.theme.id, file);
  }
  return byThemeId;
}

/**
 * Kiểm schema NGAY khi nạp — CHỈ ở môi trường dev.
 *
 * Ở production bỏ qua vì `npm run ci` đã chạy `validate:content` trước khi build; nhờ
 * vậy zod không vào bundle. Ở dev thì cần: sửa JSON mà quên chạy validator sẽ hiện
 * lỗi ngay tại chỗ thay vì âm thầm hiển thị sai.
 */
function assertValidThemeFile(path: string, file: unknown): void {
  const parsed = themeFileSchema.safeParse(file);
  if (parsed.success) return;
  const first = parsed.error.issues[0];
  console.error(
    `[RubyLingo] ${path} KHÔNG hợp lệ: ` +
      `${first ? `${first.path.join('.')} — ${first.message}` : '(không rõ)'}\n` +
      'Chạy `npm run validate:content` để xem đầy đủ.',
  );
}

function firstWins<T extends { id: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return map;
}
