import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from './node_modules/playwright/index.mjs';

const ROOT = path.resolve(process.cwd());
const CHARACTER_ROOT = path.join(ROOT, 'characters');
const OUT_DIR = path.join(CHARACTER_ROOT, 'chub');
const JSON_DIR = path.join(OUT_DIR, 'json');
const AVATAR_DIR = path.join(CHARACTER_ROOT, 'avatars');
const LOG_PATH = path.join(CHARACTER_ROOT, 'chub-import-log.json');
const DEFAULT_AVATAR_PATH = path.join(AVATAR_DIR, 'default-placeholder.svg');

const BASE_URL = (process.env.AICHAT_BASE_URL || 'https://your-domain.example/aichat').replace(/\/$/, '');
const USERNAME = process.env.AICHAT_USERNAME || 'Epic';
const PASSWORD = process.env.AICHAT_PASSWORD || '';
const DEFAULT_SEARCH_QUERIES = [
  'genshin impact', 'honkai star rail', 'zenless zone zero', 'blue archive', 'arknights',
  'fire emblem', 'fate grand order', 'final fantasy', 'nier automata', 'persona',
  'pokemon', 'undertale', 'arcane', 'hololive', 'vtuber',
  'jujutsu kaisen', 'demon slayer', 'chainsaw man', 'spy x family', 'solo leveling',
  'game character', 'anime companion', 'fantasy companion', 'story rich character', 'high quality sfw character'
];
const SEARCH_QUERIES = (process.env.CHUB_QUERIES || DEFAULT_SEARCH_QUERIES.join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const MAX_RESULTS_PER_QUERY = Number(process.env.CHUB_MAX_RESULTS_PER_QUERY || 8);
const MAX_IMPORTS = Number(process.env.CHUB_MAX_IMPORTS || 3);
const SCORE_THRESHOLD = Number(process.env.CHUB_SCORE_THRESHOLD || 60);
const SIMILARITY_REJECT_THRESHOLD = Number(process.env.CHUB_SIMILARITY_REJECT_THRESHOLD || 0.78);
const SIMILARITY_PENALTY_THRESHOLD = Number(process.env.CHUB_SIMILARITY_PENALTY_THRESHOLD || 0.58);
const NO_QUALITY = process.env.CHUB_NO_QUALITY === 'true';

async function ensureDirs() {
  await fs.mkdir(JSON_DIR, { recursive: true });
  await fs.mkdir(AVATAR_DIR, { recursive: true });
  try {
    await fs.access(DEFAULT_AVATAR_PATH);
  } catch {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#151925"/><circle cx="256" cy="190" r="96" fill="#8b5cf6"/><rect x="110" y="316" width="292" height="120" rx="60" fill="#312e81"/><text x="256" y="224" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="120" font-weight="700" fill="#ffffff">?</text></svg>';
    await fs.writeFile(DEFAULT_AVATAR_PATH, svg, 'utf8');
  }
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `character-${Date.now().toString(36)}`;
}

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

function normalizeChubCharacter(payload, sourceUrl) {
  const node = payload?.node || {};
  const def = node?.definition || {};
  return {
    name: normalizeWhitespace(def.name || node.name || ''),
    description: normalizeWhitespace(def.description || node.description || node.tagline || ''),
    personality: normalizeWhitespace(def.personality || ''),
    scenario: normalizeWhitespace(def.scenario || ''),
    first_mes: normalizeWhitespace(def.first_message || ''),
    mes_example: normalizeWhitespace(def.example_dialogs || ''),
    tags: Array.from(new Set([...(node.topics || []), 'chub', 'browser-import'])).map(String),
    sourceUrl,
    avatarUrl: def.avatar || node.avatar_url || '',
    fullPath: node.fullPath || def.full_path || '',
    rating: node.rating || 0,
    ratingCount: node.ratingCount || 0,
    nTokens: node.nTokens || 0,
    tagline: node.tagline || '',
  };
}

function validateCard(card) {
  const reasons = [];
  const joined = [card.name, card.description, card.personality, card.scenario, card.first_mes, card.mes_example, ...(card.tags || [])].join(' ').toLowerCase();
  const name = String(card.name || '').trim().toLowerCase();
  const bannedNamePatterns = [
    /\b(narrator|storyteller|game master|world narrator|character card|card creator|assistant|simulator|sandbox|rpg)\b/,
    /\bmodern life rpg\b/,
    /\bthe real isekai rpg experience\b/
  ];
  if (!card.name) reasons.push('missing name');
  if (!card.personality) reasons.push('missing personality');
  if (!card.scenario) reasons.push('missing scenario');
  if (!card.first_mes) reasons.push('missing first message');
  if (!card.mes_example) reasons.push('missing example dialogue');
  if ((card.personality || '').length < 220) reasons.push('personality too short');
  if ((card.scenario || '').length < 120) reasons.push('scenario too short');
  if ((card.first_mes || '').length < 100) reasons.push('first message too short');
  if ((card.mes_example || '').length < 120) reasons.push('example dialogue too short');
  if (bannedNamePatterns.some((pattern) => pattern.test(name))) reasons.push('generic/bad source pattern');
  if (/\b(nsfw|lewd|fetish|stepmom|stepsister|abusive|bully|dominant|submissive)\b/.test(joined)) reasons.push('unsafe source pattern');
  if (!/^(data:image\/|https?:)/i.test(String(card.avatarUrl || ''))) reasons.push('missing usable avatar');
  return { ok: reasons.length === 0, reasons };
}

function scoreCard(card, similarity = 0) {
  let score = 0;
  const details = {
    personality: Math.min(30, Math.round((card.personality.length || 0) / 140)),
    scenario: Math.min(20, Math.round((card.scenario.length || 0) / 90)),
    example: Math.min(25, Math.round((card.mes_example.length || 0) / 180)),
    firstMessage: Math.min(10, Math.round((card.first_mes.length || 0) / 120)),
    completeness: [card.name, card.personality, card.scenario, card.first_mes, card.mes_example].every(Boolean) ? 10 : 0,
    rating: Math.min(5, Math.max(0, (card.rating || 0) * 1)),
    popularity: Math.min(5, Math.round(Math.log10((card.ratingCount || 0) + 1) * 4)),
    diversityPenalty: similarity >= SIMILARITY_PENALTY_THRESHOLD ? Math.round(similarity * 25) : 0,
  };
  score += details.personality + details.scenario + details.example + details.firstMessage + details.completeness + details.rating + details.popularity;
  score -= details.diversityPenalty;
  return { score, details };
}

function buildFingerprint(card) {
  return tokenSet([card.name, card.description, card.personality, card.scenario, card.mes_example].join(' '));
}

function getMaxSimilarity(fingerprint, existingFingerprints) {
  let max = 0;
  for (const existing of existingFingerprints) {
    const similarity = jaccardSimilarity(fingerprint, existing);
    if (similarity > max) max = similarity;
  }
  return max;
}

async function saveDataUrlFile(dataUrl, baseName, outputDir) {
  if (!dataUrl) return null;
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const filename = `${baseName}.${ext}`;
  const fullPath = path.join(outputDir, filename);
  await fs.writeFile(fullPath, Buffer.from(match[2], 'base64'));
  return {
    fullPath,
    relativePath: `/characters/avatars/${filename}`,
    dataUrl,
  };
}

async function fetchAvatarData(page, avatarUrl) {
  if (!avatarUrl) return null;
  return await page.evaluate(async (avatarUrl) => {
    const res = await fetch(avatarUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result, mime: blob.type || 'image/png' });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }, avatarUrl);
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`NEXUS login failed (${res.status})`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('NEXUS session cookie missing');
  return cookie;
}

