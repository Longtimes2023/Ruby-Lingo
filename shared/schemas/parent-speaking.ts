/**
 * RubyLingo — Zod schema cho XÁC NHẬN PHẦN NÓI CỦA PHỤ HUYNH (TẦNG 4). Dùng CHUNG client + server.
 *
 * ⭐ ĐÂY LÀ GHI NHẬN QUAN SÁT CỦA NGƯỜI LỚN, KHÔNG PHẢI ĐIỂM SỐ.
 *   Máy không chấm phát âm (xem `docs/ke-hoach/phan-noi-bai-thi.md`). Bố/mẹ ngồi cạnh bé là
 *   người nghe đáng tin nhất, và họ chỉ trả lời được một câu NHỊ PHÂN cho mỗi mục: "con có làm
 *   được việc này không". Không có "đạt/trượt", không có thang điểm.
 *
 * ⚠️⚠️ `done: false` LÀ MỘT XÁC NHẬN, KHÔNG PHẢI "CHƯA LÀM GÌ".
 *   Giao diện có BA trạng thái cho mỗi mục:
 *     • mục VẮNG MẶT trong mảng   → "chưa xác nhận" (bố mẹ chưa bấm gì);
 *     • `{ done: true }`           → "bé đã làm được";
 *     • `{ done: false }`          → "mình ôn thêm nhé" (một LỜI MỜI ôn cùng con, KHÔNG phải
 *                                    lời chê — cùng luật ngôn ngữ của cả app).
 *   Không được "tối giản" `done: false` thành vắng mặt: hai điều đó là hai câu trả lời khác nhau.
 *
 * ⚠️ DANH MỤC MỤC NÓI Ở ĐÂY LÀ DANH MỤC **TĨNH** — CÓ CHỦ Ý.
 *   Id part thật (`starters.final-test.speaking.p1` …) nằm trong `src/data/…/speaking.json`, mà
 *   `shared/` KHÔNG đọc được file nội dung (xem ghi chú ở `content-index.ts`). Ta dùng id ổn định
 *   `p1`..`p4` (suy từ thứ tự part) và GIỮ CHÚNG KHỚP với đề bằng một TEST đối chiếu trực tiếp
 *   (`tests/unit/shared/parent-speaking-schema.test.ts` đọc `speaking.json`). Ai sửa số part trong
 *   đề mà quên mục Nói ở đây ⇒ test đỏ, không phải lệch im lặng.
 */

import { z } from 'zod';

/**
 * Id ổn định của bốn mục Nói, theo thứ tự part trong đề (`p1` = Phần 1 … `p4` = Phần 4).
 * Danh mục này là NGUỒN DUY NHẤT cho: schema hợp lệ, vòng lặp render, phép đếm "x/4 mục".
 */
export const PARENT_SPEAKING_ITEM_IDS = ['p1', 'p2', 'p3', 'p4'] as const;

export type ParentSpeakingItemId = (typeof PARENT_SPEAKING_ITEM_IDS)[number];

/** Số mục Nói — dẫn xuất từ danh mục để không bao giờ có hai con số cho một sự thật. */
export const PARENT_SPEAKING_ITEM_COUNT = PARENT_SPEAKING_ITEM_IDS.length;

export const parentSpeakingItemIdSchema = z.enum(PARENT_SPEAKING_ITEM_IDS);

/** Một mục Nói đã được bố/mẹ xác nhận. */
export const parentSpeakingItemSchema = z.object({
  id: parentSpeakingItemIdSchema,
  done: z.boolean(),
});

export type ParentSpeakingItem = z.infer<typeof parentSpeakingItemSchema>;

/** Chuỗi ISO-8601 UTC có `Z` ở cuối — mốc `updatedAt` (khớp lối `final-test-api.ts`). */
const isoUtcSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/,
    'Thời điểm phải ở định dạng ISO-8601 UTC (có Z ở cuối)',
  );

/**
 * Body của `PUT /api/children/:id/parent-speaking`.
 *
 * ⭐ KHÔNG có `childId` (nằm trên URL) và KHÔNG có `updatedAt` (server tự đóng dấu thời gian).
 *   Cùng luật "một sự thật chỉ có MỘT chỗ khai" như mọi hợp đồng khác của dự án.
 * ⚠️ Trần độ dài = số mục thật, và mỗi id chỉ được xuất hiện một lần: một mục hai lựa chọn là
 *    một câu trả lời tự mâu thuẫn, không có cách nào chọn đúng.
 */
export const parentSpeakingSaveSchema = z.object({
  items: z
    .array(parentSpeakingItemSchema)
    .max(PARENT_SPEAKING_ITEM_COUNT, 'Chỉ có bấy nhiêu mục Nói')
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
      message: 'Mỗi mục Nói chỉ được xuất hiện một lần',
    }),
});

export type ParentSpeakingSaveInput = z.infer<typeof parentSpeakingSaveSchema>;

/**
 * Trạng thái xác nhận phần Nói của một bé (phản hồi GET/PUT và trường trong `ReportResponse`).
 *
 * ⚠️ BÉ CHƯA ĐƯỢC XÁC NHẬN ⇒ `items = []` và `updatedAt = null` (KHÔNG bịa một mốc). Client tự
 *    hiện trạng thái trung tính "bố mẹ chưa xác nhận".
 */
export const parentSpeakingStateSchema = z.object({
  items: z.array(parentSpeakingItemSchema).max(PARENT_SPEAKING_ITEM_COUNT),
  updatedAt: isoUtcSchema.nullable(),
});

export type ParentSpeakingState = z.infer<typeof parentSpeakingStateSchema>;

/**
 * Đọc `marks_json` (cột TEXT của bảng `parent_speaking_confirm`) thành mảng item HỢP LỆ.
 *
 * ⚠️ CHỊU ĐƯỢC DỮ LIỆU HỎNG: JSON sai, mục lạ, hay phần tử méo mó đều bị BỎ QUA thay vì ném —
 *    một hàng rác không được làm sập báo cáo phụ huynh (cùng lối `parseProgressAnswers` ở
 *    `FinalTestService`). `parentSpeakingStateSchema` ở service vẫn là lưới an toàn cuối cùng.
 *
 * Hàm ở `shared/` (thuần, không DB) để CẢ route/service lẫn `ReportService` dùng chung một cách
 * parse — hai nơi tự đọc JSON là hai nơi có thể lệch nhau.
 */
export function parseParentSpeakingMarks(raw: string): ParentSpeakingItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<ParentSpeakingItemId>();
  const out: ParentSpeakingItem[] = [];
  for (const entry of parsed) {
    const item = parentSpeakingItemSchema.safeParse(entry);
    if (!item.success) continue; // mục lạ / méo mó ⇒ bỏ qua, không làm hỏng cả danh sách
    if (seen.has(item.data.id)) continue; // khử trùng: id đầu tiên thắng
    seen.add(item.data.id);
    out.push(item.data);
  }
  return out;
}
