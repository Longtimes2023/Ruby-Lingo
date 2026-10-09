/**
 * RubyLingo — `usePointer()`: thao tác chạm/kéo thống nhất cho mọi thiết bị.
 *
 * ⭐ VÌ SAO DÙNG POINTER EVENTS CHỨ KHÔNG DÙNG `mouse*` + `touch*` RIÊNG:
 *   Viết riêng hai bộ nghĩa là mọi trò chơi phải xử lý hai đường mã, và trên máy hybrid
 *   (laptop có màn hình cảm ứng) CẢ HAI sẽ cùng bắn ⇒ một thao tác bị tính hai lần. Pointer
 *   Events gộp tất cả thành một đường, kèm `pointerType` khi thật sự cần phân biệt.
 *
 * ⭐ `setPointerCapture` LÀ ĐIỂM CỐT LÕI, KHÔNG PHẢI TIỆN ÍCH:
 *   Không có nó, khi bé kéo ngón tay ra NGOÀI thẻ bài, sự kiện `pointermove` sẽ nhảy sang
 *   phần tử khác (hoặc ra ngoài cửa sổ) và trò chơi "mất dấu" ngón tay giữa chừng — đường
 *   nối đứt, thẻ bài kẹt ở trạng thái đang kéo. Capture buộc trình duyệt gửi MỌI sự kiện
 *   của ngón tay đó về đúng phần tử đã nhận `pointerdown`, dù ngón tay đi đâu.
 *
 * ⚠️⚠️ BẮT BUỘC: PHẦN TỬ KÉO PHẢI CÓ CSS `touch-action`
 *   Trên thiết bị cảm ứng, trình duyệt quyết định "cuộn trang hay gửi sự kiện cho web"
 *   NGAY khi ngón tay chạm xuống — TRƯỚC khi JavaScript chạy. Gọi `preventDefault()` trong
 *   `pointerdown` là quá muộn và không đáng tin. Cách duy nhất đúng là khai báo trước:
 *
 *     • Kéo tự do 2 chiều (nối từ với hình):  style={{ touchAction: 'none' }}
 *     • Chỉ kéo ngang, vẫn muốn cuộn dọc:     style={{ touchAction: 'pan-y' }}
 *
 *   ⚠️ Cân nhắc kỹ với `'none'`: nếu cả màn hình toàn thẻ bài đều `touch-action: none`, bé
 *   KHÔNG THỂ cuộn trang bằng cách vuốt trên thẻ — dễ bị "kẹt" trên điện thoại màn nhỏ.
 *   `'pan-y'` là lựa chọn an toàn hơn cho lưới thẻ; chỉ dùng `'none'` cho vùng kéo thật sự.
 *
 * ⭐ `dragThreshold` — PHÂN BIỆT "CHẠM" VÀ "KÉO":
 *   Ngón tay trẻ con rung, nên một cú "chạm" luôn kèm vài pixel xê dịch. Nếu coi mọi xê dịch
 *   là kéo thì bé chạm vào thẻ bài sẽ không bao giờ được tính là chạm. Chỉ khi vượt ngưỡng
 *   mới chuyển sang trạng thái kéo; dưới ngưỡng, lúc nhấc tay sẽ phát `onTap`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Toạ độ trong HỆ TOẠ ĐỘ KHUNG NHÌN (`clientX`/`clientY`), không phải toạ độ trang. */
export interface PointerPoint {
  x: number;
  y: number;
}

export interface DragEndMeta {
  /** Đã vượt ngưỡng kéo chưa. `false` nghĩa là đây thực chất là một cú chạm. */
  dragged: boolean;
  /** Thời gian giữ, ms — dùng để phát hiện "giữ lâu" nếu cần. */
  durationMs: number;
  /** Loại thiết bị: `'mouse' | 'touch' | 'pen'`. */
  pointerType: string;
}

