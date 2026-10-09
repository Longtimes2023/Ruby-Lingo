#!/usr/bin/env node
/**
 * seed-report.mjs — RubyLingo T082 (mở rộng): LÀM ĐẦY màn BÁO CÁO TUẦN bằng API THẬT.
 *
 * ⭐ VÌ SAO CẦN: `ParentReport` chỉ vẽ biểu đồ cột + hai danh sách từ khi `dailyStats` CÓ dữ liệu.
 *   Với một bé chưa học buổi nào, màn hình chỉ hiện trạng thái RỖNG ("Tuần này bé chưa có buổi
 *   học nào") — nên lượt audit đầu KHÔNG hề đo được: nhãn ngày dưới cột (`text-ink-faint`),
 *   thanh cột (`bg-brand` trên nền `bg-line`), và các hàng từ (`WordRow`).
 *
 * ⭐ VÌ SAO DÙNG API THẬT (không INSERT thẳng vào DB):
 *   `POST /api/children/:id/game-result` là ĐÚNG đường client đi, và server TỰ chấm điểm từ dữ
 *   liệu thô (client không gửi `score`/`stars`). Seed qua API ⇒ dữ liệu trong `daily_stats` và
 *   `word_progress` có đúng hình dạng mà sản phẩm tạo ra, không phải hình dạng tôi tưởng tượng.
 *
 * ⚠️ AN TOÀN DỮ LIỆU: script CHỈ chạy khi API ở cổng QA (mặc định 4310). Nó không mở DB, không
 *   biết đường tới `data/rubylingo.db`. Chạy API QA với `DB_PATH=./data/qa.db` là điều kiện tiên quyết.
 *
 * ⚠️ CSRF: hook `onRequest` của server BỎ QUA kiểm Origin khi request KHÔNG có header `Origin`
 *   (xem server/plugins/security.ts:101-103). Script này vì thế CỐ Ý không gửi `Origin` — vẫn
 *   phải có cookie phiên hợp lệ, nên không phải đường lách CSRF.
 *
 * CÁCH DÙNG:
 *   node seed-report.mjs --base http://127.0.0.1:4310 --email <e> --password <p> [--child <id>]
 */

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : def;
}

const BASE = arg('base', 'http://127.0.0.1:4310');
const EMAIL = arg('email');
const PASSWORD = arg('password');
const CHILD_ARG = arg('child', null);

if (!EMAIL || !PASSWORD) {
  console.error('Thiếu --email / --password');
  process.exit(2);
}

const LESSON_ID = 'at-the-zoo/z1';
const EXERCISE_ID = 'at-the-zoo/z1/listen-tap';
const GAME_TYPE = 'listen_tap';
const Z1_WORDS = [
  'starters.elephant',
  'starters.giraffe',
  'starters.hippo',
  'starters.tiger',
  'starters.crocodile',
  'starters.monkey',
  'starters.snake',
];

let cookie = '';
async function call(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  // ⚠️ CỐ Ý KHÔNG gửi Origin (xem ghi chú đầu tệp).
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setC = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setC.length) cookie = setC.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* giữ nguyên text */
  }
  return { status: res.status, json, text };
}

/** Ngày (địa phương) lùi `n` ngày, ở dạng `YYYY-MM-DD`; kèm mốc giờ UTC giữa trưa. */
function dayBack(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { key, at: `${key}T06:00:00.000Z` };
}

async function main() {
  const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  console.log('LOGIN', login.status, login.status === 200 ? 'OK' : login.text.slice(0, 160));
  if (login.status !== 200) process.exit(1);

  let childId = CHILD_ARG;
  if (!childId) {
    const list = await call('GET', '/api/children');
    const kids = list.json?.data?.children ?? [];
    if (!kids.length) {
      console.error('Tài khoản không có bé nào — không seed được.');
      process.exit(1);
    }
    childId = kids[0].id;
    console.log('CHILD', childId, '(' + (kids[0].nickname ?? '') + ')');
  }

  /**
   * Kịch bản 4 ngày học trong tuần, đủ để:
   *   • biểu đồ có 4 cột CAO THẤP KHÁC NHAU (đo được nhãn ngày + thanh cột),
   *   • 3 từ đạt ngưỡng NHỚ CHẮC (≥3 lần đúng) ⇒ `masteredWords` có hàng,
   *   • 2 từ SAI ≥2 lần mà chưa nhớ chắc ⇒ `strugglingWords` có hàng.
   */
  const plan = [
    { day: dayBack(5), correct: ['starters.elephant'], wrong: ['starters.hippo'] },
    { day: dayBack(3), correct: ['starters.elephant', 'starters.giraffe'], wrong: ['starters.hippo'] },
    { day: dayBack(1), correct: ['starters.giraffe', 'starters.tiger', 'starters.monkey'], wrong: [] },
    { day: dayBack(0), correct: ['starters.elephant', 'starters.monkey'], wrong: ['starters.snake'] },
  ];

  let n = 0;
  for (const step of plan) {
    const answers = [
      ...step.correct.map((wordId) => ({ wordId, firstTry: true, wrongAttempts: 0 })),
      // ⚠️ Bất biến của schema: `firstTry` và `wrongAttempts > 0` KHÔNG thể cùng đúng.
      ...step.wrong.map((wordId) => ({ wordId, firstTry: false, wrongAttempts: 2 })),
    ];
    const body = {
      clientEventId: `qa-seed-${step.day.key.replace(/-/g, '')}-${++n}`,
      exerciseId: EXERCISE_ID,
      lessonId: LESSON_ID,
      gameType: GAME_TYPE,
      totalRounds: answers.length,
      occurredAt: step.day.at,
      durationSeconds: 90,
      answers,
    };
    const r = await call('POST', `/api/children/${encodeURIComponent(childId)}/game-result`, body);
    console.log(
      'GAME-RESULT',
      step.day.key,
      r.status,
      r.status === 200 ? JSON.stringify(r.json?.data ?? {}).slice(0, 120) : r.text.slice(0, 200),
    );
  }

  // `GET .../report` nằm SAU cổng PIN (`requireParentGate`) ⇒ phải mở cổng cho phiên này trước.
  // Tài khoản chưa đặt PIN thì `openGate` nhận BẤT KỲ PIN 4 số (server/services/parentService.ts:24).
  const gate = await call('POST', '/api/parent/gate', { pin: '1111' });
  console.log('GATE', gate.status, gate.text.slice(0, 120));

  // Đọc lại BÁO CÁO qua API để XÁC NHẬN dữ liệu đã vào (không đoán).
  const rep = await call('GET', `/api/children/${encodeURIComponent(childId)}/report`);
  if (rep.status === 200) {
    const d = rep.json?.data ?? {};
    console.log('REPORT', JSON.stringify({
      wordsLearned: d.wordsLearned,
      wordsMastered: d.wordsMastered,
      lessonsCompleted: d.lessonsCompleted,
      starsEarned: d.starsEarned,
      dailyStats: (d.dailyStats ?? []).map((x) => `${x.date}:${x.wordsLearned}`),
      struggling: (d.strugglingWords ?? []).map((w) => w.en),
      mastered: (d.masteredWords ?? []).map((w) => w.en),
    }));
  } else {
    console.log('REPORT', rep.status, rep.text.slice(0, 200));
  }
}

main().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(1);
});
