/**
 * RubyLingo — G9 `word_picture`: dựng hai cột và luật nối.
 *
 * ⭐⚠️ LỖI IM LẶNG QUAN TRỌNG NHẤT CỦA TRÒ NÀY: XÁO HAI CỘT BẰNG CÙNG MỘT HẠT GIỐNG.
 *   Khi đó hàng thứ i bên trái luôn khớp hàng thứ i bên phải. Trò chơi vẫn chạy, không có lỗi nào
 *   được ném, bé vẫn "thắng" — nhưng bé chỉ việc nối thẳng ngang và KHÔNG ĐỌC TỪ NÀO. Bài học
 *   biến mất hoàn toàn mà không một cổng nào khác phát hiện. Test dưới đây chặn đúng chuyện đó.
 */

import { describe, expect, it } from 'vitest';

import { buildColumns, isWordPair } from '@/components/games/word-picture/logic.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';
import { shuffleSeeded } from '@/lib/random.js';
import type { Word } from '@shared/types/content.js';

const words: Word[] = [
  { id: 'starters.elephant', en: 'elephant', vi: 'con voi', icon: '🐘' },
  { id: 'starters.giraffe', en: 'giraffe', vi: 'hươu cao cổ', icon: '🦒' },
  { id: 'starters.hippo', en: 'hippo', vi: 'hà mã', icon: '🦛' },
  { id: 'starters.tiger', en: 'tiger', vi: 'con hổ', icon: '🐯' },
  { id: 'starters.crocodile', en: 'crocodile', vi: 'cá sấu', icon: '🐊' },
  { id: 'starters.snake', en: 'snake', vi: 'con rắn', icon: '🐍' },
] as never;

describe('word_picture — hai cột', () => {
  it('cả hai cột đều chứa ĐÚNG bộ từ đó, không thừa không thiếu', () => {
    const { left, right } = buildColumns(words, 6, 'seed');
    const ids = words.map((word) => word.id);

    expect([...left.map((w) => w.id)].sort()).toEqual([...ids].sort());
    expect([...right.map((w) => w.id)].sort()).toEqual([...ids].sort());
  });

  it('⚠️ hai cột xáo bằng HAI hạt giống KHÁC NHAU (không nối ngang là xong)', () => {
    // Chứng minh trực tiếp: cột trái/phải đúng bằng kết quả xáo với hai hạt giống khác nhau.
    const usable = words.slice(0, 6);
    const { left, right } = buildColumns(words, 6, 'seed');

    expect(left.map((w) => w.id)).toEqual(shuffleSeeded(usable, 'seed#left').map((w) => w.id));
    expect(right.map((w) => w.id)).toEqual(shuffleSeeded(usable, 'seed#right').map((w) => w.id));
    // Và hai hạt giống đó thực sự cho ra hai thứ tự khác nhau trên bộ từ này.
    expect(left.map((w) => w.id)).not.toEqual(right.map((w) => w.id));
  });

  it('kẹp `pairs` theo số từ thật', () => {
    expect(buildColumns(words, 99, 's').left).toHaveLength(6);
    expect(buildColumns(words, 0, 's').left).toHaveLength(0);
    expect(buildColumns(words, -3, 's').right).toHaveLength(0);
  });

  it('tất định theo seed', () => {
    expect(buildColumns(words, 6, 'x')).toEqual(buildColumns(words, 6, 'x'));
  });
});

describe('word_picture — luật nối', () => {
  it('cùng `id` ⇒ nối đúng', () => {
    expect(isWordPair(words[0], words[0])).toBe(true);
  });

  it('khác `id` ⇒ nối sai', () => {
    expect(isWordPair(words[0], words[1])).toBe(false);
  });

  it('thiếu một đầu ⇒ không phải cặp (không được ném lỗi)', () => {
    expect(isWordPair(undefined, words[0])).toBe(false);
    expect(isWordPair(words[0], undefined)).toBe(false);
  });
});

describe('word_picture — trên DỮ LIỆU THẬT', () => {
  it('mọi bài word_picture: hai cột không trùng thứ tự, và mọi từ đều có emoji', () => {
    let checked = 0;

    for (const levelId of listLevelIds()) {
      const bundle = readLevelBundle(levelId);

      for (const exercise of bundle.exercises) {
        if (exercise.gameType !== 'word_picture') continue;
        checked += 1;

        const exerciseWords = exercise.wordIds
          .map((id) => bundle.wordById.get(id))
          .filter((w): w is Word => w !== undefined);
        const config = exercise.config as { pairs: number };
        const { left, right } = buildColumns(exerciseWords, config.pairs, `${exercise.id}#wp#0.42`);

        expect(left.length, `${exercise.id}: cột hình rỗng`).toBeGreaterThan(1);
        expect(left.map((w) => w.id)).not.toEqual(right.map((w) => w.id));

        // Cột hình cần emoji thật — một ô trống là một ô bé không thể nối.
        for (const word of left) {
          expect(word.icon, `${exercise.id}: "${word.en}" không có emoji`).toBeTruthy();
        }
      }
    }

    // at-the-zoo có 3 bài word_picture.
    expect(checked).toBe(3);
  });
});
