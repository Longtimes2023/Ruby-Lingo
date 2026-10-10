#!/usr/bin/env tsx
/**
 * RubyLingo — Validator nội dung.
 *
 * Chạy: npm run validate:content
 *
 * Mục đích: chặn dữ liệu lỗi TRƯỚC khi build. Mọi quy tắc ở đây đều xuất phát từ
 * những lỗi THẬT đã từng xảy ra khi sinh nội dung — không phải quy tắc lý thuyết:
 *
 *   V5  thiếu `picturable`              ⇒ game Nghe & Chạm không có hình để chạm
 *   V6  trùng emoji trong 1 chủ đề      ⇒ bé chạm ĐÚNG mà app báo sai ⇒ mất niềm tin
 *   V4  trùng `word.id` toàn cấp        ⇒ tiến độ 2 nghĩa khác nhau bị gộp ⇒ báo cáo sai
 *   V7  bài ngoài 4–8 từ                ⇒ lưới từ tràn màn hình điện thoại
 *   V10 chủ đề đầu để `previous_theme`  ⇒ BẢN ĐỒ HÀNH TRÌNH CHẾT, không mở được gì
 *   V11 game dạng hình < 4 từ picturable⇒ bé không có đủ hình để chọn
 *   V15 trùng icon tiền tệ ↔ vật phẩm   ⇒ bé tưởng vật phẩm là tiền
 *   V17 trùng `key` ở global-scenes.json⇒ một màn hình lấy nhầm tranh của màn khác
 *   V18 trùng `id`/`icon` avatar         ⇒ hai avatar nhìn GIỐNG HỆT nhau, bé chọn mà không
 *                                          phân biệt được mình đã chọn bạn nào
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  levelSchema,
  themeFileSchema,
  xpLevelsFileSchema,
  questsFileSchema,
  shopItemsFileSchema,
  badgesFileSchema,
  stickersFileSchema,
  globalScenesFileSchema,
  avatarsFileSchema,
} from '../shared/schemas/content.js';
// `ThemeFile` = z.infer<typeof themeFileSchema> ⇒ sống ở schemas, KHÔNG phải types.
import type { ThemeFile } from '../shared/schemas/content.js';
import { finalTestManifestSchema, finalTestSectionFileSchema } from '../shared/schemas/final-test.js';
import type { FinalTestSectionId } from '../shared/schemas/final-test.js';
import { auditFinalTestCambridge, auditFinalTestItem } from '../shared/final-test-rules.js';
import { PICTURE_GAME_TYPES, MVP_GAME_TYPES } from '../shared/types/content.js';
import type { GameType } from '../shared/types/content.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS_DIR = join(ROOT, 'src', 'data', 'levels');
const CONTENT_DIR = join(ROOT, 'shared', 'content');
const SCENES_DIR = join(ROOT, 'assets', 'scenes');

type Severity = 'error' | 'warning';
interface Issue {
  severity: Severity;
  rule: string;
  message: string;
}

const issues: Issue[] = [];
const err = (rule: string, message: string) => issues.push({ severity: 'error', rule, message });
const warn = (rule: string, message: string) => issues.push({ severity: 'warning', rule, message });

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    err('V1', `Không tìm thấy file: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (e) {
    err('V1', `JSON không hợp lệ ở ${path}: ${(e as Error).message}`);
    return null;
  }
}

/** Đưa lỗi của Zod về dạng dễ đọc: "theme.unlockCondition.type: ..." */
function formatZod(prefix: string, error: { issues: Array<{ path: (string | number)[]; message: string }> }) {
  for (const i of error.issues) {
    err('V3', `${prefix} → ${i.path.join('.') || '(gốc)'}: ${i.message}`);
  }
}

// =============================================================================
// 1. NỘI DUNG HỌC
// =============================================================================

interface LevelJson {
  id: string;
  code: string;
  name_en: string;
  name_vi: string;
  themeIds: string[];
}

