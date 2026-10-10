/**
 * RubyLingo — LUẬT NGHIỆP VỤ THUẦN cho nội dung bài thi cuối khoá (V23–V25, V27).
 *
 * ⭐ VÌ SAO TÁCH RA THÀNH MODULE THUẦN:
 *   Cổng build (`scripts/validate-content.ts`) áp luật này lên ĐỀ THẬT. Nhưng một cổng XANH có thể
 *   là cổng RỖNG (luật chưa bao giờ chạy đúng). `tests/unit/content/final-test-schema.test.ts` nạp
 *   CHÍNH các hàm này rồi tiêm item SAI và bắt buộc chúng phải kêu. Hai bên dùng CHUNG một mã ⇒ không
 *   thể lệch nhau (cùng mô hình với `tests/unit/content/helpers/reachability-rules.ts`).
 *
 * ⚠️ Chỉ nhận dữ liệu qua THAM SỐ, không đọc đĩa, không import danh mục JSON ⇒ chạy được ở cả
 *    `tsx` (script build) lẫn Vitest.
 */

import type { FinalTestItem } from './schemas/final-test.js';

export interface FinalTestViolation {
  /** Mã luật, khớp với `scripts/validate-content.ts` (V23/V24/V25/V27). */
  rule: string;
  message: string;
}

/** Đáp án "1 từ" hợp lệ: chỉ chữ thường tiếng Anh, không khoảng trắng, không dấu. */
const SINGLE_EN_WORD_RE = /^[a-z]+$/;

/** Văn bản CHỈ tiếng Anh: ký tự ASCII in được (0x20–0x7E). Dấu tiếng Việt nằm ngoài dải này. */
const ASCII_ONLY_RE = /^[\x20-\x7E]*$/;

/**
 * Chuỗi NHẬN DẠNG đề Cambridge — chặn ở tầng build để không lẫn nội dung có bản quyền vào repo.
 * (Cấu trúc DẠNG BÀI không thuộc bản quyền; chỉ nội dung/wordlist/đề mẫu mới có bản quyền.)
 */
const CAMBRIDGE_MARKERS: RegExp[] = [
  /cambridge/i,
  /\bpre[\s-]*a1\b/i,
  /\bucles\b/i,
  /\byoung learners english\b/i,
  /university of cambridge/i,
  /©/,
];

/**
 * Kiểm MỘT item theo V23/V24/V25. Trả về danh sách vi phạm (rỗng = hợp lệ).
 *
 * `wordIds` là tập id từ CÓ THẬT của level — truyền vào để kiểm `wordId` (V23).
 */
