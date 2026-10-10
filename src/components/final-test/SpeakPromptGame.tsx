/**
 * RubyLingo — câu dạng `speak_prompt` (phần Nói): nghe mẫu tiếng Anh → bé TỰ NÓI → bấm "Nói rồi!".
 *
 * ⚠️⚠️ KHÔNG GHI ÂM. KHÔNG CHẤM ĐIỂM. KHÔNG DÙNG MICRO.
 *   Nhận dạng giọng trẻ em rất kém chính xác; chấm bằng máy sẽ CHẤM SAI (nói đúng mà bị đánh trượt)
 *   và làm bé thất vọng. Ngoài ra ghi âm trẻ em là vấn đề quyền riêng tư (COPPA/GDPR-K). Nên phần
 *   này chỉ ghi nhận ĐỘ THAM GIA: bé bấm "Nói rồi!" ⇒ câu này đã xong.
 *
 * ⚠️ CÂU MIỄN TRỪ BẮT BUỘC HIỂN THỊ: RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có
 *    giá trị chứng nhận. Ẩn câu này là nói dối phụ huynh — không được bỏ.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BigButton } from '../common/BigButton.js';
import { ItemAudioButton, ItemPrompt } from './parts.js';
import type { FinalTestItemProps } from './types.js';

export function SpeakPromptGame({ item, onAnswered }: FinalTestItemProps) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  if (item.interaction !== 'speak_prompt') return null;

  return (
    <div className="flex flex-col gap-4">
      <ItemPrompt text={item.promptEn} />
      <ItemAudioButton text={item.audioTextEn} />

      <BigButton
        size="lg"
        icon="🎤"
        aria-label={t('finalTest.speakDoneLabel')}
        disabled={done}
        onClick={() => {
          if (done) return;
          setDone(true);
          // KHÔNG có đáp án đúng/sai — "hoàn thành" ở đây là ĐỘ THAM GIA.
          onAnswered({ itemId: item.id, firstTry: true, wrongAttempts: 0 });
        }}
      >
        {t('finalTest.speakDone')}
      </BigButton>

      <p className="text-center text-kid-xs text-ink-soft">{t('finalTest.speakDisclaimer')}</p>
    </div>
  );
}