function validateLevels() {
  if (!existsSync(LEVELS_DIR)) {
    err('V1', `Không tìm thấy thư mục nội dung: ${LEVELS_DIR}`);
    return;
  }

  for (const levelDirName of readdirSync(LEVELS_DIR)) {
    const levelDir = join(LEVELS_DIR, levelDirName);
    const levelJsonPath = join(levelDir, 'level.json');
    const rawLevel = readJson<LevelJson>(levelJsonPath);
    if (!rawLevel) continue;

    const parsedLevel = levelSchema.safeParse(rawLevel);
    if (!parsedLevel.success) {
      formatZod(`levels/${levelDirName}/level.json`, parsedLevel.error);
      continue;
    }
    const level = parsedLevel.data;

    // --- Nạp tất cả theme -----------------------------------------------
    const themesDir = join(levelDir, 'themes');
    const bundles: ThemeFile[] = [];
    const fileByThemeId = new Map<string, string>();
    /** Tên file (không .json) có mặt trên đĩa — để V2 phân biệt "thiếu file" vs "file sai". */
    const filesOnDisk = new Set<string>();
    /** Tên file CÓ trên đĩa nhưng trượt schema (đã báo [V3]). */
    const filesInvalid = new Set<string>();

    for (const file of readdirSync(themesDir).filter((f) => f.endsWith('.json'))) {
      const base = file.replace(/\.json$/, '');
      filesOnDisk.add(base);
      const path = join(themesDir, file);
      const raw = readJson<ThemeFile>(path);
      if (!raw) continue;

      const parsed = themeFileSchema.safeParse(raw);
      if (!parsed.success) {
        filesInvalid.add(base);
        formatZod(`themes/${file}`, parsed.error);
        continue;
      }
      bundles.push(parsed.data);
      fileByThemeId.set(parsed.data.theme.id, file);
    }

    // --- V2: level.json.themeIds phải khớp file có thật ------------------
    // Ba trường hợp KHÁC NHAU, thông báo phải khác nhau — nếu gộp thành
    // "không có file" thì người bảo trì sẽ đi tìm một file vốn đã tồn tại.
    for (const tid of level.themeIds) {
      if (fileByThemeId.has(tid)) continue;
      if (filesInvalid.has(tid)) {
        err(
          'V2',
          `level.json liệt kê "${tid}" — file themes/${tid}.json CÓ trên đĩa nhưng KHÔNG HỢP LỆ (xem lỗi [V3] của chính file đó ở trên). Sửa nội dung file, đừng đi tìm file khác.`,
        );
      } else if (filesOnDisk.has(tid)) {
        err(
          'V2',
          `level.json liệt kê "${tid}" — file themes/${tid}.json có trên đĩa nhưng trường theme.id bên trong KHÔNG phải "${tid}". Sửa theme.id cho khớp tên file.`,
        );
      } else {
        err('V2', `level.json liệt kê "${tid}" nhưng không có file themes/${tid}.json`);
      }
    }
    for (const [tid, file] of fileByThemeId) {
      if (!level.themeIds.includes(tid)) {
        err('V2', `themes/${file} có id "${tid}" nhưng level.json.themeIds không liệt kê`);
      }
    }

    // Sắp theo thứ tự bản đồ — thứ tự này quyết định luật mở khoá.
    const ordered = level.themeIds
      .map((tid) => bundles.find((b) => b.theme.id === tid))
      .filter((b): b is ThemeFile => Boolean(b));

    // --- V10: luật mở khoá ----------------------------------------------
    const alwaysThemes = ordered.filter((b) => b.theme.unlockCondition.type === 'always');
    if (alwaysThemes.length === 0) {
      err(
        'V10',
        'KHÔNG có chủ đề nào có unlockCondition = "always" ⇒ bản đồ hành trình không thể mở được gì. ' +
          'Chủ đề ĐẦU TIÊN trong level.json.themeIds phải là "always".',
      );
    }
    if (alwaysThemes.length > 1) {
      err(
        'V10',
        `Có ${alwaysThemes.length} chủ đề "always" (${alwaysThemes.map((b) => b.theme.id).join(', ')}) — chỉ chủ đề đầu tiên được phép.`,
      );
    }
    const first = ordered[0];
    if (first && first.theme.unlockCondition.type !== 'always') {
      err(
        'V10',
        `Chủ đề đầu tiên "${first.theme.id}" có unlockCondition = "${first.theme.unlockCondition.type}" nhưng phải là "always".`,
      );
    }
    for (const b of ordered.slice(1)) {
      if (b.theme.unlockCondition.type === 'always') {
        err('V10', `Chủ đề "${b.theme.id}" là "always" nhưng không phải chủ đề đầu tiên.`);
      }
    }

    // --- Index toàn cấp (KHÔNG chỉ trong từng theme) ---------------------
    const wordOwner = new Map<string, string>(); // wordId -> themeId
    const allLessonIds = new Set<string>();
    const allExerciseIds = new Set<string>();

    for (const b of ordered) {
      for (const l of b.lessons) allLessonIds.add(l.id);
      for (const e of b.exercises) allExerciseIds.add(e.id);
    }

    // --- V4: word.id duy nhất TOÀN CẤP -----------------------------------
    for (const b of ordered) {
      for (const w of b.words) {
        const prev = wordOwner.get(w.id);
        if (prev) {
          err(
            'V4',
            `word.id "${w.id}" bị định nghĩa ở CẢ "${prev}" và "${b.theme.id}" (en="${w.en}", vi="${w.vi}"). ` +
              'Một id = một NGHĨA. Khác nghĩa ⇒ thêm hậu tố ("chicken-meat", "orange-n"/"orange-adj"); ' +
              'cùng nghĩa ⇒ chỉ định nghĩa MỘT lần, theme kia tham chiếu id trong lesson.wordIds.',
          );
        }
        wordOwner.set(w.id, b.theme.id);
      }
    }

    for (const b of ordered) {
      const tid = b.theme.id;
      const file = fileByThemeId.get(tid) ?? `${tid}.json`;

      // --- V5: `picturable` là boolean (schema đã bắt, kiểm tra lại cho chắc)
      for (const w of b.words) {
        if (typeof w.picturable !== 'boolean') {
          err('V5', `themes/${file}: từ "${w.id}" thiếu trường picturable`);
        }
      }

      // --- V6: emoji phải DUY NHẤT trong chủ đề --------------------------
      const iconUsers = new Map<string, string[]>();
      for (const w of b.words) {
        const list = iconUsers.get(w.icon) ?? [];
        list.push(`${w.id} (${w.en})`);
        iconUsers.set(w.icon, list);
      }
      for (const [icon, users] of iconUsers) {
        if (users.length > 1) {
          err(
            'V6',
            `themes/${file}: emoji "${icon}" dùng cho ${users.length} từ ⇒ game dạng hình không phân biệt được: ${users.join(' | ')}. ` +
              'Cho phép ghép 1–3 emoji (vd "🛋️📺") miễn là duy nhất trong chủ đề.',
          );
        }
      }

      // --- V7: kích thước bài (schema đã bắt; kiểm tra lại để báo rõ file)
      for (const l of b.lessons) {
        if (l.wordIds.length < 4 || l.wordIds.length > 8) {
          err('V7', `themes/${file}: bài "${l.id}" có ${l.wordIds.length} từ (phải 4–8)`);
        }
      }

      // --- V8: lessonIds ↔ lessons --------------------------------------
      const lessonIdSet = new Set(b.lessons.map((l) => l.id));
      for (const lid of b.theme.lessonIds) {
        if (!lessonIdSet.has(lid)) {
          err('V8', `themes/${file}: theme.lessonIds chứa "${lid}" nhưng không có lesson tương ứng`);
        }
      }
      for (const l of b.lessons) {
        if (!b.theme.lessonIds.includes(l.id)) {
          err('V8', `themes/${file}: lesson "${l.id}" không có trong theme.lessonIds`);
        }
        if (l.themeId !== tid) {
          err('V8', `themes/${file}: lesson "${l.id}" có themeId="${l.themeId}" nhưng file là "${tid}"`);
        }
      }

      // --- V9: exerciseIds ↔ exercises ----------------------------------
      const exerciseIdSet = new Set(b.exercises.map((e) => e.id));
      for (const l of b.lessons) {
        for (const eid of l.exerciseIds) {
          if (!exerciseIdSet.has(eid)) {
            err('V9', `themes/${file}: bài "${l.id}" tham chiếu exercise "${eid}" không tồn tại`);
          }
        }
      }
      for (const e of b.exercises) {
        if (!lessonIdSet.has(e.lessonId)) {
          err('V9', `themes/${file}: exercise "${e.id}" trỏ tới lesson "${e.lessonId}" không tồn tại`);
        }
        if (e.config.kind !== e.gameType) {
          err(
            'V9',
            `themes/${file}: exercise "${e.id}" có gameType="${e.gameType}" nhưng config.kind="${e.config.kind}" — phải khớp nhau`,
          );
        }
      }

      // --- V20: aggregate exercise coverage ------------------------------
      for (const lesson of b.lessons) {
        const covered = new Set(
          b.exercises.filter((exercise) => exercise.lessonId === lesson.id).flatMap((exercise) => exercise.wordIds),
        );
        const missing = lesson.wordIds.filter((wordId) => !covered.has(wordId));
        if (missing.length > 0) {
          err(
            'V20',
            `themes/${file}: bài "${lesson.id}" có từ không tham gia bất kỳ exercise nào: ${missing.join(', ')}`,
          );
        }
      }

      // --- V11: game dạng hình cần >= 4 từ picturable -------------------
      const wordById = new Map(b.words.map((w) => [w.id, w]));
      for (const e of b.exercises) {
        const usesVietnameseText =
          e.gameType === 'memory_match' && e.config.kind === 'memory_match' && e.config.pairMode === 'en_vi';
        if (PICTURE_GAME_TYPES.includes(e.gameType) && !usesVietnameseText) {
          const picturable = e.wordIds.filter((id) => wordById.get(id)?.picturable === true);
          if (picturable.length < 4) {
            err(
              'V11',
              `themes/${file}: exercise "${e.id}" (${e.gameType}) chỉ có ${picturable.length} từ picturable (cần >= 4). ` +
                'Từ trừu tượng không có hình để bé chạm.',
            );
          }
        }
        for (const id of e.wordIds) {
          if (!wordById.has(id)) {
            err('V9', `themes/${file}: exercise "${e.id}" tham chiếu từ "${id}" không có trong theme này`);
          }
        }

      }

      // --- V12: tranh cảnh ---------------------------------------------
      if (b.theme.sceneImage === '') {
        // Hợp lệ: chủ đề chưa có tranh. Bỏ qua.
      } else if (!existsSync(join(SCENES_DIR, `${b.theme.sceneImage}.webp`))) {
        warn(
          'V12',
          `themes/${file}: sceneImage="${b.theme.sceneImage}" nhưng chưa có assets/scenes/${b.theme.sceneImage}.webp (cảnh báo, không phải lỗi)`,
        );
      }
      if (b.theme.sceneImage !== '' && b.theme.sceneAlt.trim() === '') {
        err('V12', `themes/${file}: có sceneImage nhưng sceneAlt rỗng — cần mô tả tiếng Việt cho screen reader`);
      }
    }

    // --- V13: primaryThemeId / primaryLessonId phải trỏ đúng -----------
    for (const b of ordered) {
      const file = fileByThemeId.get(b.theme.id) ?? `${b.theme.id}.json`;
      for (const w of b.words) {
        if (w.primaryThemeId !== b.theme.id) {
          err(
            'V13',
            `themes/${file}: từ "${w.id}" có primaryThemeId="${w.primaryThemeId}" nhưng nằm trong "${b.theme.id}"`,
          );
        }
        if (!allLessonIds.has(w.primaryLessonId)) {
          err('V13', `themes/${file}: từ "${w.id}" có primaryLessonId="${w.primaryLessonId}" không tồn tại`);
        }
      }
    }

    // --- V14: từ trong lesson.wordIds phải tồn tại (cho phép tham chiếu chéo theme)
    for (const b of ordered) {
      const file = fileByThemeId.get(b.theme.id) ?? `${b.theme.id}.json`;
      for (const l of b.lessons) {
        for (const wid of l.wordIds) {
          if (!wordOwner.has(wid)) {
            err('V14', `themes/${file}: bài "${l.id}" tham chiếu từ "${wid}" không tồn tại ở bất kỳ chủ đề nào`);
          }
        }
      }
    }

    // --- Thông tin: số game MVP đã có ---------------------------------
    const gamesInUse = new Set<GameType>();
    for (const b of ordered) for (const e of b.exercises) gamesInUse.add(e.gameType);
    const missingMvp = MVP_GAME_TYPES.filter((g) => !gamesInUse.has(g));

    console.log(
      `\n📚 Level "${level.id}": ${ordered.length} chủ đề · ` +
        `${ordered.reduce((s, b) => s + b.words.length, 0)} từ · ` +
        `${ordered.reduce((s, b) => s + b.lessons.length, 0)} bài · ` +
        `${ordered.reduce((s, b) => s + b.exercises.length, 0)} exercise`,
    );
    if (missingMvp.length > 0) {
      console.log(
        `   ℹ️  Game MVP chưa gắn exercise nào: ${missingMvp.join(', ')} ` +
          '(bình thường ở giai đoạn này — sẽ gắn khi làm nhóm Game)',
      );
    }
  }
}

