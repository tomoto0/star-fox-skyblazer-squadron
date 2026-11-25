/**
 * Skyblazer Squadron — Armory Upgrade & Build System.
 * Offered after Boss defeats (W3/6/9/12/14) and Rival Thorne victories,
 * giving the player meaningful scaling against late-game HP escalation
 * and distinct tactical builds every sortie.
 */

export const UPGRADE_CATALOG = [
  {
    id: 'overcharge',
    name: 'OVERCHARGE CANNON',
    category: 'OFFENSE',
    icon: '⚡',
    short: 'PLASMA',
    color: '#ffe066',
    maxRank: 3,
    desc: (nextRank) => nextRank === 1
      ? 'Unlock <b>LASER LV.4 PLASMA</b> (4-beam solar array, +1 level now) &amp; <b>+18%</b> laser power.'
      : `Supercharge primary cannons: <b>+${18 + (nextRank - 1) * 20}%</b> total laser damage &amp; wider muzzle arcs.`,
  },
  {
    id: 'multilock',
    name: 'MULTI-LOCK MATRIX',
    category: 'OFFENSE',
    icon: '◎',
    short: 'LOCK',
    color: '#6ce8ff',
    maxRank: 3,
    desc: (nextRank) => `Expand Charge Shot locks to <b>${3 + nextRank * 2} targets</b> simultaneously &amp; <b>+${nextRank * 22}%</b> blast radius &amp; damage.`,
  },
  {
    id: 'capacitor',
    name: 'RAPID CAPACITOR',
    category: 'OFFENSE',
    icon: '»',
    short: 'RAPID',
    color: '#7cffc4',
    maxRank: 3,
    desc: (nextRank) => `<b>+${nextRank * 30}%</b> Charge Shot buildup speed &amp; <b>+${nextRank * 14}%</b> primary laser fire rate.`,
  },
  {
    id: 'piercer',
    name: 'PIERCING RAIL CORE',
    category: 'OFFENSE',
    icon: '❖',
    short: 'PIERCE',
    color: '#ff9f54',
    maxRank: 3,
    desc: (nextRank) => `Shred heavy armor: <b>+${nextRank * 40}%</b> boss hull penetration, <b>+${nextRank * 20}%</b> weakpoint damage &amp; <b>+${nextRank * 18}%</b> vs Heavy/Elite craft.`,
  },
  {
    id: 'novabomb',
    name: 'NOVA WARHEAD',
    category: 'TACTICAL',
    icon: '☢',
    short: 'NOVA',
    color: '#ff7066',
    maxRank: 2,
    desc: (nextRank) => `<b>+2 Bombs now</b> (Max Bombs → <b>${5 + nextRank}</b>), <b>+${nextRank * 25}%</b> blast radius &amp; <b>+${nextRank * 45}%</b> bomb damage.`,
  },
  {
    id: 'aegis',
    name: 'AEGIS DEFLECTOR',
    category: 'DEFENSE',
    icon: '🛡',
    short: 'AEGIS',
    color: '#72fff0',
    maxRank: 3,
    desc: (nextRank) => `<b>+25 Max Shield</b> (full repair now), <b>+${nextRank * 28}%</b> barrel-roll deflect radius &amp; <b>+${nextRank * 60}%</b> counter-shot damage.`,
  },
  {
    id: 'wingpod',
    name: 'INTERCEPTOR WINGPOD',
    category: 'TACTICAL',
    icon: '◈',
    short: 'POD',
    color: '#9ee8ff',
    maxRank: 2,
    desc: (nextRank) => `Deploy <b>${nextRank} orbiting defense drone${nextRank > 1 ? 's' : ''}</b> that auto-intercept missiles &amp; fire at close enemies + <b>+${nextRank * 35}%</b> Boost recharge.`,
  },
  {
    id: 'vampire',
    name: 'VAMPIRE REACTOR',
    category: 'DEFENSE',
    icon: '✚',
    short: 'SIPHON',
    color: '#ff8fb8',
    maxRank: 2,
    desc: (nextRank) => `Siphon <b>+${nextRank === 1 ? 6 : 10} Shield</b> every 3 kills (or every Heavy kill), <b>+${nextRank}s</b> Combo window &amp; <b>+${nextRank * 18}%</b> score.`,
  },
  {
    id: 'thorne_trophy',
    name: 'CRIMSON OVERDRIVE',
    category: 'RIVAL TROPHY',
    icon: '★',
    short: 'CRIMSON',
    color: '#ff5274',
    maxRank: 2,
    exclusive: true,
    desc: (nextRank) => `Thorne's ace core: <b>+${nextRank * 22}%</b> laser power, <b>+${nextRank * 14}%</b> fire rate, <b>+${nextRank} Max Lock</b>, <b>+${nextRank * 15} Max Shield</b> &amp; crimson ace beams.`,
  },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADE_CATALOG.map((u) => [u.id, u]));

export function createEmptyRanks() {
  return Object.create(null);
}

