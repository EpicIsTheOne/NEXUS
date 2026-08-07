import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CHARACTER_DIR = path.join(ROOT, 'data', 'characters');
const LOCAL_ASSET_DIR = path.join(ROOT, 'data', 'character-assets');
const CHUB_JSON_DIR = path.join(ROOT, 'characters', 'chub', 'json');
const AVATAR_DIR = path.join(ROOT, 'characters', 'avatars');
const DEFAULT_AVATAR = path.join(AVATAR_DIR, 'default-placeholder.svg');
const LOG_PATH = path.join(ROOT, 'characters', 'backfill-log.json');

function normalizeWhitespace(value = '') {
  return String(value || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeTextForSimilarity(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\{\{char\}\}|\{\{user\}\}|\[end_of_dialog\]/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value = '') {
  return new Set(normalizeTextForSimilarity(value).split(' ').filter((token) => token.length >= 4));
}

function jaccardSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function scoreCard(record, similarity = 0) {
  const personality = normalizeWhitespace(record.personality || '').length;
  const scenario = normalizeWhitespace(record.scenario || '').length;
  const example = normalizeWhitespace(record.mes_example || '').length;
  const first = normalizeWhitespace(record.first_mes || '').length;
  const details = {
    personality: Math.min(30, Math.round(personality / 140)),
    scenario: Math.min(20, Math.round(scenario / 90)),
    example: Math.min(25, Math.round(example / 180)),
    firstMessage: Math.min(10, Math.round(first / 120)),
    completeness: [record.name, record.personality, record.scenario, record.first_mes, record.mes_example].every(Boolean) ? 10 : 0,
    diversityPenalty: similarity >= 0.58 ? Math.round(similarity * 25) : 0,
  };
  let score = details.personality + details.scenario + details.example + details.firstMessage + details.completeness;
  score -= details.diversityPenalty;
  return { score, details };
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `character-${Date.now().toString(36)}`;
}

function extFromUrl(url = '') {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace('.', '');
    return ext || 'png';
  } catch {
    return 'png';
  }
}

async function ensureDirs() {
  await fs.mkdir(LOCAL_ASSET_DIR, { recursive: true });
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

async function loadRawChubMap() {
  const map = new Map();
  const files = await fs.readdir(CHUB_JSON_DIR).catch(() => []);
  for (const file of files.filter((item) => item.endsWith('.json'))) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(CHUB_JSON_DIR, file), 'utf8'));
      const payload = parsed.payload || parsed;
      const node = payload?.node || {};
      const def = node?.definition || {};
      const name = String(def.name || node.name || '').trim().toLowerCase();
      if (!name) continue;
      map.set(name, { parsed, payload, node, def });
    } catch {}
  }
  return map;
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 NEXUSBackfill/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function ensureCharacterAvatar(record, rawChub) {
  if (record.avatar) return { changed: false };

  let sourceFile = DEFAULT_AVATAR;
  let relativeAvatarPath = '/characters/avatars/default-placeholder.svg';
  if (rawChub?.def?.avatar || rawChub?.node?.avatar_url) {
    const avatarUrl = rawChub.def.avatar || rawChub.node.avatar_url;
    const ext = extFromUrl(avatarUrl);
    const localName = `${slugify(record.name)}.${ext}`;
    const localPath = path.join(AVATAR_DIR, localName);
    try {
      const buf = await fetchBuffer(avatarUrl);
      await fs.writeFile(localPath, buf);
      sourceFile = localPath;
      relativeAvatarPath = `/characters/avatars/${localName}`;
    } catch {
      sourceFile = DEFAULT_AVATAR;
      relativeAvatarPath = '/characters/avatars/default-placeholder.svg';
    }
  }

  const ext = path.extname(sourceFile) || '.png';
  const assetName = `${record.id}-backfill${ext}`;
  await fs.copyFile(sourceFile, path.join(LOCAL_ASSET_DIR, assetName));
  record.avatar = assetName;
  record.avatarSourcePath = relativeAvatarPath;
  return { changed: true, avatarSourcePath: relativeAvatarPath };
}

async function main() {
  await ensureDirs();
  const rawChub = await loadRawChubMap();
  const files = (await fs.readdir(CHARACTER_DIR)).filter((file) => file.endsWith('.json'));
  const records = [];
  for (const file of files) {
    const fullPath = path.join(CHARACTER_DIR, file);
    const record = JSON.parse(await fs.readFile(fullPath, 'utf8'));
    records.push({ file, fullPath, record });
  }

  const fingerprints = records.map(({ record }) => tokenSet([record.name, record.description, record.personality, record.scenario, record.mes_example].join(' ')));
  const log = [];

  for (let i = 0; i < records.length; i += 1) {
    const { file, fullPath, record } = records[i];
    const nameKey = String(record.name || '').trim().toLowerCase();
    const raw = rawChub.get(nameKey);
    let maxSimilarity = 0;
    for (let j = 0; j < fingerprints.length; j += 1) {
      if (i === j) continue;
      const sim = jaccardSimilarity(fingerprints[i], fingerprints[j]);
      if (sim > maxSimilarity) maxSimilarity = sim;
    }

    const scoreInfo = scoreCard(record, maxSimilarity);
    record.score = scoreInfo.score;
    record.importedAt = record.importedAt || new Date(record.createdAt || Date.now()).toISOString();
    if (record.sourceUrl?.includes('chub.ai') || raw) record.importSource = 'chub';
    else if (record.sourceUrl?.includes('githubusercontent.com') || record.sourceUrl?.includes('github.com')) record.importSource = 'github';
    else record.importSource = record.importSource || 'manual';

    if (raw) {
      record.tags = Array.from(new Set([...(record.tags || []), ...(raw.node?.topics || []), 'chub', 'browser-import'])).map(String);
      record.sourceUrl = record.sourceUrl || `https://chub.ai/characters/${raw.node?.fullPath || ''}`;
    } else if (record.importSource === 'github') {
      record.tags = Array.from(new Set([...(record.tags || []), 'imported', 'github'])).map(String);
    }

    const avatarInfo = await ensureCharacterAvatar(record, raw);
    await fs.writeFile(fullPath, JSON.stringify(record, null, 2));
    log.push({ file, name: record.name, score: record.score, similarity: maxSimilarity, importSource: record.importSource, avatarChanged: avatarInfo.changed, avatarSourcePath: record.avatarSourcePath || '' });
  }

  await fs.writeFile(LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`Backfilled ${log.length} character records.`);
  for (const item of log) console.log(`${item.name} :: score=${item.score} :: source=${item.importSource} :: avatar=${item.avatarSourcePath || 'existing'}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