// =============================================================================
// 1b. BÀI THI CUỐI KHOÁ (V21–V27) — TÁCH RIÊNG khỏi luật nội dung học V1–V20
// =============================================================================
//
// ⚠️ Mọi luật ở đây là LỖI (không phải cảnh báo): lệch ⇒ server chấm thiếu/thừa câu, khiên sai, hoặc
//    bé không thể giành được đáp án. V27 là ràng buộc BẢN QUYỀN cứng (đề phải TỰ SOẠN).
//
//   V21  manifest khớp đúng 3 section + số part/item THẬT trong từng file
//   V22  id item duy nhất toàn level, và đúng quy ước "…p<part>.q<n>"
//   V23  answer/wordId hợp lệ (đáp án phải chọn được, wordId phải có thật)
//   V24  arrange_letters: hintMask + tập chữ cái xáo trộn khớp answer
//   V25  audioTextEn/promptEn CHỈ tiếng Anh (không dấu tiếng Việt)
//   V26  trần khiên = 5, và autoScored đúng theo từng phần (Speaking: false)
//   V27  source = "original" + không chuỗi nhận dạng đề Cambridge
//
// Luật V23–V25, V27 nằm trong `shared/final-test-rules.ts` (hàm THUẦN) để test gọi lại được —
// một mã, hai nơi dùng (xem đầu file luật đó).

