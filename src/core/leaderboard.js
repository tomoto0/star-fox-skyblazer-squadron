export const LEADERBOARD_LIMIT = 30;
export const LEADERBOARD_NAME_MAX = 14;

const STORAGE_KEY = 'skyblazer-squadron-leaderboard-v1';

const toSafeInt = (value, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0));
const toSafeText = (value, fallback = '') => String(value ?? fallback)
  .replace(/[\u0000-\u001f\u007f]/g, '')
  .trim();

export function sanitizePilotName(value) {
  return Array.from(toSafeText(value)).slice(0, LEADERBOARD_NAME_MAX).join('');
}

export function formatRankScore(value) {
  return toSafeInt(value).toLocaleString('en-US');
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const score = toSafeInt(value.score);
  const name = sanitizePilotName(value.name);
  if (!name || score < 1) return null;
  return {
    id: toSafeText(value.id) || `legacy-${name}-${score}-${toSafeText(value.createdAt)}`,
    name,
    score,
    mode: value.mode === 'afterburner' ? 'afterburner' : 'standard',
    outcome: value.outcome === 'complete' ? 'complete' : 'failed',
    wave: Math.max(1, toSafeInt(value.wave, 99)),
    kills: toSafeInt(value.kills, 9999),
    accuracy: Math.min(100, toSafeInt(value.accuracy, 100)),
    createdAt: toSafeText(value.createdAt) || new Date(0).toISOString(),
  };
}

function sortTopThirty(entries) {
  return entries
    .map(normalizeEntry)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(0, LEADERBOARD_LIMIT);
}

/**
 * Current offline adapter. The store only depends on read/write, so this can
 * later be replaced by a Manus Database-backed adapter without changing UI,
 * qualification, ordering, or game-end logic.
 */
export class LocalLeaderboardRepository {
  async read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async write(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch {
      return false;
    }
  }
}

export class LeaderboardStore {
  constructor(repository = new LocalLeaderboardRepository()) {
    this.repository = repository;
    this.entries = [];
    this.ready = this.refresh();
  }

  async refresh() {
    this.entries = sortTopThirty(await this.repository.read());
    return this.entries;
  }

  qualifies(score) {
    const candidate = toSafeInt(score);
    if (candidate < 1) return false;
    return this.entries.length < LEADERBOARD_LIMIT || candidate > this.entries[this.entries.length - 1].score;
  }

  rankFor(score) {
    const candidate = toSafeInt(score);
    if (!this.qualifies(candidate)) return null;
    const before = this.entries.findIndex((entry) => candidate > entry.score);
    return before === -1 ? this.entries.length + 1 : before + 1;
  }

  async submit(name, run) {
    const cleanName = sanitizePilotName(name);
    const score = toSafeInt(run?.score);
    if (!cleanName || !this.qualifies(score)) return null;

    const entry = normalizeEntry({
      id: globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      score,
      mode: run?.mode,
      outcome: run?.outcome,
      wave: run?.wave,
      kills: run?.kills,
      accuracy: run?.accuracy,
      createdAt: new Date().toISOString(),
    });
    const next = sortTopThirty([...this.entries, entry]);
    const rank = next.findIndex((item) => item.id === entry.id) + 1;
    if (!rank) return null;

    const saved = await this.repository.write(next);
    if (!saved) return null;
    this.entries = next;
    return { entry, rank, entries: this.entries };
  }
}

/*
  Future Manus Database adapter contract:

  class ManusLeaderboardRepository {
    async read() { return fetch('/api/leaderboard').then((r) => r.json()); }
    async write(entries) { ...server-side validated transactional submission... }
  }

  The production endpoint must submit one signed run rather than accepting a
  client-supplied top-30 array. LeaderboardStore deliberately keeps its public
  API asynchronous so that this replacement does not require UI or Game-flow
  rewrites.
*/
