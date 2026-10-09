/**
 * RubyLingo — Hằng số dùng CHUNG cho client và server.
 *
 * Vì sao để ở `shared/` chứ không để riêng mỗi bên: nếu client cho phép tuổi 5–12 mà
 * server (hoặc ràng buộc `CHECK` trong SQLite) lại chỉ cho 6–12, thì form sẽ cho bé 5 tuổi
 * bấm Lưu rồi nhận lỗi 500 khó hiểu. Một con số, một chỗ khai báo.
 */

/**
 * Phiên bản chính sách quyền riêng tư trẻ em mà phụ huynh đã đồng ý.
 *
 * Ghi vào `parent_account.consent_policy_version` — đây là BẰNG CHỨNG TUÂN THỦ COPPA/GDPR-K.
 * Khi nội dung chính sách thay đổi đáng kể, tăng giá trị này lên; nhờ vậy về sau trả lời
 * được câu "phụ huynh này đã đồng ý phiên bản nào?".
 */
export const PRIVACY_POLICY_VERSION = '2026-10-06';

/**
 * Khoảng tuổi hợp lệ của bé.
 *
 * ⚠️ PHẢI khớp `CHECK (age >= 5 AND age <= 12)` trong `migrations/002_child.sql`.
 * Migration là bất biến, nên nếu đổi khoảng tuổi thì phải viết migration mới — đừng chỉ
 * sửa hai con số ở đây.
 */
export const CHILD_AGE_MIN = 5;
export const CHILD_AGE_MAX = 12;

/**
 * Số hồ sơ bé tối đa cho một tài khoản phụ huynh.
 *
 * Không có ràng buộc nào ở tầng DB: đây là luật nghiệp vụ, không phải ràng buộc toàn vẹn
 * dữ liệu. Giới hạn để một tài khoản bị lạm dụng không tạo được hàng nghìn hồ sơ.
 */
export const MAX_CHILDREN_PER_ACCOUNT = 6;

/** Độ dài biệt danh của bé. Ngắn để vừa một dòng trên màn hình điện thoại. */
export const CHILD_NICKNAME_MIN = 1;
export const CHILD_NICKNAME_MAX = 20;

/** Độ dài tên hiển thị của phụ huynh. */
export const PARENT_DISPLAY_NAME_MAX = 60;

/**
 * Khoảng tốc độ đọc của Web Speech API (cài đặt của bé, T074).
 *
 * ⚠️ PHẢI khớp `CHECK (speech_rate >= 0.5 AND speech_rate <= 1.2)` trong
 *    `migrations/002_child.sql`. Migration là BẤT BIẾN ⇒ muốn đổi khoảng thì phải viết migration
 *    mới, đừng chỉ sửa hai con số ở đây. Lệch nhau thì schema sẽ cho qua một giá trị mà SQLite
 *    từ chối ⇒ phụ huynh nhận lỗi 500 cho một ô nhập trông hợp lệ.
 *
 * Trẻ nhỏ cần CHẬM hơn người lớn: 1.2 đã là nhanh nhất nên cho phép, 0.5 là chậm nhất.
 */
export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 1.2;

/** PIN phụ huynh: đúng 4 chữ số. Chỉ là rào UX, KHÔNG phải ranh giới bảo mật. */
export const PARENT_PIN_LENGTH = 4;

/**
 * Hiệu lực của "cổng PIN phụ huynh" sau khi nhập đúng PIN (T072): **10 phút**.
 *
 * ⚠️ VÌ SAO CÓ HẠN, CHỨ KHÔNG PHẢI MỞ MỘT LẦN RỒI MÃI:
 *   Kịch bản thật của app trong nhà: phụ huynh mở khu vực phụ huynh trên máy tính bảng, sau đó
 *   đưa máy cho bé cầm chơi. Nếu cổng mở VĨNH VIỄN trong phiên thì bé chỉ cần bấm vào mục "Phụ
 *   huynh" là vào được — đúng thứ cổng sinh ra để chặn. Có hạn khiến cổng tự đóng sau một lúc.
 *
 * ⭐ VÌ SAO CHỌN 10 PHÚT (và vì sao KHÔNG trượt theo thao tác):
 *   • Đủ dài cho một việc thật: đọc báo cáo tuần, chỉnh vài cài đặt âm thanh/tốc độ đọc. Ngắn
 *     hơn (1–2 phút) sẽ đá phụ huynh ra GIỮA lúc đang xem; dài hơn (1 giờ) thì gần như mở luôn.
 *   • Hạn TUYỆT ĐỐI tính từ lúc mở (không gia hạn theo mỗi request): gia hạn trượt thì chỉ cần
 *     một tab đang mở poll đều đặn là cổng sống mãi — quay lại đúng vấn đề "để máy cho bé".
 *     Hết hạn thì phụ huynh nhập lại PIN, việc đó mất vài giây.
 *
 * ⚠️ Hằng số này KHÔNG phải một ranh giới bảo mật (ranh giới thật là phiên đăng nhập) — nó chỉ
 *    giới hạn thời gian khu vực phụ huynh còn "mở". Xem `ParentService.describeGate`.
 */
