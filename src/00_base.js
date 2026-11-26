const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Cor de um token do CSS (ex.: '--plum' → 'rgb(123,45,94)'), para desenhar no canvas com as cores do tema atual. */
const cssRgb = (name, alpha = 1) => { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/ +/g, ','); return alpha < 1 ? `rgba(${v},${alpha})` : `rgb(${v})`; };
