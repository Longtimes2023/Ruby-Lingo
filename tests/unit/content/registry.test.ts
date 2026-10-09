/**
 * Test registry nội dung (task T015) — `src/data/index.ts`.
 *
 * ⭐ VÌ SAO TEST NÀY QUAN TRỌNG NHẤT TRONG NHÓM 1:
 * `readLevelBundle` tìm file theme bằng `import.meta.glob` với mẫu đường dẫn dạng
 * `./levels/<cấp>/themes/<chủ-đề>.json`. Mẫu đó là một CHUỖI, và TypeScript KHÔNG kiểm
 * được nó. Nếu mẫu sai (đổi cấu trúc thư mục, thêm một tầng, đổi đuôi file) thì danh
 * sách module theme rỗng — app vẫn `typecheck` sạch, vẫn build được, nhưng bản đồ hành
 * trình hiện 0 chủ đề và KHÔNG có lỗi nào được ném ra. Đây là kiểu hỏng im lặng mà chỉ
 * test chạy thật mới bắt được.
 *
 * `listLevelIds()` / `readLevelBundle()` chạy qua Vite transform trong Vitest, nên test
 * này cũng chính là bằng chứng `import.meta.glob` hoạt động trong môi trường thật.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEVEL_ID,
  hasLevel,
  listLevelIds,
  readLevelBundle,
  sceneAssetUrl,
  sceneAssetUrlOrNull,
  sliceTheme,
} from '@/data/index.js';

describe('listLevelIds / hasLevel', () => {
  it('tìm được level "starters" từ đĩa — nếu rỗng thì `import.meta.glob` đã hỏng', () => {
    expect(listLevelIds()).toContain('starters');
  });

  it('DEFAULT_LEVEL_ID nằm trong danh sách level có thật', () => {
    expect(hasLevel(DEFAULT_LEVEL_ID)).toBe(true);
  });

  it('level không tồn tại ⇒ false (không ném lỗi)', () => {
    expect(hasLevel('movers')).toBe(false);
  });
});

describe('readLevelBundle("starters")', () => {
  const bundle = readLevelBundle('starters');

  it('nạp đủ 11 chủ đề — đúng bằng số phần tử level.themeIds', () => {
    expect(bundle.themes).toHaveLength(11);
    expect(bundle.themes).toHaveLength(bundle.level.themeIds.length);
  });

  it('KHÔNG thiếu file chủ đề nào (mọi themeId đều có theme tương ứng)', () => {
    for (const themeId of bundle.level.themeIds) {
      expect(bundle.themeById.has(themeId), `thiếu chủ đề "${themeId}"`).toBe(true);
    }
  });

  it('thứ tự chủ đề theo ĐÚNG level.themeIds, không theo tên file', () => {
    expect(bundle.themes.map((t) => t.id)).toEqual(bundle.level.themeIds);
  });

  it('chủ đề ĐẦU TIÊN là "at-the-zoo" và mở sẵn — nếu không, bản đồ hành trình chết', () => {
    const first = bundle.themes[0];
    expect(first?.id).toBe('at-the-zoo');
    expect(first?.unlockCondition.type).toBe('always');
  });

  it('không chủ đề nào khác được "always" (chỉ chủ đề đầu)', () => {
    const always = bundle.themes.filter((t) => t.unlockCondition.type === 'always');
    expect(always.map((t) => t.id)).toEqual(['at-the-zoo']);
  });

  it('lập chỉ mục tra cứu khớp số lượng thật (không có id trùng bị nuốt)', () => {
    expect(bundle.wordById.size).toBe(bundle.words.length);
    expect(bundle.lessonById.size).toBe(bundle.lessons.length);
    expect(bundle.themeById.size).toBe(bundle.themes.length);
    expect(bundle.exerciseById.size).toBe(bundle.exercises.length);
  });

  it('mọi bài trong bundle đều thuộc một chủ đề của level này', () => {
    for (const lesson of bundle.lessons) {
      expect(bundle.themeById.has(lesson.themeId), `bài ${lesson.id} trỏ tới chủ đề lạ`).toBe(true);
    }
  });

  it('wordIdsByTheme có mặt cho MỌI chủ đề, và mọi id đều tra được ở cấp level', () => {
    for (const theme of bundle.themes) {
      const ids = bundle.wordIdsByTheme.get(theme.id);
      expect(ids, `chủ đề ${theme.id} thiếu wordIdsByTheme`).toBeDefined();
      for (const id of ids ?? []) {
        expect(bundle.wordById.has(id), `từ "${id}" không tra được ở cấp level`).toBe(true);
      }
    }
  });

  it('wordIdsByTheme = hợp các wordIds của bài (không trùng lặp)', () => {
    for (const theme of bundle.themes) {
      const ids = bundle.wordIdsByTheme.get(theme.id) ?? [];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('mọi bài tập đều trỏ tới bài có thật trong level', () => {
    for (const exercise of bundle.exercises) {
      expect(bundle.lessonById.has(exercise.lessonId), `bài tập ${exercise.id} trỏ bài lạ`).toBe(
        true,
      );
    }
  });

  it('mọi từ đều có picturable là boolean (thiếu ⇒ game Nghe & Chạm không có hình)', () => {
    const bad = bundle.words.filter((w) => typeof w.picturable !== 'boolean');
    expect(bad.map((w) => w.id)).toEqual([]);
  });
});

describe('quy ước "cùng nghĩa ⇒ định nghĩa MỘT lần"', () => {
  const bundle = readLevelBundle('starters');

  it('wordIdsByTheme = HỢP của lesson.wordIds, KHÔNG lọc theo `primaryThemeId`', () => {
    // Đây là bất biến đáng bảo vệ. Nếu ai đó "tối ưu" bằng cách lọc theo primaryThemeId
    // thì một từ được DẠY ở chủ đề khác nơi định nghĩa nó sẽ biến mất khỏi chủ đề đang
    // dạy — bé vào bài sẽ thấy thiếu từ, mà không có lỗi nào báo ra.
    for (const theme of bundle.themes) {
      const fromLessons = new Set<string>();
      for (const lessonId of theme.lessonIds) {
        for (const id of bundle.lessonById.get(lessonId)?.wordIds ?? []) fromLessons.add(id);
      }
      const indexed = new Set(bundle.wordIdsByTheme.get(theme.id) ?? []);
      expect([...fromLessons].sort(), `chủ đề ${theme.id}`).toEqual([...indexed].sort());
    }
  });

  it('mọi từ trong MỌI bài đều tra được ở cấp LEVEL — kể cả từ định nghĩa ở chủ đề khác', () => {
    // `wordById` là chỉ mục CẤP LEVEL (không phải cấp chủ đề), nên tra chéo chủ đề vẫn
    // ra. Test này khẳng định điều đó cho toàn bộ 275 từ / 43 bài.
    const unresolved: string[] = [];
    for (const lesson of bundle.lessons) {
      for (const wordId of lesson.wordIds) {
        if (!bundle.wordById.has(wordId)) unresolved.push(`${lesson.id} → ${wordId}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('ghi nhận trạng thái: hiện CHƯA có từ nào được dạy chéo chủ đề', () => {
    // Cơ chế có sẵn trong code nhưng nội dung hiện tại chưa dùng: mọi từ đều được định
    // nghĩa đúng tại chủ đề dạy nó. Test này KHÔNG khẳng định phải luôn như vậy — nó chỉ
    // ghi lại sự thật để nếu sau này có từ dạy chéo chủ đề, ta biết mà kiểm thêm.
    const crossTheme: string[] = [];
    for (const theme of bundle.themes) {
      for (const wordId of bundle.wordIdsByTheme.get(theme.id) ?? []) {
        const word = bundle.wordById.get(wordId);
        if (word && word.primaryThemeId !== theme.id) crossTheme.push(wordId);
      }
    }
    expect(Array.isArray(crossTheme)).toBe(true);
    expect(crossTheme.length).toBe(0);
  });
});

describe('readLevelBundle với level không tồn tại', () => {
  it('NÉM lỗi (lỗi lập trình, phải ồn ào chứ không im lặng trả rỗng)', () => {
    expect(() => readLevelBundle('movers')).toThrow(/Không tìm thấy level/);
  });

  it('thông báo lỗi liệt kê các level đang có để dễ sửa', () => {
    expect(() => readLevelBundle('flyers')).toThrow(/starters/);
  });
});

describe('sceneAssetUrl / sceneAssetUrlOrNull', () => {
  it('dựng đúng đường dẫn asset', () => {
    expect(sceneAssetUrl('at-the-zoo')).toBe('/assets/scenes/at-the-zoo.webp');
  });

  it('khoá rỗng ⇒ null, KHÔNG tạo URL "/assets/scenes/.webp" gây 404', () => {
    expect(sceneAssetUrlOrNull('')).toBeNull();
    expect(sceneAssetUrlOrNull('   ')).toBeNull();
  });

  it('khoá có thật ⇒ URL', () => {
    expect(sceneAssetUrlOrNull('home-scene')).toBe('/assets/scenes/home-scene.webp');
  });
});

describe('sliceTheme', () => {
  const bundle = readLevelBundle('starters');

  it('chủ đề không tồn tại ⇒ null', () => {
    expect(sliceTheme(bundle, 'khong-co-chu-de-nay')).toBeNull();
  });

  it('chủ đề có thật ⇒ bài/từ/bài tập đều thuộc chủ đề đó', () => {
    const slice = sliceTheme(bundle, 'at-the-zoo');
    expect(slice).not.toBeNull();
    if (!slice) return;

    const lessonIds = new Set(slice.theme.lessonIds);
    expect(slice.lessons.length).toBeGreaterThan(0);
    for (const lesson of slice.lessons) expect(lessonIds.has(lesson.id)).toBe(true);
    for (const exercise of slice.exercises) expect(lessonIds.has(exercise.lessonId)).toBe(true);

    const wordIds = new Set(slice.words.map((w) => w.id));
    for (const wordId of bundle.wordIdsByTheme.get('at-the-zoo') ?? []) {
      expect(wordIds.has(wordId)).toBe(true);
    }
  });

  it('at-the-zoo đã có bài tập cho game MVP (không còn chủ đề trắng)', () => {
    const slice = sliceTheme(bundle, 'at-the-zoo');
    expect(slice?.exercises.length ?? 0).toBeGreaterThan(0);
  });
});
