/**
 * RubyLingo — chốt chặn cho ĐƯỜNG DẪN TỚI GAME.
 *
 * ⭐ VÌ SAO BỘ TEST NÀY TỒN TẠI (đọc trước khi xoá hay nới bất kỳ dòng nào):
 *   `ThemePage` vừa được đổi để chip trò chơi trở thành `<Link>` thật. Một link game sai không
 *   làm đỏ TypeScript, không làm đỏ eslint, không làm trắng trang lúc build: nó chỉ dẫn bé tới
 *   màn hình "Không tìm thấy trò chơi này". Kiểu hỏng này im lặng tuyệt đối — không có gì trong
 *   cổng CI hiện tại bắt được. Cách duy nhất là khoá lại bằng test chạy thật.
 *
 *   Và nó KHÔNG phải giả định: `lessonId` của dự án có chứa dấu `/` ("at-the-zoo/z1"). Chỉ cần
 *   một chỗ quên `encodeURIComponent` là URL thành hai đoạn, route không khớp, và không có lỗi
 *   nào được ném ra ở đâu cả. Xem ghi chú đầu `src/lib/paths.ts`.
 *
 * ⚠️ BỘ TEST NÀY CHẠY TRÊN NỘI DUNG THẬT Ở ĐĨA, không trên dữ liệu bịa. Nhờ vậy nó còn bắt được
 *   một file JSON viết `id` sai quy ước `"{lessonId}/{slug}"` — thứ mà chỉ test mới thấy.
 */

import { describe, expect, it } from 'vitest';

import type { GameType } from '@shared/types/content.js';
import { MVP_GAME_TYPES, PLAYABLE_GAME_TYPES } from '@shared/types/content.js';
import { GAME_HEARTS } from '@shared/game-scoring.js';

import { GAME_COMPONENTS, isGamePlayable } from '@/components/games/shared/registry.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';
import { exerciseSlug, flashcardsPath, gamePath, themePath } from '@/lib/paths.js';

// =============================================================================
// Dựng đường dẫn — mã hoá
// =============================================================================

describe('paths — mọi id đều phải được mã hoá', () => {
  /**
   * ⚠️ Khẳng định cốt lõi: `lessonId` chứa `/` PHẢI ra `%2F`.
   *   Nếu dòng này đỏ, một link trên màn hình chủ đề đang dẫn tới hư không.
   */
  it('lessonId có dấu "/" bị mã hoá thành %2F (nếu không, route không bao giờ khớp)', () => {
    expect(flashcardsPath('at-the-zoo/z1')).toBe('/lesson/at-the-zoo%2Fz1/flashcards');
    expect(gamePath('at-the-zoo/z1', 'listen-tap')).toBe(
      '/lesson/at-the-zoo%2Fz1/game/listen-tap',
    );
  });

  it('themeId cũng được mã hoá, không chỉ lessonId', () => {
    expect(themePath('at-the-zoo')).toBe('/theme/at-the-zoo');
  });

  it('khoảng trắng và ký tự lạ không làm vỡ đường dẫn', () => {
    expect(themePath('my theme')).toBe('/theme/my%20theme');
    expect(flashcardsPath('a/b c')).toBe('/lesson/a%2Fb%20c/flashcards');
  });

  it('slug của bài tập cũng được mã hoá, không nối chuỗi trần', () => {
    expect(gamePath('lesson', 'some slug')).toBe('/lesson/lesson/game/some%20slug');
  });
});

describe('paths — `exerciseSlug` lấy đúng phần đuôi', () => {
  it('cắt đúng tiền tố lessonId (lessonId có chứa dấu "/")', () => {
    expect(exerciseSlug({ id: 'at-the-zoo/z1/listen-tap', lessonId: 'at-the-zoo/z1' })).toBe(
      'listen-tap',
    );
  });

  it('id sai quy ước vẫn trả về đoạn cuối, không ném lỗi', () => {
    // `Exercise.id` là DỮ LIỆU. Một file JSON viết sai không được phép làm trắng cả trang chủ đề.
    expect(exerciseSlug({ id: 'listen-tap', lessonId: 'at-the-zoo/z1' })).toBe('listen-tap');
  });
});

// =============================================================================
// Đường dẫn khớp mẫu route — kiểm trên NỘI DUNG THẬT
// =============================================================================

/** Mẫu của `/lesson/:lessonId/game/:exerciseSlug`, ở dạng ĐÃ mã hoá. */
const GAME_ROUTE_RE = /^\/lesson\/([^/]+)\/game\/([^/]+)$/;

/** Mọi bài tập của mọi cấp có trên đĩa. */
function allExercises() {
  return listLevelIds().flatMap((levelId) => readLevelBundle(levelId).exercises);
}

