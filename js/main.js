// QuestHub main module
// Modern UI, EXP system, and two quests: MouseSnake (snake-like) and CheeseCatcher

'use strict';

// DOM refs
const dom = {
  views: {
    home: document.getElementById('view-home'),
    game: document.getElementById('view-game'),
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

// Simple router/view switch
function showView(name) {
  for (const key of Object.keys(dom.views)) {
    dom.views[key].classList.toggle('current', key === name);
  }
  // Toggle minimal chrome while playing
  document.body.classList.toggle('playing', name === 'game');
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
        <button class="btn primary" id="sn-restart"><svg><use href="#icon-play"/></svg> Заново</button>
        <button class="btn" id="sn-home"><svg><use href="#icon-arrow-left"/></svg> В меню</button>
      </div>
    </div>
  `;
  wrap.appendChild(overlay);

  // State
  const cols = 32, rows = 24;
  const cellW = canvas.width / cols, cellH = canvas.height / rows;

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
  })();

  let snake = [];
  let prevSnake = [];
  let dir = { x: 1, y: 0 };
  const dirQueue = [];
  let cheese = null;
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
    placeCheese();
    updateHUD();
    hideOverlay();
    fpsMeter.reset();
  }

  function updateHUD() {
    hud.querySelector('#sn-score').textContent = String(score);
    hud.querySelector('#sn-speed').textContent = String(speed.toFixed(1));
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
    updateHUD();
  }

  function draw() {
    // clear and draw static grid from offscreen buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(gridCanvas, 0, 0);

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
    const stepDur = 1 / speed;
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

  function showOverlay(title, sub) {
    overlay.style.display = 'flex';
    overlay.querySelector('#sn-status-title').textContent = title;
    overlay.querySelector('#sn-status-sub').textContent = sub || '';
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
      acc += dt;
      const stepDur = 1 / speed;
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

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'status-overlay'; overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="status-card">
      <h3 id="hc-status-title">Пауза</h3>
      <p id="hc-status-sub"></p>
      <div style="display:flex; gap:10px; margin-top:6px">
        <button class="btn primary" id="hc-restart"><svg><use href="#icon-play"/></svg> Заново</button>
        <button class="btn" id="hc-home"><svg><use href="#icon-arrow-left"/></svg> В меню</button>
      </div>
    </div>`;
  wrap.appendChild(overlay);

  const cols = 32, rows = 24;
  const cellW = canvas.width / cols, cellH = canvas.height / rows;

  // Simple maze generation (randomized obstacles)
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
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
    startAnim(ent, anim, nx, ny, durSec);
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
    }

    // timer
    timeLeft -= dt;
    if (timeLeft <= 0 && running) {
      running = false;
      const gained = mode === 'hard' ? 120 : 80;
      try { Music.stop(); } catch {}
      showOverlay('Выжил!', `Поздравляем! Награда: +${gained} EXP`, 'win');
      XP.add(gained, 'Прятки от Кота — победа');
    }
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background grid-like
    ctx.drawImage(createGridCache(), 0, 0);
    // walls
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) if (grid[y][x] === 1) {
        const px = x * cellW + 2, py = y * cellH + 2;
        const w = cellW - 4, h = cellH - 4;
        roundRect(ctx, px, py, w, h, 6);
        ctx.fill();
      }
    }
    // Interpolated positions
    const pt = playerAnim.active ? Math.min(1, playerAnim.t / playerAnim.dur) : 1;
    const pfx = ((playerAnim.active ? playerAnim.fromX + (playerAnim.toX - playerAnim.fromX) * pt : player.x)) * cellW;
    const pfy = ((playerAnim.active ? playerAnim.fromY + (playerAnim.toY - playerAnim.fromY) * pt : player.y)) * cellH;
    const ct = catAnim.active ? Math.min(1, catAnim.t / catAnim.dur) : 1;
    const cfx = ((catAnim.active ? catAnim.fromX + (catAnim.toX - catAnim.fromX) * ct : cat.x)) * cellW;
    const cfy = ((catAnim.active ? catAnim.fromY + (catAnim.toY - catAnim.fromY) * ct : cat.y)) * cellH;

    // player
    (function(){
      const pad = 4; const w = cellW - pad*2; const h = cellH - pad*2;
      const grd = ctx.createLinearGradient(pfx, pfy, pfx + w, pfy + h);
      grd.addColorStop(0, '#22d3ee'); grd.addColorStop(1, '#a78bfa');
      ctx.fillStyle = grd; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      roundRect(ctx, pfx + pad, pfy + pad, w, h, 6); ctx.fill(); ctx.stroke();
    })();

    // cat as image
    const pad = 2; const cx = cfx + pad; const cy = cfy + pad; const cw = cellW - pad*2; const ch = cellH - pad*2;
    if (catImg.complete && catImg.naturalWidth > 0) { ctx.drawImage(catImg, cx, cy, cw, ch); }
    else { drawRoundedCell(cat.x, cat.y, '#ef4444', '#f59e0b'); }
    hud.querySelector('#hc-time').textContent = Math.max(0, timeLeft).toFixed(1);
    const f = fpsMeter.tick(performance.now());
    hud.querySelector('#hc-fps').textContent = String(f);
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

  let gridCache = null;
  function createGridCache() {
    if (gridCache) return gridCache;
    gridCache = document.createElement('canvas');
    gridCache.width = canvas.width; gridCache.height = canvas.height;
    const g = gridCache.getContext('2d');
    g.save(); g.globalAlpha = 0.06; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(x*cellW+0.5, 0); g.lineTo(x*cellW+0.5, canvas.height); g.stroke(); }
    for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y*cellH+0.5); g.lineTo(canvas.width, y*cellH+0.5); g.stroke(); }
    g.restore();
    return gridCache;
  }

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
  restartBtn.addEventListener('click', () => {
    hideOverlay();
    // Full remount for гарантированный чистый старт
    try { cancelAnimationFrame(rafId); } catch {}
    root.innerHTML = '';
    // Defer to next microtask to ensure DOM is clean
    setTimeout(() => startGame('hideFromCat'), 0);
  });
  homeBtn.addEventListener('click', () => { backToHome(); });
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
