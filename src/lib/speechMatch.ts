/**
 * RubyLingo — So khớp lời bé nói (máy nghe) với MỤC TIÊU tiếng Anh của câu.
 *
 * ⭐ HÀM THUẦN, KHÔNG PHỤ THUỘC TRÌNH DUYỆT: đây là thứ quyết định "Máy nghe thấy rồi" hay
 *   "Máy chưa nghe rõ". Tách ra khỏi hook `useSpeechCheck` để kiểm được bằng test mà không cần
 *   micro, không cần mạng — vì lỗi ở đây rất khó thấy khi chạy tay (máy nghe sai một câu, bé chỉ
 *   thấy câu động viên khác đi, không ai báo lỗi).
 *
 * ⚠️⚠️ NGƯỠNG RẤT DỄ — ĐÂY LÀ YÊU CẦU SƯ PHẠM, KHÔNG PHẢI SỰ CẨU THẢ.
 *   Người nói là bé 7 tuổi nói tiếng Anh (không phải tiếng mẹ đẻ), và máy nghe của trình duyệt
 *   được huấn luyện cho người lớn. Nói ĐÚNG mà máy nghe ra một từ gần giống là chuyện thường.
 *   Nếu ta khắt khe, câu phản hồi sẽ oan uổng — mà đây lại KHÔNG phải điểm, chỉ là "máy nghe giúp
 *   vui". Thà dễ quá còn hơn làm bé cụt hứng. Xem thêm quyết định ở `SpeakPromptGame`.
 *
 * ⚠️ HÀM NÀY KHÔNG BAO GIỜ KẾT LUẬN "SAI". Nó chỉ trả `true`/`false` cho câu hỏi trung tính
 *   "máy có nghe ra hay không". Mọi câu chữ hướng tới bé đều KHÔNG MẮNG (xem i18n `finalTest`).
 */

/**
 * Chuẩn hoá một chuỗi để so khớp:
 *   • chữ thường;
 *   • bỏ dấu nháy (it's → its) — trẻ hay đọc dính, Web Speech hay chèn/bỏ dấu nháy;
 *   • mọi ký tự không phải chữ/số thành khoảng trắng (bỏ dấu câu);
 *   • gộp nhiều khoảng trắng và cắt hai đầu.
 */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Khoảng cách sửa (Levenshtein) giữa hai chuỗi, DỪNG SỚM khi vượt `max`.
 *
 * `max` nhỏ (1–2) nên dừng sớm giúp hàm gần như tuyến tính với độ dài từ thực tế (từ vựng
 * Starters rất ngắn). Trả về một số > `max` nghĩa là "xa hơn ngưỡng" — giá trị chính xác
 * không quan trọng với người gọi.
 */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0] as number;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return false;
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j] as number;
  }

  return (prev[b.length] as number) <= max;
}

/** Số lỗi cho phép khi so MỘT TỪ — càng dài thì càng tha. */
function allowedEditsForWord(length: number): number {
  if (length >= 7) return 2;
  if (length >= 3) return 1;
  return 0;
}

/** Hai TỪ có được coi là "gần giống" không (bỏ qua hoa/thường, cho phép vài lỗi chính tả). */
function isWordMatch(heard: string, target: string): boolean {
  if (heard === target) return true;
  if (heard.length === 0 || target.length === 0) return false;
  return withinEditDistance(heard, target, allowedEditsForWord(Math.max(heard.length, target.length)));
}

export interface SpeechMatchOptions {
  /**
   * Tỉ lệ TỪ của mục tiêu phải được máy nghe ra để coi là khớp (mặc định 0.6).
   *
   * Vì sao 0.6 chứ không 1.0: câu mục tiêu là câu đầy đủ ("Point to the door."), còn bé có thể
   * nói thiếu mạo từ/giới từ. 0.6 cho phép thiếu khoảng một nửa số từ mà vẫn tính là nghe ra,
   * nhưng vẫn loại được câu trả lời lạc đề (khớp 0 từ).
   */
  minTokenRatio?: number;
}

/**
 * Máy có "nghe ra" lời bé nói so với mục tiêu không.
 *
 * Thứ tự kiểm (dễ → khắt khe dần):
 *   1. Rỗng một trong hai ⇒ `false` (không có gì để so).
 *   2. Khớp CHÍNH XÁC sau chuẩn hoá ("Cat" ≈ "cat", thừa khoảng trắng ≈ bằng nhau).
 *   3. MỘT BÊN NẰM TRONG BÊN KIA (đủ dài): bé chỉ nói từ khoá ("door") trong câu dài
 *      ("point to the door"), hoặc máy nghe dư vài từ.
 *   4. TỈ LỆ TỪ trùng/gần giống đạt `minTokenRatio`.
 *
 * ⚠️ Ngưỡng (3) yêu cầu bên ngắn dài ≥ 4 ký tự: nếu không, mạo từ "the"/"a" lọt vào giữa câu
 *    cũng thành "nghe ra", và máy sẽ khen bé cả khi bé mới ậm ừ một từ vô nghĩa.
 */
export function isSpeechMatch(
  heard: string,
  target: string,
  options: SpeechMatchOptions = {},
): boolean {
  const minTokenRatio = options.minTokenRatio ?? 0.6;

  const h = normalizeSpeech(heard);
  const t = normalizeSpeech(target);
  if (h.length === 0 || t.length === 0) return false;

  if (h === t) return true;

  const shorter = h.length <= t.length ? h : t;
  const longer = h.length <= t.length ? t : h;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;

  const heardTokens = h.split(' ');
  const targetTokens = t.split(' ');
  let matched = 0;
  for (const token of targetTokens) {
    if (heardTokens.some((candidate) => isWordMatch(candidate, token))) matched += 1;
  }

  return matched / targetTokens.length >= minTokenRatio;
}
