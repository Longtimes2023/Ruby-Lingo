/**
 * Test cho `AudioSfxService`.
 *
 * Trọng tâm KHÔNG phải "có ra tiếng hay không" (không test được trong jsdom) mà là ba thứ
 * có thể hỏng im lặng:
 *   1. RÒ RỈ AudioContext — Chrome giới hạn ~6 context/tab, vượt là hỏng âm thanh.
 *   2. Nốt nhạc chứa giá trị làm `exponentialRampToValueAtTime` ném lỗi (giá trị 0).
 *   3. Âm báo "chưa đúng" nghe như còi báo lỗi — trái triết lý không khiển trách trẻ.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  AudioSfxService,
  SFX_RECIPES,
  type AudioContextLike,
  type AudioParamLike,
  type SfxName,
} from '../../../src/services/AudioSfxService.js';

// =============================================================================
// Giả lập Web Audio API
// =============================================================================

interface RecordedCall {
  method: keyof AudioParamLike;
  value: number;
  time: number;
}

function createFakeParam(recorded: RecordedCall[]): AudioParamLike {
  const param: AudioParamLike = {
    value: 0,
    setValueAtTime: (value, time) => {
      recorded.push({ method: 'setValueAtTime', value, time });
      return param;
    },
    linearRampToValueAtTime: (value, time) => {
      recorded.push({ method: 'linearRampToValueAtTime', value, time });
      return param;
    },
    exponentialRampToValueAtTime: (value, time) => {
      // Trình duyệt THẬT ném lỗi ở đây khi `value === 0`. Giả lập phải làm y hệt, nếu không
      // test sẽ "xanh" trong khi app im lặng trên máy thật.
      if (value === 0) throw new RangeError('exponentialRampToValueAtTime: value must be non-zero');
      recorded.push({ method: 'exponentialRampToValueAtTime', value, time });
      return param;
    },
  };
  return param;
}

interface FakeContext extends AudioContextLike {
  state: string;
  currentTime: number;
  resumeCount: number;
  closeCount: number;
  oscillators: { type: string; frequency: RecordedCall[]; started: number[]; stopped: number[] }[];
  gains: { gain: RecordedCall[] }[];
  connections: number;
}

function createFakeContext(initialState = 'running'): FakeContext {
  const ctx: FakeContext = {
    state: initialState,
    currentTime: 1,
    destination: { name: 'destination' },
    resumeCount: 0,
    closeCount: 0,
    oscillators: [],
    gains: [],
    connections: 0,
    resume() {
      ctx.resumeCount += 1;
      ctx.state = 'running';
      return Promise.resolve();
    },
    close() {
      ctx.closeCount += 1;
      return Promise.resolve();
    },
    createOscillator() {
      const frequency: RecordedCall[] = [];
      const osc = {
        type: 'sine',
        frequency: createFakeParam(frequency),
        started: [] as number[],
        stopped: [] as number[],
        connect: () => {
          ctx.connections += 1;
          return undefined;
        },
        start: (when = 0) => osc.started.push(when),
        stop: (when = 0) => osc.stopped.push(when),
      };
      ctx.oscillators.push({ type: osc.type, frequency, started: osc.started, stopped: osc.stopped });
      return osc;
    },
    createGain() {
      const gain: RecordedCall[] = [];
      const node = {
        gain: createFakeParam(gain),
        connect: () => {
          ctx.connections += 1;
          return undefined;
        },
      };
      ctx.gains.push({ gain });
      return node;
    },
  };
  return ctx;
}

/** Đếm số node dao động đã tạo cho một hiệu ứng. */
function expectedNoteCount(name: SfxName): number {
  return SFX_RECIPES[name].length;
}

// =============================================================================
// Bản nhạc
// =============================================================================

