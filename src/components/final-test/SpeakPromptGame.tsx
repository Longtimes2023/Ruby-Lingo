/**
 * RubyLingo — câu dạng `speak_prompt` (phần Nói). BỐN TẦNG, ba tầng đầu nằm ngay trong câu này:
 *
 *   TẦNG 1 (mặc định, KHÔNG ĐỔI): nghe mẫu tiếng Anh → bé TỰ NÓI → bấm "🎤 Nói rồi!".
 *     Bé không bấm gì thì câu vẫn chỉ kết thúc khi bé bấm "Nói rồi!" — mọi thứ khác là TUỲ CHỌN.
 *
 *   TẦNG 2 (tuỳ chọn, CHỈ khi trình duyệt hỗ trợ): "🎧 Máy nghe thử" — Web Speech API nghe bé nói
 *     MỤC TIÊU của câu rồi báo hai trạng thái hướng trẻ ("Máy nghe thấy rồi!" / "Máy chưa nghe
 *     rõ…"). KHÔNG lưu, KHÔNG gửi, KHÔNG đụng khiên. Xem `useSpeechCheck`.
 *
 *   TẦNG 3 (tuỳ chọn, MẶC ĐỊNH TẮT): "Nghe lại giọng con" — ghi NGẮN bằng `MediaRecorder`, phát
 *     lại ngay trên máy, rồi HUỶ. Hoàn toàn cục bộ. Xem `useVoicePlayback`.
 *
 *   TẦNG 4 (khu vực phụ huynh): rubric 4 phần Nói để phụ huynh TỰ XÁC NHẬN — cách ĐÁNG TIN NHẤT.
 *     Xem `ParentSpeakingChecklist`.
 *
 * ⚠️⚠️ VÌ SAO **KHÔNG CHẤM PHÁT ÂM BẰNG MÁY** Ở GIAI ĐOẠN NÀY:
 *   Nhận dạng giọng trẻ em rất kém chính xác; chấm bằng máy sẽ CHẤM SAI (nói đúng mà bị đánh
 *   trượt) và làm bé thất vọng. Ngoài ra ghi âm trẻ em là vấn đề quyền riêng tư (COPPA/GDPR-K).
 *   Điều kiện để chấm thật (API trả phí + backend nhận audio + ngân sách mỗi lượt) ghi ở
 *   `docs/ke-hoach/phan-noi-bai-thi.md` — xếp P2, cần chủ dự án duyệt ngân sách.
 *   Vì vậy phần này chỉ ghi nhận ĐỘ THAM GIA: bé bấm "Nói rồi!" ⇒ câu này đã xong.
 *
 * ⚠️ CÂU MIỄN TRỪ BẮT BUỘC HIỂN THỊ: RubyLingo không phải kỳ thi Cambridge; kết quả ở đây không có
 *    giá trị chứng nhận. Ẩn câu này là nói dối phụ huynh — không được bỏ.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../store/settingsStore.js';
import { BigButton } from '../common/BigButton.js';
import { ItemAudioButton, ItemPrompt } from './parts.js';
import type { FinalTestItemProps } from './types.js';
import { useSpeechCheck } from './useSpeechCheck.js';
import { useVoicePlayback } from './useVoicePlayback.js';

export function SpeakPromptGame({ item, onAnswered }: FinalTestItemProps) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  const speechCheck = useSpeechCheck();
  const voicePlayback = useVoicePlayback();
  // ⚠️ MẶC ĐỊNH TẮT: chỉ hiện tầng 3 khi phụ huynh đã chủ động bật ở khu vực phụ huynh.
  const voicePlaybackEnabled = useSettingsStore((s) => s.voicePlaybackEnabled);

  if (item.interaction !== 'speak_prompt') return null;

  // Mục tiêu để máy nghe: câu tiếng Anh của đề (ưu tiên bản audio, vì đó là câu bé nghe).
  const target = item.audioTextEn ?? item.promptEn;
  const showVoicePlayback = voicePlayback.supported && voicePlaybackEnabled;

  return (
    <div className="flex flex-col gap-4">
      <ItemPrompt text={item.promptEn} />
      <ItemAudioButton text={item.audioTextEn} />

      {/* --- TẦNG 2: máy nghe thử (chỉ hiện khi trình duyệt hỗ trợ) --------- */}
      {speechCheck.supported && (
        <div className="flex flex-col gap-2">
          <BigButton
            variant="secondary"
            icon="🎧"
            aria-label={t('finalTest.speakCheckLabel')}
            disabled={done}
            onClick={() => speechCheck.start(target)}
          >
            {t('finalTest.speakCheck')}
          </BigButton>

          {/*
            Hiển thị theo THỨ TỰ ƯU TIÊN: kết quả (nếu có) trước, rồi mới tới "đang nghe".
            ⚠️ KHÔNG gate kết quả bằng `!listening`: `onend` của trình duyệt có thể tới sau
            `onresult`, và nếu chờ nó thì bé sẽ thấy "đang nghe" treo trong khi máy đã có kết quả.
            ⚠️ KHÔNG có câu nào mang nghĩa "sai" — xem luật ngôn ngữ của dự án.
          */}
          {speechCheck.outcome === 'heard' && (
            <p role="status" className="text-center text-kid-sm font-bold text-success">
              {t('finalTest.speakCheckHeard')}
            </p>
          )}
          {speechCheck.outcome === 'unclear' && (
            <p role="status" className="text-center text-kid-sm font-bold text-ink-soft">
              {t('finalTest.speakCheckUnclear')}
            </p>
          )}
          {speechCheck.outcome === null && speechCheck.listening && (
            <p role="status" className="text-center text-kid-xs text-ink-soft">
              {t('finalTest.speakCheckListening')}
            </p>
          )}

          {/* Nói rõ đây là "máy nghe giúp vui", không phải điểm phát âm. */}
          <p className="text-center text-kid-xs text-ink-soft">{t('finalTest.speakCheckNote')}</p>
        </div>
      )}

      {/* --- TẦNG 3: nghe lại giọng con (tuỳ chọn, mặc định TẮT) ------------ */}
      {showVoicePlayback && (
        <div className="flex flex-col gap-2 rounded-kid border-2 border-line bg-surface-raised p-3">
          {voicePlayback.state === 'idle' && (
            <BigButton
              variant="secondary"
              icon="🔴"
              aria-label={t('finalTest.voicePlaybackLabel')}
              disabled={done}
              onClick={voicePlayback.start}
            >
              {t('finalTest.voicePlayback')}
            </BigButton>
          )}

          {voicePlayback.state === 'recording' && (
            <BigButton
              variant="success"
              icon="⏹️"
              aria-label={t('finalTest.voicePlaybackStopLabel')}
              onClick={voicePlayback.stop}
            >
              {t('finalTest.voicePlaybackStop')}
            </BigButton>
          )}

          {voicePlayback.state === 'ready' && (
            <>
              <p className="text-center text-kid-xs text-ink-soft">
                {t('finalTest.voicePlaybackReady')}
              </p>
              <BigButton variant="secondary" icon="▶️" onClick={voicePlayback.play}>
                {t('finalTest.voicePlaybackPlay')}
              </BigButton>
              <BigButton variant="ghost" icon="🗑️" onClick={voicePlayback.discard}>
                {t('finalTest.voicePlaybackDiscard')}
              </BigButton>
            </>
          )}

          {voicePlayback.state === 'playing' && (
            <BigButton variant="ghost" icon="🗑️" onClick={voicePlayback.discard}>
              {t('finalTest.voicePlaybackDiscard')}
            </BigButton>
          )}

          <p className="text-center text-kid-xs text-ink-soft">{t('finalTest.voicePlaybackNote')}</p>
        </div>
      )}

      {/* --- TẦNG 1: nút chính, LUÔN có — hành vi mặc định không đổi ---------- */}
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
