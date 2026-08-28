/**
 * Zone visual definitions distilled from the four concept paintings:
 *  Z1 AZURE SEA     — sunset ocean, icebergs, sun on the horizon   (concept 4)
 *  Z2 CASCADE GORGE — bright day, sandy cliffs, waterfalls, river  (concept 1)
 *  Z3 EMBER CANYON  — dusk canyon, dark red rock, glowing fins     (concept 2)
 *  Z4 DUNE SEA      — bright desert, cel clouds, golden dunes      (concept 3)
 */
export const ZONES = {
  sea: {
    id: 'sea', name: 'AZURE SEA', terrain: 'ocean', skyImage: 'sky_sea', photoOpacity: 0.46,
    sky: { top: 0x245d99, mid: 0x79b8da, horizon: 0xf2c8a7, sun: 0xfff2cf, sunSize: 0.042, sunGlow: 0xffbd78, sunY: 0.15, cloudTint: 0xe9eef2, clouds: 0.56 },
    fog: { color: 0x8eb8c7, near: 430, far: 1840 },
    hemi: { sky: 0xcbe7ef, ground: 0x163b55, i: 1.08 },
    sun: { color: 0xffe0b2, i: 1.28, pos: [0.16, 0.36, -1] },
    water: { deep: 0x0f4566, shallow: 0x1c8c9d, glint: 0xffd49c },
    rock: { base: 0x2b4655, top: 0x687c79, rim: 0x9bb59b },
    floorY: 0,
    music: 'sea',
  },
  gorge: {
    id: 'gorge', name: 'CASCADE GORGE', terrain: 'gorge', skyImage: 'sky_day', photoOpacity: 0.58,
    sky: { top: 0x2874c2, mid: 0x7eb9db, horizon: 0xd6e5e0, sun: 0xffffff, sunSize: 0.0, sunGlow: 0xe5f5ff, sunY: 0.3, cloudTint: 0xffffff, clouds: 0.68 },
    fog: { color: 0xaecfd5, near: 500, far: 1980 },
    hemi: { sky: 0xe0f1ef, ground: 0x31545a, i: 0.96 },
    sun: { color: 0xfff1d6, i: 1.26, pos: [0.4, 0.85, -0.5] },
    water: { deep: 0x14557a, shallow: 0x3297aa, glint: 0xd9f8ef },
    rock: { base: 0x62655d, top: 0x9a9580, moss: 0x4e8052, rim: 0xdde0c7 },
    floorY: 0,
    music: 'gorge',
  },
  ember: {
    id: 'ember', name: 'EMBER CANYON', terrain: 'ember', skyImage: 'sky_sunset', photoOpacity: 0.30,
    sky: { top: 0x26344d, mid: 0x765b72, horizon: 0xf0a06a, sun: 0xffe2ad, sunSize: 0.032, sunGlow: 0xff7b45, sunY: 0.10, cloudTint: 0xc59ba2, clouds: 0.54 },
    fog: { color: 0x765b62, near: 410, far: 1720 },
    hemi: { sky: 0xdeaa78, ground: 0x241e29, i: 1.02 },
    sun: { color: 0xffbf7a, i: 1.48, pos: [-0.2, 0.22, -1] },
    rock: { base: 0x261f26, top: 0x59424a, rim: 0xb8755b, glow: 0xff5736 },
    ground: { base: 0x29262d, lit: 0x51414a },
    floorY: 0,
    music: 'ember',
  },
  dune: {
    id: 'dune', name: 'DUNE SEA', terrain: 'dune', skyImage: 'sky_desert', photoOpacity: 0.46,
    sky: { top: 0x2d78bf, mid: 0x8fc7e2, horizon: 0xf1d6b5, sun: 0xfffbdf, sunSize: 0.0, sunGlow: 0xfff2c8, sunY: 0.35, cloudTint: 0xfff7eb, clouds: 0.78 },
    fog: { color: 0xd5d5c3, near: 540, far: 2100 },
    hemi: { sky: 0xffefcf, ground: 0x786247, i: 0.98 },
    sun: { color: 0xffedc8, i: 1.22, pos: [0.5, 0.8, -0.6] },
    sand: { base: 0xc9985f, lit: 0xedc88f, shade: 0x9c7448 },
    rock: { base: 0x72584a, top: 0xba9064, rim: 0xe8cf9c },
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
  // Afterburner campaign: return through ember command space, then the Rift Citadel
  ZONES.ember, ZONES.ember,
  ZONES.dune, ZONES.dune,
];