describe('SFX_RECIPES', () => {
  const names = Object.keys(SFX_RECIPES) as SfxName[];

  it('mọi hiệu ứng đều có ít nhất một nốt', () => {
    for (const name of names) {
      expect(SFX_RECIPES[name].length, `hiệu ứng "${name}" không có nốt nào`).toBeGreaterThan(0);
    }
  });

  it('tần số nằm trong vùng tai trẻ nhạy và loa điện thoại tái tạo được', () => {
    for (const name of names) {
      for (const note of SFX_RECIPES[name]) {
        expect(note.frequency, `${name}`).toBeGreaterThanOrEqual(200);
        expect(note.frequency, `${name}`).toBeLessThanOrEqual(2_000);
      }
    }
  });

  it('âm lượng đỉnh luôn thấp — loa điện thoại khuếch đại mạnh hơn ta tưởng', () => {
    for (const name of names) {
      for (const note of SFX_RECIPES[name]) {
        expect(note.gain, `${name}`).toBeGreaterThan(0);
        expect(note.gain, `${name}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('thời lượng đủ dài để nghe được, đủ ngắn để không chồng lên câu sau', () => {
    for (const name of names) {
      for (const note of SFX_RECIPES[name]) {
        expect(note.duration, `${name}`).toBeGreaterThanOrEqual(0.04);
        expect(note.duration, `${name}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('không dùng sóng vuông/răng cưa — hai sóng đó chói và gây mệt tai', () => {
    for (const name of names) {
      for (const note of SFX_RECIPES[name]) {
        expect(['sine', 'triangle']).toContain(note.wave);
      }
    }
  });

  it('"tap" rất ngắn vì bé chạm hàng trăm lần mỗi buổi', () => {
    const total = SFX_RECIPES.tap.reduce((sum, n) => sum + n.duration, 0);
    expect(total).toBeLessThan(0.15);
  });

  it('"correct" đi LÊN (âm cuối cao hơn âm đầu)', () => {
    const notes = SFX_RECIPES.correct;
    expect(notes.at(-1)!.frequency).toBeGreaterThan(notes[0]!.frequency);
  });

  /**
   * ⭐ TEST TRIẾT LÝ: âm báo "chưa đúng" phải nghe như lời nhắc, không như còi báo lỗi.
   */
  it('"wrong" đi XUỐNG, dùng sóng sine và âm lượng thấp hơn "correct"', () => {
    const wrong = SFX_RECIPES.wrong;
    expect(wrong.at(-1)!.frequency).toBeLessThan(wrong[0]!.frequency);
    expect(wrong.every((n) => n.wave === 'sine')).toBe(true);
    expect(Math.max(...wrong.map((n) => n.gain))).toBeLessThan(
      Math.max(...SFX_RECIPES.correct.map((n) => n.gain)),
    );
  });

  it('"reward" và "levelUp" đi LÊN và dài hơn "correct"', () => {
    const total = (n: SfxName) => SFX_RECIPES[n].reduce((s, x) => s + x.duration, 0);
    expect(total('reward')).toBeGreaterThan(total('correct'));
    expect(total('levelUp')).toBeGreaterThan(total('reward'));
  });
});

// =============================================================================
// Vòng đời AudioContext — chống rò rỉ
// =============================================================================

describe('AudioSfxService — vòng đời AudioContext', () => {
  it('CHỈ tạo MỘT context dù phát hàng trăm tiếng động', () => {
    const ctx = createFakeContext();
    let creations = 0;
    const service = new AudioSfxService(() => {
      creations += 1;
      return ctx;
    });

    for (let i = 0; i < 200; i += 1) service.play('tap');

    expect(creations).toBe(1);
    expect(service.contextCount()).toBe(1);
  });

  /**
   * ⚠️ `isSupported()` nghĩa là "trình duyệt CÓ Web Audio API", không phải "chắc chắn tạo
   *    được context". Tiêm một factory nghĩa là API có tồn tại; factory trả `null` mô phỏng
   *    việc tạo context THẤT BẠI (Safari cũ hết tài nguyên) — trường hợp khác hẳn.
   *    Hai trường hợp đó phải được kiểm riêng, nếu không test sẽ khẳng định sai điều cần kiểm.
   */
  it('factory trả null (tạo context thất bại) ⇒ bỏ qua êm, không tạo node nào', () => {
    const service = new AudioSfxService(() => null);
    expect(service.play('tap')).toBe(false);
    expect(service.contextCount()).toBe(0);
    expect(() => service.unlock()).not.toThrow();
  });

  it('báo KHÔNG hỗ trợ khi trình duyệt thiếu hẳn Web Audio API', () => {
    // jsdom không có `AudioContext`; xoá tường minh để không phụ thuộc vào jsdom.
    const w = window as unknown as Record<string, unknown>;
    const saved = w['AudioContext'];
    delete w['AudioContext'];
    delete w['webkitAudioContext'];
    try {
      const service = new AudioSfxService();
      expect(service.isSupported()).toBe(false);
      expect(service.play('tap')).toBe(false);
      expect(service.contextCount()).toBe(0);
    } finally {
      if (saved !== undefined) w['AudioContext'] = saved;
    }
  });

  it('không ném lỗi khi tạo context thất bại', () => {
    const service = new AudioSfxService(() => {
      throw new Error('quá nhiều AudioContext');
    });
    expect(() => service.play('tap')).not.toThrow();
    expect(service.play('tap')).toBe(false);
  });

  it('`dispose()` đóng context', async () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('tap');
    await service.dispose();
    expect(ctx.closeCount).toBe(1);
  });

  it('sau `dispose()` vẫn tạo được context mới (không kẹt ở trạng thái đã đóng)', () => {
    const contexts = [createFakeContext(), createFakeContext()];
    let i = 0;
    const service = new AudioSfxService(() => contexts[i++] ?? null);
    service.play('tap');
    void service.dispose();
    service.play('tap');
    expect(service.contextCount()).toBe(2);
  });
});

// =============================================================================
// Đánh thức âm thanh — bẫy autoplay
// =============================================================================

describe('AudioSfxService — đánh thức âm thanh', () => {
  it('`unlock()` gọi `resume()` khi context còn suspended', () => {
    const ctx = createFakeContext('suspended');
    const service = new AudioSfxService(() => ctx);
    service.unlock();
    expect(ctx.resumeCount).toBe(1);
  });

  it('`unlock()` KHÔNG gọi `resume()` khi context đã chạy', () => {
    const ctx = createFakeContext('running');
    const service = new AudioSfxService(() => ctx);
    service.unlock();
    expect(ctx.resumeCount).toBe(0);
  });

  it('`play()` tự đánh thức context còn suspended', () => {
    const ctx = createFakeContext('suspended');
    const service = new AudioSfxService(() => ctx);
    service.play('correct');
    expect(ctx.resumeCount).toBe(1);
  });

  it('nuốt lỗi khi trình duyệt từ chối `resume()`', async () => {
    const ctx = createFakeContext('suspended');
    ctx.resume = () => {
      ctx.resumeCount += 1;
      return Promise.reject(new Error('NotAllowedError'));
    };
    const service = new AudioSfxService(() => ctx);
    expect(() => service.play('tap')).not.toThrow();
    // Chờ microtask để lời hứa bị từ chối được xử lý — nếu không sẽ có unhandled rejection.
    await Promise.resolve();
  });
});

// =============================================================================
// Lên dây đàn
// =============================================================================

describe('AudioSfxService — lên dây đàn', () => {
  it('tạo đúng số node cho mỗi nốt', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('correct');
    expect(ctx.oscillators).toHaveLength(expectedNoteCount('correct'));
    expect(ctx.gains).toHaveLength(expectedNoteCount('correct'));
  });

  it('mỗi nốt nối vào gain, và gain nối vào loa', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('reward');
    // 1 nối oscillator→gain + 1 nối gain→destination, cho mỗi nốt.
    expect(ctx.connections).toBe(expectedNoteCount('reward') * 2);
  });

  /**
   * ⚠️ Bẫy kinh điển: `exponentialRampToValueAtTime(0, ...)` NÉM RangeError trong trình
   * duyệt thật ⇒ nốt không bao giờ kêu, và nếu lỗi bị nuốt thì app im lặng hoàn toàn.
   * Giả lập ở trên cố ý ném y hệt trình duyệt, nên test này bắt được lỗi đó.
   */
  it('KHÔNG bao giờ ramp theo hàm mũ về 0', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    for (const name of Object.keys(SFX_RECIPES) as SfxName[]) {
      expect(() => service.play(name), `hiệu ứng "${name}"`).not.toThrow();
    }
    for (const g of ctx.gains) {
      for (const call of g.gain) {
        if (call.method === 'exponentialRampToValueAtTime') {
          expect(call.value).toBeGreaterThan(0);
        }
      }
    }
  });

  it('có bao hình lên nhanh rồi xuống — không có tiếng "tạch" ở đầu/cuối', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('tap');
    const calls = ctx.gains[0]!.gain;
    expect(calls.map((c) => c.method)).toEqual([
      'setValueAtTime',
      'linearRampToValueAtTime',
      'exponentialRampToValueAtTime',
    ]);
  });

  it('dừng dao động SAU khi bao hình đã xuống hết (không cắt cụt nốt)', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('tap');
    const osc = ctx.oscillators[0]!;
    const lastGainTime = Math.max(...ctx.gains[0]!.gain.map((c) => c.time));
    expect(osc.stopped[0]!).toBeGreaterThan(lastGainTime);
  });

  it('mọi nốt được lên lịch ở tương lai, không phải quá khứ', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.play('reward');
    for (const osc of ctx.oscillators) {
      expect(osc.started[0]!).toBeGreaterThanOrEqual(ctx.currentTime);
    }
  });
});