export const PARENT_GATE_TTL_MS = 10 * 60 * 1000;

/**
 * Các mốc quà của chuỗi ngày học liên tiếp.
 *
 * ⭐ Vì sao để ở `shared/` chứ không để trong component hiển thị:
 *   Server phải trao quà khi bé đạt mốc (`GameResultService`, T049) và phải ghi lại vào
 *   `streak.milestones_claimed`. Client phải hiện "còn 2 ngày nữa tới mốc 7". Nếu mỗi bên có
 *   danh sách riêng, có ngày server trao quà ở mốc 5 còn client hiện "mốc 7" — bé thấy quà mà
 *   không hiểu vì sao, và mốc tiếp theo thì sai.
 *
 * Phải khớp với chú thích của `StreakState.milestonesClaimed` trong `shared/types/reward.ts`.
 */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30];

// =============================================================================
// Báo cáo phụ huynh (T073)
// =============================================================================

/**
 * Khoảng ngày MẶC ĐỊNH của báo cáo khi client không truyền `from`/`to`: **7 ngày** — một tuần.
 *
 * ⭐ Vì sao mặc định là một tuần: báo cáo này là "tuần này con học thế nào" (xem khoá i18n
 *   `parent.thisWeek`). Để client tự tính `from`/`to` nghĩa là mỗi màn hình tự chọn một khoảng
 *   khác nhau, và hai chỗ hiển thị "tuần này" sẽ lệch nhau ở đúng ranh giới tuần.
 */
export const REPORT_DEFAULT_RANGE_DAYS = 7;

/**
 * Trần độ dài khoảng ngày của báo cáo: **92 ngày** (một quý).
 *
 * ⚠️ VÌ SAO PHẢI CÓ TRẦN: không có trần thì `?from=1970-01-01` khiến server quét TOÀN BỘ
 *    `daily_stats`/`lesson_progress` của bé rồi gom vào một mảng khổng lồ — một request rẻ tiền
 *    làm nghẽn máy (SQLite chỉ cho MỘT writer, và bộ nhớ dựng mảng cũng tăng theo). 92 ngày là
 *    dư cho mọi nhu cầu xem báo cáo thật (tuần, tháng, quý); xa hơn thì nên là tính năng riêng
 *    có phân trang, không phải một tham số query.
 */
export const REPORT_MAX_RANGE_DAYS = 92;

/**
 * Số từ tối đa mỗi danh sách "từ hay nhầm" / "từ đã nhớ chắc" trong báo cáo.
 *
 * ⭐ Vì sao giới hạn: báo cáo để phụ huynh ĐỌC trên điện thoại và chọn vài từ ôn cùng con. Đổ
 *   hết vài trăm từ ra là biến một gợi ý thành một danh sách không ai đọc — và cũng che mất
 *   những từ đáng chú ý nhất.
 */
export const REPORT_WORD_LIST_LIMIT = 5;

/**
 * Ngưỡng "từ hay nhầm": cần ít nhất **2 lần trả lời sai**.
 *
 * ⭐ Vì sao 2 chứ không 1: một lần sai có thể chỉ là trượt tay (bé bấm nhầm ô). Hai lần trở lên
 *   mới là DẤU HIỆU (bé chưa phân biệt được từ này) — đúng thứ đáng gợi ý phụ huynh ôn cùng con.
 *
 * ⚠️ VÀ "hay nhầm" LUÔN LOẠI TRỪ "đã nhớ chắc": xem `ReportService` — một từ không thể vừa
 *    "còn hay nhầm" vừa "đã nhớ chắc". Điều kiện đó vừa đúng về nghĩa, vừa là thứ khiến hai danh
 *    sách trong báo cáo KHÔNG BAO GIỜ giao nhau.
 */
export const STRUGGLING_MIN_WRONG = 2;
