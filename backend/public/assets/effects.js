'use strict';

/* Orion site motion — React Bits / Uiverse techniques, vanilla.
   Spotlight, magnet, glare, tilt, star-border, click-spark, aurora, split text. */

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(pointer: fine)').matches;

function injectLayers() {
  if (document.querySelector('.fx-aurora')) return;
  const aurora = document.createElement('div');
  aurora.className = 'fx-aurora';
  aurora.setAttribute('aria-hidden', 'true');
  aurora.innerHTML = '<i class="a1"></i><i class="a2"></i><i class="a3"></i>';
  const grain = document.createElement('div');
  grain.className = 'fx-grain';
  grain.setAttribute('aria-hidden', 'true');
  document.body.prepend(grain);
  document.body.prepend(aurora);
}

function initCursor() {
  if (REDUCE || !FINE) return;
  const orb = document.createElement('div');
  orb.className = 'fx-cursor';
  orb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(orb);
  let x = 0, y = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    orb.classList.add('on');
  }, { passive: true });
  window.addEventListener('pointerleave', () => orb.classList.remove('on'));
  const tick = () => {
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    orb.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function initSpotlight() {
  document.querySelectorAll('[data-spotlight]').forEach((el) => {
    if (el.dataset.fxSpot) return;
    el.dataset.fxSpot = '1';
    el.classList.add('fx-spot');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sx', `${e.clientX - r.left}px`);
      el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

function initMagnet() {
  if (REDUCE || !FINE) return;
  document.querySelectorAll('[data-magnet]').forEach((el) => {
    if (el.dataset.fxMag) return;
    el.dataset.fxMag = '1';
    const strength = Number(el.getAttribute('data-magnet')) || 18;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx / strength}px, ${dy / strength}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

function initGlare() {
  document.querySelectorAll('[data-glare]').forEach((el) => {
    el.classList.add('fx-glare');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
    }, { passive: true });
  });
}

function initTilt() {
  if (REDUCE || !FINE) return;
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = Number(el.getAttribute('data-tilt')) || 8;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1100px) rotateY(${px * max}deg) rotateX(${-py * max}deg)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

function initStarButtons() {
  document.querySelectorAll('.btn-primary, [data-star]').forEach((el) => {
    if (el.querySelector('.fx-star')) return;
    el.classList.add('fx-star-btn');
    const shine = document.createElement('span');
    shine.className = 'fx-star';
    shine.setAttribute('aria-hidden', 'true');
    el.appendChild(shine);
  });
}

function initSplit() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    if (el.dataset.splitDone) return;
    const text = el.textContent;
    el.dataset.splitDone = '1';
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(/(\s+)/).map((chunk, i) => {
      if (/^\s+$/.test(chunk)) return chunk;
      return `<span class="fx-word" style="--i:${i}"><span>${chunk}</span></span>`;
    }).join('');
  });
}

function initCount() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = Number(el.getAttribute('data-count')) || 0;
      const dur = Number(el.getAttribute('data-count-ms')) || 1100;
      io.unobserve(el);
      if (REDUCE) { el.textContent = String(end); return; }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(end * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
}

function initClickSpark() {
  if (REDUCE) return;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('a, button');
    if (!t) return;
    const spark = document.createElement('span');
    spark.className = 'fx-spark';
    spark.style.left = `${e.clientX}px`;
    spark.style.top = `${e.clientY}px`;
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 520);
  });
}

function initMarquee() {
  document.querySelectorAll('[data-marquee]').forEach((el) => {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    const inner = el.innerHTML;
    el.innerHTML = `<div class="fx-marquee-track">${inner}${inner}</div>`;
  });
}

function bootEffects() {
  injectLayers();
  initCursor();
  initSpotlight();
  initMagnet();
  initGlare();
  initTilt();
  initStarButtons();
  initSplit();
  initCount();
  initClickSpark();
  initMarquee();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootEffects);
} else {
  bootEffects();
}

window.OrionFX = { bootEffects, initSpotlight, initStarButtons, initMagnet };