import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'characters');
const JSON_DIR = path.join(OUT_DIR, 'json');
const PNG_DIR = path.join(OUT_DIR, 'png');
const LOG_PATH = path.join(OUT_DIR, 'import-log.json');

const BASE_URL = (process.env.AICHAT_BASE_URL || 'https://your-domain.example/nexus').replace(/\/$/, '');
const USERNAME = process.env.AICHAT_USERNAME || 'Epic';
const PASSWORD = process.env.AICHAT_PASSWORD || '';

const SOURCES = [
  {
    source: 'https://github.com/Krakoukas73/silly-tavern-ai-characters',
    items: [
      'https://raw.githubusercontent.com/Krakoukas73/silly-tavern-ai-characters/main/Characters/Bender.json',
      'https://raw.githubusercontent.com/Krakoukas73/silly-tavern-ai-characters/main/Characters/Capitaine%20Haddock.json',
      'https://raw.githubusercontent.com/Krakoukas73/silly-tavern-ai-characters/main/Characters/Gollum.json',
    ],
  },
  {
    source: 'https://github.com/TheLonelyDevil9/discord-pals',
    items: [
      'https://raw.githubusercontent.com/TheLonelyDevil9/discord-pals/main/characters/firefly.md',
    ],
  },
];

async function ensureDirs() {
  await fs.mkdir(JSON_DIR, { recursive: true });
  await fs.mkdir(PNG_DIR, { recursive: true });
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `character-${Date.now().toString(36)}`;
}

function normalizeCard(raw) {
  const data = raw?.data || raw || {};
  return {
    name: String(data.name || raw?.name || '').trim(),
    description: String(data.description || raw?.description || '').trim(),
    personality: String(data.personality || raw?.personality || '').trim(),
    scenario: String(data.scenario || raw?.scenario || '').trim(),
    first_mes: String(data.first_mes || raw?.first_mes || '').trim(),
    mes_example: String(data.mes_example || raw?.mes_example || '').trim(),
    tags: Array.isArray(data.tags || raw?.tags) ? (data.tags || raw.tags).map(String) : [],
  };
}

function markdownToCard(text) {
  const title = (text.match(/^#\s+(.+)$/m)?.[1] || '').trim();
  const pairs = [...text.matchAll(/`\{\{user\}\}`:\s*([^\n]+)\n`[^`]+`:\s*([\s\S]*?)(?=\n\n`\{\{user\}\}`:|$)/g)]
    .map((match) => ({ question: match[1].trim(), answer: match[2].trim() }));
  const intro = pairs.find((pair) => /introduction/i.test(pair.question))?.answer || pairs[0]?.answer || '';
  const personality = pairs.find((pair) => /personality/i.test(pair.question))?.answer || '';
  const appearance = pairs.find((pair) => /appearance/i.test(pair.question))?.answer || '';
  const description = [personality, appearance].filter(Boolean).join('\n\n');
  const scenario = [
    `${title} is a roleplay character sourced from a public character profile and adapted for SillyTavern-compatible chat.`,
    intro,
    personality,
  ].filter(Boolean).join('\n\n');
  const mesExample = pairs.slice(0, 3).map((pair) => `{{user}}: ${pair.question}\n{{char}}: ${pair.answer}`).join('\n\n');
  return {
    name: title,
    description,
    personality: personality || description,
    scenario,
    first_mes: intro,
    mes_example: mesExample,
    tags: ['imported', 'markdown-converted'],
  };
}

function validateCard(card) {
  const reasons = [];
  if (!card.name) reasons.push('missing name');
  if (!card.personality) reasons.push('missing personality');
  if (!card.scenario) reasons.push('missing scenario');
  if (!card.first_mes) reasons.push('missing first message');
  if (!card.mes_example) reasons.push('missing example dialogue');
  if ((card.personality || '').length < 120) reasons.push('personality too short');
  if ((card.scenario || '').length < 60) reasons.push('scenario too short');
  return { ok: reasons.length === 0, reasons };
}

async function loadExistingNames(cookie) {
  const res = await fetch(`${BASE_URL}/api/bootstrap`, {
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
  const json = await res.json();
  return new Set((json.characters || []).map((item) => String(item.name || '').trim().toLowerCase()).filter(Boolean));
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const setCookie = res.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  if (!cookie) throw new Error('No session cookie returned');
  return cookie;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 NEXUSImporter/1.0' } });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return await res.text();
}

async function importCard(card, sourceUrl, cookie) {
  const payload = {
    name: card.name,
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    first_message: card.first_mes,
    example_dialogue: card.mes_example,
    tags: card.tags,
    source: sourceUrl,
  };
  const res = await fetch(`${BASE_URL}/api/characters/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Import failed (${res.status})`);
  return json;
}

async function loadLog() {
  try {
    return JSON.parse(await fs.readFile(LOG_PATH, 'utf8'));
  } catch {
    return [];
  }
}

async function saveLog(entries) {
  await fs.writeFile(LOG_PATH, JSON.stringify(entries, null, 2));
}

async function main() {
  await ensureDirs();
  const cookie = await login();
  const existingNames = await loadExistingNames(cookie);
  const log = await loadLog();

  for (const sourceGroup of SOURCES) {
    for (const itemUrl of sourceGroup.items) {
      const lowerUrl = itemUrl.toLowerCase();
      const fileType = lowerUrl.endsWith('.png') ? 'png' : lowerUrl.endsWith('.md') ? 'md' : 'json';
      const outDir = fileType === 'png' ? PNG_DIR : JSON_DIR;
      const startedAt = new Date().toISOString();
      const result = { startedAt, source: itemUrl, fileType, success: false };

      try {
        const raw = await fetchText(itemUrl);
        const fileName = fileType === 'png'
          ? `${slugify(path.basename(itemUrl))}.png`
          : `${slugify(path.basename(itemUrl).replace(/\.(json|md)$/i, ''))}.json`;
        const filePath = path.join(outDir, fileName);

        if (fileType === 'json') {
          await fs.writeFile(filePath, raw, 'utf8');
        } else if (fileType === 'md') {
          // Save converted SillyTavern-compatible JSON into /characters/json/
        } else {
          throw new Error('PNG pipeline not wired in first batch');
        }

        const parsed = fileType === 'md' ? markdownToCard(raw) : normalizeCard(JSON.parse(raw));
        if (fileType === 'md') await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf8');
        const card = parsed;
        result.name = card.name || fileName;
        const validation = validateCard(card);
        if (!validation.ok) throw new Error(`Validation failed: ${validation.reasons.join(', ')}`);
        if (existingNames.has(card.name.toLowerCase())) throw new Error('Duplicate name already present in system');

        await importCard(card, itemUrl, cookie);
        existingNames.add(card.name.toLowerCase());
        result.success = true;
      } catch (error) {
        result.error = String(error.message || error);
      }

      log.unshift(result);
      await saveLog(log.slice(0, 500));
      console.log(`${result.success ? 'IMPORTED' : 'SKIPPED'} :: ${result.name || itemUrl} :: ${result.error || 'ok'}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
