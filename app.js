'use strict';

/* =========================================================
 * 儲存
 * ======================================================= */
const STORE_KEY = 'intervalTimer.v1';
const DEFAULTS = {
  config: { work: 30, rest: 15, exercises: 8, rounds: 1, reset: 10 },
  prep: 5,
  sound: true,
  voice: true,
  saved: [],   // { id, name, config, at }
  recent: [],  // { config, at }
};

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && typeof raw === 'object') {
      return { ...DEFAULTS, ...raw, config: { ...DEFAULTS.config, ...raw.config } };
    }
  } catch (_) { /* 無法讀取時用預設值 */ }
  return structuredClone(DEFAULTS);
}
const store = loadStore();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {}
}

/* =========================================================
 * 工具
 * ======================================================= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const pad = (n) => String(n).padStart(2, '0');

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function fmtShort(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s} 秒`;
  return s ? `${m} 分 ${s} 秒` : `${m} 分`;
}

function totalSeconds(c) {
  const perRound = c.exercises * c.work + (c.exercises - 1) * c.rest;
  return c.rounds * perRound + (c.rounds - 1) * c.reset;
}
function summary(c) {
  return `運動 ${fmt(c.work)} · 休息 ${fmt(c.rest)} · ${c.exercises} 動作 × ${c.rounds} 組 · 共 ${fmt(totalSeconds(c))}`;
}
const configKey = (c) => [c.work, c.rest, c.exercises, c.rounds, c.reset].join('-');

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* =========================================================
 * 主畫面
 * ======================================================= */
const FIELDS = {
  work:      { title: '運動時間',   type: 'time',  min: 1, presets: [10, 20, 30, 40, 45, 60, 90, 120] },
  rest:      { title: '休息時間',   type: 'time',  min: 0, presets: [0, 5, 10, 15, 20, 30, 45, 60] },
  exercises: { title: '動作數',     type: 'count', min: 1, max: 99, presets: [4, 6, 8, 10, 12] },
  rounds:    { title: '組數',       type: 'count', min: 1, max: 99, presets: [1, 2, 3, 4, 5] },
  reset:     { title: '組間休息',   type: 'time',  min: 0, presets: [0, 10, 15, 30, 45, 60, 90, 120] },
};