describe('đường dẫn game khớp mẫu route — trên toàn bộ nội dung thật', () => {
  it('có bài tập để kiểm (nếu rỗng thì test dưới đang kiểm trên hư không)', () => {
    expect(allExercises().length).toBeGreaterThan(0);
  });

  it('mỗi bài tập dựng ra MỘT đường dẫn khớp mẫu route, và giải mã ngược ra đúng id', () => {
    for (const exercise of allExercises()) {
      const path = gamePath(exercise.lessonId, exerciseSlug(exercise));

      // 1. Khớp mẫu: đúng hai đoạn, không đoạn nào chứa `/` trần.
      const match = GAME_ROUTE_RE.exec(path);
      expect(match, `đường dẫn không khớp route: ${path}`).not.toBeNull();

      // 2. Giải mã ngược phải dựng LẠI ĐÚNG `exercise.id` — đây chính là việc `GamePage` làm.
      const lessonId = decodeURIComponent(match![1]!);
      const slug = decodeURIComponent(match![2]!);
      expect(`${lessonId}/${slug}`, `dựng ngược sai cho ${exercise.id}`).toBe(exercise.id);
    }
  });

  it('slug là MỘT đoạn duy nhất — điều kiện để URL còn đọc được', () => {
    for (const exercise of allExercises()) {
      const slug = exerciseSlug(exercise);
      expect(slug, `slug rỗng cho ${exercise.id}`).not.toBe('');
      expect(slug, `slug nhiều đoạn cho ${exercise.id}`).not.toContain('/');
    }
  });
});

// =============================================================================
// Bảng đăng ký game
// =============================================================================

/** Các game ĐÃ có component, dưới dạng kiểu `GameType` (thay vì `string` của `Object.keys`). */
const registeredGameTypes = Object.keys(GAME_COMPONENTS) as GameType[];

describe('GAME_COMPONENTS — nguồn chân lý duy nhất cho "game đã chơi được chưa"', () => {
  it('không rỗng — nếu rỗng thì màn chủ đề không có trò nào bấm được', () => {
    expect(registeredGameTypes.length).toBeGreaterThan(0);
  });

  it('mọi game trong bảng đều là COMPONENT thật, không phải giá trị rỗng', () => {
    for (const [gameType, Component] of Object.entries(GAME_COMPONENTS)) {
      expect(typeof Component, `${gameType} không phải component`).toBe('function');
    }
  });

  it('`isGamePlayable` đồng ý với bảng — hai cách hỏi, một câu trả lời', () => {
    for (const gameType of registeredGameTypes) {
      // Nếu hai thứ này lệch nhau, `ThemePage` sẽ vẽ chip xám cho trò bấm được, hoặc ngược lại.
      expect(isGamePlayable(gameType)).toBe(true);
    }
  });

  it('game chưa làm thì `isGamePlayable` trả false (để chip không thành link chết)', () => {
    /**
     * ⚠️⚠️ `MVP_GAME_TYPES` KHÔNG DÙNG ĐƯỢC Ở ĐÂY NỮA — cả 5 game MVP đã có component.
     *
     *   Bản trước lấy `unbuilt` từ `MVP_GAME_TYPES`, nên khi Nhóm 5 làm xong game cuối cùng thì
     *   danh sách rỗng và test tự vô hiệu (nó còn `expect(unbuilt.length).toBeGreaterThan(0)` để
     *   tự báo — nhờ vậy lỗi này lộ ra thay vì im lặng bỏ qua).
     *
     *   Nay lấy từ `GAME_HEARTS`: đó là `Record<GameType, number>`, tức TypeScript BẮT BUỘC mọi
     *   `GameType` phải có mặt. Thêm một game mới vào union mà quên khai ở `GAME_HEARTS` là lỗi
     *   biên dịch, còn quên làm component thì test này vẫn còn game để kiểm. Vẫn luôn ≥ 1 phần tử
     *   chừng nào chưa làm hết 12 game.
     */
    const allGameTypes = Object.keys(GAME_HEARTS) as GameType[];
    const unbuilt = allGameTypes.filter((gameType) => !(gameType in GAME_COMPONENTS));

    // Còn 7 game P1/P2 chưa làm ⇒ danh sách này không được rỗng. Rỗng nghĩa là hoặc đã làm hết
    // 12 game, hoặc test đang không kiểm gì cả — cả hai đều là lý do để đọc lại dòng này.
    expect(unbuilt.length).toBeGreaterThan(0);

    for (const gameType of unbuilt) {
      expect(isGamePlayable(gameType)).toBe(false);
    }
  });

  it('không đăng ký game NGOÀI phạm vi MVP (P1/P2 phải đợi tới lượt của chúng)', () => {
    for (const gameType of registeredGameTypes) {
      expect(MVP_GAME_TYPES, `${gameType} ngoài phạm vi MVP`).toContain(gameType);
    }
  });

  it('⭐ `PLAYABLE_GAME_TYPES` (shared) KHỚP bảng registry — nếu lệch, cổng mở khoá bài thi sẽ đòi bé chơi một trò chưa có', () => {
    // `scripts/gen-content-index.ts` dùng `PLAYABLE_GAME_TYPES` để tính `requiredExerciseIds` (server
    // đọc để kiểm điều kiện mở khoá bài thi) vì nó KHÔNG import được registry (JSX/src/). Đây là cổng
    // giữ hai danh sách không lệch nhau — cùng tinh thần "hai đường, một đáp số".
    expect([...registeredGameTypes].sort()).toEqual([...PLAYABLE_GAME_TYPES].sort());
  });
});
