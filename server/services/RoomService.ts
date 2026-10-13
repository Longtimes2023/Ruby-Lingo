import { getDb, transaction } from '../db/connection.js';
import { getShopItem } from '../../shared/content/shop.js';
import { roomPlacementsSchema } from '../../shared/schemas/room.js';
import type { RoomPlacements } from '../../shared/schemas/room.js';
import { errors } from '../plugins/errors.js';
import { childService } from './ChildService.js';
import type { ChildService } from './ChildService.js';
import { nowIso } from '../lib/time.js';

interface PlacementRow {
  item_id: string;
  x: number;
  y: number;
  hidden: number;
}

export class RoomService {
  constructor(private readonly children: ChildService = childService) {}

  getPlacements(parentId: string, childId: string): RoomPlacements {
    this.requireChild(parentId, childId);
    const rows = getDb()
      .prepare(
        `SELECT p.item_id, p.x, p.y, p.hidden
           FROM room_decoration_placement p
           JOIN inventory i ON i.child_id = p.child_id AND i.item_id = p.item_id
          WHERE p.child_id = ? AND i.quantity > 0
          ORDER BY p.item_id ASC`,
      )
      .all(childId) as PlacementRow[];
    return rows.map((row) => ({
      itemId: row.item_id,
      x: row.x,
      y: row.y,
      hidden: row.hidden === 1,
    }));
  }

  savePlacements(parentId: string, childId: string, rawInput: unknown): RoomPlacements {
    const placements = roomPlacementsSchema.parse(rawInput);
    this.requireChild(parentId, childId);

    for (const placement of placements) {
      const item = getShopItem(placement.itemId);
      /*
        ⚠️ CHẤP NHẬN `decoration` **HOẶC** `accessory` — phụ kiện nay cũng là một vật thể bé KÉO THẢ
        TỰ DO trong phòng (chủ dự án chốt: tách phụ kiện khỏi "mặc lên người"). Vẫn PHẢI chặn
        `food`: đồ ăn bị TIÊU khi cho ăn, nên một quả chuối "nằm trong phòng" sẽ sớm là một vật thể
        không còn tồn tại. Danh sách trắng (chứ không phải `!== 'food'`) để nhóm vật phẩm thứ tư
        trong tương lai mặc định KHÔNG đặt được — đó là một hệ quả có ý thức, không tình cờ.
      */
      if (!item || (item.category !== 'decoration' && item.category !== 'accessory')) {
        throw errors.validation('Chỉ có thể sắp xếp đồ trang trí và phụ kiện', {
          itemId: 'Vật phẩm này không phải đồ trang trí hoặc phụ kiện',
        });
      }
    }

    transaction((db) => {
      const ownedItem = db.prepare(
        'SELECT quantity FROM inventory WHERE child_id = ? AND item_id = ?',
      );
      for (const placement of placements) {
        const owned = ownedItem.get(childId, placement.itemId) as { quantity: number } | undefined;
        if (!owned || owned.quantity <= 0) throw errors.itemNotFound();
      }

      db.prepare('DELETE FROM room_decoration_placement WHERE child_id = ?').run(childId);
      const insert = db.prepare(
        `INSERT INTO room_decoration_placement (child_id, item_id, x, y, hidden, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      const at = nowIso();
      for (const placement of placements) {
        insert.run(childId, placement.itemId, placement.x, placement.y, placement.hidden ? 1 : 0, at);
      }
    });

    return this.getPlacements(parentId, childId);
  }

  private requireChild(parentId: string, childId: string): void {
    if (!this.children.getChild(parentId, childId)) throw errors.childNotFound();
  }
}

export const roomService = new RoomService();
