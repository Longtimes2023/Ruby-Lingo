#!/usr/bin/env node
/**
 * audit.mjs — RubyLingo T082: kiểm a11y + responsive bằng SỐ ĐO THẬT trên DOM.
 *
 * ⭐ VÌ SAO PHẢI VIẾT TỆP NÀY (không phải "tự viết lại" các script của skill):
 *   Các script có sẵn (`shoot_device.js`, `contrast_probe.js`, `clickable_audit.js`, `probe_dom.js`)
 *   đều spawn Chrome với profile tạm RIÊNG cho từng lần chạy và KHÔNG hỗ trợ cookie phiên.
 *   Mọi màn hình của bé (bản đồ, flashcard, game, nhà thú, nhiệm vụ, bộ sưu tập, hồ sơ) đều
 *   nằm SAU `RequireChild` ⇒ không script nào đo được chúng.
 *
 *   Tệp này KHÔNG phát minh thuật toán mới: phần đo độ tương phản sao chép NGUYÊN VĂN công thức
 *   WCAG trong `contrast_probe.js`, phần emulate thiết bị dùng đúng
 *   `Emulation.setDeviceMetricsOverride` như `shoot_device.js` (Bẫy 9 của skill).
 *
 * CÁCH DÙNG:
 *   node audit.mjs --base http://localhost:4310 --email <e> --password <p> --out <dir>
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const BASE = arg('base', 'http://localhost:4310');
const EMAIL = arg('email');
const PASSWORD = arg('password');
const OUT = arg('out', path.join(os.tmpdir(), 'rl-audit'));
const NOLOGIN = process.argv.includes('--nologin');
const PARENT_VIEWS = process.argv.includes('--parent-views');
const PORT = 9600 + (process.pid % 300);

fs.mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => p && fs.existsSync(p));
if (!CHROME) {
  console.error('KHONG TIM THAY chrome.exe');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Đo trên DOM thật (một biểu thức JS chạy trong trang)
// ---------------------------------------------------------------------------
const MEASURE = `(() => {
  const root = document.documentElement;
  const cs0 = getComputedStyle(root);
  const touch = parseFloat(cs0.getPropertyValue('--sp-touch')) || 64;
  const touchLg = parseFloat(cs0.getPropertyValue('--sp-touch-lg')) || 88;
  const vw = root.clientWidth;
  const sw = root.scrollWidth;

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function pth(el) {
    const bits = [];
    let n = el;
    for (let i = 0; i < 4 && n && n.nodeType === 1; i++) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; bits.unshift(s); break; }
      if (n.classList && n.classList.length) s += '.' + [...n.classList].slice(0, 3).join('.');
      bits.unshift(s);
      n = n.parentElement;
    }
    return bits.join(' > ');
  }
  function nm(el) {
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t) return t.slice(0, 50);
    const ti = el.getAttribute('title');
    if (ti && ti.trim()) return ti.trim();
    const img = el.querySelector('img[alt]');
    if (img && (img.getAttribute('alt') || '').trim()) return img.getAttribute('alt').trim();
    return '';
  }

  const overflow = { clientWidth: vw, scrollWidth: sw, deltaPx: sw - vw, offenders: [] };
  if (sw > vw + 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        overflow.offenders.push({ sel: pth(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
      if (overflow.offenders.length >= 12) break;
    }
  }

  const INTER = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab], [role=checkbox], [role=radio]';
  const small = [];
  const seenEl = new Set();
  for (const el of document.querySelectorAll(INTER)) {
    if (!visible(el)) continue;
    if (seenEl.has(el)) continue;
    seenEl.add(el);
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    const mn = Math.min(w, h);
    if (mn < touch) small.push({ sel: pth(el), tag: el.tagName.toLowerCase(), w, h, min: mn, text: nm(el).slice(0, 40) });
  }

  // Nut CHINH = nen la mau thuong hieu --c-brand (nut primary cua BigButton). Quy uoc >= 88px.
  function hexToRgb(h) {
    h = String(h).trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
  }
  const brandRgb = hexToRgb(cs0.getPropertyValue('--c-brand') || '#c81e63');
  const primary = [];
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
    if (!visible(el)) continue;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg !== brandRgb) continue;
    const r = el.getBoundingClientRect();
    primary.push({ sel: pth(el), w: Math.round(r.width), h: Math.round(r.height), text: nm(el).slice(0, 36) });
  }

  const tiny = [];
  for (const el of document.querySelectorAll('body *')) {
    let txt = '';
    for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue;
    txt = txt.replace(/\\s+/g, ' ').trim();
    if (!txt) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (fs < 16) tiny.push({ sel: pth(el), px: fs, text: txt.slice(0, 40) });
  }

  const noName = [];
  for (const el of document.querySelectorAll('a[href], button, [role=button]')) {
    if (!visible(el)) continue;
    if (!nm(el)) noName.push({ sel: pth(el), html: el.outerHTML.slice(0, 100) });
  }
  const imgNoAlt = [];
  for (const el of document.querySelectorAll('img')) {
    if (!visible(el)) continue;
    // CHI thieu HAN thuoc tinh alt moi la loi. alt rong ("") la cach DUNG de danh dau anh trang tri.
    const hasAltAttr = el.hasAttribute('alt');
    const hidden = el.getAttribute('aria-hidden') === 'true' || !!el.closest('[aria-hidden="true"]');
    if (!hasAltAttr && !hidden) imgNoAlt.push({ sel: pth(el), src: (el.getAttribute('src') || '').slice(-70) });
  }
  const switchNoChecked = [];
  for (const el of document.querySelectorAll('[role=switch]')) {
    if (!el.hasAttribute('aria-checked')) switchNoChecked.push({ sel: pth(el) });
  }
  const headingOrderIssues = [];
  let prev = 0;
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (!visible(el)) continue;
    const lvl = parseInt(el.tagName[1], 10);
    if (prev && lvl > prev + 1) headingOrderIssues.push('nhay cap h' + prev + ' -> h' + lvl + ': ' + (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30));
    prev = lvl;
  }
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((e) => e.tagName.toLowerCase());

  return { url: location.pathname + location.search, overflow, touch, touchLg, small, primary, tiny, noName, imgNoAlt, switchNoChecked, headingOrderIssues, headingCount: headings.length };
})()`;

// Sao chep NGUYEN VAN thuat toan tu contrast_probe.js cua skill web-audit-chrome-headless.
const CONTRAST = `(() => {
  function parseColor(c) {
    if (!c) return null;
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    if (p.length < 3 || p.some((n) => isNaN(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(fg, bg) { const a = fg.a === undefined ? 1 : fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }; }
  function lum(c) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); }
  function effBg(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0.05) return bg;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  function visible(el) { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; if (parseFloat(cs.opacity) < 0.05) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; }
  function pth(el) { const bits = []; let n = el; for (let i = 0; i < 4 && n && n.nodeType === 1; i++) { let s = n.tagName.toLowerCase(); if (n.id) { s += '#' + n.id; bits.unshift(s); break; } if (n.classList && n.classList.length) s += '.' + [...n.classList].slice(0, 3).join('.'); bits.unshift(s); n = n.parentElement; } return bits.join(' > '); }

  const out = [];
  const seen = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    let txt = '';
    for (const n of el.childNodes) if (n.nodeType === 3) txt += n.nodeValue;
    txt = txt.replace(/\\s+/g, ' ').trim();
    if (!txt) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const bg = effBg(el);
    if (!bg) continue;
    let fg = parseColor(cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color);
    if (!fg) fg = parseColor(cs.color);
    if (!fg) continue;
    const fgc = over(fg, bg);
    const fs = parseFloat(cs.fontSize) || 16;
    const fw = parseInt(cs.fontWeight, 10) || 400;
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const need = large ? 3.0 : 4.5;
    const r = ratio(fgc, bg);
    if (r < need) {
      const key = pth(el) + '|' + txt.slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sel: pth(el), text: txt.slice(0, 50), color: 'rgb(' + Math.round(fgc.r) + ',' + Math.round(fgc.g) + ',' + Math.round(fgc.b) + ')', bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')', ratio: Math.round(r * 100) / 100, need, fontSize: fs });
    }
  }
  out.sort((a, b) => a.ratio - b.ratio);
  return out.slice(0, 120);
})()`;

// ---------------------------------------------------------------------------
// CDP toi gian
// ---------------------------------------------------------------------------
let id = 0;
const pend = new Map();
let ws;
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pend.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pend.has(i)) { pend.delete(i); reject(new Error('Timeout CDP: ' + method)); }
    }, 30000);
  });

async function evaluate(expr, sessionId) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error('Loi JS: ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
}

const VIEWPORTS = [
  { key: 'phone-360x640', width: 360, height: 640, mobile: true },
  { key: 'ipad-820x1180', width: 820, height: 1180, mobile: true },
  { key: 'laptop-1280x720', width: 1280, height: 720, mobile: false },
];

const PUBLIC_ROUTES = ['/login', '/signup', '/reset', '/trang-khong-ton-tai'];
// ⚠️ `lessonId` CUA DU AN CHUA DAU `/` ("at-the-zoo/z1") ⇒ PHAI ma hoa `%2F`, neu khong
//    React Router khong khop route va man hinh roi vao NotFoundPage. Xem src/lib/paths.ts.
const L1 = 'at-the-zoo%2Fz1';
const CHILD_ROUTES = [
  '/',
  '/theme/at-the-zoo',
  `/lesson/${L1}/flashcards`,
  `/lesson/${L1}/game/listen-tap`,
  `/lesson/${L1}/game/memory-match`,
  '/quests',
  '/pet',
  '/collection',
  '/profile',
  '/parent',
];
// Cac route chay them phep thu ban phim (Tab).
const KEYBOARD_ROUTES = ['/', `/lesson/${L1}/game/listen-tap`, '/quests'];

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-audit-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--no-proxy-server', '--hide-scrollbars', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch { /* da tat */ } });

  let ver = null;
  for (let i = 0; i < 60; i++) {
    try { ver = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); break; }
    catch { await sleep(300); }
  }
  if (!ver) throw new Error('Chrome khong mo cong ' + PORT);

  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);

  async function nav(url) {
    await send('Page.navigate', { url }, sessionId);
    // Cho React mount that su (Vite dev transform module theo nhu cau => lan dau cham hon).
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const ok = await evaluate(
        "!!(document.querySelector('#root') && document.querySelector('#root').childElementCount > 0)",
        sessionId,
      ).catch(() => false);
      if (ok) break;
    }
    await sleep(1400);
  }

  // --- Dang nhap qua API de Chrome nhan cookie phien (HttpOnly) ---
  if (!NOLOGIN) {
    await nav(BASE + '/login');
    const login = await evaluate(`(async () => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} }) });
      return { status: r.status, body: (await r.text()).slice(0, 120) };
    })()`, sessionId);
    console.log('LOGIN:', JSON.stringify(login));
  } else {
    console.log('NOLOGIN: bo qua dang nhap (chi kiem trang cong khai)');
  }

  const results = [];
  const allRoutes = NOLOGIN
    ? PUBLIC_ROUTES.map((p) => ({ p, kind: 'public' }))
    : [...PUBLIC_ROUTES.map((p) => ({ p, kind: 'public' })), ...CHILD_ROUTES.map((p) => ({ p, kind: 'child' }))];

  // --- Phep thu ban phim: Tab N lan, ghi lai phan tu nhan focus + dau hieu focus ---
  async function tabProbe(n) {
    await evaluate("document.activeElement && document.activeElement.blur(); document.body.focus(); true", sessionId);
    const seq = [];
    for (let i = 0; i < n; i++) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sessionId);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sessionId);
      await sleep(60);
      const info = await evaluate(`(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return { tag: 'body' };
        const cs = getComputedStyle(a);
        const r = a.getBoundingClientRect();
        return {
          tag: a.tagName.toLowerCase(),
          name: (a.getAttribute('aria-label') || a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28),
          outline: cs.outlineStyle + ' ' + cs.outlineWidth,
          boxShadow: cs.boxShadow === 'none' ? 'none' : 'co',
          borderColor: cs.borderTopColor,
          w: Math.round(r.width), h: Math.round(r.height),
        };
      })()`, sessionId);
      seq.push(info);
    }
    return seq;
  }

  // -------------------------------------------------------------------------
  // CHE DO --parent-views: do man BAO CAO va CAI DAT nam SAU cong PIN.
  //
  // ⭐ VI SAO PHAI CO: `/parent` KHONG co route rieng cho bao cao / cai dat — chung chi la `view`
  //    trong state cua `ParentGatePage` (xem ParentGatePage.tsx:96, 381, 391). Vi vay luot audit
  //    T082 dau tien chi do duoc MAN NHAP PIN, khong cham toi hai man that su nam sau cong.
  //
  // ⭐ MO CONG THE NAO: tai khoan MOI chua co PIN thi `openGate` chap nhan BAT KY PIN 4 so hop le
  //    (xem server/services/parentService.ts:24). Nen `POST /api/parent/gate` voi pin "1111" la mo
  //    duoc cong cho PHIEN dang nhap nay — khong can dat PIN truoc (PATCH /pin lai bi chinh cong chan).
  // -------------------------------------------------------------------------
  async function auditParentViews() {
    async function setDevice(vp) {
      await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile }, sessionId);
      await send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: vp.mobile ? 5 : 1 }, sessionId);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, sessionId);
    }

    /**
     * Đo MỘT view trong `/parent`: nạp trang, (tuỳ chọn) bấm nút theo CHỮ HIỆN TRÊN MÀN, rồi đo.
     * `label === null` = view MẶC ĐỊNH của trang, không có nút nào để bấm.
     */
    async function measureView(vp, { key, label = null, settle = 1600 }) {
      await nav(BASE + '/parent');
      const clicked =
        label === null
          ? true
          : await evaluate(`(() => {
              const b = [...document.querySelectorAll('button, a[href]')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(label)}));
              if (!b) return false;
              b.click();
              return true;
            })()`, sessionId);
      await sleep(settle);
      const rendered = await evaluate("document.body.innerText.replace(/\\s+/g,' ').slice(0, 220)", sessionId);
      // Cac cot bieu do mang role=img + aria-label (ParentReport.tsx:201-207) — bang chung rang buoc
      // "bieu do phai doc duoc", do CHINH chung chu khong suy doan.
      const chartBars = await evaluate("[...document.querySelectorAll('[role=img][aria-label]')].map((e) => e.getAttribute('aria-label'))", sessionId);
      // Do RIENG thanh truot: hop cua `input[type=range]` CHINH LA VUNG CHAM.
      const sliders = await evaluate(`[...document.querySelectorAll('input[type=range]')].map((el) => {
        const r = el.getBoundingClientRect();
        const lab = el.closest('label');
        const lr = lab ? lab.getBoundingClientRect() : null;
        return { w: Math.round(r.width), h: Math.round(r.height), labelW: lr ? Math.round(lr.width) : null, labelH: lr ? Math.round(lr.height) : null, name: el.getAttribute('aria-label') || '' };
      })`, sessionId);
      const m = await evaluate(MEASURE, sessionId);
      const contrast = await evaluate(CONTRAST, sessionId);
      // THU NGHIEM KHONG PHA HOAI: ap thu ban va `h-14` (56px) len thanh truot NGAY TRONG DOM,
      // do lai, roi tra ve nguyen trang. Muc dich: biet ban va co LAM THAY DOI BO CUC khong —
      // neu co thi day la quyet dinh THIET KE (phai bao cao), khong phai loi nho sua ngay.
      const fixProbe =
        key === 'parent-settings'
          ? await evaluate(`(() => {
              const el = document.querySelector('input[type=range]');
              if (!el) return null;
              const lab = el.closest('label');
              const before = { input: Math.round(el.getBoundingClientRect().height), label: Math.round(lab.getBoundingClientRect().height) };
              el.style.height = '56px';
              const after = { input: Math.round(el.getBoundingClientRect().height), label: Math.round(lab.getBoundingClientRect().height) };
              el.style.height = '';
              return { before, after, deltaLabel: after.label - before.label };
            })()`, sessionId)
          : undefined;
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
      fs.writeFileSync(path.join(OUT, vp.key + '__' + key + '.png'), Buffer.from(shot.data, 'base64'));
      const kb = await tabProbe(24);
      results.push({ viewport: vp.key, route: '/parent#' + key, kind: 'parent', landed: await evaluate('location.pathname', sessionId), clicked, rendered, chartBars, sliders, fixProbe, ...m, contrast, kb });
      const bad = [];
      if (!clicked) bad.push('KHONG BAM DUOC NUT');
      if (m.overflow.deltaPx > 1) bad.push('OVERFLOW ' + m.overflow.deltaPx + 'px');
      if (m.small.length) bad.push('touch< ' + m.small.length);
      if (m.tiny.length) bad.push('font<16 ' + m.tiny.length);
      if (m.noName.length) bad.push('noname ' + m.noName.length);
      if (m.imgNoAlt.length) bad.push('imgNoAlt ' + m.imgNoAlt.length);
      if (m.switchNoChecked.length) bad.push('switchNoChecked ' + m.switchNoChecked.length);
      if (m.headingOrderIssues.length) bad.push('heading ' + m.headingOrderIssues.length);
      if (contrast.length) bad.push('contrast ' + contrast.length);
      console.log(`[${vp.key}] ${key} clicked=${clicked} ${bad.length ? '⚠ ' + bad.join(', ') : 'OK'}`);
    }

    // --- (1) CỔNG ĐÓNG: màn nhập PIN + màn "Quên mã PIN" -------------------
    // PHẢI chạy TRƯỚC khi mở cổng: `view='forgot'` CHỈ render khi `gate === 'closed'`
    // (ParentGatePage.tsx:308) — mà cổng là trạng thái GẮN PHIÊN ở phía server.
    for (const vp of VIEWPORTS) {
      await setDevice(vp);
      await measureView(vp, { key: 'parent-gate' });
      await measureView(vp, { key: 'parent-forgot', label: 'Quên mã PIN', settle: 900 });
    }

    // --- (2) MỞ CỔNG (một lần cho cả phiên) --------------------------------
    // Tài khoản CHƯA đặt PIN thì `openGate` nhận BẤT KỲ PIN 4 số hợp lệ
    // (server/services/parentService.ts:24) — nên không phải đặt PIN trước
    // (`PATCH /pin` lại bị chính cổng chặn).
    const gate = await evaluate(`(async () => {
      const r = await fetch('/api/parent/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1111' }) });
      return { status: r.status, body: (await r.text()).slice(0, 200) };
    })()`, sessionId);
    console.log('GATE OPEN:', JSON.stringify(gate));

    // --- (3) CỔNG MỞ: khu vực phụ huynh · báo cáo · cài đặt ----------------
    for (const vp of VIEWPORTS) {
      await setDevice(vp);
      await measureView(vp, { key: 'parent-open' });
      await measureView(vp, { key: 'parent-report', label: 'Xem báo cáo tuần', settle: 2500 });
      await measureView(vp, { key: 'parent-settings', label: 'Mở cài đặt', settle: 2000 });
    }

    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
    console.log('XONG (parent-views). results.json + ' + results.length + ' anh tai ' + OUT);
    try { await send('Browser.close'); } catch { /* ignore */ }
    await sleep(500);
    try { chrome.kill(); } catch { /* ignore */ }
  }

  if (PARENT_VIEWS) {
    await auditParentViews();
    return;
  }

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: vp.mobile ? 5 : 1 }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, sessionId);

    for (const { p, kind } of allRoutes) {
      await nav(BASE + p);
      const landed = await evaluate('location.pathname', sessionId);
      const m = await evaluate(MEASURE, sessionId);
      const contrast = await evaluate(CONTRAST, sessionId);
      const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const pretty = decodeURIComponent(p);
      const file = path.join(OUT, vp.key + '__' + (pretty === '/' ? 'home' : pretty.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')) + '.png');
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const kb = KEYBOARD_ROUTES.includes(p) ? await tabProbe(22) : undefined;
      const rec = { viewport: vp.key, route: p, kind, landed, ...m, contrast, kb };
      results.push(rec);
      const bad = [];
      if (m.overflow.deltaPx > 1) bad.push('OVERFLOW ' + m.overflow.deltaPx + 'px');
      if (m.small.length) bad.push('touch< ' + m.small.length);
      if (m.tiny.length) bad.push('font<16 ' + m.tiny.length);
      if (m.noName.length) bad.push('noname ' + m.noName.length);
      if (m.imgNoAlt.length) bad.push('imgNoAlt ' + m.imgNoAlt.length);
      if (m.switchNoChecked.length) bad.push('switchNoChecked ' + m.switchNoChecked.length);
      if (m.headingOrderIssues.length) bad.push('heading ' + m.headingOrderIssues.length);
      if (contrast.length) bad.push('contrast ' + contrast.length);
      console.log(`[${vp.key}] ${p} -> ${landed} ${bad.length ? '⚠ ' + bad.join(', ') : 'OK'}`);
    }
  }

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('XONG. results.json + ' + results.length + ' anh tai ' + OUT);
  try { await send('Browser.close'); } catch { /* ignore */ }
  await sleep(500);
  try { chrome.kill(); } catch { /* ignore */ }
}

main().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
