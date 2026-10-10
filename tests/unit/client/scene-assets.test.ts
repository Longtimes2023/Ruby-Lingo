/**
 * RubyLingo — CỔNG CHỐNG LỆCH: danh sách khoá tranh cảnh (`scene-assets.ts`) phải KHỚP đĩa.
 *
 * ⭐ VÌ SAO TEST NÀY LÀ RÀNG BUỘC:
 *   UI quyết định "vẽ tranh hay lùi về không ảnh" dựa vào `SCENE_KEYS`. Nếu danh sách lệch với
 *   `public/assets/scenes/` thì hoặc (a) vẽ một URL 404 ⇒ bé thấy Ô ẢNH VỠ, hoặc (b) tệp có thật mà
 *   không vẽ ⇒ thiếu tranh. Cả hai đều IM LẶNG nếu không có test. Test này đọc THẲNG thư mục tệp và
 *   bắt buộc hai bên khớp — thêm/xoá tranh mà quên cập nhật danh sách ⇒ ĐỎ ngay.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCENE_KEYS, sceneAssetUrlIfExistsOrNull } from '@/data/scene-assets.js';

const SCENES_DIR = join(process.cwd(), 'public/assets/scenes');

/** Khoá tranh cảnh THẬT trên đĩa (bỏ đuôi `.webp`). */
function sceneKeysOnDisk(): string[] {
  return readdirSync(SCENES_DIR)
    .filter((name) => name.endsWith('.webp'))
    .map((name) => name.slice(0, -'.webp'.length))
    .sort();
}

describe('scene-assets — danh sách khoá tranh cảnh', () => {
  it('KHỚP đúng đĩa `public/assets/scenes/` (thêm/xoá tranh phải cập nhật danh sách)', () => {
    expect([...SCENE_KEYS].sort()).toEqual(sceneKeysOnDisk());
  });

  it('tranh truyện của bài thi (`story-park`) CÓ thật trên đĩa', () => {
    expect(sceneKeysOnDisk()).toContain('story-park');
  });

  it('`sceneAssetUrlIfExistsOrNull`: có tệp ⇒ URL, thiếu/rỗng ⇒ null (không ảnh vỡ)', () => {
    expect(sceneAssetUrlIfExistsOrNull('story-park')).toBe('/assets/scenes/story-park.webp');
    expect(sceneAssetUrlIfExistsOrNull('  story-park  ')).toBe('/assets/scenes/story-park.webp');
    expect(sceneAssetUrlIfExistsOrNull('khong-co-tranh-nay')).toBeNull();
    expect(sceneAssetUrlIfExistsOrNull('')).toBeNull();
    expect(sceneAssetUrlIfExistsOrNull('   ')).toBeNull();
  });
});
