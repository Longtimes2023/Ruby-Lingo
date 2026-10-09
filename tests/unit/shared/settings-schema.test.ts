/**
 * RubyLingo — Test hợp đồng CÀI ĐẶT CỦA BÉ (`shared/schemas/settings.ts`, T074).
 *
 * ⭐ VÌ SAO BỘ TEST NÀY QUAN TRỌNG HƠN VẺ NGOÀI CỦA NÓ:
 *   `updateSettingsSchema` được dùng ở CẢ route (`server/routes/children.ts`) LẪN service
 *   (`server/services/ChildService.ts`) — cùng MỘT schema, cùng MỘT `.parse()`. Nếu schema có lỗ
 *   thì phụ huynh chỉnh ĐÚNG một ô mà lặng lẽ đổi luôn những ô khác, và KHÔNG có ngoại lệ nào
 *   được ném ra để ai đó nhận ra. Đó chính là loại hỏng im lặng chỉ test mới bắt được.
 *
 * ⚠️ HAI CÁI BẪY IM LẶNG ĐƯỢC CANH RIÊNG:
 *   1. KHÔNG trường nào được có `.default()`. Nếu có, một PATCH chỉ gửi `soundEnabled` sẽ vô tình
 *      ĐẶT LẠI `speechRate` về mặc định — bé tắt tiếng xong mất luôn tốc độ đọc đã chỉnh, mà
 *      không có dòng thông báo nào cho phụ huynh biết vì sao.
 *   2. `false` KHÁC `undefined`. Tắt âm thanh / nhạc / giảm chuyển động nghĩa là `false`, và
 *      `false` phải đi qua `.parse()` NGUYÊN VẸN — biến nó thành `true` là bật lại đúng thứ bé
 *      vừa tắt.
 */

import { describe, expect, it } from 'vitest';

import { SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '@shared/constants.js';
import { updateSettingsSchema } from '@shared/schemas/settings.js';

// =============================================================================
// Object rỗng — PATCH không có gì để lưu
// =============================================================================

describe('updateSettingsSchema — từ chối thay đổi rỗng', () => {
  /**
   * ⭐ Đây là "thành công giả" bị chặn tại nguồn: một PATCH `{}` thường là lỗi lập trình ở client
   *   (gửi state chưa khởi tạo). Trả 200 rồi không lưu gì khiến người ta mất hàng giờ tìm nguyên
   *   nhân, nên schema phải TỪ CHỐI rõ ràng.
   */
  it('object rỗng bị từ chối', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
  });
});

// =============================================================================
// Không có `.default()` — cập nhật MỘT PHẦN là thật
// =============================================================================

describe('updateSettingsSchema — trường tuỳ chọn, KHÔNG có giá trị mặc định', () => {
  it('bốn trường đều tuỳ chọn: gửi đủ cả bốn vẫn parse được', () => {
    const result = updateSettingsSchema.safeParse({
      soundEnabled: true,
      musicEnabled: true,
      speechRate: 0.8,
      reducedMotion: false,
    });

    expect(result.success).toBe(true);
  });

  /**
   * ⚠️ TEST CHÍNH CHỐNG `.default()`: nếu ai đó thêm `.default(...)` vào BẤT KỲ trường nào, thì
   *   `musicEnabled` / `speechRate` / `reducedMotion` sẽ xuất hiện trong kết quả dù request không
   *   gửi chúng — tức một PATCH một ô âm thầm ĐẶT LẠI các ô còn lại. `toEqual` và `Object.keys`
   *   dưới đây sẽ chuyển đỏ đúng lúc đó.
   */
  it('gửi MỘT trường ⇒ các trường khác VẮNG MẶT (không bị điền mặc định)', () => {
    const parsed = updateSettingsSchema.parse({ soundEnabled: true });

    expect(parsed).toEqual({ soundEnabled: true });
    expect(Object.keys(parsed)).toEqual(['soundEnabled']);
    expect(parsed.musicEnabled).toBeUndefined();
    expect(parsed.speechRate).toBeUndefined();
    expect(parsed.reducedMotion).toBeUndefined();
  });

  it('cập nhật một phần: chỉ tốc độ đọc thì các cờ vẫn vắng mặt', () => {
    const parsed = updateSettingsSchema.parse({ speechRate: 0.8 });

    expect(parsed).toEqual({ speechRate: 0.8 });
    expect(parsed.soundEnabled).toBeUndefined();
  });
});

// =============================================================================
// `speechRate` — khoảng kẹp trùng với `CHECK` của SQLite
// =============================================================================