export function auditFinalTestItem(
  item: FinalTestItem,
  wordIds: ReadonlySet<string>,
): FinalTestViolation[] {
  const out: FinalTestViolation[] = [];
  const where = `item "${item.id}"`;

  // --- V23a: wordId phải trỏ tới một từ CÓ THẬT của level -------------------
  if ('wordId' in item && item.wordId !== undefined && !wordIds.has(item.wordId)) {
    out.push({
      rule: 'V23',
      message: `${where}: wordId "${item.wordId}" không tồn tại trong từ vựng của level`,
    });
  }

  // --- V25: tiếng Anh phải SẠCH dấu tiếng Việt (TTS chỉ đọc en-GB) ----------
  for (const field of ['audioTextEn', 'promptEn'] as const) {
    const value = item[field];
    if (typeof value === 'string' && !ASCII_ONLY_RE.test(value)) {
      out.push({
        rule: 'V25',
        message: `${where}: ${field} "${value}" chứa ký tự KHÔNG phải tiếng Anh (dấu tiếng Việt?) — máy chỉ đọc được en-GB`,
      });
    }
  }

  // --- V23/V24: kiểm theo từng dạng tương tác ------------------------------
  switch (item.interaction) {
    case 'arrange_letters': {
      // V24: gạch gợi ý + tập chữ cái xáo trộn phải khớp `answer`.
      const answer = item.answer;
      const mask = item.hintMask;
      if (mask === undefined) {
        out.push({ rule: 'V24', message: `${where}: thiếu "hintMask" (bé cần gạch gợi ý số chữ)` });
      } else {
        if (mask.length !== answer.length) {
          out.push({
            rule: 'V24',
            message: `${where}: hintMask "${mask}" dài ${mask.length} nhưng answer "${answer}" dài ${answer.length}`,
          });
        }
        if (mask[0] !== answer[0]) {
          out.push({
            rule: 'V24',
            message: `${where}: hintMask phải HIỆN chữ cái ĐẦU ("${answer[0]}") — bé cần một điểm tựa`,
          });
        }
        for (let i = 0; i < Math.min(mask.length, answer.length); i++) {
          const ch = mask[i];
          if (ch !== '_' && ch !== answer[i]) {
            out.push({
              rule: 'V24',
              message: `${where}: hintMask[${i}] = "${ch}" nhưng answer[${i}] = "${answer[i]}"`,
            });
          }
        }
      }
      const letters = item.options;
      if (letters === undefined) {
        out.push({ rule: 'V24', message: `${where}: thiếu "options" (các chữ cái xáo trộn)` });
      } else {
        const bad = letters.filter((l) => l.length !== 1);
        if (bad.length > 0) {
          out.push({
            rule: 'V24',
            message: `${where}: mỗi chữ cái xáo trộn phải là 1 ký tự, nhưng có [${bad.join(', ')}]`,
          });
        }
        const pool = letters.join('').split('').sort().join('');
        const want = answer.split('').sort().join('');
        if (pool !== want) {
          out.push({
            rule: 'V24',
            message: `${where}: tập chữ cái xáo trộn "${pool}" KHÔNG bằng tập chữ của answer "${want}" — bé xếp mãi không ra`,
          });
        }
      }
      break;
    }
    case 'gap_fill': {
      // V23: đáp án phải nằm trong khung từ.
      if (item.wordBox !== undefined && !item.wordBox.includes(item.answer)) {
        out.push({
          rule: 'V23',
          message: `${where}: answer "${item.answer}" không nằm trong wordBox [${item.wordBox.join(', ')}]`,
        });
      }
      if (!SINGLE_EN_WORD_RE.test(item.answer)) {
        out.push({
          rule: 'V23',
          message: `${where}: answer "${item.answer}" phải là MỘT từ chữ thường tiếng Anh`,
        });
      }
      break;
    }
    case 'story_answer':
    case 'write_word': {
      if (!SINGLE_EN_WORD_RE.test(item.answer)) {
        out.push({
          rule: 'V23',
          message: `${where}: answer "${item.answer}" phải là MỘT từ chữ thường tiếng Anh`,
        });
      }
      break;
    }
    case 'pick_name':
    case 'choose_picture':
    case 'tick_cross':
    case 'yes_no': {
      const options = item.options;
      if (options !== undefined && !options.includes(item.answer)) {
        out.push({
          rule: 'V23',
          message: `${where}: answer "${item.answer}" không nằm trong options [${options.join(', ')}] — bé không có cách nào chọn ra đáp án đúng`,
        });
      }
      // Với choose_picture: đúng 3 tranh (mô hình A/B/C).
      if (item.interaction === 'choose_picture' && options !== undefined && options.length !== 3) {
        out.push({
          rule: 'V23',
          message: `${where}: choose_picture phải có ĐÚNG 3 lựa chọn, đang có ${options.length}`,
        });
      }
      break;
    }
    case 'speak_prompt':
      // Không chấm tự động ⇒ không kiểm `answer`.
      break;
    default: {
      // Vét cạn: nếu thêm interaction mới mà quên nhánh, đây là chỗ lộ ra.
      const exhaustive: never = item;
      void exhaustive;
    }
  }

  return out;
}

/**
 * V27 — tuyệt đối không có chuỗi nhận dạng đề Cambridge trong các đoạn VĂN BẢN của đề.
 *
 * ⚠️ Trường `note` được MIỄN TRỪ: chính nó là câu cảnh báo bản quyền (có nhắc tới Cambridge),
 *    nên quét nó sẽ tự bắn vào chân. Chỉ quét nội dung THẬT SỰ hiển thị/đọc cho bé.
 */
export function auditFinalTestCambridge(texts: readonly string[]): FinalTestViolation[] {
  const out: FinalTestViolation[] = [];
  for (const text of texts) {
    for (const marker of CAMBRIDGE_MARKERS) {
      if (marker.test(text)) {
        out.push({
          rule: 'V27',
          message: `Có chuỗi nhận dạng Cambridge (${marker}) trong nội dung đề: "${text}" — đề phải TỰ SOẠN`,
        });
        break;
      }
    }
  }
  return out;
}