export interface UsePointerOptions {
  /** Bắt đầu kéo (đã vượt ngưỡng). Dùng để vẽ đường nối, nâng thẻ bài lên... */
  onDragStart?: (point: PointerPoint, event: ReactPointerEvent<HTMLElement>) => void;
  onDragMove?: (point: PointerPoint, event: ReactPointerEvent<HTMLElement>) => void;
  /** Nhấc tay. `meta.dragged` cho biết đây là kéo hay chỉ là chạm. */
  onDragEnd?: (point: PointerPoint, meta: DragEndMeta, event: ReactPointerEvent<HTMLElement>) => void;
  /** Chạm gọn (không vượt ngưỡng kéo). Đây là đường đi của hầu hết game "chạm để chọn". */
  onTap?: (point: PointerPoint, event: ReactPointerEvent<HTMLElement>) => void;
  /**
   * Trình duyệt thu hồi quyền điều khiển ngón tay (thông báo hệ thống, cử chỉ vuốt cạnh
   * màn hình, ngón tay thứ hai chạm vào...). PHẢI xử lý: nếu bỏ qua, trò chơi kẹt ở trạng
   * thái đang kéo vĩnh viễn vì `pointerup` sẽ không bao giờ tới.
   */
  onCancel?: () => void;
  /** Số px phải xê dịch mới coi là kéo. Mặc định 8 — đủ lớn để bỏ qua rung tay trẻ con. */
  dragThreshold?: number;
  /** Tắt hẳn tương tác (ví dụ khi đang hiện overlay kết quả). */
  disabled?: boolean;
}

export interface UsePointerResult {
  /** Trải lên phần tử: `<div {...handlers} />`. */
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Đang kéo thật sự (đã vượt ngưỡng). Dùng để đổi con trỏ / nâng phần tử lên. */
  isDragging: boolean;
  /** Vị trí hiện tại, hoặc `null` khi không có ngón tay nào. */
  point: PointerPoint | null;
  /** Huỷ giữa chừng — gọi khi đổi câu hỏi, mở overlay, hoặc unmount mềm. */
  cancel: () => void;
}

const DEFAULT_DRAG_THRESHOLD = 8;

