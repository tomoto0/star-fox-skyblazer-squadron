import { Game } from './game/game.js';

const canvas = document.getElementById('gl');
const game = new Game(canvas);

let last = performance.now();
let contextLost = false;
let rafId = 0;

// WebGL context loss resilience: prevent permanent black freeze on GPU reset/sleep
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  game.onContextLost?.();
}, false);

canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  last = performance.now();
  game.onContextRestored?.();
}, false);

// Suspend GPU work while tab is hidden and auto-pause active gameplay so players never die off-tab
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.onTabHidden?.();
  } else {
    last = performance.now();
  }
});

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (document.hidden || contextLost) {
    last = now;
    return;
  }
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.12);
  last = now;
  try {
    game.update(dt);
    game.render();
  } catch (err) {
    console.error('[loop] recovered from frame error:', err);
  }
}
rafId = requestAnimationFrame(loop);

// expose for debugging
window.__game = game;
window.__stopLoop = () => cancelAnimationFrame(rafId);
