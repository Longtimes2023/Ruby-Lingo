/**
 * RubyLingo — Routes THƯỞNG: `/api/children/:id/rewards`, `…/shop/buy`, `…/pet/feed`,
 *            `…/inventory/:itemId/equip` (T052 · T062).
 *
 * ⭐ BỐN ENDPOINT, BỐN VIỆC KHÁC NHAU:
 *   `GET  /api/children/:id/rewards`                    — ảnh chụp ví ⭐🌰, XP, thú cưng, túi đồ
 *   `POST /api/children/:id/shop/buy`                   — mua một vật phẩm (trừ tiền, vào túi)
 *   `POST /api/children/:id/pet/feed`                   — cho thú cưng ăn món đã sở hữu (+❤️)
 *   `POST /api/children/:id/inventory/:itemId/equip`    — mặc / bỏ ra một món đã sở hữu
 *
 * ⚠️ KHÔNG CÓ `routes/shop.ts` HAY `services/ShopService.ts`, DÙ KẾ HOẠCH GHI NHƯ VẬY (T062).
 *    Kế hoạch được viết trước khi T052 ra đời. T052 đã đặt phần "cửa hàng" vào chính file này
 *    (`/shop/buy` gọi thẳng `rewardService.buy`), và `Shared types`/`shared/content/shop.ts` đã
 *    là danh mục dùng chung. Tạo thêm một `ShopService` bây giờ nghĩa là có HAI chỗ biết cách
 *    trừ tiền và ghi vào `inventory` — đúng kiểu "hai chủ của một cột" mà quyết định 4 ở
 *    `RewardService` vừa loại bỏ. Việc đúng đắn là THÊM một route vào đây, không phải dựng một
 *    tầng song song.
 *
 *    Còn `listItems` (đọc JSON danh mục) trong kế hoạch thì KHÔNG cần một endpoint: client
 *    `import` thẳng `@shared/content/shop.js` (đã làm y vậy ở `LevelUpOverlay.tsx`), nên một
 *    route HTTP chỉ để trả lại dữ liệu đã nằm trong bundle là một vòng mạng thừa.
 *
 * ⚠️ MỌI ROUTE ĐỀU `preHandler: requireParent`, VÀ ĐĂNG NHẬP LÀ CHƯA ĐỦ.
 *    `:id` nằm trong URL nên phụ huynh A có thể gửi id của bé nhà phụ huynh B. `RewardService`
 *    kiểm `parent_id` trong MỌI phương thức (qua `requireChild`). Tầng route KHÔNG kiểm lại —
 *    nhưng cũng KHÔNG được gọi thẳng DB ở đây, vì như vậy là tạo con đường thứ hai bỏ qua phép
 *    kiểm ấy.
 *
 * ⚠️ VÌ SAO KHÔNG CÓ `PUT` NHẬN ẢNH CHỤP VÍ TỪ CLIENT:
 *    Cùng lý do như tầng tiến độ (xem ghi chú cuối `shared/schemas/progress.ts`): ví là CỘNG
 *    DỒN. Cho client đẩy số dư lên là cho nó tự tuyên bố "tôi có 9.999 ⭐", và vì không có
 *    cách nào phân biệt với số dư thật, con số đó ở lại vĩnh viễn. Tiền chỉ vào ví qua thưởng
 *    do server tính (`GameResultService`, `XpService`, `QuestService`) và chỉ ra qua `shop/buy`.
 *
 * ⚠️ VÌ SAO BODY CỦA `/shop/buy` KHÔNG CÓ GIÁ — xem ghi chú đầu `shared/schemas/reward.ts`.
 *    Server tra giá trong `shop-items.json`. Một trường `price` do client gửi sẽ bị bỏ qua
 *    hoàn toàn (schema không có nó, và Zod cắt khoá lạ), và test khoá đúng điều đó lại.
 *
 * ⚠️ VÌ SAO `:itemId` NẰM TRÊN ĐƯỜNG DẪN CỦA `/equip` MÀ KHÔNG NẰM TRONG BODY — cùng lý do,
 *    xem `shared/schemas/reward.ts`. Body chỉ còn `{equipped}`.
 */

import type { FastifyInstance } from 'fastify';

import type {
  ApiOk,
  BuyItemResponse,
  EquipItemResponse,
  FeedPetResponse,
  RewardsGetResponse,
} from '../../shared/types/api.js';
import {
  buyItemRequestSchema,
  equipItemRequestSchema,
  feedPetRequestSchema,
} from '../../shared/schemas/reward.js';
import { rewardService } from '../services/RewardService.js';
import { childIdFromParams, itemIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';

export async function rewardsRoutes(app: FastifyInstance): Promise<void> {
  // --- Đọc ảnh chụp thưởng ----------------------------------------------
  /**
   * ⚠️ ĐÂY LÀ MỘT `GET` THUẦN — NÓ KHÔNG ĐƯỢC GHI VÀO DB.
   *    Client gọi route này mỗi lần mở app. Nếu nó tự tạo hàng trong `wallet`/`pet_state` khi
   *    thấy thiếu, thì chỉ cần mở app lên là dữ liệu đã thay đổi: mọi lần đồng bộ sau đó đều
   *    thấy "có gì đó mới", và ta mất khả năng phân biệt "bé vừa làm gì" với "bé vừa mở app".
   */
  app.get('/api/children/:id/rewards', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<RewardsGetResponse> = {
      data: rewardService.getSnapshot(authed.parent.id, childIdFromParams(req)),
    };
    return reply.send(body);
  });

  // --- Mua vật phẩm -------------------------------------------------------
  app.post('/api/children/:id/shop/buy', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    // Parse ở tầng route để lỗi trả về có `fields` chỉ rõ trường sai; service parse lại lần
    // nữa để bảo vệ các đường gọi khác (test, script). Xem ghi chú ở `ChildService`.
    const input = buyItemRequestSchema.parse(req.body);

    const body: ApiOk<BuyItemResponse> = {
      data: rewardService.buy(authed.parent.id, childIdFromParams(req), input),
    };
    return reply.send(body);
  });

  // --- Cho thú cưng ăn ----------------------------------------------------
  app.post('/api/children/:id/pet/feed', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const input = feedPetRequestSchema.parse(req.body);

    const body: ApiOk<FeedPetResponse> = {
      data: rewardService.feed(authed.parent.id, childIdFromParams(req), input),
    };
    return reply.send(body);
  });

  // --- Mặc / bỏ ra vật phẩm -----------------------------------------------
  /**
   * ⚠️ `:itemId` LÀ NGUỒN DUY NHẤT NÓI ĐANG NÓI TỚI MÓN NÀO.
   *    Body chỉ có `{equipped}`. Một client gửi kèm `itemId` trong body sẽ bị Zod CẮT khoá đó
   *    (`z.object` mặc định bỏ khoá lạ) — nên đường dẫn luôn thắng, thay vì thắng/thua tuỳ theo
   *    thứ tự đọc. `reward-routes.test.ts` khoá đúng điều đó.
   *
   * ⚠️ `equipped` là TRẠNG THÁI ĐÍCH, không phải lệnh đảo — xem `RewardService.equip`.
   */
  app.post(
    '/api/children/:id/inventory/:itemId/equip',
    { preHandler: requireParent },
    async (req, reply) => {
      const authed = req as AuthedRequest;
      const input = equipItemRequestSchema.parse(req.body);

      const body: ApiOk<EquipItemResponse> = {
        data: rewardService.equip(
          authed.parent.id,
          childIdFromParams(req),
          itemIdFromParams(req),
          input,
        ),
      };
      return reply.send(body);
    },
  );
}
