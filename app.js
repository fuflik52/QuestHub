// Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const byId = (id) => document.getElementById(id);

// 3D particles background
const space = byId('space');
let numParticles = 60; // reduced for performance
const depthMin = -500;
const depthMax = 300;
function randomIn(min, max) { return Math.random() * (max - min) + min; }
function spawnParticles() {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    if (Math.random() < 0.45) p.setAttribute('data-variant', 'v');
    p.style.left = randomIn(-5, 105) + '%';
    p.style.top = randomIn(-5, 105) + '%';
    p.style.setProperty('--z', randomIn(depthMin, depthMax) + 'px');
    p.style.opacity = String(randomIn(0.65, 1));
    p.style.filter = `drop-shadow(0 0 ${randomIn(6, 16)}px rgba(139,92,246,0.45)) drop-shadow(0 0 ${randomIn(10, 24)}px rgba(6,182,212,0.45))`;
    fragment.appendChild(p);
  }
  space.appendChild(fragment);
}

// Subtle parallax
let parallaxTargetX = 0, parallaxTargetY = 0, parallaxX = 0, parallaxY = 0;
document.addEventListener('pointermove', (e) => {
  const rx = (e.clientX / window.innerWidth) * 2 - 1;
  const ry = (e.clientY / window.innerHeight) * 2 - 1;
  parallaxTargetX = rx * 10;
  parallaxTargetY = ry * -10;
});
function raf() {
  parallaxX += (parallaxTargetX - parallaxX) * 0.035;
  parallaxY += (parallaxTargetY - parallaxY) * 0.035;
  if (space) space.style.transform = `rotateX(${parallaxY}deg) rotateY(${parallaxX}deg)`;
  requestAnimationFrame(raf);
}

// Registration modal
const modal = byId('modal');
const modalCard = byId('modalCard');
const openModalTop = byId('openModalTop');
const openModalHero = byId('openModalHero');
const closeModal = byId('closeModal');
function openModal() {
  modal.classList.add('open');
  modal.removeAttribute('aria-hidden');
  setTimeout(() => byId('name').focus(), 30);
}
function hideModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}
openModalTop.addEventListener('click', openModal);
openModalHero.addEventListener('click', openModal);
closeModal.addEventListener('click', hideModal);
modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideModal(); });

// Card tilt
let tiltX = 0, tiltY = 0, tx = 0, ty = 0;
function handleTilt(e) {
  const rect = modalCard.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = (e.clientX - cx) / rect.width;
  const ry = (e.clientY - cy) / rect.height;
  tx = ry * -10;
  ty = rx * 10;
}
function animateTilt() {
  tiltX += (tx - tiltX) * 0.08;
  tiltY += (ty - tiltY) * 0.08;
  modalCard.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  requestAnimationFrame(animateTilt);
}
if (modalCard) {
  modalCard.addEventListener('pointermove', handleTilt);
  modalCard.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
}

// Registration form validation
const form = byId('signupForm');
const password = byId('password');
const confirm = byId('confirm');
const matchError = byId('matchError');
const strengthBar = byId('strengthBar');
const togglePassword = byId('togglePassword');
function evaluatePasswordStrength(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-ZА-Я]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^\w\s]/.test(value)) score += 1;
  return Math.min(score, 4);
}
function updateStrength() {
  const score = evaluatePasswordStrength(password.value);
  const widths = ['10%', '40%', '70%', '100%'];
  strengthBar.style.setProperty('--w', widths[Math.max(0, score - 1)] || '0%');
}
function checkMatch() {
  const ok = password.value && confirm.value && password.value === confirm.value;
  matchError.classList.toggle('show', !ok && confirm.value.length > 0);
  return ok;
}
password.addEventListener('input', () => { updateStrength(); checkMatch(); });
confirm.addEventListener('input', checkMatch);
togglePassword.addEventListener('click', () => {
  const isPass = password.type === 'password';
  password.type = isPass ? 'text' : 'password';
  confirm.type = isPass ? 'text' : 'password';
  togglePassword.textContent = isPass ? 'Скрыть' : 'Показать';
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const valid = form.checkValidity() && checkMatch();
  if (!valid) { form.reportValidity(); return; }
  const user = {
    name: byId('name').value.trim(),
    email: byId('email').value.trim(),
    createdAt: new Date().toISOString()
  };
  // Persist fake user to localStorage
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  users.unshift({ ...user, status: Math.random() > 0.2 ? 'active' : 'pending' });
  localStorage.setItem('users', JSON.stringify(users.slice(0, 50)));

  // Mark logged-in for demo
  localStorage.setItem('loggedIn', 'true');
  renderAppState();
  hideModal();
  toast(`Добро пожаловать, ${user.name || 'пользователь'}!`);
  loadAdminData();
});

