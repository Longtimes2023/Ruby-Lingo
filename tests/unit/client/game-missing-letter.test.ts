/**
 * RubyLingo — G3 `missing_letter`: luật chọn ô trống và bàn phím ảo.
 *
 * ⭐ VÌ SAO TEST Ở ĐÂY QUAN TRỌNG HƠN BÌNH THƯỜNG:
 *   Hai lỗi của file `logic.ts` KHÔNG làm gì sập, chỉ làm bé bị phạt oan:
 *     • ô trống rơi vào dấu cách ⇒ có một ô không thể điền, bé bấm mãi không xong;
 *     • một chữ trên bàn phím ghép ra TỪ KHÁC CÓ THẬT ⇒ bé chọn chữ đúng chính tả mà app báo sai.
 *   Không cổng nào khác bắt được hai thứ đó — phải mở trình duyệt và TÌNH CỜ gặp đúng từ.
 */

import { describe, expect, it } from 'vitest';

import {
  correctLetters,
  hiddenIndices,
  letterOptions,
  letterPositions,
  LETTER_OPTION_COUNT,
  makesAnotherWord,
} from '@/components/games/missing-letter/logic.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';

/**
 * MỌI từ tiếng Anh có thật trong mọi level — kiểm luật trên dữ liệu thật, không chỉ vài ví dụ.
 *
 * `siblings` là các từ khác CÙNG BÀI: đó đúng là tập từ mà một chữ nhiễu có thể vô tình ghép ra,
 * vì bài tập chỉ dùng từ trong bài.
 */
function everyWord(): { en: string; siblings: string[] }[] {
  const out: { en: string; siblings: string[] }[] = [];

  for (const levelId of listLevelIds()) {
    const bundle = readLevelBundle(levelId);

    const wordsByLesson = new Map<string, string[]>();
    for (const lesson of bundle.lessons) wordsByLesson.set(lesson.id, lesson.wordIds);

    for (const word of bundle.words) {
      const siblings = (wordsByLesson.get(word.primaryLessonId) ?? [])
        .map((id) => bundle.wordById.get(id))
        .filter((other): other is NonNullable<typeof other> => other !== undefined)
        .filter((other) => other.id !== word.id)
        .map((other) => other.en);

      out.push({ en: word.en, siblings });
    }
  }

  return out;
}

describe('missing_letter — vị trí ô trống', () => {
  it('bỏ qua mọi ký tự không phải chữ cái', () => {
    // Nếu dấu cách cũng thành ô trống, bé sẽ gặp một ô KHÔNG THỂ ĐIỀN.
    expect(letterPositions('ice cream')).toEqual([0, 1, 2, 4, 5, 6, 7, 8]);
    expect(letterPositions('---')).toEqual([]);
  });

  it('KHÔNG BAO GIỜ ẩn hết cả từ, và luôn ẩn ít nhất một chữ', () => {
    // Ẩn hết là bài "viết lại từ", không còn là "điền chữ còn thiếu".
    expect(hiddenIndices('cat', 99, 'any', 's')).toHaveLength(2);
    // "ẩn 0 chữ" là ván chơi không có gì để làm.
    expect(hiddenIndices('cat', 0, 'any', 's')).toHaveLength(1);
  });

  it('tôn trọng hidePosition', () => {
    expect(hiddenIndices('elephant', 1, 'start', 's')).toEqual([0]);
    expect(hiddenIndices('elephant', 1, 'end', 's')).toEqual([7]);
    expect(hiddenIndices('elephant', 1, 'middle', 's')).toEqual([3]);
  });

  it("'any' là tất định theo seed, và các ô không trùng nhau", () => {
    const a = hiddenIndices('crocodile', 3, 'any', 'seed-1');
    const b = hiddenIndices('crocodile', 3, 'any', 'seed-1');

    expect(a).toEqual(b); // cùng seed ⇒ cùng ô, bé không thấy ô trống nhảy chỗ
    expect(new Set(a).size).toBe(a.length); // không ẩn hai lần cùng một ô
    expect([...a].sort((x, y) => x - y)).toEqual(a); // đã sắp xếp — điền trái sang phải
  });
});

describe('missing_letter — bàn phím ảo', () => {
  it('LUÔN có chữ đúng, không trùng, và không quá số ô', () => {
    const hidden = hiddenIndices('tiger', 1, 'start', 's');
    const options = letterOptions('tiger', hidden, [], 's');

    for (const letter of correctLetters('tiger', hidden)) {
      expect(options).toContain(letter);
    }
    expect(new Set(options).size).toBe(options.length);
    expect(options.length).toBeLessThanOrEqual(LETTER_OPTION_COUNT);
  });

  it('⚠️ LOẠI chữ ghép ra một từ khác có thật trong cùng bài (goat ↔ coat)', () => {
    // Với `goat`, ô trống ở chữ đầu: 'c' cho ra "coat" — một từ có thật trong bài.
    expect(makesAnotherWord('goat', 0, 'c', ['coat'])).toBe(true);
    expect(makesAnotherWord('goat', 0, 'b', ['coat'])).toBe(false);

    const options = letterOptions('goat', hiddenIndices('goat', 1, 'start', 's'), ['coat'], 's');
    // Bé chọn 'c' là ĐÚNG chính tả nhưng app sẽ báo sai ⇒ không được để 'c' trên bàn phím.
    expect(options).not.toContain('c');
    expect(options).toContain('g');
  });

  it('bàn phím là tất định theo seed', () => {
    const hidden = hiddenIndices('elephant', 1, 'any', 's');
    expect(letterOptions('elephant', hidden, ['tiger'], 'abc')).toEqual(
      letterOptions('elephant', hidden, ['tiger'], 'abc'),
    );
  });
});

describe('missing_letter — trên DỮ LIỆU THẬT', () => {
  const all = everyWord();

  it('có dữ liệu thật để kiểm', () => {
    // Cả level Starters có ~275 từ ⇒ nếu con số này tụt mạnh thì vòng lặp bên dưới đã ngừng chạy
    // (dữ liệu không nạp được), và các test "xanh" kia sẽ là màu xanh giả.
    expect(all.length).toBeGreaterThan(200);
  });

  it('mọi từ, mọi vị trí: chữ đúng luôn có trên bàn phím, và không chữ nào bị phạt oan', () => {
    const positions = ['any', 'start', 'middle', 'end'] as const;

    for (const { en, siblings } of all) {
      for (const hidePosition of positions) {
        const hidden = hiddenIndices(en, 1, hidePosition, `${en}#${hidePosition}`);
        if (hidden.length === 0) continue;

        const answer = correctLetters(en, hidden)[0]!;
        const options = letterOptions(en, hidden, siblings, `${en}#${hidePosition}`);

        expect(options, `${en}/${hidePosition} thiếu chữ đúng "${answer}"`).toContain(answer);

        // Không chữ nào trên bàn phím được phép ghép ra một từ khác của bài.
        for (const option of options) {
          if (option === answer) continue;
          for (const index of hidden) {
            expect(
              makesAnotherWord(en, index, option, siblings),
              `${en}: chữ "${option}" ghép ra từ khác ⇒ bé bị phạt oan`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it('mọi ô trống đều là CHỮ CÁI, không ô nào rơi vào ký tự khác', () => {
    for (const { en } of all) {
      for (const index of hiddenIndices(en, 1, 'any', `${en}#p`)) {
        expect(/[a-z]/i.test(en[index]!), `${en}[${index}] không phải chữ cái`).toBe(true);
      }
    }
  });
});
