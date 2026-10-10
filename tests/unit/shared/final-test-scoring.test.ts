/**
 * RubyLingo — Test THANG KHIÊN bài thi cuối khoá (`shared/final-test-scoring.ts`).
 *
 * ⭐ NHỮNG ĐIỀU FILE NÀY CANH (mỗi điều đều là "nói sai với đứa trẻ" nếu hỏng):
 *   1. **KHÔNG BAO GIỜ 0 khiên** — `correct = 0` phải ra ĐÚNG 1, với MỌI `total` (B1).
 *   2. **ĐƠN ĐIỆU** — làm đúng nhiều hơn không bao giờ bị ít khiên hơn.
 *   3. **`total <= 0` phải KÊU** — một phần "0 câu" không phải bài thi, không được lặng lẽ ra 1.
 *   4. **"chưa làm" KHÁC "làm dở" KHÁC "làm xong"** — `readSectionShields` trả `null` cho hai
 *      trạng thái đầu, để UI không vẽ 🛡️ cho phần bé chưa mở.
 *
 * ⚠️ BÀI KIỂM "QUÉT VÉT CẠN" (total 1..30 × correct 0..total) là bài quan trọng nhất: mọi bất biến
 *   ở trên phải đúng với MỌI tổ hợp, không chỉ vài ví dụ đẹp do người viết chọn.
 */

import { describe, expect, it } from 'vitest';

import {
  readSectionShields,
  sectionProgressState,
  shieldsForSection,
  shieldsForSpeaking,
  SHIELD_MAX,
  SHIELD_MIN,
} from '@shared/final-test-scoring.js';

// =============================================================================
// shieldsForSection — sàn / trần / thang
// =============================================================================

describe('shieldsForSection — sàn 1 và trần 5', () => {
  it('0 câu đúng ⇒ ĐÚNG 1 khiên (B1: không bao giờ 0)', () => {
    expect(shieldsForSection(0, 20)).toBe(1);
    expect(shieldsForSection(0, 25)).toBe(1);
    expect(shieldsForSection(0, 1)).toBe(1);
    expect(shieldsForSection(0, 30)).toBe(1);
  });

  it('đúng cả ⇒ 5 khiên', () => {
    expect(shieldsForSection(20, 20)).toBe(5);
    expect(shieldsForSection(25, 25)).toBe(5);
    expect(shieldsForSection(1, 1)).toBe(5);
  });

  it('đúng nhiều hơn tổng (dữ liệu bẩn) ⇒ vẫn kẹp về 5, không tràn', () => {
    expect(shieldsForSection(999, 20)).toBe(5);
  });

  it('số âm ⇒ kẹp về 0 ⇒ 1 khiên, không âm', () => {
    expect(shieldsForSection(-5, 20)).toBe(1);
  });

  it('mọi kết quả nằm trong [1,5], và hằng số sàn/trần khớp', () => {
    expect(SHIELD_MIN).toBe(1);
    expect(SHIELD_MAX).toBe(5);
  });
});

