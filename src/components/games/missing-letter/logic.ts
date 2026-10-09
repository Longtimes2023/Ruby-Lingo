/**
 * RubyLingo — G3 `missing_letter`: LUẬT THUẦN (không React, không DOM).
 *
 * ⭐ VÌ SAO TÁCH LUẬT RA KHỎI COMPONENT:
 *   Hai câu hỏi ở đây có đáp án ĐÚNG/SAI rõ ràng — "ô trống nằm ở đâu" và "bàn phím có những chữ
 *   nào" — và cả hai đều là chỗ dễ sinh ra một lỗi KHÔNG AI THẤY:
 *     • Ô trống rơi vào dấu cách hoặc dấu gạch nối ⇒ bé nhìn thấy một ô trống không thể điền.
 *     • Một chữ gây nhiễu vô tình ghép ra MỘT TỪ KHÁC CÓ THẬT trong cùng bài ⇒ bé chọn chữ đó,
 *       app báo "chưa đúng", và bé bị phạt vì một đáp án đúng về mặt chính tả.
 *   Đưa ra hàm thuần thì kiểm được bằng test, không phải mở trình duyệt rồi đoán.
 */

import type { HidePosition } from '@shared/types/content.js';

import { hashString, seededRandom, shuffleSeeded } from '../../../lib/random.js';

/** Số ô chữ trên bàn phím ảo. 8 ô = 2 hàng × 4 cột — vừa một màn hình điện thoại, không phải cuộn. */
export const LETTER_OPTION_COUNT = 8;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Vị trí các CHỮ CÁI trong từ (bỏ qua mọi ký tự khác).
 *
 * ⚠️ Chỉ chữ cái mới được làm ô trống. Nếu từ có dấu cách hay gạch nối ("ice cream"), ô trống
 *   rơi vào dấu cách là một ô không thể điền — bé bấm mãi không xong mà không hiểu vì sao.
 */
export function letterPositions(en: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < en.length; i++) {
    if (/[a-z]/i.test(en[i]!)) out.push(i);
  }
  return out;
}

/**
 * Chọn các vị trí sẽ bị ẩn.
 *
 * `hideCount` được KẸP lại: không bao giờ ẩn hết cả từ (như vậy là bài "viết lại từ", không còn
 * là "điền chữ còn thiếu"), và luôn ẩn ít nhất 1 chữ.
 */
export function hiddenIndices(
  en: string,
  hideCount: number,
  hidePosition: HidePosition,
  seed: number | string,
): number[] {
  const positions = letterPositions(en);
  if (positions.length === 0) return [];

  const maxHide = positions.length <= 1 ? positions.length : positions.length - 1;
  const count = Math.min(Math.max(1, Math.trunc(hideCount)), maxHide);

  if (hidePosition === 'start') return positions.slice(0, count);
  if (hidePosition === 'end') return positions.slice(-count);
  if (hidePosition === 'middle') {
    const start = Math.floor((positions.length - count) / 2);
    return positions.slice(start, start + count);
  }

  // 'any' — chọn ngẫu nhiên nhưng TẤT ĐỊNH theo seed, để cùng một câu luôn ra cùng ô trống.
  const rng = seededRandom(hashString(String(seed)));
  const pool = [...positions];
  const chosen: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const j = Math.floor(rng() * pool.length);
    chosen.push(pool[j]!);
    pool.splice(j, 1);
  }
  return chosen.sort((a, b) => a - b);
}

/** Chữ cái đúng ở từng ô trống, theo thứ tự trái → phải. */
export function correctLetters(en: string, hidden: readonly number[]): string[] {
  return hidden.map((index) => en[index]!.toLowerCase());
}

/**
 * Thay `letter` vào ô `index` của `en` — dùng để phát hiện một chữ nhiễu ghép ra từ KHÁC.
 */
function substitute(en: string, index: number, letter: string): string {
  return `${en.slice(0, index)}${letter}${en.slice(index + 1)}`.toLowerCase();
}

/**
 * ⚠️⚠️ CHỮ NÀY CÓ TẠO RA MỘT TỪ KHÁC TRONG CÙNG BÀI KHÔNG?
 *
 *   Ví dụ thật: bài có `goat` và `coat` (hoặc `sheep`/`ship` ở chủ đề khác). Nếu từ đang chơi là
 *   `goat` và ô trống là chữ đầu, thì `c` vừa là chữ nhiễu "trông có lý", vừa ghép ra một từ CÓ
 *   THẬT. Bé chọn `c`, app báo sai — bé bị phạt vì một đáp án đúng về chính tả.
 *
 *   Nên: loại hẳn những chữ như vậy khỏi bàn phím. Thà bàn phím thiếu một chữ còn hơn có một
 *   đáp án đúng thứ hai mà chỉ app biết là sai.
 */
export function makesAnotherWord(
  en: string,
  index: number,
  letter: string,
  siblings: readonly string[],
): boolean {
  const candidate = substitute(en, index, letter);
  return siblings.some(
    (sibling) => sibling.toLowerCase() !== en.toLowerCase() && sibling.toLowerCase() === candidate,
  );
}

/**
 * Bàn phím ảo của một câu.
 *
 * Thứ tự ưu tiên chọn chữ nhiễu (quan trọng về mặt sư phạm, không phải thẩm mỹ):
 *   1. Các chữ KHÁC đã có trong chính từ đó — bé phải nghĩ "chữ nào vào ô nào", không chỉ
 *      "chữ nào còn thiếu".
 *   2. Chữ ở đúng vị trí ô trống trong các từ khác của bài — đây là chỗ dễ nhầm nhất.
 *   3. Chữ đứng ngay trước/sau chữ đúng trong bảng chữ cái — b, d, p, q… là lỗi chính tả phổ biến.
 *   4. Phần còn lại của bảng chữ cái (để luôn đủ số ô).
 *
 * Kết quả LUÔN chứa đủ các chữ đúng, và được xáo trộn bằng seed để vị trí các ô ổn định trong
 * một câu (đổi chỗ dưới ngón tay bé là lỗi đã ghi ở `ListenTapGame`).
 */
export function letterOptions(
  en: string,
  hidden: readonly number[],
  siblings: readonly string[],
  seed: number | string,
): string[] {
  const correct = correctLetters(en, hidden);
  const correctSet = new Set(correct);

  const blocked = (letter: string): boolean =>
    hidden.some((index) => makesAnotherWord(en, index, letter, siblings));

  const picked: string[] = [];
  const seen = new Set(correctSet);

  const consider = (letter: string): void => {
    if (picked.length >= LETTER_OPTION_COUNT - correctSet.size) return;
    const lower = letter.toLowerCase();
    if (!/[a-z]/.test(lower) || seen.has(lower) || blocked(lower)) return;
    seen.add(lower);
    picked.push(lower);
  };

  // 1. Các chữ khác của chính từ đó, theo thứ tự xuất hiện.
  for (const char of en) consider(char);

  // 2. Chữ ở đúng vị trí ô trống trong các từ bạn.
  for (const sibling of siblings) {
    for (const index of hidden) {
      if (index < sibling.length) consider(sibling[index]!);
    }
  }

  // 3. Hàng xóm trong bảng chữ cái.
  for (const letter of correct) {
    const at = ALPHABET.indexOf(letter);
    if (at > 0) consider(ALPHABET[at - 1]!);
    if (at >= 0 && at < ALPHABET.length - 1) consider(ALPHABET[at + 1]!);
  }

  // 4. Phần còn lại của bảng chữ cái.
  for (const letter of ALPHABET) consider(letter);

  return shuffleSeeded([...correctSet, ...picked], seed);
}