// =============================================================================
// Cài đặt
// =============================================================================

describe('AudioSfxService — cài đặt', () => {
  it('KHÔNG tạo node nào khi phụ huynh đã tắt tiếng', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.setSettings({ enabled: false });
    expect(service.play('correct')).toBe(false);
    expect(ctx.oscillators).toHaveLength(0);
  });

  it('không tạo cả AudioContext khi đang tắt tiếng', () => {
    const service = new AudioSfxService(() => {
      throw new Error('không được gọi');
    });
    service.setSettings({ enabled: false });
    expect(service.play('tap')).toBe(false);
    expect(service.contextCount()).toBe(0);
  });

  it('phát lại được sau khi bật tiếng', () => {
    const ctx = createFakeContext();
    const service = new AudioSfxService(() => ctx);
    service.setSettings({ enabled: false });
    service.play('tap');
    service.setSettings({ enabled: true });
    expect(service.play('tap')).toBe(true);
    expect(ctx.oscillators).toHaveLength(1);
  });
});

// =============================================================================
// Rung
// =============================================================================

describe('AudioSfxService — rung', () => {
  it('rung khi trả lời đúng nếu phụ huynh bật', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const service = new AudioSfxService(() => createFakeContext());
    service.vibrate('correct');
    expect(vibrate).toHaveBeenCalledWith(18);
    vi.unstubAllGlobals();
  });

  it('KHÔNG rung khi phụ huynh tắt', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const service = new AudioSfxService(() => createFakeContext());
    service.setSettings({ hapticsEnabled: false });
    service.vibrate('correct');
    expect(vibrate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('không ném lỗi khi trình duyệt không hỗ trợ rung (iOS Safari)', () => {
    vi.stubGlobal('navigator', {});
    const service = new AudioSfxService(() => createFakeContext());
    expect(() => service.vibrate('correct')).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('không rung ở hiệu ứng "tap" — rung mọi cú chạm là phiền và tốn pin', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const service = new AudioSfxService(() => createFakeContext());
    service.vibrate('tap');
    expect(vibrate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
