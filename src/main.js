import { Game } from './game/game.js';

const canvas = document.getElementById('gl');
const game = new Game(canvas);

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// expose for debugging
window.__game = game;
