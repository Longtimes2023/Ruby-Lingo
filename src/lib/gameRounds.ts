/**
 * RubyLingo — Số câu của một lượt chơi, suy từ `config` của bài tập.
 *
 * ⭐ VÌ SAO Ở RIÊNG MỘT FILE:
 *   Cùng một con số này được dùng ở hai nơi rất khác nhau — `GamePage` (để khởi tạo engine và vẽ
 *   "Câu 3 / 10") và test (để biết ván chơi dài bao nhiêu câu). Nếu test tự viết lại phép suy diễn
 *   này thì test và app có thể lệch nhau, và khi đó test vẫn xanh trong khi app đếm sai số câu.
 *
 * ⚠️ HAI TÊN TRƯỜNG, MỘT Ý NGHĨA: game "đi từng câu" (`listen_tap`, `missing_letter`,
 *   `prepositions`) khai `rounds`; game "ghép cặp" (`memory_match`, `word_picture`) khai `pairs`.
 *   Một cặp ghép xong cũng là một "câu" của lượt chơi — nên cả hai đều quy về cùng một con số.
 *
 * Trả `0` khi không suy được — bên gọi PHẢI coi `0` là "không chơi được", không phải "ván rỗng".
 */

export function roundsOf(config: unknown): number {
  if (typeof config !== 'object' || config === null) return 0;
  const record = config as Record<string, unknown>;

  if (typeof record['rounds'] === 'number') return record['rounds'];
  if (typeof record['pairs'] === 'number') return record['pairs'];
  return 0;
}
