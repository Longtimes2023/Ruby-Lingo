/**
 * RubyLingo — CỔNG CHỐNG HỎNG IM LẶNG: mọi dạng câu có THẬT trong đề đều phải có component.
 *
 * ⭐ VÌ SAO TEST NÀY LÀ RÀNG BUỘC, KHÔNG PHẢI KIỂM TRA CHO VUI:
 *   Registry khai `Record<FinalTestInteraction, …>` đủ khoá ⇒ thêm giá trị vào UNION mà quên
 *   component là lỗi biên dịch. NHƯNG union là hợp đồng ở tầng MÃ; NỘI DUNG (`final-test/*.json`) là
 *   dữ liệu có thể chứa một `interaction` mà union chưa biết (ai đó sửa JSON trước khi sửa schema).
 *   Khi ấy `tsc` xanh, nhưng bé bấm vào sẽ gặp MÀN HÌNH TRỐNG — lỗi tệ nhất mà dự án này chống.
 *   Test này đọc THẲNG JSON và bắt buộc mỗi `interaction` phải tra được component.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FINAL_TEST_COMPONENTS,
  getFinalTestComponent,
  isInteractionSupported,
} from '@/components/final-test/registry.js';
import type { FinalTestInteraction } from '@shared/schemas/final-test.js';

const FINAL_TEST_DIR = join(process.cwd(), 'src/data/levels/starters/final-test');

/** Danh sách `interaction` THẬT đang có trong đề (đọc từ JSON, KHÔNG đoán). */
function interactionsInContent(): { interaction: string; count: number }[] {
  const counts = new Map<string, number>();

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const interaction = record['interaction'];
      if (typeof interaction === 'string') {
        counts.set(interaction, (counts.get(interaction) ?? 0) + 1);
      }
      Object.values(record).forEach(walk);
    }
  };

  for (const file of readdirSync(FINAL_TEST_DIR)) {
    if (!file.endsWith('.json')) continue;
    walk(JSON.parse(readFileSync(join(FINAL_TEST_DIR, file), 'utf8')));
  }

  return [...counts.entries()].map(([interaction, count]) => ({ interaction, count }));
}

describe('final-test registry — phủ hết dạng câu', () => {
  const content = interactionsInContent();

  it('đọc được dạng câu THẬT từ đề (cổng không được rỗng)', () => {
    // Nếu con số này tụt mạnh, vòng lặp bên dưới đã ngừng chạy và các test "xanh" kia là xanh GIẢ.
    expect(content.length).toBeGreaterThanOrEqual(9);
  });

  it('MỌI interaction trong đề đều có component (không màn hình trống)', () => {
    for (const { interaction, count } of content) {
      expect(
        isInteractionSupported(interaction as FinalTestInteraction),
        `dạng câu "${interaction}" (${count} câu) CHƯA có component trong registry`,
      ).toBe(true);
    }
  });

  it('union `FinalTestInteraction` và registry KHỚP nhau (đủ 9 dạng, không dư, không thiếu)', () => {
    const keys = Object.keys(FINAL_TEST_COMPONENTS).sort();
    const expected = [
      'arrange_letters',
      'choose_picture',
      'gap_fill',
      'pick_name',
      'speak_prompt',
      'story_answer',
      'tick_cross',
      'write_word',
      'yes_no',
    ];

    expect(keys).toEqual(expected);
    for (const key of keys) {
      expect(typeof FINAL_TEST_COMPONENTS[key as FinalTestInteraction]).toBe('function');
    }
  });

  it('mọi dạng câu trong đề đều là khoá của registry', () => {
    const keys = new Set(Object.keys(FINAL_TEST_COMPONENTS));
    for (const { interaction } of content) {
      expect(keys.has(interaction), `"${interaction}" không phải khoá của registry`).toBe(true);
    }
  });

  it('`getFinalTestComponent` ném lỗi RÕ RÀNG với dạng câu chưa hỗ trợ (không trả undefined)', () => {
    expect(() => getFinalTestComponent('khong_ton_tai' as FinalTestInteraction)).toThrow(
      /khong_ton_tai/,
    );
  });
});