/** Derive all live combat multipliers cleanly from installed module ranks + permanent ring bonuses */
export function computeBuildStats(ranks = {}, ringMaxHpBonus = 0) {
  const r = (id) => Math.max(0, (ranks[id] | 0));
  const ov = r('overcharge');
  const ml = r('multilock');
  const cp = r('capacitor');
  const pr = r('piercer');
  const nb = r('novabomb');
  const ae = r('aegis');
  const wp = r('wingpod');
  const vp = r('vampire');
  const th = r('thorne_trophy');

  const maxLaserLevel = ov >= 1 ? 4 : 3;
  const laserDmgMul = (1 + (ov >= 1 ? 0.18 + (ov - 1) * 0.20 : 0)) * (1 + th * 0.22);
  const fireRateMul = (1 + cp * 0.14) * (1 + th * 0.14);
  const chargeSpeedMul = 1 + cp * 0.30;
  const maxChargeLocks = Math.min(8, 3 + ml * 2 + th);
  const chargeDmgMul = 1 + ml * 0.24 + pr * 0.18;
  const chargeRadMul = 1 + ml * 0.22;
  const bossArmorBonus = pr * 0.10;         // added directly on top of boss.armorMult (e.g. 0.15 -> 0.45 at Lv3!)
  const bossWeakMul = 1 + pr * 0.20;
  const heavyDmgMul = 1 + pr * 0.18;
  const maxBombs = Math.min(7, 5 + nb);
  const bombRadMul = 1 + nb * 0.25;
  const bombDmgMul = 1 + nb * 0.45;
  const maxHp = 100 + ae * 25 + th * 15 + Math.max(0, ringMaxHpBonus | 0);
  const reflectRadMul = 1 + ae * 0.28;
  const reflectDmgMul = 1 + ae * 0.60;
  const wingpodCount = Math.min(2, wp);
  const boostRegenMul = 1 + wp * 0.35;
  const siphonPerKills = vp > 0 ? 3 : 0;
  const siphonHeal = vp >= 2 ? 10 : vp === 1 ? 6 : 0;
  const comboDur = 2.6 + vp * 1.0;
  const scoreMul = 1 + vp * 0.18;
  const crimsonLasers = th >= 1;

  return {
    maxLaserLevel,
    laserDmgMul,
    fireRateMul,
    chargeSpeedMul,
    maxChargeLocks,
    chargeDmgMul,
    chargeRadMul,
    bossArmorBonus,
    bossWeakMul,
    heavyDmgMul,
    maxBombs,
    bombRadMul,
    bombDmgMul,
    maxHp,
    reflectRadMul,
    reflectDmgMul,
    wingpodCount,
    boostRegenMul,
    siphonPerKills,
    siphonHeal,
    comboDur,
    scoreMul,
    crimsonLasers,
  };
}

/** Roll 3 distinct non-maxed upgrades, guaranteeing a balanced spread and optional Thorne Trophy slot */
export function rollUpgradeChoices(ranks = {}, opts = {}) {
  const { includeTrophy = false } = opts;
  const rankOf = (id) => Math.max(0, (ranks[id] | 0));
  const picks = [];

  if (includeTrophy) {
    const trophy = UPGRADE_MAP.thorne_trophy;
    if (trophy && rankOf(trophy.id) < trophy.maxRank) {
      picks.push(trophy);
    }
  }

  const pool = UPGRADE_CATALOG.filter((u) => !u.exclusive && rankOf(u.id) < u.maxRank);
  // Shuffle pool (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Prefer category variety (OFFENSE / DEFENSE / TACTICAL) when possible
  const usedCats = new Set(picks.map((p) => p.category));
  for (const item of pool) {
    if (picks.length >= 3) break;
    if (!usedCats.has(item.category)) {
      picks.push(item);
      usedCats.add(item.category);
    }
  }
  for (const item of pool) {
    if (picks.length >= 3) break;
    if (!picks.includes(item)) picks.push(item);
  }

  // Fallback if every normal upgrade is maxed out: offer repeatable supply/overcharge pack
  while (picks.length < 3) {
    const idx = picks.length;
    picks.push({
      id: `supply_${idx}`,
      name: idx === 0 ? 'RESERVE WARHEADS' : idx === 1 ? 'SHIELD OVERCAP' : 'SCORE MULTIPLIER',
      category: 'SUPPLY',
      icon: idx === 0 ? '❖' : idx === 1 ? '✚' : '★',
      short: 'SUPPLY',
      color: '#ffd978',
      maxRank: 99,
      repeatable: true,
      desc: () => idx === 0
        ? 'Emergency armory drop: <b>+2 Smart Bombs</b> &amp; full Shield repair.'
        : idx === 1
          ? 'Reinforce hull capacitors: <b>+15 Max Shield</b> permanently &amp; full repair.'
          : 'Ace bounty bonus: <b>+1500 Score</b> &amp; <b>+1 Smart Bomb</b>.',
    });
  }

  return picks.map((u) => {
    const cur = rankOf(u.id);
    const next = u.repeatable ? 1 : cur + 1;
    return {
      ...u,
      curRank: cur,
      nextRank: next,
      descriptionHtml: u.desc(next),
    };
  });
}

/** Build compact HUD badge descriptors for currently installed upgrades */
export function formatUpgradeBadges(ranks = {}) {
  const out = [];
  for (const u of UPGRADE_CATALOG) {
    const lv = Math.max(0, (ranks[u.id] | 0));
    if (lv <= 0) continue;
    out.push({
      id: u.id,
      icon: u.icon,
      label: lv > 1 ? `${u.short} ${lv}` : u.short,
      color: u.color,
      trophy: !!u.exclusive,
    });
  }
  return out;
}