export function usePointer(options: UsePointerOptions = {}): UsePointerResult {
  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    onTap,
    onCancel,
    dragThreshold = DEFAULT_DRAG_THRESHOLD,
    disabled = false,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [point, setPoint] = useState<PointerPoint | null>(null);

  /**
   * Trạng thái của ngón tay đang theo dõi, giữ trong `ref` chứ KHÔNG trong `state`.
   *
   * ⭐ Vì sao: `pointermove` bắn hàng chục lần mỗi giây. Nếu điểm bắt đầu nằm trong state,
   *   mỗi lần cập nhật lại là một lần render, và các callback trong closure có thể đọc phải
   *   giá trị của lần render CŨ. `ref` cho giá trị luôn mới nhất mà không gây render.
   */
  const activeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    dragged: boolean;
    pointerType: string;
    captured: boolean;
  } | null>(null);

  /**
   * ⭐ Callback được giữ trong `ref` để `handlers` KHÔNG phải tạo lại mỗi lần render.
   *
   *   Nếu đưa thẳng `onDragMove` vào mảng phụ thuộc của `useCallback`, mỗi lần component
   *   cha render (rất thường xuyên trong game) là một bộ `handlers` mới ⇒ React gỡ và gắn
   *   lại listener ⇒ có thể làm ĐỨT pointer capture đang hoạt động giữa lúc bé đang kéo.
   *   Cách này giữ `handlers` ổn định suốt vòng đời component.
   */
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onTap, onCancel });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onTap, onCancel };

  const cancel = useCallback(() => {
    activeRef.current = null;
    setIsDragging(false);
    setPoint(null);
  }, []);

  /**
   * Dọn khi unmount.
   *
   * ⚠️ Cần thiết vì: nếu component bị gỡ đúng lúc bé đang kéo (đổi câu hỏi, hết giờ), phần
   *   tử mất khỏi DOM ⇒ không còn ai nhận `pointerup` ⇒ trạng thái "đang kéo" bị giữ lại và
   *   lần vào sau trò chơi khởi động trong tình trạng kéo dở.
   */
  useEffect(() => cancel, [cancel]);

  const handlers = useMemo(() => {
    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
      if (disabled) return;

      // Chỉ nhận ngón tay CHÍNH. Ngón thứ hai (bé tì tay lên màn hình khi cầm iPad) không
      // được phép cướp thao tác đang diễn ra.
      if (!event.isPrimary) return;

      // Chuột chỉ nhận nút trái. Với cảm ứng/bút, `button` luôn là 0 nên phép kiểm này
      // không ảnh hưởng gì tới chúng.
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const point0: PointerPoint = { x: event.clientX, y: event.clientY };
      const captured = (() => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
          return true;
        } catch {
          // Một số trình duyệt cũ ném lỗi nếu pointerId không còn hợp lệ. Không capture
          // được vẫn chạy tiếp — chỉ là mất dấu nếu bé kéo ra ngoài phần tử.
          return false;
        }
      })();

      activeRef.current = {
        pointerId: event.pointerId,
        startX: point0.x,
        startY: point0.y,
        startTime: event.timeStamp,
        dragged: false,
        pointerType: event.pointerType,
        captured,
      };
      setPoint(point0);
      // KHÔNG đặt `isDragging = true` ở đây: chưa biết đây là chạm hay kéo.
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
      const active = activeRef.current;
      if (!active || active.pointerId !== event.pointerId) return;

      const next: PointerPoint = { x: event.clientX, y: event.clientY };

      if (!active.dragged) {
        const dx = next.x - active.startX;
        const dy = next.y - active.startY;
        // So bình phương để khỏi gọi `Math.sqrt` mỗi lần di chuyển — đây là đường nóng.
        if (dx * dx + dy * dy < dragThreshold * dragThreshold) {
          setPoint(next); // vẫn cập nhật vị trí, nhưng chưa coi là kéo
          return;
        }
        active.dragged = true;
        setIsDragging(true);
        callbacksRef.current.onDragStart?.(next, event);
      }

      setPoint(next);
      callbacksRef.current.onDragMove?.(next, event);
    };

    const finish = (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      const active = activeRef.current;
      // Bỏ qua nếu là ngón tay khác, hoặc sự kiện đến sau khi đã kết thúc.
      if (!active || active.pointerId !== event.pointerId) return;

      const endPoint: PointerPoint = { x: event.clientX, y: event.clientY };
      const meta: DragEndMeta = {
        dragged: active.dragged,
        durationMs: Math.max(0, Math.round(event.timeStamp - active.startTime)),
        pointerType: active.pointerType,
      };

      // Nhả capture TRƯỚC khi dọn trạng thái, để `lostpointercapture` bắn ra trong lúc
      // `activeRef` còn dữ liệu — nếu không, handler đó tưởng là mất capture bất ngờ.
      if (active.captured) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* Đã được nhả tự động (ví dụ phần tử bị gỡ) — bỏ qua. */
        }
      }

      activeRef.current = null;
      setIsDragging(false);
      setPoint(null);

      if (cancelled) {
        callbacksRef.current.onCancel?.();
        return;
      }

      callbacksRef.current.onDragEnd?.(endPoint, meta, event);
      // Chạm gọn ⇒ phát `onTap`. Hai callback loại trừ nhau nên không sợ xử lý hai lần.
      if (!meta.dragged) callbacksRef.current.onTap?.(endPoint, event);
    };

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
      /**
       * Trình duyệt tự nhả capture (phần tử bị gỡ, hoặc có cử chỉ hệ thống).
       * Coi như huỷ — nếu không, trạng thái "đang kéo" sẽ kẹt vì `pointerup` không tới nữa.
       */
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
        const active = activeRef.current;
        if (!active || active.pointerId !== event.pointerId) return;
        cancel();
        callbacksRef.current.onCancel?.();
      },
    };
  }, [disabled, dragThreshold, cancel]);

  return { handlers, isDragging, point, cancel };
}