describe('shieldsForSection — total <= 0 phải KÊU (ồn ào, không im lặng)', () => {
  it('total = 0 ⇒ ném RangeError', () => {
    expect(() => shieldsForSection(0, 0)).toThrow(RangeError);
  });

  it('total âm ⇒ ném RangeError', () => {
    expect(() => shieldsForSection(3, -1)).toThrow(RangeError);
  });

  it('total không hữu hạn (NaN / Infinity) ⇒ ném RangeError', () => {
    expect(() => shieldsForSection(1, Number.NaN)).toThrow(RangeError);
    expect(() => shieldsForSection(1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('correctFirstTry không hữu hạn ⇒ ném RangeError (không lặng lẽ ra 1)', () => {
    expect(() => shieldsForSection(Number.NaN, 20)).toThrow(RangeError);
  });
});

describe('shieldsForSection — đơn điệu không giảm + quét vét cạn', () => {
  it('mọi tổ hợp total ∈ [1..30], correct ∈ [0..total]: nằm trong 1..5 và đơn điệu', () => {
    for (let total = 1; total <= 30; total += 1) {
      let previous = 0;
      for (let correct = 0; correct <= total; correct += 1) {
        const shields = shieldsForSection(correct, total);
        // (a) luôn nằm trong miền hợp lệ
        expect(shields, `total=${total} correct=${correct}`).toBeGreaterThanOrEqual(1);
        expect(shields, `total=${total} correct=${correct}`).toBeLessThanOrEqual(5);
        // (b) đơn điệu: không bao giờ giảm khi đúng thêm
        expect(shields, `total=${total} correct=${correct} < bậc trước`).toBeGreaterThanOrEqual(previous);
        previous = shields;
      }
      // (c) hai đầu thang
      expect(shieldsForSection(0, total)).toBe(1);
      expect(shieldsForSection(total, total)).toBe(5);
    }
  });

  it('các mốc tỉ lệ cho ra bậc mong đợi (20 câu)', () => {
    expect(shieldsForSection(18, 20)).toBe(5); // 0.90
    expect(shieldsForSection(15, 20)).toBe(4); // 0.75
    expect(shieldsForSection(12, 20)).toBe(3); // 0.60
    expect(shieldsForSection(8, 20)).toBe(2); // 0.40
    expect(shieldsForSection(7, 20)).toBe(1); // < 0.40
  });
});

// =============================================================================
// readSectionShields — chưa làm / làm dở / làm xong
// =============================================================================

describe('readSectionShields — phân biệt chưa làm với làm dở', () => {
  it('CHƯA làm câu nào ⇒ null (KHÔNG hiện 1 khiên cho phần bé chưa mở)', () => {
    expect(readSectionShields({ correctFirstTry: 0, answered: 0, total: 20 })).toBeNull();
  });

  it('LÀM DỞ (chưa hết câu) ⇒ null', () => {
    expect(readSectionShields({ correctFirstTry: 3, answered: 3, total: 20 })).toBeNull();
    expect(readSectionShields({ correctFirstTry: 19, answered: 19, total: 20 })).toBeNull();
  });

  it('ĐÃ XONG phần ⇒ trả khiên thật', () => {
    expect(readSectionShields({ correctFirstTry: 0, answered: 20, total: 20 })).toBe(1);
    expect(readSectionShields({ correctFirstTry: 20, answered: 20, total: 20 })).toBe(5);
  });

  it('phần rỗng (total 0) ⇒ null, không ném (khác shieldsForSection)', () => {
    expect(readSectionShields({ correctFirstTry: 0, answered: 0, total: 0 })).toBeNull();
  });

  it('answered dữ liệu bẩn (âm / NaN) ⇒ null, không ném', () => {
    expect(readSectionShields({ correctFirstTry: 0, answered: -1, total: 20 })).toBeNull();
    expect(readSectionShields({ correctFirstTry: 0, answered: Number.NaN, total: 20 })).toBeNull();
  });
});

describe('sectionProgressState — ba trạng thái', () => {
  it('chưa làm ⇒ not_started', () => {
    expect(sectionProgressState(null)).toBe('not_started');
    expect(sectionProgressState(undefined)).toBe('not_started');
    expect(sectionProgressState({ answered: 0, total: 20 })).toBe('not_started');
  });

  it('làm dở ⇒ in_progress', () => {
    expect(sectionProgressState({ answered: 1, total: 20 })).toBe('in_progress');
    expect(sectionProgressState({ answered: 19, total: 20 })).toBe('in_progress');
  });

  it('xong ⇒ completed', () => {
    expect(sectionProgressState({ answered: 20, total: 20 })).toBe('completed');
  });
});

// =============================================================================
// shieldsForSpeaking — theo độ THAM GIA, không theo độ đúng
// =============================================================================

describe('shieldsForSpeaking — theo độ tham gia, không chấm đúng/sai', () => {
  it('nói đủ 4 part ⇒ 5 khiên', () => {
    expect(shieldsForSpeaking(4, 4)).toBe(5);
  });

  it('chưa nói đủ ⇒ null (KHÔNG phải 0 khiên)', () => {
    expect(shieldsForSpeaking(0, 4)).toBeNull();
    expect(shieldsForSpeaking(3, 4)).toBeNull();
  });

  it('phần rỗng / dữ liệu bẩn ⇒ null', () => {
    expect(shieldsForSpeaking(0, 0)).toBeNull();
    expect(shieldsForSpeaking(4, Number.NaN)).toBeNull();
    expect(shieldsForSpeaking(Number.NaN, 4)).toBeNull();
  });
});
