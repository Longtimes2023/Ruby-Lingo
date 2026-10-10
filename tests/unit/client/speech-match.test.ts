/**
 * RubyLingo — Test HÀM SO KHỚP lời bé nói (TẦNG 2 "Máy nghe thử").
 *
 * ⭐ VÌ SAO TEST KỸ HÀM THUẦN NÀY: nó quyết định câu phản hồi bé nhận được. Sai theo hướng KHẮT
 *   KHE (nói đúng mà báo "chưa nghe rõ") làm bé cụt hứng — mà đây không phải điểm, nên cái giá
 *   của việc quá dễ thấp hơn hẳn cái giá của việc quá khắt khe. Test khoá cả hai phía: các ca
 *   "phải nhận ra" (rất dễ) và ca "phải KHÔNG nhận ra" (khác hẳn) để ngưỡng không bị nới vô hạn.
 */

import { describe, expect, it } from 'vitest';

import { isSpeechMatch, normalizeSpeech } from '@/lib/speechMatch.js';

describe('normalizeSpeech', () => {
  it('hạ chữ thường, bỏ dấu câu và gộp khoảng trắng', () => {
    expect(normalizeSpeech('  Point to the DOOR!  ')).toBe('point to the door');
  });

  it('bỏ dấu nháy (it’s → its) — Web Speech hay chèn/bỏ dấu nháy', () => {
    expect(normalizeSpeech("It's a cat")).toBe('its a cat');
  });

  it('chuỗi rỗng / chỉ dấu câu ⇒ rỗng', () => {
    expect(normalizeSpeech('   ')).toBe('');
    expect(normalizeSpeech('!!!')).toBe('');
  });
});

describe('isSpeechMatch — các ca PHẢI nhận ra (ngưỡng dễ)', () => {
  it('khớp chính xác', () => {
    expect(isSpeechMatch('cat', 'cat')).toBe(true);
  });

  it('khác hoa/thường', () => {
    expect(isSpeechMatch('CAT', 'cat')).toBe(true);
    expect(isSpeechMatch('Cat', 'cat')).toBe(true);
  });

  it('thừa khoảng trắng hai đầu và ở giữa', () => {
    expect(isSpeechMatch('   cat   ', 'cat')).toBe(true);
    expect(isSpeechMatch('point   to  the door', 'Point to the door.')).toBe(true);
  });

  it('bỏ qua dấu câu', () => {
    expect(isSpeechMatch('point to the door', 'Point to the door.')).toBe(true);
  });

  it('nghe thành TỪ GẦN GIỐNG (sai 1 ký tự)', () => {
    expect(isSpeechMatch('banama', 'banana')).toBe(true);
    expect(isSpeechMatch('cats', 'cat')).toBe(true);
  });

  it('bé chỉ nói TỪ KHOÁ trong câu dài', () => {
    expect(isSpeechMatch('door', 'Point to the door.')).toBe(true);
    expect(isSpeechMatch('the cat', 'Point to the cat.')).toBe(true);
  });

  it('máy nghe DƯ vài từ', () => {
    expect(isSpeechMatch('a cat', 'cat')).toBe(true);
  });

  it('câu dài: nói đủ phần lớn các từ', () => {
    expect(isSpeechMatch('point to door', 'Point to the door.')).toBe(true);
  });
});

describe('isSpeechMatch — các ca PHẢI KHÔNG nhận ra', () => {
  it('rỗng một trong hai ⇒ không khớp', () => {
    expect(isSpeechMatch('', 'cat')).toBe(false);
    expect(isSpeechMatch('cat', '')).toBe(false);
    expect(isSpeechMatch('   ', 'cat')).toBe(false);
  });

  it('nghe SAI HẲN (từ hoàn toàn khác)', () => {
    expect(isSpeechMatch('banana', 'cat')).toBe(false);
    expect(isSpeechMatch('i like apples', 'Point to the door.')).toBe(false);
  });

  it('chỉ ậm ừ một mạo từ ngắn ⇒ chưa tính là nghe ra', () => {
    expect(isSpeechMatch('the', 'the cat')).toBe(false);
    expect(isSpeechMatch('a', 'cat')).toBe(false);
  });

  it('khác một chữ đơn ngắn (≤2 ký tự) cũng không tha', () => {
    expect(isSpeechMatch('ox', 'ox')).toBe(true); // khớp chính xác thì vẫn đúng
    expect(isSpeechMatch('on', 'ox')).toBe(false); // 2 ký tự: không cho phép lỗi
  });
});

describe('isSpeechMatch — ngưỡng cấu hình được', () => {
  it('nới ngưỡng tỉ lệ từ làm ca "thiếu một nửa" cũng khớp', () => {
    // "point to the door": 4 từ. Bé nói 2 từ ⇒ tỉ lệ 0.5 < 0.6 mặc định ⇒ CHƯA khớp.
    expect(isSpeechMatch('point door', 'Point to the door.')).toBe(false);
    // Hạ ngưỡng xuống 0.5 ⇒ khớp.
    expect(isSpeechMatch('point door', 'Point to the door.', { minTokenRatio: 0.5 })).toBe(true);
  });
});
