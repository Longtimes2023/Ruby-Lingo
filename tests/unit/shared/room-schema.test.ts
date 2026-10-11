import { describe, expect, it } from 'vitest';
import { roomPlacementsSchema } from '../../../shared/schemas/room.js';

describe('roomPlacementsSchema', () => {
  it('接受有效的百分比画布位置与隐藏状态', () => {
    expect(roomPlacementsSchema.parse([{ itemId: 'dec-plant', x: 100, y: 0, hidden: true }])).toEqual([
      { itemId: 'dec-plant', x: 100, y: 0, hidden: true },
    ]);
  });

  it('拒绝越界坐标、重复物品和未知字段以外的错误形状', () => {
    expect(roomPlacementsSchema.safeParse([{ itemId: 'dec-plant', x: 101, y: 10, hidden: false }]).success).toBe(false);
    expect(roomPlacementsSchema.safeParse([
      { itemId: 'dec-plant', x: 1, y: 2, hidden: false },
      { itemId: 'dec-plant', x: 3, y: 4, hidden: false },
    ]).success).toBe(false);
  });
});