const FINAL_TEST_SECTIONS: readonly FinalTestSectionId[] = ['listening', 'reading-writing', 'speaking'];

/** Tập id từ CÓ THẬT của một level (đọc mọi file theme). */
function collectLevelWordIds(levelDir: string): Set<string> {
  const ids = new Set<string>();
  const themesDir = join(levelDir, 'themes');
  if (!existsSync(themesDir)) return ids;
  for (const f of readdirSync(themesDir).filter((x) => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(readFileSync(join(themesDir, f), 'utf8')) as {
        words?: Array<{ id: string }>;
      };
      for (const w of d.words ?? []) ids.add(w.id);
    } catch {
      /* lỗi parse đã báo ở validateLevels */
    }
  }
  return ids;
}

/** Mọi chuỗi HIỂN THỊ/ĐỌC của một item — dùng cho V27 (không gồm `note`). */
function itemTexts(item: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(item)) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string') out.push(v);
    }
  }
  return out;
}

function validateFinalTest() {
  if (!existsSync(LEVELS_DIR)) return; // V1 đã báo.

  for (const levelDirName of readdirSync(LEVELS_DIR)) {
    const levelDir = join(LEVELS_DIR, levelDirName);
    const ftDir = join(levelDir, 'final-test');
    if (!existsSync(ftDir)) continue;

    const rawManifest = readJson<unknown>(join(ftDir, 'manifest.json'));
    if (!rawManifest) continue;
    const parsedManifest = finalTestManifestSchema.safeParse(rawManifest);
    if (!parsedManifest.success) {
      formatZod(`levels/${levelDirName}/final-test/manifest.json`, parsedManifest.error);
      continue;
    }
    const manifest = parsedManifest.data;

    // V27: KHẲNG ĐỊNH bản quyền — đề phải TỰ SOẠN.
    if (manifest.source !== 'original') {
      err('V27', `levels/${levelDirName}/final-test/manifest.json: source "${manifest.source}" — bắt buộc "original"`);
    }

    // V21: đúng 3 section, ĐÚNG THỨ TỰ.
    const order = manifest.sections.map((s) => s.section);
    if (order.join(',') !== FINAL_TEST_SECTIONS.join(',')) {
      err(
        'V21',
        `levels/${levelDirName}/final-test: manifest.sections phải là [${FINAL_TEST_SECTIONS.join(', ')}] theo đúng thứ tự, đang là [${order.join(', ')}]`,
      );
    }

    const wordIds = collectLevelWordIds(levelDir);
    const allItemIds = new Set<string>();
    const cambridgeTexts: string[] = [];
    let autoScoredItems = 0;

    for (const section of FINAL_TEST_SECTIONS) {
      const relFile = `levels/${levelDirName}/final-test/${section}.json`;
      const raw = readJson<unknown>(join(ftDir, `${section}.json`));
      if (!raw) continue;
      const parsed = finalTestSectionFileSchema.safeParse(raw);
      if (!parsed.success) {
        formatZod(relFile, parsed.error);
        continue;
      }
      const file = parsed.data;

      // V21: file.section phải khớp tên; số part/item khớp manifest.
      if (file.section !== section) {
        err('V21', `${relFile}: section "${file.section}" không khớp tên file "${section}"`);
      }
      const summary = manifest.sections.find((s) => s.section === section);
      const itemCount = file.parts.reduce((sum, part) => sum + part.items.length, 0);
      if (!summary) {
        err('V21', `levels/${levelDirName}/final-test/manifest.json: thiếu section "${section}"`);
      } else {
        if (summary.partCount !== file.parts.length) {
          err('V21', `${relFile}: manifest khai ${summary.partCount} part nhưng file có ${file.parts.length}`);
        }
        if (summary.itemCount !== itemCount) {
          err('V21', `${relFile}: manifest khai ${summary.itemCount} câu nhưng file có ${itemCount}`);
        }
        if (summary.autoScored !== file.autoScored) {
          err('V21', `${relFile}: manifest.autoScored=${summary.autoScored} nhưng file.autoScored=${file.autoScored}`);
        }
      }

      // V26: chỉ Listening & Reading-Writing chấm tự động; Speaking thì KHÔNG; trần khiên = 5.
      const wantAuto = section !== 'speaking';
      if (file.autoScored !== wantAuto) {
        err('V26', `${relFile}: autoScored phải là ${wantAuto} cho phần "${section}"`);
      }
      if (file.maxShields !== 5) {
        err('V26', `${relFile}: maxShields phải = 5 (trần khiên), đang là ${file.maxShields}`);
      }

      file.parts.forEach((part, partIndex) => {
        // V22: id part + thứ tự.
        if (part.index !== partIndex + 1) {
          err('V22', `${relFile}: part "${part.id}" có index=${part.index} nhưng phải là ${partIndex + 1}`);
        }
        const expectedPartId = `${manifest.id}.${section}.p${part.index}`;
        if (part.id !== expectedPartId) {
          err('V22', `${relFile}: part id "${part.id}" sai quy ước — phải là "${expectedPartId}"`);
        }
        part.items.forEach((item, itemIndex) => {
          // V22: id item + duy nhất toàn level.
          const expectedItemId = `${expectedPartId}.q${itemIndex + 1}`;
          if (item.id !== expectedItemId) {
            err('V22', `${relFile}: item id "${item.id}" sai quy ước — phải là "${expectedItemId}"`);
          }
          if (allItemIds.has(item.id)) {
            err('V22', `${relFile}: item id "${item.id}" bị TRÙNG — id phải duy nhất toàn bài thi`);
          }
          allItemIds.add(item.id);

          // V23–V25: luật thuần dùng chung với test.
          for (const v of auditFinalTestItem(item, wordIds)) {
            err(v.rule, `${relFile} → ${v.message}`);
          }

          cambridgeTexts.push(...itemTexts(item as unknown as Record<string, unknown>));
        });
        cambridgeTexts.push(part.title_vi, part.instruction_vi);
      });

      if (file.autoScored) autoScoredItems += itemCount;
    }

    // V27: không chuỗi nhận dạng Cambridge ở bất kỳ nội dung nào (trừ `note`).
    for (const v of auditFinalTestCambridge(cambridgeTexts)) {
      err('V27', `levels/${levelDirName}/final-test: ${v.message}`);
    }

    const levelLabel = levelDirName.charAt(0).toUpperCase() + levelDirName.slice(1);
    console.log(`\n🎓 Bài thi ${levelLabel}: ${FINAL_TEST_SECTIONS.length} phần · ${autoScoredItems} câu`);
  }
}

