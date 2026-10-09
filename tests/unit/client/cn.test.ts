/**
 * RubyLingo — chốt chặn cho `cn()`.
 *
 * Bộ test này tồn tại vì một lỗi CÓ THẬT đã lọt qua toàn bộ các cổng kiểm tra khác:
 * `twMerge` xoá mất `text-kid-*` khi nó đứng cạnh một `text-<màu>`.
 *
 * Vì sao không cổng nào bắt được:
 *   - TypeScript: cả hai đều là `string`, không có gì để suy luận.
 *   - Tailwind:  class vẫn có trong file nguồn → CSS vẫn sinh đủ, không thiếu gì.
 *   - `eslint`:  không có luật nào cho việc này.
 *   - Ảnh chụp:  CÓ — nhưng chỉ khi tình cờ nhìn kỹ một thẻ hẹp ở màn hình rộng.
 *
 * Nên ở đây khoá lại bằng test, để lần sau lỗi tái phát là CI đỏ ngay.
 */

import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../../tailwind.config.js';
import { KID_FONT_SIZES, cn } from '../../../src/lib/cn.js';

describe('cn — không được nuốt cỡ chữ text-kid-*', () => {
  it('giữ CẢ cỡ chữ lẫn màu chữ khi đứng cạnh nhau (lỗi đã từng xảy ra)', () => {
    const out = cn('text-kid-xs', 'text-brand');
    expect(out).toContain('text-kid-xs');
    expect(out).toContain('text-brand');
  });

  it('giữ cỡ chữ với mọi bậc và mọi màu đang dùng trong dự án', () => {
    const colors = [
      'text-ink',
      'text-ink-soft',
      'text-ink-faint',
      'text-ink-inverse',
      'text-brand',
      'text-star',
      'text-acorn',
      'text-heart',
      'text-success',
      'text-warn',
      'text-danger',
    ];

    for (const size of KID_FONT_SIZES) {
      for (const color of colors) {
        const out = cn(`text-${size}`, color);
        expect(out, `${size} + ${color}`).toContain(`text-${size}`);
        expect(out, `${size} + ${color}`).toContain(color);
      }
    }
  });

  it('giữ cỡ chữ khi có biến thể responsive (trường hợp của HeartMeter/StreakFlame)', () => {
    const out = cn('text-kid-xs font-bold tabular-nums text-heart', 'sm:text-kid-sm');
    expect(out).toContain('text-kid-xs');
    expect(out).toContain('text-heart');
    expect(out).toContain('sm:text-kid-sm');
  });

  it('giữ cỡ chữ khi className truyền từ ngoài vào ghi đè (đúng ca dùng thật của cn)', () => {
    const out = cn('text-kid-md text-ink', 'text-kid-lg');
    expect(out).toContain('text-kid-lg');
    expect(out).not.toContain('text-kid-md');
    expect(out).toContain('text-ink');
  });
});

describe('cn — vẫn khử trùng như hành vi gốc của Tailwind', () => {
  it('cỡ chữ sau thắng cỡ chữ trước', () => {
    expect(cn('text-kid-xs', 'text-kid-sm')).toBe('text-kid-sm');
  });

  it('màu chữ sau thắng màu chữ trước', () => {
    expect(cn('text-ink', 'text-brand')).toBe('text-brand');
  });

  it('cỡ chữ mặc định của Tailwind vẫn hoạt động', () => {
    expect(cn('text-xs', 'text-sm')).toBe('text-sm');
  });

  it('cỡ chữ tuỳ ý `text-[14px]` vẫn thắng cỡ chữ đặt tên', () => {
    expect(cn('text-kid-xs', 'text-[14px]')).toBe('text-[14px]');
  });

  it('căn lề không bị nuốt cùng cỡ chữ', () => {
    const out = cn('text-kid-xs', 'text-center');
    expect(out).toContain('text-kid-xs');
    expect(out).toContain('text-center');
  });

  it('viền: độ dày và màu là hai nhóm khác nhau', () => {
    const out = cn('border-line', 'border-2', 'rounded-kid');
    expect(out).toContain('border-line');
    expect(out).toContain('border-2');
    expect(out).toContain('rounded-kid');
  });

  it('padding sau thắng padding trước (lý do gốc phải dùng twMerge)', () => {
    expect(cn('rounded-kid px-4', 'px-8')).toContain('px-8');
    expect(cn('rounded-kid px-4', 'px-8')).not.toContain('px-4');
  });

  it('clsx vẫn xử lý điều kiện/mảng/object', () => {
    expect(cn('a', false, undefined, null, ['b', 'c'], { d: true, e: false })).toBe('a b c d');
  });
});

describe('cn — danh sách cỡ chữ phải khớp tailwind.config.ts', () => {
  it('KID_FONT_SIZES đúng bằng thang fontSize khai trong config', () => {
    // Đây là chốt chặn cho tương lai: thêm bậc cỡ chữ vào tailwind.config.ts mà quên
    // khai ở `cn.ts` thì `twMerge` lại xoá cỡ chữ đó, và test này đỏ trước khi lên production.
    const declared = Object.keys(tailwindConfig.theme.extend.fontSize).sort();
    const taught = [...KID_FONT_SIZES].sort();

    expect(taught).toEqual(declared);
  });
});