// Login modal
const loginModal = byId('loginModal');
const loginCard = byId('loginCard');
const openLoginTop = byId('openLoginTop');
const closeLogin = byId('closeLogin');
const loginForm = byId('loginForm');
function openLogin() { loginModal.classList.add('open'); loginModal.removeAttribute('aria-hidden'); setTimeout(() => byId('loginEmail').focus(), 30); }
function hideLogin() { loginModal.classList.remove('open'); loginModal.setAttribute('aria-hidden', 'true'); }
openLoginTop.addEventListener('click', openLogin);
closeLogin.addEventListener('click', hideLogin);
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) hideLogin(); });

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!loginForm.checkValidity()) { loginForm.reportValidity(); return; }
  const email = byId('loginEmail').value.trim();
  const password = byId('loginPassword').value;
  // Fake check
  if (password.length >= 8) {
    localStorage.setItem('loggedIn', 'true');
    hideLogin();
    renderAppState();
    loadAdminData();
    toast('Успешный вход');
  } else {
    toast('Неверные данные', true);
  }
});

// Logout
const logoutBtn = byId('logoutBtn');
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('loggedIn');
  renderAppState();
  toast('Вы вышли из системы');
});

// Toast helper
function toast(message, isError = false) {
  const el = document.createElement('div');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed', left: '50%', top: '24px', transform: 'translateX(-50%)',
    background: isError ? 'linear-gradient(180deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' : 'linear-gradient(180deg, rgba(34,197,94,0.18), rgba(34,197,94,0.12))',
    color: 'var(--text)', border: isError ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(34,197,94,0.35)',
    borderRadius: '12px', padding: '10px 14px', zIndex: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', backdropFilter: 'var(--glass)'
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// Admin rendering
const heroSection = byId('heroSection');
const adminSection = byId('adminSection');
function renderAppState() {
  const logged = localStorage.getItem('loggedIn') === 'true';
  heroSection.classList.toggle('hidden', logged);
  adminSection.classList.toggle('hidden', !logged);
  byId('openModalTop').classList.toggle('hidden', logged);
  byId('openLoginTop').classList.toggle('hidden', logged);
  logoutBtn.classList.toggle('hidden', !logged);
}

// Fake admin data and chart
let chart;
function loadAdminData() {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  // Metrics
  const totalUsers = users.length;
  byId('metricUsers').textContent = String(totalUsers);
  byId('metricUsersDelta').textContent = `+${Math.max(0, Math.round(Math.random() * 25))}%`;
  const revenue = totalUsers * (50 + Math.round(Math.random() * 150));
  byId('metricRevenue').textContent = `$${revenue.toLocaleString('en-US')}`;
  const aov = totalUsers ? revenue / totalUsers : 0;
  byId('metricAov').textContent = `$${aov.toFixed(2)}`;
  byId('metricConv').textContent = `${(2 + Math.random() * 4).toFixed(1)}%`;

  // Users table
  const tbody = byId('usersTbody');
  tbody.innerHTML = '';
  users.slice(0, 15).forEach((u, idx) => {
    const tr = document.createElement('tr');
    const date = new Date(u.createdAt || Date.now() - idx * 86400000);
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${u.name || '—'}</td>
      <td>${u.email || '—'}</td>
      <td>${date.toLocaleDateString()}</td>
      <td><span class="badge ${u.status === 'active' ? 'success' : 'muted'}">${u.status || 'active'}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Chart
  const labels = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (11 - i));
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}`;
  });
  const data = labels.map(() => Math.round(Math.random() * 20) + (Math.random() > 0.6 ? 10 : 0));
  const ctx = byId('chartDaily').getContext('2d');
  const runChart = () => {
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Регистрации',
          data,
          borderColor: 'rgba(139, 92, 246, 0.9)',
          backgroundColor: 'rgba(139, 92, 246, 0.18)',
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        }]
      },
      options: {
        responsive: true,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  };
  if (window.Chart) {
    runChart();
  } else {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = runChart;
    document.head.appendChild(s);
  }
}

// Add fake user button
byId('addUserBtn').addEventListener('click', () => {
  const users = JSON.parse(localStorage.getItem('users') || '[]');
  const id = users.length + 1;
  users.unshift({ name: `User ${id}`, email: `user${id}@example.com`, createdAt: new Date().toISOString(), status: Math.random() > 0.3 ? 'active' : 'pending' });
  localStorage.setItem('users', JSON.stringify(users.slice(0, 50)));
  loadAdminData();
  toast('Пользователь добавлен');
});

// Init
// Performance mode detection
const isLowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
if (isLowEnd || isMobile) {
  document.documentElement.classList.add('perf');
  numParticles = 25;
}

spawnParticles();
requestAnimationFrame(raf);
requestAnimationFrame(animateTilt);
byId('year').textContent = new Date().getFullYear();
renderAppState();
if (localStorage.getItem('loggedIn') === 'true') loadAdminData();

// No-copy and F12 prevention (best-effort; не полная защита)
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('copy', (e) => { e.preventDefault(); });
document.addEventListener('cut', (e) => { e.preventDefault(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); }
  if ((e.ctrlKey || e.metaKey) && ['c', 'u', 's', 'p'].includes(e.key.toLowerCase())) {
    e.preventDefault(); e.stopPropagation();
  }
  // Ctrl+Shift+I/J/Cmd+Opt+I etc.
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) {
    e.preventDefault(); e.stopPropagation();
  }
});
document.body.classList.add('nocopy');

// Additional basic anti-debug (ineffective for advanced users)
setInterval(function(){
  const start = performance.now();
  debugger; // may trigger in some cases
  const time = performance.now() - start;
  if (time > 200) {
    // If devtools pauses, attempt to redirect or obfuscate
    console.log('devtools');
  }
}, 3000);