// =============================================================================
// 2. NỘI DUNG HỆ THỐNG THƯỞNG
// =============================================================================

function validateRewardContent() {
  const xp = readJson<unknown>(join(CONTENT_DIR, 'xp-levels.json'));
  const quests = readJson<unknown>(join(CONTENT_DIR, 'quests.json'));
  const shop = readJson<unknown>(join(CONTENT_DIR, 'shop-items.json'));
  const badges = readJson<unknown>(join(CONTENT_DIR, 'badges.json'));
  const stickers = readJson<unknown>(join(CONTENT_DIR, 'stickers.json'));

  const parsed = {
    xp: xp ? xpLevelsFileSchema.safeParse(xp) : null,
    quests: quests ? questsFileSchema.safeParse(quests) : null,
    shop: shop ? shopItemsFileSchema.safeParse(shop) : null,
    badges: badges ? badgesFileSchema.safeParse(badges) : null,
    stickers: stickers ? stickersFileSchema.safeParse(stickers) : null,
  };

  for (const [key, result] of Object.entries(parsed)) {
    if (result && !result.success) formatZod(`shared/content/${key}`, result.error);
  }

  // --- V15: cấp XP phải tăng dần -------------------------------------
  if (parsed.xp?.success) {
    const levels = [...parsed.xp.data.levels].sort((a, b) => a.level - b.level);
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!;
      const cur = levels[i]!;
      if (cur.xpRequired <= prev.xpRequired) {
        err(
          'V15',
          `xp-levels: cấp ${cur.level} cần ${cur.xpRequired} XP nhưng cấp ${prev.level} đã cần ${prev.xpRequired} — phải tăng dần`,
        );
      }
      if (cur.level !== prev.level + 1) {
        err('V15', `xp-levels: nhảy cấp từ ${prev.level} sang ${cur.level} — phải liên tục`);
      }
    }
    const stages = [...parsed.xp.data.evolutionStages].sort((a, b) => a.wordsRequired - b.wordsRequired);
    for (let i = 1; i < stages.length; i++) {
      if (stages[i]!.wordsRequired <= stages[i - 1]!.wordsRequired) {
        err('V15', `xp-levels: giai đoạn tiến hoá "${stages[i]!.stage}" phải cần nhiều từ hơn giai đoạn trước`);
      }
    }
  }

  // --- V15b: icon tiền tệ KHÔNG được trùng icon vật phẩm/huy hiệu/sticker
  if (parsed.shop?.success) {
    const currencyIcons = new Map<string, string>();
    for (const [kind, def] of Object.entries(parsed.shop.data.currencies)) {
      currencyIcons.set(def.icon, kind);
    }

    const allIcons: Array<{ icon: string; what: string }> = [];
    for (const it of parsed.shop.data.items) allIcons.push({ icon: it.icon, what: `vật phẩm ${it.id}` });
    if (parsed.badges?.success) {
      for (const b of parsed.badges.data.badges) allIcons.push({ icon: b.icon, what: `huy hiệu ${b.id}` });
    }
    if (parsed.stickers?.success) {
      for (const s of parsed.stickers.data.stickers) allIcons.push({ icon: s.icon, what: `sticker ${s.id}` });
    }

    for (const { icon, what } of allIcons) {
      const currency = currencyIcons.get(icon);
      if (currency) {
        err(
          'V15',
          `${what} dùng emoji "${icon}" trùng với TIỀN TỆ "${currency}" ⇒ bé sẽ tưởng vật phẩm là tiền. Đổi emoji.`,
        );
      }
    }

    // Tên vật phẩm không được trùng tên tiền tệ
    const currencyNames = new Set(Object.values(parsed.shop.data.currencies).map((c) => c.name_vi));
    for (const it of parsed.shop.data.items) {
      if (currencyNames.has(it.name_vi)) {
        err('V15', `vật phẩm "${it.id}" có tên "${it.name_vi}" trùng tên một loại tiền tệ. Đổi tên.`);
      }
    }

    // Giá phải > 0 và đúng loại tiền tệ
    for (const it of parsed.shop.data.items) {
      if (!parsed.shop.data.currencies[it.currency]) {
        err('V15', `vật phẩm "${it.id}" dùng loại tiền tệ không tồn tại: "${it.currency}"`);
      }
      if (it.category === 'food' && it.happinessGain === undefined) {
        warn('V15', `vật phẩm ăn được "${it.id}" thiếu happinessGain — cho ăn sẽ không tăng ❤️`);
      }
    }

    // Đếm theo giai đoạn — thông tin.
    // Thu hẹp kiểu vào biến cục bộ TRƯỚC: bên trong arrow function, TypeScript không
    // giữ được kết quả thu hẹp của `parsed.shop?.success` (property của object).
    const shopItems = parsed.shop.data.items;
    const byPhase = (p: string) => shopItems.filter((i) => i.phase === p).length;
    console.log(
      `\n🛒 Cửa hàng: ${shopItems.length} vật phẩm ` +
        `(MVP ${byPhase('mvp')} · P1 ${byPhase('p1')} · P2 ${byPhase('p2')})`,
    );
  }

  // --- V16: reward refId phải trỏ tới thứ có thật ---------------------
  if (parsed.badges?.success && parsed.stickers?.success && parsed.shop?.success && parsed.xp?.success) {
    const badgeIds = new Set(parsed.badges.data.badges.map((b) => b.id));
    const stickerIds = new Set(parsed.stickers.data.stickers.map((s) => s.id));
    const itemIds = new Set(parsed.shop.data.items.map((i) => i.id));

    const checkGrants = (where: string, grants: Array<{ kind: string; refId?: string }>) => {
      for (const g of grants) {
        if (g.kind === 'badge' && g.refId && !badgeIds.has(g.refId)) {
          err('V16', `${where}: trao huy hiệu "${g.refId}" không tồn tại trong badges.json`);
        }
        if (g.kind === 'sticker' && g.refId && !stickerIds.has(g.refId)) {
          err('V16', `${where}: trao sticker "${g.refId}" không tồn tại trong stickers.json`);
        }
        if (g.kind === 'item' && g.refId && !itemIds.has(g.refId)) {
          err('V16', `${where}: trao vật phẩm "${g.refId}" không tồn tại trong shop-items.json`);
        }
      }
    };

    for (const lv of parsed.xp.data.levels) checkGrants(`xp-levels cấp ${lv.level}`, lv.rewards);
    if (parsed.quests?.success) {
      for (const q of parsed.quests.data.quests) checkGrants(`quest ${q.id}`, q.rewards);
    }
  }

  // --- V16c: quà LÊN CẤP không được chứa XP ----------------------------
  //
  // ⚠️ VÌ SAO ĐÂY LÀ LỖI, KHÔNG PHẢI CẢNH BÁO:
  //   `XpService.addXpInTx` cộng XP rồi trao quà của mọi cấp vừa vượt qua. Nếu quà của một cấp
  //   lại CHÍNH LÀ XP, thì phần XP đó có thể đẩy bé vượt thêm một cấp nữa — cấp đó lại cho XP…
  //   Vòng lặp ấy cần một câu trả lời cho "dừng ở đâu", và dự án chưa trả lời.
  //   Chặn ở tầng nội dung là cách duy nhất khiến `addXpInTx` giữ được một câu trả lời duy nhất
  //   cho câu hỏi "trao đủ quà chưa". Nếu luật này bị bỏ, `levelRewardsToBundle` sẽ BỎ QUA quà
  //   `xp` kèm một dòng log — tức là nội dung sai sẽ âm thầm không có tác dụng.
  if (parsed.xp?.success) {
    for (const lv of parsed.xp.data.levels) {
      if (lv.rewards.some((g) => g.kind === 'xp')) {
        err(
          'V16c',
          `xp-levels cấp ${lv.level}: quà lên cấp không được chứa "xp" — cộng XP lại sinh ra quà lên cấp, tạo vòng lặp không có điểm dừng`,
        );
      }
    }
  }

  // --- V16b: quest/badge/sticker trỏ tới bài & chủ đề có thật ----------
  const knownLessonIds = collectAllLessonIds();
  const knownThemeIds = collectAllThemeIds();

  if (parsed.quests?.success) {
    for (const q of parsed.quests.data.quests) {
      if (q.criteria.kind === 'complete_lesson' && !knownLessonIds.has(q.criteria.lessonId)) {
        err('V16', `quest "${q.id}" trỏ tới bài "${q.criteria.lessonId}" không tồn tại`);
      }
      if (q.criteria.kind === 'complete_theme' && !knownThemeIds.has(q.criteria.themeId)) {
        err('V16', `quest "${q.id}" trỏ tới chủ đề "${q.criteria.themeId}" không tồn tại`);
      }
    }
    const daily = parsed.quests.data.quests.filter((q) => q.tier === 'daily' && q.phase === 'mvp').length;
    console.log(`📋 Nhiệm vụ: ${parsed.quests.data.quests.length} (nhiệm vụ ngày MVP: ${daily})`);
  }

  if (parsed.badges?.success) {
    for (const b of parsed.badges.data.badges) {
      if (b.criteria.kind === 'complete_lesson' && !knownLessonIds.has(b.criteria.lessonId)) {
        err('V16', `huy hiệu "${b.id}" trỏ tới bài "${b.criteria.lessonId}" không tồn tại`);
      }
      if (b.criteria.kind === 'complete_theme' && !knownThemeIds.has(b.criteria.themeId)) {
        err('V16', `huy hiệu "${b.id}" trỏ tới chủ đề "${b.criteria.themeId}" không tồn tại`);
      }
    }
    console.log(`🏅 Huy hiệu: ${parsed.badges.data.badges.length}`);
  }

  if (parsed.stickers?.success) {
    for (const s of parsed.stickers.data.stickers) {
      if (s.lessonId && !knownLessonIds.has(s.lessonId)) {
        err('V16', `sticker "${s.id}" trỏ tới bài "${s.lessonId}" không tồn tại`);
      }
    }
    console.log(`🎁 Sticker: ${parsed.stickers.data.stickers.length}`);
  }

  if (parsed.xp?.success) {
    console.log(`⭐ Cấp XP: ${parsed.xp.data.levels.length} · Giai đoạn tiến hoá: ${parsed.xp.data.evolutionStages.length}`);
  }
}

