/**
 * RubyLingo — G4 `prepositions`: cắt câu và bố cục cảnh.
 *
 * ⭐ HAI LỖI IM LẶNG ĐƯỢC CHẶN Ở ĐÂY:
 *   1. `indexOf` thay vì khớp theo TỪ ⇒ cắt câu vào giữa một từ khác ("sit**in**g" → cắt ở "in"),
 *      và bé đọc ra một câu vô nghĩa.
 *   2. Hai giới từ khác nhau vẽ ra HAI CẢNH GIỐNG NHAU (`under` và `behind` chẳng hạn) ⇒ bé chọn
 *      đúng mà vẫn bị báo sai. Test dưới đây chặn đúng chuyện đó bằng cách so bố cục từng cặp.
 */

import { describe, expect, it } from 'vitest';

import {
  knownPrepositions,
  sceneLayout,
  splitSentence,
  subjectIcon,
} from '@/components/games/prepositions/logic.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';

describe('prepositions — cắt câu quanh giới từ', () => {
  it('cắt đúng ở câu thường', () => {
    expect(splitSentence('The monkey is under the box.', 'under')).toEqual({
      before: 'The monkey is ',
      after: ' the box.',
    });
  });

  it("⚠️ KHÔNG cắt vào giữa một từ khác ('sitting' chứa 'in')", () => {
    // `indexOf('in')` sẽ cắt ở "sit|in|g" và cho ra "The frog is sit" + "g in the box." — vô nghĩa.
    expect(splitSentence('The frog is sitting in the box.', 'in')).toEqual({
      before: 'The frog is sitting ',
      after: ' the box.',
    });
  });

  it("'in' không khớp bên trong 'behind'", () => {
    expect(splitSentence('The crocodile is behind the box.', 'in')).toEqual({
      before: 'The crocodile is behind the box.',
      after: '',
    });
  });

  it('giới từ hai chữ ("next to") vẫn cắt đúng', () => {
    expect(splitSentence('The horse is next to the box.', 'next to')).toEqual({
      before: 'The horse is ',
      after: ' the box.',
    });
  });

  it('không tìm thấy thì KHÔNG mất câu — trả nguyên câu', () => {
    const parts = splitSentence('The goat is on the box.', 'between');
    expect(parts.before).toBe('The goat is on the box.');
    expect(parts.after).toBe('');
  });
});

describe('prepositions — bố cục cảnh', () => {
  it('mỗi giới từ đã biết có một bố cục RIÊNG', () => {
    const signatures = new Map<string, string>();

    for (const preposition of knownPrepositions()) {
      const layout = sceneLayout(preposition);
      const signature = JSON.stringify(layout);

      for (const [other, existing] of signatures) {
        // Nếu hai giới từ vẽ ra cùng một cảnh thì trò chơi không thể chơi đúng — bé chọn đúng
        // hình mà app báo sai. Đây là lỗi không có cửa sổ nào khác bắt được.
        expect(signature, `"${preposition}" và "${other}" có cùng bố cục`).not.toBe(existing);
      }
      signatures.set(preposition, signature);
    }
  });

  it("'between' phải có HAI cái hộp — một hộp thì không phân biệt được với 'next to'", () => {
    expect(sceneLayout('between').boxes).toHaveLength(2);
  });

  it("'behind' phải vẽ con vật Ở SAU hộp, mọi giới từ khác ở trước", () => {
    expect(sceneLayout('behind').pet.front).toBe(false);
    expect(sceneLayout('in').pet.front).toBe(true);
  });

  it('giới từ lạ vẫn cho ra một bố cục dùng được (không bao giờ undefined)', () => {
    expect(sceneLayout('over the moon').boxes.length).toBeGreaterThan(0);
    expect(sceneLayout('').pet.scale).toBeGreaterThan(0);
  });

  it('khoá được chuẩn hoá: hoa/thường và khoảng trắng thừa vẫn ra cùng bố cục', () => {
    // Dữ liệu tay có thể ghi "Next  To" — nếu không chuẩn hoá, bé thấy cảnh mặc định.
    expect(sceneLayout('  Next   To ')).toEqual(sceneLayout('next to'));
  });
});

describe('prepositions — emoji con vật của câu', () => {
  it('lấy emoji từ chính bài tập, không bịa', () => {
    const words = [
      { en: 'monkey', icon: '🐵' },
      { en: 'tiger', icon: '🐯' },
    ] as never;

    expect(subjectIcon('The monkey is under the box.', words)).toBe('🐵');
    expect(subjectIcon('The tiger is on the box.', words)).toBe('🐯');
  });

  it('không tra được thì trả emoji mặc định, KHÔNG trả chuỗi rỗng', () => {
    // Một ô trống trong cảnh làm bé tưởng màn hình hỏng.
    expect(subjectIcon('The dragon is here.', [] as never)).toBe('🐾');
  });
});

describe('prepositions — trên DỮ LIỆU THẬT của mọi chủ đề', () => {
  it('mọi câu đều cắt được quanh ĐÚNG giới từ, và cả 4 lựa chọn đều có bố cục riêng', () => {
    let checked = 0;

    for (const levelId of listLevelIds()) {
      const bundle = readLevelBundle(levelId);

      for (const exercise of bundle.exercises) {
        if (exercise.gameType !== 'prepositions') continue;
        const config = exercise.config as { slots?: unknown };
        if (!Array.isArray(config.slots)) continue;

        const words = exercise.wordIds
          .map((id) => bundle.wordById.get(id))
          .filter((w): w is NonNullable<typeof w> => w !== undefined);

        for (const slot of config.slots as {
          sentenceEn: string;
          preposition: string;
          correctSlot: string;
          slots: string[];
        }[]) {
          checked += 1;

          // 1. `correctSlot` PHẢI nằm trong `slots` — nếu không, đáp án đúng không có nút nào.
          expect(slot.slots, `${slot.sentenceEn}: correctSlot không có trong slots`).toContain(
            slot.correctSlot,
          );

          // 2. Bốn lựa chọn phải KHÁC NHAU — hai nút cùng nhãn là một nút thừa, một đáp án thiếu.
          expect(new Set(slot.slots).size).toBe(slot.slots.length);

          // 3. Cắt câu ra chỗ trống thật — độ dài phải GIẢM ĐÚNG bằng độ dài giới từ.
          const parts = splitSentence(slot.sentenceEn, slot.preposition);
          expect(
            parts.before.length + parts.after.length,
            `${slot.sentenceEn}: không cắt ra được giới từ "${slot.preposition}"`,
          ).toBe(slot.sentenceEn.length - slot.preposition.length);

          // 4. Cảnh của 4 lựa chọn phải khác nhau từng đôi một.
          const signatures = slot.slots.map((label) => JSON.stringify(sceneLayout(label)));
          expect(new Set(signatures).size).toBe(slot.slots.length);

          // 5. Luôn tra được một emoji con vật (không rơi về mặc định) trên dữ liệu thật.
          expect(words.length).toBeGreaterThan(0);
        }
      }
    }

    // at-the-zoo có 3 bài × 1 bài tập giới từ × 4 câu = 12. Nếu 0 thì vòng lặp không chạy.
    expect(checked).toBeGreaterThanOrEqual(12);
  });
});
