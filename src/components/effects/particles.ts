/**
 * RubyLingo — Sinh hạt cho hiệu ứng phần thưởng (hàm THUẦN, không phụ thuộc React).
 *
 * ⭐ VÌ SAO TÁCH RA VÀ DÙNG HẠT GIỐNG TẤT ĐỊNH:
 *   Nếu sinh hạt bằng `Math.random()` ngay trong thân component, mỗi lần React render lại là
 *   một lần tung hạt mới ⇒ các ngôi sao ĐỔI HƯỚNG giữa chừng, trông như giật lag. Và vì kết
 *   quả không đoán trước được nên không viết được bài test nào cho phần này.
 *   Dùng `seededRandom` với hạt giống truyền vào: cùng một hạt giống luôn cho cùng một màn
 *   trình diễn, nên vừa ổn định khi render lại, vừa kiểm thử được.
 *
 * Hàm thuần cũng có nghĩa là nhóm hiệu ứng chỉ còn lo phần vẽ — phần "tính toán" kiểm được
 * bằng test chạy trong vài mili-giây, không cần dựng DOM.
 */

import { hashString, seededRandom } from '../../lib/random.js';

export interface BurstParticle {
  /** Góc bay, radian. */
  angle: number;
  /** Quãng đường bay, px. */
  distance: number;
  /** Góc tự xoay của hạt, độ. */
  rotate: number;
  /** Tỉ lệ kích thước so với cỡ gốc (0.6–1.2). */
  scale: number;
  /** Trễ khởi hành, giây — làm hạt bay ra lệch nhịp cho tự nhiên. */
  delay: number;
  /** Emoji của hạt này. */
  icon: string;
}

export interface BurstOptions {
  count: number;
  /** Danh sách emoji để bốc ngẫu nhiên. */
  icons: readonly string[];
  seed: number | string;
  /** Quãng đường bay nhỏ nhất / lớn nhất, px. */
  minDistance?: number;
  maxDistance?: number;
  /** Tổng thời gian trễ tối đa, giây. */
  maxDelay?: number;
  /**
   * `true` = chỉ bay nửa vòng trên (từ −180° đến 0°) — dùng khi hiệu ứng phát ra từ đáy màn
   * hình, hạt bay xuống dưới sẽ bị cắt mất.
   */
  upwardOnly?: boolean;
}

const TAU = Math.PI * 2;

/**
 * Sinh danh sách hạt cho một lần bung.
 *
 * ⭐ VÌ SAO CHIA ĐỀU GÓC RỒI MỚI THÊM NHIỄU, KHÔNG CHỌN GÓC HOÀN TOÀN NGẪU NHIÊN:
 *   Chọn ngẫu nhiên hoàn toàn hay để lại "lỗ hổng" và "cụm" — có lần 5 hạt chồng lên nhau ở
 *   một góc, trông như một hạt to bị lỗi. Chia đều `TAU / count` bảo đảm toả khắp các hướng,
 *   rồi thêm nhiễu ±40% để không bị cảm giác máy móc.
 */
export function createBurstParticles(options: BurstOptions): BurstParticle[] {
  const {
    count,
    icons,
    seed,
    minDistance = 60,
    maxDistance = 150,
    maxDelay = 0.12,
    upwardOnly = false,
  } = options;

  if (count <= 0 || icons.length === 0) return [];

  // `seededRandom` chỉ nhận số, nên hạt giống dạng chuỗi (ví dụ id chủ đề) phải băm trước.
  const rng = seededRandom(typeof seed === 'string' ? hashString(seed) : seed);
  const step = TAU / count;

  return Array.from({ length: count }, (_, index) => {
    // Góc cơ sở chia đều + nhiễu ±40% bước. `upwardOnly` giới hạn vào nửa trên.
    const base = upwardOnly ? Math.PI + index * (Math.PI / count) : index * step;
    const spread = upwardOnly ? Math.PI / count : step;
    const angle = base + (rng() - 0.5) * spread * 0.8;

    return {
      angle,
      distance: minDistance + rng() * (maxDistance - minDistance),
      rotate: (rng() - 0.5) * 540,
      scale: 0.6 + rng() * 0.6,
      delay: rng() * maxDelay,
      icon: icons[Math.floor(rng() * icons.length)] ?? icons[0]!,
    };
  });
}

/** Toạ độ đích của một hạt, so với tâm bung. */
export function particleOffset(particle: BurstParticle): { x: number; y: number } {
  return {
    x: Math.cos(particle.angle) * particle.distance,
    y: Math.sin(particle.angle) * particle.distance,
  };
}