function renderHome() {
  const c = store.config;
  $('[data-value="work"]').textContent = fmt(c.work);
  $('[data-value="rest"]').textContent = fmt(c.rest);
  $('[data-value="exercises"]').textContent = c.exercises;
  $('[data-value="rounds"]').textContent = `${c.rounds}X`;
  $('[data-value="reset"]').textContent = fmt(c.reset);
  $('#totalTime').textContent = fmt(totalSeconds(c));
  $('#prepVal').textContent = store.prep ? `${store.prep} 秒` : '關閉';
  $('#soundToggle').checked = store.sound;
  $('#voiceToggle').checked = store.voice;
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

/* =========================================================
 * 底部面板 / 滾輪選擇器
 * ======================================================= */
const ITEM_H = 52;
let sheetOnDone = null;

function openSheet(title, bodyEl, onDone, { showDone = true } = {}) {
  $('#sheetTitle').textContent = title;
  const body = $('#sheetBody');
  body.replaceChildren(bodyEl);
  $('#sheetDone').hidden = !showDone;
  sheetOnDone = onDone;
  $('#backdrop').classList.add('show');
  $('#sheet').classList.add('show');
  // 等版面算好後，把滾輪捲到目前數值
  requestAnimationFrame(() => body.querySelectorAll('.wheel').forEach((w) => w._sync && w._sync()));
}
function closeSheet() {
  $('#sheet').classList.remove('show');
  if (!$('#drawer').classList.contains('show')) $('#backdrop').classList.remove('show');
  sheetOnDone = null;
}

function makeWheel(values, current, label) {
  const col = document.createElement('div');
  col.className = 'wheel-col';
  const wheel = document.createElement('div');
  wheel.className = 'wheel';
  const top = document.createElement('div'); top.className = 'pad';
  const bot = document.createElement('div'); bot.className = 'pad';
  wheel.append(top);
  values.forEach((v, i) => {
    const it = document.createElement('div');
    it.className = 'item';
    it.textContent = label.format(v);
    it.addEventListener('click', () => wheel.scrollTo({ top: i * ITEM_H, behavior: 'smooth' }));
    wheel.append(it);
  });
  wheel.append(bot);
  col.append(wheel);
  if (label.unit) {
    const u = document.createElement('span');
    u.className = 'wheel-unit';
    u.textContent = label.unit;
    col.append(u);
  }

  const idxOf = (v) => Math.max(0, values.indexOf(v));
  wheel._sync = () => { wheel.scrollTop = idxOf(current) * ITEM_H; };
  wheel.getValue = () => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(wheel.scrollTop / ITEM_H)));
    return values[i];
  };
  wheel.setValue = (v, smooth = true) => {
    current = v;
    wheel.scrollTo({ top: idxOf(v) * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
  };
  let t;
  wheel.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => wheel.dispatchEvent(new CustomEvent('settle')), 120);
  });
  return { col, wheel };
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function editField(field) {
  const def = FIELDS[field];
  const cur = store.config[field];
  const wrap = document.createElement('div');
  const picker = document.createElement('div');
  picker.className = 'picker';
  wrap.append(picker);

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue({ work: '--work-fg', rest: '--rest-fg', exercises: '--ex-fg', rounds: '--rnd-fg', reset: '--rst-fg' }[field]);
  wrap.style.setProperty('--accent', accent.trim());

  let read, apply;
  if (def.type === 'time') {
    const m = makeWheel(range(0, 59), Math.floor(cur / 60), { format: pad, unit: '分' });
    const s = makeWheel(range(0, 59), cur % 60, { format: pad, unit: '秒' });
    picker.append(m.col, s.col);
    read = () => m.wheel.getValue() * 60 + s.wheel.getValue();
    apply = (v) => { m.wheel.setValue(Math.floor(v / 60)); s.wheel.setValue(v % 60); };
  } else {
    const w = makeWheel(range(def.min, def.max), cur, { format: String, unit: field === 'rounds' ? '組' : '個' });
    picker.append(w.col);
    read = () => w.wheel.getValue();
    apply = (v) => w.wheel.setValue(v);
  }

  const chips = document.createElement('div');
  chips.className = 'chips';
  const chipEls = def.presets.map((v) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.dataset.v = v;
    b.textContent = def.type === 'time' ? (v ? fmt(v) : '不休息') : (field === 'rounds' ? `${v} 組` : `${v} 個`);
    b.addEventListener('click', () => apply(v));
    chips.append(b);
    return b;
  });
  wrap.append(chips);

  const hint = document.createElement('p');
  hint.className = 'sheet-hint';
  wrap.append(hint);
  const refresh = () => {
    const v = read();
    chipEls.forEach((b) => b.classList.toggle('on', +b.dataset.v === v));
    if (def.type === 'time') hint.textContent = v < def.min ? `最少 ${def.min} 秒` : fmtShort(v) || '';
    else hint.textContent = '';
  };
  picker.addEventListener('settle', refresh, true);
  requestAnimationFrame(() => requestAnimationFrame(refresh));

  openSheet(def.title, wrap, () => {
    let v = read();
    if (v < def.min) v = def.min;
    store.config[field] = v;
    persist();
    renderHome();
  });
}

/* ---------- 載入先前的訓練 ---------- */
const TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

function openLoad() {
  const wrap = document.createElement('div');
  const build = () => {
    wrap.replaceChildren();
    const section = (title, items, kind) => {
      const h = document.createElement('div');
      h.className = 'list-title';
      h.textContent = title;
      wrap.append(h);
      if (!items.length) {
        const e = document.createElement('div');
        e.className = 'empty';
        e.textContent = kind === 'saved' ? '還沒有儲存的訓練（從左上角選單儲存）' : '還沒有紀錄';
        wrap.append(e);
        return;
      }
      items.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'w-item';
        const main = document.createElement('button');
        main.className = 'w-main';
        const name = document.createElement('div');
        name.className = 'w-name';
        name.textContent = kind === 'saved' ? it.name : new Date(it.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const sum = document.createElement('div');
        sum.className = 'w-sum';
        sum.textContent = summary(it.config);
        main.append(name, sum);
        main.addEventListener('click', () => {
          store.config = { ...it.config };
          persist();
          renderHome();
          closeSheet();
          toast(kind === 'saved' ? `已載入「${it.name}」` : '已載入訓練');
        });
        const del = document.createElement('button');
        del.className = 'w-del';
        del.setAttribute('aria-label', '刪除');
        del.innerHTML = TRASH;
        del.addEventListener('click', () => {
          store[kind].splice(i, 1);
          persist();
          build();
        });
        row.append(main, del);
        wrap.append(row);
      });
    };
    section('已儲存的訓練', store.saved, 'saved');
    section('最近使用', store.recent, 'recent');
  };
  build();
  openSheet('載入訓練', wrap, null, { showDone: false });
}

