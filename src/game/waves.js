import { ZONES } from '../world/palettes.js';

/**
 * Hand-authored wave scripts. Every regular wave follows a three-beat cadence:
 * introduce a readable threat, combine complementary roles, then pay out a
 * power-up or recovery before the next encounter.
 * form: [type, count, pattern, opts]
 */
function ev(t, kind, ...args) { return { t, kind, args }; }

export const WAVES = [null,

  /* ============ ZONE 1 — AZURE SEA: learn the core loop ============ */
  {
    zone: ZONES.sea, length: 62, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'Bowie, bandits over the Azure Sea. Clean them up!', 3.2),
      ev(2.0, 'form', 'drone', 5, 'line', { y: 16 }),                         // aim practice
      ev(4.8, 'form', 'drone', 5, 'vee', { y: 24, x: -24 }),                    // early crossfire follow-up
      ev(7.0, 'rings', 3, -12, 10, 12, 2),
      ev(10.0, 'form', 'drone', 5, 'sideSweep', { y: 24 }),                     // high-speed lateral cut-in!
      ev(16.0, 'form', 'ray', 3, 'rear', { y: 22 }),                            // rear overtake roaring past canopy!
      ev(20.0, 'form', 'kraken', 1, 'popup', { noScale: true }),               // sudden ocean kraken breach!
      ev(22.0, 'form', 'drone', 6, 'skyDive', { x: -12, y: 28 }),              // high-altitude overhead dive squadron!
      ev(28.0, 'rings', 4, 16, 9, -9, 2.5),
      ev(32.0, 'form', 'drone', 6, 'sidePincer', { y: 22, x: 10 }),            // left/right lateral pincer!
      ev(39.0, 'pick', 'laser', 0, 15),                                        // Twin Laser payoff
      ev(40.0, 'say', 'JUNO', 'Twin lasers online. Cut a path through them!', 3.0),
      ev(44.0, 'form', 'ray', 4, 'rearPincer', { y: 26 }),                     // twin-wing rear cross-overtake!
      ev(47.0, 'form', 'breacher', 1, 'popup', { noScale: true }),             // sudden hydro-leviathan breach!
      ev(50.0, 'form', 'mine', 4, 'line', { y: 15, noScale: true }),           // readable mine gate
      ev(55.0, 'form', 'drone', 8, 'line', { y: 24 }),
      ev(59.0, 'rings', 3, 0, 16, 0, 0),
    ],
  },
  {
    zone: ZONES.sea, length: 70, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'Coastal AA batteries ahead. Keep moving!', 3.0),
      ev(2.0, 'form', 'drone', 6, 'vee', { y: 20 }),
      ev(8.0, 'form', 'turret', 3, 'sides', { y: 2, noScale: true }),          // target priority
      ev(12.0, 'form', 'aabattery', 1, 'line', { y: 0, x: -108, noScale: true }), // first fixed AA lock, clear side placement
      ev(14.0, 'form', 'pod', 1, 'line', { y: 24, noScale: true }),
      ev(18.5, 'say', 'JUNO', 'That pod has a wide plasma ring — stay in the gap!', 3.4),
      ev(22.0, 'form', 'ray', 4, 'sideSweep', { y: 24 }),
      ev(26.0, 'form', 'kraken', 2, 'popup', { noScale: true }),               // twin sudden ocean krakens!
      ev(29.0, 'form', 'drone', 6, 'rear', { y: 22, x: 12 }),                  // rear overtake wave!
      ev(35.0, 'form', 'mine', 5, 'vee', { y: 18, noScale: true }),
      ev(40.0, 'pick', 'bomb', -8, 13),                                        // first cluster-clear tool
      ev(43.0, 'form', 'lancer', 3, 'sidePincer', { y: 22, noScale: true }),   // razor lancers cutting in from both flanks!
      ev(49.0, 'form', 'turret', 3, 'sides', { y: 2, noScale: true }),
      ev(52.0, 'form', 'breacher', 2, 'popup', { noScale: true }),             // sudden twin hydro-breachers!
      ev(54.0, 'form', 'pod', 2, 'line', { y: 26, x: -12, noScale: true }),
      ev(59.0, 'form', 'drone', 7, 'helixSurround', { y: 24 }),                // 3D spiral encirclement!
      ev(65.0, 'rings', 5, -20, 10, 10, 2),
    ],
  },
  {
    zone: ZONES.sea, length: 15, boss: 'TempestRay', bossAt: 14,
    events: [
      ev(0.5, 'say', 'REX', 'Massive signal rising from the deep…', 3.0),
      ev(2.0, 'form', 'drone', 4, 'vee', { y: 20, noScale: true }),
      ev(4.5, 'form', 'kraken', 1, 'popup', { noScale: true }),                // surprise ocean kraken vanguard!
      ev(6.0, 'rings', 3, 0, 14, 0, 4),
      ev(10.5, 'alert', '⚠ TEMPEST RAY APPROACHING'),
      ev(11.0, 'say', 'BOWIE', "So that's the storm on the radar. Let's dance!", 3.0),
    ],
  },

  /* ============ ZONE 2 — CASCADE GORGE: vertical pressure ============ */
  {
    zone: ZONES.gorge, length: 72, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'The gorge narrows ahead. Thread the falls, Bowie.', 3.2),
      ev(3.0, 'form', 'scout', 2, 'sides', { y: 38, noScale: true }),          // new airborne spotter
      ev(8.0, 'form', 'drone', 5, 'skyDive', { y: 26 }),                       // plunging gorge dive squad!
      ev(14.0, 'form', 'ray', 3, 'rear', { y: 30 }),                           // rear canyon overtakers!
      ev(17.5, 'form', 'silo', 2, 'popup', { noScale: true }),                 // sudden gorge pop-up silos!
      ev(20.0, 'form', 'aabattery', 1, 'line', { y: 0, x: 112, noScale: true }), // gorge wall AA platform
      ev(24.0, 'form', 'lancer', 3, 'sideSweep', { y: 20, noScale: true }),    // lateral knife-cut lancers!
      ev(27.0, 'form', 'mine', 4, 'line', { y: 22, noScale: true }),
      ev(33.0, 'form', 'pod', 1, 'line', { y: 28, noScale: true }),
      ev(38.0, 'pick', 'laser', 5, 18),                                         // Hyper Laser
      ev(41.0, 'say', 'JUNO', 'Hyper laser online. Sweep the gorge clear!', 3.0),
      ev(45.0, 'form', 'drone', 6, 'rearPincer', { y: 24, x: -10 }),           // rear pincer crisscross!
      ev(48.5, 'form', 'kraken', 1, 'popup', { noScale: true }),               // sudden river kraken!
      ev(51.0, 'form', 'turret', 2, 'sides', { y: 2, noScale: true }),
      ev(56.0, 'form', 'sniper', 1, 'line', { y: 62, x: 46, noScale: true }),
      ev(62.0, 'form', 'ray', 4, 'helixSurround', { y: 30 }),                  // spiral gorge surround!
      ev(67.0, 'rings', 4, 14, 12, -8, 3),
    ],
  },
  {
    zone: ZONES.gorge, length: 76, boss: null,
    events: [
      ev(0.5, 'say', 'JUNO', 'Fortress defenses are waking up. Pick targets fast!', 3.2),
      ev(2.0, 'form', 'turret', 2, 'sides', { y: 2, noScale: true }),
      ev(7.0, 'form', 'flak', 1, 'line', { y: 2, x: -84, noScale: true }),
      ev(12.0, 'form', 'drone', 5, 'sidePincer', { y: 24 }),                   // gorge canyon flank pincer!
      ev(18.0, 'form', 'pod', 2, 'line', { y: 22, noScale: true }),
      ev(22.0, 'form', 'silo', 2, 'popup', { noScale: true }),                 // twin subterranean canyon silos!
      ev(25.0, 'form', 'lancer', 3, 'rear', { y: 22, noScale: true }),         // lancers blasting past from behind!
      ev(31.0, 'form', 'mine', 5, 'vee', { y: 18, noScale: true }),
      ev(37.0, 'pick', 'health', 0, 16),
      ev(41.0, 'form', 'sniper', 1, 'line', { y: 72, x: -54, noScale: true }),
      ev(46.0, 'form', 'drone', 6, 'skyDive', { y: 24 }),                      // high canyon plunge!
      ev(49.5, 'form', 'kraken', 2, 'popup', { noScale: true }),               // twin river krakens!
      ev(52.0, 'form', 'hovertank', 1, 'line', { y: 3, x: 64, noScale: true }),
      ev(58.0, 'form', 'ray', 4, 'rearPincer', { y: 28 }),                     // rear twin-wing overtake!
      ev(64.0, 'form', 'pod', 1, 'line', { y: 25, x: -14, noScale: true }),
      ev(69.0, 'pick', 'bomb', 8, 18),
      ev(72.0, 'rings', 4, -16, 11, 9, 1),
    ],
  },
  {
    zone: ZONES.gorge, length: 15, boss: 'CascadeWarden', bossAt: 14,
    events: [
      ev(0.5, 'say', 'REX', 'Enemy fortress dead ahead — it guards the falls!', 3.2),
      ev(2.0, 'form', 'turret', 2, 'sides', { y: 2, noScale: true }),
      ev(4.0, 'form', 'silo', 2, 'popup', { noScale: true }),                  // sudden flanking silos before Cascade Warden!
      ev(5.0, 'form', 'drone', 3, 'vee', { y: 22, noScale: true }),
      ev(8.0, 'rings', 3, 0, 15, 0, 4),
      ev(10.5, 'alert', '⚠ CASCADE WARDEN AHEAD'),
    ],
  },

  /* ============ ZONE 3 — EMBER CANYON: ace attacks ============ */
  {
    zone: ZONES.ember, length: 76, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'Ember Canyon at dusk. Their ace squadron hunts here.', 3.4),
      ev(3.0, 'form', 'strafer', 2, 'sideSweep', { y: 26, noScale: true }),    // lateral strafer blitz!
      ev(8.0, 'form', 'skytalon', 3, 'rearPincer', { y: 36, noScale: true }),  // ace skytalons overtaking from behind!
      ev(14.0, 'form', 'drone', 6, 'helixSurround', { y: 26 }),                // volcanic 3D spiral surround!
      ev(17.5, 'form', 'wyrm', 2, 'popup', { noScale: true }),                 // sudden volcanic drill-wyrm eruptions!
      ev(20.0, 'form', 'pod', 2, 'line', { y: 23, noScale: true }),
      ev(27.0, 'form', 'mine', 5, 'line', { y: 18, noScale: true }),
      ev(33.0, 'form', 'bomber', 1, 'line', { y: 42, x: 18, noScale: true }),
      ev(38.0, 'pick', 'bomb', -6, 16),
      ev(42.0, 'form', 'ray', 4, 'sidePincer', { y: 28 }),
      ev(45.5, 'form', 'silo', 2, 'popup', { noScale: true }),                 // basalt floor ambush silos!
      ev(48.0, 'form', 'fighter', 3, 'skyDive', { y: 32, noScale: true }),     // overhead fighter dive!
      ev(52.0, 'taskforce', 'pincer', { x: 0, y: 42 }),                            // first readable crossfire formation
      ev(54.0, 'form', 'aabattery', 1, 'line', { y: 0, x: 116, noScale: true }), // basalt AA base beyond the lava-side route edge
      ev(60.0, 'form', 'lancer', 3, 'rear', { y: 22, noScale: true }),         // rear lancer overtake!
      ev(66.0, 'form', 'drone', 7, 'vee', { y: 24, x: -8 }),
      ev(71.0, 'rings', 5, 16, 10, -8, 2.5),
    ],
  },
  {
    zone: ZONES.ember, length: 80, boss: null,
    events: [
      ev(0.5, 'say', 'JUNO', 'Heavy resistance! Hit hard and keep your line open.', 3.0),
      ev(2.0, 'form', 'fighter', 3, 'rearPincer', { y: 28, noScale: true }),   // fighters bursting past from behind!
      ev(8.0, 'form', 'sniper', 1, 'line', { y: 72, x: 62, noScale: true }),
      ev(13.0, 'form', 'hovertank', 2, 'line', { y: 3, x: -52, noScale: true }),
      ev(19.0, 'form', 'pod', 2, 'line', { y: 24, noScale: true }),
      ev(22.5, 'form', 'wyrm', 2, 'popup', { noScale: true }),                 // magma corkscrew wyrms!
      ev(25.0, 'form', 'mine', 6, 'vee', { y: 18, noScale: true }),
      ev(31.0, 'form', 'skytalon', 3, 'sideSweep', { y: 32, noScale: true }),  // lateral skytalon cut-in!
      ev(37.0, 'pick', 'health', 4, 18),
      ev(41.0, 'form', 'drone', 7, 'helixSurround', { y: 26 }),                // 3D spiral swarm!
      ev(45.0, 'form', 'silo', 2, 'popup', { noScale: true }),                 // twin subterranean ember silos!
      ev(47.0, 'form', 'seeker', 2, 'sides', { y: 42, noScale: true }),
      ev(53.0, 'form', 'bomber', 1, 'line', { y: 46, x: -16, noScale: true }),
      ev(57.0, 'form', 'wyrm', 2, 'popup', { noScale: true }),                 // second magma drill-wyrm ambush!
      ev(59.0, 'form', 'turret', 2, 'sides', { y: 2, noScale: true }),
      ev(65.0, 'form', 'pod', 2, 'line', { y: 22, x: 12, noScale: true }),
      ev(71.0, 'form', 'lancer', 4, 'sides', { y: 20, noScale: true }),
      ev(75.0, 'pick', 'laser', -6, 16),
    ],
  },
  {
    zone: ZONES.ember, length: 15, boss: 'EmberSerpent', bossAt: 14,
    events: [
      ev(0.5, 'say', 'REX', 'Seismic readings… something big moves below the rock!', 3.4),
      ev(2.0, 'form', 'ray', 3, 'sides', { y: 25, noScale: true }),
      ev(4.2, 'form', 'wyrm', 2, 'popup', { noScale: true }),                  // twin lava-wyrm eruptions heralding Ember Serpent!
      ev(5.5, 'form', 'lancer', 2, 'sides', { y: 20, noScale: true }),
      ev(8.0, 'rings', 3, 0, 14, 0, 5),
      ev(10.5, 'alert', '⚠ EMBER SERPENT RISING'),
    ],
  },

  /* ============ ZONE 4 — DUNE SEA: final fleet ============ */
  {
    zone: ZONES.dune, length: 80, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'Final stretch — the Dune Sea. Their carrier is close.', 3.4),
      ev(3.0, 'form', 'quadtank', 1, 'line', { y: 3, x: -72, noScale: true }),
      ev(8.0, 'form', 'aabattery', 1, 'line', { y: 0, x: 116, noScale: true }), // dune AA base, readable on the outer mesa shelf
      ev(13.0, 'form', 'fighter', 4, 'sidePincer', { y: 28, noScale: true }),  // desert flank pincer!
      ev(16.5, 'form', 'scorpion', 2, 'popup', { noScale: true }),             // sudden sand-vault scorpion ambush!
      ev(19.0, 'form', 'drone', 7, 'skyDive', { y: 24 }),                      // plunging desert dive wave!
      ev(25.0, 'form', 'mine', 6, 'vee', { y: 19, noScale: true }),
      ev(31.0, 'form', 'bomber', 1, 'line', { y: 46, x: 0, noScale: true }),
      ev(36.0, 'pick', 'laser', 0, 17),
      ev(40.0, 'form', 'lancer', 4, 'rearPincer', { y: 24, noScale: true }),   // lancers streaking from behind!
      ev(44.0, 'form', 'silo', 2, 'popup', { noScale: true }),                 // buried desert pop-up silos!
      ev(46.0, 'form', 'ray', 4, 'sideSweep', { y: 30 }),
      ev(49.0, 'taskforce', 'siege', { x: -36, y: 66, escorts: 4 }),                // Aegis arrives with a visible escort screen
      ev(52.0, 'form', 'fighter', 4, 'helixSurround', { y: 34, noScale: true }), // 3D spiral encirclement!
      ev(56.0, 'form', 'scorpion', 2, 'popup', { noScale: true }),             // twin desert hover-pouncers!
      ev(58.0, 'form', 'hovertank', 2, 'line', { y: 3, x: -36, noScale: true }),
      ev(64.0, 'form', 'pod', 2, 'line', { y: 24, noScale: true }),
      ev(70.0, 'form', 'drone', 8, 'vee', { y: 23, x: -10 }),
      ev(75.0, 'pick', 'bomb', 6, 16),
    ],
  },
  {
    zone: ZONES.dune, length: 84, boss: null,
    events: [
      ev(0.5, 'say', 'JUNO', 'Their whole fleet is scrambling. This is it, Bowie!', 3.2),
      ev(2.0, 'form', 'scout', 2, 'sides', { y: 54, noScale: true }),
      ev(7.0, 'form', 'fighter', 4, 'rearPincer', { y: 28, noScale: true }),
      ev(13.0, 'form', 'mech', 1, 'line', { y: 2, x: 56, noScale: true }),
      ev(19.0, 'form', 'relaydrone', 3, 'helixSurround', { y: 36, noScale: true }),
      ev(22.5, 'form', 'scorpion', 2, 'popup', { noScale: true }),             // sudden dune sand-scorpions!
      ev(25.0, 'form', 'drone', 8, 'sidePincer', { y: 24 }),
      ev(31.0, 'form', 'skyraider', 1, 'line', { y: 72, x: 0, noScale: true }),
      ev(37.0, 'pick', 'health', -4, 18),
      ev(41.0, 'form', 'lancer', 5, 'sideSweep', { y: 22, noScale: true }),
      ev(44.5, 'form', 'wyrm', 2, 'popup', { noScale: true }),                 // sand-burrowing drill-wyrms!
      ev(47.0, 'form', 'pod', 2, 'line', { y: 25, x: 12, noScale: true }),
      ev(53.0, 'form', 'quadtank', 2, 'line', { y: 3, x: -48, noScale: true }),
      ev(57.0, 'form', 'silo', 2, 'popup', { noScale: true }),                 // twin subterranean dune silos!
      ev(59.0, 'form', 'strafer', 4, 'skyDive', { y: 30, noScale: true }),     // diving strafers!
      ev(65.0, 'form', 'drone', 8, 'rear', { y: 24 }),                         // full squadron rear overtake!
      ev(71.0, 'form', 'ray', 5, 'sides', { y: 28 }),
      ev(77.0, 'pick', 'bomb', 6, 16),
      ev(80.0, 'rings', 5, -20, 10, 10, 2),
    ],
  },
  {
    zone: ZONES.dune, length: 16, boss: 'DreadSovereign', bossAt: 15,
    events: [
      ev(0.5, 'say', 'REX', 'There it is — the Dread Sovereign. Break their vanguard, Bowie!', 3.4),
      ev(2.0, 'form', 'drone', 4, 'vee', { y: 24, noScale: true }),
      ev(4.2, 'form', 'scorpion', 2, 'popup', { noScale: true }),              // sudden sand-scorpions guarding Dread Sovereign!
      ev(5.5, 'form', 'lancer', 2, 'sides', { y: 20, noScale: true }),
      ev(8.0, 'rings', 3, 0, 15, 0, 5),
      ev(11.5, 'alert', '⚠ DREAD SOVEREIGN ON RADAR'),
      ev(12.0, 'say', 'THORNE', "…Careful, Bowie. Even I don't mess with that thing.", 3.4),
    ],
  },

  /* ============ AFTERBURNER — ENEMY COMMAND RESURGENCE ============ */
  {
    zone: ZONES.ember, length: 82, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'Intercept confirms it: the Sovereign was only the vanguard. Command is still active!', 3.8),
      ev(2.5, 'form', 'harrier', 4, 'rearPincer', { y: 42, noScale: true }),   // veteran rear pincer!
      ev(8.5, 'form', 'phantom', 3, 'sidePincer', { y: 48, noScale: true }),   // phantom flank pinch!
      ev(15.0, 'form', 'drone', 7, 'helixSurround', { y: 26 }),
      ev(18.5, 'form', 'wyrm', 3, 'popup', { noScale: true }),                 // triple volcanic drill-wyrm eruption!
      ev(21.0, 'form', 'dreadwing', 1, 'line', { y: 72, x: 0, noScale: true }),
      ev(29.0, 'pick', 'bomb', 0, 17),
      ev(33.0, 'form', 'harrier', 4, 'sideSweep', { y: 36, noScale: true }),
      ev(36.0, 'taskforce', 'siege', { x: 34, y: 74, escorts: 4, hpMul: 1.06 }),     // veteran capital-ship encounter
      ev(40.0, 'form', 'trilobite', 2, 'line', { y: 3, x: -52, noScale: true }),
      ev(44.0, 'form', 'silo', 2, 'popup', { noScale: true }),                 // subterranean defense silos!
      ev(47.0, 'form', 'phantom', 3, 'skyDive', { y: 46, noScale: true }),
      ev(55.0, 'form', 'fighter', 4, 'rear', { y: 30, noScale: true }),
      ev(60.0, 'form', 'scorpion', 2, 'popup', { noScale: true }),             // sudden hover-pouncing scorpions!
      ev(63.0, 'pick', 'health', -8, 18),
      ev(67.0, 'form', 'dreadwing', 1, 'line', { y: 76, x: 18, noScale: true }),
      ev(74.0, 'form', 'harrier', 5, 'vee', { y: 42, noScale: true }),
      ev(79.0, 'rings', 5, 0, 14, 0, 3),
    ],
  },
  {
    zone: ZONES.ember, length: 16, boss: 'ObsidianMatriarch', bossAt: 15,
    events: [
      ev(0.5, 'say', 'THORNE', 'That carrier is running the whole resurgence. Gut its weapon rails!', 3.5),
      ev(2.0, 'form', 'phantom', 2, 'sides', { y: 48, noScale: true }),
      ev(4.2, 'form', 'wyrm', 2, 'popup', { noScale: true }),                  // sudden twin magma wyrms before Obsidian Matriarch!
      ev(6.0, 'form', 'harrier', 2, 'vee', { y: 40, noScale: true }),
      ev(9.0, 'rings', 3, 0, 15, 0, 4),
      ev(12.0, 'alert', '⚠ OBSIDIAN MATRIARCH INBOUND'),
    ],
  },

  /* ============ FINAL ZONE — RIFT CITADEL ============ */
  {
    zone: ZONES.dune, length: 86, boss: null,
    events: [
      ev(0.5, 'say', 'REX', 'A relay citadel is opening above the Dune Sea. Stop it before it tears the route apart!', 3.8),
      ev(2.0, 'form', 'shorecannon', 2, 'sides', { y: 2, noScale: true }),
      ev(8.0, 'form', 'harrier', 4, 'rearPincer', { y: 40, noScale: true }),   // rift rear twin-wing overtake!
      ev(15.0, 'form', 'phantom', 3, 'sideSweep', { y: 50, noScale: true }),
      ev(19.0, 'form', 'scorpion', 3, 'popup', { noScale: true }),             // triple sand-scorpion ambush!
      ev(22.0, 'form', 'mech', 1, 'line', { y: 3, x: 72, noScale: true }),
      ev(28.0, 'form', 'dreadwing', 1, 'line', { y: 78, x: -12, noScale: true }),
      ev(32.5, 'form', 'silo', 2, 'popup', { noScale: true }),                 // twin subterranean rift silos!
      ev(35.0, 'pick', 'laser', 0, 18),
      ev(40.0, 'form', 'relaydrone', 5, 'helixSurround', { y: 36, noScale: true }),
      ev(46.0, 'taskforce', 'pincer', { x: 0, y: 62 }),                             // high/low encirclement before the capital screen
      ev(48.0, 'form', 'frigate', 1, 'line', { y: 2, x: -92, noScale: true }),
      ev(52.0, 'form', 'wyrm', 2, 'popup', { noScale: true }),                 // twin corkscrew wyrms!
      ev(55.0, 'form', 'phantom', 4, 'skyDive', { y: 44, noScale: true }),
      ev(59.0, 'taskforce', 'siege', { x: 0, y: 80, escorts: 5, hpMul: 1.12 }),      // Rift command ship + staggered escort wave
      ev(62.0, 'form', 'harrier', 5, 'sidePincer', { y: 40, noScale: true }),
      ev(66.5, 'form', 'kraken', 2, 'popup', { noScale: true }),               // sudden rift-breach krakens!
      ev(69.0, 'pick', 'bomb', 8, 17),
      ev(73.0, 'form', 'dreadwing', 1, 'line', { y: 82, x: 22, noScale: true }),
      ev(79.0, 'form', 'fighter', 6, 'rear', { y: 32, noScale: true }),        // final wave rear blitz!
      ev(83.0, 'rings', 6, -20, 12, 8, 2.4),
    ],
  },
  {
    zone: ZONES.dune, length: 17, boss: 'RiftHarbinger', bossAt: 16,
    events: [
      ev(0.5, 'say', 'JUNO', 'The rift core is live! Take out the pylons, then hit the singularity!', 3.8),
      ev(2.0, 'form', 'phantom', 2, 'sides', { y: 52, noScale: true }),
      ev(4.0, 'form', 'scorpion', 2, 'popup', { noScale: true }),              // sudden sand-scorpions before Rift Harbinger!
      ev(5.5, 'form', 'harrier', 3, 'vee', { y: 42, noScale: true }),
      ev(7.2, 'form', 'wyrm', 2, 'popup', { noScale: true }),                  // sudden drill-wyrms before final boss!
      ev(9.0, 'rings', 4, 0, 16, 0, 4),
      ev(12.5, 'alert', '⚠ RIFT HARBINGER BREACHING'),
      ev(13.0, 'say', 'BOWIE', 'No more running. We close it here!', 3.2),
    ],
  },
];

export const FINAL_WAVE = 16;
