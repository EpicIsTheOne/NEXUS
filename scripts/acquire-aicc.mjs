import { chromium } from '../automation/chub/node_modules/playwright/index.mjs';

const BASE_URL = (process.env.AICHAT_BASE_URL || 'https://techexplore.us/aichat').replace(/\/$/, '');
const USERNAME = process.env.AICHAT_USERNAME || 'Epic';
const PASSWORD = process.env.AICHAT_PASSWORD || '';
const MAX_IMPORTS = Number(process.env.AICC_MAX_IMPORTS || 20);
const SCORE_THRESHOLD = Number(process.env.AICC_SCORE_THRESHOLD || 60);

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

function extractBetween(text, start, ends) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return '';
  const from = startIndex + start.length;
  const tail = text.slice(from);
  const positions = ends.map((end) => tail.indexOf(end)).filter((pos) => pos >= 0);
  const to = positions.length ? Math.min(...positions) : tail.length;
  return normalizeWhitespace(tail.slice(0, to));
}

function scoreCard(card, grade = 'B', similarity = 0) {
  let score = 0;
  const strongGrade = ['S', 'A'].includes(String(grade || '').toUpperCase());
  score += Math.min(30, Math.round((card.personality.length || 0) / 140));
  score += Math.min(20, Math.round((card.scenario.length || 0) / 90));
  score += Math.min(25, Math.round((card.mes_example.length || 0) / 180));
  score += Math.min(10, Math.round((card.first_mes.length || 0) / 120));
  score += [card.name, card.personality, card.scenario, card.first_mes, card.mes_example].every(Boolean) ? 10 : 0;
  if (strongGrade && !card.mes_example) score += 18;
  if (strongGrade && [card.name, card.personality, card.scenario, card.first_mes].every(Boolean)) score += 8;
  score += ({ S: 16, A: 13, B: 8, C: 4, D: 1 }[grade] || 0);
  if (similarity >= 0.58) score -= Math.round(similarity * 25);
  return score;
}

function validateCard(card) {
  const reasons = [];
  const strongGrade = ['S', 'A'].includes(String(card.grade || '').toUpperCase());
  const minPersonality = strongGrade ? 120 : 200;
  const minScenario = strongGrade ? 60 : 80;
  if (!card.name) reasons.push('missing name');
  if (!card.personality) reasons.push('missing personality');
  if (!card.scenario) reasons.push('missing scenario');
  if (!card.first_mes) reasons.push('missing first message');
  if (!card.mes_example && !strongGrade) reasons.push('missing example dialogue');
  if ((card.personality || '').length < minPersonality) reasons.push('personality too short');
  if ((card.scenario || '').length < minScenario) reasons.push('scenario too short');
  if ((card.first_mes || '').length < 80) reasons.push('first message too short');
  if ((card.mes_example || '').length < 80 && !strongGrade) reasons.push('example dialogue too short');
  return reasons;
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed (${res.status})`);
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('missing session cookie');
  return cookie;
}

async function loadExisting(cookie) {
  const res = await fetch(`${BASE_URL}/api/bootstrap`, { headers: { cookie } });
  if (!res.ok) throw new Error(`bootstrap failed (${res.status})`);
  const json = await res.json();
  const characters = json.characters || [];
  return {
    names: new Set(characters.map((item) => String(item.name || '').trim().toLowerCase()).filter(Boolean)),
    fingerprints: characters.map((item) => buildFingerprint(item)),
    count: characters.length,
  };
}

async function importCard(card, cookie) {
  const res = await fetch(`${BASE_URL}/api/characters/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_message: card.first_mes,
      example_dialogue: card.mes_example,
      tags: card.tags,
      score: card.score,
      importSource: 'aicc',
      sourceUrl: card.sourceUrl,
      importedAt: new Date().toISOString(),
      avatarDataUrl: card.avatarDataUrl,
      avatarPath: card.avatarUrl,
      shortDescription: card.shortDescription,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `import failed (${res.status})`);
  return json;
}

async function toDataUrl(page, url) {
  if (!url) return '';
  return await page.evaluate(async (avatarUrl) => {
    const res = await fetch(avatarUrl, { cache: 'no-store' });
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }, url);
}

async function collectLinks(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  return await page.locator('a[href*="/charactercards/"]').evaluateAll((nodes) => Array.from(new Set(nodes.map((n) => n.href).filter((href) => /\/charactercards\/.+\/.+\/.+\/$/.test(href)))));
}

