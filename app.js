/* Kicks & Soxs — app.js */

// ── Custom cursor ──
const cursor    = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');

let cx = -100, cy = -100;
let mx = -100, my = -100;

document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

(function trackCursor() {
  cx += (mx - cx) * .12;
  cy += (my - cy) * .12;
  cursor.style.left    = cx + 'px';
  cursor.style.top     = cy + 'px';
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top  = my + 'px';
  requestAnimationFrame(trackCursor);
})();

// Cursor state by section
const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    cursor.className = 'cursor';
    if (entry.target.id === 'products') cursor.classList.add('big');
    if (entry.target.id === 'about')    cursor.classList.add('blue');
    if (entry.target.id === 'contact')  cursor.classList.add('green');
  });
}, { threshold: .5 });

sections.forEach(s => observer.observe(s));

// Hoverable elements enlarge cursor
document.querySelectorAll('a, button, .product-card, .hood-tag').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.style.transform = 'translate(-50%,-50%) scale(1.5)');
  el.addEventListener('mouseleave', () => cursor.style.transform = 'translate(-50%,-50%) scale(1)');
});

// ── Navbar scroll state ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile nav toggle ──
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Scroll reveal ──
const revealEls = document.querySelectorAll(
  '.product-card, .about-grid, .contact-inner, .section-header, .stats-row, .hood-cloud'
);

revealEls.forEach(el => el.classList.add('reveal'));

const revealObs = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = (i * .06) + 's';
      entry.target.classList.add('in-view');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: .12 });

revealEls.forEach(el => revealObs.observe(el));

// ── Count-up animation ──
function countUp(el, target, suffix) {
  const dur = 1600;
  const t0  = performance.now();
  (function frame(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);           // ease-out-cubic
    el.textContent = Math.floor(e * target) + suffix;
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = target + suffix;
  })(t0);
}

const statObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el     = entry.target;
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    countUp(el, target, suffix);
    statObs.unobserve(el);
  });
}, { threshold: .6 });

document.querySelectorAll('[data-target]').forEach(el => statObs.observe(el));

// ── Contact form ──
const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-send');
    btn.textContent = 'SENT ✓';
    btn.style.background = '#3A8C3F';
    setTimeout(() => {
      btn.innerHTML = 'SEND IT <span class="send-arrow">→</span>';
      btn.style.background = '';
      form.reset();
    }, 3000);
  });
}

// ── PWA service worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