/* ---------- 準備倒數 ---------- */
function editPrep() {
  const wrap = document.createElement('div');
  const picker = document.createElement('div');
  picker.className = 'picker';
  const w = makeWheel(range(0, 30), store.prep, { format: String, unit: '秒' });
  picker.append(w.col);
  const p = document.createElement('p');
  p.className = 'sheet-hint';
  p.textContent = '按下開始後，先倒數幾秒讓你就位（0 = 不倒數）';
  wrap.append(picker, p);
  openSheet('準備倒數', wrap, () => {
    store.prep = w.wheel.getValue();
    persist();
    renderHome();
  });
}

/* =========================================================
 * 聲音 / 語音 / 螢幕常亮
 * ======================================================= */
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // iOS 需要在使用者操作時播放一次聲音才能解鎖
    const b = audioCtx.createBuffer(1, 1, 22050);
    const s = audioCtx.createBufferSource();
    s.buffer = b; s.connect(audioCtx.destination); s.start(0);
  } catch (_) {}
  if (store.voice && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function beep(freq = 880, dur = 0.15, vol = 0.5) {
  if (!store.sound || !audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (_) {}
}

let zhVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  zhVoice = vs.find((v) => /zh[-_]TW/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}
function say(text) {
  if (!store.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = zhVoice ? zhVoice.lang : 'zh-TW';
    if (zhVoice) u.voice = zhVoice;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (_) {}
}

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (_) {}
}

/* =========================================================
 * 計時引擎
 * ======================================================= */
const PHASE_NAME = { prep: '準備', work: '運動', rest: '休息', reset: '組間休息' };

function buildSegments(c, prep) {
  const segs = [];
  if (prep > 0) segs.push({ type: 'prep', dur: prep, ex: 1, round: 1 });
  for (let r = 1; r <= c.rounds; r++) {
    for (let e = 1; e <= c.exercises; e++) {
      segs.push({ type: 'work', dur: c.work, ex: e, round: r });
      if (e < c.exercises && c.rest > 0) segs.push({ type: 'rest', dur: c.rest, ex: e, round: r });
    }
    if (r < c.rounds && c.reset > 0) segs.push({ type: 'reset', dur: c.reset, ex: c.exercises, round: r });
  }
  return segs;
}

const run = {
  config: null,
  segs: [],
  idx: 0,
  endAt: 0,       // 目前片段結束時間（performance.now 毫秒）
  remainMs: 0,    // 暫停時剩下的毫秒
  paused: false,
  active: false,
  lastSec: null,
  raf: 0,
  interval: 0,
};

const RING_LEN = 2 * Math.PI * 92;
$('#ringFg').style.strokeDasharray = RING_LEN;

function startWorkout(config = store.config) {
  unlockAudio();
  run.config = { ...config };
  run.segs = buildSegments(run.config, store.prep);
  run.idx = 0;
  run.paused = false;
  run.active = true;

  // 記錄到「最近使用」
  const key = configKey(run.config);
  store.recent = [{ config: { ...run.config }, at: Date.now() }, ...store.recent.filter((r) => configKey(r.config) !== key)].slice(0, 10);
  persist();

  $('#run').classList.remove('paused');
  showScreen('run');
  keepAwake(true);
  enterSegment(performance.now());
  loop();
}

function enterSegment(startAt) {
  const seg = run.segs[run.idx];
  run.endAt = startAt + seg.dur * 1000;
  run.lastSec = null;
  announce(seg);
  renderRun(true);
}

function announce(seg) {
  const el = $('#run');
  el.dataset.phase = seg.type;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');

  if (seg.type === 'work') {
    beep(1320, 0.45, 0.6);
    const last = seg.ex === run.config.exercises && run.config.exercises > 1;
    say(last ? '最後一個動作，開始' : '開始');
  } else if (seg.type === 'rest') {
    beep(660, 0.45, 0.6);
    say('休息');
  } else if (seg.type === 'reset') {
    beep(660, 0.45, 0.6);
    say(`第 ${seg.round} 組完成，組間休息`);
  } else if (seg.type === 'prep') {
    say('準備');
  }
}

function remainingTotal() {
  // 不含準備倒數的剩餘總秒數
  const curLeft = run.paused ? run.remainMs / 1000 : Math.max(0, (run.endAt - performance.now()) / 1000);
  let sum = run.segs[run.idx].type === 'prep' ? 0 : curLeft;
  for (let i = run.idx + 1; i < run.segs.length; i++) sum += run.segs[i].dur;
  return sum;
}

function renderRun(force = false) {
  const seg = run.segs[run.idx];
  const leftMs = run.paused ? run.remainMs : Math.max(0, run.endAt - performance.now());
  const leftSec = Math.ceil(leftMs / 1000 - 1e-6);

  // 最後 3 秒倒數提示音
  if (!run.paused && leftSec !== run.lastSec) {
    if (run.lastSec !== null && leftSec >= 1 && leftSec <= 3) {
      beep(880, 0.12, 0.5);
      if (seg.type === 'prep' || seg.dur >= 10) say(String(leftSec));
    }
    // 運動進行到一半時提醒（僅限較長的運動）
    if (seg.type === 'work' && seg.dur >= 30 && run.lastSec !== null && leftSec === Math.floor(seg.dur / 2)) say('一半了');
    run.lastSec = leftSec;
  }

  $('#runClock').textContent = fmt(leftSec);
  $('#runPhase').textContent = PHASE_NAME[seg.type];
  const c = run.config;
  $('#runExercise').textContent = `動作 ${seg.ex}/${c.exercises}`;
  $('#runRound').textContent = `第 ${seg.round}/${c.rounds} 組`;
  $('#runRemaining').textContent = `剩餘 ${fmt(Math.ceil(remainingTotal()))}`;

  const frac = seg.dur ? 1 - leftMs / (seg.dur * 1000) : 1;
  $('#ringFg').style.strokeDashoffset = RING_LEN * frac;

  if (force) {
    const nxt = run.segs[run.idx + 1];
    $('#runNext').textContent = nxt ? `下一個：${PHASE_NAME[nxt.type]} ${fmt(nxt.dur)}` : '最後一段，加油！';
  }
}

function tick() {
  if (!run.active || run.paused) return;
  const now = performance.now();
  let advanced = false;
  // 若 App 曾在背景，可能一次跨過好幾段；用時間戳追上
  while (now >= run.endAt) {
    if (run.idx >= run.segs.length - 1) { finish(); return; }
    const prevEnd = run.endAt;
    run.idx++;
    run.endAt = prevEnd + run.segs[run.idx].dur * 1000;
    run.lastSec = null;
    advanced = true;
  }
  if (advanced) announce(run.segs[run.idx]);
  renderRun(advanced);
}

function loop() {
  cancelAnimationFrame(run.raf);
  clearInterval(run.interval);
  const frame = () => { tick(); if (run.active) run.raf = requestAnimationFrame(frame); };
  run.raf = requestAnimationFrame(frame);
  run.interval = setInterval(tick, 250); // 保險：rAF 被節流時仍能推進
}

function togglePause() {
  if (!run.active) return;
  unlockAudio();
  if (run.paused) {
    run.paused = false;
    run.endAt = performance.now() + run.remainMs;
    $('#run').classList.remove('paused');
    keepAwake(true);
  } else {
    run.remainMs = Math.max(0, run.endAt - performance.now());
    run.paused = true;
    $('#run').classList.add('paused');
    say('暫停');
  }
  renderRun(true);
}

function jump(delta) {
  if (!run.active) return;
  const seg = run.segs[run.idx];
  const elapsed = seg.dur * 1000 - (run.paused ? run.remainMs : run.endAt - performance.now());
  let target = run.idx + delta;
  // 「上一段」：若本段已經過 3 秒以上，先回到本段開頭
  if (delta < 0 && elapsed > 3000) target = run.idx;
  if (target < 0) target = 0;
  if (target >= run.segs.length) { finish(); return; }
  run.idx = target;
  if (run.paused) {
    run.remainMs = run.segs[run.idx].dur * 1000;
    run.lastSec = null;
    $('#run').dataset.phase = run.segs[run.idx].type;
    renderRun(true);
  } else {
    enterSegment(performance.now());
  }
}

function stopWorkout() {
  run.active = false;
  cancelAnimationFrame(run.raf);
  clearInterval(run.interval);
  keepAwake(false);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function finish() {
  stopWorkout();
  beep(1046, 0.18, 0.6);
  setTimeout(() => beep(1318, 0.18, 0.6), 200);
  setTimeout(() => beep(1568, 0.5, 0.6), 400);
  say('訓練完成，做得好！');
  const c = run.config;
  $('#doneSummary').textContent = `${c.exercises} 個動作 × ${c.rounds} 組，共 ${fmt(totalSeconds(c))}`;
  showScreen('done');
}

/* =========================================================
 * 事件
 * ======================================================= */
$$('.row[data-field]').forEach((r) => r.addEventListener('click', () => editField(r.dataset.field)));
$('#loadBtn').addEventListener('click', openLoad);
$('#startBtn').addEventListener('click', () => startWorkout());

$('#sheetCancel').addEventListener('click', closeSheet);
$('#sheetDone').addEventListener('click', () => { const fn = sheetOnDone; closeSheet(); fn && fn(); });
$('#backdrop').addEventListener('click', () => { closeSheet(); closeDrawer(); });

$('#pauseBtn').addEventListener('click', togglePause);
$('#nextBtn').addEventListener('click', () => jump(1));
$('#prevBtn').addEventListener('click', () => jump(-1));
$('#stopBtn').addEventListener('click', () => {
  const wasPaused = run.paused;
  if (!wasPaused) togglePause();
  if (confirm('要結束這次訓練嗎？')) {
    stopWorkout();
    showScreen('home');
  } else if (!wasPaused) {
    togglePause();
  }
});
$('#againBtn').addEventListener('click', () => startWorkout(run.config));
$('#homeBtn').addEventListener('click', () => showScreen('home'));

// 側邊選單
function openDrawer() { $('#drawer').classList.add('show'); $('#backdrop').classList.add('show'); }
function closeDrawer() {
  $('#drawer').classList.remove('show');
  if (!$('#sheet').classList.contains('show')) $('#backdrop').classList.remove('show');
}
$('#menuBtn').addEventListener('click', openDrawer);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#saveBtn').addEventListener('click', () => {
  const c = store.config;
  const name = prompt('幫這個訓練取個名字：', `${c.exercises} 動作 × ${c.rounds} 組`);
  if (name === null) return;
  const n = name.trim() || `${c.exercises} 動作 × ${c.rounds} 組`;
  store.saved.unshift({ id: Date.now(), name: n, config: { ...c }, at: Date.now() });
  persist();
  closeDrawer();
  toast(`已儲存「${n}」`);
});
$('#openLoadBtn').addEventListener('click', () => { closeDrawer(); openLoad(); });
$('#prepBtn').addEventListener('click', () => { closeDrawer(); editPrep(); });
$('#soundToggle').addEventListener('change', (e) => { store.sound = e.target.checked; persist(); if (store.sound) { unlockAudio(); beep(); } });
$('#voiceToggle').addEventListener('change', (e) => { store.voice = e.target.checked; persist(); if (store.voice) say('語音已開啟'); });

// 回到前景時：重新取得螢幕常亮並追上時間
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && run.active) {
    if (!run.paused) keepAwake(true);
    if (audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
    tick();
  }
});

// 防止 iOS 雙擊縮放
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && !e.target.closest('.wheel')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

renderHome();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
