/**
 * RubyLingo — Tiện ích đọc tham số đường dẫn.
 *
 * ⚠️ VÌ SAO CẦN MỘT HÀM CHO VIỆC NHỎ NHƯ VẬY:
 *   `req.params` là `unknown` với Fastify khi route không khai `schema.params`. Mỗi route cần
 *   `:id` đều phải tự thu hẹp kiểu, và bản viết nhanh nhất — `req.params.id as string` — là một
 *   LỜI HỨA SAI: nếu route được đăng ký với một đường dẫn không có `:id`, giá trị thật là
 *   `undefined` và nó sẽ chảy thẳng vào một câu SQL dưới dạng `undefined`, rồi tới
 *   `requireChild` và biến thành một `CHILD_NOT_FOUND` khó hiểu.
 *
 *   Hàm này trả về `''` trong trường hợp đó. Chuỗi rỗng không khớp `id` nào trong DB, nên kết
 *   quả vẫn là `CHILD_NOT_FOUND` — nhưng đường đi thì rõ ràng và không có chỗ nào phải tin vào
 *   một phép ép kiểu.
 *
 * ⚠️ `childId` lấy từ ĐÂY, không bao giờ từ body. Xem ghi chú đầu `routes/progress.ts`.
 *
 * ⚠️ Cùng luật ấy áp cho MỌI tham số định danh khác trên đường dẫn (`questId`, `itemId`…):
 *    chúng đi qua `pathParam()` chứ không qua một phép ép kiểu tại chỗ. Một route khai thiếu
 *    tham số sẽ trả về `''`, và `''` không khớp hàng nào trong DB ⇒ lỗi cuối cùng vẫn là
 *    `NOT_FOUND` — nhưng đường đi thì tường minh, và không có chỗ nào phải tin vào lời hứa suông.
 */

/**
 * Lấy một tham số đường dẫn theo tên. Trả `''` nếu route không khai tham số đó.
 *
 * Không export: người gọi dùng các hàm có tên bên dưới, nhờ vậy mỗi tham số chỉ có MỘT cách
 * đọc và không ai gõ sai tên tham số ở giữa đường.
 */
function pathParam(req: { params: unknown }, name: string): string {
  const params = req.params as Record<string, unknown> | null | undefined;
  const value = params?.[name];
  return typeof value === 'string' ? value : '';
}

/** Lấy `:id` (id của bé) từ tham số đường dẫn. Trả `''` nếu route không có tham số này. */
export function childIdFromParams(req: { params: unknown }): string {
  return pathParam(req, 'id');
}

/**
 * Lấy `:questId` từ tham số đường dẫn (`POST …/quests/:questId/claim`).
 *
 * ⚠️ Vì sao id nhiệm vụ nằm trên ĐƯỜNG DẪN chứ không trong body: cùng lý do như `childId`.
 *    Nó là một phần của địa chỉ tài nguyên đang bị tác động, nên nó phải đi cùng `childId`
 *    trong một URL duy nhất — không có cách nào gửi id bé của nhà mình kèm id nhiệm vụ để
 *    "trộn" hai nguồn. Ngoài ra nhiệm vụ không có body nào cả (xem đầu `routes/quests.ts`).
 */
export function questIdFromParams(req: { params: unknown }): string {
  return pathParam(req, 'questId');
}

/**
 * Lấy `:itemId` từ tham số đường dẫn (`POST …/inventory/:itemId/equip`).
 *
 * ⚠️ Cùng luật như `questIdFromParams`, và ở đây luật đó vừa BÁC BỎ một thiết kế cũ: bản đầu
 *    tiên của hợp đồng equip (T008) để `itemId` trong BODY, trong khi đường dẫn cũng đã có
 *    `:itemId`. Hai nguồn cho cùng một câu trả lời là một cuộc tranh chấp đang chờ người phân
 *    xử — nên `itemId` nay chỉ nằm trên đường dẫn, và body chỉ còn `{equipped}`.
 *    Xem ghi chú đầu `shared/schemas/reward.ts` và `reward-routes.test.ts`.
 */
export function itemIdFromParams(req: { params: unknown }): string {
  return pathParam(req, 'itemId');
}

/**
 * Lấy `:section` từ tham số đường dẫn
 * (`POST …/final-test/:section/submit`).
 *
 * ⚠️ `section` NẰM TRÊN ĐƯỜNG DẪN, KHÔNG Ở TRONG BODY — cùng luật như `itemId` ngay trên.
 *    Hai nguồn cho cùng một sự thật chỉ cần lệch nhau một lần là nộp nhầm phần thi. Xem ghi chú
 *    đầu `shared/schemas/final-test-api.ts`.
 */
export function finalTestSectionFromParams(req: { params: unknown }): string {
  return pathParam(req, 'section');
}
