/**
 * RubyLingo — Trạng thái trả lời của MỘT câu bài thi cuối khoá.
 *
 * ⭐ VÌ SAO CÓ HOOK DÙNG CHUNG (không phải mỗi component tự đếm):
 *   Chín dạng câu đều có CÙNG một luật: đúng ngay ⇒ xong; chưa đúng ⇒ đếm lỗi, động viên thử lại;
 *   quá `MAX_WRONG_PER_ROUND` ⇒ lộ đáp án và cho bé bấm "Tiếp" (không bao giờ bỏ câu). Nếu mỗi
 *   component tự viết, chín bản sao sẽ lệch nhau ở chỗ hiếm dùng — và lỗi lệch ấy im lặng.
 *
 * ⚠️ KHÔNG PHẠT, KHÔNG GIỚI HẠN SỐ CÂU SAI của bé ngoài việc LỘ ĐÁP ÁN: cùng tinh thần
 *   `MAX_WRONG_PER_ROUND` ở `game-scoring.ts:41-47`. Sau 2 lần chưa đúng, ta CHỈ CHO đáp án — bé
 *   vẫn đi hết được câu, vẫn không bị mắng.
 *
 * ⚠️ `firstTry` được chốt tại ĐÚNG thời điểm bé trả lời đúng — nó là con số quyết định khiên, nên
 *   phải tính theo "đúng ngay lần đầu", không phải "đúng sau khi sửa".
 */

import { useCallback, useMemo, useState } from 'react';

import { MAX_WRONG_PER_ROUND } from '@shared/game-scoring.js';

import type { FinalTestItemResult } from './types.js';

export interface FinalTestItemState {
  /** Số lần trả lời CHƯA đúng ở câu này. */
  wrongAttempts: number;
  /** Câu đã kết thúc (đã báo lên trên). Chặn mọi tương tác thêm. */
  done: boolean;
  /** Đã thử quá `MAX_WRONG_PER_ROUND` lần ⇒ LỘ đáp án, chờ bé bấm "Tiếp". */
  revealed: boolean;
  /**
   * Các giá trị bé đã chọn SAI (đã chuẩn hoá). Nút tương ứng được tô đỏ nhẹ và không bấm lại —
   * để bé thấy mình đã thử gì, thay vì bấm lại đúng nút cũ rồi bối rối.
   */
  wrongPicks: ReadonlySet<string>;
  /** Bé trả lời một giá trị. Trả `true` nếu đúng. */
  submit: (value: string) => boolean;
  /** Khi đã lộ đáp án: bé bấm "Tiếp" ⇒ kết thúc câu (ghi `firstTry = false`). */
  finish: () => void;
}

/** So đáp án: bỏ khoảng trắng thừa và không phân biệt hoa/thường ("Cat" khớp "cat"). */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function useFinalTestItem(
  itemId: string,
  answer: string,
  onAnswered: (result: FinalTestItemResult) => void,
): FinalTestItemState {
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<ReadonlySet<string>>(() => new Set());
  const [done, setDone] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const expected = useMemo(() => normalize(answer), [answer]);

  const submit = useCallback(
    (value: string): boolean => {
      if (done) return true;

      const normalized = normalize(value);
      const isCorrect = expected.length > 0 && normalized === expected;
      if (isCorrect) {
        setDone(true);
        onAnswered({ itemId, firstTry: wrongAttempts === 0, wrongAttempts });
        return true;
      }

      const nextWrong = wrongAttempts + 1;
      setWrongAttempts(nextWrong);
      setWrongPicks((current) => new Set(current).add(normalized));
      if (nextWrong >= MAX_WRONG_PER_ROUND) setRevealed(true);
      return false;
    },
    [done, expected, itemId, wrongAttempts, onAnswered],
  );

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    onAnswered({ itemId, firstTry: false, wrongAttempts });
  }, [done, itemId, wrongAttempts, onAnswered]);

  return { wrongAttempts, wrongPicks, done, revealed, submit, finish };
}
