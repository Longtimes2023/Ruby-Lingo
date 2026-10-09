/**
 * RubyLingo — `useChildStatus()`: số liệu hiển thị trên thanh trên cùng.
 *
 * ⭐ VÌ SAO LÀ MỘT HOOK RIÊNG, KHÔNG ĐỌC THẲNG TRONG `TopBar`:
 *   `TopBar` là component TRÌNH BÀY. Nó nhận số và vẽ. Nhờ vậy nó kiểm thử được bằng cách truyền
 *   số giả, và quan trọng hơn: khi ví chuyển từ số cứng sang dữ liệu thật (T055), chỉ có MỘT hàm
 *   này phải sửa — không phải `TopBar`, không phải `AppShell`, không phải bất kỳ màn hình nào.
 *
 * ⚠️⚠️ TRẢ `null` LÀ MỘT CÂU TRẢ LỜI ĐÚNG, KHÔNG PHẢI TRẠNG THÁI LỖI.
 *   `null` nghĩa là "CHƯA BIẾT" — chưa chọn bé, hoặc ảnh chụp ví chưa về. `TopBar` đã có cách
 *   hiển thị riêng cho nó (dấu "—", xem `pending` trong `TopBar.tsx`).
 *
 *   Vì sao KHÔNG trả số 0 cho tiện: số 0 là một LỜI NÓI DỐI CỤ THỂ. Bé vừa kiếm được 12 ⭐, mở
 *   app lên, thấy "0" — bé sẽ tưởng mình mất hết tiền. Dấu "—" chỉ nói "chưa biết", còn số 0
 *   nói "không có gì". Hai điều đó khác nhau, và với trẻ 7 tuổi thì khác nhau rất nhiều.
 */

import { useRewardStore } from '../store/rewardStore.js';
import { useActiveChild } from '../store/sessionStore.js';

/** Số liệu tóm tắt của bé đang hoạt động, dùng cho `TopBar`. */
export interface ChildStatus {
  /** ⭐ Sao — tiền tệ phổ thông. */
  stars: number;
  /** 🌰 Hạt dẻ — tiền tệ hiếm. */
  acorns: number;
  /** ❤️ Mức vui vẻ của linh vật, 1–5 (sàn = 1). */
  happiness: number;
  /** 🔥 Số ngày học liên tiếp. */
  streakDays: number;
  /** ✨ Tổng XP, dùng để suy ra cấp. */
  xp: number;
}

export interface ChildStatusResult {
  /** `null` = chưa biết (chưa có bé đang chọn, hoặc dữ liệu chưa tải xong). */
  status: ChildStatus | null;
}

export function useChildStatus(): ChildStatusResult {
  const child = useActiveChild();
  const storedChildId = useRewardStore((s) => s.childId);
  const snapshot = useRewardStore((s) => s.snapshot);

  if (!child || !snapshot) return { status: null };

  /**
   * ⚠️ PHẢI KIỂM `storedChildId`, KHÔNG CHỈ KIỂM `snapshot`.
   *   Lúc bố mẹ đổi bé, `sessionStore` đổi trước còn ảnh chụp ví của bé mới thì chưa về. Trong
   *   khoảng đó `snapshot` vẫn là của BÉ CŨ — và nếu không kiểm, `TopBar` sẽ hiện ví của bé cũ
   *   dưới tên bé mới. Kiểm id làm khoảng đó rơi về "chưa biết" (dấu "—"), đúng như nó là.
   */
  if (storedChildId !== child.id) return { status: null };

  return {
    status: {
      stars: snapshot.wallet.stars,
      acorns: snapshot.wallet.acorns,
      happiness: snapshot.pet.happiness,
      streakDays: snapshot.streak.currentStreak,
      xp: snapshot.xp.xp,
    },
  };
}
