/**
 * RubyLingo — G9 `word_picture`: LUẬT THUẦN (dựng hai cột).
 *
 * ⚠️ HAI CỘT PHẢI ĐƯỢC XÁO **ĐỘC LẬP**.
 *   Nếu xáo bằng cùng một hạt giống thì hàng thứ i bên trái luôn khớp hàng thứ i bên phải — bé chỉ
 *   việc nối thẳng ngang, không phải đọc từ. Đây là lỗi im lặng: trò chơi vẫn "chạy", không có lỗi
 *   nào được ném, mà bài học thì biến mất. Có test chặn.
 */

import type { Word } from '@shared/types/content.js';

import { shuffleSeeded } from '../../../lib/random.js';

export interface PairColumns {
  /** Cột hình, đã xáo. */
  left: Word[];
  /** Cột từ (hoặc nút nghe), đã xáo ĐỘC LẬP với cột hình. */
  right: Word[];
}

/**
 * Dựng hai cột cho `pairs` từ. `pairs` được kẹp theo số từ thật của bài.
 *
 * `seed` khác nhau cho hai cột là CỐ Ý — xem ghi chú đầu file.
 */
export function buildColumns(
  words: readonly Word[],
  pairs: number,
  seed: number | string,
): PairColumns {
  const usable = words.slice(0, Math.max(0, pairs));
  return {
    left: shuffleSeeded(usable, `${seed}#left`),
    right: shuffleSeeded(usable, `${seed}#right`),
  };
}

/** Hai đầu này có phải một cặp không. */
export function isWordPair(left: Word | undefined, right: Word | undefined): boolean {
  return left !== undefined && right !== undefined && left.id === right.id;
}
