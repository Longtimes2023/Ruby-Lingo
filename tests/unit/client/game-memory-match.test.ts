/**
 * RubyLingo — G7 `memory_match`: dựng bộ bài và luật so cặp.
 *
 * ⭐ LỖI IM LẶNG ĐƯỢC CHẶN Ở ĐÂY:
 *   "Tối ưu" bộ bài thành HAI THẺ CÙNG NỘI DUNG (thay vì từ ↔ hình). Trò chơi vẫn chạy, không
 *   lỗi nào được ném, nhưng nó không còn dạy liên kết từ–nghĩa nữa — mà đó là thứ duy nhất nó dạy.
 */

import { describe, expect, it } from 'vitest';

import { buildDeck, isPair } from '@/components/games/memory-match/logic.js';
import { listLevelIds, readLevelBundle } from '@/data/index.js';
import type { Word } from '@shared/types/content.js';

const words: Word[] = [
  { id: 'starters.elephant', en: 'elephant', vi: 'con voi', icon: '🐘' },
  { id: 'starters.tiger', en: 'tiger', vi: 'con hổ', icon: '🐯' },
  { id: 'starters.monkey', en: 'monkey', vi: 'con khỉ', icon: '🐵' },
] as never;

describe('memory_match — bộ bài', () => {
  it('mỗi từ cho ĐÚNG hai thẻ, và hai thẻ đó KHÔNG cùng nội dung', () => {
    const deck = buildDeck(words, { pairMode: 'en_icon', pairs: 3 }, 'seed');

    expect(deck).toHaveLength(6);
    expect(new Set(deck.map((card) => card.id)).size).toBe(6);

    for (const word of words) {
      const pair = deck.filter((card) => card.wordId === word.id);
      expect(pair).toHaveLength(2);
      // en_icon: một thẻ là TỪ, một thẻ là HÌNH — hai thẻ giống nhau là mất hẳn ý nghĩa.
      expect(pair.map((card) => card.kind).sort()).toEqual(['en', 'icon']);
      expect(pair[0]!.face).not.toBe(pair[1]!.face);
    }
  });

  it("en_vi ghép từ với NGHĨA, không phải với hình", () => {
    const deck = buildDeck(words, { pairMode: 'en_vi', pairs: 3 }, 'seed');
    const elephant = deck.filter((card) => card.wordId === 'starters.elephant');

    expect(elephant.map((card) => card.kind).sort()).toEqual(['en', 'vi']);
    expect(elephant.map((card) => card.face).sort()).toEqual(['con voi', 'elephant']);
  });

  it('MỌI thẻ đều mang từ tiếng Anh để đọc — kể cả thẻ hình và thẻ nghĩa', () => {
    // Nếu thẻ hình không có `spokenEn`, lúc ghép đúng app sẽ cố đọc "🐘" — hoặc im lặng.
    for (const mode of ['en_icon', 'en_vi'] as const) {
      for (const card of buildDeck(words, { pairMode: mode, pairs: 3 }, 'seed')) {
        expect(card.spokenEn).toBeTruthy();
        expect(/^[a-z]+$/.test(card.spokenEn), `"${card.spokenEn}" không phải từ tiếng Anh`).toBe(
          true,
        );
      }
    }
  });

  it('KẸP `pairs` theo số từ thật — không sinh thẻ mồ côi', () => {
    // Khai 6 cặp nhưng bài chỉ có 3 từ: thà 3 cặp còn hơn 6 thẻ không có từ tương ứng.
    expect(buildDeck(words, { pairMode: 'en_icon', pairs: 6 }, 's')).toHaveLength(6);
    // `pairs` âm/rác cũng không được làm vỡ.
    expect(buildDeck(words, { pairMode: 'en_icon', pairs: -1 }, 's')).toHaveLength(0);
  });

  it('xáo bài nhưng không mất thẻ nào, và tất định theo seed', () => {
    const a = buildDeck(words, { pairMode: 'en_icon', pairs: 3 }, 'same');
    const b = buildDeck(words, { pairMode: 'en_icon', pairs: 3 }, 'same');
    expect(a.map((card) => card.id)).toEqual(b.map((card) => card.id));

    expect(new Set(a.map((card) => card.id))).toEqual(
      new Set(buildDeck(words, { pairMode: 'en_icon', pairs: 3 }, 'other').map((c) => c.id)),
    );
  });
});

describe('memory_match — luật so cặp', () => {
  it('cùng `wordId` khác thẻ ⇒ là một cặp', () => {
    const deck = buildDeck(words, { pairMode: 'en_icon', pairs: 1 }, 's');
    expect(isPair(deck[0], deck[1])).toBe(true);
  });

  it('cùng một thẻ không tự ghép với chính nó', () => {
    const deck = buildDeck(words, { pairMode: 'en_icon', pairs: 3 }, 's');
    expect(isPair(deck[0], deck[0])).toBe(false);
  });

  it('thiếu thẻ thì không ghép (không được ném lỗi)', () => {
    const deck = buildDeck(words, { pairMode: 'en_icon', pairs: 1 }, 's');
    expect(isPair(undefined, deck[0])).toBe(false);
    expect(isPair(deck[0], undefined)).toBe(false);
  });
});

describe('memory_match — trên DỮ LIỆU THẬT', () => {
  it('mọi bài memory_match dựng ra bộ bài chẵn, đủ cặp, không trùng thẻ', () => {
    let checked = 0;

    for (const levelId of listLevelIds()) {
      const bundle = readLevelBundle(levelId);

      for (const exercise of bundle.exercises) {
        if (exercise.gameType !== 'memory_match') continue;
        checked += 1;

        const exerciseWords = exercise.wordIds
          .map((id) => bundle.wordById.get(id))
          .filter((w): w is Word => w !== undefined);
        const config = exercise.config as { pairMode: 'en_icon' | 'en_vi'; pairs: number };
        const deck = buildDeck(
          exerciseWords,
          config,
          `${exercise.id}#mm#0.42`,
        );

        expect(deck.length, `${exercise.id}: số thẻ lẻ`).toBe(Math.min(config.pairs, exerciseWords.length) * 2);
        expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);

        // Mỗi `wordId` xuất hiện đúng 2 lần ⇒ mọi cặp đều có thể ghép.
        const perWord = new Map<string, number>();
        for (const card of deck) perWord.set(card.wordId, (perWord.get(card.wordId) ?? 0) + 1);
        for (const [wordId, count] of perWord) {
          expect(count, `${wordId}: không đúng 2 thẻ`).toBe(2);
        }
      }
    }

    // at-the-zoo có 3 bài memory_match.
    expect(checked).toBe(3);
  });
});
