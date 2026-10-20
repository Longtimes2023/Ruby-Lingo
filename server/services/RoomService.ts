import { getDb, transaction } from '../db/connection.js';
import { getShopItem } from '../../shared/content/shop.js';
import { ROOM_LAYOUT_VERSION, roomPlacementsSchema } from '../../shared/schemas/room.js';
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

  /**
   * Đọc vị trí bé đã kê, CHỈ những dòng thuộc bố cục mặc định hiện hành.
   *
   * ⚠️ VÌ SAO LỌC THEO `layout_version`: mỗi dòng là một cặp (x, y) theo phần trăm khung phòng, ghi
   *   lại theo bố cục mặc định của thời điểm bé kéo. Khi bố cục mặc định đổi chỗ/đổi cỡ (xem
   *   `ROOM_LAYOUT_VERSION` trong `shared/schemas/room.ts`), cặp (x, y) cũ vẫn là toạ độ hợp lệ
   *   nhưng đặt trong ngữ cảnh mới thì đồ chồng chéo lên nhau. Bỏ qua dòng cũ ⇒ bé thấy bố cục
   *   mặc định MỚI, đúng như mong đợi; dòng cũ KHÔNG bị xoá (xem ghi chú ở `savePlacements`) nên
   *   đây là một phép đọc thuần tuý, không phá dữ liệu.
   */
  getPlacements(parentId: string, childId: string): RoomPlacements {
    this.requireChild(parentId, childId);
    const rows = getDb()
      .prepare(
        `SELECT p.item_id, p.x, p.y, p.hidden
           FROM room_decoration_placement p
           JOIN inventory i ON i.child_id = p.child_id AND i.item_id = p.item_id
          WHERE p.child_id = ? AND i.quantity > 0 AND p.layout_version = ?
          ORDER BY p.item_id ASC`,
      )
      .all(childId, ROOM_LAYOUT_VERSION) as PlacementRow[];
    return rows.map((row) => ({
      itemId: row.item_id,
      x: row.x,
      y: row.y,
      hidden: row.hidden === 1,
    }));
  }

  /**
   * Ghi lại TOÀN BỘ danh sách vị trí bé vừa sắp, gắn `layout_version` hiện hành cho từng dòng.
   *
   * ⚠️ GHI VERSION Ở ĐÂY LÀ BẮT BUỘC, không phải trang trí: `getPlacements` chỉ đọc dòng có
   *   `layout_version = ROOM_LAYOUT_VERSION`. Quên ghi ⇒ dòng bé vừa kéo mang version 0 (DEFAULT của
   *   migration `015`) ⇒ lần mở phòng sau bị coi là "bố cục cũ" và biến mất. Đó đúng là kiểu lỗi
   *   "kéo đồ xong, thoát ra vào lại thì đồ về chỗ cũ" mà không ai đoán ra nguyên nhân.
   */
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

      /*
        ⚠️ XOÁ **TẤT CẢ** DÒNG CỦA BÉ RỒI GHI LẠI — KỂ CẢ DÒNG CỦA BỐ CỤC CŨ. ĐÂY LÀ CHỦ Ý.

        Hai điều buộc phải như vậy:
        1. "Lưu cả bộ": API nhận TOÀN BỘ danh sách bé đang thấy, nên một dòng không được gửi lên
           nghĩa là "bé đã bỏ món đó ra khỏi phòng" — không có cách nào phân biệt với "bé không kéo
           món đó nên client không gửi". Vì thế phải xoá sạch rồi ghi lại, không thể chỉ upsert.
        2. Khoá chính là `(child_id, item_id)` (migration `012_room_placement.sql`). Dòng của bố cục
           CŨ mang đúng `item_id` đó ⇒ nếu chỉ xoá dòng version hiện tại thì `INSERT` sẽ vi phạm khoá
           chính. Muốn giữ dòng cũ thì phải đổi sang upsert + xoá phần thừa, phức tạp hơn hẳn mà
           giá trị bằng 0.
        Dòng bố cục cũ vốn đã VÔ NGHĨA với bố cục mới (xem ghi chú ở `getPlacements`), nên mất
        chúng không làm bé mất gì: lần kéo này chính là lần ghi lại toàn bộ theo bố cục mới.
        Xoá ở đây nằm TRONG `transaction` cùng các `INSERT`, nên nếu ghi lỗi thì dòng cũ được khôi
        phục nguyên vẹn (test "数据库插入失败时回滚删除" khoá đúng hành vi này).
      */
      db.prepare('DELETE FROM room_decoration_placement WHERE child_id = ?').run(childId);
      const insert = db.prepare(
        `INSERT INTO room_decoration_placement (child_id, item_id, x, y, hidden, updated_at, layout_version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const at = nowIso();
      for (const placement of placements) {
        insert.run(
          childId,
          placement.itemId,
          placement.x,
          placement.y,
          placement.hidden ? 1 : 0,
          at,
          ROOM_LAYOUT_VERSION,
        );
      }
    });

    return this.getPlacements(parentId, childId);
  }

  private requireChild(parentId: string, childId: string): void {
    if (!this.children.getChild(parentId, childId)) throw errors.childNotFound();
  }
}

export const roomService = new RoomService();