describe('updateSettingsSchema — biên tốc độ đọc', () => {
  /**
   * ⚠️ GHIM HẰNG SỐ: schema import `SPEECH_RATE_MIN`/`SPEECH_RATE_MAX` từ `shared/constants.ts`
   *   (KHÔNG khai lại trong schema — tốt). Nhưng `migrations/002_child.sql` có
   *   `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` và migration là BẤT BIẾN. Nếu ai đó
   *   nới khoảng ở hằng số, schema sẽ cho qua một giá trị mà SQLite từ chối ⇒ phụ huynh nhận
   *   lỗi 500 cho một ô nhập trông hoàn toàn hợp lệ. Hai dòng dưới khoá đúng hai con số ấy lại.
   */
  it('hằng số khớp đúng khoảng của migration (0.5 – 1.2)', () => {
    expect(SPEECH_RATE_MIN).toBe(0.5);
    expect(SPEECH_RATE_MAX).toBe(1.2);
  });

  it('nhận giá trị biên 0.5 và 1.2 (bao gồm cả hai đầu)', () => {
    expect(updateSettingsSchema.safeParse({ speechRate: 0.5 }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ speechRate: 1.2 }).success).toBe(true);
  });

  it('từ chối ngay ngoài biên: 0.49 và 1.21', () => {
    expect(updateSettingsSchema.safeParse({ speechRate: 0.49 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ speechRate: 1.21 }).success).toBe(false);
  });

  /**
   * ⚠️ `NaN` / `Infinity` là loại giá trị số vô hình: chúng "là số" theo nghĩa kiểu, nên chỉ
   *   `.min()/.max()` mới chặn được. `NaN` bị `z.number()` từ chối; `Infinity` lọt qua `z.number()`
   *   nhưng phải bị `.max(1.2)` chặn. Nếu thiếu bất kỳ vế nào, một tốc độ đọc không dùng được sẽ
   *   đi thẳng xuống DB.
   */
  it('từ chối số bất thường: NaN, Infinity, -Infinity', () => {
    expect(updateSettingsSchema.safeParse({ speechRate: Number.NaN }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ speechRate: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
    expect(updateSettingsSchema.safeParse({ speechRate: Number.NEGATIVE_INFINITY }).success).toBe(
      false,
    );
  });

  it('từ chối tốc độ đọc không phải số', () => {
    expect(updateSettingsSchema.safeParse({ speechRate: '0.8' }).success).toBe(false);
  });
});

// =============================================================================
// Ba cờ boolean — `false` phải SỐNG SÓT
// =============================================================================

describe('updateSettingsSchema — cờ boolean', () => {
  /**
   * ⚠️ TEST HAI CHIỀU CHO `false`: "tắt" là một giá trị HỢP LỆ và phải đi qua `.parse()` nguyên
   *   vẹn. Nếu schema (hoặc một `.default(true)` lén lút) biến `false` thành `true`, bé tắt tiếng
   *   mà âm thanh vẫn kêu — không có lỗi nào được ném ra.
   */
  it('false là hợp lệ và GIỮ NGUYÊN false cho cả ba cờ', () => {
    const parsed = updateSettingsSchema.parse({
      soundEnabled: false,
      musicEnabled: false,
      reducedMotion: false,
    });

    expect(parsed).toEqual({ soundEnabled: false, musicEnabled: false, reducedMotion: false });
    expect(parsed.soundEnabled).toBe(false);
    expect(parsed.musicEnabled).toBe(false);
    expect(parsed.reducedMotion).toBe(false);
  });

  it('true là hợp lệ', () => {
    const parsed = updateSettingsSchema.parse({ soundEnabled: true, reducedMotion: true });

    expect(parsed).toEqual({ soundEnabled: true, reducedMotion: true });
  });

  it('giá trị không phải boolean bị từ chối ở cả ba cờ', () => {
    expect(updateSettingsSchema.safeParse({ soundEnabled: 1 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ musicEnabled: 'true' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ reducedMotion: 0 }).success).toBe(false);
  });
});

// =============================================================================
// Khoá lạ — bị CẮT, không được âm thầm tạo "thành công giả"
// =============================================================================

describe('updateSettingsSchema — khoá không hỗ trợ', () => {
  it('khoá lạ bị CẮT khỏi kết quả (không đi vào bản lưu)', () => {
    const parsed = updateSettingsSchema.parse({
      soundEnabled: true,
      timezone: 'Asia/Ho_Chi_Minh',
    });

    expect(parsed).toEqual({ soundEnabled: true });
    expect('timezone' in parsed).toBe(false);
  });

  /**
   * ⭐ Hệ quả tinh tế đã được ghi trong đầu tệp nguồn: vì `z.object` CẮT khoá lạ TRƯỚC khi
   *   `refine` chạy, một body CHỈ toàn khoá lạ bị cắt thành `{}` rồi bị `refine` từ chối. Tức
   *   trường không hỗ trợ bị TỪ CHỐI RÕ RÀNG, chứ không nhận 200 rồi lặng lẽ không lưu gì.
   */
  it('body chỉ toàn khoá lạ bị từ chối (cắt thành rỗng rồi refine chặn)', () => {
    expect(updateSettingsSchema.safeParse({ timezone: 'Asia/Ho_Chi_Minh' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ dailyTimeLimitMin: 30 }).success).toBe(false);
  });
});
