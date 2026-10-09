/**
 * Test cho `computeHappiness` (T066) — mức Vui vẻ ❤️ của linh vật.
 *
 * ⭐ VÌ SAO TỆP NÀY ĐỨNG RIÊNG VÀ KHÔNG CẦN DB:
 *   `computeHappiness` là hàm THUẦN, nên mọi mốc thời gian đều kiểm được trong vài mili-giây —
 *   kể cả mốc "bé xa app 100 ngày", thứ không thể dựng bằng cách chờ. Kiểm ở tầng DB thì mỗi
 *   mốc phải giả lập đồng hồ và ghi `streak_state`, chậm hơn nhiều mà lại kiểm ít mốc hơn.
 *   Tầng service có test riêng cho phần "lấy đúng hai con số từ DB" (neo thời gian + cột cũ).
 *
 * ⚠️ BA ĐIỀU DƯỚI ĐÂY LÀ LUẬT CỦA DỰ ÁN, KHÔNG PHẢI SỞ THÍCH — mỗi điều có một test riêng:
 *   1. SÀN = 1: linh vật không bao giờ buồn bã hoàn toàn ⇒ không bao giờ có lời trách móc.
 *   2. Ngày ÂN HẠN: nghỉ một ngày không mất ❤️ (bố mẹ quyết định lịch, không phải bé 7 tuổi).
 *   3. Hàm không được ném với dữ liệu rác: nó chạy trong lúc dựng ảnh chụp cho MỌI màn hình.
 */

import { describe, expect, it } from 'vitest';

import {
  HAPPINESS_DEFAULT,
  HAPPINESS_GRACE_DAYS,
  HAPPINESS_MAX,
  HAPPINESS_MIN,
  computeHappiness,
} from '@shared/pet-happiness.js';

describe('computeHappiness — ngày ân hạn', () => {
  it('hôm nay bé có học (0 ngày) ⇒ giữ nguyên', () => {
    expect(computeHappiness(3, 0)).toBe(3);
    expect(computeHappiness(5, 0)).toBe(5);
    expect(computeHappiness(1, 0)).toBe(1);
  });

  it('⚠️ nghỉ ĐÚNG ngày ân hạn ⇒ KHÔNG mất ❤️ nào', () => {
    // Đây là luật tâm lý, không phải chi tiết: bé 7 tuổi không tự quyết định việc quay lại app.
    expect(HAPPINESS_GRACE_DAYS).toBe(1);
    expect(computeHappiness(4, 1)).toBe(4);
  });

  it('từ ngày thứ hai trở đi mỗi ngày mất đúng 1 ❤️', () => {
    expect(computeHappiness(5, 2)).toBe(4);
    expect(computeHappiness(5, 3)).toBe(3);
    expect(computeHappiness(5, 4)).toBe(2);
    expect(computeHappiness(5, 5)).toBe(1);
  });
});

describe('computeHappiness — SÀN 1 và TRẦN 5', () => {
  it('⚠️ xa app rất lâu ⇒ DỪNG ở 1, không bao giờ 0 hay âm', () => {
    for (const days of [5, 6, 30, 365, 10_000]) {
      expect(computeHappiness(5, days), `xa ${days} ngày`).toBe(HAPPINESS_MIN);
    }
  });

  it('mức đã lưu là 1 thì dù xa bao lâu vẫn là 1 (không bao giờ buồn bã hoàn toàn)', () => {
    expect(computeHappiness(1, 999)).toBe(1);
  });

  it('không bao giờ vượt trần 5', () => {
    expect(computeHappiness(5, 0)).toBe(HAPPINESS_MAX);
    expect(computeHappiness(99, 0)).toBe(HAPPINESS_MAX);
  });

  it('mức đã lưu 3, xa 2 ngày ⇒ 2 (hao đúng 1, không hao oan thêm)', () => {
    expect(computeHappiness(3, 2)).toBe(2);
  });
});

describe('computeHappiness — không được ném, không được trả số vô lý', () => {
  it('ngày xa ÂM hoặc không hữu hạn ⇒ coi như 0 (không hao)', () => {
    expect(computeHappiness(4, -5)).toBe(4);
    expect(computeHappiness(4, Number.NaN)).toBe(4);
    expect(computeHappiness(4, Number.POSITIVE_INFINITY)).toBe(4);
  });

  it('mức đã lưu rác ⇒ rơi về mức mặc định thay vì NaN', () => {
    expect(computeHappiness(Number.NaN, 0)).toBe(HAPPINESS_DEFAULT);
    // `Infinity` KHÔNG hữu hạn ⇒ rơi về mặc định (3), không phải về trần — "không biết" thì đối
    // xử như bé mới, chứ không thưởng cho một giá trị rác bằng mức vui tối đa.
    expect(computeHappiness(Number.POSITIVE_INFINITY, 0)).toBe(HAPPINESS_DEFAULT);
  });

  it('số ngày thập phân ⇒ chỉ tính NGÀY TRỌN VẸN', () => {
    // 2,9 ngày vẫn là "ngày thứ ba" ⇒ mất 1 ❤️; 1,9 ngày vẫn trong ân hạn.
    expect(computeHappiness(4, 2.9)).toBe(3);
    expect(computeHappiness(4, 1.9)).toBe(4);
  });

  it('là hàm THUẦN: cùng đầu vào ⇒ cùng đầu ra, gọi lại không đổi kết quả', () => {
    const first = computeHappiness(4, 3);
    expect(computeHappiness(4, 3)).toBe(first);
    expect(computeHappiness(4, 3)).toBe(first);
  });
});
