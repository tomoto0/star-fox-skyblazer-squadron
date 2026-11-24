/**
 * Zone visual definitions distilled from the four concept paintings (STAR_FOX_1..4):
 *  Z1 AZURE SEA     — luminous sunset ocean, sea stacks, golden sun reflection (concept 4)
 *  Z2 CASCADE GORGE — bright sunlit day, warm sandstone cliffs, waterfalls, cobalt river (concept 1)
 *  Z3 EMBER CANYON  — fiery amber-violet dusk canyon, dark volcanic basalt, molten glow (concept 2)
 *  Z4 DUNE SEA      — bold cerulean sky, glowing cel cumulus clouds, golden dunes (concept 3)
 */
export const ZONES = {
  sea: {
    id: 'sea', name: 'AZURE SEA', terrain: 'ocean', skyImage: 'sky_sea', photoOpacity: 0.18,
    sky: {
      top: 0x1c4b8f, mid: 0xc46b88, horizon: 0xffbe74,
      sun: 0xfff6cf, sunSize: 0.056, sunGlow: 0xffa64d, sunY: 0.13,
      cloudTint: 0xffead2, clouds: 0.72,
      planet: 0xd8a8c6, planetRing: 0xffd2a0,
    },
    fog: { color: 0xbc919c, near: 460, far: 1950 },
    hemi: { sky: 0xffdfb8, ground: 0x153a5e, i: 1.18 },
    sun: { color: 0xffd699, i: 1.45, pos: [0.14, 0.28, -1] },
    water: { deep: 0x0d3d68, shallow: 0x1ea3b8, glint: 0xffcf78 },
    rock: { base: 0x2b455e, top: 0x7c8f8f, rim: 0xdca98a },
    floorY: 0,
    music: 'sea',
  },
  gorge: {
    id: 'gorge', name: 'CASCADE GORGE', terrain: 'gorge', skyImage: 'sky_day', photoOpacity: 0.22,
    sky: {
      top: 0x1866c9, mid: 0x62b4eb, horizon: 0xd6f2ff,
      sun: 0xffffff, sunSize: 0.022, sunGlow: 0xe8f9ff, sunY: 0.34,
      cloudTint: 0xffffff, clouds: 0.80,
      planet: 0xaad6ff, planetRing: 0xe6f6ff,
    },
    fog: { color: 0x9cd2ea, near: 520, far: 2050 },
    hemi: { sky: 0xe6f7ff, ground: 0x2d5866, i: 1.12 },
    sun: { color: 0xfff3d4, i: 1.44, pos: [0.42, 0.82, -0.5] },
    water: { deep: 0x0f4c85, shallow: 0x2ab0c6, glint: 0xe4ffff },
    rock: { base: 0x7a6246, top: 0xdfb982, moss: 0x45a846, rim: 0xf4e4c1 },
    floorY: 0,
    music: 'gorge',
  },
  ember: {
    id: 'ember', name: 'EMBER CANYON', terrain: 'ember', skyImage: 'sky_sunset', photoOpacity: 0.14,
    sky: {
      top: 0x1e224a, mid: 0x8c3c58, horizon: 0xff9838,
      sun: 0xfff0aa, sunSize: 0.044, sunGlow: 0xff6b26, sunY: 0.09,
      cloudTint: 0xf29f7e, clouds: 0.68,
      planet: 0x9d5b7a, planetRing: 0xffa064,
    },
    fog: { color: 0x7c4654, near: 420, far: 1760 },
    hemi: { sky: 0xf0a672, ground: 0x221728, i: 1.12 },
    sun: { color: 0xffb866, i: 1.62, pos: [-0.18, 0.22, -1] },
    rock: { base: 0x281826, top: 0x7e3c3c, rim: 0xe86e38, glow: 0xff5522 },
    ground: { base: 0x241c2d, lit: 0x563544 },
    floorY: 0,
    music: 'ember',
  },
  dune: {
    id: 'dune', name: 'DUNE SEA', terrain: 'dune', skyImage: 'sky_desert', photoOpacity: 0.18,
    sky: {
      top: 0x1a68c4, mid: 0x6dbce8, horizon: 0xfae0b8,
      sun: 0xfffce0, sunSize: 0.025, sunGlow: 0xfff0be, sunY: 0.36,
      cloudTint: 0xfffdf5, clouds: 0.88,
      planet: 0xc2b2e0, planetRing: 0xfbe5be,
    },
    fog: { color: 0xdfc9a6, near: 540, far: 2150 },
    hemi: { sky: 0xfff2d2, ground: 0x7d5836, i: 1.12 },
    sun: { color: 0xffefc4, i: 1.40, pos: [0.48, 0.78, -0.6] },
    sand: { base: 0xd99b4e, lit: 0xf7d48e, shade: 0x996130 },
    rock: { base: 0x7c4e36, top: 0xd49b5c, rim: 0xf6d89e },
    floorY: 0,
    music: 'dune',
  },
};

/** wave number (1-based) -> zone */
export const WAVE_ZONE = [null,
  ZONES.sea, ZONES.sea, ZONES.sea,
  ZONES.gorge, ZONES.gorge, ZONES.gorge,
  ZONES.ember, ZONES.ember, ZONES.ember,
  ZONES.dune, ZONES.dune, ZONES.dune,
  ZONES.ember, ZONES.ember,
  ZONES.dune, ZONES.dune,
];
