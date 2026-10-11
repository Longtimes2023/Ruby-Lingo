/**
 * RubyLingo — câu dạng `story_answer` (Reading P5): tranh truyện + câu hỏi → viết 1 từ.
 *
 * Tối giản: tranh truyện (nếu có) + câu hỏi tiếng Anh + Ô NHẬP + nút "Kiểm tra".
 *
 * ⚠️⚠️ KHÔNG HIỆN HÌNH CỦA ĐÁP ÁN (`item.wordId`) — CỐ Ý. Đây là câu "viết 1 từ": câu hỏi
 *    "Who is in the park?" mà vẽ sẵn hình cậu bé thì bé chỉ việc CHÉP LẠI hình, mất hẳn giá trị
 *    kiểm tra đọc hiểu. (Giai đoạn 10 từng thử hiện hình từ mục tiêu rồi GỠ — xem lịch sử commit.)
 *
 * ⭐ TRANH GỢI Ý DÙNG `imageKey` (`"story-park"`), KHÔNG dùng hình từ vựng: đây là TRANH TRUYỆN —
 *    khung cảnh chung (công viên: cây, ghế đá, bãi cỏ, bầu trời) để bé nắm bối cảnh, KHÔNG lộ đáp án.
 *    `sceneAssetUrlIfExistsOrNull` chỉ trả URL khi TỆP CÓ THẬT (quét đĩa lúc build) ⇒ thiếu tranh thì
 *    lùi về KHÔNG ảnh, không bao giờ để bé thấy ô ảnh vỡ.
 *
 * ⚠️ KHÔNG ĐỔI LUẬT TRẢ LỜI: vẫn ô nhập 1 từ + `submit` so khớp như cũ.
 */

import {
  AnswerTextField,
  ContinueButton,
  ItemPrompt,
  RevealNote,
  SceneHint,
  TryAgainNote,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function StoryAnswerGame({ item, onAnswered }: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'story_answer') return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Tranh truyện theo `imageKey` — thiếu tệp ⇒ `SceneHint` không vẽ gì (không bao giờ ảnh vỡ). */}
      <SceneHint sceneKey={item.imageKey} />

      <ItemPrompt text={item.promptEn} />

      <AnswerTextField disabled={done || revealed} onSubmit={submit} />

      {!revealed && wrongAttempts > 0 && !done && <TryAgainNote />}
      {revealed && (
        <>
          <RevealNote answer={item.answer} />
          <ContinueButton onClick={finish} />
        </>
      )}
    </div>
  );
}