function collectAllLessonIds(): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(LEVELS_DIR)) return ids;
  for (const levelDirName of readdirSync(LEVELS_DIR)) {
    const themesDir = join(LEVELS_DIR, levelDirName, 'themes');
    if (!existsSync(themesDir)) continue;
    for (const f of readdirSync(themesDir).filter((x) => x.endsWith('.json'))) {
      try {
        const d = JSON.parse(readFileSync(join(themesDir, f), 'utf8')) as { lessons?: Array<{ id: string }> };
        for (const l of d.lessons ?? []) ids.add(l.id);
      } catch {
        /* lỗi parse đã được báo ở validateLevels */
      }
    }
  }
  return ids;
}

function collectAllThemeIds(): Set<string> {
  const ids = new Set<string>();
  if (!existsSync(LEVELS_DIR)) return ids;
  for (const levelDirName of readdirSync(LEVELS_DIR)) {
    const levelJson = join(LEVELS_DIR, levelDirName, 'level.json');
    if (!existsSync(levelJson)) continue;
    try {
      const d = JSON.parse(readFileSync(levelJson, 'utf8')) as { themeIds?: string[] };
      for (const t of d.themeIds ?? []) ids.add(t);
    } catch {
      /* đã báo ở validateLevels */
    }
  }
  return ids;
}