async function loadExistingCharacters(cookie) {
  const res = await fetch(`${BASE_URL}/api/bootstrap`, { headers: { cookie } });
  if (!res.ok) throw new Error(`NEXUS bootstrap failed (${res.status})`);
  const json = await res.json();
  return json.characters || [];
}

async function importCard(card, cookie) {
  const res = await fetch(`${BASE_URL}/api/characters/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify({
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_message: card.first_mes,
      example_dialogue: card.mes_example,
      tags: card.tags,
      score: card.score,
      source: card.sourceUrl,
      importSource: 'chub',
      imported_at: card.importedAt,
      avatar: card.avatarPath,
      avatarPath: card.avatarPath,
      avatarDataUrl: card.avatarDataUrl,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `NEXUS import failed (${res.status})`);
  return json;
}

async function loadLog() {
  try {
    return JSON.parse(await fs.readFile(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

async function saveLog(log) {
  await fs.writeFile(LOG_PATH, JSON.stringify(log.slice(0, 500), null, 2));
}

async function loadExistingFingerprints() {
  const files = await fs.readdir(JSON_DIR).catch(() => []);
  const fingerprints = [];
  for (const file of files.filter((item) => item.endsWith('.json'))) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(JSON_DIR, file), 'utf8'));
      const card = normalizeChubCharacter(parsed.payload || parsed, parsed.source || '');
      fingerprints.push(buildFingerprint(card));
    } catch {}
  }
  return fingerprints;
}

async function searchQuery(page, query) {
  await page.goto('https://chub.ai/search', { waitUntil: 'networkidle', timeout: 120000 });
  const input = page.locator('input[placeholder*="Search"], input[type="search"], input').first();
  await input.fill(query);
  await input.press('Enter');
  await page.waitForTimeout(4000);
  return await page.locator('a[href*="/characters/"]').evaluateAll((nodes, max) => {
    const unique = [];
    for (const node of nodes) {
      if (!node.href || unique.includes(node.href)) continue;
      unique.push(node.href);
      if (unique.length >= max) break;
    }
    return unique;
  }, MAX_RESULTS_PER_QUERY);
}

async function fetchCharacterPayload(page, href) {
  await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const fullPath = href.replace('https://chub.ai/characters/', '');
  const payload = await page.evaluate(async (fullPath) => {
    const res = await fetch(`https://gateway.chub.ai/api/characters/${fullPath}?full=true&nocache=${Math.random()}`);
    return { status: res.status, json: await res.json() };
  }, fullPath);
  if (payload.status !== 200) throw new Error(`Chub gateway failed (${payload.status})`);
  return payload.json;
}

