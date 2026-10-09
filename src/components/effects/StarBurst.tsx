/**
 * RubyLingo — `StarBurst`: sao bung ra khi bé trả lời đúng.
 *
 * ⭐ VÌ SAO CẦN HIỆU ỨNG NÀY (không phải chỉ để cho đẹp):
 *   Với trẻ 7 tuổi, phản hồi bằng âm thanh dễ bị bỏ lỡ (đang ở nơi ồn, hoặc đã tắt tiếng), và
 *   phản hồi bằng chữ thì bé chưa đọc kịp. Một chùm sao bung ra ở đúng chỗ bé vừa chạm là cách
 *   xác nhận "con vừa làm đúng" nhanh nhất, không cần đọc gì.
 *
 * ⚠️ HIỆU ỨNG KHÔNG BAO GIỜ ĐƯỢC CHẶN THAO TÁC:
 *   Lớp phủ có `pointer-events-none` và `aria-hidden`. Nếu quên, bé bấm câu tiếp theo ngay sau
 *   khi trả lời đúng sẽ bấm trúng lớp phủ và nút không ăn — lỗi rất hay gặp với hiệu ứng.
 *
 * ⭐ TÔN TRỌNG "GIẢM CHUYỂN ĐỘNG":
 *   Khi bật, KHÔNG vẽ hạt bay. Thay bằng một lần nhấp nháy tại chỗ. Vẫn có phản hồi thị giác
 *   (bé biết mình vừa làm đúng) nhưng không có chuyển động — đúng cho bé nhạy cảm với chuyển
 *   động, và cũng nhẹ máy hơn.
 */

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '../../lib/cn.js';
import { createBurstParticles, particleOffset } from './particles.js';

const DEFAULT_ICONS = ['⭐', '✨', '🌟'] as const;

export interface StarBurstProps {
  /**
   * Đổi giá trị này để phát lại hiệu ứng. `null` = không hiệu ứng.
   * Dùng số thứ tự câu hỏi, hoặc số lần trả lời đúng.
   */
  burstKey: number | string | null;
  count?: number;
  icons?: readonly string[];
  /** Thời lượng, ms. Mặc định 900. */
  durationMs?: number;
  /** Gọi sau khi chạy xong — để component cha ẩn lớp phủ đi. */
  onDone?: () => void;
  className?: string;
}

export function StarBurst({
  burstKey,
  count = 10,
  icons = DEFAULT_ICONS,
  durationMs = 900,
  onDone,
  className,
}: StarBurstProps) {
  const reduceMotion = useReducedMotion();
  const active = burstKey !== null && burstKey !== undefined;

  useEffect(() => {
    if (!active || !onDone) return;
    // ⭐ Bắt buộc phải dọn timer: nếu component bị gỡ (đổi câu hỏi) trước khi hết thời gian,
    //   `onDone` sẽ bắn vào một component đã chết — React cảnh báo và trạng thái cha bị sai.
    const timer = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(timer);
  }, [active, burstKey, durationMs, onDone]);

  if (!active) return null;

  const particles = reduceMotion
    ? []
    : createBurstParticles({ count, icons, seed: burstKey, minDistance: 55, maxDistance: 130 });

  return (
    <div
      // `key` làm cả lớp phủ được GẮN LẠI mỗi lần bung ⇒ animation chạy lại từ đầu thay vì
      // Framer Motion "nối tiếp" từ trạng thái cũ (khi đó hạt sẽ không bay ra lần thứ hai).
      key={burstKey}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 z-[50] flex items-center justify-center overflow-visible',
        className,
      )}
    >
      {reduceMotion ? (
        // Bản không chuyển động: một lần nhấp nháy tại chỗ.
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: durationMs / 1000, times: [0, 0.15, 0.6, 1] }}
          className="text-[44px] leading-none"
        >
          ⭐
        </motion.span>
      ) : (
        particles.map((particle, index) => {
          const { x, y } = particleOffset(particle);
          return (
            <motion.span
              key={index}
              initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
              animate={{
                x,
                y,
                scale: [0, particle.scale, particle.scale * 0.7],
                opacity: [0, 1, 0],
                rotate: particle.rotate,
              }}
              transition={{
                duration: durationMs / 1000,
                delay: particle.delay,
                ease: 'easeOut',
                // Độ mờ đạt đỉnh sớm rồi tắt dần ⇒ hạt "loé lên" rồi tan, tự nhiên hơn là mờ dần
                // suốt hành trình.
                times: [0, 0.25, 1],
              }}
              className="absolute text-[24px] leading-none"
            >
              {particle.icon}
            </motion.span>
          );
        })
      )}
    </div>
  );
}