// =============================================================================
// 3. TRANH CẢNH TOÀN CỤC (không thuộc chủ đề nào)
// =============================================================================

/**
 * `global-scenes.json` là nguồn DUY NHẤT cho các tranh dùng chung giữa nhiều màn
 * hình (vd M6 — sân chơi chính). Code tra cứu bằng `key`, nên `key` trùng nhau
 * nghĩa là màn hình này lấy nhầm tranh của màn hình khác — lỗi im lặng, rất khó
 * phát hiện bằng mắt. Vì vậy trùng `key` là LỖI, không phải cảnh báo.
 */
function validateGlobalScenes() {
  const raw = readJson<unknown>(join(CONTENT_DIR, 'global-scenes.json'));
  if (!raw) return;

  const parsed = globalScenesFileSchema.safeParse(raw);
  if (!parsed.success) {
    formatZod('shared/content/global-scenes', parsed.error);
    return;
  }

  const byKey = new Map<string, string[]>();
  const byId = new Map<string, string[]>();

  for (const s of parsed.data.scenes) {
    byKey.set(s.key, [...(byKey.get(s.key) ?? []), s.id]);
    byId.set(s.id, [...(byId.get(s.id) ?? []), s.key]);

    // --- V17: asset tranh phải có thật (cảnh báo — ảnh do AI sinh sau) ---
    if (!existsSync(join(SCENES_DIR, `${s.image}.webp`))) {
      warn(
        'V17',
        `global-scenes "${s.id}" (key="${s.key}") dùng image="${s.image}" nhưng chưa có assets/scenes/${s.image}.webp (cảnh báo, không phải lỗi)`,
      );
    }
  }

  for (const [key, ids] of byKey) {
    if (ids.length > 1) {
      err(
        'V17',
        `global-scenes: key "${key}" bị ${ids.length} cảnh dùng chung (${ids.join(', ')}) ⇒ màn hình tra bằng key sẽ lấy nhầm tranh. Mỗi key chỉ được có một cảnh.`,
      );
    }
  }
  for (const [id, keys] of byId) {
    if (keys.length > 1) {
      err('V17', `global-scenes: id "${id}" xuất hiện ${keys.length} lần — id phải duy nhất.`);
    }
  }

  console.log(`🖼️  Tranh cảnh toàn cục: ${parsed.data.scenes.length} (${[...byKey.keys()].join(', ')})`);
}