async function main() {
  await ensureDirs();
  const cookie = await login();
  const existingCharacters = await loadExistingCharacters(cookie);
  const existingNames = new Set(existingCharacters.map((item) => String(item.name || '').trim().toLowerCase()).filter(Boolean));
  const importedNames = new Set(existingNames);
  const seenSources = new Set();
  const log = await loadLog();
  const existingFingerprints = await loadExistingFingerprints();
  let importedCount = 0;

  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1100 },
  });

  try {
    for (const query of SEARCH_QUERIES) {
      if (importedCount >= MAX_IMPORTS) break;
      const hrefs = await searchQuery(page, query);
      for (const href of hrefs) {
        if (importedCount >= MAX_IMPORTS) break;
        const entry = {
          startedAt: new Date().toISOString(),
          source: href,
          query,
          success: false,
        };
        try {
          if (seenSources.has(href)) throw new Error('Duplicate source in current run');
          seenSources.add(href);

          const payload = await fetchCharacterPayload(page, href);
          const card = normalizeChubCharacter(payload, href);
          entry.name = card.name || href;
          entry.rating = card.rating;
          entry.ratingCount = card.ratingCount;
          entry.nTokens = card.nTokens;

          const validation = validateCard(card);
          const fingerprint = buildFingerprint(card);
          const similarity = getMaxSimilarity(fingerprint, existingFingerprints);
          const { score, details } = scoreCard(card, similarity);
          card.score = score;
          card.scoreDetails = details;
          card.importedAt = new Date().toISOString();
          entry.score = score;
          entry.similarity = similarity;

          if (!NO_QUALITY && !validation.ok) throw new Error(`Validation failed: ${validation.reasons.join(', ')}`);
          if (similarity >= SIMILARITY_REJECT_THRESHOLD) throw new Error(`Near-duplicate content similarity too high (${similarity.toFixed(2)})`);
          if (importedNames.has(card.name.toLowerCase())) throw new Error('Duplicate name already present in system');
          if (!NO_QUALITY && score < SCORE_THRESHOLD) throw new Error(`Score below threshold (${score} < ${SCORE_THRESHOLD})`);

          const avatarBase = slugify(card.name);
          let avatarInfo = null;
          if (card.avatarUrl) {
            const avatarData = await fetchAvatarData(page, card.avatarUrl);
            avatarInfo = avatarData ? await saveDataUrlFile(avatarData.dataUrl, avatarBase, AVATAR_DIR) : null;
          }
          if (!avatarInfo) {
            card.avatarPath = '/characters/avatars/default-placeholder.svg';
            card.avatarDataUrl = '';
          } else {
            card.avatarPath = avatarInfo.relativePath;
            card.avatarDataUrl = avatarInfo.dataUrl;
          }

          const fileBase = `${slugify(card.name)}-${slugify(query)}`;
          await fs.writeFile(path.join(JSON_DIR, `${fileBase}.json`), JSON.stringify({ source: href, query, score, similarity, payload }, null, 2));
          await importCard(card, cookie);
          importedNames.add(card.name.toLowerCase());
          existingFingerprints.push(fingerprint);
          importedCount += 1;
          entry.success = true;
          entry.avatar = card.avatarPath;
        } catch (error) {
          entry.error = String(error.message || error);
        }
        log.unshift(entry);
        await saveLog(log);
        console.log(`${entry.success ? 'IMPORTED' : 'SKIPPED'} :: ${entry.query} :: ${entry.name || entry.source} :: score=${entry.score ?? 'n/a'} :: ${entry.error || 'ok'}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
