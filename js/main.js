// QuestHub main module
// Modern UI, EXP system, and two quests: MouseSnake (snake-like) and CheeseCatcher

'use strict';

// DOM refs
const dom = {
  views: {
    home: document.getElementById('view-home'),
    game: document.getElementById('view-game'),
    profile: document.getElementById('view-profile'),
  },
  gameRoot: document.getElementById('game-root'),
  xp: {
    total: document.getElementById('xp-total'),
    level: document.getElementById('xp-level'),
    bar: document.getElementById('xp-progress-bar'),
    toast: document.getElementById('xp-toast'),
  },
  buttons: {
    playMouseSnake: document.getElementById('play-mouse-snake'),
    playCheeseCatcher: document.getElementById('play-cheese-catcher'),
    playHideCat: document.getElementById('play-hide-cat'),
    back: document.getElementById('back-to-home'),
    pause: document.getElementById('pause-btn'),
    resume: document.getElementById('resume-btn'),
  },
  title: {
    icon: document.querySelector('.title-icon'),
    text: document.getElementById('game-title'),
  }
};

// Utils
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
// Canvas helper (shared)
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}

// Shared SVG flask icon (colored via fillStyle)
const FLASK_SVG_PATH = "M5 19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1c0-.21-.07-.41-.18-.57L13 8.35V4h-2v4.35L5.18 18.43c-.11.16-.18.36-.18.57m1 3a3 3 0 0 1-3-3c0-.6.18-1.16.5-1.63L9 7.81V6a1 1 0 0 1-1-1V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1v1.81l5.5 9.56c.32.47.5 1.03.5 1.63a3 3 0 0 1-3 3zm7-6l1.34-1.34L16.27 18H7.73l2.66-4.61zm-.5-4a.5.5 0 0 1 .5.5a.5.5 0 0 1-.5.5a.5.5 0 0 1-.5-.5a.5.5 0 0 1 .5-.5";
let FLASK_PATH2D = null;
try { FLASK_PATH2D = new Path2D(FLASK_SVG_PATH); } catch { FLASK_PATH2D = null; }

function drawFlaskIcon(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.translate(x, y);
  const sx = w / 24;
  const sy = h / 24;
  ctx.scale(sx, sy);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.98;
  if (FLASK_PATH2D) {
    ctx.fill(FLASK_PATH2D);
  } else {
    // Fallback: simple rounded rect
    ctx.beginPath();
    ctx.rect(0, 0, 24, 24);
    ctx.fill();
  }
  ctx.restore();
}

// EXP System
const XP_STORE_KEY = 'questhub:xp:v1';
const StorageSafe = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  }
};