// =============================================================================
// 4. AVATAR CHO BÉ
// =============================================================================

/**
 * `avatars.json` là danh sách bạn đồng hành bé chọn khi tạo hồ sơ.
 *
 * Vì sao trùng `icon` là LỖI chứ không phải cảnh báo:
 *   Lưới chọn avatar hiển thị mỗi avatar bằng MỘT emoji. Hai avatar khác `id` nhưng cùng emoji
 *   sẽ hiện ra GIỐNG HỆT NHAU. Bé bấm vào một ô, app lưu một `id` khác — bé không có cách nào
 *   biết mình đã chọn bạn nào. Đây là lỗi im lặng đúng nghĩa: mọi thứ vẫn "chạy", chỉ có bé là
 *   bị nhầm.
 *
 * Trùng `id` thì nặng hơn nữa: `ChildService` kiểm `avatarId` bằng một `Set`, nên id trùng làm
 * một mục trong danh sách trở thành không bao giờ chọn được (dù vẫn hiện trên lưới).
 */
function validateAvatars() {
  const raw = readJson<unknown>(join(CONTENT_DIR, 'avatars.json'));
  if (!raw) return;

  const parsed = avatarsFileSchema.safeParse(raw);
  if (!parsed.success) {
    formatZod('shared/content/avatars', parsed.error);
    return;
  }

  const byId = new Map<string, number>();
  const byIcon = new Map<string, string[]>();

  for (const a of parsed.data.avatars) {
    byId.set(a.id, (byId.get(a.id) ?? 0) + 1);
    byIcon.set(a.icon, [...(byIcon.get(a.icon) ?? []), a.id]);
  }

  for (const [id, count] of byId) {
    if (count > 1) {
      err(
        'V18',
        `avatars: id "${id}" xuất hiện ${count} lần — id phải duy nhất, nếu không mục trùng sẽ không bao giờ chọn được.`,
      );
    }
  }
  for (const [icon, ids] of byIcon) {
    if (ids.length > 1) {
      err(
        'V18',
        `avatars: icon "${icon}" bị ${ids.length} avatar dùng chung (${ids.join(', ')}) ⇒ lưới chọn hiện hai ô GIỐNG HỆT nhau, bé không biết mình chọn bạn nào.`,
      );
    }
  }

  console.log(`🐾 Avatar: ${parsed.data.avatars.length} (${[...byId.keys()].join(', ')})`);
}

// =============================================================================
// Chạy
// =============================================================================

console.log('🔍 RubyLingo — kiểm tra nội dung\n' + '='.repeat(60));

validateLevels();
validateFinalTest();
validateRewardContent();
validateGlobalScenes();
validateAvatars();

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');

console.log('\n' + '='.repeat(60));
if (errors.length > 0) {
  console.log(`\n❌ ${errors.length} LỖI:\n`);
  for (const e of errors) console.log(`  [${e.rule}] ${e.message}\n`);
}
if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} CẢNH BÁO:\n`);
  for (const w of warnings) console.log(`  [${w.rule}] ${w.message}\n`);
}
if (errors.length === 0 && warnings.length === 0) {
  console.log('\n✅ TẤT CẢ NỘI DUNG HỢP LỆ — 0 lỗi, 0 cảnh báo.\n');
} else if (errors.length === 0) {
  console.log(`\n✅ Không có lỗi (chỉ có ${warnings.length} cảnh báo).\n`);
}

process.exit(errors.length > 0 ? 1 : 0);
