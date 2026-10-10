/**
 * RubyLingo — `useVoicePlayback`: "NGHE LẠI GIỌNG CON" cho phần Nói (TẦNG 3, TUỲ CHỌN).
 *
 * ⭐ NHIỆM VỤ: cho bé/phụ huynh bấm ghi một đoạn NGẮN bằng micro, PHÁT LẠI NGAY trên chính máy
 *   này, rồi HUỶ bản ghi. Phụ huynh nghe được giọng con — đây là thứ DUY NHẤT đáng tin để biết
 *   giọng có chuẩn hay không.
 *
 * ⚠️⚠️ BA ĐIỀU KHÔNG ĐƯỢC PHÁ VỠ (đọc trước khi sửa):
 *   1. **KHÔNG LƯU.** Bản ghi chỉ tồn tại như một `Blob` + URL tạm trong BỘ NHỚ. KHÔNG ghi vào
 *      `localStorage`/`IndexedDB`, KHÔNG tải file, KHÔNG gửi lên server. Đóng tab là mất.
 *   2. **KHÔNG GỬI.** Không có lời gọi mạng nào ở đây. Audio không rời khỏi thiết bị.
 *   3. **MẶC ĐỊNH TẮT.** Trước đây chủ dự án đã chốt "không ghi âm". Tầng này chỉ bật khi phụ
 *      huynh chủ động bật cờ `voicePlaybackEnabled` trong khu vực phụ huynh. Đó là quyết định
 *      CÓ Ý THỨC, không phải sơ suất — xem `docs/ke-hoach/phan-noi-bai-thi.md`.
 *
 * ⚠️ ÂM THANH CHỈ ĐỌC TIẾNG ANH KHÔNG BỊ ẢNH HƯỞNG: đây là PHÁT LẠI bản ghi của chính bé, không
 *   đi qua `SpeechService` và không liên quan tới giọng đọc TTS.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getMediaRecorderCtor,
  hasMediaRecorder,
  type MediaRecorderLike,
} from '../../services/SpeechCapability.js';

export type VoicePlaybackState = 'idle' | 'recording' | 'ready' | 'playing';

export interface UseVoicePlaybackResult {
  /** Trình duyệt có micro + `MediaRecorder` không. `false` ⇒ component ẩn HẲN phần này. */
  supported: boolean;
  state: VoicePlaybackState;
  /** Bắt đầu ghi. Nếu bị từ chối quyền micro ⇒ chuyển về `idle` nhẹ nhàng (không lộ lỗi). */
  start: () => void;
  /** Kết thúc ghi ⇒ chuyển sang `ready` (có bản để nghe lại). */
  stop: () => void;
  /** Phát lại bản vừa ghi. */
  play: () => void;
  /** Xoá bản ghi khỏi bộ nhớ (thu hồi cả URL tạm). Trở về `idle`. */
  discard: () => void;
}

type MediaDevicesLike = { getUserMedia(constraints: { audio: boolean }): Promise<MediaStream> };

/** Lấy `navigator.mediaDevices` nếu trình duyệt cho, ngược lại `null`. */
function getMediaDevices(): MediaDevicesLike | null {
  if (typeof navigator === 'undefined') return null;
  const devices = (navigator as Navigator & { mediaDevices?: MediaDevicesLike }).mediaDevices;
  return devices ?? null;
}

export function useVoicePlayback(): UseVoicePlaybackResult {
  const [supported] = useState<boolean>(() => hasMediaRecorder());
  const [state, setState] = useState<VoicePlaybackState>('idle');

  const recorderRef = useRef<MediaRecorderLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** URL tạm của bản ghi — phải thu hồi khi bỏ, nếu không sẽ rò rỉ bộ nhớ. */
  const urlRef = useRef<string | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  /**
   * Component còn sống không. `getUserMedia` là BẤT ĐỒNG BỘ: nếu bé rời câu trong lúc xin quyền
   * micro, stream có thể về SAU khi effect dọn đã chạy ⇒ micro treo chạy nền. Cờ này chặn đúng ca đó.
   */
  const aliveRef = useRef(true);

  /** Dừng các track micro và bỏ stream (micro phải tắt ngay khi ngừng dùng). */
  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream === null) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        /* Track đã dừng. */
      }
    }
  }, []);

  /** Thu hồi URL tạm và bỏ thẻ audio tạm. */
  const releaseClip = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (player !== null) {
      try {
        player.pause();
      } catch {
        /* Chưa từng phát. */
      }
    }
    const url = urlRef.current;
    urlRef.current = null;
    if (url !== null && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, []);

  // Rời màn hình ⇒ tắt micro + giải phóng bản ghi ngay. Không để gì chạy nền.
  useEffect(
    () => () => {
      aliveRef.current = false;
      releaseStream();
      releaseClip();
      recorderRef.current = null;
    },
    [releaseClip, releaseStream],
  );

  const discard = useCallback(() => {
    releaseStream();
    releaseClip();
    recorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
  }, [releaseClip, releaseStream]);

  const start = useCallback(() => {
    const Ctor = getMediaRecorderCtor();
    const devices = getMediaDevices();
    if (Ctor === null || devices === null) return;

    // Bản ghi trước không còn cần ⇒ dọn sạch trước khi ghi bản mới.
    releaseClip();
    chunksRef.current = [];

    void devices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Rời câu trong lúc chờ quyền ⇒ tắt ngay, không giữ micro của bé.
        if (!aliveRef.current) {
          for (const track of stream.getTracks()) {
            try {
              track.stop();
            } catch {
              /* Track đã dừng. */
            }
          }
          return;
        }
        streamRef.current = stream;
        const recorder = new Ctor(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onerror = () => {
          // Lỗi khi ghi ⇒ dừng nhẹ nhàng, dọn micro. Không hiện lỗi kỹ thuật cho bé.
          releaseStream();
          setState('idle');
        };
        recorder.onstop = () => {
          releaseStream();
          const blob = new Blob(chunksRef.current);
          chunksRef.current = [];
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            urlRef.current = URL.createObjectURL(blob);
            setState('ready');
          } else {
            setState('idle');
          }
        };
        recorder.start();
        setState('recording');
      })
      .catch(() => {
        // Bé/phụ huynh từ chối quyền micro (hoặc không có micro) ⇒ về `idle`, KHÔNG báo lỗi kỹ thuật.
        releaseStream();
        setState('idle');
      });
  }, [releaseClip, releaseStream]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder === null) {
      releaseStream();
      setState('idle');
      return;
    }
    try {
      recorder.stop();
    } catch {
      releaseStream();
      setState('idle');
    }
  }, [releaseStream]);

  const play = useCallback(() => {
    const url = urlRef.current;
    if (url === null || typeof Audio === 'undefined') return;
    // Dừng bản phát trước (nếu có) để hai lần phát không chồng tiếng.
    const previous = playerRef.current;
    if (previous !== null) {
      try {
        previous.pause();
      } catch {
        /* Chưa phát. */
      }
    }
    const player = new Audio(url);
    playerRef.current = player;
    player.onended = () => setState('ready');
    setState('playing');
    void player.play().catch(() => setState('ready'));
  }, []);

  return { supported, state, start, stop, play, discard };
}