const XP = (() => {
  let total = StorageSafe.get(XP_STORE_KEY, 0);

  function xpNeedForLevel(level) {
    // Linear progression: 100, 150, 200, ...
    return 100 + 50 * (level - 1);
  }

  function levelFromXP(xp) {
    let level = 1;
    let rem = xp;
    while (true) {
      const need = xpNeedForLevel(level);
      if (rem >= need) { rem -= need; level++; }
      else return { level, into: rem, need };
    }
  }

  function add(amount, reason = '') {
    if (!amount || amount <= 0) return 0;
    total += amount;
    StorageSafe.set(XP_STORE_KEY, total);
    updateUI();
    toast(`+${amount} EXP${reason ? ' · ' + reason : ''}`);
    return amount;
  }

  function getTotal() { return total; }

  function updateUI() {
    const { level, into, need } = levelFromXP(total);
    dom.xp.total.textContent = String(total);
    dom.xp.level.textContent = String(level);
    const pct = need ? Math.round((into / need) * 100) : 0;
    dom.xp.bar.style.width = pct + '%';
  }

  let toastTimer = null;
  function toast(msg) {
    const el = dom.xp.toast;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  updateUI();

  return { add, getTotal, levelFromXP };
})();

// ============================
// Profile: last plays storage and modal
// ============================
const PROFILE_STORE_KEY = 'questhub:profile:last:v1';
const Profile = (() => {
  function getPlays() {
    return StorageSafe.get(PROFILE_STORE_KEY, []);
  }
  function addPlay(snap) {
    try {
      const arr = getPlays();
      arr.unshift({ ...snap, ts: Date.now() });
      const trimmed = arr.slice(0, 6);
      StorageSafe.set(PROFILE_STORE_KEY, trimmed);
    } catch {}
  }
  function openModal() {
    const plays = getPlays();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const wrap = document.createElement('div');
    wrap.className = 'status-card';
    wrap.innerHTML = `
      <h3>Профиль</h3>
      <p>Последние игры и места смерти</p>
      <div id="pf-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap:12px; margin-top:8px"></div>
      <div style="display:flex; gap:10px; justify-content:flex-end">
        <button class="btn" id="pf-close">Закрыть</button>
      </div>
    `;
    overlay.appendChild(wrap);
    function drawSnap(canvas, snap) {
      const ctx = canvas.getContext('2d');
      const cols = snap.cols || 32;
      const rows = snap.rows || 24;
      const pad = 8;
      const cw = canvas.width = 220;
      const ch = canvas.height = 160;
      const cellW = (cw - pad * 2) / cols;
      const cellH = (ch - pad * 2) / rows;
      ctx.clearRect(0,0,cw,ch);
      // bg
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0,0,cw,ch);
      // grid faint
      ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let x = 0; x <= cols; x++){ ctx.beginPath(); ctx.moveTo(pad + x*cellW + 0.5, pad); ctx.lineTo(pad + x*cellW + 0.5, ch - pad); ctx.stroke(); }
      for (let y = 0; y <= rows; y++){ ctx.beginPath(); ctx.moveTo(pad, pad + y*cellH + 0.5); ctx.lineTo(cw - pad, pad + y*cellH + 0.5); ctx.stroke(); }
      ctx.restore();
      // path
      const color = snap.gameId === 'mouseSnake' ? '#22d3ee' : '#a78bfa';
      const pts = snap.path || [];
      if (pts.length > 1) {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i=0; i<pts.length; i++){
          const p = pts[i];
          const x = pad + p.x * cellW + cellW/2;
          const y = pad + p.y * cellH + cellH/2;
          if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke(); ctx.restore();
      }
      // death marker
      if (snap.death && (!snap.win)) {
        const cx = pad + snap.death.x * cellW + cellW/2;
        const cy = pad + snap.death.y * cellH + cellH/2;
        ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
        const r = Math.min(cellW, cellH) * 0.5;
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r); ctx.stroke();
        ctx.restore();
      }
    }
    const list = wrap.querySelector('#pf-list');
    if (!plays.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Пока нет данных. Сыграй пару игр!';
      empty.style.color = 'var(--muted)';
      list.appendChild(empty);
    } else {
      for (const p of plays) {
        const item = document.createElement('div');
        item.style.background = 'var(--card)';
        item.style.border = '1px solid rgba(255,255,255,0.08)';
        item.style.borderRadius = '10px';
        item.style.padding = '8px';
        item.innerHTML = `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px">
          <strong style="font-size:12px">${p.gameId === 'mouseSnake' ? 'Змейка' : p.gameId === 'hideFromCat' ? 'Прятки' : p.gameId}</strong>
          <span style="font-size:11px; color:var(--muted)">${new Date(p.ts||Date.now()).toLocaleTimeString()}</span>
        </div>`;
        const canv = document.createElement('canvas');
        item.appendChild(canv);
        list.appendChild(item);
        drawSnap(canv, p);
      }
    }
    function close(){ document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
    wrap.querySelector('#pf-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }
  return { addPlay, openModal };
})();

// ============================
// Settings: persisted app/game options
// ============================
const SETTINGS_STORE_KEY = 'questhub:settings:v1';
const Settings = (() => {
  const defaults = {
    showElixirHud: true,
    defaultSnakeMode: 'classic', // 'classic' | 'wrap' | 'turbo'
    defaultHideCatMode: 'normal', // 'normal' | 'hard'
    musicVolume: 0.07,
  };
  function get() { const v = StorageSafe.get(SETTINGS_STORE_KEY, defaults); return { ...defaults, ...v }; }
  function setPartial(p) { const cur = get(); const next = { ...cur, ...p }; StorageSafe.set(SETTINGS_STORE_KEY, next); return next; }
  // apply runtime settings
  (function apply(){ try { Music.setVolume(get().musicVolume); } catch {} })();
  return { get, setPartial };
})();

// Simple router/view switch
function showView(name) {
  for (const key of Object.keys(dom.views)) {
    dom.views[key].classList.toggle('current', key === name);
  }
  // Toggle minimal chrome while playing
  document.body.classList.toggle('playing', name === 'game');
  // Hide pause/resume buttons on non-game views
  if (name !== 'game') { try { togglePauseButtons(false); } catch {} }
}

function setGameTitle(iconSymbolId, title) {
  dom.title.icon.innerHTML = '';
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${iconSymbolId}`);
  dom.title.icon.appendChild(use);
  dom.title.text.textContent = title;
}

// Game Manager
let currentGame = null;

const Games = {
  mouseSnake: {
    id: 'mouseSnake',
    icon: 'icon-mouse',
    title: 'Мышь и Сыр (змейка)',
    mount(root) { return MouseSnakeGame(root); }
  },
  cheeseCatcher: {
    id: 'cheeseCatcher',
    icon: 'icon-cheese',
    title: 'Охота за Сыром',
    mount(root) { return CheeseCatcherGame(root); }
  },
  hideFromCat: {
    id: 'hideFromCat',
    icon: 'icon-cat',
    title: 'Прятки от Кота',
    mount(root) { return HideFromCatGame(root); }
  }
};

function startGame(gameKey) {
  const g = Games[gameKey];
  if (!g) return;
  if (currentGame) { try { currentGame.unmount(); } catch {} currentGame = null; }

  setGameTitle(g.icon, g.title);
  showView('game');
  togglePauseButtons(false);
  currentGame = g.mount(dom.gameRoot);
  try { Music.play(); } catch {}
}

function backToHome() {
  if (currentGame) { try { currentGame.unmount(); } catch {} currentGame = null; }
  showView('home');
  try { Music.stop(); } catch {}
}
function showProfile() {
  if (currentGame) { try { currentGame.unmount(); } catch {} currentGame = null; }
  setGameTitle('icon-star', 'Профиль');
  showView('profile');
  renderProfile();
}

function togglePauseButtons(paused) {
  dom.buttons.pause.classList.toggle('hidden', paused);
  dom.buttons.resume.classList.toggle('hidden', !paused);
}

// Bind buttons
if (dom.buttons.playMouseSnake) dom.buttons.playMouseSnake.addEventListener('click', () => startGame('mouseSnake'));
if (dom.buttons.playCheeseCatcher) dom.buttons.playCheeseCatcher.addEventListener('click', () => startGame('cheeseCatcher'));
if (dom.buttons.playHideCat) dom.buttons.playHideCat.addEventListener('click', () => startGame('hideFromCat'));
if (dom.buttons.back) dom.buttons.back.addEventListener('click', backToHome);
if (dom.buttons.pause) dom.buttons.pause.addEventListener('click', () => { if (currentGame?.pause) { currentGame.pause(); togglePauseButtons(true); } });
if (dom.buttons.resume) dom.buttons.resume.addEventListener('click', () => { if (currentGame?.resume) { currentGame.resume(); togglePauseButtons(false); } });

// ============================
// Sound Manager (WebAudio beeps)
// ============================
const Sound = (() => {
  let ctx = null;
  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    return ctx;
  }
  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function beep({ freq = 440, duration = 0.07, type = 'sine', gain = 0.05 } = {}) {
    const ac = ensureContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ac.destination);
    const now = ac.currentTime;
    osc.start(now);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.stop(now + duration);
  }
  return {
    resume,
    getContext: () => ensureContext(),
    collect: () => beep({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.06 }),
    click: () => beep({ freq: 660, duration: 0.05, type: 'square', gain: 0.05 }),
    lose: () => beep({ freq: 220, duration: 0.18, type: 'sawtooth', gain: 0.05 }),
  };
})();

// Background Music (lightweight generative loop)
const Music = (() => {
  let ctx = null;
  let out = null;
  let delay = null;
  let feedback = null;
  let isPlaying = false;
  let timer = null;
  let active = [];

  function ensure() {
    ctx = Sound.getContext ? Sound.getContext() : null;
    if (!ctx) return null;
    if (!out) {
      out = ctx.createGain();
      out.gain.value = 0.07;
      out.connect(ctx.destination);
      delay = ctx.createDelay();
      delay.delayTime.value = 0.27;
      feedback = ctx.createGain();
      feedback.gain.value = 0.24;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(out);
    }
    return ctx;
  }

  function toFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function scheduleNote(freq, t, dur, type = 'sine', amp = 0.08) {
    const c = ensure(); if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    if (type === 'square' && freq > 2000) {
      // noise-ish hat via very high square
      osc.frequency.setValueAtTime(freq, t);
    } else {
      osc.frequency.setValueAtTime(freq, t);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(out);
    g.connect(delay);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    active.push(osc);
    osc.onended = () => { active = active.filter(n => n !== osc); };
  }

  const progression = [ [57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62] ]; // A minor-ish
  let step = 0;

  function play() {
    const c = ensure(); if (!c) return; if (isPlaying) return; isPlaying = true;
    const bpm = 82; const beat = 60 / bpm; // seconds per beat
    function tick() {
      if (!isPlaying) return;
      const t0 = c.currentTime + 0.03;
      const chord = progression[step % progression.length];
      // pad
      for (const m of chord) {
        scheduleNote(toFreq(m), t0, beat * 2.8, 'sine', 0.05);
        scheduleNote(toFreq(m) + 0.6, t0, beat * 2.8, 'sine', 0.03);
      }
      // soft hat
      scheduleNote(8000, t0, 0.02, 'square', 0.01);
      // gentle bass
      scheduleNote(toFreq(chord[0] - 12), t0 + beat * 0.0, beat * 0.5, 'sine', 0.06);
      step++;
      timer = setTimeout(tick, beat * 1000 * 2); // half-bar loop
    }
    tick();
  }

  function stop() {
    if (!isPlaying) return; isPlaying = false;
    if (timer) { clearTimeout(timer); timer = null; }
    try { active.forEach(n => { try { n.stop(); } catch {} }); } catch {}
    active = [];
  }

  function setVolume(v) { ensure(); if (out) out.gain.value = v; }

  return { play, stop, setVolume };
})();

// Prime/resume audio on first user interaction
window.addEventListener('pointerdown', () => { try { Sound.resume(); } catch {} }, { once: true, passive: true });

// Open profile on XP box click
document.addEventListener('DOMContentLoaded', () => {
  const xpBox = document.querySelector('.xp-box');
  if (xpBox) xpBox.addEventListener('click', () => { showProfile(); });
  const backBtn = document.getElementById('profile-back');
  if (backBtn) backBtn.addEventListener('click', backToHome);
});

function renderProfile() {
  const root = document.getElementById('profile-root');
  if (!root) return;
  root.innerHTML = '';
  const btnGames = document.getElementById('pf-tab-games');
  const btnSettings = document.getElementById('pf-tab-settings');
  function renderGames(){
    root.innerHTML = '';
    const plays = StorageSafe.get(PROFILE_STORE_KEY, []);
    if (!plays.length) { const p = document.createElement('p'); p.textContent = 'Пока нет данных. Сыграй пару игр!'; p.style.color = 'var(--muted)'; root.appendChild(p); return; }
    for (const snap of plays) {
      const card = document.createElement('div');
      card.className = 'status-card';
      const title = document.createElement('div');
      title.style.display = 'flex'; title.style.alignItems = 'center'; title.style.justifyContent = 'space-between';
      title.innerHTML = `<strong style="font-size:12px">${snap.gameId === 'mouseSnake' ? 'Змейка' : snap.gameId === 'hideFromCat' ? 'Прятки' : snap.gameId}</strong><span style="font-size:11px; color:var(--muted)">${new Date(snap.ts||Date.now()).toLocaleString()}</span>`;
      const canv = document.createElement('canvas'); canv.width = 360; canv.height = 240; canv.style.width = '100%'; canv.style.height = 'auto';
      card.append(title, canv);
      root.appendChild(card);
      const ctx = canv.getContext('2d');
      const cols = snap.cols || 32; const rows = snap.rows || 24; const pad = 10;
      const cw = canv.width, ch = canv.height; const cellW = (cw - pad*2)/cols, cellH = (ch - pad*2)/rows;
      ctx.clearRect(0,0,cw,ch);
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0,0,cw,ch);
      ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let x=0; x<=cols; x++){ ctx.beginPath(); ctx.moveTo(pad + x*cellW + 0.5, pad); ctx.lineTo(pad + x*cellW + 0.5, ch-pad); ctx.stroke(); }
      for (let y=0; y<=rows; y++){ ctx.beginPath(); ctx.moveTo(pad, pad + y*cellH + 0.5); ctx.lineTo(cw-pad, pad + y*cellH + 0.5); ctx.stroke(); }
      ctx.restore();
      const color = snap.gameId === 'mouseSnake' ? '#22d3ee' : '#a78bfa';
      const pts = snap.path || [];
      if (pts.length > 1) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
        for (let i=0;i<pts.length;i++){ const p = pts[i]; const x = pad + p.x*cellW + cellW/2; const y = pad + p.y*cellH + cellH/2; if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
        ctx.stroke(); ctx.restore(); }
      if (snap.death && !snap.win){ const cx = pad + snap.death.x*cellW + cellW/2, cy = pad + snap.death.y*cellH + cellH/2; ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; const r = Math.min(cellW,cellH)*0.5; ctx.beginPath(); ctx.moveTo(cx-r,cy-r); ctx.lineTo(cx+r,cy+r); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx-r,cy+r); ctx.lineTo(cx+r,cy-r); ctx.stroke(); ctx.restore(); }
    }
  }
  function renderSettings(){
    root.innerHTML = '';
    const s = Settings.get();
    const card = document.createElement('div'); card.className = 'status-card';
    card.innerHTML = `
      <h3 style="display:flex; align-items:center; gap:8px"><svg style="width:16px; height:16px"><use href="#icon-star"/></svg> Основное</h3>
      <label style="display:flex; align-items:center; gap:10px"><input id="st-elixir" type="checkbox" ${s.showElixirHud ? 'checked' : ''}/> Показать панель эликсиров</label>
      <label style="display:flex; align-items:center; gap:10px">Громкость музыки <input id="st-vol" type="range" min="0" max="0.3" step="0.01" value="${s.musicVolume}"/></label>
      <label style="display:flex; align-items:center; gap:10px">Режим Змейки <select id="st-snake">
        <option value="classic" ${s.defaultSnakeMode==='classic'?'selected':''}>Классика</option>
        <option value="wrap" ${s.defaultSnakeMode==='wrap'?'selected':''}>Без стен</option>
        <option value="turbo" ${s.defaultSnakeMode==='turbo'?'selected':''}>Турбо</option>
      </select></label>
      <label style="display:flex; align-items:center; gap:10px">Прятки — сложность <select id="st-hide">
        <option value="normal" ${s.defaultHideCatMode==='normal'?'selected':''}>Обычная</option>
        <option value="hard" ${s.defaultHideCatMode==='hard'?'selected':''}>Сложная</option>
      </select></label>
      <div style="display:flex; gap:10px; justify-content:flex-end"><button class="btn primary" id="st-save"><svg><use href="#icon-play"/></svg> Сохранить</button></div>
    `;
    root.appendChild(card);
    card.querySelector('#st-save').addEventListener('click', () => {
      const next = Settings.setPartial({
        showElixirHud: card.querySelector('#st-elixir').checked,
        musicVolume: parseFloat(card.querySelector('#st-vol').value),
        defaultSnakeMode: card.querySelector('#st-snake').value,
        defaultHideCatMode: card.querySelector('#st-hide').value,
      });
      try { Music.setVolume(next.musicVolume); } catch {}
      XP.add(0, 'Настройки сохранены');
    });
  }
  btnGames?.addEventListener('click', () => { btnGames.classList.add('primary'); btnSettings?.classList.remove('primary'); renderGames(); });
  btnSettings?.addEventListener('click', () => { btnSettings.classList.add('primary'); btnGames?.classList.remove('primary'); renderSettings(); });
  // default tab -> Игры
  btnGames?.classList.add('primary'); btnSettings?.classList.remove('primary');
  renderGames();
}

// ============================
// FPS Meter (shared)
// ============================
function createFpsMeter() {
  let lastTs = 0;
  let fps = 0;
  return {
    tick(ts) {
      if (!lastTs) { lastTs = ts; return fps; }
      const dt = Math.max(1e-4, (ts - lastTs) / 1000);
      lastTs = ts;
      const inst = 1 / dt;
      // Exponential moving average for stable readout
      fps = fps ? (fps * 0.9 + inst * 0.1) : inst;
      return Math.round(fps);
    },
    reset() { lastTs = 0; fps = 0; }
  };
}

// ============================
// MouseSnake Game
// ============================
function MouseSnakeGame(root) {
  const BEST_KEY = 'questhub:snake:best';
  let best = StorageSafe.get(BEST_KEY, 0);

  // Build UI
  root.innerHTML = '';
  const hud = document.createElement('div');
  hud.className = 'game-hud';
  hud.innerHTML = `
    <div class="badge"><svg><use href="#icon-cheese"/></svg><b id="sn-score">0</b> сыр</div>
    <div class="badge"><svg><use href="#icon-speed"/></svg><span id="sn-speed">0</span> т/с</div>
    <div class="badge"><svg><use href="#icon-award"/></svg>Рекорд: <b id="sn-best">${best}</b></div>
    <div class="badge">Режим:
      <select id="sn-mode" class="mode-select">
        <option value="classic">Классика</option>
        <option value="wrap">Без стен</option>
        <option value="turbo">Турбо</option>
      </select>
    </div>
    <div class="badge" id="sn-fps-box">FPS: <b id="sn-fps">0</b></div>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // Logical size; CSS scales it.
  canvas.width = 800;
  canvas.height = 600;
  wrap.appendChild(canvas);
  root.append(hud, wrap);

  // Elixir HUD (right side timers for potions/effects)
  const elixirHud = document.createElement('div');
  elixirHud.className = 'elixir-hud';
  wrap.appendChild(elixirHud);

  // Pre-render static grid to offscreen canvas for performance
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = canvas.width;
  gridCanvas.height = canvas.height;
  const gridCtx = gridCanvas.getContext('2d');

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'status-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="status-card">
      <h3 id="sn-status-title">Пауза</h3>
      <p id="sn-status-sub">Возвращайся к охоте за сыром!</p>
      <div style="display:flex; gap:10px; margin-top:6px">
        <button class="btn" id="sn-resume"><svg><use href="#icon-play"/></svg> Продолжить</button>
        <button class="btn primary" id="sn-restart"><svg><use href="#icon-play"/></svg> Заново</button>
        <button class="btn" id="sn-home"><svg><use href="#icon-arrow-left"/></svg> В меню</button>
      </div>
    </div>
  `;
  wrap.appendChild(overlay);

  // State
  const cols = 32, rows = 24;
  const cellW = canvas.width / cols, cellH = canvas.height / rows;
  // Pre-render grid once for this game
  let gridCache = document.createElement('canvas');
  gridCache.width = canvas.width; gridCache.height = canvas.height;
  (function buildGrid(){
    const g = gridCache.getContext('2d');
    g.save(); g.globalAlpha = 0.06; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x*cellW+0.5, 0); g.lineTo(x*cellW+0.5, canvas.height); g.stroke(); }
    for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y*cellH+0.5); g.lineTo(canvas.width, y*cellH+0.5); g.stroke(); }
    g.restore();
  })();
  // Pre-render static grid texture (offscreen) for this game (no redeclare)
  // already created gridCache above

  // Draw grid once
  (function drawGrid() {
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.globalAlpha = 0.08;
    gridCtx.strokeStyle = '#ffffff';
    gridCtx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      gridCtx.beginPath();
      gridCtx.moveTo(x * cellW + 0.5, 0);
      gridCtx.lineTo(x * cellW + 0.5, gridCanvas.height);
      gridCtx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, y * cellH + 0.5);
      gridCtx.lineTo(gridCanvas.width, y * cellH + 0.5);
      gridCtx.stroke();
    }
    gridCtx.restore();
    // red border around playfield
    gridCtx.save();
    gridCtx.strokeStyle = '#ef4444';
    gridCtx.lineWidth = 4;
    gridCtx.strokeRect(2, 2, gridCanvas.width - 4, gridCanvas.height - 4);
    gridCtx.restore();
  })();

  let snake = [];
  let prevSnake = [];
  let dir = { x: 1, y: 0 };
  const dirQueue = [];
  let cheese = null;
  // Potions state
  let potions = []; // { x, y, type: 'green'|'blue', ttl }
  let potionSpawnTimer = 0;
  let speedBoostTimer = 0; // seconds left for blue potion boost
  const SPEED_BOOST_AMOUNT = 3.0;
  let score = 0;
  let alive = true;
  let paused = false;

  // Modes
  let mode = 'classic';
  let wrapWalls = false;
  let turbo = false;

  function applyMode() {
    wrapWalls = mode === 'wrap';
    turbo = mode === 'turbo';
  }

  let speed = 6; // tiles per second
  let lastTime = 0;
  let acc = 0;
  const fpsMeter = createFpsMeter();

  function reset() {
    snake = [ { x: Math.floor(cols/2), y: Math.floor(rows/2) } ];
    prevSnake = snake.map(s => ({ ...s }));
    dir = { x: 1, y: 0 };
    dirQueue.length = 0;
    score = 0;
    alive = true;
    paused = false;
    speed = turbo ? 9 : 6;
    // reset potions
    potions = [];
    potionSpawnTimer = randInt(4, 8);
    speedBoostTimer = 0;
    placeCheese();
    updateHUD();
    hideOverlay();
    fpsMeter.reset();
  }

  function updateHUD() {
    hud.querySelector('#sn-score').textContent = String(score);
    const eff = speed + (speedBoostTimer > 0 ? SPEED_BOOST_AMOUNT : 0);
    hud.querySelector('#sn-speed').textContent = String(eff.toFixed(1));
    hud.querySelector('#sn-best').textContent = String(best);
  }

  function placeCheese() {
    const occupied = new Set(snake.map(s => s.x + ',' + s.y));
    let x, y;
    do {
      x = randInt(0, cols - 1);
      y = randInt(0, rows - 1);
    } while (occupied.has(x + ',' + y));
    cheese = { x, y };
  }

  function keyHandler(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') dirQueue.push({ x: 0, y: -1 });
    else if (k === 's' || k === 'arrowdown') dirQueue.push({ x: 0, y: 1 });
    else if (k === 'a' || k === 'arrowleft') dirQueue.push({ x: -1, y: 0 });
    else if (k === 'd' || k === 'arrowright') dirQueue.push({ x: 1, y: 0 });
    else if (k === 'p' || k === 'escape') togglePause();
  }

  function togglePause() {
    if (!alive) return;
    paused = !paused;
    if (paused) showOverlay('Пауза', 'Сделай вдох — сыр никуда не убежит.');
    else hideOverlay();
    togglePauseButtons(paused);
  }

  function nextDir() {
    while (dirQueue.length) {
      const nd = dirQueue.shift();
      if (nd.x === -dir.x && nd.y === -dir.y) continue; // prevent 180 turn
      return nd;
    }
    return dir;
  }

  function gameOver() {
    alive = false;
    const gained = score * 10 + Math.max(0, Math.floor((speed - 6) * 2));
    if (score > best) { best = score; StorageSafe.set(BEST_KEY, best); }
    updateHUD();
    showOverlay('Игра окончена', `Собрано сыра: ${score}. Награда: +${gained} EXP`);
    XP.add(gained, 'Мышь и Сыр');
    Sound.lose();
    try {
      Profile.addPlay({
        gameId: 'mouseSnake', cols, rows, win: false,
        path: snake.slice(0, Math.min(50, snake.length)),
        death: { x: snake[0].x, y: snake[0].y }
      });
    } catch {}
  }

  function step() {
    prevSnake = snake.map(s => ({ ...s }));
    const nd = nextDir();
    dir = nd;
    const head = snake[0];
    let nx = head.x + dir.x;
    let ny = head.y + dir.y;

    // wall collision or wrap
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
      if (wrapWalls) {
        nx = (nx + cols) % cols;
        ny = (ny + rows) % rows;
      } else {
        gameOver();
        return;
      }
    }
    // self collision
    for (let i = 0; i < snake.length; i++) { if (snake[i].x === nx && snake[i].y === ny) { gameOver(); return; } }

    snake.unshift({ x: nx, y: ny });

    if (cheese && nx === cheese.x && ny === cheese.y) {
      score++;
      Sound.collect();
      speed = clamp(speed + (turbo ? 0.35 : 0.25), turbo ? 9 : 6, turbo ? 20 : 16);
      placeCheese();
    } else {
      snake.pop();
    }
    // potion pickup
    for (let i = 0; i < potions.length; i++) {
      const p = potions[i];
      if (p && p.x === nx && p.y === ny) {
        if (p.type === 'green') {
          // grow by 1: duplicate last segment
          const tail = snake[snake.length - 1];
          if (tail) snake.push({ x: tail.x, y: tail.y });
          Sound.click();
        } else if (p.type === 'blue') {
          speedBoostTimer = Math.max(speedBoostTimer, 5); // seconds
          Sound.click();
        }
        potions.splice(i, 1);
        break;
      }
    }
    updateHUD();
  }

  function draw() {
    // clear and draw static grid from offscreen buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(gridCanvas, 0, 0);

    // ambient glow for active speed boost (blue)
    if (speedBoostTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // potions
    for (const p of potions) {
      const cx = p.x * cellW;
      const cy = p.y * cellH;
      const pad = 4;
      const w = cellW - pad * 2, h = cellH - pad * 2;
      const color = p.type === 'green' ? '#22c55e' : '#3b82f6';
      drawFlaskIcon(ctx, cx + pad, cy + pad, w, h, color);
    }

    // cheese
    if (cheese) {
      const cx = cheese.x * cellW;
      const cy = cheese.y * cellH;
      const pad = 4;
      const w = cellW - pad * 2, h = cellH - pad * 2;
      // cheese triangle
      ctx.save();
      const grd = ctx.createLinearGradient(cx, cy, cx + w, cy + h);
      grd.addColorStop(0, '#f59e0b');
      grd.addColorStop(1, '#f97316');
      ctx.fillStyle = grd;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + pad, cy + pad);
      ctx.lineTo(cx + w + pad, cy + h/2 + pad);
      ctx.lineTo(cx + pad, cy + h + pad);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // holes
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(cx + pad + w*0.35, cy + pad + h*0.35, Math.min(w,h)*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + pad + w*0.55, cy + pad + h*0.55, Math.min(w,h)*0.06, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // snake with interpolation
    const effSpeed = speed + (speedBoostTimer > 0 ? SPEED_BOOST_AMOUNT : 0);
    const stepDur = 1 / effSpeed;
    const t = clamp(acc / stepDur, 0, 1);
    for (let i = 0; i < snake.length; i++) {
      const cur = snake[i];
      const prev = prevSnake[i] || cur;
      // handle wrap interpolation
      let px = prev.x, py = prev.y;
      let cx2 = cur.x, cy2 = cur.y;
      if (wrapWalls) {
        let dx = cx2 - px;
        let dy = cy2 - py;
        if (dx > cols / 2) px += cols; else if (dx < -cols / 2) px -= cols;
        if (dy > rows / 2) py += rows; else if (dy < -rows / 2) py -= rows;
      }
      const fx = (px + (cx2 - px) * t) * cellW;
      const fy = (py + (cy2 - py) * t) * cellH;
      const pad = 3;
      const w = cellW - pad * 2, h = cellH - pad * 2;
      const r = 6;
      // gradient body
      const gr = i / Math.max(1, snake.length - 1);
      const c1 = '#22d3ee', c2 = '#a78bfa';
      const grd = ctx.createLinearGradient(fx, fy, fx + w, fy + h);
      grd.addColorStop(0, c1);
      grd.addColorStop(1, c2);
      ctx.fillStyle = grd;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      roundRect(ctx, fx + pad, fy + pad, w, h, r);
      ctx.fill();
      ctx.stroke();
      if (i === 0) {
        // eyes
        ctx.fillStyle = '#0b1020';
        const ex = fx + pad + w*0.7;
        const ey = fy + pad + h*0.3;
        ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey + 6, 2.2, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
  }

  function showOverlay(title, sub, kind) {
    overlay.style.display = 'flex';
    overlay.querySelector('#sn-status-title').textContent = title;
    overlay.querySelector('#sn-status-sub').textContent = sub || '';
    const rb = overlay.querySelector('#sn-resume');
    if (rb) rb.style.display = (kind === 'win') ? 'none' : '';
  }
  function hideOverlay() { overlay.style.display = 'none'; }

  function onResize() {
    // keep aspect ratio via CSS; nothing to do logically
  }

  function loop(ts) {
    if (!alive) return; // stop loop, overlay shown
    if (!paused) {
      const dt = (ts - lastTime) / 1000;
      lastTime = ts;
      // timers: potions and boosts
      potionSpawnTimer -= dt;
      if (potionSpawnTimer <= 0) {
        // limit on-screen potions
        if (potions.length < 2) {
          // find free cell
          const occupied = new Set(snake.map(s => s.x + ',' + s.y));
          if (cheese) occupied.add(cheese.x + ',' + cheese.y);
          for (const p of potions) occupied.add(p.x + ',' + p.y);
          let tries = 64;
          let px = -1, py = -1;
          while (tries--) {
            const tx = randInt(0, cols - 1);
            const ty = randInt(0, rows - 1);
            if (!occupied.has(tx + ',' + ty)) { px = tx; py = ty; break; }
          }
          if (px >= 0) {
            const type = Math.random() < 0.5 ? 'green' : 'blue';
            potions.push({ x: px, y: py, type, ttl: randInt(6, 9) });
          }
        }
        potionSpawnTimer = randInt(5, 9);
      }
      // decay potion TTLs
      if (potions.length) {
        for (let i = potions.length - 1; i >= 0; i--) {
          potions[i].ttl -= dt;
          if (potions[i].ttl <= 0) potions.splice(i, 1);
        }
      }
      // decay speed boost
      if (speedBoostTimer > 0) speedBoostTimer = Math.max(0, speedBoostTimer - dt);
      // update elixir HUD
      elixirHud.innerHTML = '';
      // show the longest-living potion (nearest expire) on HUD
      const active = potions.slice().sort((a,b)=>a.ttl - b.ttl)[0];
      if (active) {
        const item = document.createElement('div'); item.className = 'elixir'; item.setAttribute('data-tip', active.type === 'green' ? 'Зелёное зелье: +1 длина' : 'Синее зелье: ускорение на время');
        const icon = document.createElement('canvas'); icon.width = 24; icon.height = 24; icon.className = 'icon';
        const ict = icon.getContext('2d');
        drawFlaskIcon(ict, 0, 0, 24, 24, active.type === 'green' ? '#22c55e' : '#3b82f6');
        const bar = document.createElement('div'); bar.className = 'bar';
        const fill = document.createElement('span');
        const ttl = Math.max(0, active.ttl);
        const pct = Math.max(0, Math.min(1, ttl / 9));
        fill.style.transform = `scaleY(${pct})`;
        bar.appendChild(fill);
        const label = document.createElement('div'); label.className = 'label'; label.textContent = (active.type === 'green' ? 'Зелье роста' : 'Скорость') + ' ' + ttl.toFixed(1) + 'с';
        item.append(icon, bar, label);
        elixirHud.appendChild(item);
      } else if (speedBoostTimer > 0) {
        const item = document.createElement('div'); item.className = 'elixir'; item.setAttribute('data-tip', 'Скорость: активный буст');
        const icon = document.createElement('canvas'); icon.width = 24; icon.height = 24; icon.className = 'icon';
        const ict = icon.getContext('2d'); drawFlaskIcon(ict, 0, 0, 24, 24, '#3b82f6');
        const bar = document.createElement('div'); bar.className = 'bar';
        const fill = document.createElement('span');
        const pct = Math.max(0, Math.min(1, speedBoostTimer / 5));
        fill.style.transform = `scaleY(${pct})`;
        bar.appendChild(fill);
        const label = document.createElement('div'); label.className = 'label'; label.textContent = 'Скорость ' + speedBoostTimer.toFixed(1) + 'с';
        item.append(icon, bar, label);
        elixirHud.appendChild(item);
      }
      acc += dt;
      const effSpeed = speed + (speedBoostTimer > 0 ? SPEED_BOOST_AMOUNT : 0);
      const stepDur = 1 / effSpeed;
      while (acc >= stepDur) { acc -= stepDur; step(); }
      draw();
      const f = fpsMeter.tick(ts);
      const el = hud.querySelector('#sn-fps');
      if (el) el.textContent = String(f);
    } else {
      lastTime = ts; // avoid huge dt on resume
    }
    rafId = requestAnimationFrame(loop);
  }

  // Controls
  const restartBtn = overlay.querySelector('#sn-restart');
  const homeBtn = overlay.querySelector('#sn-home');
  const resumeBtn = overlay.querySelector('#sn-resume');
  const modeSel = hud.querySelector('#sn-mode');
  modeSel.addEventListener('change', () => {
    mode = modeSel.value;
    applyMode();
    cancelAnimationFrame(rafId);
    reset();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  });
  restartBtn.addEventListener('click', () => {
    cancelAnimationFrame(rafId);
    reset();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  });
  homeBtn.addEventListener('click', () => { backToHome(); });
  resumeBtn.addEventListener('click', () => { paused = false; hideOverlay(); togglePauseButtons(false); });

  window.addEventListener('keydown', keyHandler);
  window.addEventListener('resize', onResize);

  // Start
  let rafId = 0;
  reset();
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  return {
    pause: () => { if (!alive) return; paused = true; showOverlay('Пауза', 'Жми продолжить, чтобы вернуться в игру.'); },
    resume: () => { if (!alive) return; paused = false; hideOverlay(); },
    unmount: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('resize', onResize);
      root.innerHTML = '';
    }
  };
}

// ============================
// CheeseCatcher Game
// ============================
function CheeseCatcherGame(root) {
  root.innerHTML = '';
  const hud = document.createElement('div');
  hud.className = 'game-hud';
  hud.innerHTML = `
    <div class="badge"><svg><use href="#icon-cheese"/></svg><b id="cc-score">0</b> очков</div>
    <div class="badge"><svg><use href="#icon-timer"/></svg><span id="cc-time">30.0</span>с</div>
    <div class="badge">Режим:
      <select id="cc-mode" class="mode-select">
        <option value="normal">Обычный</option>
        <option value="frenzy">Безумие</option>
        <option value="endless">Бесконечный</option>
      </select>
    </div>
    <div class="badge" id="cc-fps-box">FPS: <b id="cc-fps">0</b></div>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'catch-root';

  const area = document.createElement('div');
  area.className = 'catch-area';
  const cheese = document.createElement('div');
  cheese.className = 'cheese';
  cheese.innerHTML = '<svg><use href="#icon-cheese"/></svg>';
  area.appendChild(cheese);

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.innerHTML = '<span id="cc-progress"></span>';

  wrap.append(area, progress);
  root.append(hud, wrap);

  const overlay = document.createElement('div');
  overlay.className = 'status-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="status-card">
      <h3 id="cc-status-title">Пауза</h3>
      <p id="cc-status-sub">Успей поймать весь сыр!</p>
      <div style="display:flex; gap:10px; margin-top:6px">
        <button class="btn primary" id="cc-restart"><svg><use href="#icon-play"/></svg> Заново</button>
        <button class="btn" id="cc-home"><svg><use href="#icon-arrow-left"/></svg> В меню</button>
      </div>
    </div>
  `;
  wrap.appendChild(overlay);

  let score = 0;
  let timeLeft = 30.0;
  let running = true;
  let paused = false;
  let last = performance.now();
  let moveTimer = 0; // for auto-move
  let mode = 'normal';
  let rewarded = false;
  const fpsMeter = createFpsMeter();

  const modeSel = hud.querySelector('#cc-mode');
  function applyMode() {
    const v = modeSel?.value || 'normal';
    mode = v;
    rewarded = false;
    if (mode === 'endless') {
      timeLeft = Infinity;
      progress.style.display = 'none';
      hud.querySelector('#cc-time').parentElement.style.display = 'none';
    } else {
      timeLeft = 30.0;
      progress.style.display = '';
      hud.querySelector('#cc-time').parentElement.style.display = '';
    }
    last = performance.now();
    moveTimer = 0;
  }
  modeSel.addEventListener('change', () => { applyMode(); updateHUD(); placeCheeseRandom(); });
  applyMode();

  function updateHUD() {
    hud.querySelector('#cc-score').textContent = String(score);
    if (mode !== 'endless') {
      hud.querySelector('#cc-time').textContent = timeLeft.toFixed(1);
      const pct = clamp(timeLeft / 30 * 100, 0, 100);
      progress.querySelector('#cc-progress').style.width = pct + '%';
    }
  }

  function placeCheeseRandom() {
    const w = area.clientWidth;
    const h = area.clientHeight;
    if (!w || !h) {
      // try again next frame when layout is ready
      requestAnimationFrame(placeCheeseRandom);
      return;
    }
    const cw = 56, ch = 56; // cheese size set in CSS
    const maxX = Math.max(0, w - cw - 8);
    const maxY = Math.max(0, h - ch - 8);
    const x = Math.random() * maxX + 4;
    const y = Math.random() * maxY + 4;
    cheese.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function reward() {
    if (rewarded) return;
    rewarded = true;
    const gained = Math.max(0, score * (mode === 'frenzy' ? 6 : 5));
    showOverlay('Раунд завершен', `Очки: ${score}. Награда: +${gained} EXP`);
    XP.add(gained, 'Охота за Сыром');
  }

  function showOverlay(title, sub) {
    overlay.style.display = 'flex';
    overlay.querySelector('#cc-status-title').textContent = title;
    overlay.querySelector('#cc-status-sub').textContent = sub || '';
  }
  function hideOverlay() { overlay.style.display = 'none'; }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - last) / 1000; last = ts;
    if (!paused) {
      if (mode !== 'endless') timeLeft -= dt;
      moveTimer -= dt;
      if (moveTimer <= 0) {
        placeCheeseRandom();
        // move interval shrinks with score and mode
        const base = (mode === 'frenzy') ? 0.9 : 1.4;
        const factor = (mode === 'frenzy') ? 0.025 : 0.02;
        moveTimer = clamp(base - score * factor, 0.4, 1.6);
      }
      if (mode !== 'endless' && timeLeft <= 0) { timeLeft = 0; running = false; updateHUD(); reward(); return; }
      updateHUD();
      const f = fpsMeter.tick(ts);
      const el = hud.querySelector('#cc-fps');
      if (el) el.textContent = String(f);
    }
    rafId = requestAnimationFrame(loop);
  }

  function onClickCheese(e) {
    if (!running || paused) return;
    score++;
    updateHUD();
    placeCheeseRandom();
    // small pop animation
    cheese.animate([{ transform: cheese.style.transform + ' scale(1)' }, { transform: cheese.style.transform + ' scale(1.18)' }, { transform: cheese.style.transform + ' scale(1)' }], { duration: 180 });
    Sound.collect();
  }

  function togglePause() {
    paused = !paused;
    if (paused) showOverlay('Пауза', 'Возвращайся к охоте!');
    else { hideOverlay(); last = performance.now(); }
    togglePauseButtons(paused);
  }

  // controls
  const restartBtn = overlay.querySelector('#cc-restart');
  const homeBtn = overlay.querySelector('#cc-home');
  restartBtn.addEventListener('click', () => { unmount(); startGame('cheeseCatcher'); });
  homeBtn.addEventListener('click', () => { backToHome(); });
  cheese.addEventListener('click', onClickCheese);
  window.addEventListener('resize', placeCheeseRandom);

  // Start
  updateHUD();
  placeCheeseRandom();
  let rafId = requestAnimationFrame(loop);

  return {
    pause: () => { if (!running) return; paused = true; showOverlay('Пауза', 'Жми продолжить, чтобы вернуться в игру.'); },
    resume: () => { if (!running) return; paused = false; hideOverlay(); last = performance.now(); },
    unmount: () => {
      running = false;
      cancelAnimationFrame(rafId);
      cheese.removeEventListener('click', onClickCheese);
      window.removeEventListener('resize', placeCheeseRandom);
      if (mode === 'endless' && score > 0 && !rewarded) {
        // Grant XP on exit in endless mode
        XP.add(score * 3, 'Охота за Сыром (Бесконечный)');
      }
      root.innerHTML = '';
    }
  };
}

// ============================
// Hide From Cat Game
// ============================
function HideFromCatGame(root) {
  root.innerHTML = '';
  const hud = document.createElement('div');
  hud.className = 'game-hud';
  hud.innerHTML = `
    <div class="badge"><svg><use href="#icon-timer"/></svg><span id="hc-time">30.0</span>с</div>
    <div class="badge">Сложность:
      <select id="hc-mode" class="mode-select">
        <option value="normal">Обычная</option>
        <option value="hard">Сложная</option>
      </select>
    </div>
    <div class="badge">FPS: <b id="hc-fps">0</b></div>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'canvas-wrap';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 800; canvas.height = 600;
  wrap.appendChild(canvas);
  root.append(hud, wrap);

  // Elixir HUD for HideFromCat
  const elixirHud = document.createElement('div');
  elixirHud.className = 'elixir-hud';
  wrap.appendChild(elixirHud);

  // Pre-render static grid background + red border (declared after cols/rows)

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'status-overlay'; overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="status-card">
      <h3 id="hc-status-title">Пауза</h3>
      <p id="hc-status-sub"></p>
      <div style="display:flex; gap:10px; margin-top:6px">
        <button class="btn" id="hc-resume"><svg><use href="#icon-play"/></svg> Продолжить</button>
        <button class="btn primary" id="hc-restart"><svg><use href="#icon-play"/></svg> Заново</button>
        <button class="btn" id="hc-home"><svg><use href="#icon-arrow-left"/></svg> В меню</button>
      </div>
    </div>`;
  wrap.appendChild(overlay);

  const cols = 32, rows = 24;
  const cellW = canvas.width / cols, cellH = canvas.height / rows;

  // Simple maze generation (randomized obstacles)
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  // Now build the background grid cache
  const gridCache = document.createElement('canvas');
  gridCache.width = canvas.width;
  gridCache.height = canvas.height;
  (function buildHCGrid(){
    const g = gridCache.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    g.clearRect(0, 0, cw, ch);
    g.save();
    g.globalAlpha = 0.08;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x * cellW + 0.5, 0); g.lineTo(x * cellW + 0.5, ch); g.stroke(); }
    for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * cellH + 0.5); g.lineTo(cw, y * cellH + 0.5); g.stroke(); }
    g.restore();
    // red border outline
    g.save();
    g.strokeStyle = '#ef4444';
    g.lineWidth = 4;
    g.strokeRect(2, 2, cw - 4, ch - 4);
    g.restore();
  })();
  function genMaze(density) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        grid[y][x] = border ? 1 : (Math.random() < density ? 1 : 0);
      }
    }
    // carve a start area
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) grid[y][x] = 0;
  }

  // Mode
  const modeSel = hud.querySelector('#hc-mode');
  let mode = 'normal';
  function applyMode() {
    mode = modeSel.value;
    genMaze(mode === 'hard' ? 0.22 : 0.16);
  }
  modeSel.addEventListener('change', () => { applyMode(); });
  applyMode();

  const player = { x: 2, y: 2 };
  const cat = { x: cols - 3, y: rows - 3 };
  // Smooth interpolation state
  let prevPlayer = { x: player.x, y: player.y };
  let prevCat = { x: cat.x, y: cat.y };
  let playerLerp = 1; // 0..1 progress from prevPlayer -> player
  let catLerp = 1;    // 0..1 progress from prevCat -> cat
  const PLAYER_STEP_SEC = 0.11;
  // Smooth movement anim state
  const playerAnim = { active: false, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, dur: 0.12 };
  const catAnim = { active: false, fromX: 0, fromY: 0, toX: 0, toY: 0, t: 0, dur: 0.10 };
  let timeLeft = 30;
  let running = true;
  let paused = false;
  let lastTs = performance.now();
  const fpsMeter = createFpsMeter();
  let rafId = 0;
  // Potions state for HideFromCat
  let hcPotions = []; // { x, y, type: 'green'|'blue', ttl }
  let hcPotionSpawnTimer = randInt(5, 9);
  let hcSpeedBoostTimer = 0; // seconds
  let hcGreenGlowTimer = 0; // brief visual after green pickup
  const HC_SPEED_BOOST = 0.04; // reduces player move duration by ~40ms
  // Visual: Cat image (SVG photo-style)
  const catImg = new Image();
  (function loadCatImage(){
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`+
      `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">`+
      `<defs><linearGradient id=\"cg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">`+
      `<stop offset=\"0%\" stop-color=\"#f59e0b\"/><stop offset=\"100%\" stop-color=\"#ef4444\"/>`+
      `</linearGradient></defs>`+
      `<path d=\"M4 10l2-4 3 3h6l3-3 2 4v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-7z\" fill=\"url(#cg)\"/>`+
      `<circle cx=\"9\" cy=\"13\" r=\"1\" fill=\"#0b1020\"/><circle cx=\"15\" cy=\"13\" r=\"1\" fill=\"#0b1020\"/>`+
      `</svg>`;
    catImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  })();

  // Visual: Mouse image (SVG stylized)
  const mouseImg = new Image();
  (function loadMouseImage(){
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`+
      `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\">`+
      `<defs>`+
      `<linearGradient id=\"mg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">`+
      `<stop offset=\"0%\" stop-color=\"#e5e7eb\"/><stop offset=\"100%\" stop-color=\"#cbd5e1\"/>`+
      `</linearGradient>`+
      `</defs>`+
      `<ellipse cx=\"12\" cy=\"14\" rx=\"7\" ry=\"6\" fill=\"url(#mg)\"/>`+
      `<ellipse cx=\"8\" cy=\"8\" rx=\"3.5\" ry=\"3\" fill=\"#f5d0fe\" opacity=\"0.9\"/>`+
      `<ellipse cx=\"16\" cy=\"8\" rx=\"3.5\" ry=\"3\" fill=\"#f5d0fe\" opacity=\"0.9\"/>`+
      `<circle cx=\"12\" cy=\"13.5\" r=\"1.2\" fill=\"#0b1020\"/>`+
      `<circle cx=\"10.2\" cy=\"12.5\" r=\"0.6\" fill=\"#0b1020\"/>`+
      `<circle cx=\"13.8\" cy=\"12.5\" r=\"0.6\" fill=\"#0b1020\"/>`+
      `<path d=\"M12 19c2.5 0 5 .5 6.5 1.4\" stroke=\"#a78bfa\" stroke-width=\"0.7\" fill=\"none\" stroke-linecap=\"round\"/>`+
      `</svg>`;
    mouseImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  })();

  // Controls (hold-to-move)
  const dirQ = [];
  const pressed = new Set();
  let lastDirKey = null;
  function onKey(e) {
    const c = e.code;
    if (c === 'KeyW' || c === 'ArrowUp') { pressed.add('up'); lastDirKey = 'up'; e.preventDefault(); }
    else if (c === 'KeyS' || c === 'ArrowDown') { pressed.add('down'); lastDirKey = 'down'; e.preventDefault(); }
    else if (c === 'KeyA' || c === 'ArrowLeft') { pressed.add('left'); lastDirKey = 'left'; e.preventDefault(); }
    else if (c === 'KeyD' || c === 'ArrowRight') { pressed.add('right'); lastDirKey = 'right'; e.preventDefault(); }
    else if (c === 'Escape' || c === 'KeyP') togglePause();
  }
  function desiredDir() {
    const order = lastDirKey ? [lastDirKey] : [];
    for (const k of ['up','down','left','right']) if (!order.includes(k)) order.push(k);
    for (const k of order) {
      if (!pressed.has(k)) continue;
      if (k === 'up') return { x: 0, y: -1 };
      if (k === 'down') return { x: 0, y: 1 };
      if (k === 'left') return { x: -1, y: 0 };
      if (k === 'right') return { x: 1, y: 0 };
    }
    return null;
  }
  function onKeyUp(e) {
    const c = e.code;
    if (c === 'KeyW' || c === 'ArrowUp') pressed.delete('up');
    else if (c === 'KeyS' || c === 'ArrowDown') pressed.delete('down');
    else if (c === 'KeyA' || c === 'ArrowLeft') pressed.delete('left');
    else if (c === 'KeyD' || c === 'ArrowRight') pressed.delete('right');
  }

  function onBlur() { pressed.clear(); lastDirKey = null; }

  function passable(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows && grid[y][x] === 0; }

  function moveEntity(ent, dx, dy) {
    const nx = ent.x + dx, ny = ent.y + dy;
    if (passable(nx, ny)) { ent.x = nx; ent.y = ny; return true; }
    return false;
  }

  function startAnim(ent, anim, nx, ny, durSec) {
    anim.active = true;
    anim.fromX = ent.x; anim.fromY = ent.y;
    anim.toX = nx; anim.toY = ny;
    anim.t = 0; anim.dur = durSec;
  }

  function tryStartMove(ent, anim, dx, dy, durSec) {
    if (anim.active) return false;
    const nx = ent.x + dx, ny = ent.y + dy;
    if (!passable(nx, ny)) return false;
    let d = durSec;
    if (ent === player && hcSpeedBoostTimer > 0) d = Math.max(0.06, durSec - HC_SPEED_BOOST);
    startAnim(ent, anim, nx, ny, d);
    return true;
  }

  // Pathfinding helpers
  function keyOf(x, y) { return x + ',' + y; }
  function findPath(sx, sy, tx, ty) {
    if (!passable(tx, ty)) return null;
    const q = [];
    const prev = new Map();
    const seen = new Set();
    q.push([sx, sy]);
    seen.add(keyOf(sx, sy));
    const dirs = [ [1,0],[-1,0],[0,1],[0,-1] ];
    let found = false;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        const k = keyOf(nx, ny);
        if (!seen.has(k) && passable(nx, ny)) {
          seen.add(k);
          prev.set(k, keyOf(x, y));
          q.push([nx, ny]);
        }
      }
    }
    if (!found) return null;
    const out = [];
    let cur = keyOf(tx, ty);
    while (cur && cur !== keyOf(sx, sy)) {
      const [cx, cy] = cur.split(',').map(Number);
      out.push({ x: cx, y: cy });
      cur = prev.get(cur);
    }
    out.reverse();
    return out;
  }

  // Ensure connectivity between cat and player by carving a thin corridor if needed
  function ensureConnectivity() {
    const p = findPath(cat.x, cat.y, player.x, player.y);
    if (p) return;
    // carve along a straight-ish line (Bresenham)
    let x0 = cat.x, y0 = cat.y, x1 = player.x, y1 = player.y;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (x0 > 0 && y0 > 0 && x0 < cols && y0 < rows) grid[y0][x0] = 0;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  let path = [];
  let pathTimer = 0;
  const PATH_RECALC = 0.15;
  let lastCatPrev = { x: cat.x, y: cat.y };

  // Cat movement: prefers pathfinding, falls back to greedy axis-only; never passes through walls
  function catStep() {
    if (catAnim.active) return; // wait until current step finishes
    // Recalc path if needed
    if (!path || !path.length) {
      path = findPath(cat.x, cat.y, player.x, player.y) || [];
    }
    let moved = false;
    if (path && path.length) {
      const next = path.shift();
      if (next && passable(next.x, next.y)) {
        lastCatPrev = { x: cat.x, y: cat.y };
        startAnim(cat, catAnim, next.x, next.y, mode === 'hard' ? 0.075 : 0.10);
        moved = true;
      } else {
        path = [];
      }
    }
    if (!moved) {
      // greedy fallback (axis-only)
      const dx = Math.sign(player.x - cat.x);
      const dy = Math.sign(player.y - cat.y);
      const mdx = Math.abs(player.x - cat.x);
      const mdy = Math.abs(player.y - cat.y);
      const curDist = mdx + mdy;
      const primary = (mdx >= mdy) ? { x: dx, y: 0 } : { x: 0, y: dy };
      const secondary = (mdx >= mdy) ? { x: 0, y: dy } : { x: dx, y: 0 };
      for (const o of [primary, secondary]) {
        if (!o || (o.x === 0 && o.y === 0)) continue;
        const nx = cat.x + o.x, ny = cat.y + o.y;
        if (passable(nx, ny)) {
          const nd = Math.abs(player.x - nx) + Math.abs(player.y - ny);
          if (nd < curDist && !(nx === lastCatPrev.x && ny === lastCatPrev.y)) {
            lastCatPrev = { x: cat.x, y: cat.y };
            startAnim(cat, catAnim, nx, ny, mode === 'hard' ? 0.075 : 0.10);
            moved = true; break;
          }
        }
      }
    }
  }

  function update(dt) {
    // player animation or start next queued move
  if (playerAnim.active) {
      playerAnim.t += dt;
      if (playerAnim.t >= playerAnim.dur) {
        player.x = playerAnim.toX; player.y = playerAnim.toY; playerAnim.active = false;
      }
    } else {
      const hold = desiredDir();
      const d = hold || dirQ.shift();
      if (d) tryStartMove(player, playerAnim, d.x, d.y, 0.11);
    }

    // cat move continuously (no pauses between steps)
    pathTimer -= dt;
    if (pathTimer <= 0) { path = findPath(cat.x, cat.y, player.x, player.y) || []; pathTimer = PATH_RECALC; }
    if (catAnim.active) {
      catAnim.t += dt;
      if (catAnim.t >= catAnim.dur) { cat.x = catAnim.toX; cat.y = catAnim.toY; catAnim.active = false; }
    }
    if (!catAnim.active) { catStep(); }

    // check collision
    if (player.x === cat.x && player.y === cat.y) {
      running = false;
      Sound.lose();
      try { Music.stop(); } catch {}
      showOverlay('Пойман!', 'Кот тебя нашёл. +10 EXP за попытку', 'lose');
      XP.add(10, 'Прятки от Кота — попытка');
      try { Profile.addPlay({ gameId: 'hideFromCat', cols, rows, win: false, path: [], death: { x: player.x, y: player.y } }); } catch {}
    }

    // pickup potion if on same cell
    for (let i = 0; i < hcPotions.length; i++) {
      const p = hcPotions[i];
      if (p.x === player.x && p.y === player.y) {
        if (p.type === 'green') {
          timeLeft = Math.min(60, timeLeft + 3);
          hcGreenGlowTimer = 0.7;
          Sound.click();
        } else if (p.type === 'blue') {
          hcSpeedBoostTimer = Math.max(hcSpeedBoostTimer, 5);
          Sound.click();
        }
        hcPotions.splice(i, 1);
        break;
      }
    }

    // timer
    timeLeft -= dt;
    if (timeLeft <= 0 && running) {
      running = false;
      const gained = mode === 'hard' ? 120 : 80;
      try { Music.stop(); } catch {}
      showOverlay('Выжил!', `Поздравляем! Награда: +${gained} EXP`, 'win');
      XP.add(gained, 'Прятки от Кота — победа');
      try { Profile.addPlay({ gameId: 'hideFromCat', cols, rows, win: true, path: [] }); } catch {}
    }

    // Potions spawn and timers
    hcPotionSpawnTimer -= dt;
    if (hcPotionSpawnTimer <= 0) {
      if (hcPotions.length < 2) {
        let tries = 100;
        while (tries--) {
          const rx = randInt(0, cols - 1);
          const ry = randInt(0, rows - 1);
          if (grid[ry][rx] === 0 && !(rx === player.x && ry === player.y) && !(rx === cat.x && ry === cat.y)) {
            hcPotions.push({ x: rx, y: ry, type: Math.random() < 0.5 ? 'green' : 'blue', ttl: randInt(6, 9) });
            break;
          }
        }
      }
      hcPotionSpawnTimer = randInt(5, 9);
    }
    for (let i = hcPotions.length - 1; i >= 0; i--) {
      hcPotions[i].ttl -= dt;
      if (hcPotions[i].ttl <= 0) hcPotions.splice(i, 1);
    }
    if (hcSpeedBoostTimer > 0) hcSpeedBoostTimer = Math.max(0, hcSpeedBoostTimer - dt);
    if (hcGreenGlowTimer > 0) hcGreenGlowTimer = Math.max(0, hcGreenGlowTimer - dt);
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background grid-like
    ctx.drawImage(gridCache, 0, 0);
    // ambient glows
    if (hcGreenGlowTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.10 * (hcGreenGlowTimer / 0.7);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (hcSpeedBoostTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    // walls
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) if (grid[y][x] === 1) {
        const px = x * cellW + 2, py = y * cellH + 2;
        const w = cellW - 4, h = cellH - 4;
        const isBorder = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
        ctx.fillStyle = isBorder ? 'rgba(239,68,68,0.28)' : 'rgba(255,255,255,0.08)';
        roundRect(ctx, px, py, w, h, 6);
        ctx.fill();
      }
    }
    // potions
    for (const p of hcPotions) {
      const px = p.x * cellW;
      const py = p.y * cellH;
      const pad = 4;
      const w = cellW - pad * 2, h = cellH - pad * 2;
      const color = p.type === 'green' ? '#22c55e' : '#3b82f6';
      drawFlaskIcon(ctx, px + pad, py + pad, w, h, color);
    }
    // Interpolated positions
    const pt = playerAnim.active ? Math.min(1, playerAnim.t / playerAnim.dur) : 1;
    const pfx = ((playerAnim.active ? playerAnim.fromX + (playerAnim.toX - playerAnim.fromX) * pt : player.x)) * cellW;
    const pfy = ((playerAnim.active ? playerAnim.fromY + (playerAnim.toY - playerAnim.fromY) * pt : player.y)) * cellH;
    const ct = catAnim.active ? Math.min(1, catAnim.t / catAnim.dur) : 1;
    const cfx = ((catAnim.active ? catAnim.fromX + (catAnim.toX - catAnim.fromX) * ct : cat.x)) * cellW;
    const cfy = ((catAnim.active ? catAnim.fromY + (catAnim.toY - catAnim.fromY) * ct : cat.y)) * cellH;

    // player as image
    (function(){
      const pad = 2; const w = cellW - pad*2; const h = cellH - pad*2;
      if (mouseImg.complete && mouseImg.naturalWidth > 0) {
        ctx.drawImage(mouseImg, pfx + pad, pfy + pad, w, h);
      } else {
        const grd = ctx.createLinearGradient(pfx, pfy, pfx + w, pfy + h);
        grd.addColorStop(0, '#e5e7eb'); grd.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = grd; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        roundRect(ctx, pfx + pad, pfy + pad, w, h, 10); ctx.fill(); ctx.stroke();
      }
    })();

    // cat as image
    const pad = 2; const cx = cfx + pad; const cy = cfy + pad; const cw = cellW - pad*2; const ch = cellH - pad*2;
    if (catImg.complete && catImg.naturalWidth > 0) { ctx.drawImage(catImg, cx, cy, cw, ch); }
    else { drawRoundedCell(cat.x, cat.y, '#ef4444', '#f59e0b'); }
    hud.querySelector('#hc-time').textContent = Math.max(0, timeLeft).toFixed(1);
    const f = fpsMeter.tick(performance.now());
    hud.querySelector('#hc-fps').textContent = String(f);

    // Update Elixir HUD (show active timers)
    elixirHud.innerHTML = '';
    const timers = [];
    if (hcSpeedBoostTimer > 0) timers.push({ type:'blue', ttl: hcSpeedBoostTimer });
    for (const p of hcPotions) timers.push({ type: p.type, ttl: p.ttl });
    timers.sort((a,b)=>a.ttl - b.ttl);
    for (const t of timers.slice(0,2)) {
      const item = document.createElement('div'); item.className = 'elixir'; item.setAttribute('data-tip', t.type === 'green' ? 'Зелёное зелье: +время' : 'Скорость: активный буст');
      const icon = document.createElement('canvas'); icon.width = 24; icon.height = 24; icon.className = 'icon';
      const ict = icon.getContext('2d'); drawFlaskIcon(ict, 0, 0, 24, 24, t.type === 'green' ? '#22c55e' : '#3b82f6');
      const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('span');
      const base = t.type === 'blue' ? 5 : 9; const pct = Math.max(0, Math.min(1, t.ttl / base));
      fill.style.transform = `scaleY(${pct})`; bar.appendChild(fill);
      const label = document.createElement('div'); label.className = 'label'; label.textContent = (t.type === 'green' ? 'Зелье' : 'Скорость') + ' ' + t.ttl.toFixed(1) + 'с';
      item.append(icon, bar, label); elixirHud.appendChild(item);
    }
  }

  // helpers
  function drawRoundedCell(cx, cy, c1, c2) {
    const pad = 4; const x = cx * cellW; const y = cy * cellH; const w = cellW - pad*2; const h = cellH - pad*2;
    const grd = ctx.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    ctx.fillStyle = grd; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    roundRect(ctx, x + pad, y + pad, w, h, 6);
    ctx.fill(); ctx.stroke();
  }

  // removed createGridCache (now prerendered once)

  function showOverlay(title, sub, kind) {
    overlay.style.display = 'flex';
    overlay.classList.remove('win', 'lose');
    if (kind === 'win') overlay.classList.add('win');
    if (kind === 'lose') overlay.classList.add('lose');
    overlay.querySelector('#hc-status-title').textContent = title;
    overlay.querySelector('#hc-status-sub').textContent = sub || '';
  }
  function hideOverlay() { overlay.style.display = 'none'; overlay.classList.remove('win', 'lose'); }

  function togglePause() {
    paused = !paused; if (paused) showOverlay('Пауза', 'Отдыхаем'); else { hideOverlay(); lastTs = performance.now(); }
    togglePauseButtons(paused);
  }

  let catTimer = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
    if (!paused) {
      update(dt);
      draw();
    }
    rafId = requestAnimationFrame(loop);
  }

  const restartBtn = overlay.querySelector('#hc-restart');
  const homeBtn = overlay.querySelector('#hc-home');
  const resumeBtn = overlay.querySelector('#hc-resume');
  restartBtn.addEventListener('click', () => {
    hideOverlay();
    // Full remount for гарантированный чистый старт
    try { cancelAnimationFrame(rafId); } catch {}
    root.innerHTML = '';
    // Defer to next microtask to ensure DOM is clean
    setTimeout(() => startGame('hideFromCat'), 0);
  });
  homeBtn.addEventListener('click', () => { backToHome(); });
  resumeBtn.addEventListener('click', () => { paused = false; hideOverlay(); togglePauseButtons(false); lastTs = performance.now(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);

  return {
    pause: () => { if (!running) return; paused = true; showOverlay('Пауза', ''); },
    resume: () => { if (!running) return; paused = false; hideOverlay(); lastTs = performance.now(); },
    unmount: () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); root.innerHTML = ''; }
  };
}
// ============================
// Coming Soon modal for the third card
// ============================
const comingSoonBtn = document.getElementById('show-coming-soon');
if (comingSoonBtn) {
  comingSoonBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="status-card">
        <h3>Скоро новые квесты</h3>
        <p>Следи за обновлениями: лабиринты, прятки от кота и другое.</p>
        <div style="display:flex; gap:10px; margin-top:6px; justify-content:flex-end">
          <button class="btn primary" id="cs-ok"><svg><use href="#icon-play"/></svg> Ок</button>
        </div>
      </div>
    `;
    function close() { document.body.removeChild(overlay); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#cs-ok').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}

// Initial view
showView('home');