async function parseCard(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const fieldTabs = page.getByText('SillyTavern Fields');
  if (await fieldTabs.count()) await fieldTabs.first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const text = await page.locator('body').innerText();
  const gradeMatch = text.match(/AI Grade:\s*([SABCD])/i);
  const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'B';
  const ends = ['Character Description', 'Character Personality', 'Character Scenario', 'Character First Message', 'Character Example Dialogues', 'Character Alternate Greetings', 'Review', 'Cards by Author', 'Try Card'];
  const name = extractBetween(text, 'Character Name\n', ends);
  const description = extractBetween(text, 'Character Description\n', ends);
  const personality = extractBetween(text, 'Character Personality\n', ends);
  const scenario = extractBetween(text, 'Character Scenario\n', ends);
  const first_mes = extractBetween(text, 'Character First Message\n', ends);
  const mes_example = extractBetween(text, 'Character Example Dialogues\n', ends) || extractBetween(text, 'Character Example Dialogue\n', ends);
  const tagsBlock = extractBetween(text, 'Character Tags\n', ['SillyTavern Fields', 'Review', 'Cards by Author']);
  const tags = Array.from(new Set(tagsBlock.split(/\n|,/).map((item) => item.trim()).filter((item) => item && !/^(Scenario \/ Trope|Gender|Personality Traits)$/i.test(item))));
  const avatarUrl = await page.locator('img').evaluateAll((nodes) => nodes.map((n) => n.src).find((src) => /aicharactercards\.com\/wp-content\/uploads\/.+\.(png|jpg|jpeg|webp)/i.test(src)) || '');
  return { name, description, personality, scenario, first_mes, mes_example, tags: ['aicc', ...tags], grade, avatarUrl, sourceUrl: url, shortDescription: scenario || description };
}

async function main() {
  const cookie = await login();
  const existing = await loadExisting(cookie);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', viewport: { width: 1440, height: 1200 } });
  const queue = [
    'https://aicharactercards.com/',
    'https://aicharactercards.com/charactercards/adventure-rpg/linux4life/jezzara-voidwhisper/',
    'https://aicharactercards.com/charactercards/wholesome-or-sexy/linux4life/yara-yamanaka-youthful-yakuza/',
    'https://aicharactercards.com/charactercards/wholesome-or-sexy/linux4life/xara-xavierxenial-xenophile/',
    'https://aicharactercards.com/charactercards/wholesome-or-sexy/linux4life/samantha/',
    'https://aicharactercards.com/charactercards/drama/fitikwastaken/yulian/',
    'https://aicharactercards.com/charactercards/adventure-rpg/loresmith77/barbara-the-badlands-bathhouse-queen-sfw/',
    'https://aicharactercards.com/charactercards/action/carl4122/farrah-day/',
    'https://aicharactercards.com/charactercards/wholesome-or-sexy/linux4life/iris-2/',
    'https://aicharactercards.com/charactercards/wholesome-or-sexy/linux4life/wanda/',
    'https://aicharactercards.com/charactercards/work-jobs/linux4life/olympic-village-shenanigans-crew/',
    'https://aicharactercards.com/charactercards/action/john-45/the-chronicles-of-cyraeth/'
  ];
  const seenPages = new Set();
  const accepted = [];
  const rejected = [];

  while (queue.length && accepted.length < MAX_IMPORTS) {
    const url = queue.shift();
    if (!url || seenPages.has(url)) continue;
    seenPages.add(url);
    try {
      const discovered = await collectLinks(page, url).catch(() => []);
      for (const href of discovered) if (!seenPages.has(href)) queue.push(href);
      if (!/\/charactercards\/.+\/.+\/.+\/$/.test(url)) continue;
      const card = await parseCard(page, url);
      const fingerprint = buildFingerprint(card);
      const similarity = getMaxSimilarity(fingerprint, existing.fingerprints);
      const score = scoreCard(card, card.grade, similarity);
      const validation = validateCard(card);
      if (existing.names.has(card.name.toLowerCase())) throw new Error('duplicate name');
      if (similarity >= 0.78) throw new Error(`near duplicate (${similarity.toFixed(2)})`);
      if (validation.length) throw new Error(validation.join(', '));
      if (score < SCORE_THRESHOLD) throw new Error(`score below threshold (${score})`);
      card.score = score;
      card.avatarDataUrl = await toDataUrl(page, card.avatarUrl);
      await importCard(card, cookie);
      existing.names.add(card.name.toLowerCase());
      existing.fingerprints.push(fingerprint);
      accepted.push({ name: card.name, score, grade: card.grade, url });
      console.log(`IMPORTED :: ${card.grade} :: ${card.name} :: score=${score}`);
    } catch (error) {
      rejected.push({ url, error: String(error.message || error) });
      console.log(`SKIPPED :: ${url} :: ${String(error.message || error)}`);
    }
  }

  await browser.close();
  console.log(JSON.stringify({ imported: accepted.length, rejected: rejected.length, accepted: accepted.slice(0, 10) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
