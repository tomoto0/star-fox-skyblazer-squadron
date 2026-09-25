// Canonical module entry loaded by index.html. It forwards its own ?v= cache key
// to the game module, and if any module in the graph fails to load (a missing
// path is answered with a JavaScript 404, never the game HTML) it says so on
// screen instead of leaving a silent black canvas.
const version = new URL(import.meta.url).search;

import(`./main.js${version}`).catch((err) => {
  console.error('[bootstrap] game modules failed to load', err);
  const note = document.createElement('div');
  note.setAttribute('role', 'alert');
  note.textContent = 'FLIGHT DATA FAILED TO LOAD — PLEASE RELOAD';
  note.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:24px;'
    + 'text-align:center;font:800 16px/1.4 "Exo 2",sans-serif;letter-spacing:2px;color:#ff8a9e;background:#0a0a18;';
  document.body.appendChild(note);
});
