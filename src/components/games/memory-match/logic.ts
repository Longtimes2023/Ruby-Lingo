/**
 * RubyLingo — G7 `memory_match`: LUẬT THUẦN (dựng bộ bài).
 *
 * ⚠️⚠️ MỘT TỪ = HAI THẺ, VÀ HAI THẺ ĐÓ KHÔNG BAO GIỜ GIỐNG HỆT NHAU.
 *   `en_icon` ghép từ ↔ HÌNH, `en_vi` ghép từ ↔ NGHĨA. Nếu ai đó "tối ưu" thành hai thẻ cùng nội
 *   dung thì trò chơi thành "tìm hai thẻ giống nhau" — mất hẳn phần liên kết từ với nghĩa, mà đó
 *   chính là thứ duy nhất trò này dạy. Nên `kind` được ghi rõ trên từng thẻ và có test chặn.
 *
 * ⚠️ THẺ HÌNH VẪN MANG `wordId`, KHÔNG mang emoji làm khoá. Khoá để so cặp là `wordId`; emoji chỉ
 *   là thứ hiện ra. Hai từ khác nhau có thể trùng emoji nếu dữ liệu lỗi, và khi đó so theo emoji sẽ
 *   cho bé "ghép đúng" hai từ khác nhau.
 */

import type { MemoryMatchConfig, Word } from '@shared/types/content.js';

import { shuffleSeeded } from '../../../lib/random.js';

export type MemoryCardKind = 'en' | 'icon' | 'vi';

export interface MemoryCard {
  /** Duy nhất trong bộ bài — React key và thứ để so "thẻ nào đang mở". */
  id: string;
  /** Khoá để so cặp. Hai thẻ cùng `wordId` là một cặp. */
  wordId: string;
  kind: MemoryCardKind;
  /** Nội dung hiện trên mặt thẻ (emoji hoặc chữ). */
  face: string;
  /** Từ tiếng Anh để ĐỌC khi ghép đúng. Thẻ hình cũng có — bé cần nghe từ, không nghe emoji. */
  spokenEn: string;
}

/**
 * Dựng bộ bài đã xáo trộn.
 *
 * `pairs` được KẸP theo số từ thật: dữ liệu khai 6 cặp nhưng bài chỉ có 5 từ thì lấy 5 — thà bàn
 * ít cặp còn hơn sinh ra hai thẻ cùng `wordId` mà không có từ tương ứng (cặp không thể ghép).
 */
export function buildDeck(
  words: readonly Word[],
  config: Pick<MemoryMatchConfig, 'pairMode' | 'pairs'>,
  seed: number | string,
): MemoryCard[] {
  const usable = words.slice(0, Math.max(0, config.pairs));
  const cards: MemoryCard[] = [];

  for (const word of usable) {
    const left: MemoryCard = {
      id: `${word.id}#en`,
      wordId: word.id,
      kind: 'en',
      face: word.en,
      spokenEn: word.en,
    };
    const right: MemoryCard =
      config.pairMode === 'en_vi'
        ? { id: `${word.id}#vi`, wordId: word.id, kind: 'vi', face: word.vi, spokenEn: word.en }
        : { id: `${word.id}#icon`, wordId: word.id, kind: 'icon', face: word.icon, spokenEn: word.en };

    cards.push(left, right);
  }

  return shuffleSeeded(cards, seed);
}

/** Hai thẻ này có phải một cặp không. */
export function isPair(a: MemoryCard | undefined, b: MemoryCard | undefined): boolean {
  return a !== undefined && b !== undefined && a.wordId === b.wordId && a.id !== b.id;
}
