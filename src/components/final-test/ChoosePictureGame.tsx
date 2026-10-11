/**
 * RubyLingo — câu dạng `choose_picture` (Listening P3/P4): nghe → chọn 1 trong 3 tranh A/B/C.
 *
 * ⭐ GIAI ĐOẠN 10 — ĐÃ HIỆN HÌNH THẬT (trước chỉ hiện nhãn chữ):
 *   Mỗi lựa chọn nay là HÌNH của chính từ đó + nhãn chữ tiếng Anh ở dưới (xem `PictureChoice`).
 *   Hình tái dùng ảnh minh hoạ từ vựng đã có (`public/assets/words/<wordId>.webp`) qua `WordIcon`.
 *
 * ⚠️ VÌ SAO PHẢI TRA TỪ THEO CHỮ, KHÔNG GHÉP `starters.<chữ>`: `options` của đề là CHUỖI tiếng Anh,
 *    không phải `wordId` (xem `optionWords.ts` — `orange-n` vs `orange-adj`).
 *
 * ⚠️ ĐƯỜNG LÙI (bắt buộc): từ chưa có asset ⇒ `WordIcon` trả EMOJI; chuỗi lựa chọn không tra được
 *    từ ⇒ chỉ hiện chữ, KHÔNG vẽ `<img>`. Không bao giờ để bé thấy ô ảnh vỡ.
 *
 * ⚠️ KHÔNG ĐỔI LUẬT TRẢ LỜI: vẫn `submit(option)` với ĐÚNG chuỗi của đề, `answer`/khiên không đụng.
 *
 * ⭐ TRANH CẢNH CẤP PART (P4): part có thể khai `sceneImageKey` (tranh có đủ 5 đồ vật rải rác).
 *   Trang cha truyền xuống qua prop `sceneImageKey`; thiếu/không khai ⇒ KHÔNG vẽ ảnh.
 */

import { choiceStateFor } from './choice.js';
import { findWordForOption } from './optionWords.js';
import {
  ContinueButton,
  ItemAudioButton,
  ItemPrompt,
  PictureChoice,
  RevealNote,
  SceneHint,
  TryAgainNote,
} from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useFinalTestItem } from './useFinalTestItem.js';

export function ChoosePictureGame({
  item,
  wordsByEn,
  sceneImageKey,
  onAnswered,
}: FinalTestItemProps) {
  const answer = 'answer' in item ? item.answer : '';
  const { submit, revealed, done, wrongPicks, wrongAttempts, finish } = useFinalTestItem(
    item.id,
    answer,
    onAnswered,
  );

  if (item.interaction !== 'choose_picture') return null;

  const options = item.options ?? [];
  const finished = done || revealed;

  return (
    <div className="flex flex-col gap-4">
      {/*
        Tranh cảnh CẤP PART (P4: thuyền/mũ/bóng bay/hoa/ghế rải rác). Chỉ P4 khai `sceneImageKey`;
        P3 không khai ⇒ `SceneHint` không vẽ gì. Thiếu tệp ⇒ cũng không vẽ (không bao giờ ảnh vỡ).
        ⚠️ KHÔNG dùng `item.imageKey` ở đây: với `choose_picture` nó là tên ĐỒ VẬT, không phải khoá
        tranh cảnh — xem `sceneImageKey` trong `shared/schemas/final-test.ts`.
      */}
      <SceneHint sceneKey={sceneImageKey} />

      <ItemPrompt text={item.promptEn} />
      <ItemAudioButton text={item.audioTextEn} />

      <ul className="flex flex-col gap-3">
        {options.map((option) => (
          <li key={option}>
            <PictureChoice
              option={option}
              word={findWordForOption(wordsByEn, option)}
              state={choiceStateFor(option, item.answer, wrongPicks, finished)}
              onClick={() => {
                submit(option);
              }}
            />
          </li>
        ))}
      </ul>

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
