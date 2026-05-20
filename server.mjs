import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawn, exec as execCommand } from 'node:child_process';
import { promisify } from 'node:util';
import extract from 'png-chunks-extract';
import PNGtext from 'png-chunk-text';
import { FishAudioClient, RealtimeEvents } from 'fish-audio';

function loadDotEnvFile(filePath = path.join(process.cwd(), '.env')) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch {}
}

loadDotEnvFile();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_PATH = process.env.BASE_PATH || '/aichat';
const BACKEND_BASE_URL = (process.env.BACKEND_BASE_URL || '').replace(/\/$/, '');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'mistralai/mistral-nemo-instruct-2407';
const DEFAULT_PROVIDER_LABEL = process.env.DEFAULT_PROVIDER_LABEL || 'llm';
const ST_DATA_DIR = process.env.ST_DATA_DIR || '/mounted/st-data/default-user';
const APP_DATA_DIR = process.env.APP_DATA_DIR || '/app/data';
const STORE_PATH = path.join(APP_DATA_DIR, 'store.json');
const USERS_PATH = path.join(APP_DATA_DIR, 'users.json');
const LOCAL_CHARACTERS_DIR = path.join(APP_DATA_DIR, 'characters');
const LOCAL_CHARACTER_ASSETS_DIR = path.join(APP_DATA_DIR, 'character-assets');
const APP_CONFIG_PATH = path.join(APP_DATA_DIR, 'app-config.json');
const IMPORT_LOG_PATH = path.join(APP_DATA_DIR, 'import-log.json');
const SESSIONS_PATH = path.join(APP_DATA_DIR, 'sessions.json');
const AUDIO_CACHE_DIR = path.join(APP_DATA_DIR, 'audio-cache');
const MESSAGE_IMAGE_DIR = path.join(APP_DATA_DIR, 'message-images');
const SESSION_COOKIE = 'aichat_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const OPENCLAW_BRIDGE_URL = String(process.env.OPENCLAW_BRIDGE_URL || 'http://127.0.0.1:3101').replace(/\/$/, '');
const OPENCLAW_BRIDGE_SECRET = String(process.env.OPENCLAW_BRIDGE_SECRET || '').trim();
const AUDIO_CACHE_MAX_AGE_DAYS = Math.max(1, Number(process.env.AUDIO_CACHE_MAX_AGE_DAYS || 14));
const AUDIO_CACHE_MAX_FILES = Math.max(20, Number(process.env.AUDIO_CACHE_MAX_FILES || 500));
const AUDIO_CACHE_MAX_BYTES = Math.max(10 * 1024 * 1024, Number(process.env.AUDIO_CACHE_MAX_BYTES || 512 * 1024 * 1024));
const AUDIO_CACHE_MAX_AGE_MS = AUDIO_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || '';
const FISH_AUDIO_BASE_URL = (process.env.FISH_AUDIO_BASE_URL || 'https://api.fish.audio').replace(/\/$/, '');
const DEFAULT_FISH_REFERENCE_ID = process.env.DEFAULT_FISH_REFERENCE_ID || '';
const DEFAULT_FISH_VOICE_LABEL = process.env.DEFAULT_FISH_VOICE_LABEL || 'Default Fish Voice';
const FISH_TTS_BACKEND = String(process.env.FISH_TTS_BACKEND || 's2-pro').trim() || 's2-pro';
const FISH_MODEL_CACHE_TTL_MS = Math.max(5_000, Number(process.env.FISH_MODEL_CACHE_TTL_MS || 5 * 60 * 1000));
const TTS_EMOTION_MODEL = process.env.TTS_EMOTION_MODEL || '';
const TTS_EMOTION_TIMEOUT_MS = Math.max(1500, Number(process.env.TTS_EMOTION_TIMEOUT_MS || 15000));
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const REPLICATE_IMAGE_MODEL = 'stability-ai/sdxl';
const REPLICATE_IMAGE_VERSION = 'fb81ef963e74776af72e6f380949013533d46dd5c6228a9e586c57db6303d7cd';
const OPENAI_IMAGE_MODEL = 'openai/gpt-image-2';
const OPENROUTER_IMAGE_MODEL = 'openrouter/openai/gpt-5-image-mini';
const IMAGE_GENERATION_MODELS = [
  { id: OPENAI_IMAGE_MODEL, label: 'Default image model — openai/gpt-image-2' },
  { id: 'openai/gpt-5-image-mini', label: 'OpenRouter — openai/gpt-5-image-mini' },
  { id: 'openai/gpt-5-image', label: 'OpenRouter — openai/gpt-5-image' },
  { id: 'openai/gpt-5.4-image-2', label: 'OpenRouter — openai/gpt-5.4-image-2' },
];
const ALLOWED_IMAGE_GENERATION_MODELS = new Set(IMAGE_GENERATION_MODELS.map((model) => model.id));
const REPLICATE_ASSET_DIR = path.join(APP_DATA_DIR, 'replicate');
const PUBLIC_APP_ORIGIN = (process.env.PUBLIC_APP_ORIGIN || 'https://your-domain.example').replace(/\/$/, '');

const SETTINGS_PATH = path.join(ST_DATA_DIR, 'settings.json');
const CHARACTERS_DIR = path.join(ST_DATA_DIR, 'characters');
const PERSONAS_DIR = path.join(ST_DATA_DIR, 'User Avatars');
const BACKGROUNDS_DIR = path.join(ST_DATA_DIR, 'backgrounds');

const sessions = new Map();
const fishModelCache = new Map();
const execFileAsync = promisify(execFile);
const execCommandAsync = promisify(execCommand);
const fishAudioClient = FISH_AUDIO_API_KEY ? new FishAudioClient({ apiKey: FISH_AUDIO_API_KEY, baseUrl: FISH_AUDIO_BASE_URL }) : null;

function persistSessionsToDisk() {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    const rows = [...sessions.entries()].map(([token, value]) => ({ token, ...value }));
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(rows, null, 2));
  } catch {}
}

function loadSessionsFromDisk() {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    const rows = readJsonSafe(SESSIONS_PATH, []);
    if (!Array.isArray(rows)) return;
    const now = Date.now();
    for (const row of rows) {
      if (!row?.token || !row?.username || Number(row?.expiresAt || 0) < now) continue;
      sessions.set(String(row.token), { username: String(row.username), expiresAt: Number(row.expiresAt) });
    }
    persistSessionsToDisk();
  } catch {}
}

loadSessionsFromDisk();

app.use(express.json({ limit: '8mb' }));

function readJsonSafe(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase();
}

function titleizeUsername(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : '';
}

function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
}

function makePasswordRecord(password) {
  const salt = createSalt();
  return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password, record = {}) {
  if (!record?.salt || !record?.hash) return false;
  const next = hashPassword(password, record.salt);
  return crypto.timingSafeEqual(Buffer.from(next, 'hex'), Buffer.from(record.hash, 'hex'));
}

function defaultUsers() {
  return {
    version: 1,
    users: {
      epic: {
        username: 'epic',
        displayName: 'Epic',
        role: 'admin',
        ...makePasswordRecord(process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url')),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      indo: {
        username: 'indo',
        displayName: 'Indo',
        role: 'admin',
        ...makePasswordRecord('Indorex'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  };
}

function sanitizeUser(user) {
  return {
    username: user.username,
    displayName: user.displayName || titleizeUsername(user.username),
    role: user.role === 'admin' ? 'admin' : 'user',
    isAdmin: user.role === 'admin',
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return [part, ''];
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function shouldUseSecureCookie(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return process.env.NODE_ENV === 'production' || forwardedProto.includes('https');
}

function setSessionCookie(req, res, token) {
  const secure = shouldUseSecureCookie(req);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${BASE_PATH}`,
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req, res) {
  const secure = shouldUseSecureCookie(req);
  const parts = [
    `${SESSION_COOKIE}=`,
    `Path=${BASE_PATH}`,
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function ensureUsersFile() {
  await fsp.mkdir(APP_DATA_DIR, { recursive: true });
  try {
    await fsp.access(USERS_PATH);
  } catch {
    await fsp.writeFile(USERS_PATH, JSON.stringify(defaultUsers(), null, 2));
  }
}

async function loadUsers() {
  await ensureUsersFile();
  const parsed = readJsonSafe(USERS_PATH, defaultUsers());
  const seeded = defaultUsers();
  return {
    version: 1,
    users: {
      ...seeded.users,
      ...(parsed.users || {}),
    },
  };
}

async function saveUsers(usersFile) {
  await ensureUsersFile();
  await fsp.writeFile(USERS_PATH, JSON.stringify(usersFile, null, 2));
}

function getAuthenticatedSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    persistSessionsToDisk();
    return null;
  }
  session.expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  persistSessionsToDisk();
  return { token, ...session };
}

async function requireAuth(req, res, next) {
  const session = getAuthenticatedSession(req);
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  const usersFile = await loadUsers();
  const user = usersFile.users?.[session.username];
  if (!user) {
    sessions.delete(session.token);
    persistSessionsToDisk();
    clearSessionCookie(req, res);
    return res.status(401).json({ error: 'Session expired' });
  }
  req.authUser = sanitizeUser(user);
  req.authUserRecord = user;
  req.sessionToken = session.token;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.authUser?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

function readPngCharacterCard(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunks = extract(new Uint8Array(buffer));
  const textChunks = chunks.filter((chunk) => chunk.name === 'tEXt').map((chunk) => PNGtext.decode(chunk.data));
  const ccv3 = textChunks.find((chunk) => chunk.keyword.toLowerCase() === 'ccv3');
  const chara = textChunks.find((chunk) => chunk.keyword.toLowerCase() === 'chara');
  const raw = ccv3?.text || chara?.text;
  if (!raw) throw new Error('No character metadata in PNG');
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
}

function summarizeText(...parts) {
  const pick = parts.find((part) => typeof part === 'string' && part.trim()) || 'Ready to chat.';
  const cleaned = pick
    .replace(/<START>/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/["']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const source = cleaned || 'Ready to chat.';
  return source.length > 110 ? `${source.slice(0, 107).trim()}...` : source;
}

function normalizeCharacterCard(card) {
  const data = card.data || card;
  return {
    name: data.name || card.name || 'Unnamed Character',
    description: data.description || card.description || '',
    personality: data.personality || card.personality || '',
    scenario: data.scenario || card.scenario || '',
    first_mes: data.first_mes || card.first_mes || '',
    mes_example: data.mes_example || card.mes_example || '',
    tags: data.tags || card.tags || [],
  };
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `character-${Date.now().toString(36)}`;
}

function defaultAvatarDataUrl(name = '?') {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#24193d"/><circle cx="256" cy="196" r="94" fill="#8b5cf6"/><rect x="106" y="322" width="300" height="118" rx="58" fill="#6d28d9"/><text x="256" y="226" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="120" font-weight="700" fill="#ffffff">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function ensureCharacterDirs() {
  await fsp.mkdir(LOCAL_CHARACTERS_DIR, { recursive: true });
  await fsp.mkdir(LOCAL_CHARACTER_ASSETS_DIR, { recursive: true });
}

function findLocalCharacterAsset(raw) {
  const direct = String(raw.avatar || '').trim();
  if (/^https?:\/\//i.test(direct) || direct.startsWith('data:')) return direct;
  if (direct && fs.existsSync(path.join(LOCAL_CHARACTER_ASSETS_DIR, direct))) return `${BASE_PATH}/assets/local-characters/${encodeURIComponent(direct)}`;

  const id = String(raw.id || '').trim();
  if (id && fs.existsSync(LOCAL_CHARACTER_ASSETS_DIR)) {
    const match = fs.readdirSync(LOCAL_CHARACTER_ASSETS_DIR).find((file) => file.startsWith(`${id}-`) || file.startsWith(`${id}.`));
    if (match) return `${BASE_PATH}/assets/local-characters/${encodeURIComponent(match)}`;
  }

  const source = String(raw.avatarSourcePath || raw.avatarUrl || '').trim();
  if (/^https?:\/\//i.test(source) || source.startsWith('data:')) return source;
  return '';
}

function serializeLocalCharacter(raw) {
  const card = normalizeCharacterCard(raw);
  const shortDescription = summarizeText(card.scenario, card.description, card.personality);
  const imageUrl = findLocalCharacterAsset(raw) || defaultAvatarDataUrl(card.name);
  return {
    id: raw.id,
    avatar: raw.avatar || '',
    source: 'local',
    importSource: raw.importSource || '',
    sourceUrl: raw.sourceUrl || '',
    score: typeof raw.score === 'number' ? raw.score : null,
    importedAt: raw.importedAt || null,
    type: String(raw.type || 'character') === 'assistant' ? 'assistant' : 'character',
    assistantConfig: raw.assistantConfig && typeof raw.assistantConfig === 'object'
      ? {
          enabled: raw.assistantConfig.enabled !== false,
          openclawAgentId: String(raw.assistantConfig.openclawAgentId || '').trim(),
          runtime: String(raw.assistantConfig.runtime || 'subagent').trim() || 'subagent',
          permissionTier: String(raw.assistantConfig.permissionTier || 'chat').trim() || 'chat',
          badgeLabel: String(raw.assistantConfig.badgeLabel || 'OpenClaw').trim() || 'OpenClaw',
          personalityPrompt: String(raw.assistantConfig.personalityPrompt || '').trim(),
          styleNotes: String(raw.assistantConfig.styleNotes || '').trim(),
          modelOverride: String(raw.assistantConfig.modelOverride || '').trim(),
          thinking: String(raw.assistantConfig.thinking || 'low').trim() || 'low',
        }
      : null,
    ...card,
    shortDescription,
    summary: shortDescription,
    imageUrl,
    fallbackImageUrl: defaultAvatarDataUrl(card.name),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
  };
}

function getLocalCharacterRecord(characterId) {
  const filePath = path.join(LOCAL_CHARACTERS_DIR, `${characterId}.json`);
  return readJsonSafe(filePath, null);
}

function listLocalCharacters() {
  if (!fs.existsSync(LOCAL_CHARACTERS_DIR)) return [];
  const files = fs.readdirSync(LOCAL_CHARACTERS_DIR).filter((file) => file.endsWith('.json'));
  return files.map((file) => {
    const raw = readJsonSafe(path.join(LOCAL_CHARACTERS_DIR, file), null);
    if (!raw) return null;
    return serializeLocalCharacter(raw);
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

function listCharacters() {
  const mountedCharacters = !fs.existsSync(CHARACTERS_DIR) ? [] : fs.readdirSync(CHARACTERS_DIR)
    .filter((file) => file.endsWith('.png'))
    .map((file) => {
      const filePath = path.join(CHARACTERS_DIR, file);
      try {
        const card = normalizeCharacterCard(readPngCharacterCard(filePath));
        const shortDescription = summarizeText(card.scenario, card.description, card.personality);
        return {
          id: file,
          avatar: file,
          source: 'sillytavern',
          importSource: 'sillytavern',
          score: null,
          importedAt: null,
          ...card,
          shortDescription,
          summary: shortDescription,
          imageUrl: `${BASE_PATH}/assets/characters/${encodeURIComponent(file)}`,
          fallbackImageUrl: defaultAvatarDataUrl(card.name),
        };
      } catch {
        const name = file.replace(/\.png$/i, '').replace(/^default_/, '').replace(/[_-]+/g, ' ');
        return {
          id: file,
          avatar: file,
          source: 'sillytavern',
          importSource: 'sillytavern',
          score: null,
          importedAt: null,
          name,
          description: '', personality: '', scenario: '', first_mes: '', mes_example: '', tags: [],
          shortDescription: 'Ready to chat.',
          summary: 'Ready to chat.',
          imageUrl: `${BASE_PATH}/assets/characters/${encodeURIComponent(file)}`,
          fallbackImageUrl: defaultAvatarDataUrl(name),
        };
      }
    });
  return [...mountedCharacters, ...listLocalCharacters()].sort((a, b) => a.name.localeCompare(b.name));
}

function listPersonas() {
  const settings = readJsonSafe(SETTINGS_PATH, {});
  const powerUser = settings.power_user || {};
  const personaNames = powerUser.personas || {};
  const personaDescriptions = powerUser.persona_descriptions || {};
  const files = fs.existsSync(PERSONAS_DIR)
    ? fs.readdirSync(PERSONAS_DIR).filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    : [];

  return files.map((file) => ({
    id: file,
    file,
    name: personaNames[file] || file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    description: personaDescriptions[file]?.description || '',
    imageUrl: `${BASE_PATH}/assets/personas/${encodeURIComponent(file)}`,
    isDefault: powerUser.default_persona === file,
  })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}

function listBackgrounds() {
  if (!fs.existsSync(BACKGROUNDS_DIR)) return [];
  return fs.readdirSync(BACKGROUNDS_DIR)
    .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
    .map((file) => ({
      id: file,
      name: file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
      imageUrl: `${BASE_PATH}/assets/backgrounds/${encodeURIComponent(file)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compactPromptText(label, value, maxChars = 3200) {
  const cleaned = String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxChars - 40)).trim()} … [${label} truncated]`;
}

function sanitizeAvatarReferencePrompt(value) {
  const text = compactPromptText('avatar reference prompt', value || '', 900);
  if (!text) return '';
  const cleaned = text
    .replace(/"[^"]*"/g, ' ')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const appearanceRe = /(hair|bob|ponytail|bangs|eyes?|skin|face|facial|outfit|clothes|clothing|blouse|shirt|jacket|dress|trousers|pants|boots?|neck|silhouette|body type|pale skin|sharp angles|manicured|sleeves|collar)/i;
  const dialogueRe = /^([“"']|so\b|hey\b|what\b|why\b|are you\b|i\b|we\b)/i;
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim().replace(/^[:,;\-.]+|[:,;\-.]+$/g, ''))
    .filter(Boolean)
    .filter((part) => !dialogueRe.test(part));

  const weighted = [];
  for (const rawPart of parts) {
    let part = rawPart
      .replace(/\bacross from you\b/gi, 'across from the viewer')
      .replace(/\byou flip through\b/gi, 'a folder being examined')
      .replace(/\byou\b/gi, 'the viewer')
      .replace(/\bher expression neutral as she watches\b/gi, 'neutral expression, watching')
      .replace(/\bmedium shot\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '');
    if (!part || appearanceRe.test(part)) continue;
    let score = 0;
    if (/(sits?|seated|standing|leaning|leans?|across from the viewer|at the table|tabletop)/i.test(part)) score += 3;
    if (/(expression|neutral|impatient|tense|calm|watchful|focused|bluntly|tapping|gesture|hands?|watching)/i.test(part)) score += 3;
    if (/(lighting|shadows|dim|glow|sunlight|neon|cinematic|indoor|room|atmosphere)/i.test(part)) score += 2;
    if (/(folder|papers?|table|desk|chair|window|door|props?)/i.test(part)) score += 2;
    if (/(close-up|wide shot|framing|camera|over-the-shoulder|low angle|high angle|viewer)/i.test(part)) score += 2;
    if (score > 0) weighted.push({ part, score });
  }

  weighted.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const item of weighted) {
    if (picked.length >= 4) break;
    if (!picked.includes(item.part)) picked.push(item.part);
  }

  const normalized = picked
    .map((part) => part
      .replace(/\bAnby\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/^[:,;\-.]+|[:,;\-.]+$/g, '')
      .trim())
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const part of normalized) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }

  const scene = unique
    .join(', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .trim()
    .replace(/[,\.\s]+$/, '');

  return [
    'same character from the reference image',
    scene || 'seated at a table across from the viewer, leaning forward slightly, neutral expression',
    'focus on pose, expression, framing, lighting, props, and scene only',
    'cinematic dim indoor lighting',
    'medium shot'
  ].filter(Boolean).join(', ');
}
function getUserDisplayName(authUser = null) {
  return String(authUser?.displayName || authUser?.username || '').trim();
}

function getEffectiveUserName(persona = null, authUser = null) {
  return String(persona?.name || getUserDisplayName(authUser) || 'User').trim();
}

function replaceCharacterPlaceholders(value = '', context = {}) {
  const userName = getEffectiveUserName(context.persona, context.authUser);
  const charName = String(context.character?.name || 'Character').trim();
  return String(value || '')
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/<\s*user\s*>/gi, userName)
    .replace(/<\s*char\s*>/gi, charName);
}

function getMessageText(message = null) {
  if (!message || typeof message !== 'object') return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function buildSystemPrompt(character, persona, notes = '', memoryBlock = '', authUser = null) {
  const placeholderContext = { character, persona, authUser };
  const userName = getEffectiveUserName(persona, authUser);
  const sections = [
    'You are roleplaying as the character below. Stay in character, be engaging, and keep replies clear and emotionally readable.',
    `Character name: ${replaceCharacterPlaceholders(character.name, placeholderContext)}`,
    `The user's name is ${userName}. Never output unresolved template placeholders; use the user's real/persona name instead.`,
  ];
  const description = compactPromptText('description', replaceCharacterPlaceholders(character.description, placeholderContext), 2200);
  const personality = compactPromptText('personality', replaceCharacterPlaceholders(character.personality, placeholderContext), 2600);
  const scenario = compactPromptText('scenario', replaceCharacterPlaceholders(character.scenario, placeholderContext), 2200);
  const firstMessage = compactPromptText('first message', replaceCharacterPlaceholders(character.first_mes, placeholderContext), 1200);
  const tags = Array.isArray(character.tags) ? character.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 24).join(', ') : '';
  const personaName = compactPromptText('persona name', userName, 120);
  const personaDescription = compactPromptText('persona description', replaceCharacterPlaceholders(persona?.description || '', placeholderContext), 900);
  const privateNotes = compactPromptText('private notes', notes, 1200);
  if (description) sections.push(`Character description: ${description}`);
  if (personality) sections.push(`Character personality: ${personality}`);
  if (scenario) sections.push(`Scenario: ${scenario}`);
  if (firstMessage) sections.push(`Character opening style / sample greeting: ${firstMessage}`);
  if (tags) sections.push(`Character tags: ${tags}`);
  if (personaName) sections.push(`User persona name: ${personaName}`);
  if (personaDescription) sections.push(`User persona description: ${personaDescription}`);
  if (privateNotes) sections.push(`Private app notes for this character/workspace: ${privateNotes}`);
  if (memoryBlock) sections.push(memoryBlock);
  sections.push('Write vivid, natural dialogue. Avoid meta commentary unless the user explicitly asks for it.');
  return sections.join('\n\n');
}

function normalizeStoredMessage(message) {
  const normalized = {
    role: String(message?.role || 'system'),
    content: typeof message?.content === 'string' ? message.content : '',
  };
  if (message?.pendingImageId) normalized.pendingImageId = String(message.pendingImageId);
  if (Array.isArray(message?.images)) {
    normalized.images = message.images
      .map((item) => typeof item === 'string' ? { url: item } : item)
      .map((item) => ({ url: String(item.url || ''), name: item.name ? String(item.name) : '', type: item.type ? String(item.type) : '' }))
      .filter((item) => item.url);
  }
  return normalized;
}

function toBackendMessage(message, placeholderContext = {}, options = {}) {
  const normalized = normalizeStoredMessage(message);
  const content = replaceCharacterPlaceholders(normalized.content, placeholderContext);
  const allowImages = options.allowImages !== false;
  if (allowImages && normalized.images?.length) {
    return {
      role: normalized.role,
      content: [
        ...(content ? [{ type: 'text', text: content }] : []),
        ...normalized.images.map((image) => ({ type: 'image_url', image_url: { url: image.url } })),
      ],
    };
  }
  return { role: normalized.role, content };
}

function modelSupportsImages(modelId = '') {
  return /(vision|vl|gpt-4o|gpt-4\.1|gemini|claude-3|claude-sonnet|llava|qwen.*vl|minicpm|pixtral|molmo)/i.test(String(modelId || ''));
}

function buildPromptMessagesForCandidate(messages = [], placeholderContext = {}, candidate = null, options = {}) {
  const allowImages = options.allowImages !== undefined
    ? options.allowImages
    : modelSupportsImages(candidate?.model || '');
  return messages.map((message) => toBackendMessage(message, placeholderContext, { allowImages }));
}

function getProviderRuntimeConfig(provider, appConfig, override = null) {
  const providers = appConfig.providers || {};
  const fallbackProvider = String(override?.provider || provider || 'local');
  if (fallbackProvider === 'local') {
    const activeLocalProfile = getActiveLocalProfile(appConfig.endpoints || {});
    return {
      baseUrl: String(override?.baseUrl || activeLocalProfile?.baseUrl || appConfig.endpoints?.localBaseUrl || BACKEND_BASE_URL || '').replace(/\/$/, ''),
      apiKey: String(override?.apiKey || activeLocalProfile?.apiKey || ''),
      provider: fallbackProvider,
    };
  }
  const cfg = providers[fallbackProvider] || {};
  const defaults = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    xai: 'https://api.x.ai/v1',
  };
  return {
    baseUrl: String(override?.baseUrl || cfg.baseUrl || defaults[fallbackProvider] || '').replace(/\/$/, ''),
    apiKey: override?.apiKey || cfg.apiKey || '',
    provider: fallbackProvider,
  };
}

async function fetchBackend(pathname, options = {}, timeoutMs = 6000, provider = 'local', override = null) {
  const config = await loadAppConfig();
  const runtime = getProviderRuntimeConfig(provider, config, override);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${runtime.baseUrl}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(runtime.apiKey ? { Authorization: `Bearer ${runtime.apiKey}` } : {}),
        ...(provider === 'openrouter' && runtime.apiKey ? { 'HTTP-Referer': 'https://your-domain.example/aichat', 'X-Title': 'AIChat' } : {}),
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function writeStreamEvent(res, type, payload = {}) {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function readChatCompletionStream(response, onDelta) {
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.text || '';
        if (!delta) continue;
        content += delta;
        onDelta(delta);
      } catch {}
    }
  }
  return content;
}

async function fetchProviderModels(provider, appConfig) {
  const ensureExtraModels = (models = []) => {
    const list = Array.isArray(models) ? [...models] : [];
    if (provider === 'openrouter' && !list.find((item) => item.id === 'openrouter/openrouter/openai/gpt-5.5')) {
      list.unshift({ id: 'openrouter/openrouter/openai/gpt-5.5', label: 'openrouter/openrouter/openai/gpt-5.5' });
    }
    return list;
  };

  if (provider === 'local') {
    const response = await fetchBackend('/models', {}, 4000, 'local');
    if (!response.ok) throw new Error(`local provider failed (${response.status})`);
    const json = await response.json();
    return ensureExtraModels(Array.isArray(json.data) ? json.data.map((item) => ({ id: item.id, label: item.id })) : []);
  }

  if (!['openai', 'openrouter', 'xai'].includes(provider)) {
    throw new Error(`Provider ${provider} model listing is not supported yet`);
  }

  const response = await fetchBackend('/models', {}, 6000, provider);
  if (!response.ok) throw new Error(`${provider} provider failed (${response.status})`);
  const json = await response.json();
  return ensureExtraModels(Array.isArray(json.data) ? json.data.map((item) => ({ id: item.id, label: item.id })) : []);
}

function defaultUserData() {
  return {
    ui: { backgroundFavorites: [] },
    appUi: {
      displayName: '',
      accent: '#8b5cf6',
      animationLevel: 'medium',
      reduceMotion: false,
      blurStrength: 18,
      transparencyStrength: 0.72,
      backgroundIntensity: 0.16,
      density: 'cozy',
      fontScale: 1,
      enterToSend: true,
      autoPollModels: true,
      autoAppendAutoMemoryToPinned: true,
      imageUseAvatarReferenceDefault: true,
    },
    characterSettings: {},
    memory: {
      seeds: {},
      conversations: {},
    },
    conversations: {},
    session: {
      activePersonaId: '',
      activeCharacterId: '',
      activeConversationId: '',
      panelOpen: true,
      leftOpen: true,
    },
    favorites: [],
  };
}

function normalizeMemoryType(value = '') {
  const allowed = new Set(['fact', 'preference', 'relationship', 'scenario', 'canon', 'promise', 'emotion', 'conflict']);
  const next = String(value || '').trim().toLowerCase();
  return allowed.has(next) ? next : 'fact';
}

function normalizeMemoryPriority(value = '') {
  const next = String(value || '').trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(next) ? next : 'medium';
}

function normalizeMemoryItem(item = {}) {
  return {
    id: String(item.id || `mem_${crypto.randomUUID()}`),
    type: normalizeMemoryType(item.type),
    text: String(item.text || '').trim(),
    confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : null,
    priority: normalizeMemoryPriority(item.priority),
    pinned: item.pinned === true,
    locked: item.locked === true,
    source: ['auto', 'manual', 'seed', 'system'].includes(String(item.source || 'manual')) ? String(item.source || 'manual') : 'manual',
    status: ['active', 'dismissed', 'superseded', 'conflicted'].includes(String(item.status || 'active')) ? String(item.status || 'active') : 'active',
    createdAt: Number(item.createdAt || Date.now()),
    updatedAt: Number(item.updatedAt || Date.now()),
    lastReferencedAt: Number(item.lastReferencedAt || 0) || null,
    metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {},
  };
}

function makeStableMemoryId(type, text) {
  return `mem_${crypto.createHash('sha1').update(`${type}:${text}`).digest('hex').slice(0, 16)}`;
}

function ensureUserMemoryStore(userStore) {
  if (!userStore.memory || typeof userStore.memory !== 'object') userStore.memory = {};
  if (!userStore.memory.seeds || typeof userStore.memory.seeds !== 'object') userStore.memory.seeds = {};
  if (!userStore.memory.conversations || typeof userStore.memory.conversations !== 'object') userStore.memory.conversations = {};
  return userStore.memory;
}

function getConversationMemoryState(userStore, conversationId) {
  const memory = ensureUserMemoryStore(userStore);
  if (!memory.conversations[conversationId]) {
    memory.conversations[conversationId] = { items: [], dismissedAutoTexts: [], snapshot: null, updatedAt: Date.now() };
  }
  const state = memory.conversations[conversationId];
  state.items = Array.isArray(state.items) ? state.items.map(normalizeMemoryItem).filter((item) => item.text) : [];
  state.dismissedAutoTexts = Array.isArray(state.dismissedAutoTexts) ? state.dismissedAutoTexts.map((item) => String(item || '').trim()).filter(Boolean) : [];
  if (!state.snapshot || typeof state.snapshot !== 'object') state.snapshot = null;
  return state;
}

function getCharacterMemorySeeds(userStore, characterId) {
  const memory = ensureUserMemoryStore(userStore);
  if (!Array.isArray(memory.seeds[characterId])) memory.seeds[characterId] = [];
  memory.seeds[characterId] = memory.seeds[characterId].map(normalizeMemoryItem).filter((item) => item.text);
  return memory.seeds[characterId];
}

function buildCharacterSeedMemories(character, storedSeeds = []) {
  const seeds = [];
  const pushSeed = (type, text, priority = 'high', locked = true) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    seeds.push(normalizeMemoryItem({ id: makeStableMemoryId(type, clean), type, text: clean, priority, locked, pinned: true, source: 'seed' }));
  };
  pushSeed('canon', `${character.name} core description: ${character.description || 'No description set.'}`);
  pushSeed('canon', `${character.name} personality baseline: ${character.personality || 'No personality set.'}`);
  if (character.scenario) pushSeed('scenario', `Starting scenario: ${character.scenario}`);
  for (const seed of storedSeeds) pushSeed(seed.type || 'canon', seed.text, seed.priority || 'high', seed.locked !== false);
  const seen = new Set();
  return seeds.filter((item) => {
    const key = `${item.type}:${item.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferEmotionTags(text = '') {
  const source = String(text || '').toLowerCase();
  const tags = [];
  if (/(sorry|hurt|miss|alone|sad|upset|cry)/i.test(source)) tags.push('tender');
  if (/(fight|danger|run|hide|patrol|mission|urgent)/i.test(source)) tags.push('tense');
  if (/(love|like|favorite|enjoy|want)/i.test(source)) tags.push('warm');
  if (/(why|how|what if|curious|wonder)/i.test(source)) tags.push('curious');
  if (!tags.length) tags.push('steady');
  return Array.from(new Set(tags)).slice(0, 3);
}

function deriveAutoMemories(messages = [], dismissedAutoTexts = []) {
  const items = [];
  const dismissed = new Set(dismissedAutoTexts.map((item) => item.toLowerCase()));
  const pushAuto = (type, text, confidence = 0.68, metadata = {}) => {
    const clean = String(text || '').trim();
    if (!clean || dismissed.has(clean.toLowerCase())) return;
    items.push(normalizeMemoryItem({ id: makeStableMemoryId(type, clean), type, text: clean, confidence, priority: confidence > 0.84 ? 'high' : 'medium', source: 'auto', metadata }));
  };
  for (const message of messages) {
    const text = String(message?.content || '').trim();
    if (!text) continue;
    if (message.role === 'user') {
      const likeMatch = text.match(/\b(?:i like|i love|my favorite(?: thing)? is)\s+([^.!?\n]{2,80})/i);
      if (likeMatch) pushAuto('preference', `User likes ${likeMatch[1].trim()}.`, 0.86);
      const amMatch = text.match(/\bi am\s+([^.!?\n]{2,80})/i);
      if (amMatch) pushAuto('fact', `User said they are ${amMatch[1].trim()}.`, 0.71);
      const promiseMatch = text.match(/\b(?:i promise|i will|i won'?t)\s+([^.!?\n]{2,90})/i);
      if (promiseMatch) pushAuto('promise', `User commitment: ${promiseMatch[0].trim()}.`, 0.78);
    }
    if (message.role === 'assistant') {
      const promiseMatch = text.match(/\b(?:i promise|i will|i won't|i can help|trust me)\b([^.!?\n]{0,90})/i);
      if (promiseMatch) pushAuto('relationship', `${promiseMatch[0].trim()}.`, 0.69);
      const locationMatch = text.match(/\b(?:we are|you're in|we're in|location:?|at the)\s+([^.!?\n]{2,80})/i);
      if (locationMatch) pushAuto('scenario', `Scene context: ${locationMatch[0].trim()}.`, 0.62);
    }
  }
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.type}:${item.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, 12);
}

function buildMemorySnapshot(character, conversation, items = []) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const userMessages = messages.filter((item) => item.role === 'user');
  const assistantMessages = messages.filter((item) => item.role === 'assistant');
  const lastAssistant = assistantMessages[assistantMessages.length - 1]?.content || '';
  const trust = Math.max(18, Math.min(96, 30 + userMessages.length * 6 + Math.min(assistantMessages.length, 6) * 4));
  const closeness = trust >= 74 ? 'high' : trust >= 48 ? 'medium' : 'low';
  const attitude = trust >= 74 ? 'Open and invested' : trust >= 48 ? 'Guarded, warming up' : 'Distant but engaged';
  const emotions = inferEmotionTags(`${lastAssistant}\n${userMessages.slice(-2).map((item) => item.content || '').join('\n')}`);
  const scenarioItems = items.filter((item) => item.type === 'scenario' && item.status === 'active');
  const relationshipItems = items.filter((item) => item.type === 'relationship' && item.status === 'active');
  const conflictItems = items.filter((item) => item.type === 'conflict' && item.status === 'active');
  const scenarioText = scenarioItems[0]?.text || character.scenario || '';
  return {
    relationship: {
      trust,
      closeness,
      attitude,
      lastShift: relationshipItems[0]?.text || (userMessages.length > 2 ? 'Trust grew through continued conversation.' : 'No major shift yet.'),
    },
    emotions,
    scenario: {
      location: scenarioText ? scenarioText.replace(/^Scene context:\s*/i, '').slice(0, 90) : 'Undisclosed',
      situation: character.scenario ? summarizeText(character.scenario) : 'Conversation in progress',
      objective: userMessages[userMessages.length - 1]?.content ? summarizeText(userMessages[userMessages.length - 1].content) : 'Keep the conversation moving',
      risk: conflictItems.length ? 'high' : emotions.includes('tense') ? 'medium' : 'low',
    },
    health: conflictItems.length ? 'conflicted' : messages.length > 8 ? 'evolving' : 'stable',
  };
}

function buildConflictItems(items = []) {
  const conflicts = [];
  const lowerTexts = items.filter((item) => item.status === 'active').map((item) => ({ ...item, lower: item.text.toLowerCase() }));
  for (let i = 0; i < lowerTexts.length; i += 1) {
    for (let j = i + 1; j < lowerTexts.length; j += 1) {
      const a = lowerTexts[i];
      const b = lowerTexts[j];
      if (a.type !== b.type) continue;
      if (a.lower === b.lower) continue;
      if (a.type === 'scenario' && (a.lower.includes('scene context') || b.lower.includes('scene context'))) continue;
      if ((a.lower.includes('never') && !b.lower.includes('never')) || (!a.lower.includes('never') && b.lower.includes('never'))) {
        const text = `Potential contradiction between memory items: “${a.text}” vs “${b.text}”.`;
        conflicts.push(normalizeMemoryItem({ id: makeStableMemoryId('conflict', text), type: 'conflict', text, priority: 'high', pinned: false, locked: false, source: 'system', status: 'active', confidence: 0.74, metadata: { related: [a.id, b.id] } }));
      }
    }
  }
  return conflicts.slice(0, 4);
}

function buildConversationMemoryBundle({ userStore, character, conversation }) {
  const memoryState = getConversationMemoryState(userStore, conversation.id);
  const seeds = buildCharacterSeedMemories(character, getCharacterMemorySeeds(userStore, character.id));
  const manualItems = memoryState.items.filter((item) => item.source !== 'auto' && item.status !== 'dismissed');
  const autoItems = deriveAutoMemories(conversation.messages || [], memoryState.dismissedAutoTexts);
  const autoAppendAutoMemoryToPinned = userStore?.appUi?.autoAppendAutoMemoryToPinned !== false;
  const combined = [...seeds, ...manualItems, ...autoItems];
  const conflicts = buildConflictItems(combined);
  const snapshot = buildMemorySnapshot(character, conversation, [...combined, ...conflicts]);
  memoryState.snapshot = snapshot;
  memoryState.updatedAt = Date.now();
  return {
    health: snapshot.health,
    relationship: snapshot.relationship,
    emotions: snapshot.emotions,
    scenario: snapshot.scenario,
    pinned: combined.filter((item) => item.pinned && item.type !== 'canon' && item.type !== 'conflict').slice(0, 12),
    auto: autoAppendAutoMemoryToPinned ? autoItems.filter((item) => !manualItems.some((manual) => manual.text === item.text && manual.type === item.type)).slice(0, 12) : autoItems.slice(0, 12),
    canon: combined.filter((item) => item.type === 'canon').slice(0, 12),
    conflicts,
    allItems: combined,
  };
}

function buildMemoryPromptBlock(memoryBundle) {
  const sections = [];
  const pushSection = (title, rows = []) => {
    const filtered = rows.filter(Boolean).slice(0, 5);
    if (!filtered.length) return;
    sections.push(`${title}:\n- ${filtered.join('\n- ')}`);
  };
  pushSection('Locked canon', (memoryBundle.canon || []).map((item) => item.text));
  pushSection('Pinned memory', (memoryBundle.pinned || []).map((item) => item.text));
  if (memoryBundle.relationship) {
    pushSection('Relationship state', [
      `Trust ${memoryBundle.relationship.trust}/100`,
      `Closeness ${memoryBundle.relationship.closeness}`,
      memoryBundle.relationship.attitude,
      memoryBundle.relationship.lastShift,
    ]);
  }
  if (memoryBundle.scenario) {
    pushSection('Active scenario', Object.values(memoryBundle.scenario).map((item) => String(item || '')).filter(Boolean));
  }
  pushSection('Relevant auto memory', (memoryBundle.auto || []).map((item) => item.text));
  if (!sections.length) return '';
  return `Live memory state for continuity:\n\n${sections.join('\n\n')}`;
}

function defaultStore() {
  return {
    version: 2,
    users: {},
  };
}

function slugProfileId(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'local-profile';
}

function normalizeLocalProfiles(endpoints = {}) {
  const incoming = Array.isArray(endpoints.localProfiles) ? endpoints.localProfiles : [];
  const legacyBaseUrl = String(endpoints.localBaseUrl || BACKEND_BASE_URL || '').trim();
  const legacyLabel = String(endpoints.providerLabel || DEFAULT_PROVIDER_LABEL || 'local').trim() || 'local';
  const profiles = incoming.length
    ? incoming.map((profile, index) => ({
        id: slugProfileId(profile.id || profile.label || `local-${index + 1}`),
        label: String(profile.label || `Local ${index + 1}`).trim() || `Local ${index + 1}`,
        baseUrl: String(profile.baseUrl || '').trim(),
        apiKey: String(profile.apiKey || '').trim(),
      })).filter((profile) => profile.baseUrl)
    : (legacyBaseUrl ? [{ id: 'primary-local', label: legacyLabel, baseUrl: legacyBaseUrl, apiKey: '' }] : []);
  return profiles.length ? profiles : [{ id: 'primary-local', label: legacyLabel || 'local', baseUrl: legacyBaseUrl || BACKEND_BASE_URL || '', apiKey: '' }];
}

function getActiveLocalProfile(endpoints = {}) {
  const profiles = normalizeLocalProfiles(endpoints);
  const activeId = String(endpoints.activeLocalProfileId || '').trim();
  return profiles.find((profile) => profile.id === activeId) || profiles[0];
}

function defaultAppConfig() {
  return {
    endpoints: {
      localBaseUrl: BACKEND_BASE_URL,
      localProfiles: [{ id: 'primary-local', label: DEFAULT_PROVIDER_LABEL, baseUrl: BACKEND_BASE_URL, apiKey: '' }],
      activeLocalProfileId: 'primary-local',
      providerLabel: DEFAULT_PROVIDER_LABEL,
      defaultModel: DEFAULT_MODEL,
      mainModel: '',
      fallbackProvider1: 'local',
      fallbackModel1: '',
      fallbackOverride1: { enabled: false, provider: '', baseUrl: '', model: '', apiKey: '' },
      fallbackProvider2: 'local',
      fallbackModel2: '',
      fallbackOverride2: { enabled: false, provider: '', baseUrl: '', model: '', apiKey: '' },
      requestTimeoutMs: 120000,
    },
    providers: {
      openai: { enabled: false, apiKey: '', baseUrl: '', defaultModel: '' },
      openrouter: { enabled: false, apiKey: '', baseUrl: '', defaultModel: '' },
      anthropic: { enabled: false, apiKey: '', baseUrl: '', defaultModel: '' },
      gemini: { enabled: false, apiKey: '', baseUrl: '', defaultModel: '' },
      xai: { enabled: false, apiKey: '', baseUrl: '', defaultModel: '' },
    },
    nexusApi: {
      enabled: true,
      allowSessionAuth: true,
      offlineMessage: 'NEXUS API is currently disabled by the admin.',
      keys: [],
    },
  };
}

let storeWriteQueue = Promise.resolve();

async function ensureStore() {
  await fsp.mkdir(APP_DATA_DIR, { recursive: true });
  await fsp.mkdir(AUDIO_CACHE_DIR, { recursive: true });
  await ensureCharacterDirs();
  await ensureUsersFile();
  try {
    await fsp.access(STORE_PATH);
  } catch {
    await fsp.writeFile(STORE_PATH, JSON.stringify(defaultStore(), null, 2));
  }
  try {
    await fsp.access(APP_CONFIG_PATH);
  } catch {
    await fsp.writeFile(APP_CONFIG_PATH, JSON.stringify(defaultAppConfig(), null, 2));
  }
}

function mergeUserData(data = {}) {
  return {
    ...defaultUserData(),
    ...data,
    ui: { ...defaultUserData().ui, ...(data.ui || {}) },
    appUi: { ...defaultUserData().appUi, ...(data.appUi || {}) },
    characterSettings: data.characterSettings || {},
    conversations: data.conversations || {},
    session: { ...defaultUserData().session, ...(data.session || {}) },
    favorites: Array.isArray(data.favorites) ? data.favorites.map(String) : [],
  };
}

function migrateLegacyStore(parsed) {
  if (parsed?.users) return parsed;
  const migrated = defaultStore();
  if (parsed && (parsed.ui || parsed.characterSettings || parsed.conversations)) {
    migrated.users.epic = mergeUserData({
      ui: parsed.ui || {},
      characterSettings: parsed.characterSettings || {},
      conversations: parsed.conversations || {},
    });
  }
  return migrated;
}

async function loadStore() {
  await ensureStore();
  try {
    const raw = await fsp.readFile(STORE_PATH, 'utf8');
    const parsed = migrateLegacyStore(JSON.parse(raw));
    const next = {
      ...defaultStore(),
      ...parsed,
      users: Object.fromEntries(Object.entries(parsed.users || {}).map(([username, data]) => [normalizeUsername(username), mergeUserData(data)])),
    };
    return next;
  } catch {
    return defaultStore();
  }
}

async function saveStore(store) {
  await ensureStore();
  storeWriteQueue = storeWriteQueue.then(() => fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2)));
  return storeWriteQueue;
}

async function loadAppConfig() {
  await ensureStore();
  const parsed = readJsonSafe(APP_CONFIG_PATH, defaultAppConfig());
  const defaults = defaultAppConfig();
  const endpoints = { ...defaults.endpoints, ...(parsed.endpoints || {}) };
  const localProfiles = normalizeLocalProfiles(endpoints);
  const activeLocalProfile = getActiveLocalProfile({ ...endpoints, localProfiles });
  return {
    ...defaults,
    ...parsed,
    endpoints: {
      ...endpoints,
      localProfiles,
      activeLocalProfileId: activeLocalProfile.id,
      localBaseUrl: activeLocalProfile.baseUrl || endpoints.localBaseUrl || BACKEND_BASE_URL,
      providerLabel: endpoints.providerLabel || activeLocalProfile.label || DEFAULT_PROVIDER_LABEL,
    },
    providers: Object.fromEntries(Object.entries(defaults.providers).map(([key, value]) => [key, { ...value, ...((parsed.providers || {})[key] || {}) }])),
    nexusApi: {
      ...defaults.nexusApi,
      ...((parsed.nexusApi || {})),
      keys: Array.isArray(parsed?.nexusApi?.keys) ? parsed.nexusApi.keys.map((item) => ({
        id: String(item?.id || '').trim(),
        label: String(item?.label || 'Unnamed key').trim() || 'Unnamed key',
        secretHash: String(item?.secretHash || '').trim(),
        secretPreview: String(item?.secretPreview || '').trim(),
        status: ['active', 'disabled', 'revoked'].includes(String(item?.status || '').trim()) ? String(item.status).trim() : 'active',
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
        lastUsedAt: item?.lastUsedAt || '',
        lastUsedMeta: item?.lastUsedMeta || null,
        notes: String(item?.notes || '').trim(),
        createdBy: String(item?.createdBy || '').trim(),
        rotatedFrom: String(item?.rotatedFrom || '').trim(),
      })).filter((item) => item.id && item.secretHash) : [],
    },
  };
}

async function saveAppConfig(config) {
  await ensureStore();
  await fsp.writeFile(APP_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function maskProviders(providers = {}) {
  return Object.fromEntries(Object.entries(providers).map(([key, value]) => [key, {
    ...value,
    apiKey: value.apiKey ? `${String(value.apiKey).slice(0, 4)}••••${String(value.apiKey).slice(-2)}` : '',
    hasKey: Boolean(value.apiKey),
  }]));
}

function generateNexusApiSecret() {
  return `nxs_${crypto.randomBytes(24).toString('base64url')}`;
}

function hashNexusApiSecret(secret = '') {
  return crypto.createHash('sha256').update(String(secret || '').trim()).digest('hex');
}

function previewNexusApiSecret(secret = '') {
  const value = String(secret || '').trim();
  if (!value) return '';
  return `${value.slice(0, 8)}••••${value.slice(-4)}`;
}

function maskNexusApiKeyRecord(record = {}) {
  return {
    id: String(record.id || '').trim(),
    label: String(record.label || 'Unnamed key').trim() || 'Unnamed key',
    secretPreview: String(record.secretPreview || '').trim(),
    status: ['active', 'disabled', 'revoked'].includes(String(record.status || '').trim()) ? String(record.status).trim() : 'active',
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
    lastUsedAt: record.lastUsedAt || '',
    lastUsedMeta: record.lastUsedMeta || null,
    notes: String(record.notes || '').trim(),
    createdBy: String(record.createdBy || '').trim(),
    rotatedFrom: String(record.rotatedFrom || '').trim(),
  };
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean)[0];
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

async function authenticateNexusApiRequest(req, { allowSessionFallback = true } = {}) {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  if (nexusApi.enabled !== true) {
    const error = new Error(String(nexusApi.offlineMessage || 'NEXUS API is currently disabled by the admin.'));
    error.statusCode = 503;
    error.payload = { ok: false, error: 'NEXUS API disabled', detail: String(nexusApi.offlineMessage || 'NEXUS API is currently disabled by the admin.') };
    throw error;
  }

  const authHeader = String(req.headers.authorization || '').trim();
  if (/^Bearer\s+/i.test(authHeader)) {
    const secret = authHeader.replace(/^Bearer\s+/i, '').trim();
    const secretHash = hashNexusApiSecret(secret);
    const match = (Array.isArray(nexusApi.keys) ? nexusApi.keys : []).find((item) => item.secretHash === secretHash);
    if (!match) {
      const error = new Error('Invalid API key');
      error.statusCode = 401;
      error.payload = { ok: false, error: 'Invalid API key' };
      throw error;
    }
    if (match.status !== 'active') {
      const error = new Error(`API key is ${match.status}`);
      error.statusCode = 403;
      error.payload = { ok: false, error: `API key is ${match.status}` };
      throw error;
    }
    match.lastUsedAt = new Date().toISOString();
    match.updatedAt = match.lastUsedAt;
    match.lastUsedMeta = {
      ip: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 240),
    };
    config.nexusApi = nexusApi;
    await saveAppConfig(config);
    req.nexusApiKey = maskNexusApiKeyRecord(match);
    req.nexusAuthMode = 'api-key';
    req.authUser = { username: `api-${String(match.id || 'key').slice(0, 12)}`, displayName: match.label || 'API client', isAdmin: false, role: 'user' };
    return { mode: 'api-key', config, nexusApi, key: match };
  }

  if (allowSessionFallback && nexusApi.allowSessionAuth === true) {
    const session = getAuthenticatedSession(req);
    if (session) {
      const usersFile = await loadUsers();
      const user = usersFile.users?.[session.username];
      if (user) {
        req.authUser = sanitizeUser(user);
        req.authUserRecord = user;
        req.sessionToken = session.token;
        req.nexusAuthMode = 'session';
        return { mode: 'session', config, nexusApi, user };
      }
    }
  }

  const error = new Error(nexusApi.allowSessionAuth === true ? 'Authentication required (session or Bearer API key)' : 'Bearer API key required');
  error.statusCode = 401;
  error.payload = { ok: false, error: nexusApi.allowSessionAuth === true ? 'Authentication required (session or Bearer API key)' : 'Bearer API key required' };
  throw error;
}

async function requireNexusApiAccess(req, res, next) {
  try {
    await authenticateNexusApiRequest(req, { allowSessionFallback: true });
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json(error.payload || { ok: false, error: String(error?.message || error) });
  }
}

async function saveDataUrlAsset(dataUrl, baseName) {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return '';
  const mime = match[1];
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const fileName = `${baseName}.${ext}`;
  await ensureCharacterDirs();
  await fsp.writeFile(path.join(LOCAL_CHARACTER_ASSETS_DIR, fileName), Buffer.from(match[2], 'base64'));
  return fileName;
}

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return { mime, ext, buffer: Buffer.from(match[2], 'base64') };
}

function getRequestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host || /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) return PUBLIC_APP_ORIGIN;
  return proto + '://' + host;
}

async function saveMessageImageAsset(dataUrl, req, baseName = 'upload-' + Date.now() + '-' + crypto.randomUUID()) {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) return '';
  await fsp.mkdir(MESSAGE_IMAGE_DIR, { recursive: true });
  const fileName = baseName + '.' + parsed.ext;
  await fsp.writeFile(path.join(MESSAGE_IMAGE_DIR, fileName), parsed.buffer);
  const origin = getRequestOrigin(req);
  return origin ? origin + BASE_PATH + '/assets/message-images/' + encodeURIComponent(fileName) : '';
}

async function saveRemoteImageAsset(imageUrl, req, baseName = 'replicate-' + Date.now() + '-' + crypto.randomUUID()) {
  if (!imageUrl) return '';
  const response = await fetch(String(imageUrl), { headers: { 'User-Agent': 'Mozilla/5.0 AIChatReplicate/1.0' } });
  if (!response.ok) throw new Error(`Could not fetch generated image (${response.status})`);
  const contentType = String(response.headers.get('content-type') || 'image/png').toLowerCase();
  const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') ? 'jpg' : 'png';
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(REPLICATE_ASSET_DIR, { recursive: true });
  const fileName = `${baseName}.${ext}`;
  await fsp.writeFile(path.join(REPLICATE_ASSET_DIR, fileName), buffer);
  const origin = getRequestOrigin(req);
  return origin ? origin + BASE_PATH + '/assets/replicate/' + encodeURIComponent(fileName) : '';
}

async function saveReplicateReferenceFromCharacter(character, req, baseName = 'replicate-ref-' + Date.now() + '-' + crypto.randomUUID()) {
  if (!character) return '';
  let sourcePath = '';
  if (character.source === 'local' && character.avatar) {
    sourcePath = path.join(LOCAL_CHARACTER_ASSETS_DIR, String(character.avatar));
  } else if (character.avatar) {
    sourcePath = path.join(CHARACTERS_DIR, String(character.avatar));
  }
  if ((!sourcePath || !fs.existsSync(sourcePath)) && character.source === 'local') {
    const record = getLocalCharacterRecord(character.id);
    if (record?.avatar) {
      const candidate = path.join(LOCAL_CHARACTER_ASSETS_DIR, String(record.avatar));
      if (fs.existsSync(candidate)) sourcePath = candidate;
    }
  }
  if ((!sourcePath || !fs.existsSync(sourcePath)) && String(character.imageUrl || '').includes('/assets/local-characters/')) {
    const imagePath = String(character.imageUrl || '').replace(`${BASE_PATH}/assets/local-characters/`, '');
    const candidate = path.join(LOCAL_CHARACTER_ASSETS_DIR, decodeURIComponent(imagePath));
    if (fs.existsSync(candidate)) sourcePath = candidate;
  }
  if ((!sourcePath || !fs.existsSync(sourcePath)) && String(character.imageUrl || '').includes('/assets/characters/')) {
    const imagePath = String(character.imageUrl || '').replace(`${BASE_PATH}/assets/characters/`, '');
    const candidate = path.join(CHARACTERS_DIR, decodeURIComponent(imagePath));
    if (fs.existsSync(candidate)) sourcePath = candidate;
  }
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    const imagePath = String(character.imageUrl || '').replace(`${BASE_PATH}/assets/local-characters/`, '').replace(`${BASE_PATH}/assets/characters/`, '');
    if (imagePath && String(character.imageUrl || '').includes('/assets/local-characters/')) sourcePath = path.join(LOCAL_CHARACTER_ASSETS_DIR, decodeURIComponent(imagePath));
    else if (imagePath && String(character.imageUrl || '').includes('/assets/characters/')) sourcePath = path.join(CHARACTERS_DIR, decodeURIComponent(imagePath));
  }
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.error('saveReplicateReferenceFromCharacter missing source', {
      id: character.id,
      source: character.source,
      avatar: character.avatar,
      imageUrl: character.imageUrl,
      sourcePath,
      localAssetsDir: LOCAL_CHARACTER_ASSETS_DIR,
      charactersDir: CHARACTERS_DIR,
    });
    throw new Error('Character avatar source file not found');
  }
  await fsp.mkdir(REPLICATE_ASSET_DIR, { recursive: true });
  const ext = path.extname(sourcePath) || '.png';
  const fileName = `${baseName}${ext}`;
  await fsp.copyFile(sourcePath, path.join(REPLICATE_ASSET_DIR, fileName));
  const origin = getRequestOrigin(req);
  return origin ? origin + BASE_PATH + '/public/replicate/' + encodeURIComponent(fileName) : '';
}

function buildGeneratedImageCaption({ prompt = '', styleLabel = '' } = {}) {
  const cleanPrompt = String(prompt || '').trim();
  const cleanStyle = String(styleLabel || '').trim();
  return cleanStyle ? `Generated image (${cleanStyle}): ${cleanPrompt}` : `Generated image: ${cleanPrompt}`;
}

async function appendGeneratedImageToConversation(userStore, { characterId, personaId = '', conversationId = '', imageUrl = '', prompt = '', styleLabel = '' } = {}) {
  const key = getConversationBucketKey(characterId, personaId);
  const list = userStore.conversations[key] || [];
  const conversation = list.find((item) => item.id === conversationId);
  if (!conversation) return false;
  const caption = buildGeneratedImageCaption({ prompt, styleLabel });
  conversation.messages = [
    ...(Array.isArray(conversation.messages) ? conversation.messages : []),
    normalizeStoredMessage({
      role: 'assistant',
      content: caption,
      images: [{ url: imageUrl, name: 'generated-image', type: 'image/png' }],
    }),
  ];
  conversation.preview = caption.slice(0, 120) || conversation.preview || '';
  conversation.updatedAt = Date.now();
  userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return true;
}

function replacePendingImageMessage(userStore, { characterId, personaId = '', conversationId = '', pendingImageId = '', nextMessage = null } = {}) {
  const key = getConversationBucketKey(characterId, personaId);
  const list = userStore.conversations[key] || [];
  const conversation = list.find((item) => item.id === conversationId);
  if (!conversation) return false;
  let replaced = false;
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  conversation.messages = messages.map((message) => {
    if (!replaced && message?.pendingImageId === pendingImageId) {
      replaced = true;
      return nextMessage ? normalizeStoredMessage(nextMessage) : null;
    }
    return normalizeStoredMessage(message);
  }).filter(Boolean);
  if (!replaced && nextMessage) conversation.messages.push(normalizeStoredMessage(nextMessage));
  const previewSource = nextMessage?.content || conversation.messages[conversation.messages.length - 1]?.content || conversation.preview || '';
  conversation.preview = String(previewSource || '').slice(0, 120) || conversation.preview || '';
  conversation.updatedAt = Date.now();
  userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return true;
}

async function getReplicateModelVersion(modelName = REPLICATE_IMAGE_MODEL) {
  if (!REPLICATE_API_TOKEN) throw new Error('Replicate is not configured');
  const response = await fetch(`https://api.replicate.com/v1/models/${modelName}`, {
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Accept': 'application/json',
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.detail || json?.title || json?.error || `Replicate model lookup failed (${response.status})`);
  const version = json?.latest_version?.id || json?.default_example?.version;
  if (!version) throw new Error(`Replicate model version not found for ${modelName}`);
  return version;
}

async function createReplicatePrediction(input = {}, modelName = REPLICATE_IMAGE_MODEL) {
  if (!REPLICATE_API_TOKEN) throw new Error('Replicate is not configured');
  const version = await getReplicateModelVersion(modelName);
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ version, input }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.detail || json?.title || json?.error || `Replicate request failed (${response.status})`);
  return json;
}

function readOpenClawAuthProfiles() {
  const candidates = [
    process.env.OPENCLAW_AUTH_PROFILES_PATH,
    '/root/.openclaw/agents/orchestrator/agent/auth-profiles.json',
    '/root/.openclaw/agents/main/agent/auth-profiles.json',
  ].filter(Boolean);
  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

function getOpenClawManagedOpenAiCredential() {
  const profiles = readOpenClawAuthProfiles();
  const entries = profiles?.profiles && typeof profiles.profiles === 'object' ? Object.values(profiles.profiles) : [];

  // Prefer Codex OAuth for image generation. OpenClaw's newer image pipeline routes
  // gpt-image-* through the Codex Responses backend, not api.openai.com/images/*.
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.provider === 'openai-codex' && entry.type === 'oauth' && entry.access) {
      return {
        apiKey: String(entry.access).trim(),
        accountId: String(entry.accountId || '').trim(),
        authMode: 'openclaw-codex-oauth',
      };
    }
  }
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.provider === 'openai' && entry.type === 'api_key' && entry.key) {
      return { apiKey: String(entry.key).trim(), accountId: '', authMode: 'openclaw-api-key' };
    }
  }
  return { apiKey: '', accountId: '', authMode: 'none' };
}

function getOpenClawManagedOpenRouterCredential() {
  const profiles = readOpenClawAuthProfiles();
  const entries = profiles?.profiles && typeof profiles.profiles === 'object' ? Object.values(profiles.profiles) : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.provider === 'openrouter' && entry.type === 'api_key' && entry.key) {
      return { apiKey: String(entry.key).trim(), authMode: 'openclaw-openrouter-api-key' };
    }
  }
  return { apiKey: '', authMode: 'none' };
}

function getOpenAiImageRuntimeConfig(appConfig = {}) {
  const provider = appConfig?.providers?.openai || {};
  const managed = getOpenClawManagedOpenAiCredential();
  return {
    apiKey: String(process.env.OPENAI_API_KEY || provider.apiKey || managed.apiKey || '').trim(),
    accountId: String(process.env.OPENAI_ACCOUNT_ID || provider.accountId || managed.accountId || '').trim(),
    authMode: String(process.env.OPENAI_AUTH_MODE || provider.authMode || managed.authMode || '').trim(),
    baseUrl: String(process.env.OPENAI_BASE_URL || provider.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: String(provider.defaultImageModel || provider.imageModel || OPENAI_IMAGE_MODEL).trim() || OPENAI_IMAGE_MODEL,
  };
}

function getOpenRouterImageRuntimeConfig(appConfig = {}) {
  const provider = appConfig?.providers?.openrouter || {};
  const managed = getOpenClawManagedOpenRouterCredential();
  return {
    apiKey: String(process.env.OPENROUTER_API_KEY || provider.apiKey || managed.apiKey || '').trim(),
    authMode: String(process.env.OPENROUTER_AUTH_MODE || provider.authMode || managed.authMode || '').trim(),
    baseUrl: String(process.env.OPENROUTER_BASE_URL || provider.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: String(provider.defaultImageModel || provider.imageModel || OPENROUTER_IMAGE_MODEL).trim() || OPENROUTER_IMAGE_MODEL,
  };
}

function parseCodexImageSseResult(body = '') {
  const events = [];
  for (const line of String(body || '').split(/\r?\n/)) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (!data || data === '[DONE]') continue;
    try { events.push(JSON.parse(data)); } catch {}
  }
  const failure = events.find((event) => event?.type === 'response.failed' || event?.type === 'error');
  if (failure) throw new Error(failure?.error?.message || failure?.message || 'OpenAI Codex image generation failed');

  const outputDone = events.find((event) => event?.type === 'response.output_item.done' && event?.item?.type === 'image_generation_call' && event?.item?.result);
  const completed = [...events].reverse().find((event) => event?.type === 'response.completed');
  const completedImage = completed?.response?.output?.find((item) => item?.type === 'image_generation_call' && item?.result);
  const image = outputDone?.item || completedImage;
  const b64 = image?.result || '';
  if (!b64) throw new Error('OpenAI Codex returned no image data');
  return { b64, revisedPrompt: image?.revised_prompt || '' };
}

async function createOpenAiCodexImageEdit({ runtime, prompt, size, imageBuffer, imageMimeType, outputFormat, quality } = {}) {
  const model = runtime.model.replace(/^openai\//, '') || 'gpt-image-2';
  const requestSignal = AbortSignal.timeout(45000);
  const imageDataUrl = `data:${imageMimeType || 'image/png'};base64,${Buffer.from(imageBuffer).toString('base64')}`;
  const body = {
    model: 'gpt-5.5',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: String(prompt || '').trim() },
        { type: 'input_image', image_url: imageDataUrl, detail: 'auto' },
      ],
    }],
    instructions: 'You are an image generation assistant.',
    tools: [{
      type: 'image_generation',
      model,
      size,
      quality,
      output_format: outputFormat,
    }],
    tool_choice: { type: 'image_generation' },
    stream: true,
    store: false,
  };

  const response = await fetch('https://chatgpt.com/backend-api/codex/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${runtime.apiKey}`,
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: requestSignal,
  });
  const text = await response.text();
  if (!response.ok) {
    let json = null;
    try { json = JSON.parse(text); } catch {}
    throw new Error(json?.detail || json?.error?.message || json?.message || `OpenAI Codex image edit failed (${response.status})`);
  }
  const result = parseCodexImageSseResult(text);
  return {
    model: runtime.model,
    b64: result.b64,
    mimeType: outputFormat === 'webp' ? 'image/webp' : outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
    revisedPrompt: result.revisedPrompt,
  };
}

async function createOpenRouterImageEdit({ prompt, imageBuffer, imageMimeType, aspectRatio = '4:5', imageModel = '' } = {}) {
  const appConfig = await loadAppConfig();
  const requestSignal = AbortSignal.timeout(85000);
  const runtime = getOpenRouterImageRuntimeConfig(appConfig);
  if (!runtime.apiKey) throw new Error('OpenRouter image fallback is not configured');
  const imageDataUrl = `data:${imageMimeType || 'image/png'};base64,${Buffer.from(imageBuffer).toString('base64')}`;
  const response = await fetch(`${runtime.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${runtime.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-domain.example/aichat',
      'X-Title': 'AIChat',
    },
    body: JSON.stringify({
      model: String(imageModel || runtime.model).replace(/^openrouter\//, ''),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: String(prompt || '').trim() },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: aspectRatio || '4:5' },
    }),
    signal: requestSignal,
  });
  const responseText = await response.text();
  let json = {};
  try { json = responseText ? JSON.parse(responseText) : {}; } catch {}
  if (!response.ok) throw new Error(json?.error?.message || json?.message || `OpenRouter image fallback failed (${response.status})`);
  const message = json?.choices?.[0]?.message || {};
  const image = Array.isArray(message.images) ? message.images[0] : null;
  const imageUrl = image?.image_url?.url || image?.imageUrl?.url || '';
  if (!imageUrl || !/^data:image\//.test(imageUrl)) {
    const debug = {
      hasChoices: Array.isArray(json?.choices),
      finishReason: json?.choices?.[0]?.finish_reason || '',
      messageKeys: message && typeof message === 'object' ? Object.keys(message).slice(0, 12) : [],
      contentType: typeof message?.content,
      contentPreview: Array.isArray(message?.content)
        ? JSON.stringify(message.content.slice(0, 2)).slice(0, 220)
        : String(message?.content || '').slice(0, 220),
      responsePreview: String(responseText || '').slice(0, 320),
    };
    throw new Error(`OpenRouter returned no image data :: ${JSON.stringify(debug)}`);
  }
  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('OpenRouter returned invalid image data');
  return {
    model: OPENAI_IMAGE_MODEL,
    b64: match[2],
    mimeType: match[1] || 'image/png',
    revisedPrompt: message?.content || '',
    provider: 'openrouter',
    providerModel: String(imageModel || runtime.model),
  };
}

async function createOpenAiImageEdit({ prompt, size = '1024x1536', imageUrl = '', referenceImages = [], outputFormat = 'png', quality = 'medium', aspectRatio = '4:5', imageModel = OPENAI_IMAGE_MODEL, preferReferenceFidelity = false } = {}) {
  const appConfig = await loadAppConfig();
  const runtime = getOpenAiImageRuntimeConfig(appConfig);
  const inputReferences = [];

  if (imageUrl) {
    const sourceResponse = await fetch(imageUrl);
    if (!sourceResponse.ok) throw new Error(`Reference image fetch failed (${sourceResponse.status})`);
    const contentType = String(sourceResponse.headers.get('content-type') || 'image/png').split(';')[0].trim() || 'image/png';
    const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    const imageArrayBuffer = await sourceResponse.arrayBuffer();
    inputReferences.push({ contentType, ext, imageBuffer: Buffer.from(imageArrayBuffer) });
  }

  for (const ref of Array.isArray(referenceImages) ? referenceImages : []) {
    const parsed = dataUrlToBuffer(String(ref?.dataUrl || ref?.url || ''));
    if (!parsed) continue;
    inputReferences.push({ contentType: parsed.mime, ext: parsed.ext, imageBuffer: parsed.buffer });
  }

  if (!inputReferences.length) throw new Error('At least one reference image is required');

  const primaryReference = inputReferences[0];
  const { contentType, ext, imageBuffer } = primaryReference;

  const tryCodexFallback = async (reason) => {
    if (runtime.authMode !== 'openclaw-codex-oauth') throw new Error(reason || 'OpenAI Codex fallback unavailable');
    try {
      const fallback = await createOpenAiCodexImageEdit({
        runtime,
        prompt,
        size,
        imageBuffer,
        imageMimeType: contentType,
        outputFormat,
        quality,
      });
      return { ...fallback, fallbackFrom: reason || '' };
    } catch (fallbackError) {
      throw new Error(`${reason ? `${reason}; ` : ''}${String(fallbackError?.message || fallbackError)}`);
    }
  };

  const tryOpenRouterPrimary = async (reason) => {
    try {
      const openRouterModel = imageModel && imageModel !== OPENAI_IMAGE_MODEL ? imageModel : '';
      const primary = await createOpenRouterImageEdit({ prompt, imageBuffer, imageMimeType: contentType, aspectRatio, imageModel: openRouterModel });
      return { ...primary, primaryReason: reason || '' };
    } catch (openRouterError) {
      return await tryCodexFallback(`${reason ? `${reason}; ` : ''}${String(openRouterError?.message || openRouterError)}`);
    }
  };

  if (imageModel && imageModel !== OPENAI_IMAGE_MODEL) {
    return await tryOpenRouterPrimary('Advanced image model');
  }

  if (!runtime.apiKey) {
    return await tryOpenRouterPrimary('OpenAI image generation is not configured');
  }

  if (runtime.authMode === 'openclaw-codex-oauth' && !preferReferenceFidelity) {
    return await tryOpenRouterPrimary('OpenRouter primary path');
  }

  const form = new FormData();
  form.set('model', String(imageModel || runtime.model).replace(/^openai\//, ''));
  form.set('prompt', String(prompt || '').trim());
  form.set('size', size);
  form.set('quality', quality);
  form.set('output_format', outputFormat);
  for (const [index, reference] of inputReferences.entries()) {
    const blob = new Blob([reference.imageBuffer], { type: reference.contentType });
    form.append('image[]', blob, `reference-${index + 1}.${reference.ext}`);
  }

  const response = await fetch(`${runtime.baseUrl}/images/edits`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${runtime.apiKey}`,
      'Accept': 'application/json',
    },
    body: form,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) return await tryOpenRouterPrimary(`OpenAI image edit failed (${response.status})`);
  const image = Array.isArray(json?.data) ? json.data[0] : null;
  const b64 = image?.b64_json || image?.b64Json || '';
  if (!b64) return await tryOpenRouterPrimary('OpenAI returned no image data');
  return {
    model: runtime.model,
    b64,
    mimeType: outputFormat === 'webp' ? 'image/webp' : outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
    revisedPrompt: image?.revised_prompt || '',
    provider: 'openai',
  };
}

async function waitForReplicatePrediction(predictionId, timeoutMs = 420000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.detail || json?.title || json?.error || `Replicate polling failed (${response.status})`);
    if (json.status === 'succeeded') return json;
    if (json.status === 'failed' || json.status === 'canceled') throw new Error(json.error || `Replicate ${json.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1400));
  }
  throw new Error('Replicate generation timed out');
}

async function resolveMessageImagesForBackend(messages = [], req) {
  const normalizedMessages = [];
  for (const message of messages) {
    const normalized = normalizeStoredMessage(message);
    if (!normalized.images?.length) {
      normalizedMessages.push(normalized);
      continue;
    }
    const nextImages = [];
    for (const image of normalized.images) {
      const url = String(image.url || '');
      if (/^data:image\//i.test(url)) {
        const hostedUrl = await saveMessageImageAsset(url, req);
        if (hostedUrl) {
          nextImages.push({ ...image, url: hostedUrl });
          continue;
        }
      }
      nextImages.push(image);
    }
    normalized.images = nextImages;
    normalizedMessages.push(normalized);
  }
  return normalizedMessages;
}

async function loadImportLog() {
  await ensureStore();
  return readJsonSafe(IMPORT_LOG_PATH, []);
}

async function appendImportLog(entry) {
  const current = await loadImportLog();
  current.unshift({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), ...entry });
  await fsp.writeFile(IMPORT_LOG_PATH, JSON.stringify(current.slice(0, 500), null, 2));
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

function validateAcquiredCard(card) {
  const reasons = [];
  const personalityLength = (card.personality || '').length;
  const scenarioLength = (card.scenario || '').length;
  const firstLength = (card.first_mes || '').length;
  const exampleLength = (card.mes_example || '').length;
  const richEnoughWithoutExamples = personalityLength >= 420 && scenarioLength >= 160 && firstLength >= 120;
  if (!card.name) reasons.push('missing name');
  if (!card.personality) reasons.push('missing personality');
  if (!card.scenario) reasons.push('missing scenario');
  if (!card.first_mes) reasons.push('missing first message');
  if (personalityLength < 180) reasons.push('personality too short');
  if (scenarioLength < 90) reasons.push('scenario too short');
  if (firstLength < 70) reasons.push('first message too short');
  if (exampleLength < 80 && !richEnoughWithoutExamples) reasons.push('example dialogue too short');
  return { ok: reasons.length === 0, reasons };
}

function scoreAcquiredCard(card, similarity = 0, similarityPenaltyThreshold = 0.58) {
  let score = 0;
  const details = {
    personality: Math.min(30, Math.round((card.personality.length || 0) / 140)),
    scenario: Math.min(20, Math.round((card.scenario.length || 0) / 90)),
    example: Math.min(25, Math.round((card.mes_example.length || 0) / 180)),
    firstMessage: Math.min(10, Math.round((card.first_mes.length || 0) / 120)),
    completeness: [card.name, card.personality, card.scenario, card.first_mes].every(Boolean) ? 10 : 0,
    rating: Math.min(5, Math.max(0, (card.rating || 0) * 1)),
    popularity: Math.min(5, Math.round(Math.log10((card.ratingCount || 0) + 1) * 4)),
    diversityPenalty: similarity >= similarityPenaltyThreshold ? Math.round(similarity * 25) : 0,
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

function canonicalCharacterName(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(genshin impact|honkai star rail|zenless zone zero|jujutsu kaisen|demon slayer|chainsaw man|spy x family|solo leveling|pokemon|undertale|final fantasy|fate grand order|blue archive|arknights|persona|nier automata)\b/g, ' ')
    .replace(/\b(your|the|a|an|rp|rpg|v\d+|sfw|bot|chatbot|character|companion)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function likelyDuplicateCharacterName(name = '', existingCanonicalNames = new Set()) {
  const canonical = canonicalCharacterName(name);
  if (!canonical) return false;
  if (existingCanonicalNames.has(canonical)) return true;
  for (const existing of existingCanonicalNames) {
    if (canonical.length >= 5 && existing.length >= 5 && (canonical.includes(existing) || existing.includes(canonical))) return true;
  }
  return false;
}

async function fetchImageAsDataUrl(url) {
  if (!url) return '';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AIChatAcquirer/1.0' } });
  if (!res.ok) return '';
  const type = res.headers.get('content-type') || 'image/webp';
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buffer.toString('base64')}`;
}

async function saveImportedCharacterRecord(body, importedBy = 'system') {
  const payload = {
    name: String(body.name || '').trim(),
    description: String(body.description || body.personality || '').trim(),
    personality: String(body.personality || '').trim(),
    scenario: String(body.scenario || '').trim(),
    first_mes: String(body.first_mes || body.first_message || '').trim(),
    mes_example: String(body.mes_example || body.example_dialogue || '').trim(),
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
  };
  if (!payload.name || !payload.personality || !payload.scenario) {
    throw new Error('name, personality, and scenario are required');
  }
  const slug = slugify(payload.name);
  const id = `local-${slug}`;
  const avatar = await saveDataUrlAsset(String(body.avatarDataUrl || ''), `${id}-${Date.now().toString(36)}`);
  const record = {
    id,
    source: 'local',
    importSource: String(body.importSource || body.sourceType || 'manual').trim(),
    sourceUrl: String(body.source || body.sourceUrl || '').trim(),
    avatarSourcePath: String(body.avatar || body.avatarPath || '').trim(),
    importedBy,
    avatar,
    score: Number.isFinite(Number(body.score)) ? Number(body.score) : null,
    importedAt: String(body.imported_at || body.importedAt || new Date().toISOString()),
    shortDescription: String(body.shortDescription || '').trim(),
    ...payload,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await ensureCharacterDirs();
  await fsp.writeFile(path.join(LOCAL_CHARACTERS_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  return record;
}

let acquisitionRun = null;
let acquisitionChild = null;

function summarizeAcquisitionRun(run = acquisitionRun) {
  if (!run) return { running: false, accepted: [], rejected: [], duplicateCount: 0, progress: { processed: 0, accepted: 0, rejected: 0, duplicates: 0, target: 0 } };
  const accepted = Array.isArray(run.accepted) ? run.accepted : [];
  const rejected = Array.isArray(run.rejected) ? run.rejected : [];
  const duplicateCount = Number(run.duplicateCount || 0);
  return {
    ...run,
    accepted,
    rejected,
    duplicateCount,
    progress: {
      processed: accepted.length + rejected.length,
      accepted: accepted.length,
      rejected: rejected.length,
      duplicates: duplicateCount,
      target: Number(run.target || 0),
    },
  };
}

function updateAcquisitionFromLine(line = '') {
  const trimmed = String(line || '').trim();
  if (!trimmed || !acquisitionRun) return;
  acquisitionRun.output = [...(acquisitionRun.output || []), trimmed].slice(-200);
  const imported = trimmed.match(/^IMPORTED :: ([^:]+) :: (.+?) :: score=(\d+)/);
  if (imported) {
    acquisitionRun.accepted = [...(acquisitionRun.accepted || []), { query: imported[1], name: imported[2], score: Number(imported[3]) }];
    return;
  }
  const skipped = trimmed.match(/^SKIPPED :: ([^:]+) :: (.+?) :: score=([^:]+) :: (.+)$/);
  if (skipped) {
    acquisitionRun.rejected = [...(acquisitionRun.rejected || []), { query: skipped[1], name: skipped[2], score: skipped[3], line: trimmed, reason: skipped[4] }].slice(-200);
    if (/duplicate/i.test(skipped[4])) acquisitionRun.duplicateCount = Number(acquisitionRun.duplicateCount || 0) + 1;
  }
}

function startAcquisitionScript({ requestedBy = 'system', batchSize = 6, scoreThreshold = 60, password = '', noQuality = false } = {}) {
  if (acquisitionRun?.running) throw new Error('Acquisition already running');
  const scriptPath = path.join(process.cwd(), 'automation/chub/acquire-chub.mjs');
  acquisitionRun = {
    running: true,
    startedAt: new Date().toISOString(),
    requestedBy,
    target: batchSize,
    accepted: [],
    rejected: [],
    duplicateCount: 0,
    output: [],
    averageScore: 0,
    error: '',
  };
  const before = listCharacters();
  const beforeIds = new Set(before.map((item) => item.id));
  const child = spawn('node', ['automation/chub/acquire-chub.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AICHAT_BASE_URL: `${PUBLIC_APP_ORIGIN}${BASE_PATH}`,
      AICHAT_USERNAME: requestedBy,
      AICHAT_PASSWORD: password,
      CHUB_MAX_IMPORTS: String(batchSize),
      CHUB_SCORE_THRESHOLD: String(scoreThreshold),
      CHUB_NO_QUALITY: noQuality ? 'true' : '',
      CHUB_MAX_RESULTS_PER_QUERY: '20',
      CHUB_QUERIES: 'genshin impact,honkai star rail,zenless zone zero,blue archive,arknights,fire emblem,fate grand order,final fantasy,nier automata,persona,pokemon,undertale,arcane,hololive,vtuber,jujutsu kaisen,demon slayer,chainsaw man,spy x family,solo leveling,game character,anime companion,fantasy companion,story rich character,high quality sfw character',
      CHROMIUM_PATH: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  acquisitionChild = child;
  let buffer = '';
  const onChunk = (chunk) => {
    buffer += String(chunk || '');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) updateAcquisitionFromLine(line);
  };
  child.stdout.on('data', onChunk);
  child.stderr.on('data', onChunk);
  child.on('error', (error) => {
    acquisitionRun = summarizeAcquisitionRun({ ...acquisitionRun, running: false, finishedAt: new Date().toISOString(), error: String(error?.message || error) });
    acquisitionChild = null;
  });
  child.on('close', () => {
    if (buffer.trim()) updateAcquisitionFromLine(buffer.trim());
    const after = listCharacters();
    const added = after.filter((item) => !beforeIds.has(item.id)).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    acquisitionRun = summarizeAcquisitionRun({
      ...acquisitionRun,
      running: false,
      finishedAt: new Date().toISOString(),
      accepted: added.map((character) => ({ name: character.name, score: character.score, sourceUrl: character.sourceUrl, tags: character.tags, character })),
      averageScore: added.length ? Math.round(added.reduce((sum, item) => sum + Number(item.score || 0), 0) / added.length) : 0,
      topImported: added.slice(0, 5).map((item) => ({ name: item.name, score: item.score })),
    });
    acquisitionChild = null;
  });
  return summarizeAcquisitionRun(acquisitionRun);
}

async function acquireChubBatch({ requestedBy = 'system', batchSize = 6, scoreThreshold = 60, useExistingRun = false, noQuality = false } = {}) {
  if (acquisitionRun?.running && !useExistingRun) throw new Error('Acquisition already running');
  if (!useExistingRun) acquisitionRun = { running: true, startedAt: new Date().toISOString(), requestedBy, target: batchSize, accepted: [], rejected: [], duplicateCount: 0, output: [] };

  const queries = ['genshin impact', 'honkai star rail', 'zenless zone zero', 'blue archive', 'arknights', 'fire emblem', 'fate grand order', 'final fantasy', 'nier automata', 'persona', 'pokemon', 'undertale', 'arcane', 'hololive', 'vtuber', 'jujutsu kaisen', 'demon slayer', 'chainsaw man', 'spy x family', 'solo leveling', 'game character', 'anime companion', 'fantasy companion', 'story rich character', 'high quality sfw character'];
  const maxResultsPerQuery = 18;
  const similarityRejectThreshold = 0.78;
  const seenSources = new Set();
  const existingCharacters = listCharacters();
  const existingNames = new Set(existingCharacters.map((item) => String(item.name || '').trim().toLowerCase()).filter(Boolean));
  const existingCanonicalNames = new Set(existingCharacters.map((item) => canonicalCharacterName(item.name || '')).filter(Boolean));
  const existingSourceKeys = new Set(existingCharacters.map((item) => String(item.sourceUrl || '').replace(/[#?].*$/, '').toLowerCase()).filter(Boolean));
  const existingFingerprints = existingCharacters.map((item) => buildFingerprint(item));
  const tagCounts = new Map();
  for (const character of existingCharacters) {
    for (const tag of Array.isArray(character.tags) ? character.tags : []) {
      const key = String(tag || '').trim().toLowerCase();
      if (!key) continue;
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    }
  }

  const searchResults = [];
  for (const query of queries) {
    if (acquisitionRun.accepted.length >= batchSize) break;
    const params = new URLSearchParams({
      excludetopics: '', first: String(maxResultsPerQuery), page: '1', namespace: '*', search: query,
      include_forks: 'true', nsfw: 'false', nsfw_only: 'false', require_custom_prompt: 'false', require_example_dialogues: 'false',
      require_images: 'false', require_expressions: 'false', nsfl: 'false', asc: 'false', min_ai_rating: '0', min_tokens: '50',
      max_tokens: '100000', chub: 'true', require_lore: 'false', exclude_mine: 'true', require_lore_embedded: 'false',
      require_lore_linked: 'false', sort: 'default', min_tags: '2', topics: '', inclusive_or: 'false', recommended_verified: 'false',
      require_alternate_greetings: 'false', count: 'false',
    });
    const response = await fetch(`https://gateway.chub.ai/search?${params.toString()}`, { headers: { 'User-Agent': 'Mozilla/5.0 AIChatAcquirer/1.0' } });
    if (!response.ok) continue;
    const json = await response.json().catch(() => ({}));
    const nodes = Array.isArray(json?.nodes) ? json.nodes : Array.isArray(json?.data?.nodes) ? json.data.nodes : [];
    for (const node of nodes) {
      const href = node?.fullPath ? `https://chub.ai/characters/${node.fullPath}` : '';
      const hrefKey = href.replace(/[#?].*$/, '').toLowerCase();
      const nodeName = String(node?.name || node?.definition?.name || '').trim();
      if (!href || seenSources.has(href) || existingSourceKeys.has(hrefKey)) continue;
      if (nodeName && likelyDuplicateCharacterName(nodeName, existingCanonicalNames)) continue;
      seenSources.add(href);
      searchResults.push({ query, href, fullPath: node.fullPath, nodeName });
    }
  }

  for (const result of searchResults) {
    if (acquisitionRun.accepted.length >= batchSize) break;
    const entry = { startedAt: new Date().toISOString(), query: result.query, source: result.href, success: false };
    try {
      const response = await fetch(`https://gateway.chub.ai/api/characters/${result.fullPath}?full=true&nocache=${Math.random()}`, { headers: { 'User-Agent': 'Mozilla/5.0 AIChatAcquirer/1.0' } });
      if (!response.ok) throw new Error(`Chub gateway failed (${response.status})`);
      const payload = await response.json();
      const card = normalizeChubCharacter(payload, result.href);
      const validation = validateAcquiredCard(card);
      const fingerprint = buildFingerprint(card);
      const similarity = getMaxSimilarity(fingerprint, existingFingerprints);
      const { score } = scoreAcquiredCard(card, similarity);
      const totalAfter = existingCharacters.length + acquisitionRun.accepted.length + 1;
      const maxTagCount = Math.max(1, Math.floor(totalAfter * 0.15));
      const lowerTags = (card.tags || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean);
      const crowdedTag = lowerTags.find((tag) => (tagCounts.get(tag) || 0) >= maxTagCount && !['chub', 'browser-import', 'female', 'male', 'anime', 'fantasy', 'game characters', 'games', 'sfw'].includes(tag));

      entry.name = card.name || result.href;
      entry.score = score;
      entry.similarity = similarity;

      const joined = [card.name, card.description, card.personality, card.scenario, card.first_mes, card.mes_example, ...(card.tags || [])].join(' ').toLowerCase();
      const badSourcePattern = /\b(narrator|storyteller|game master|world narrator|character card|card creator|assistant|simulator|sandbox|modern life rpg|the real isekai rpg experience)\b/i.test(card.name || '');
      const unsafePattern = /\b(nsfw|lewd|fetish|stepmom|stepsister|abusive|bully|dominant|submissive)\b/i.test(joined);
      if (!noQuality && !validation.ok) throw new Error(`Validation failed: ${validation.reasons.join(', ')}`);
      if (!noQuality && badSourcePattern) throw new Error('Generic/bad source pattern');
      if (unsafePattern) throw new Error('Unsafe source pattern');
      if (similarity >= similarityRejectThreshold) throw new Error(`Near-duplicate content similarity too high (${similarity.toFixed(2)})`);
      if (existingNames.has(card.name.toLowerCase())) throw new Error('Duplicate name already present in system');
      if (likelyDuplicateCharacterName(card.name, existingCanonicalNames)) throw new Error('Likely duplicate character already present');
      if (existingSourceKeys.has(card.sourceUrl.replace(/[#?].*$/, '').toLowerCase())) throw new Error('Duplicate source already present');
      if (!noQuality && score < scoreThreshold) throw new Error(`Score below threshold (${score} < ${scoreThreshold})`);
      if (!noQuality && crowdedTag) throw new Error(`Diversity cap hit for tag: ${crowdedTag}`);

      const avatarDataUrl = await fetchImageAsDataUrl(card.avatarUrl);
      if (!avatarDataUrl) throw new Error('Usable avatar required');
      const record = await saveImportedCharacterRecord({
        ...card,
        score,
        importSource: 'chub',
        importedAt: new Date().toISOString(),
        sourceUrl: card.sourceUrl,
        avatarPath: card.avatarUrl,
        avatar: card.avatarUrl,
        avatarDataUrl,
        shortDescription: summarizeText(card.scenario, card.description, card.personality),
      }, requestedBy);

      await appendImportLog({ name: card.name, source: card.sourceUrl, fileType: 'acquire-chub', success: true, score, importSource: 'chub' });
      existingNames.add(card.name.toLowerCase());
      existingCanonicalNames.add(canonicalCharacterName(card.name));
      existingSourceKeys.add(card.sourceUrl.replace(/[#?].*$/, '').toLowerCase());
      existingFingerprints.push(fingerprint);
      for (const tag of lowerTags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      acquisitionRun.accepted.push({ name: card.name, score, sourceUrl: card.sourceUrl, tags: card.tags, character: serializeLocalCharacter(record) });
      entry.success = true;
    } catch (error) {
      const message = String(error?.message || error);
      if (/duplicate/i.test(message)) acquisitionRun.duplicateCount += 1;
      acquisitionRun.rejected.push({ ...entry, error: message });
      await appendImportLog({ name: entry.name || 'unknown', source: entry.source, fileType: 'acquire-chub', success: false, score: entry.score ?? null, importSource: 'chub', error: message });
    }
  }

  const acceptedScores = acquisitionRun.accepted.map((item) => Number(item.score || 0)).filter((value) => Number.isFinite(value));
  acquisitionRun.averageScore = acceptedScores.length ? Math.round(acceptedScores.reduce((sum, value) => sum + value, 0) / acceptedScores.length) : 0;
  acquisitionRun.topImported = [...acquisitionRun.accepted].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((item) => ({ name: item.name, score: item.score }));
  acquisitionRun.finishedAt = new Date().toISOString();
  acquisitionRun.running = false;
  return acquisitionRun;
}

function getConversationBucketKey(characterId, personaId) {
  return `${characterId || 'none'}::${personaId || 'none'}`;
}

function normalizeAssistantConfig(input = {}) {
  const runtime = String(input?.runtime || 'subagent').trim();
  const permissionTier = String(input?.permissionTier || 'chat').trim();
  const thinking = String(input?.thinking || 'low').trim();
  return {
    enabled: input?.enabled !== false,
    openclawAgentId: String(input?.openclawAgentId || '').trim(),
    runtime: ['subagent', 'acp'].includes(runtime) ? runtime : 'subagent',
    permissionTier: ['chat', 'safe', 'full'].includes(permissionTier) ? permissionTier : 'chat',
    badgeLabel: String(input?.badgeLabel || 'OpenClaw').trim() || 'OpenClaw',
    personalityPrompt: String(input?.personalityPrompt || '').trim(),
    styleNotes: String(input?.styleNotes || '').trim(),
    modelOverride: String(input?.modelOverride || '').trim(),
    thinking: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(thinking) ? thinking : 'low',
  };
}

function getCharacterType(character = null) {
  return String(character?.type || 'character') === 'assistant' ? 'assistant' : 'character';
}

function isAssistantCharacter(character = null) {
  return getCharacterType(character) === 'assistant';
}

function buildAssistantConversationMeta(character = null) {
  const config = normalizeAssistantConfig(character?.assistantConfig || {});
  return {
    type: 'assistant',
    badgeLabel: config.badgeLabel,
    runtime: config.runtime,
    permissionTier: config.permissionTier,
    bridgeStatus: 'idle',
    bridgeSessionKey: '',
    lastError: '',
    lastUsedAt: Date.now(),
  };
}

function getConversationBridgeMeta(conversation = null) {
  const bridge = conversation?.bridge && typeof conversation.bridge === 'object' ? conversation.bridge : {};
  return {
    kind: bridge.kind === 'openclaw' ? 'openclaw' : '',
    status: String(bridge.status || 'idle') || 'idle',
    sessionKey: String(bridge.sessionKey || '').trim(),
    lastError: String(bridge.lastError || '').trim(),
    createdAt: Number(bridge.createdAt || 0) || null,
    updatedAt: Number(bridge.updatedAt || 0) || null,
  };
}

function applyCharacterTypeToConversation(conversation, character = null) {
  if (!conversation || typeof conversation !== 'object') return conversation;
  if (isAssistantCharacter(character)) {
    conversation.characterType = 'assistant';
    conversation.assistantMeta = {
      ...(conversation.assistantMeta && typeof conversation.assistantMeta === 'object' ? conversation.assistantMeta : {}),
      ...buildAssistantConversationMeta(character),
      ...(conversation.assistantMeta && typeof conversation.assistantMeta === 'object' ? conversation.assistantMeta : {}),
    };
    if (!conversation.bridge || typeof conversation.bridge !== 'object') {
      conversation.bridge = {
        kind: 'openclaw',
        status: 'idle',
        sessionKey: '',
        lastError: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  } else {
    conversation.characterType = 'character';
    delete conversation.assistantMeta;
    delete conversation.bridge;
  }
  return conversation;
}

function makeAssistantSessionKey({ authUser = null, character = null, conversation = null }) {
  const userPart = normalizeUsername(authUser?.username || 'user') || 'user';
  const charPart = slugify(character?.name || character?.id || 'assistant') || 'assistant';
  const convoPart = slugify(conversation?.id || 'chat') || 'chat';
  return `aichat-${userPart}-${charPart}-${convoPart}`.slice(0, 120);
}

function buildAssistantBridgePrompt({ character = null, persona = null, authUser = null, userMessage = '' } = {}) {
  const config = normalizeAssistantConfig(character?.assistantConfig || {});
  const personaName = getEffectiveUserName(persona, authUser);
  const pieces = [
    `You are ${character?.name || 'an assistant'} inside the AICHAT app.`,
    character?.description ? `Identity: ${compactPromptText('assistant description', character.description, 1000)}` : '',
    character?.personality ? `Character personality: ${compactPromptText('assistant personality', character.personality, 1800)}` : '',
    character?.scenario ? `Scenario: ${compactPromptText('assistant scenario', character.scenario, 900)}` : '',
    config.personalityPrompt ? `Bridge persona instructions: ${compactPromptText('assistant bridge prompt', config.personalityPrompt, 2000)}` : '',
    config.styleNotes ? `Style notes: ${compactPromptText('assistant style notes', config.styleNotes, 1000)}` : '',
    `The user is ${personaName}. Stay in character while being genuinely helpful.`,
    'Do not mention internal session IDs, bridge plumbing, CLI commands, or hidden system details unless directly asked.',
    'Reply naturally as the assistant persona, not as a system log.',
    '',
    `User message: ${String(userMessage || '').trim()}`,
  ].filter(Boolean);
  return pieces.join('\n');
}

async function runOpenClawAssistantTurn({ sessionKey, character, persona, authUser, userMessage, thinking = 'low' } = {}) {
  if (!OPENCLAW_BRIDGE_SECRET) {
    const configError = new Error('OpenClaw bridge secret is not configured');
    configError.detail = 'Set OPENCLAW_BRIDGE_SECRET for the AICHAT server.';
    throw configError;
  }
  const response = await fetch(`${OPENCLAW_BRIDGE_URL}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aichat-bridge-secret': OPENCLAW_BRIDGE_SECRET,
    },
    body: JSON.stringify({
      sessionKey,
      userMessage,
      thinking,
      username: authUser?.username || '',
      character: {
        name: character?.name || '',
        description: character?.description || '',
        personality: character?.personality || '',
        scenario: character?.scenario || '',
      },
      persona: {
        name: getEffectiveUserName(persona, authUser),
      },
      assistantConfig: normalizeAssistantConfig(character?.assistantConfig || {}),
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const bridgeError = new Error(String(json?.error || 'OpenClaw bridge execution failed'));
    bridgeError.detail = String(json?.detail || json?.error || 'OpenClaw bridge execution failed');
    throw bridgeError;
  }
  const text = String(json?.text || '').trim();
  if (!text) {
    const emptyError = new Error('OpenClaw assistant returned an empty response');
    emptyError.detail = String(json?.detail || 'Bridge returned no text');
    throw emptyError;
  }
  return {
    text,
    raw: json?.meta || null,
    stderr: String(json?.meta?.stderr || ''),
  };
}

function getUserStore(store, username) {
  const key = normalizeUsername(username);
  store.users[key] = mergeUserData(store.users[key] || {});
  return store.users[key];
}

function getCharacterSettings(userStore, characterId) {
  const stored = ((userStore.characterSettings || {})[characterId] || {});
  return {
    notes: '',
    modelOverride: '',
    temperature: 0.85,
    maxTokens: Number.isFinite(Number(stored.maxTokens)) ? Math.max(64, Math.min(8192, Math.round(Number(stored.maxTokens)))) : 1024,
    background: '',
    backgroundSearch: '',
    autoplayVoice: stored.autoplayVoice === true || stored.ttsEnabled === true,
    ttsEnabled: true,
    ttsProvider: String(stored.ttsProvider || 'fish') || 'fish',
    fishReferenceId: String(stored.fishReferenceId || DEFAULT_FISH_REFERENCE_ID || '').trim(),
    voiceLabel: String(stored.voiceLabel || DEFAULT_FISH_VOICE_LABEL || '').trim(),
    voiceMatchSource: String(stored.voiceMatchSource || '').trim(),
    voiceMatchQuery: String(stored.voiceMatchQuery || '').trim(),
    voiceMatchReason: String(stored.voiceMatchReason || '').trim(),
    ttsFormat: ['wav', 'pcm', 'mp3', 'opus'].includes(String(stored.ttsFormat || '').trim()) ? String(stored.ttsFormat || '').trim() : 'mp3',
    ttsLatency: ['low', 'normal', 'balanced'].includes(String(stored.ttsLatency || '').trim()) ? String(stored.ttsLatency || '').trim() : 'low',
    ttsPlaybackMode: ['stream', 'full'].includes(String(stored.ttsPlaybackMode || '').trim()) ? String(stored.ttsPlaybackMode || '').trim() : 'stream',
    ttsReadNarration: stored.ttsReadNarration === true,
    ...stored,
    fishReferenceId: String(stored.fishReferenceId || DEFAULT_FISH_REFERENCE_ID || '').trim(),
    voiceLabel: String(stored.voiceLabel || DEFAULT_FISH_VOICE_LABEL || '').trim(),
    voiceMatchSource: String(stored.voiceMatchSource || '').trim(),
    voiceMatchQuery: String(stored.voiceMatchQuery || '').trim(),
    voiceMatchReason: String(stored.voiceMatchReason || '').trim(),
    ttsProvider: String(stored.ttsProvider || 'fish') || 'fish',
    ttsFormat: ['wav', 'pcm', 'mp3', 'opus'].includes(String(stored.ttsFormat || '').trim()) ? String(stored.ttsFormat || '').trim() : 'mp3',
    ttsLatency: ['low', 'normal', 'balanced'].includes(String(stored.ttsLatency || '').trim()) ? String(stored.ttsLatency || '').trim() : 'low',
    ttsPlaybackMode: ['stream', 'full'].includes(String(stored.ttsPlaybackMode || '').trim()) ? String(stored.ttsPlaybackMode || '').trim() : 'stream',
    ttsReadNarration: stored.ttsReadNarration === true,
  };
}

function getConversationList(userStore, characterId, personaId) {
  const bucket = userStore.conversations?.[getConversationBucketKey(characterId, personaId)] || [];
  return bucket.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function isFishConfigured() {
  return Boolean(FISH_AUDIO_API_KEY);
}

function normalizeVoiceSearchText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeVoiceSearchText(value = '') {
  return normalizeVoiceSearchText(value).split(/\s+/).filter(Boolean);
}

function dedupeModelsById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isLegacyDefaultVoice(settings = {}) {
  const label = String(settings.voiceLabel || '').trim().toLowerCase();
  const ref = String(settings.fishReferenceId || '').trim();
  const legacyLabels = new Set([
    String(DEFAULT_FISH_VOICE_LABEL || '').trim().toLowerCase(),
    'default fish voice',
    'e-girl',
    'main voice',
  ].filter(Boolean));

  if (!ref) return true;
  if (legacyLabels.has(label)) return true;
  if (DEFAULT_FISH_REFERENCE_ID && ref === DEFAULT_FISH_REFERENCE_ID) return true;
  if (!String(settings.voiceMatchSource || '').trim()) return true;
  return false;
}

function inferCharacterVoiceHints(character = null) {
  const rawText = [
    character?.name,
    character?.description,
    character?.personality,
    character?.scenario,
    ...(Array.isArray(character?.tags) ? character.tags : []),
  ].filter(Boolean).join(' ');

  const text = normalizeVoiceSearchText(rawText);
  const tagHints = new Set(tokenizeVoiceSearchText(Array.isArray(character?.tags) ? character.tags.join(' ') : ''));
  const genders = new Set();
  const languages = new Set();

  if (/\b(she|her|hers|woman|female|girl|princess|lady|mother|sister|wife)\b/.test(text)) genders.add('female');
  if (/\b(he|him|his|man|male|boy|prince|gentleman|father|brother|husband)\b/.test(text)) genders.add('male');

  const languageMatchers = [
    ['english', /\b(english|british|american|australian|canadian)\b/],
    ['japanese', /\b(japanese|japan)\b/],
    ['korean', /\b(korean|korea)\b/],
    ['chinese', /\b(chinese|mandarin|cantonese|china)\b/],
    ['spanish', /\b(spanish|espanol|latina|latino|mexican)\b/],
    ['french', /\b(french|france)\b/],
    ['german', /\b(german|germany)\b/],
    ['russian', /\b(russian|russia)\b/],
    ['portuguese', /\b(portuguese|brazilian|brazil)\b/],
  ];

  for (const [language, regex] of languageMatchers) {
    if (regex.test(text)) languages.add(language);
  }

  if (/\b(anime|vtuber|idol|princedom|fantasy|elf|princess|prince)\b/.test(text)) tagHints.add('anime');
  if (/\b(child|young|little girl|little boy|teen)\b/.test(text)) tagHints.add('young');

  return {
    genders: [...genders],
    languages: [...languages],
    tags: [...tagHints],
  };
}

function buildFishMatchDetails(query, model, hints = null) {
  const normalizedQuery = normalizeVoiceSearchText(query);
  const normalizedTitle = normalizeVoiceSearchText(model?.title || '');
  const queryTokens = tokenizeVoiceSearchText(normalizedQuery);
  const titleTokens = tokenizeVoiceSearchText(normalizedTitle);
  const modelTags = tokenizeVoiceSearchText(Array.isArray(model?.tags) ? model.tags.join(' ') : '');
  const modelLanguages = tokenizeVoiceSearchText(Array.isArray(model?.languages) ? model.languages.join(' ') : '');
  let score = 0;
  const reasons = [];

  if (normalizedTitle === normalizedQuery) {
    score += 1000;
    reasons.push('exact name match');
  }
  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 220;
    reasons.push('starts with character name');
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 170;
    reasons.push('contains character name');
  }
  if (normalizedQuery.startsWith(normalizedTitle)) score += 120;

  const sharedTokens = queryTokens.filter((token) => titleTokens.includes(token));
  score += sharedTokens.length * 45;
  if (sharedTokens.length) reasons.push(`shared tokens: ${sharedTokens.slice(0, 3).join(', ')}`);

  if (queryTokens[0] && titleTokens[0] === queryTokens[0]) score += 35;
  score -= Math.max(0, titleTokens.length - queryTokens.length) * 4;
  score += Math.min(Number(model?.task_count || 0), 1000) / 50;
  score += Math.min(Number(model?.like_count || 0), 500) / 80;
  if (model?.state === 'trained') score += 12;
  if (model?.visibility === 'public') score += 8;

  if (hints) {
    const hintLanguages = tokenizeVoiceSearchText(Array.isArray(hints.languages) ? hints.languages.join(' ') : '');
    const hintTags = tokenizeVoiceSearchText(Array.isArray(hints.tags) ? hints.tags.join(' ') : '');
    const hintGenders = tokenizeVoiceSearchText(Array.isArray(hints.genders) ? hints.genders.join(' ') : '');

    const languageHits = hintLanguages.filter((token) => modelLanguages.includes(token));
    const tagHits = hintTags.filter((token) => modelTags.includes(token));
    const genderHits = hintGenders.filter((token) => modelTags.includes(token) || titleTokens.includes(token));

    score += languageHits.length * 38;
    score += tagHits.length * 18;
    score += genderHits.length * 32;

    if (languageHits.length) reasons.push(`language fit: ${languageHits.join(', ')}`);
    if (genderHits.length) reasons.push(`gender vibe: ${genderHits.join(', ')}`);
    if (tagHits.length) reasons.push(`tag fit: ${tagHits.slice(0, 3).join(', ')}`);

    if (hintLanguages.length && !languageHits.length && modelLanguages.length) score -= 18;
    if (hintGenders.length && !genderHits.length) score -= 10;
  }

  return { score, reasons };
}

function scoreFishModelMatch(query, model, hints = null) {
  const normalizedQuery = normalizeVoiceSearchText(query);
  const normalizedTitle = normalizeVoiceSearchText(model?.title || '');
  if (!normalizedQuery || !normalizedTitle) return -Infinity;
  return buildFishMatchDetails(query, model, hints).score;
}

async function fetchFishModels(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params || {})) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) searchParams.append(key, String(value));
      continue;
    }
    searchParams.set(key, String(rawValue));
  }

  const cacheKey = searchParams.toString();
  const cached = fishModelCache.get(cacheKey);
  if (cached && (Date.now() - cached.at) < FISH_MODEL_CACHE_TTL_MS) return cached.value;

  const response = await fetch(`${FISH_AUDIO_BASE_URL}/model?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || `Fish model lookup failed (${response.status})`);
    error.statusCode = response.status === 401 || response.status === 402 ? 502 : 503;
    throw error;
  }

  const json = await response.json().catch(() => ({}));
  const value = {
    total: Number(json?.total || 0),
    items: Array.isArray(json?.items) ? json.items : [],
    has_more: Boolean(json?.has_more),
  };
  fishModelCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function searchFishModelsByName(query, options = {}) {
  if (!isFishConfigured()) return { query, items: [], bestMatch: null };

  const normalizedQuery = normalizeVoiceSearchText(query);
  if (!normalizedQuery) return { query, items: [], bestMatch: null };

  const hints = options.character ? inferCharacterVoiceHints(options.character) : inferCharacterVoiceHints(options.hints || null);
  const tokens = tokenizeVoiceSearchText(normalizedQuery);
  const lookups = [
    { title: normalizedQuery, page_size: options.pageSize || 12, sort_by: 'score' },
  ];

  if (tokens.length > 1) lookups.push({ title: tokens[0], page_size: options.pageSize || 12, sort_by: 'score' });
  if (tokens.length > 1) lookups.push({ title: tokens.slice(0, 2).join(' '), page_size: options.pageSize || 12, sort_by: 'score' });

  const batches = [];
  for (const lookup of lookups) {
    try {
      const batch = await fetchFishModels(lookup);
      batches.push(...batch.items);
    } catch (error) {
      if (!batches.length) throw error;
    }
  }

  let items = dedupeModelsById(batches)
    .filter((item) => item?.state === 'trained' && item?.dmca_taken_down !== true && item?.visibility !== 'private')
    .map((item) => {
      const details = buildFishMatchDetails(normalizedQuery, item, hints);
      return { ...item, _matchScore: details.score, matchReasons: details.reasons };
    })
    .filter((item) => Number.isFinite(item._matchScore) && item._matchScore > -100)
    .sort((a, b) => (b._matchScore - a._matchScore) || Number(b?.task_count || 0) - Number(a?.task_count || 0));

  if (!items.length) {
    const fallback = await fetchFishModels({ page_size: options.pageSize || 12, sort_by: 'score' }).catch(() => ({ items: [] }));
    items = dedupeModelsById(fallback.items)
      .filter((item) => item?.state === 'trained' && item?.dmca_taken_down !== true && item?.visibility !== 'private')
      .map((item) => {
        const details = buildFishMatchDetails(normalizedQuery, item, hints);
        return { ...item, _matchScore: details.score, matchReasons: details.reasons };
      })
      .sort((a, b) => (b._matchScore - a._matchScore) || Number(b?.task_count || 0) - Number(a?.task_count || 0));
  }

  const trimmed = items.slice(0, Math.max(1, Number(options.limit || 8)));
  return {
    query,
    hints,
    items: trimmed.map(({ _matchScore, ...item }) => item),
    bestMatch: trimmed[0] || null,
  };
}

async function ensureCharacterVoiceDefaults(store, userStore, characterId, options = {}) {
  const current = getCharacterSettings(userStore, characterId);
  if (!options.force && String(current.fishReferenceId || '').trim() && !isLegacyDefaultVoice(current)) return current;
  if (!isFishConfigured()) return current;

  const character = listCharacters().find((item) => item.id === characterId);
  const query = String(character?.name || current.voiceLabel || '').trim();
  if (!query) return current;

  const result = await searchFishModelsByName(query, { limit: 1, pageSize: 10, character }).catch(() => null);
  const bestMatch = result?.bestMatch;
  if (!bestMatch?._id) return current;

  const reason = Array.isArray(bestMatch.matchReasons) && bestMatch.matchReasons.length
    ? bestMatch.matchReasons[0]
    : (bestMatch.title && normalizeVoiceSearchText(bestMatch.title) === normalizeVoiceSearchText(query) ? 'exact name match' : 'closest available name match');

  const next = {
    ...current,
    ttsProvider: 'fish',
    fishReferenceId: String(bestMatch._id),
    voiceLabel: String(bestMatch.title || query),
    voiceMatchSource: options.source || (isLegacyDefaultVoice(current) ? 'migrated-name-match' : 'auto-name-match'),
    voiceMatchQuery: query,
    voiceMatchReason: reason,
  };
  userStore.characterSettings[characterId] = next;
  await saveStore(store);
  return next;
}

async function migrateExistingCharacterVoices(options = {}) {
  const store = await loadStore();
  const characters = listCharacters();
  let updated = 0;
  const results = [];

  for (const [username, userStore] of Object.entries(store.users || {})) {
    userStore.characterSettings = userStore.characterSettings || {};
    for (const character of characters) {
      const before = getCharacterSettings(userStore, character.id);
      if (!options.force && !isLegacyDefaultVoice(before)) continue;
      const after = await ensureCharacterVoiceDefaults(store, userStore, character.id, { force: true, source: 'migrated-name-match' });
      if (String(after.fishReferenceId || '') !== String(before.fishReferenceId || '') || String(after.voiceLabel || '') !== String(before.voiceLabel || '')) {
        updated += 1;
        results.push({ username, characterId: character.id, characterName: character.name, voiceLabel: after.voiceLabel, fishReferenceId: after.fishReferenceId, voiceMatchReason: after.voiceMatchReason });
      }
    }
  }

  if (updated) await saveStore(store);
  return { updated, results };
}

function normalizeMoanLikeToken(token = '') {
  const raw = String(token || '').trim();
  if (!raw) return raw;
  const plain = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!plain) return raw;

  if (/^a+h+n+$/.test(plain) || /^a+h+m+$/.test(plain)) {
    const aCount = (plain.match(/a/g) || []).length;
    const nCount = (plain.match(/n/g) || []).length;
    return aCount >= 3 || nCount >= 3 || plain.length >= 8 ? 'Aaaahn!' : 'Ahn';
  }
  if (/^a+h+$/.test(plain) || /^o+h+$/.test(plain)) return plain.length >= 7 ? 'Aaaah!' : 'Ahh';
  if (/^m+m+m+$/.test(plain)) return 'Mmm';
  if (/^m+m+h+$/.test(plain) || /^m+p+h+$/.test(plain) || /^u+m+m+h+$/.test(plain)) return 'Mm';
  if (/^n+g+h+$/.test(plain) || /^u+n+n+h+$/.test(plain)) return 'Ngh';

  const uniqueChars = new Set(plain.split(''));
  const mostlyMoanLetters = [...uniqueChars].every((ch) => 'ahmnuog'.includes(ch));
  if (!mostlyMoanLetters || plain.length < 4) return raw;

  if (plain.includes('h') && plain.includes('n') && (plain.includes('a') || plain.includes('o'))) return plain.length >= 8 ? 'Aaaahn!' : 'Ahn';
  if (plain.includes('h') && (plain.includes('a') || plain.includes('o'))) return plain.length >= 7 ? 'Aaaah!' : 'Ahh';
  if (plain.includes('m')) return plain.length >= 5 ? 'Mmm' : 'Mm';
  if (plain.includes('n') && plain.includes('g')) return 'Ngh';
  return raw;
}

function normalizeTtsMoans(value = '') {
  let text = String(value || '');

  text = text.replace(/(?<![\[(])\b[ahmnuog~!?,.-]{4,}\b(?![\])])/gi, (token) => {
    const plain = String(token || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!/[ahmnuog]{4,}/.test(plain)) return token;
    return normalizeMoanLikeToken(token);
  });
  text = text.replace(/\b(?:Ahh\s*){2,}/gi, 'Ahh ');
  text = text.replace(/\b(?:Ahn\s*){2,}/gi, 'Ahn ');
  text = text.replace(/\b(?:Mm\s*){2,}/gi, 'Mm ');
  text = text.replace(/\b(?:Mmm\s*){2,}/gi, 'Mmm ');
  text = text.replace(/\b(?:Ngh\s*){2,}/gi, 'Ngh ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function stripEmojiForTts(value = '') {
  return String(value || '')
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, ' ')
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, ' ')
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/[\uFE0F\u200D]/g, ' ');
}

function normalizeTtsText(value = '') {
  const text = stripEmojiForTts(normalizeTtsMoans(String(value || '')))
    .replace(/~/g, ' ')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    const error = new Error('Text is required');
    error.statusCode = 400;
    throw error;
  }
  if (text.length > 2500) {
    const error = new Error('Text is too long for TTS');
    error.statusCode = 422;
    throw error;
  }
  return text;
}

function hasInlineFishEmotionTags(value = '') {
  return /(^|\s)[\[(]([a-z][a-z\s-]{1,40})[\])](?=\s|$)/i.test(String(value || ''));
}

function stripInlineFishEmotionTags(value = '') {
  return String(value || '')
    .replace(/[\[(]([a-z][a-z\s-]{1,40})[\])]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeTtsEmotionModelOutput(value = '') {
  return String(value || '')
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^(?:tts|output|rewritten text|spoken text|tag|emotion)\s*:\s*/i, '')
    .replace(/^['"“”]+|['"“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TTS_DELIVERY_CUES = [
  { tag: 'whisper', category: 'volume', weight: 5, patterns: [/\bwhisper(?:ing|s|ed)?\b/i, /\bmurmur(?:ing|s|ed)?\b/i, /\bhushed(?:ly)?\b/i, /\bunder\s+(?:her|his|their)\s+breath\b/i] },
  { tag: 'quiet voice', category: 'volume', weight: 3, patterns: [/\bquiet(?:ly)?\b/i, /\blow voice\b/i, /\bsoft voice\b/i] },
  { tag: 'soft gentle tone', category: 'delivery', weight: 3, patterns: [/\bsoft(?:ly)?\b/i, /\bgentl(?:e|y)\b/i, /\btender(?:ly)?\b/i, /\bwarm(?:ly)?\b/i] },
  { tag: 'sigh', category: 'nonverbal', weight: 5, patterns: [/\bsigh(?:ing|s|ed)?\b/i, /\bexhale(?:s|d|ing)?\b/i] },
  { tag: 'soft laugh', category: 'nonverbal', weight: 6, patterns: [/\blaugh(?:ing|s|ed)?\s+softly\b/i, /\bsoft(?:ly)?\s+laugh(?:s|ed|ing)?\b/i] },
  { tag: 'chuckle', category: 'nonverbal', weight: 4, patterns: [/\bchuckl(?:e|es|ed|ing)\b/i, /\bgiggl(?:e|es|ed|ing)\b/i] },
  { tag: 'laughing', category: 'nonverbal', weight: 4, patterns: [/\blaugh(?:ing|s|ed)?\b/i] },
  { tag: 'laughing hard', category: 'nonverbal', weight: 6, patterns: [/\bhysterical(?:ly)?\b/i, /\blaugh(?:ing|s|ed)?\s+(?:hard|wildly|hysterically)\b/i] },
  { tag: 'soft gasp', category: 'nonverbal', weight: 6, patterns: [/\bsoft\s+gasp(?:ing|s|ed)?\b/i, /\bgasp(?:ing|s|ed)?\s+softly\b/i, /\bquiet\s+gasp(?:ing|s|ed)?\b/i, /\bsmall\s+gasp(?:ing|s|ed)?\b/i] },
  { tag: 'gasp', category: 'nonverbal', weight: 4, patterns: [/\bgasp(?:ing|s|ed)?\b/i, /\bbreath catches\b/i, /\bbreath hitches\b/i] },
  { tag: 'whimper', category: 'nonverbal', weight: 7, patterns: [/\bsoft\s+whimper(?:ing|s|ed)?\b/i, /\bquiet\s+whimper(?:ing|s|ed)?\b/i, /\bsmall\s+whimper(?:ing|s|ed)?\b/i, /\bwhimper(?:ing|s|ed)?\b/i] },
  { tag: 'loud moan', category: 'nonverbal', weight: 8, patterns: [/\bloud\s+moan(?:ing|s|ed)?\b/i, /\bintense\s+moan(?:ing|s|ed)?\b/i, /\bdesperate\s+moan(?:ing|s|ed)?\b/i, /\bdeep\s+moan(?:ing|s|ed)?\b/i, /\bmoan(?:ing|s|ed)?\s+(?:loudly|intensely|desperately|deeply)\b/i] },
  { tag: 'soft moan', category: 'nonverbal', weight: 6, patterns: [/\bsoft\s+moan(?:ing|s|ed)?\b/i, /\bquiet\s+moan(?:ing|s|ed)?\b/i, /\blow\s+moan(?:ing|s|ed)?\b/i, /\bmuffled\s+moan(?:ing|s|ed)?\b/i, /\bweak\s+moan(?:ing|s|ed)?\b/i, /\bsmall\s+moan(?:ing|s|ed)?\b/i, /\bmoan(?:ing|s|ed)?\s+softly\b/i, /\bmoan(?:ing|s|ed)?\s+quietly\b/i, /\bmoans?\s+grow\s+quieter\b/i, /\btoo\s+overwhelmed\s+to\s+make\s+much\s+sound\b/i, /\bmuffling\s+whatever\s+noises\b/i, /\bbarely\s+above\s+a\s+whisper\b/i] },
  { tag: 'breathless', category: 'delivery', weight: 4, patterns: [/\bbreathless(?:ly)?\b/i, /\bpant(?:ing|s|ed)?\b/i, /\bvoice\s+(?:drops|lowers)\b/i] },
  { tag: 'shaky voice', category: 'delivery', weight: 5, patterns: [/\bvoice trembl(?:es|ed|ing)\b/i, /\btrembl(?:ing|es|ed)?\b/i, /\bshak(?:y|ily)\b/i] },
  { tag: 'sad soft voice', category: 'emotion', weight: 4, patterns: [/\bsad(?:ly)?\b/i, /\bmournful(?:ly)?\b/i, /\bheartbroken\b/i, /\btearful\b/i, /\bteary\b/i] },
  { tag: 'crying', category: 'nonverbal', weight: 5, patterns: [/\bcry(?:ing|s|ied)?\b/i, /\bsob(?:bing|s|bed)?\b/i] },
  { tag: 'nervous hesitant voice', category: 'emotion', weight: 4, patterns: [/\bnervous(?:ly)?\b/i, /\bhesitant(?:ly)?\b/i, /\banxious(?:ly)?\b/i, /\bunsure\b/i] },
  { tag: 'shy soft voice', category: 'emotion', weight: 4, patterns: [/\bshy(?:ly)?\b/i, /\bbashful(?:ly)?\b/i, /\btimid(?:ly)?\b/i, /\bflustered\b/i] },
  { tag: 'sharp irritated tone', category: 'emotion', weight: 5, patterns: [/\bangr(?:y|ily)\b/i, /\birritated(?:ly)?\b/i, /\bannoyed\b/i, /\bsnap(?:s|ped|ping)?\b/i, /\bfurious(?:ly)?\b/i] },
  { tag: 'cold tone', category: 'emotion', weight: 4, patterns: [/\bcoldly\b/i, /\bicy\s+(?:tone|voice|stare|glare)\b/i, /\bchilly\s+(?:tone|voice|stare|glare)\b/i] },
  { tag: 'stern serious tone', category: 'delivery', weight: 4, patterns: [/\bstern(?:ly)?\b/i, /\bfirm(?:ly)?\b/i, /\bgrave(?:ly)?\b/i] },
  { tag: 'deadpan', category: 'delivery', weight: 4, patterns: [/\bdeadpan\b/i, /\bflat(?:ly)?\b/i, /\bblank(?:ly)?\b/i, /\bmonotone\b/i] },
  { tag: 'teasing amused tone', category: 'emotion', weight: 4, patterns: [/\bteasing(?:ly)?\b/i, /\bplayful(?:ly)?\b/i, /\bamused\b/i, /\bsmirk(?:ing|s|ed)?\b/i] },
  { tag: 'sarcastic', category: 'delivery', weight: 4, patterns: [/\bsarcastic(?:ally)?\b/i, /\bdryly\b/i] },
  { tag: 'excited bright voice', category: 'emotion', weight: 4, patterns: [/\bexcited(?:ly)?\b/i, /\beager(?:ly)?\b/i, /\bthrilled\b/i, /\benthusiastic(?:ally)?\b/i, /\bgrin(?:s|ned|ning)?\b/i] },
  { tag: 'surprised', category: 'emotion', weight: 4, patterns: [/\bsurprised\b/i, /\bstunned\b/i, /\bstartled\b/i, /\bshocked\b/i] },
  { tag: 'calm steady tone', category: 'delivery', weight: 3, patterns: [/\bcalm(?:ly)?\b/i, /\bsteady\b/i, /\beven-toned\b/i] },
  { tag: 'commanding voice', category: 'delivery', weight: 4, patterns: [/\bcommand(?:s|ed|ing)?\b/i, /\bauthoritative(?:ly)?\b/i] },
  { tag: 'loud', category: 'volume', weight: 4, patterns: [/\bshout(?:ing|s|ed)?\b/i, /\byell(?:ing|s|ed)?\b/i, /\bloud(?:ly)?\b/i] },
  { tag: 'screaming', category: 'volume', weight: 5, patterns: [/\bscream(?:ing|s|ed)?\b/i, /\bshriek(?:ing|s|ed)?\b/i] },
];

function countPatternMatches(text = '', pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  return [...String(text || '').matchAll(regex)].length;
}

function cleanTtsSpeechText(value = '') {
  return String(value || '')
    .replace(/#/g, ' ')
    .replace(/^[\s:;,.;!?—-]+/g, '')
    .replace(/[\s:;—-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuotedTtsSegments(rawText = '') {
  const raw = String(rawText || '');
  const segments = [];
  const quoteRe = /["“”]([^"“”]{1,700})["“”]/g;
  let match;
  while ((match = quoteRe.exec(raw))) {
    const speech = cleanTtsSpeechText(match[1]);
    if (!speech) continue;
    const contextStart = Math.max(0, match.index - 360);
    const context = raw.slice(contextStart, match.index);
    segments.push({ speech, context });
  }
  return segments;
}

function stripRpNarrationForTts(rawText = '', options = {}) {
  const raw = String(rawText || '');
  const includeAsteriskNarration = options.includeAsteriskNarration === true;
  const countWords = (value = '') => (String(value || '').trim().match(/[A-Za-z0-9][A-Za-z0-9'’_-]*/g) || []).length;
  const isLikelyActionSpan = (content = '') => {
    const value = String(content || '').trim();
    if (!value) return false;
    return /^(?:a\s+broken\s+)?(?:moan|gasp|sob|whimper)\b.*\b(?:spills|escapes|breaks|cracks)\b/i.test(value)
      || /^(?:her|his|their|your)\s+(?:head|hands?|fingers?|nails?|body|breath|voice|eyes?|thighs?|hips?|back|mouth|tongue|shoulders?|chest|breasts?)\b/i.test(value)
      || /^(?:she|he|they|you)\s+(?:reaches?|pulls?|pushes?|leans?|steps?|backs?|moves?|walks?|shifts?|tilts?|turns?|looks?|watches?|holds?|cups?|grabs?|drags?|slides?|hooks?|writhes?|trembles?|shudders?|gasps?|moans?|whimpers?|sobs?|cries?|bites?|soothes?|kisses?|arches?|rolls?|tightens?|clenches?)\b/i.test(value)
      || /^(?:reaches?|pulls?|pushes?|leans?|steps?|backs?|moves?|walks?|shifts?|tilts?|turns?|looks?|watches?|holds?|cups?|grabs?|drags?|slides?|hooks?|writhes?|trembles?|shudders?|gasps?|moans?|whimpers?|sobs?|cries?|bites?|soothes?|kisses?|arches?|rolls?|tightens?|clenches?|exposes?|waits?)\b/i.test(value)
      || /\b(?:against\s+the\s+pillow|nails?\s+bite|whole\s+body|hips?\s+experimentally|thighs?\s+tighten|eyes?\s+find|half-lidded|back\s+arching|voice\s+cracks|breath\s+stutters|hands?\s+shake)\b/i.test(value);
  };
  const isSpeakableAsteriskDialogue = (content = '') => {
    const value = String(content || '').trim();
    if (!value) return false;
    if (/^[A-Za-z0-9][A-Za-z0-9'’_-]*$/.test(value)) return true;
    if (isLikelyActionSpan(value)) return false;
    if (/[.!?…—-]$/.test(value) && /\b(i|i'm|i’ve|i'd|i’ll|me|my|mine|you|you're|you've|you'd|we|we're|he|she|they|it|your|yours|want|need|love|hate|feel|think|know|am|are|is|was|were|do|don't|can't|won't|please|yes|no)\b/i.test(value)) return true;
    return false;
  };
  const replaceEmphasisSpan = (_, inner = '') => {
    const content = String(inner || '').trim();
    if (!content) return ' ';
    if (includeAsteriskNarration) return content;
    if (isLikelyActionSpan(content)) return ' ';
    if (isSpeakableAsteriskDialogue(content)) return content;
    if (countWords(content) <= 4 && !/[,.].{0,}$/i.test(content)) return content;
    return ' ';
  };
  const stripInlineMarkup = (value = '') => String(value || '')
    .replace(/\*\*([^*]{1,500})\*\*/g, replaceEmphasisSpan)
    .replace(/\*([^*]{1,500})\*/g, replaceEmphasisSpan)
    .replace(/__([^_]{1,500})__/g, replaceEmphasisSpan)
    .replace(/_([^_]{1,500})_/g, replaceEmphasisSpan)
    .replace(/[\*_]+/g, ' ');
  const processParagraph = (paragraph = '') => {
    const value = String(paragraph || '').trim();
    if (!value) return '';
    if (!includeAsteriskNarration && /^\*[^]*\*$/.test(value)) {
      const inner = value.replace(/^\*+/, '').replace(/\*+$/, '').trim();
      return isSpeakableAsteriskDialogue(inner) ? stripInlineMarkup(inner) : '';
    }
    if (!includeAsteriskNarration && /^_[^]*_$/.test(value)) {
      const inner = value.replace(/^_+/, '').replace(/_+$/, '').trim();
      return isSpeakableAsteriskDialogue(inner) ? stripInlineMarkup(inner) : '';
    }
    return stripInlineMarkup(value);
  };

  return raw
    .split(/\n\s*\n+/)
    .map(processParagraph)
    .filter(Boolean)
    .join(' ')
    .replace(/["“”]/g, '')
    .replace(/([,;:!?])(\S)/g, '$1 $2')
    .replace(/([A-Za-z0-9])([—-])(?!\s)/g, '$1$2 ')
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
function inferTtsDeliveryTags(context = '', speech = '', options = {}) {
  const haystack = `${context || ''} ${speech || ''}`.replace(/\s+/g, ' ').trim();
  const maxPicked = Number.isFinite(options.maxTags) ? Math.max(1, Math.min(24, Math.floor(options.maxTags))) : 10;
  if (!haystack) return [];

  const scored = [];
  const ensureScoredTag = (tag, category = 'nonverbal', baseScore = 0) => {
    let item = scored.find((entry) => entry.tag === tag);
    if (!item) {
      item = { tag, category, score: baseScore };
      scored.push(item);
    } else if (baseScore > item.score) {
      item.score = baseScore;
    }
    return item;
  };
  for (const cue of TTS_DELIVERY_CUES) {
    let matches = 0;
    for (const pattern of cue.patterns) matches += countPatternMatches(haystack, pattern);
    if (!matches) continue;
    scored.push({ tag: cue.tag, category: cue.category, score: cue.weight + Math.min(matches, 3) });
  }

  if (/\bnot\s+to\s+cry\b/i.test(haystack)) {
    for (const item of scored) {
      if (item.tag === 'crying') item.score -= 4;
    }
  }
  if (/\b(moan\s+for\s+me|pleasure|thighs?|touch\s+me|desire|body|intimate|arousal|warm\s+inside)\b/i.test(haystack)) {
    for (const item of scored) {
      if (item.tag === 'soft strained sound') item.score -= 3;
      if (item.tag === 'breathless') item.score += 2;
      if (item.tag === 'soft gasp') item.score += 1;
    }
  }
  if (/\b(moan(?:ing|s|ed)?|moaning\s+helplessly|continues?\s+to\s+moan|final\s+scream|animalistic|guttural\s+grunts?|raw\s+and\s+aching|chokes?\s+on\s+her\s+own\s+sounds|shuddering\s+and\s+moaning)\b/i.test(haystack)) {
    ensureScoredTag('loud moan', 'nonverbal', 10);
    ensureScoredTag('soft moan', 'nonverbal', 6);
    for (const item of scored) {
      if (item.tag === 'crying') item.score -= 6;
      if (item.tag === 'sad soft voice') item.score -= 5;
      if (item.tag === 'loud moan') item.score += 8;
      if (item.tag === 'soft moan') item.score += 4;
      if (item.tag === 'screaming') item.score -= 5;
    }
  }
  if (/\b(moans?\s+grow\s+louder|more\s+intense|desperate\s+sounds|final\s+moan|each\s+moan|own\s+moans|high-pitched\s+wails?|hoarse\s+screams?|voice\s+cracks|new\s+peak\s+of\s+ecstasy|completely\s+losing\s+herself|cries\s+out|voice\s+rises\s+to\s+a\s+crescendo|letting\s+out\s+a\s+string\s+of\s+desperate\s+sounds|let(?:ting)?\s+loose\s+a\s+series\s+of\s+high-pitched\s+wails?|let(?:ting)?\s+out\s+(?:a\s+)?long[,\s-]*drawn[-\s]*out\s+moan|moans?\s+loudly|asked\s+for\s+loud|resonates?\s+through|reverberate(?:s|d)?\s+off\s+the\s+walls|echo(?:es|ing)?\s+off\s+the\s+buildings)\b/i.test(haystack) || /\b(?:A+H+N+|A+H+M+|M+U+A+H+N+|U+N+N+H+|A+O+H+|N+G+A+H+|M+P+H+)[A-Z]*[!?.~]*\b/.test(haystack)) {
    ensureScoredTag('loud moan', 'nonverbal', 14);
    ensureScoredTag('soft moan', 'nonverbal', 2);
    for (const item of scored) {
      if (item.tag === 'loud moan') item.score += 12;
      if (item.tag === 'soft moan') item.score -= 1;
      if (item.tag === 'breathless') item.score += 1;
      if (item.tag === 'shaky voice') item.score -= 4;
      if (item.tag === 'excited bright voice') item.score -= 4;
      if (item.tag === 'whimper') item.score -= 2;
      if (item.tag === 'gasp') item.score -= 1;
      if (item.tag === 'screaming') item.score -= 3;
    }
  }
  if (/\b(?:n+g+h+|n+n+g+h+|nn+gh+|u+n+n+h+|m+m+h+|m+m+n+h+|a+h+h+|h+a+a+)[a-z~]*[!?.~]*\b/i.test(haystack) || /\.\.\./.test(haystack) && /\b(tastes\s+so\s+good|feels\s+so\s+good|so\s+good|mm+|more|please|harder|deeper)\b/i.test(haystack)) {
    ensureScoredTag('soft moan', 'nonverbal', 5);
    for (const item of scored) {
      if (item.tag === 'soft moan') item.score += 4;
      if (item.tag === 'breathless') item.score += 1;
      if (item.tag === 'soft gasp') item.score += 1;
    }
  }
  if (/\b(moans?\s+grow\s+quieter|too\s+overwhelmed\s+to\s+make\s+much\s+sound|muffling\s+whatever\s+noises|buries?\s+her\s+face\s+in\s+the\s+pillows|barely\s+above\s+a\s+whisper|spent\s+and\s+trembling|ragged\s+and\s+uneven)\b/i.test(haystack) || /"[^\"]*(?:n+g+h+|m+mph+|a+ah+h+)[^\"]*"/i.test(haystack)) {
    ensureScoredTag('soft moan', 'nonverbal', 10);
    for (const item of scored) {
      if (item.tag === 'soft moan') item.score += 9;
      if (item.tag === 'loud moan') item.score -= 10;
      if (item.tag === 'shaky voice') item.score -= 4;
      if (item.tag === 'whisper') item.score += 1;
      if (item.tag === 'breathless') item.score += 1;
      if (item.tag === 'screaming') item.score -= 4;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  const categories = new Set();
  for (const item of scored) {
    if (picked.some((tag) => tag === item.tag)) continue;
    if (item.tag === 'laughing' && picked.includes('soft laugh')) continue;
    if (item.tag === 'gasp' && picked.includes('soft gasp')) continue;
    if (item.tag === 'crying' && item.score < 4) continue;
    if (item.tag === 'whimper' && item.score < 5) continue;
    if (item.tag === 'loud moan' && item.score < 5) continue;
    if (item.tag === 'soft moan' && item.score < 5) continue;
    if (item.tag === 'soft moan' && /\b(moans?\s+grow\s+louder|more\s+intense|high-pitched\s+wails?|hoarse\s+screams?|voice\s+rises\s+to\s+a\s+crescendo|new\s+peak\s+of\s+ecstasy)\b/i.test(haystack)) continue;
    if (item.tag === 'soft moan' && picked.includes('loud moan')) continue;
    if ((picked.includes('loud moan') || picked.includes('soft moan')) && item.tag === 'shaky voice') continue;
    if ((picked.includes('loud moan') || picked.includes('soft moan')) && item.tag === 'excited bright voice') continue;
    if ((picked.includes('loud moan') || picked.includes('soft moan')) && item.tag === 'crying') continue;
    if ((picked.includes('loud moan') || picked.includes('soft moan')) && item.tag === 'sad soft voice') continue;
    if ((picked.includes('loud moan') || picked.includes('soft moan')) && item.tag === 'screaming') continue;
    if (categories.has(item.category) && item.category !== 'nonverbal') continue;
    picked.push(item.tag);
    categories.add(item.category);
    if (picked.length >= maxPicked) break;
  }
  return picked;
}

function capTtsEmotionTagRepeats(tags = [], maxPerTag = 5, maxTotal = 20) {
  const counts = new Map();
  const capped = [];
  for (const tag of tags) {
    const normalized = String(tag || '').trim().toLowerCase();
    if (!normalized) continue;
    const count = counts.get(normalized) || 0;
    if (count >= maxPerTag) continue;
    counts.set(normalized, count + 1);
    capped.push(normalized);
    if (capped.length >= maxTotal) break;
  }
  return capped;
}

function parseTtsEmotionTags(value = '') {
  const tags = [];
  const tagRe = /[\[(]([a-z][a-z\s-]{1,40})[\])]/gi;
  let match;
  while ((match = tagRe.exec(String(value || '')))) {
    const tag = String(match[1] || '')
      .toLowerCase()
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (tag) tags.push(tag);
  }
  return capTtsEmotionTagRepeats(tags, 1, 24);
}

function getTtsTagIntensity(tag = '') {
  const normalized = String(tag || '').trim().toLowerCase();
  if (normalized === 'loud moan') return 3;
  if (normalized === 'screaming') return 3;
  if (normalized === 'loud') return 2;
  if (normalized === 'soft moan') return 2;
  if (normalized === 'whimper') return 2;
  return 1;
}

function getTtsTagLimitForText(text = '') {
  const length = cleanTtsSpeechText(text).length;
  if (length >= 2200) return 24;
  if (length >= 1600) return 20;
  if (length >= 1100) return 16;
  if (length >= 700) return 14;
  if (length >= 350) return 12;
  return 10;
}

function formatTtsEmotionTags(tags = [], options = {}) {
  const maxTags = Number.isFinite(options.maxTags) ? Math.max(1, Math.min(24, Math.floor(options.maxTags))) : 10;
  const capped = capTtsEmotionTagRepeats(tags, 1, maxTags);
  const expanded = [];
  for (const tag of capped) {
    const repeat = getTtsTagIntensity(tag);
    for (let index = 0; index < repeat; index += 1) expanded.push(`[${tag}]`);
  }
  return expanded.join(' ');
}

function mergeTtsEmotionTags(...tagLists) {
  const merged = [];
  for (const tagList of tagLists) {
    const nextTags = Array.isArray(tagList) ? tagList : parseTtsEmotionTags(tagList);
    merged.push(...nextTags);
  }
  return capTtsEmotionTagRepeats(merged, 1, 3);
}

function extractAutoTtsEmotionTags(text = '', options = {}) {
  const normalizedText = stripRpNarrationForTts(text, options);
  const maxTags = getTtsTagLimitForText(normalizedText);
  const tags = inferTtsDeliveryTags(text, normalizedText, { maxTags });
  return capTtsEmotionTagRepeats(tags, 1, maxTags);
}

async function tagTtsText({ text, character = null, settings = null } = {}) {
  const rawText = String(text || '').trim();
  const result = await maybeAddTtsEmotionTags({ text: rawText, character, settings });
  const fallbackSpokenText = cleanTtsSpeechText(stripRpNarrationForTts(rawText, { includeAsteriskNarration: settings?.ttsReadNarration === true }));
  const taggedText = normalizeTtsText(result.text || fallbackSpokenText);
  const tags = result.tag ? parseTtsEmotionTags(result.tag) : parseTtsEmotionTags(taggedText);
  return {
    ok: true,
    input: rawText,
    text: taggedText,
    taggedText,
    tags,
    tag: result.tag || formatTtsEmotionTags(tags, { maxTags: getTtsTagLimitForText(rawText) }),
    spokenText: cleanTtsSpeechText(stripRpNarrationForTts(rawText, { includeAsteriskNarration: settings?.ttsReadNarration === true })),
  };
}

function renderFishDirectedTtsText(rawText = '', options = {}) {
  const raw = String(rawText || '').trim();
  const includeAsteriskNarration = options.includeAsteriskNarration === true;
  const speech = cleanTtsSpeechText(stripRpNarrationForTts(raw, { includeAsteriskNarration }));
  const maxTags = getTtsTagLimitForText(speech || raw);
  const tags = inferTtsDeliveryTags(raw, speech, { maxTags });
  const cappedTags = capTtsEmotionTagRepeats(tags, 1, maxTags);
  const tagText = formatTtsEmotionTags(cappedTags, { maxTags });
  const text = speech ? cleanTtsSpeechText(`${tagText ? `${tagText} ` : ''}${speech}`) : normalizeTtsText(raw);
  return { text, tags: cappedTags };
}

async function maybeAddTtsEmotionTags({ text, character = null, settings = null }) {
  const rawText = String(text || '').trim();
  const includeAsteriskNarration = settings?.ttsReadNarration === true;
  const spokenText = cleanTtsSpeechText(stripRpNarrationForTts(rawText, { includeAsteriskNarration }));
  const normalizedText = normalizeTtsText(spokenText);

  if (hasInlineFishEmotionTags(normalizedText) || normalizedText.length < 8) {
    const maxTags = getTtsTagLimitForText(normalizedText);
    const inlineTags = capTtsEmotionTagRepeats(parseTtsEmotionTags(normalizedText), 1, maxTags);
    const mergedTagText = formatTtsEmotionTags(inlineTags, { maxTags });
    const textWithoutTags = stripInlineFishEmotionTags(normalizedText);
    return { text: textWithoutTags, tag: mergedTagText };
  }

  const directed = renderFishDirectedTtsText(rawText, { includeAsteriskNarration });
  if (directed.tags.length) {
    const maxTags = getTtsTagLimitForText(spokenText);
    const tagText = formatTtsEmotionTags(directed.tags, { maxTags });
    return { text: normalizeTtsText(directed.text), tag: tagText };
  }

  try {
    const appConfig = await loadAppConfig();
    const model = TTS_EMOTION_MODEL || appConfig.endpoints?.defaultModel || DEFAULT_MODEL;
    const response = await fetchBackend('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model,
        temperature: 0.15,
        top_p: 0.35,
        stream: false,
        messages: [
          {
            role: 'system',
            content: [
              'Choose Fish Audio S2-Pro delivery tags for this character line.',
              'Return ONLY bracket tags or NONE. Examples: [quiet teasing tone], [sigh], [deadpan], [shaky soft voice], [whimper], [soft moan], [loud moan]. Treat explicit erotic vocalizations like AAHN, AHHN, UNNH, MUAHN, NNNGH, NNGH, MMMH as moans when context supports it.',
              'Prefer one strong natural-language tag over many weak tags. Maximum two tags.',
              'Do not rewrite the line. Do not continue the conversation.',
              'Use NONE if the emotion is neutral or unclear.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Character: ${String(character?.name || 'Assistant').trim()}\nLine: ${stripRpNarrationForTts(rawText, { includeAsteriskNarration })}`,
          },
        ],
      }),
    }, TTS_EMOTION_TIMEOUT_MS, 'local');

    if (!response.ok) throw new Error(`TTS emotion tag selection failed (${response.status})`);

    const json = await response.json();
    const maxTags = Math.min(10, getTtsTagLimitForText(spokenText));
    const modelTags = capTtsEmotionTagRepeats(parseTtsEmotionTags(json?.choices?.[0]?.message?.content || ''), 1, maxTags);
    const tag = formatTtsEmotionTags(modelTags, { maxTags });
    return { text: normalizeTtsText(tag ? `${tag} ${spokenText}` : spokenText), tag };
  } catch (error) {
    console.error('TTS emotion tagging fallback:', error);
    return { text: normalizeTtsText(spokenText), tag: '' };
  }
}

function getTtsContentType(format = 'mp3') {
  if (format === 'wav') return 'audio/wav';
  if (format === 'opus') return 'audio/ogg; codecs=opus';
  if (format === 'pcm') return 'application/octet-stream';
  return 'audio/mpeg';
}

function buildFishTtsPayload({ text, settings }) {
  return {
    text: normalizeTtsText(text),
    reference_id: String(settings.fishReferenceId || '').trim(),
    format: ['wav', 'pcm', 'mp3', 'opus'].includes(String(settings.ttsFormat || '').trim()) ? String(settings.ttsFormat || '').trim() : 'mp3',
    latency: ['low', 'normal', 'balanced'].includes(String(settings.ttsLatency || '').trim()) ? String(settings.ttsLatency || '').trim() : 'low',
  };
}


function buildDirectFishTtsSettings({ voiceId, format = 'mp3', latency = 'low', includeAsteriskNarration = false } = {}) {
  const fishReferenceId = String(voiceId || '').trim();
  return {
    fishReferenceId,
    ttsFormat: ['wav', 'pcm', 'mp3', 'opus'].includes(String(format || '').trim()) ? String(format || '').trim() : 'mp3',
    ttsLatency: ['low', 'normal', 'balanced'].includes(String(latency || '').trim()) ? String(latency || '').trim() : 'low',
    ttsReadNarration: includeAsteriskNarration === true,
  };
}

function setTaggedAudioHeaders(res, { taggedText = '', tags = [], spokenText = '', mode = 'full' } = {}) {
  res.setHeader('X-TTS-Mode', mode);
  res.setHeader('X-TTS-Tagged-Text', encodeURIComponent(String(taggedText || '').slice(0, 1800)));
  res.setHeader('X-TTS-Emotion-Tag', formatTtsEmotionTags(tags) || 'NONE');
  res.setHeader('X-TTS-Tags', encodeURIComponent(JSON.stringify(tags || [])));
  res.setHeader('X-TTS-Spoken-Text', encodeURIComponent(String(spokenText || '').slice(0, 1800)));
}

function buildFishRealtimePayload({ settings, format = 'mp3' }) {
  return {
    text: '',
    reference_id: String(settings.fishReferenceId || '').trim(),
    format: ['wav', 'pcm', 'mp3', 'opus'].includes(String(format || '').trim()) ? String(format || '').trim() : 'mp3',
    latency: ['low', 'normal', 'balanced'].includes(String(settings.ttsLatency || '').trim()) ? String(settings.ttsLatency || '').trim() : 'low',
    chunk_length: 140,
    condition_on_previous_chunks: true,
    normalize: true,
  };
}

function getTtsCacheKey({ text, characterId, settings }) {
  const normalizedText = normalizeTtsText(text);
  return crypto.createHash('sha256').update([
    'fish',
    String(characterId || ''),
    String(settings.fishReferenceId || ''),
    String(settings.ttsFormat || 'mp3'),
    String(settings.ttsLatency || 'low'),
    settings.ttsReadNarration === true ? 'read-narration' : 'dialogue-only',
    normalizedText,
  ].join('|')).digest('hex');
}

function getCachedAudioPath(cacheKey, format = 'mp3') {
  return path.join(AUDIO_CACHE_DIR, `${cacheKey}.${format}`);
}

async function pruneAudioCache() {
  try {
    const entries = await fsp.readdir(AUDIO_CACHE_DIR, { withFileTypes: true });
    const now = Date.now();
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(AUDIO_CACHE_DIR, entry.name);
      const stat = await fsp.stat(fullPath).catch(() => null);
      if (!stat) continue;
      files.push({ path: fullPath, name: entry.name, mtimeMs: stat.mtimeMs, size: stat.size });
    }

    for (const file of files) {
      if ((now - file.mtimeMs) > AUDIO_CACHE_MAX_AGE_MS) {
        await fsp.unlink(file.path).catch(() => {});
      }
    }

    const freshFiles = files
      .filter((file) => (now - file.mtimeMs) <= AUDIO_CACHE_MAX_AGE_MS)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const file of freshFiles.slice(AUDIO_CACHE_MAX_FILES)) {
      await fsp.unlink(file.path).catch(() => {});
    }

    let kept = freshFiles.slice(0, AUDIO_CACHE_MAX_FILES);
    let totalBytes = kept.reduce((sum, file) => sum + file.size, 0);
    for (const file of kept.slice().reverse()) {
      if (totalBytes <= AUDIO_CACHE_MAX_BYTES) break;
      await fsp.unlink(file.path).catch(() => {});
      totalBytes -= file.size;
    }
  } catch {}
}

async function callFishTTS(payload) {
  const response = await fetch(`${FISH_AUDIO_BASE_URL}/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FISH_AUDIO_API_KEY}`,
      'Content-Type': 'application/json',
      model: FISH_TTS_BACKEND,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(detail || `Fish Audio request failed (${response.status})`);
    error.statusCode = response.status === 401 || response.status === 402 ? 502 : 503;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    const error = new Error('Fish Audio returned empty audio');
    error.statusCode = 502;
    throw error;
  }

  return {
    buffer,
    contentType: response.headers.get('content-type') || getTtsContentType(payload.format),
  };
}

async function streamFishTtsToResponse({ text, settings, res }) {
  if (!fishAudioClient) {
    const error = new Error('Fish Audio is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  const request = buildFishRealtimePayload({ settings, format: 'mp3' });
  const connection = await fishAudioClient.textToSpeech.convertRealtime(request, (async function* generate() {
    yield normalizeTtsText(text);
  })(), FISH_TTS_BACKEND);

  const audioChunks = [];
  let settled = false;

  return await new Promise((resolve, reject) => {
    const finishSuccess = () => {
      if (settled) return;
      settled = true;
      try { res.end(); } catch {}
      resolve(Buffer.concat(audioChunks));
    };
    const finishError = (error) => {
      if (settled) return;
      settled = true;
      try { connection.close(); } catch {}
      reject(error instanceof Error ? error : new Error(String(error || 'Fish realtime streaming failed')));
    };

    connection.on(RealtimeEvents.OPEN, () => {
      res.status(200);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Mode', 'stream');
    });

    connection.on(RealtimeEvents.AUDIO_CHUNK, (chunk) => {
      const buffer = Buffer.from(chunk);
      if (!buffer.length) return;
      audioChunks.push(buffer);
      try {
        res.write(buffer);
      } catch (error) {
        finishError(error);
      }
    });

    connection.on(RealtimeEvents.ERROR, (error) => {
      const wrapped = error instanceof Error ? error : new Error(String(error || 'Fish realtime streaming failed'));
      wrapped.statusCode = wrapped.statusCode || 502;
      finishError(wrapped);
    });

    connection.on(RealtimeEvents.CLOSE, () => {
      finishSuccess();
    });
  });
}

function createConversationRecord(name, character) {
  const now = Date.now();
  const random = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const conversation = {
    id: random,
    name: (name || '').trim() || 'New chat',
    messages: [],
    updatedAt: now,
    createdAt: now,
    preview: character?.summary || '',
  };
  return applyCharacterTypeToConversation(conversation, character);
}

function findConversationEntry(userStore, historyId, characterId = '', personaId = '') {
  if (!historyId) return null;
  if (characterId) {
    const bucketKey = getConversationBucketKey(characterId, personaId);
    const list = userStore.conversations?.[bucketKey] || [];
    const conversation = list.find((item) => item.id === historyId);
    return conversation ? { bucketKey, conversation, characterId: String(characterId), personaId: String(personaId || '') } : null;
  }

  for (const [bucketKey, list] of Object.entries(userStore.conversations || {})) {
    const conversation = (list || []).find((item) => item.id === historyId);
    if (!conversation) continue;
    const [bucketCharacterId = '', bucketPersonaId = ''] = String(bucketKey).split('::');
    return { bucketKey, conversation, characterId: bucketCharacterId, personaId: bucketPersonaId };
  }
  return null;
}

function serializeNexusHistory(conversation, characterId, personaId = '') {
  const assistantMeta = conversation?.assistantMeta && typeof conversation.assistantMeta === 'object'
    ? {
        ...conversation.assistantMeta,
        type: String(conversation.assistantMeta.type || 'assistant') === 'assistant' ? 'assistant' : 'character',
        badgeLabel: String(conversation.assistantMeta.badgeLabel || 'OpenClaw').trim() || 'OpenClaw',
      }
    : null;
  const bridge = getConversationBridgeMeta(conversation);
  return {
    historyId: conversation.id,
    characterId,
    personaId: personaId || '',
    name: conversation.name || 'New chat',
    createdAt: conversation.createdAt || null,
    updatedAt: conversation.updatedAt || null,
    characterType: String(conversation?.characterType || 'character') === 'assistant' ? 'assistant' : 'character',
    assistantMeta,
    bridge,
    messages: Array.isArray(conversation.messages) ? conversation.messages.map(normalizeStoredMessage) : [],
  };
}

function normalizeNexusInputMessages({ historyMessages = [], message, messages }) {
  if (message !== undefined && messages !== undefined) {
    throw new Error('Provide either message or messages, not both');
  }
  if (message !== undefined) {
    const content = String(message || '').trim();
    if (!content) throw new Error('message is required');
    return [...historyMessages, { role: 'user', content }].map(normalizeStoredMessage);
  }
  if (messages !== undefined) {
    if (!Array.isArray(messages) || !messages.length) throw new Error('messages must be a non-empty array');
    return messages.map((item) => {
      const role = String(item?.role || '').trim();
      const content = typeof item?.content === 'string' ? item.content : '';
      if (!['user', 'assistant'].includes(role)) throw new Error('messages[].role must be user or assistant');
      if (!content.trim()) throw new Error('messages[].content is required');
      return normalizeStoredMessage({ role, content, images: item.images });
    });
  }
  throw new Error('Either message or messages is required');
}

async function generateCharacterReply({ userStore, authUser = null, characterId, personaId, messages, model, temperature, stream = false, onMeta = () => {}, onRetry = () => {}, onDelta = () => {} }) {
  const characters = listCharacters();
  const personas = listPersonas();
  const character = characters.find((c) => c.id === characterId);
  const persona = personas.find((p) => p.id === personaId) || personas[0] || null;

  if (!character) {
    const error = new Error('Character not found');
    error.statusCode = 404;
    throw error;
  }
  if (!Array.isArray(messages) || !messages.length) {
    const error = new Error('Messages are required');
    error.statusCode = 400;
    throw error;
  }

  const appConfig = await loadAppConfig();
  const characterSettings = getCharacterSettings(userStore, characterId);
  const conversationKey = getConversationBucketKey(characterId, personaId);
  const existingConversation = conversationId ? (userStore.conversations[conversationKey] || []).find((item) => item.id === conversationId) : null;
  const memoryBundle = existingConversation ? buildConversationMemoryBundle({ userStore, character, conversation: { ...existingConversation, messages } }) : null;
  const preferredModel = model || characterSettings.modelOverride || appConfig.endpoints.mainModel || appConfig.endpoints.defaultModel || DEFAULT_MODEL;
  const fallbackOverride1 = appConfig.endpoints.fallbackOverride1 || {};
  const fallbackOverride2 = appConfig.endpoints.fallbackOverride2 || {};
  const candidatePlans = [
    { provider: 'local', model: preferredModel },
    fallbackOverride1.enabled
      ? { provider: fallbackOverride1.provider || 'openrouter', model: fallbackOverride1.model, override: fallbackOverride1 }
      : { provider: appConfig.endpoints.fallbackProvider1 || 'local', model: appConfig.endpoints.fallbackModel1 },
    fallbackOverride2.enabled
      ? { provider: fallbackOverride2.provider || 'openrouter', model: fallbackOverride2.model, override: fallbackOverride2 }
      : { provider: appConfig.endpoints.fallbackProvider2 || 'local', model: appConfig.endpoints.fallbackModel2 },
    { provider: 'local', model: appConfig.endpoints.defaultModel || DEFAULT_MODEL },
  ].filter((item) => item.model);
  const dedupedKeys = new Set();
  const candidateModels = candidatePlans.filter((item) => {
    const key = `${item.provider}:${item.model}`;
    if (dedupedKeys.has(key)) return false;
    dedupedKeys.add(key);
    return true;
  });
  const effectiveTemperature = typeof temperature === 'number' ? temperature : characterSettings.temperature;

  const placeholderContext = { character, persona, authUser };
  const promptMessages = [
    { role: 'system', content: buildSystemPrompt(character, persona, characterSettings.notes, buildMemoryPromptBlock(memoryBundle || {}), authUser) },
    ...messages.map((message) => toBackendMessage(message, placeholderContext)),
  ];

  let json = null;
  let content = '';
  let usedModel = candidateModels[0]?.model;
  let usedProvider = candidateModels[0]?.provider || 'local';
  let lastFailure = null;
  const failures = [];

  for (const candidate of candidateModels) {
    usedModel = candidate.model;
    usedProvider = candidate.provider;
    try {
      const runtime = getProviderRuntimeConfig(candidate.provider, appConfig, candidate.override || null);
      if (candidate.provider !== 'local' && !runtime.apiKey) {
        lastFailure = `Provider ${candidate.provider} is missing an API key`;
        failures.push(lastFailure);
        continue;
      }

      onMeta({ model: candidate.model, provider: candidate.provider });

      const response = await fetchBackend('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: candidate.model,
          messages: promptMessages,
          temperature: typeof effectiveTemperature === 'number' ? effectiveTemperature : 0.85,
          max_tokens: characterSettings.maxTokens,
          max_completion_tokens: characterSettings.maxTokens,
          top_p: 0.92,
          stream,
        }),
      }, appConfig.endpoints.requestTimeoutMs || 120000, candidate.provider, candidate.override || null);

      if (!response.ok) {
        const text = await response.text();
        lastFailure = `${candidate.provider}/${candidate.model}: ${text.slice(0, 500)}`;
        failures.push(lastFailure);
        onRetry({ detail: lastFailure });
        continue;
      }

      if (stream) {
        content = replaceCharacterPlaceholders(await readChatCompletionStream(response, (delta) => onDelta(replaceCharacterPlaceholders(delta, placeholderContext))), placeholderContext);
        if (content) break;
        lastFailure = `${candidate.provider}/${candidate.model}: empty response`;
        failures.push(lastFailure);
        continue;
      }

      json = await response.json();
      content = replaceCharacterPlaceholders(json?.choices?.[0]?.message?.content || '', placeholderContext);
      if (content) break;
      lastFailure = `${candidate.provider}/${candidate.model}: empty response`;
      failures.push(lastFailure);
    } catch (error) {
      lastFailure = `${candidate.provider}/${candidate.model}: ${String(error?.message || error)}`;
      failures.push(lastFailure);
      onRetry({ detail: lastFailure });
    }
  }

  if (!content) {
    const error = new Error(lastFailure || 'No configured providers/models returned a usable response');
    error.statusCode = 502;
    error.payload = { error: 'Backend generation failed', detail: lastFailure || 'No configured providers/models returned a usable response', failures, attemptedModels: candidateModels, backendReachable: false };
    throw error;
  }

  return { content, raw: json, model: usedModel, provider: usedProvider, temperature: effectiveTemperature, attemptedModels: candidateModels, character, persona };
}


async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkWritableDir(dirPath) {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
    const probe = path.join(dirPath, `.nexus-write-test-${process.pid}-${Date.now()}`);
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function setupLevel(checks = []) {
  if (checks.some((check) => check.level === 'error')) return 'error';
  if (checks.some((check) => check.level === 'warn')) return 'warn';
  return 'ok';
}

async function collectSetupStatus({ testNetwork = true } = {}) {
  const checks = [];
  const add = (key, ok, message, options = {}) => checks.push({
    key,
    ok: Boolean(ok),
    level: options.level || (ok ? 'ok' : (options.optional ? 'info' : 'warn')),
    optional: Boolean(options.optional),
    message,
    fix: ok ? '' : (options.fix || ''),
  });

  const usersFileExists = await pathExists(USERS_PATH);
  const appConfigExists = await pathExists(APP_CONFIG_PATH);
  const appDataWritable = await checkWritableDir(APP_DATA_DIR);
  const audioCacheWritable = await checkWritableDir(AUDIO_CACHE_DIR);
  const config = await loadAppConfig();
  const users = await loadUsers();
  const adminUsers = Object.values(users.users || {}).filter((user) => user?.role === 'admin');
  const backendBaseUrl = String(config.endpoints?.localBaseUrl || BACKEND_BASE_URL || '').trim();
  const defaultModel = String(config.endpoints?.mainModel || config.endpoints?.defaultModel || DEFAULT_MODEL || '').trim();

  add('app-data-dir', appDataWritable, appDataWritable
    ? `Writable app data directory found at ${APP_DATA_DIR}.`
    : `App data directory is not writable: ${APP_DATA_DIR}.`, { level: appDataWritable ? 'ok' : 'error', fix: 'Set APP_DATA_DIR to a writable path or fix directory permissions.' });
  add('app-config', appConfigExists, appConfigExists
    ? 'App config file exists.'
    : 'App config file did not exist yet; NEXUS created defaults for this run.', { level: 'ok' });
  add('admin-user', adminUsers.length > 0, adminUsers.length > 0
    ? `${adminUsers.length} admin account${adminUsers.length === 1 ? '' : 's'} available.`
    : 'No admin account exists.', { level: adminUsers.length > 0 ? 'ok' : 'error', fix: 'Set DEFAULT_ADMIN_PASSWORD and restart, or repair the users.json store.' });
  add('users-file', usersFileExists, usersFileExists
    ? 'User store exists.'
    : 'User store did not exist yet; NEXUS created first-run users for this run.', { level: 'ok' });
  add('base-path', BASE_PATH.startsWith('/'), BASE_PATH.startsWith('/')
    ? `BASE_PATH is ${BASE_PATH}.`
    : `BASE_PATH should start with /, currently ${BASE_PATH}.`, { fix: 'Use BASE_PATH=/aichat for the default setup.' });
  add('public-origin', /^https?:\/\//i.test(PUBLIC_APP_ORIGIN), /^https?:\/\//i.test(PUBLIC_APP_ORIGIN)
    ? `PUBLIC_APP_ORIGIN is ${PUBLIC_APP_ORIGIN}.`
    : `PUBLIC_APP_ORIGIN should be a full http(s) URL, currently ${PUBLIC_APP_ORIGIN}.`, { optional: true, fix: 'For local setup use PUBLIC_APP_ORIGIN=http://localhost:3000.' });
  add('chat-backend-url', Boolean(backendBaseUrl), backendBaseUrl
    ? `Chat backend URL is ${backendBaseUrl}.`
    : 'Chat backend URL is missing.', { level: backendBaseUrl ? 'ok' : 'error', fix: 'Set BACKEND_BASE_URL to an OpenAI-compatible /v1 endpoint such as LM Studio or Ollama.' });
  add('default-model', Boolean(defaultModel), defaultModel
    ? `Default model is ${defaultModel}.`
    : 'Default model is missing.', { level: defaultModel ? 'ok' : 'warn', fix: 'Set DEFAULT_MODEL or choose a model in admin endpoint settings.' });
  add('tts-cache', audioCacheWritable, audioCacheWritable
    ? 'TTS audio cache is writable.'
    : `TTS audio cache is not writable: ${AUDIO_CACHE_DIR}.`, { optional: true, level: audioCacheWritable ? 'ok' : 'warn', fix: 'Fix APP_DATA_DIR permissions or disable voice features.' });

  if (testNetwork && backendBaseUrl) {
    try {
      const response = await fetchBackend('/models', {}, 3000, 'local');
      const text = await response.text();
      let modelFound = false;
      try {
        const parsed = JSON.parse(text);
        const models = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed?.models) ? parsed.models : [];
        modelFound = Boolean(defaultModel && models.some((item) => String(item?.id || item?.name || item) === defaultModel));
      } catch {}
      add('chat-backend-reachable', response.ok, response.ok
        ? `Chat backend responded to /models (${response.status}).`
        : `Chat backend responded with HTTP ${response.status}.`, { level: response.ok ? 'ok' : 'error', fix: 'Start your backend or correct BACKEND_BASE_URL.' });
      if (response.ok && defaultModel) {
        add('default-model-listed', modelFound, modelFound
          ? 'Default model appears in the backend model list.'
          : 'Backend is reachable, but the default model was not found in the model list.', { level: modelFound ? 'ok' : 'warn', fix: 'Click Fetch models in endpoint settings and choose an available model.' });
      }
    } catch (error) {
      add('chat-backend-reachable', false, `Could not reach chat backend: ${String(error?.message || error)}`, { level: 'error', fix: 'Start LM Studio/Ollama/provider proxy, then rerun the setup check.' });
    }
  }

  add('fish-audio', Boolean(FISH_AUDIO_API_KEY), FISH_AUDIO_API_KEY
    ? 'Fish Audio API key is configured. Voice is available when character voices are set.'
    : 'Fish Audio API key is missing. Voice is optional and manual playback will be unavailable until configured.', { optional: true, level: FISH_AUDIO_API_KEY ? 'ok' : 'info', fix: 'Set FISH_AUDIO_API_KEY only if you want voice/TTS.' });
  add('fish-default-voice', Boolean(DEFAULT_FISH_REFERENCE_ID), DEFAULT_FISH_REFERENCE_ID
    ? `Default Fish reference ID is configured (${DEFAULT_FISH_VOICE_LABEL}).`
    : 'No default Fish voice/reference ID is configured. Per-character voices can still be set later.', { optional: true, level: 'info' });
  add('image-generation', Boolean(REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY), (REPLICATE_API_TOKEN || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY)
    ? 'At least one image generation provider key is configured.'
    : 'Image generation keys are missing. Image generation is optional.', { optional: true, level: 'info' });
  add('openclaw-bridge', Boolean(OPENCLAW_BRIDGE_SECRET), OPENCLAW_BRIDGE_SECRET
    ? 'OpenClaw bridge secret is configured.'
    : 'OpenClaw bridge is not configured. This is optional unless you use OpenClaw assistant characters.', { optional: true, level: 'info' });

  const level = setupLevel(checks);
  return {
    ok: level !== 'error',
    level,
    summary: level === 'error' ? 'Setup has blocking issues.' : level === 'warn' ? 'Setup works, but a few items need attention.' : 'Setup looks ready.',
    basePath: BASE_PATH,
    publicOrigin: PUBLIC_APP_ORIGIN,
    appDataDir: APP_DATA_DIR,
    backendBaseUrl,
    defaultModel,
    firstRun: !usersFileExists,
    checks,
  };
}


app.get(`${BASE_PATH}/api/setup/status`, async (req, res) => {
  try {
    const status = await collectSetupStatus({ testNetwork: req.query?.network !== '0' });
    res.json(status);
  } catch (error) {
    res.status(500).json({ ok: false, level: 'error', summary: 'Setup status failed.', checks: [{ key: 'setup-status', ok: false, level: 'error', message: String(error?.message || error) }] });
  }
});

app.post(`${BASE_PATH}/api/auth/login`, async (req, res) => {
  const username = normalizeUsername(req.body?.username || '');
  const password = String(req.body?.password || '');
  const usersFile = await loadUsers();
  const user = usersFile.users?.[username];
  if (!user || !verifyPassword(password, user)) {
    clearSessionCookie(req, res);
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_MAX_AGE_MS });
  persistSessionsToDisk();
  setSessionCookie(req, res, token);
  res.json({ ok: true, user: sanitizeUser(user) });
});

app.post(`${BASE_PATH}/api/auth/logout`, async (req, res) => {
  const session = getAuthenticatedSession(req);
  if (session?.token) {
    sessions.delete(session.token);
    persistSessionsToDisk();
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get(`${BASE_PATH}/api/auth/session`, async (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) return res.json({ authenticated: false });
  const usersFile = await loadUsers();
  const user = usersFile.users?.[session.username];
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: sanitizeUser(user) });
});

app.post(`${BASE_PATH}/api/auth/copy-session-cookie`, requireAuth, async (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session?.token) return res.status(401).json({ error: 'Authentication required' });
  res.json({
    ok: true,
    cookieName: SESSION_COOKIE,
    cookieValue: session.token,
    cookie: `${SESSION_COOKIE}=${session.token}`,
  });
});

app.get(`${BASE_PATH}/api/admin/users`, requireAuth, requireAdmin, async (_req, res) => {
  const usersFile = await loadUsers();
  res.json({ users: Object.values(usersFile.users || {}).map(sanitizeUser).sort((a, b) => a.displayName.localeCompare(b.displayName)) });
});

app.post(`${BASE_PATH}/api/admin/users`, requireAuth, requireAdmin, async (req, res) => {
  const username = normalizeUsername(req.body?.username || '');
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || titleizeUsername(username)).trim();
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  const usersFile = await loadUsers();
  if (usersFile.users[username]) return res.status(409).json({ error: 'User already exists' });
  usersFile.users[username] = {
    username,
    displayName: displayName || titleizeUsername(username),
    role,
    ...makePasswordRecord(password),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveUsers(usersFile);

  const store = await loadStore();
  getUserStore(store, username);
  await saveStore(store);

  res.status(201).json({ user: sanitizeUser(usersFile.users[username]) });
});

app.put(`${BASE_PATH}/api/admin/users/:username`, requireAuth, requireAdmin, async (req, res) => {
  const username = normalizeUsername(req.params.username || '');
  const usersFile = await loadUsers();
  const user = usersFile.users?.[username];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const nextRole = req.body?.role === 'admin' ? 'admin' : 'user';
  const adminCount = Object.values(usersFile.users || {}).filter((item) => item.role === 'admin').length;
  if (user.role === 'admin' && nextRole !== 'admin' && adminCount <= 1) {
    return res.status(400).json({ error: 'At least one admin account must remain' });
  }

  user.displayName = String(req.body?.displayName || user.displayName || titleizeUsername(username)).trim() || titleizeUsername(username);
  user.role = nextRole;
  if (req.body?.password) {
    const nextPassword = String(req.body.password);
    if (nextPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    Object.assign(user, makePasswordRecord(nextPassword));
  }
  user.updatedAt = Date.now();
  await saveUsers(usersFile);
  res.json({ user: sanitizeUser(user) });
});

app.get(`${BASE_PATH}/api/health`, requireAuth, async (_req, res) => {
  const config = await loadAppConfig();
  try {
    const response = await fetchBackend('/models', {}, 2500);
    res.json({ ok: response.ok, backendReachable: response.ok, backendBaseUrl: config.endpoints.localBaseUrl, defaultModel: config.endpoints.defaultModel, providerLabel: config.endpoints.providerLabel });
  } catch {
    res.json({ ok: true, backendReachable: false, backendBaseUrl: config.endpoints.localBaseUrl, defaultModel: config.endpoints.defaultModel, providerLabel: config.endpoints.providerLabel });
  }
});

app.get(`${BASE_PATH}/api/bootstrap`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const appConfig = await loadAppConfig();
  const userStore = getUserStore(store, req.authUser.username);
  const recentConversations = Object.entries(userStore.conversations || {})
    .flatMap(([bucketKey, list]) => (Array.isArray(list) ? list.map((item) => ({
      id: item.id,
      name: item.name,
      updatedAt: item.updatedAt,
      preview: item.preview,
      bucketKey,
      characterType: String(item?.characterType || 'character') === 'assistant' ? 'assistant' : 'character',
      assistantMeta: item?.assistantMeta && typeof item.assistantMeta === 'object'
        ? {
            ...item.assistantMeta,
            badgeLabel: String(item.assistantMeta.badgeLabel || 'OpenClaw').trim() || 'OpenClaw',
          }
        : null,
      bridge: getConversationBridgeMeta(item),
    })) : []))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 20);

  res.json({
    user: req.authUser,
    backendBaseUrl: appConfig.endpoints.localBaseUrl,
    defaultModel: appConfig.endpoints.defaultModel,
    providerLabel: appConfig.endpoints.providerLabel,
    characters: listCharacters(),
    personas: listPersonas(),
    backgrounds: listBackgrounds(),
    ui: userStore.ui || { backgroundFavorites: [] },
    appUi: userStore.appUi || defaultUserData().appUi,
    session: userStore.session || defaultUserData().session,
    favorites: userStore.favorites || [],
    appConfig: {
      endpoints: req.authUser.isAdmin ? appConfig.endpoints : null,
      providers: req.authUser.isAdmin ? maskProviders(appConfig.providers) : null,
    },
    recentConversations,
  });
});

app.get(`${BASE_PATH}/api/models`, requireAuth, async (_req, res) => {
  const config = await loadAppConfig();
  const defaultModel = config.endpoints.defaultModel || DEFAULT_MODEL;
  const extraModels = [{ id: 'openrouter/openrouter/openai/gpt-5.5', label: 'openrouter/openrouter/openai/gpt-5.5' }];
  try {
    const models = await fetchProviderModels('local', config);
    const deduped = Array.from(new Map([...extraModels, ...models].map((m) => [m.id, m])).values());
    if (!deduped.find((m) => m.id === defaultModel)) deduped.unshift({ id: defaultModel, label: defaultModel });
    res.json({ models: deduped, backendReachable: true });
  } catch (error) {
    const fallback = Array.from(new Map([{ id: defaultModel, label: defaultModel }, ...extraModels].map((m) => [m.id, m])).values());
    res.json({ models: fallback, backendReachable: false, error: String(error?.message || error) });
  }
});

app.get(`${BASE_PATH}/api/provider-models`, requireAuth, async (req, res) => {
  const config = await loadAppConfig();
  const provider = String(req.query.provider || 'local');
  try {
    const models = await fetchProviderModels(provider, config);
    res.json({ provider, models });
  } catch (error) {
    res.status(502).json({ provider, error: String(error?.message || error), models: [] });
  }
});

app.post(`${BASE_PATH}/api/acquisition/chub/start`, requireAuth, requireAdmin, async (req, res) => {
  try {
    if (acquisitionRun?.running) return res.status(409).json({ error: 'Acquisition already running', acquisition: summarizeAcquisitionRun() });
    const batchSize = Math.max(1, Math.min(50, Number(req.body?.batchSize || 6)));
    const noQuality = req.body?.noQuality === true || req.body?.noQuality === 'true';
    const scoreThreshold = noQuality ? 0 : Math.max(40, Math.min(95, Number(req.body?.scoreThreshold || 60)));
    const scriptPath = path.join(process.cwd(), 'automation/chub/acquire-chub.mjs');
    if (!fs.existsSync(scriptPath)) {
      acquisitionRun = { running: true, startedAt: new Date().toISOString(), requestedBy: req.authUser.displayName || req.authUser.username, target: batchSize, accepted: [], rejected: [], duplicateCount: 0, output: [], averageScore: 0, error: '' };
      setImmediate(async () => {
        try {
          await acquireChubBatch({ requestedBy: req.authUser.username, batchSize, scoreThreshold, useExistingRun: true, noQuality });
        } catch (error) {
          acquisitionRun = summarizeAcquisitionRun({ ...(acquisitionRun || {}), running: false, finishedAt: new Date().toISOString(), error: String(error?.message || error) });
        }
      });
      return res.status(202).json(summarizeAcquisitionRun());
    }
    const run = startAcquisitionScript({
      requestedBy: req.authUser.displayName || req.authUser.username,
      batchSize,
      scoreThreshold,
      noQuality,
      password: req.body?.password ? String(req.body.password) : '',
    });
    res.status(202).json(run);
  } catch (error) {
    const message = String(error?.message || error);
    acquisitionRun = summarizeAcquisitionRun({ ...(acquisitionRun || {}), running: false, finishedAt: new Date().toISOString(), error: message });
    res.status(500).json({ error: message, acquisition: acquisitionRun });
  }
});

app.post(`${BASE_PATH}/api/characters`, requireAuth, async (req, res) => {
  const body = req.body || {};
  const card = normalizeCharacterCard(body);
  if (!card.name?.trim()) return res.status(400).json({ error: 'Character name is required' });
  if (!String(body.avatarDataUrl || body.avatar || body.avatarPath || '').trim()) return res.status(400).json({ error: 'Avatar is required' });

  const requestedType = String(body.type || 'character').trim().toLowerCase();
  const characterType = requestedType === 'assistant' ? 'assistant' : 'character';
  const assistantConfig = characterType === 'assistant' ? normalizeAssistantConfig(body.assistantConfig || {}) : null;
  const slug = slugify(card.name);
  const id = `local-${slug}`;
  const avatar = await saveDataUrlAsset(body.avatarDataUrl || '', `${id}-${Date.now().toString(36)}`);
  const record = {
    id,
    source: 'local',
    type: characterType,
    assistantConfig,
    avatar,
    ...card,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await ensureCharacterDirs();
  await fsp.writeFile(path.join(LOCAL_CHARACTERS_DIR, `${id}.json`), JSON.stringify(record, null, 2));
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  await ensureCharacterVoiceDefaults(store, userStore, id, { force: true, source: 'created-name-match' }).catch(() => {});
  res.status(201).json({ character: serializeLocalCharacter(record) });
});

app.get(`${BASE_PATH}/api/characters/:characterId`, requireAuth, async (req, res) => {
  const record = getLocalCharacterRecord(req.params.characterId);
  if (!record) return res.status(404).json({ error: 'Local character not found' });
  res.json({ character: record });
});

app.put(`${BASE_PATH}/api/characters/:characterId`, requireAuth, async (req, res) => {
  const record = getLocalCharacterRecord(req.params.characterId);
  if (!record) return res.status(404).json({ error: 'Local character not found' });
  const body = req.body || {};
  const card = normalizeCharacterCard(body);
  let avatar = record.avatar || '';
  if (body.avatarDataUrl) avatar = await saveDataUrlAsset(body.avatarDataUrl, `${record.id}-${Date.now().toString(36)}`);
  const requestedType = String(body.type || record.type || 'character').trim().toLowerCase();
  const characterType = requestedType === 'assistant' ? 'assistant' : 'character';
  const assistantConfig = characterType === 'assistant'
    ? normalizeAssistantConfig(body.assistantConfig || record.assistantConfig || {})
    : null;
  const updated = {
    ...record,
    ...card,
    type: characterType,
    assistantConfig,
    avatar,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : (record.tags || []),
    updatedAt: Date.now(),
  };
  await fsp.writeFile(path.join(LOCAL_CHARACTERS_DIR, `${record.id}.json`), JSON.stringify(updated, null, 2));
  res.json({ character: serializeLocalCharacter(updated) });
});

app.get(`${BASE_PATH}/api/characters/:characterId/export`, requireAuth, async (req, res) => {
  const record = getLocalCharacterRecord(req.params.characterId);
  if (!record) return res.status(404).json({ error: 'Local character not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${record.id}.json"`);
  res.send(JSON.stringify(record, null, 2));
});

app.delete(`${BASE_PATH}/api/characters/:characterId`, requireAuth, async (req, res) => {
  const record = getLocalCharacterRecord(req.params.characterId);
  if (!record) return res.status(404).json({ error: 'Local character not found' });
  await fsp.unlink(path.join(LOCAL_CHARACTERS_DIR, `${record.id}.json`)).catch(() => {});
  if (record.avatar) await fsp.unlink(path.join(LOCAL_CHARACTER_ASSETS_DIR, record.avatar)).catch(() => {});
  res.json({ ok: true });
});

app.post(`${BASE_PATH}/api/characters/import`, requireAuth, async (req, res) => {
  const body = req.body || {};

  if (body.name || body.personality || body.scenario) {
    const payload = {
      name: String(body.name || '').trim(),
      description: String(body.description || body.personality || '').trim(),
      personality: String(body.personality || '').trim(),
      scenario: String(body.scenario || '').trim(),
      first_mes: String(body.first_mes || body.first_message || '').trim(),
      mes_example: String(body.mes_example || body.example_dialogue || '').trim(),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    };
    if (!payload.name || !payload.personality || !payload.scenario) {
      await appendImportLog({ name: payload.name || 'unknown', source: String(body.source || body.sourceUrl || ''), fileType: 'api-import', success: false, score: Number.isFinite(Number(body.score)) ? Number(body.score) : null, error: 'Missing required fields' });
      return res.status(400).json({ error: 'name, personality, and scenario are required' });
    }
    if (!String(body.avatarDataUrl || body.avatar || body.avatarPath || '').trim()) {
      await appendImportLog({ name: payload.name || 'unknown', source: String(body.source || body.sourceUrl || ''), fileType: 'api-import', success: false, score: Number.isFinite(Number(body.score)) ? Number(body.score) : null, error: 'Avatar required' });
      return res.status(400).json({ error: 'avatar is required' });
    }

    const slug = slugify(payload.name);
    const id = `local-${slug}`;
    const avatar = await saveDataUrlAsset(String(body.avatarDataUrl || ''), `${id}-${Date.now().toString(36)}`);
    const record = {
      id,
      source: 'local',
      importSource: String(body.importSource || body.sourceType || 'manual').trim(),
      sourceUrl: String(body.source || body.sourceUrl || '').trim(),
      avatarSourcePath: String(body.avatar || body.avatarPath || '').trim(),
      importedBy: req.authUser.username,
      avatar,
      score: Number.isFinite(Number(body.score)) ? Number(body.score) : null,
      importedAt: String(body.imported_at || body.importedAt || new Date().toISOString()),
      ...payload,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await ensureCharacterDirs();
    await fsp.writeFile(path.join(LOCAL_CHARACTERS_DIR, `${id}.json`), JSON.stringify(record, null, 2));
    await appendImportLog({ name: payload.name, source: record.sourceUrl, fileType: 'api-import', success: true, score: record.score, importSource: record.importSource });
    const store = await loadStore();
    const userStore = getUserStore(store, req.authUser.username);
    await ensureCharacterVoiceDefaults(store, userStore, id, { force: true, source: 'imported-name-match' }).catch(() => {});
    return res.status(201).json({ character: serializeLocalCharacter(record) });
  }

  const fileName = String(body.fileName || 'import').toLowerCase();
  const dataUrl = String(body.dataUrl || '');
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Unsupported import payload' });

  let parsed;
  if (fileName.endsWith('.json') || match[1] === 'application/json') {
    parsed = JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
  } else if (fileName.endsWith('.png') || match[1] === 'image/png') {
    const tempPath = path.join(APP_DATA_DIR, `import-${Date.now().toString(36)}.png`);
    await fsp.writeFile(tempPath, Buffer.from(match[2], 'base64'));
    parsed = readPngCharacterCard(tempPath);
    await fsp.unlink(tempPath).catch(() => {});
  } else {
    return res.status(400).json({ error: 'Only character JSON or PNG card imports are supported' });
  }

  const card = normalizeCharacterCard(parsed);
  res.json({
    imported: {
      name: card.name,
      description: card.description,
      personality: card.personality,
      scenario: card.scenario,
      first_mes: card.first_mes,
      tags: Array.isArray(card.tags) ? card.tags : [],
    },
  });
});

app.post(`${BASE_PATH}/api/characters/acquire-chub`, requireAuth, requireAdmin, async (req, res) => {
  try {
    if (acquisitionRun?.running) return res.status(409).json({ error: 'Acquisition already running', acquisition: summarizeAcquisitionRun() });
    const batchSize = Math.max(1, Math.min(50, Number(req.body?.batchSize || 6)));
    const scoreThreshold = Math.max(40, Math.min(95, Number(req.body?.scoreThreshold || 60)));
    const scriptPath = path.join(process.cwd(), 'automation/chub/acquire-chub.mjs');

    if (!fs.existsSync(scriptPath)) {
      const result = await acquireChubBatch({ requestedBy: req.authUser.username, batchSize, scoreThreshold });
      return res.json(summarizeAcquisitionRun(result));
    }

    const run = startAcquisitionScript({
      requestedBy: req.authUser.displayName || req.authUser.username,
      batchSize,
      scoreThreshold,
      password: req.body?.password ? String(req.body.password) : '',
    });
    res.status(202).json(run);
  } catch (error) {
    const message = String(error?.message || error);
    acquisitionRun = summarizeAcquisitionRun({ ...(acquisitionRun || {}), running: false, finishedAt: new Date().toISOString(), error: message });
    res.status(500).json({ error: message, acquisition: acquisitionRun });
  }
});

app.get(`${BASE_PATH}/api/acquisition/chub`, requireAuth, requireAdmin, async (_req, res) => {
  res.json(summarizeAcquisitionRun());
});

app.get(`${BASE_PATH}/api/config/ui`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  res.json({
    ...(userStore.appUi || defaultUserData().appUi),
    imageGenerationModels: IMAGE_GENERATION_MODELS,
  });
});

app.put(`${BASE_PATH}/api/config/ui`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const next = { ...(userStore.appUi || defaultUserData().appUi), ...(req.body || {}) };
  next.imageGenerationModel = ALLOWED_IMAGE_GENERATION_MODELS.has(String(next.imageGenerationModel || '')) ? String(next.imageGenerationModel) : ((userStore.appUi || defaultUserData().appUi).imageGenerationModel || OPENAI_IMAGE_MODEL);
  userStore.appUi = next;
  await saveStore(store);
  res.json({
    ...userStore.appUi,
    imageGenerationModels: IMAGE_GENERATION_MODELS,
  });
});

app.get(`${BASE_PATH}/api/config/endpoints`, requireAuth, requireAdmin, async (_req, res) => {
  const config = await loadAppConfig();
  res.json(config.endpoints);
});

app.put(`${BASE_PATH}/api/config/endpoints`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  config.endpoints = { ...config.endpoints, ...(req.body || {}) };
  await saveAppConfig(config);
  res.json(config.endpoints);
});

app.get(`${BASE_PATH}/api/config/providers`, requireAuth, requireAdmin, async (_req, res) => {
  const config = await loadAppConfig();
  res.json(maskProviders(config.providers));
});

app.put(`${BASE_PATH}/api/config/providers`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const patch = req.body || {};
  config.providers = Object.fromEntries(Object.entries(config.providers).map(([key, value]) => [key, { ...value, ...((patch || {})[key] || {}) }]));
  await saveAppConfig(config);
  res.json(maskProviders(config.providers));
});

app.post(`${BASE_PATH}/api/config/test-connection`, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const response = await fetchBackend('/models', {}, 4000);
    const text = await response.text();
    res.json({ ok: response.ok, status: response.status, detail: text.slice(0, 400) });
  } catch (error) {
    res.status(503).json({ ok: false, detail: String(error?.message || error) });
  }
});


app.get(`${BASE_PATH}/api/admin/nexus-api`, requireAuth, requireAdmin, async (_req, res) => {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  res.json({
    enabled: nexusApi.enabled === true,
    allowSessionAuth: nexusApi.allowSessionAuth === true,
    offlineMessage: String(nexusApi.offlineMessage || ''),
    keys: (nexusApi.keys || []).map(maskNexusApiKeyRecord),
  });
});

app.put(`${BASE_PATH}/api/admin/nexus-api/settings`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const current = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  config.nexusApi = {
    ...current,
    enabled: req.body?.enabled !== undefined ? req.body.enabled === true : current.enabled,
    allowSessionAuth: req.body?.allowSessionAuth !== undefined ? req.body.allowSessionAuth === true : current.allowSessionAuth,
    offlineMessage: req.body?.offlineMessage !== undefined ? String(req.body.offlineMessage || '').trim() || current.offlineMessage : current.offlineMessage,
  };
  await saveAppConfig(config);
  res.json({ enabled: config.nexusApi.enabled, allowSessionAuth: config.nexusApi.allowSessionAuth, offlineMessage: config.nexusApi.offlineMessage, keys: (config.nexusApi.keys || []).map(maskNexusApiKeyRecord) });
});

app.post(`${BASE_PATH}/api/admin/nexus-api/keys`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  const secret = generateNexusApiSecret();
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    label: String(req.body?.label || 'New API key').trim() || 'New API key',
    secretHash: hashNexusApiSecret(secret),
    secretPreview: previewNexusApiSecret(secret),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    lastUsedAt: '',
    lastUsedMeta: null,
    notes: String(req.body?.notes || '').trim(),
    createdBy: String(req.authUser?.username || '').trim(),
    rotatedFrom: '',
  };
  nexusApi.keys = [record, ...(Array.isArray(nexusApi.keys) ? nexusApi.keys : [])];
  config.nexusApi = nexusApi;
  await saveAppConfig(config);
  res.status(201).json({ ok: true, key: maskNexusApiKeyRecord(record), secret });
});

app.post(`${BASE_PATH}/api/admin/nexus-api/keys/:keyId/rotate`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  const current = (nexusApi.keys || []).find((item) => item.id === String(req.params.keyId || '').trim());
  if (!current) return res.status(404).json({ ok: false, error: 'API key not found' });
  const secret = generateNexusApiSecret();
  current.secretHash = hashNexusApiSecret(secret);
  current.secretPreview = previewNexusApiSecret(secret);
  current.status = 'active';
  current.updatedAt = new Date().toISOString();
  current.rotatedFrom = current.rotatedFrom || current.id;
  if (req.body?.label !== undefined) current.label = String(req.body.label || '').trim() || current.label;
  if (req.body?.notes !== undefined) current.notes = String(req.body.notes || '').trim();
  config.nexusApi = nexusApi;
  await saveAppConfig(config);
  res.json({ ok: true, key: maskNexusApiKeyRecord(current), secret });
});

app.put(`${BASE_PATH}/api/admin/nexus-api/keys/:keyId`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  const current = (nexusApi.keys || []).find((item) => item.id === String(req.params.keyId || '').trim());
  if (!current) return res.status(404).json({ ok: false, error: 'API key not found' });
  if (req.body?.label !== undefined) current.label = String(req.body.label || '').trim() || current.label;
  if (req.body?.notes !== undefined) current.notes = String(req.body.notes || '').trim();
  if (req.body?.status !== undefined) current.status = ['active', 'disabled', 'revoked'].includes(String(req.body.status || '').trim()) ? String(req.body.status).trim() : current.status;
  current.updatedAt = new Date().toISOString();
  config.nexusApi = nexusApi;
  await saveAppConfig(config);
  res.json({ ok: true, key: maskNexusApiKeyRecord(current) });
});

app.delete(`${BASE_PATH}/api/admin/nexus-api/keys/:keyId`, requireAuth, requireAdmin, async (req, res) => {
  const config = await loadAppConfig();
  const nexusApi = { ...defaultAppConfig().nexusApi, ...(config.nexusApi || {}) };
  const keyId = String(req.params.keyId || '').trim();
  const before = (nexusApi.keys || []).length;
  nexusApi.keys = (nexusApi.keys || []).filter((item) => item.id !== keyId);
  if (nexusApi.keys.length === before) return res.status(404).json({ ok: false, error: 'API key not found' });
  config.nexusApi = nexusApi;
  await saveAppConfig(config);
  res.json({ ok: true, keys: nexusApi.keys.map(maskNexusApiKeyRecord) });
});

app.get(`${BASE_PATH}/api/fish/models`, async (req, res) => {
  try {
    if (!isFishConfigured()) return res.status(503).json({ error: 'Fish Audio is not configured on the server.' });
    const query = String(req.query.q || req.query.query || req.query.title || req.query.characterName || '').trim();
    if (!query) return res.json({ query: '', items: [], bestMatch: null });
    const characterId = String(req.query.characterId || '').trim();
    const character = characterId ? listCharacters().find((item) => item.id === characterId) || null : null;
    const result = await searchFishModelsByName(query, {
      limit: Math.min(Math.max(Number(req.query.limit || 8), 1), 12),
      pageSize: Math.min(Math.max(Number(req.query.pageSize || 12), 1), 25),
      character,
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 503).json({ error: 'Fish voice lookup failed', detail: String(error?.message || error), items: [], bestMatch: null });
  }
});

app.post(`${BASE_PATH}/api/fish/rematch-default-voices`, requireAuth, async (_req, res) => {
  try {
    const result = await migrateExistingCharacterVoices({ force: false });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Voice migration failed', detail: String(error?.message || error) });
  }
});

app.get(`${BASE_PATH}/api/character/:characterId/settings`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const settings = await ensureCharacterVoiceDefaults(store, userStore, req.params.characterId);
  res.json(settings);
});

app.put(`${BASE_PATH}/api/character/:characterId/settings`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const characterId = req.params.characterId;
  const current = getCharacterSettings(userStore, characterId);
  const patch = req.body || {};
  userStore.characterSettings[characterId] = {
    ...current,
    ...(patch.notes !== undefined ? { notes: String(patch.notes) } : {}),
    ...(patch.modelOverride !== undefined ? { modelOverride: String(patch.modelOverride || '') } : {}),
    ...(patch.temperature !== undefined ? { temperature: Number.isFinite(Number(patch.temperature)) ? Number(patch.temperature) : current.temperature } : {}),
    ...(patch.maxTokens !== undefined ? { maxTokens: Number.isFinite(Number(patch.maxTokens)) ? Math.max(64, Math.min(8192, Math.round(Number(patch.maxTokens)))) : current.maxTokens } : {}),
    ...(patch.background !== undefined ? { background: String(patch.background || '') } : {}),
    ...(patch.backgroundSearch !== undefined ? { backgroundSearch: String(patch.backgroundSearch || '') } : {}),
    ...(patch.autoplayVoice !== undefined ? { autoplayVoice: Boolean(patch.autoplayVoice) } : {}),
    ...(patch.ttsEnabled !== undefined ? { autoplayVoice: Boolean(patch.ttsEnabled) } : {}),
    ...(patch.ttsProvider !== undefined ? { ttsProvider: String(patch.ttsProvider || 'fish') } : {}),
    ...(patch.fishReferenceId !== undefined ? { fishReferenceId: String(patch.fishReferenceId || '') } : {}),
    ...(patch.voiceLabel !== undefined ? { voiceLabel: String(patch.voiceLabel || '') } : {}),
    ...(patch.voiceMatchSource !== undefined ? { voiceMatchSource: String(patch.voiceMatchSource || '') } : {}),
    ...(patch.voiceMatchQuery !== undefined ? { voiceMatchQuery: String(patch.voiceMatchQuery || '') } : {}),
    ...(patch.voiceMatchReason !== undefined ? { voiceMatchReason: String(patch.voiceMatchReason || '') } : {}),
    ...(patch.ttsFormat !== undefined ? { ttsFormat: ['wav', 'pcm', 'mp3', 'opus'].includes(String(patch.ttsFormat || '').trim()) ? String(patch.ttsFormat || '').trim() : current.ttsFormat } : {}),
    ...(patch.ttsLatency !== undefined ? { ttsLatency: ['low', 'normal', 'balanced'].includes(String(patch.ttsLatency || '').trim()) ? String(patch.ttsLatency || '').trim() : current.ttsLatency } : {}),
    ...(patch.ttsPlaybackMode !== undefined ? { ttsPlaybackMode: ['stream', 'full'].includes(String(patch.ttsPlaybackMode || '').trim()) ? String(patch.ttsPlaybackMode || '').trim() : current.ttsPlaybackMode } : {}),
    ...(patch.ttsReadNarration !== undefined ? { ttsReadNarration: Boolean(patch.ttsReadNarration) } : {}),
  };
  await saveStore(store);
  res.json(userStore.characterSettings[characterId]);
});

app.get(`${BASE_PATH}/api/ui`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  res.json(userStore.ui || { backgroundFavorites: [] });
});

app.put(`${BASE_PATH}/api/ui`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const favorites = Array.isArray(req.body?.backgroundFavorites) ? req.body.backgroundFavorites.map(String) : userStore.ui.backgroundFavorites;
  userStore.ui = {
    ...(userStore.ui || {}),
    backgroundFavorites: Array.from(new Set(favorites)),
  };
  await saveStore(store);
  res.json(userStore.ui);
});

app.get(`${BASE_PATH}/api/preferences`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  res.json({ favorites: userStore.favorites || [], session: userStore.session || defaultUserData().session });
});

app.put(`${BASE_PATH}/api/preferences`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  if (Array.isArray(req.body?.favorites)) userStore.favorites = Array.from(new Set(req.body.favorites.map(String)));
  if (req.body?.session && typeof req.body.session === 'object') userStore.session = { ...userStore.session, ...req.body.session };
  await saveStore(store);
  res.json({ favorites: userStore.favorites || [], session: userStore.session || defaultUserData().session });
});

app.get(`${BASE_PATH}/api/conversations`, requireAuth, async (req, res) => {
  const { characterId, personaId } = req.query;
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  res.json({ conversations: getConversationList(userStore, String(characterId), String(personaId || '')) });
});

app.post(`${BASE_PATH}/api/conversations`, requireAuth, async (req, res) => {
  const { characterId, personaId, name } = req.body || {};
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const characters = listCharacters();
  const character = characters.find((item) => item.id === characterId);
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const list = userStore.conversations[key] || [];
  const conversation = createConversationRecord(name, character);
  list.unshift(conversation);
  userStore.conversations[key] = list;
  await saveStore(store);
  res.status(201).json({ conversation });
});

app.get(`${BASE_PATH}/api/conversations/:conversationId`, requireAuth, async (req, res) => {
  const { characterId, personaId } = req.query;
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(String(characterId), String(personaId || ''));
  const conversation = (userStore.conversations[key] || []).find((item) => item.id === req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ conversation });
});

app.put(`${BASE_PATH}/api/conversations/:conversationId`, requireAuth, async (req, res) => {
  const { characterId, personaId, name, messages } = req.body || {};
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const list = userStore.conversations[key] || [];
  const conversation = list.find((item) => item.id === req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  if (name !== undefined) conversation.name = String(name).trim() || conversation.name;
  if (messages !== undefined) {
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });
    conversation.messages = messages.map(normalizeStoredMessage);
    conversation.preview = conversation.messages[conversation.messages.length - 1]?.content?.slice(0, 120) || conversation.preview || '';
  }
  conversation.updatedAt = Date.now();
  userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  await saveStore(store);
  res.json({ conversation });
});

app.delete(`${BASE_PATH}/api/conversations/:conversationId`, requireAuth, async (req, res) => {
  const characterId = String(req.query.characterId || '');
  const personaId = String(req.query.personaId || '');
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const before = userStore.conversations[key] || [];
  userStore.conversations[key] = before.filter((item) => item.id !== req.params.conversationId);
  await saveStore(store);
  res.json({ ok: true, deleted: before.length !== userStore.conversations[key].length });
});

app.get(`${BASE_PATH}/api/conversations/:conversationId/memory`, requireAuth, async (req, res) => {
  const characterId = String(req.query.characterId || '').trim();
  const personaId = String(req.query.personaId || '').trim();
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const characters = listCharacters();
  const character = characters.find((item) => item.id === characterId);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const conversation = (userStore.conversations[key] || []).find((item) => item.id === req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const memory = buildConversationMemoryBundle({ userStore, character, conversation });
  await saveStore(store);
  res.json(memory);
});

app.post(`${BASE_PATH}/api/conversations/:conversationId/memory`, requireAuth, async (req, res) => {
  const characterId = String(req.body?.characterId || '').trim();
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const memoryState = getConversationMemoryState(userStore, req.params.conversationId);
  const item = normalizeMemoryItem({
    type: req.body?.type || 'fact',
    text: req.body?.text,
    priority: req.body?.priority || 'medium',
    pinned: req.body?.pinned !== false,
    locked: req.body?.locked === true,
    source: 'manual',
  });
  if (!item.text) return res.status(400).json({ error: 'text is required' });
  memoryState.items.unshift(item);
  await saveStore(store);
  res.status(201).json({ item });
});

app.patch(`${BASE_PATH}/api/memory/:memoryId`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  ensureUserMemoryStore(userStore);
  let found = null;
  for (const conversationId of Object.keys(userStore.memory.conversations || {})) {
    const memoryState = getConversationMemoryState(userStore, conversationId);
    const item = memoryState.items.find((entry) => entry.id === req.params.memoryId);
    if (!item) continue;
    if (req.body?.text !== undefined) item.text = String(req.body.text || '').trim();
    if (req.body?.type !== undefined) item.type = normalizeMemoryType(req.body.type);
    if (req.body?.priority !== undefined) item.priority = normalizeMemoryPriority(req.body.priority);
    if (req.body?.pinned !== undefined) item.pinned = req.body.pinned === true;
    if (req.body?.locked !== undefined) item.locked = req.body.locked === true;
    if (req.body?.status !== undefined) item.status = String(req.body.status || item.status);
    item.updatedAt = Date.now();
    found = item;
    break;
  }
  if (!found) return res.status(404).json({ error: 'Memory item not found' });
  await saveStore(store);
  res.json({ item: found });
});

app.post(`${BASE_PATH}/api/memory/:memoryId/dismiss`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  ensureUserMemoryStore(userStore);
  for (const conversationId of Object.keys(userStore.memory.conversations || {})) {
    const memoryState = getConversationMemoryState(userStore, conversationId);
    const item = memoryState.items.find((entry) => entry.id === req.params.memoryId);
    if (item) {
      item.status = 'dismissed';
      item.updatedAt = Date.now();
      await saveStore(store);
      return res.json({ ok: true, item });
    }
  }
  const conversationId = String(req.body?.conversationId || '').trim();
  const characterId = String(req.body?.characterId || '').trim();
  const personaId = String(req.body?.personaId || '').trim();
  if (conversationId && characterId) {
    const key = getConversationBucketKey(characterId, personaId);
    const conversation = (userStore.conversations[key] || []).find((item) => item.id === conversationId);
    const character = listCharacters().find((item) => item.id === characterId);
    if (conversation && character) {
      const memoryState = getConversationMemoryState(userStore, conversationId);
      const bundle = buildConversationMemoryBundle({ userStore, character, conversation });
      const autoItem = (bundle.auto || []).find((entry) => entry.id === req.params.memoryId);
      if (autoItem) {
        memoryState.dismissedAutoTexts = Array.from(new Set([...(memoryState.dismissedAutoTexts || []), autoItem.text]));
        await saveStore(store);
        return res.json({ ok: true, dismissed: autoItem.text });
      }
    }
  }
  return res.status(404).json({ error: 'Memory item not found' });
});

app.post(`${BASE_PATH}/api/memory/:memoryId/promote`, requireAuth, async (req, res) => {
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const conversationId = String(req.body?.conversationId || '').trim();
  const characterId = String(req.body?.characterId || '').trim();
  const personaId = String(req.body?.personaId || '').trim();
  if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const memoryState = getConversationMemoryState(userStore, conversationId);
  const key = getConversationBucketKey(characterId, personaId);
  const conversation = (userStore.conversations[key] || []).find((item) => item.id === conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const character = listCharacters().find((item) => item.id === characterId);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const memoryBundle = buildConversationMemoryBundle({ userStore, character, conversation });
  const sourceItem = [...memoryState.items, ...(memoryBundle.auto || [])].find((entry) => entry.id === req.params.memoryId);
  if (!sourceItem) return res.status(404).json({ error: 'Memory item not found' });
  const promoted = normalizeMemoryItem({ ...sourceItem, id: `mem_${crypto.randomUUID()}`, pinned: true, source: 'manual', updatedAt: Date.now(), createdAt: Date.now() });
  memoryState.items.unshift(promoted);
  await saveStore(store);
  res.json({ ok: true, item: promoted });
});

app.post(`${BASE_PATH}/api/characters/:characterId/generate-image-prompt`, requireAuth, async (req, res) => {
  try {
    const characterId = String(req.params.characterId || '').trim();
    const conversationId = String(req.body?.conversationId || '').trim();
    const personaId = String(req.body?.personaId || '').trim();
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });

    const useAvatarReference = req.body?.useAvatarReference !== false;

    const store = await loadStore();
    const userStore = getUserStore(store, req.authUser.username);
    const characters = listCharacters();
    const personas = listPersonas();
    const character = characters.find((item) => item.id === characterId);
    const persona = personas.find((item) => item.id === personaId) || personas[0] || null;
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const key = getConversationBucketKey(characterId, personaId);
    const conversation = (userStore.conversations[key] || []).find((item) => item.id === conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const recentMessages = (conversation.messages || [])
      .filter((message) => !message?.pendingImageId)
      .slice(-18)
      .map((message) => ({ role: String(message.role || 'system'), content: compactPromptText('message', message.content || '', 900) }))
      .filter((message) => message.content);
    if (!recentMessages.length) return res.status(400).json({ error: 'Current conversation has no usable messages yet' });

    const appConfig = await loadAppConfig();
    const characterSettings = getCharacterSettings(userStore, characterId);
    const preferredModel = characterSettings.modelOverride || appConfig.endpoints.mainModel || appConfig.endpoints.defaultModel || DEFAULT_MODEL;
    const placeholderContext = { character, persona, authUser: req.authUser };
    const characterBlock = [
      `Character: ${replaceCharacterPlaceholders(character.name || 'Character', placeholderContext)}`,
      compactPromptText('character description', replaceCharacterPlaceholders(character.description || character.personality || character.scenario || '', placeholderContext), 1200),
      compactPromptText('persona', replaceCharacterPlaceholders(persona?.description || persona?.name || '', placeholderContext), 600),
    ].filter(Boolean).join('\n');
    const transcript = recentMessages.map((message) => `${message.role.toUpperCase()}: ${replaceCharacterPlaceholders(message.content, placeholderContext)}`).join('\n');
    const promptMessages = [
      {
        role: 'system',
        content: [
          'You write concise prompts for AI image generation based on roleplay chat context.',
          'Return ONLY the final image prompt. No markdown, no quote marks, no commentary.',
          useAvatarReference
            ? 'The character avatar reference image is the source of truth for appearance. Do NOT invent or guess new facial features, hair color, eye color, body type, outfit details, or other visual identity traits unless they are explicitly confirmed by the provided character text. Focus on pose, expression, action, framing, lighting, setting, props, and mood that fit the scene.'
            : 'Use concrete visual details: subject, pose, expression, outfit, setting, lighting, mood, camera/framing, and important relationship/context clues.',
          useAvatarReference
            ? 'When avatar reference is on, write a strong scene prompt centered on what is happening: body position, gesture, facial expression, camera angle, distance/framing, environment, important objects on the table or in the room, and lighting style. Keep appearance wording minimal and generic so the reference image controls likeness.'
            : 'Preserve character identity and scenario continuity.',
          useAvatarReference
            ? 'Prefer concise comma-separated prompt language over prose. Keep the best concrete scene beats; remove dialogue and avoid narrative filler.'
            : 'Do not include dialogue unless visible text is explicitly needed. Do not mention “current conversation” or “chat”.',
          'Do not include dialogue unless visible text is explicitly needed. Do not mention “current conversation” or “chat”.',
          'Keep it under 900 characters. Preserve scenario continuity.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Create one image-generation prompt from this context.\n\n${characterBlock}\n\nRecent conversation:\n${transcript}`,
      },
    ];

    const fallbackOverride1 = appConfig.endpoints.fallbackOverride1 || {};
    const fallbackOverride2 = appConfig.endpoints.fallbackOverride2 || {};
    const candidatePlans = [
      { provider: 'local', model: preferredModel },
      fallbackOverride1.enabled
        ? { provider: fallbackOverride1.provider || 'openrouter', model: fallbackOverride1.model, override: fallbackOverride1 }
        : { provider: appConfig.endpoints.fallbackProvider1 || 'local', model: appConfig.endpoints.fallbackModel1 },
      fallbackOverride2.enabled
        ? { provider: fallbackOverride2.provider || 'openrouter', model: fallbackOverride2.model, override: fallbackOverride2 }
        : { provider: appConfig.endpoints.fallbackProvider2 || 'local', model: appConfig.endpoints.fallbackModel2 },
      { provider: 'local', model: appConfig.endpoints.defaultModel || DEFAULT_MODEL },
    ].filter((item) => item.model);
    const seen = new Set();
    const candidateModels = candidatePlans.filter((item) => {
      const candidateKey = `${item.provider}:${item.model}`;
      if (seen.has(candidateKey)) return false;
      seen.add(candidateKey);
      return true;
    });

    let prompt = '';
    let usedModel = candidateModels[0]?.model || preferredModel;
    let usedProvider = candidateModels[0]?.provider || 'local';
    let lastFailure = '';
    for (const candidate of candidateModels) {
      usedModel = candidate.model;
      usedProvider = candidate.provider;
      try {
        const runtime = getProviderRuntimeConfig(candidate.provider, appConfig, candidate.override || null);
        if (candidate.provider !== 'local' && !runtime.apiKey) {
          lastFailure = `Provider ${candidate.provider} is missing an API key`;
          continue;
        }
        const response = await fetchBackend('/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            model: candidate.model,
            messages: promptMessages,
            temperature: 0.55,
            top_p: 0.9,
            stream: false,
          }),
        }, Math.min(appConfig.endpoints.requestTimeoutMs || 120000, 60000), candidate.provider, candidate.override || null);
        if (!response.ok) {
          const text = await response.text();
          lastFailure = `${candidate.provider}/${candidate.model}: ${text.slice(0, 500)}`;
          continue;
        }
        const json = await response.json();
        prompt = replaceCharacterPlaceholders(String(json?.choices?.[0]?.message?.content || '').trim(), placeholderContext)
          .replace(/^```[a-z]*\s*/i, '')
          .replace(/```$/i, '')
          .replace(/^['\"]|['\"]$/g, '')
          .trim();
        if (prompt) {
          if (useAvatarReference) prompt = sanitizeAvatarReferencePrompt(prompt);
          break;
        }
        lastFailure = `${candidate.provider}/${candidate.model}: empty response`;
      } catch (error) {
        lastFailure = `${candidate.provider}/${candidate.model}: ${String(error?.message || error)}`;
      }
    }

    if (!prompt) return res.status(502).json({ error: 'Prompt generation failed', detail: lastFailure || 'No provider returned a prompt' });
    res.json({ ok: true, prompt, model: usedModel, provider: usedProvider });
  } catch (error) {
    res.status(503).json({ error: 'Prompt generation unavailable', detail: String(error?.message || error) });
  }
});

app.post(`${BASE_PATH}/api/characters/:characterId/generate-image`, requireAuth, async (req, res) => {
  const character = listCharacters().find((item) => item.id === req.params.characterId);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  const conversationId = String(req.body?.conversationId || '').trim();
  const personaId = String(req.body?.personaId || '').trim();
  const pendingImageId = String(req.body?.pendingImageId || '').trim();
  const requestedModelInput = String(req.body?.imageModel || req.body?.model || OPENAI_IMAGE_MODEL).trim();
  const requestedModel = ALLOWED_IMAGE_GENERATION_MODELS.has(requestedModelInput) ? requestedModelInput : OPENAI_IMAGE_MODEL;

  const useAvatarReference = req.body?.useAvatarReference !== false;
  const uploadedReferenceImages = Array.isArray(req.body?.referenceImages) ? req.body.referenceImages : [];
  let referenceUrl = '';
  if (useAvatarReference) {
    referenceUrl = await saveReplicateReferenceFromCharacter(character, req).catch((error) => {
      console.error('image reference error', req.params.characterId, error?.message || error);
      return '';
    });
    if (!referenceUrl && !uploadedReferenceImages.length) return res.status(422).json({ error: 'Character avatar is not available for image generation' });
  }
  if (!useAvatarReference && !uploadedReferenceImages.length) return res.status(422).json({ error: 'At least one reference image is required' });

  const aspectRatio = String(req.body?.aspectRatio || '4:5').trim();
  const aspectMap = {
    '1:1': [1024, 1024, '1024x1024'],
    '2:3': [1024, 1536, '1024x1536'],
    '3:4': [1024, 1536, '1024x1536'],
    '4:5': [1024, 1536, '1024x1536'],
    '9:16': [1024, 1536, '1024x1536'],
    '16:9': [1536, 1024, '1536x1024'],
  };
  const [width, height, openAiSize] = aspectMap[aspectRatio] || [1024, 1536, '1024x1536'];

  const safePrompt = prompt
    .replace(/\b(nsfw|nude|naked|lingerie|underwear|seductive|sensual|mature content)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const likenessPrompt = useAvatarReference
    ? 'Preserve the exact same character identity from the reference image: same face, hair, eye color, skin tone, outfit details, silhouette, and overall design. Do not invent a different character.'
    : '';
  const negativePrompt = [
    'nsfw, nude, underwear, exposed skin, cleavage',
    String(req.body?.negativePrompt || ''),
    'monochrome, lowres, bad anatomy, worst quality, low quality, blurry',
  ].filter(Boolean).join(', ');
  const styleLabel = String(req.body?.style || '').trim();
  const originalPrompt = String(req.body?.originalPrompt || prompt);
  const username = req.authUser.username;

  const runGeneration = async () => {
    let finalImageUrl = '';
    let remoteUrl = '';
    let providerMeta = {};

    const generationPrompt = [safePrompt || prompt, likenessPrompt, negativePrompt ? `Avoid: ${negativePrompt}` : ''].filter(Boolean).join('\n');
    const result = await createOpenAiImageEdit({
      prompt: generationPrompt,
      size: openAiSize,
      imageUrl: referenceUrl,
      referenceImages: uploadedReferenceImages,
      outputFormat: 'png',
      quality: 'medium',
      aspectRatio,
      imageModel: requestedModel,
      preferReferenceFidelity: useAvatarReference,
    });
    const dataUrl = `data:${result.mimeType};base64,${result.b64}`;
    const assetPrefix = result.provider === 'openrouter' ? 'openrouter' : 'openai';
    const localUrl = await saveMessageImageAsset(dataUrl, req, `${assetPrefix}-${req.params.characterId}-${Date.now().toString(36)}`);
    if (!localUrl) throw new Error('Image save failed');
    finalImageUrl = localUrl;
    providerMeta = { model: requestedModel, revisedPrompt: result.revisedPrompt || '', provider: result.provider || 'openai', providerModel: result.providerModel || requestedModel };


    if (conversationId) {
      const store = await loadStore();
      const userStore = getUserStore(store, username);
      if (pendingImageId) {
        replacePendingImageMessage(userStore, {
          characterId: req.params.characterId,
          personaId,
          conversationId,
          pendingImageId,
          nextMessage: {
            role: 'assistant',
            content: buildGeneratedImageCaption({ prompt: originalPrompt, styleLabel: styleLabel === 'default' ? '' : styleLabel }),
            images: [{ url: finalImageUrl, name: 'generated-image', type: 'image/png' }],
          },
        });
      } else {
        await appendGeneratedImageToConversation(userStore, {
          characterId: req.params.characterId,
          personaId,
          conversationId,
          imageUrl: finalImageUrl,
          prompt: originalPrompt,
          styleLabel: styleLabel === 'default' ? '' : styleLabel,
        });
      }
      await saveStore(store);
    }

    return { ok: true, imageUrl: finalImageUrl, remoteUrl, ...providerMeta };
  };

  if (conversationId && pendingImageId) {
    runGeneration().then(() => {
      console.log('generate-image async completed', { characterId: req.params.characterId, conversationId, pendingImageId });
    }).catch(async (error) => {
      console.error('generate-image async error', {
        characterId: req.params.characterId,
        model: requestedModel,
        message: error?.message || error,
        name: error?.name || '',
        cause: error?.cause ? String(error.cause) : '',
      });
      try {
        const store = await loadStore();
        const userStore = getUserStore(store, username);
        replacePendingImageMessage(userStore, {
          characterId: req.params.characterId,
          personaId,
          conversationId,
          pendingImageId,
          nextMessage: { role: 'assistant', content: `Image generation failed: ${String(error?.message || 'Image generation failed')}` },
        });
        await saveStore(store);
      } catch (persistError) {
        console.error('generate-image async persist error', String(persistError?.message || persistError));
      }
    });
    return res.status(202).json({ ok: true, queued: true, pendingImageId, conversationId });
  }

  try {
    return res.json(await runGeneration());
  } catch (error) {
    console.error('generate-image error', {
      characterId: req.params.characterId,
      model: requestedModel,
      message: error?.message || error,
      name: error?.name || '',
      cause: error?.cause ? String(error.cause) : '',
    });
    const message = String(error?.message || 'Image generation failed');
    const status = /usage limit|throttled|rate limit|429/i.test(message)
      ? 429
      : /not configured/i.test(message)
        ? 503
        : /timeout|timed out|abort/i.test(message)
          ? 504
          : 502;
    return res.status(status).json({ error: message });
  }
});

app.post(`${BASE_PATH}/api/conversations/:conversationId/memory/refresh`, requireAuth, async (req, res) => {
  const characterId = String(req.body?.characterId || req.query.characterId || '').trim();
  const personaId = String(req.body?.personaId || req.query.personaId || '').trim();
  if (!characterId) return res.status(400).json({ error: 'characterId is required' });
  const characters = listCharacters();
  const character = characters.find((item) => item.id === characterId);
  if (!character) return res.status(404).json({ error: 'Character not found' });
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const conversation = (userStore.conversations[key] || []).find((item) => item.id === req.params.conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  const memory = buildConversationMemoryBundle({ userStore, character, conversation });
  await saveStore(store);
  res.json(memory);
});

app.post(`${BASE_PATH}/api/characters/:characterId/memory-seeds`, requireAuth, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const seeds = getCharacterMemorySeeds(userStore, req.params.characterId);
  for (const raw of items) {
    const item = normalizeMemoryItem({
      type: raw?.type || 'canon',
      text: raw?.text,
      priority: raw?.priority || 'high',
      pinned: true,
      locked: raw?.locked !== false,
      source: 'seed',
    });
    if (item.text) seeds.push(item);
  }
  userStore.memory.seeds[req.params.characterId] = seeds;
  await saveStore(store);
  res.status(201).json({ items: seeds });
});

app.post(`${BASE_PATH}/api/personas`, requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const isDefault = req.body?.isDefault === true;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const baseSlug = slugify(name) || 'persona';
  let fileName = `${baseSlug}.png`;
  let attempt = 2;
  while (fs.existsSync(path.join(PERSONAS_DIR, fileName))) {
    fileName = `${baseSlug}-${attempt}.png`;
    attempt += 1;
  }

  await fsp.mkdir(PERSONAS_DIR, { recursive: true });
  const avatarSvg = defaultAvatarDataUrl(name);
  const avatar = dataUrlToBuffer(avatarSvg);
  if (!avatar) return res.status(500).json({ error: 'Failed to generate persona avatar' });
  await fsp.writeFile(path.join(PERSONAS_DIR, fileName), avatar.buffer);

  const settings = readJsonSafe(SETTINGS_PATH, {});
  if (!settings.power_user || typeof settings.power_user !== 'object') settings.power_user = {};
  if (!settings.power_user.personas || typeof settings.power_user.personas !== 'object') settings.power_user.personas = {};
  if (!settings.power_user.persona_descriptions || typeof settings.power_user.persona_descriptions !== 'object') settings.power_user.persona_descriptions = {};

  settings.power_user.personas[fileName] = name;
  settings.power_user.persona_descriptions[fileName] = {
    ...(settings.power_user.persona_descriptions[fileName] || {}),
    description,
  };
  if (isDefault) settings.power_user.default_persona = fileName;
  saveSettingsJson(settings);

  const created = listPersonas().find((item) => item.id === fileName) || null;
  res.status(201).json({ ok: true, persona: created });
});

app.put(`${BASE_PATH}/api/personas/:personaId`, requireAuth, async (req, res) => {
  const personaId = String(req.params.personaId || '').trim();
  if (!personaId) return res.status(400).json({ error: 'personaId is required' });
  const personas = listPersonas();
  const persona = personas.find((item) => item.id === personaId);
  if (!persona) return res.status(404).json({ error: 'Persona not found' });

  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const isDefault = req.body?.isDefault === true;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const settings = readJsonSafe(SETTINGS_PATH, {});
  if (!settings.power_user || typeof settings.power_user !== 'object') settings.power_user = {};
  if (!settings.power_user.personas || typeof settings.power_user.personas !== 'object') settings.power_user.personas = {};
  if (!settings.power_user.persona_descriptions || typeof settings.power_user.persona_descriptions !== 'object') settings.power_user.persona_descriptions = {};

  settings.power_user.personas[personaId] = name;
  settings.power_user.persona_descriptions[personaId] = {
    ...(settings.power_user.persona_descriptions[personaId] || {}),
    description,
  };
  if (isDefault) settings.power_user.default_persona = personaId;
  else if (settings.power_user.default_persona === personaId) settings.power_user.default_persona = '';

  saveSettingsJson(settings);
  const updated = listPersonas().find((item) => item.id === personaId) || null;
  res.json({ ok: true, persona: updated });
});

app.get(`${BASE_PATH}/api/nexus/health`, requireNexusApiAccess, async (req, res) => {
  res.json({ ok: true, service: 'nexus-api', backendReachable: true, authMode: req.nexusAuthMode || 'session' });
});

app.get(`${BASE_PATH}/api/nexus/characters`, requireNexusApiAccess, async (_req, res) => {
  const characters = listCharacters().map((character) => ({
    id: character.id,
    name: character.name,
    summary: character.summary || character.shortDescription || 'Ready to chat.',
    avatar: character.imageUrl,
    tags: Array.isArray(character.tags) ? character.tags : [],
    source: character.source || 'unknown',
  }));
  res.json({ ok: true, characters });
});

app.post(`${BASE_PATH}/api/nexus/histories`, requireNexusApiAccess, async (req, res) => {
  const characterId = String(req.body?.characterId || '').trim();
  const personaId = String(req.body?.personaId || '').trim();
  const name = String(req.body?.name || '').trim();
  if (!characterId) return res.status(400).json({ ok: false, error: 'characterId is required' });

  const characters = listCharacters();
  const character = characters.find((item) => item.id === characterId);
  if (!character) return res.status(404).json({ ok: false, error: 'Character not found' });

  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const key = getConversationBucketKey(characterId, personaId);
  const list = userStore.conversations[key] || [];
  const conversation = createConversationRecord(name, character);
  list.unshift(conversation);
  userStore.conversations[key] = list;
  await saveStore(store);

  res.status(201).json({ ok: true, ...serializeNexusHistory(conversation, characterId, personaId) });
});

app.get(`${BASE_PATH}/api/nexus/histories/:historyId`, requireNexusApiAccess, async (req, res) => {
  const characterId = String(req.query.characterId || '').trim();
  const personaId = String(req.query.personaId || '').trim();
  const store = await loadStore();
  const userStore = getUserStore(store, req.authUser.username);
  const entry = findConversationEntry(userStore, String(req.params.historyId || '').trim(), characterId, personaId);
  if (!entry) return res.status(404).json({ ok: false, error: 'History not found' });
  res.json({ ok: true, history: serializeNexusHistory(entry.conversation, entry.characterId, entry.personaId) });
});

app.post(`${BASE_PATH}/api/nexus/chat`, requireNexusApiAccess, async (req, res) => {
  try {
    const characterId = String(req.body?.characterId || '').trim();
    const personaId = String(req.body?.personaId || '').trim();
    const historyId = String(req.body?.historyId || req.body?.conversationId || '').trim();
    const createHistory = req.body?.createHistory === true;
    const requestedName = String(req.body?.name || '').trim();
    const model = req.body?.model;
    const temperature = req.body?.temperature;
    const wantsStream = req.body?.stream === true;

    if (!characterId) return res.status(400).json({ ok: false, error: 'characterId is required' });

    const store = await loadStore();
    const userStore = getUserStore(store, req.authUser.username);

    let entry = null;
    let historyMessages = [];
    let effectivePersonaId = personaId;

    if (historyId) {
      if (req.body?.message === undefined) {
        return res.status(400).json({ ok: false, error: 'message is required when historyId is provided' });
      }
      entry = findConversationEntry(userStore, historyId, characterId, personaId);
      if (!entry) return res.status(404).json({ ok: false, error: 'History not found' });
      historyMessages = Array.isArray(entry.conversation.messages) ? entry.conversation.messages.map(normalizeStoredMessage) : [];
      effectivePersonaId = entry.personaId || effectivePersonaId;
    }

    const inputMessages = normalizeNexusInputMessages({ historyMessages, message: req.body?.message, messages: req.body?.messages });

    let createdHistory = false;
    let outputHistoryId = historyId || '';

    const persistConversation = async (assistantContent, generationCharacter) => {
      if (entry) {
        entry.conversation.messages = [...inputMessages, { role: 'assistant', content: assistantContent }].map(normalizeStoredMessage);
        entry.conversation.preview = assistantContent.slice(0, 120) || entry.conversation.preview;
        entry.conversation.updatedAt = Date.now();
        const list = userStore.conversations[entry.bucketKey] || [];
        userStore.conversations[entry.bucketKey] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        outputHistoryId = entry.conversation.id;
        await saveStore(store);
        return;
      }
      if (createHistory) {
        const key = getConversationBucketKey(characterId, effectivePersonaId);
        const list = userStore.conversations[key] || [];
        const conversation = createConversationRecord(requestedName, generationCharacter);
        conversation.messages = [...inputMessages, { role: 'assistant', content: assistantContent }].map(normalizeStoredMessage);
        conversation.preview = assistantContent.slice(0, 120) || conversation.preview;
        conversation.updatedAt = Date.now();
        list.unshift(conversation);
        userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        outputHistoryId = conversation.id;
        createdHistory = true;
        await saveStore(store);
      }
    };

    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const generation = await generateCharacterReply({
        userStore,
        authUser: req.authUser,
        characterId,
        personaId: effectivePersonaId,
        messages: inputMessages,
        model,
        temperature,
        stream: true,
        onMeta: (payload) => writeStreamEvent(res, 'meta', payload),
        onRetry: (payload) => writeStreamEvent(res, 'retry', payload),
        onDelta: (delta) => writeStreamEvent(res, 'delta', { delta }),
      });
      await persistConversation(generation.content, generation.character);
      writeStreamEvent(res, 'done', {
        ok: true,
        historyId: outputHistoryId || undefined,
        characterId,
        personaId: effectivePersonaId || '',
        response: generation.content,
        model: generation.model,
        provider: generation.provider,
        createdHistory,
        usage: { messageCount: inputMessages.length + 1 },
        attemptedModels: generation.attemptedModels,
      });
      return res.end();
    }

    const generation = await generateCharacterReply({
      userStore,
      authUser: req.authUser,
      characterId,
      personaId: effectivePersonaId,
      messages: inputMessages,
      model,
      temperature,
    });

    await persistConversation(generation.content, generation.character);

    res.json({
      ok: true,
      historyId: outputHistoryId || undefined,
      characterId,
      personaId: effectivePersonaId || '',
      response: generation.content,
      model: generation.model,
      provider: generation.provider,
      createdHistory,
      usage: {
        messageCount: inputMessages.length + 1,
      },
      attemptedModels: generation.attemptedModels,
    });
  } catch (error) {
    if (error?.payload) {
      if (req.body?.stream === true) {
        writeStreamEvent(res, 'error', { ok: false, ...error.payload });
        return res.end();
      }
      return res.status(error.statusCode || 502).json({ ok: false, ...error.payload });
    }
    if (error?.statusCode) {
      if (req.body?.stream === true) {
        writeStreamEvent(res, 'error', { ok: false, error: String(error.message || error) });
        return res.end();
      }
      return res.status(error.statusCode).json({ ok: false, error: String(error.message || error) });
    }
    if (String(error?.message || '').includes('Either message or messages is required')
      || String(error?.message || '').includes('Provide either message or messages, not both')
      || String(error?.message || '').includes('messages')) {
      if (req.body?.stream === true) {
        writeStreamEvent(res, 'error', { ok: false, error: String(error.message || error) });
        return res.end();
      }
      return res.status(400).json({ ok: false, error: String(error.message || error) });
    }
    if (req.body?.stream === true) {
      writeStreamEvent(res, 'error', { ok: false, error: 'Backend unavailable', detail: String(error?.message || error), backendReachable: false });
      return res.end();
    }
    res.status(503).json({ ok: false, error: 'Backend unavailable', detail: String(error?.message || error), backendReachable: false });
  }
});

function guessAudioContentType(filename = 'audio.webm') {
  const lower = String(filename || '').trim().toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.mp4')) return 'audio/mp4';
  return 'application/octet-stream';
}

async function transcribeWithFish(audioBuffer, filename = 'audio.webm', apiKey = '', language = '') {
  const key = String(apiKey || FISH_AUDIO_API_KEY || '').trim();
  if (!key) throw Object.assign(new Error('Fish Audio API key is required'), { statusCode: 400 });
  const fishAudio = new FishAudioClient({ apiKey: key, baseUrl: FISH_AUDIO_BASE_URL });
  const request = {
    audio: new File([audioBuffer], String(filename || 'audio.webm'), { type: guessAudioContentType(filename) }),
  };
  const sttLanguage = String(language || '').trim();
  if (sttLanguage && sttLanguage !== 'auto' && sttLanguage !== 'universal') request.language = sttLanguage;
  const result = await fishAudio.speechToText.convert(request);
  return String(result?.text || '').trim();
}

async function transcribeWithOpenAi(audioBuffer, filename = 'audio.webm', apiKey = '', language = '') {
  const key = String(apiKey || '').trim();
  if (!key) throw Object.assign(new Error('OpenAI API key is required'), { statusCode: 400 });
  const form = new FormData();
  form.set('model', 'whisper-1');
  const sttLanguage = String(language || '').trim();
  if (sttLanguage && sttLanguage !== 'auto' && sttLanguage !== 'universal') form.set('language', sttLanguage);
  form.set('file', new Blob([audioBuffer], { type: guessAudioContentType(filename) }), String(filename || 'audio.webm'));
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.error?.message || data?.message || `OpenAI STT failed (${response.status})`), { statusCode: response.status || 502 });
  }
  return String(data.text || '').trim();
}

async function transcribeWithElevenLabs(audioBuffer, filename = 'audio.webm', apiKey = '', language = '') {
  const key = String(apiKey || '').trim();
  if (!key) throw Object.assign(new Error('ElevenLabs API key is required'), { statusCode: 400 });
  const wavBuffer = await convertAudioBufferToWavInput(audioBuffer, filename);
  const form = new FormData();
  form.set('model_id', 'scribe_v1');
  const sttLanguage = String(language || '').trim();
  if (sttLanguage && sttLanguage !== 'auto' && sttLanguage !== 'universal') form.set('language_code', sttLanguage);
  form.set('file', new Blob([wavBuffer], { type: 'audio/wav' }), filename.replace(/\.[^.]+$/, '') + '.wav');
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.detail?.message || data?.message || `ElevenLabs STT failed (${response.status})`), { statusCode: response.status || 502 });
  }
  return String(data.text || '').trim();
}

app.post(`${BASE_PATH}/api/stt/transcribe`, express.raw({ type: () => true, limit: '25mb' }), async (req, res) => {
  try {
    const rawProvider = String(req.headers['x-stt-provider'] || req.query.provider || 'fish').trim().toLowerCase();
    const provider = rawProvider === 'openai' || rawProvider === 'elevenlabs' ? rawProvider : 'fish';
    const filename = String(req.headers['x-stt-filename'] || req.query.filename || 'audio.webm').trim() || 'audio.webm';
    const language = String(req.headers['x-stt-language'] || req.query.language || '').trim();
    const audioBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!audioBuffer.length) return res.status(400).json({ ok: false, error: 'Audio body is required' });

    const text = provider === 'elevenlabs'
      ? await transcribeWithElevenLabs(audioBuffer, filename, req.headers['x-elevenlabs-api-key'] || req.query.elevenlabsApiKey || '', language)
      : provider === 'openai'
        ? await transcribeWithOpenAi(audioBuffer, filename, req.headers['x-openai-api-key'] || req.query.openaiApiKey || '', language)
        : await transcribeWithFish(audioBuffer, filename, req.headers['x-fish-api-key'] || req.query.fishApiKey || '', language);

    res.json({ ok: true, provider, language, text });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: 'STT failed', detail: String(error?.message || error) });
  }
});

app.post(`${BASE_PATH}/api/tts/tag`, requireNexusApiAccess, async (req, res) => {
  try {
    const { text, characterId, includeAsteriskNarration } = req.body || {};
    const rawText = String(text || '').trim();
    if (!rawText) return res.status(400).json({ ok: false, error: 'text is required' });

    let character = null;
    let settings = { ttsReadNarration: includeAsteriskNarration === true };

    if (characterId) {
      character = listCharacters().find((item) => item.id === characterId) || null;
      if (!character) return res.status(404).json({ ok: false, error: 'Character not found' });

      if (req.authUser?.username) {
        const store = await loadStore();
        const userStore = getUserStore(store, req.authUser.username);
        settings = { ...getCharacterSettings(userStore, characterId), ttsReadNarration: includeAsteriskNarration === true || getCharacterSettings(userStore, characterId).ttsReadNarration === true };
      }
    }

    const result = await tagTtsText({ text: rawText, character, settings });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, error: 'Tagging failed', detail: String(error?.message || error) });
  }
});

app.post(`${BASE_PATH}/api/tts/audio`, requireNexusApiAccess, async (req, res) => {
  try {
    if (!isFishConfigured()) return res.status(503).json({ ok: false, error: 'TTS unavailable', detail: 'Fish Audio is not configured on the server.' });

    const { text, voiceId, fishReferenceId, referenceId, format, latency, includeAsteriskNarration, characterId, stream } = req.body || {};
    const rawText = String(text || '').trim();
    const requestedVoiceId = String(voiceId || fishReferenceId || referenceId || '').trim();
    if (!rawText) return res.status(400).json({ ok: false, error: 'text is required' });
    if (!requestedVoiceId) return res.status(400).json({ ok: false, error: 'voiceId is required' });

    const character = characterId ? (listCharacters().find((item) => item.id === characterId) || null) : null;
    if (characterId && !character) return res.status(404).json({ ok: false, error: 'Character not found' });

    const settings = buildDirectFishTtsSettings({ voiceId: requestedVoiceId, format, latency, includeAsteriskNarration });
    const tagResult = await tagTtsText({ text: rawText, character, settings });
    const payload = buildFishTtsPayload({ text: tagResult.taggedText, settings });
    const cacheKey = getTtsCacheKey({ text: tagResult.taggedText, characterId: `voice:${requestedVoiceId}`, settings });
    const cachePath = getCachedAudioPath(cacheKey, payload.format);

    try {
      const cached = await fsp.readFile(cachePath);
      res.setHeader('Content-Type', getTtsContentType(payload.format));
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      setTaggedAudioHeaders(res, { taggedText: tagResult.taggedText, tags: tagResult.tags, spokenText: tagResult.spokenText, mode: 'cache' });
      return res.send(cached);
    } catch {}

    if (stream === true) {
      try {
        setTaggedAudioHeaders(res, { taggedText: tagResult.taggedText, tags: tagResult.tags, spokenText: tagResult.spokenText, mode: 'stream' });
        const streamedBuffer = await streamFishTtsToResponse({ text: tagResult.taggedText, settings, res });
        if (streamedBuffer?.length) {
          await fsp.writeFile(cachePath, streamedBuffer).catch(() => {});
          pruneAudioCache().catch(() => {});
        }
        return;
      } catch (streamError) {
        if (res.headersSent) throw streamError;
        console.error('Fish direct stream failed, falling back to HTTP TTS:', streamError);
      }
    }

    const audio = await callFishTTS(payload);
    await fsp.writeFile(cachePath, audio.buffer);
    pruneAudioCache().catch(() => {});
    res.setHeader('Content-Type', audio.contentType || getTtsContentType(payload.format));
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    setTaggedAudioHeaders(res, { taggedText: tagResult.taggedText, tags: tagResult.tags, spokenText: tagResult.spokenText, mode: 'full' });
    res.send(audio.buffer);
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.statusCode || 503).json({ ok: false, error: 'TTS unavailable', detail: String(error?.message || error) });
      return;
    }
    try { res.end(); } catch {}
  }
});

app.post(`${BASE_PATH}/api/tts`, requireAuth, async (req, res) => {
  try {
    if (!isFishConfigured()) return res.status(503).json({ error: 'TTS unavailable', detail: 'Fish Audio is not configured on the server.' });

    const { characterId, text, stream, includeAsteriskNarration } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const character = listCharacters().find((item) => item.id === characterId);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    const rawText = String(text || '').trim();

    const store = await loadStore();
    const userStore = getUserStore(store, req.authUser.username);
    const settings = {
      ...getCharacterSettings(userStore, characterId),
      ...(includeAsteriskNarration !== undefined ? { ttsReadNarration: includeAsteriskNarration === true } : {}),
    };

    const ttsResult = await maybeAddTtsEmotionTags({ text: rawText, character, settings });
    const ttsText = ttsResult.text;
    const ttsTag = String(ttsResult.tag || '').trim();
    if ((settings.ttsProvider || 'fish') !== 'fish') return res.status(422).json({ error: 'TTS unavailable', detail: 'Unsupported TTS provider for this character.' });
    if (!String(settings.fishReferenceId || '').trim()) return res.status(422).json({ error: 'TTS unavailable', detail: 'Character voice is not configured.' });

    const payload = buildFishTtsPayload({ text: ttsText, settings });
    const cacheKey = getTtsCacheKey({ text: ttsText, characterId, settings });
    const cachePath = getCachedAudioPath(cacheKey, payload.format);
    try {
      const cached = await fsp.readFile(cachePath);
      res.setHeader('Content-Type', getTtsContentType(payload.format));
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      setTaggedAudioHeaders(res, { taggedText: ttsText, tags: parseTtsEmotionTags(ttsText), spokenText: cleanTtsSpeechText(stripRpNarrationForTts(rawText, { includeAsteriskNarration: settings.ttsReadNarration === true })), mode: 'cache' });
      return res.send(cached);
    } catch {}

    if (stream === true) {
      try {
        const streamedBuffer = await streamFishTtsToResponse({ text: ttsText, settings, res });
        if (streamedBuffer?.length) {
          await fsp.writeFile(cachePath, streamedBuffer).catch(() => {});
          pruneAudioCache().catch(() => {});
        }
        return;
      } catch (streamError) {
        if (res.headersSent) throw streamError;
        console.error('Fish realtime stream failed, falling back to HTTP TTS:', streamError);
      }
    }

    const audio = await callFishTTS(payload);
    await fsp.writeFile(cachePath, audio.buffer);
    pruneAudioCache().catch(() => {});
    res.setHeader('Content-Type', audio.contentType || getTtsContentType(payload.format));
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    setTaggedAudioHeaders(res, { taggedText: ttsText, tags: parseTtsEmotionTags(ttsText), spokenText: cleanTtsSpeechText(stripRpNarrationForTts(rawText, { includeAsteriskNarration: settings.ttsReadNarration === true })), mode: 'full' });
    res.send(audio.buffer);
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.statusCode || 503).json({ error: 'TTS unavailable', detail: String(error?.message || error) });
      return;
    }
    try { res.end(); } catch {}
  }
});

app.post(`${BASE_PATH}/api/chat`, requireAuth, async (req, res) => {
  try {
    const { characterId, personaId, conversationId, messages, model, temperature } = req.body || {};
    const characters = listCharacters();
    const personas = listPersonas();
    const character = characters.find((c) => c.id === characterId);
    const persona = personas.find((p) => p.id === personaId) || personas[0] || null;

    if (!character) return res.status(400).json({ error: 'Character not found' });
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Messages are required' });

    const resolvedMessages = await resolveMessageImagesForBackend(messages, req);
    const store = await loadStore();
    const userStore = getUserStore(store, req.authUser.username);

    if (isAssistantCharacter(character)) {
      const assistantConfig = normalizeAssistantConfig(character.assistantConfig || {});
      const key = getConversationBucketKey(characterId, personaId);
      const list = userStore.conversations[key] || [];
      const conversation = conversationId ? list.find((item) => item.id === conversationId) : null;
      if (!conversation) {
        return res.status(400).json({ error: 'Assistant conversations must be created before sending messages' });
      }

      applyCharacterTypeToConversation(conversation, character);
      conversation.bridge = {
        ...(conversation.bridge || {}),
        kind: 'openclaw',
        status: 'thinking',
        sessionKey: String(conversation.bridge?.sessionKey || makeAssistantSessionKey({ authUser: req.authUser, character, conversation })).trim(),
        lastError: '',
        createdAt: conversation.bridge?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      conversation.assistantMeta = {
        ...(conversation.assistantMeta || {}),
        ...buildAssistantConversationMeta(character),
        bridgeStatus: 'thinking',
        bridgeSessionKey: conversation.bridge.sessionKey,
        lastError: '',
        lastUsedAt: Date.now(),
      };
      await saveStore(store);

      const finalizeAssistantConversation = async (assistantContent, extra = {}) => {
        conversation.messages = [...resolvedMessages, { role: 'assistant', content: assistantContent }].map(normalizeStoredMessage);
        conversation.preview = assistantContent.slice(0, 120) || conversation.preview;
        conversation.updatedAt = Date.now();
        conversation.bridge = {
          ...(conversation.bridge || {}),
          kind: 'openclaw',
          status: extra.status || 'idle',
          sessionKey: conversation.bridge.sessionKey,
          lastError: String(extra.lastError || ''),
          createdAt: conversation.bridge.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        conversation.assistantMeta = {
          ...(conversation.assistantMeta || {}),
          ...buildAssistantConversationMeta(character),
          bridgeStatus: conversation.bridge.status,
          bridgeSessionKey: conversation.bridge.sessionKey,
          lastError: String(extra.lastError || ''),
          lastUsedAt: Date.now(),
        };
        userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        await saveStore(store);
      };

      try {
        const result = await runOpenClawAssistantTurn({
          sessionKey: conversation.bridge.sessionKey,
          character,
          persona,
          authUser: req.authUser,
          userMessage: getMessageText(resolvedMessages[resolvedMessages.length - 1] || {}),
          thinking: assistantConfig.thinking || 'low',
        });
        const content = replaceCharacterPlaceholders(result.text, { character, persona, authUser: req.authUser });
        await finalizeAssistantConversation(content, { status: 'idle' });
        return res.json({
          content,
          model: 'openclaw-agent',
          provider: 'openclaw',
          temperature: null,
          characterType: 'assistant',
          assistantMeta: conversation.assistantMeta,
          bridge: getConversationBridgeMeta(conversation),
          raw: result.raw,
        });
      } catch (error) {
        const detail = String(error?.detail || error?.message || error || 'OpenClaw bridge failed');
        conversation.bridge = {
          ...(conversation.bridge || {}),
          kind: 'openclaw',
          status: 'error',
          sessionKey: conversation.bridge.sessionKey,
          lastError: detail,
          createdAt: conversation.bridge.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        conversation.assistantMeta = {
          ...(conversation.assistantMeta || {}),
          ...buildAssistantConversationMeta(character),
          bridgeStatus: 'error',
          bridgeSessionKey: conversation.bridge.sessionKey,
          lastError: detail,
          lastUsedAt: Date.now(),
        };
        await saveStore(store);
        return res.status(502).json({
          error: 'OpenClaw assistant failed',
          detail,
          characterType: 'assistant',
          assistantMeta: conversation.assistantMeta,
          bridge: getConversationBridgeMeta(conversation),
        });
      }
    }

    const appConfig = await loadAppConfig();
    const characterSettings = getCharacterSettings(userStore, characterId);
    const preferredModel = model || characterSettings.modelOverride || appConfig.endpoints.mainModel || appConfig.endpoints.defaultModel || DEFAULT_MODEL;
    const fallbackOverride1 = appConfig.endpoints.fallbackOverride1 || {};
    const fallbackOverride2 = appConfig.endpoints.fallbackOverride2 || {};
    const candidatePlans = [
      { provider: 'local', model: preferredModel },
      fallbackOverride1.enabled
        ? { provider: fallbackOverride1.provider || 'openrouter', model: fallbackOverride1.model, override: fallbackOverride1 }
        : { provider: appConfig.endpoints.fallbackProvider1 || 'local', model: appConfig.endpoints.fallbackModel1 },
      fallbackOverride2.enabled
        ? { provider: fallbackOverride2.provider || 'openrouter', model: fallbackOverride2.model, override: fallbackOverride2 }
        : { provider: appConfig.endpoints.fallbackProvider2 || 'local', model: appConfig.endpoints.fallbackModel2 },
      { provider: 'local', model: appConfig.endpoints.defaultModel || DEFAULT_MODEL },
    ].filter((item) => item.model);
    const dedupedKeys = new Set();
    const candidateModels = candidatePlans.filter((item) => {
      const key = `${item.provider}:${item.model}`;
      if (dedupedKeys.has(key)) return false;
      dedupedKeys.add(key);
      return true;
    });
    const effectiveTemperature = typeof temperature === 'number' ? temperature : characterSettings.temperature;

    const placeholderContext = { character, persona, authUser: req.authUser };
    const systemPrompt = { role: 'system', content: buildSystemPrompt(character, persona, characterSettings.notes, '', req.authUser) };

    let json = null;
    let content = '';
    let usedModel = candidateModels[0]?.model;
    let usedProvider = candidateModels[0]?.provider || 'local';
    let lastFailure = null;

    const wantsStream = req.body?.stream === true;
    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      for (const candidate of candidateModels) {
        usedModel = candidate.model;
        usedProvider = candidate.provider;
        try {
          const runtime = getProviderRuntimeConfig(candidate.provider, appConfig, candidate.override || null);
          if (candidate.provider !== 'local' && !runtime.apiKey) {
            lastFailure = `Provider ${candidate.provider} is missing an API key`;
            continue;
          }

          const promptMessages = [
            systemPrompt,
            ...buildPromptMessagesForCandidate(resolvedMessages, placeholderContext, candidate),
          ];
          writeStreamEvent(res, 'meta', {
            model: candidate.model,
            provider: candidate.provider,
            imagesStripped: !modelSupportsImages(candidate.model) && resolvedMessages.some((message) => Array.isArray(message?.images) && message.images.length),
          });
          const response = await fetchBackend('/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
              model: candidate.model,
              messages: promptMessages,
              temperature: typeof effectiveTemperature === 'number' ? effectiveTemperature : 0.85,
              max_tokens: characterSettings.maxTokens,
              max_completion_tokens: characterSettings.maxTokens,
              top_p: 0.92,
              stream: true,
            }),
          }, appConfig.endpoints.requestTimeoutMs || 120000, candidate.provider, candidate.override || null);

          if (!response.ok) {
            const text = await response.text();
            lastFailure = `${candidate.provider}/${candidate.model}: ${text.slice(0, 500)}`;
            writeStreamEvent(res, 'retry', { detail: lastFailure });
            continue;
          }

          content = replaceCharacterPlaceholders(await readChatCompletionStream(response, (delta) => writeStreamEvent(res, 'delta', { delta: replaceCharacterPlaceholders(delta, placeholderContext) })), placeholderContext);
          if (content) break;

          // Some OpenAI-compatible RP providers occasionally return a 200 stream
          // with no usable deltas. Before surfacing "empty response" to the user,
          // retry the same model once in non-stream mode; that endpoint is often
          // more reliable and still lets the current request complete.
          lastFailure = `${candidate.provider}/${candidate.model}: empty streaming response; retrying non-stream`;
          writeStreamEvent(res, 'retry', { detail: lastFailure });
          const retryResponse = await fetchBackend('/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
              model: candidate.model,
              messages: promptMessages,
              temperature: typeof effectiveTemperature === 'number' ? effectiveTemperature : 0.85,
              max_tokens: characterSettings.maxTokens,
              max_completion_tokens: characterSettings.maxTokens,
              top_p: 0.92,
              stream: false,
            }),
          }, appConfig.endpoints.requestTimeoutMs || 120000, candidate.provider, candidate.override || null);

          if (!retryResponse.ok) {
            const retryText = await retryResponse.text();
            lastFailure = `${candidate.provider}/${candidate.model}: ${retryText.slice(0, 500)}`;
            writeStreamEvent(res, 'retry', { detail: lastFailure });
            continue;
          }

          const retryJson = await retryResponse.json().catch(() => ({}));
          content = replaceCharacterPlaceholders(retryJson?.choices?.[0]?.message?.content || retryJson?.choices?.[0]?.text || '', placeholderContext);
          if (content) {
            writeStreamEvent(res, 'delta', { delta: content });
            break;
          }
          lastFailure = `${candidate.provider}/${candidate.model}: empty response`;
        } catch (error) {
          lastFailure = `${candidate.provider}/${candidate.model}: ${String(error?.message || error)}`;
        }
      }

      if (!content) {
        writeStreamEvent(res, 'error', { error: 'Backend generation failed', detail: lastFailure || 'No configured providers/models returned a usable response', attemptedModels: candidateModels });
        return res.end();
      }

      if (conversationId) {
        const key = getConversationBucketKey(characterId, personaId);
        const list = userStore.conversations[key] || [];
        const conversation = list.find((item) => item.id === conversationId);
        if (conversation) {
          conversation.messages = [...resolvedMessages, { role: 'assistant', content }];
          conversation.preview = content.slice(0, 120) || conversation.preview;
          conversation.updatedAt = Date.now();
          userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          await saveStore(store);
        }
      }

      writeStreamEvent(res, 'done', { content, model: usedModel, provider: usedProvider, temperature: effectiveTemperature, attemptedModels: candidateModels });
      return res.end();
    }

    for (const candidate of candidateModels) {
      usedModel = candidate.model;
      usedProvider = candidate.provider;
      try {
        const runtime = getProviderRuntimeConfig(candidate.provider, appConfig, candidate.override || null);
        if (candidate.provider !== 'local' && !runtime.apiKey) {
          lastFailure = `Provider ${candidate.provider} is missing an API key`;
          continue;
        }

        const promptMessages = [
          systemPrompt,
          ...buildPromptMessagesForCandidate(resolvedMessages, placeholderContext, candidate),
        ];
        const response = await fetchBackend('/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            model: candidate.model,
            messages: promptMessages,
            temperature: typeof effectiveTemperature === 'number' ? effectiveTemperature : 0.85,
            max_tokens: characterSettings.maxTokens,
            max_completion_tokens: characterSettings.maxTokens,
            top_p: 0.92,
            stream: false,
          }),
        }, appConfig.endpoints.requestTimeoutMs || 120000, candidate.provider, candidate.override || null);

        if (!response.ok) {
          const text = await response.text();
          lastFailure = `${candidate.provider}/${candidate.model}: ${text.slice(0, 500)}`;
          continue;
        }

        json = await response.json();
        content = replaceCharacterPlaceholders(json?.choices?.[0]?.message?.content || '', placeholderContext);
        if (content) break;
        lastFailure = `${candidate.provider}/${candidate.model}: empty response`;
      } catch (error) {
        lastFailure = `${candidate.provider}/${candidate.model}: ${String(error?.message || error)}`;
      }
    }

    if (!content) {
      return res.status(502).json({ error: 'Backend generation failed', detail: lastFailure || 'No configured providers/models returned a usable response', backendReachable: false, attemptedModels: candidateModels });
    }

    if (conversationId) {
      const key = getConversationBucketKey(characterId, personaId);
      const list = userStore.conversations[key] || [];
      const conversation = list.find((item) => item.id === conversationId);
      if (conversation) {
        conversation.messages = [...resolvedMessages, { role: 'assistant', content }];
        conversation.preview = content.slice(0, 120) || conversation.preview;
        conversation.updatedAt = Date.now();
        userStore.conversations[key] = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        await saveStore(store);
      }
    }

    res.json({ content, raw: json, model: usedModel, provider: usedProvider, temperature: effectiveTemperature, attemptedModels: candidateModels });
  } catch (error) {
    res.status(503).json({ error: 'Backend unavailable', detail: String(error?.message || error), backendReachable: false });
  }
});

function sendCacheableAsset(res, filePath) {
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(filePath);
}

app.get(`${BASE_PATH}/assets/characters/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(CHARACTERS_DIR, file));
});

app.get(`${BASE_PATH}/assets/personas/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(PERSONAS_DIR, file));
});

app.get(`${BASE_PATH}/assets/local-characters/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(LOCAL_CHARACTER_ASSETS_DIR, file));
});

app.get(`${BASE_PATH}/assets/backgrounds/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(BACKGROUNDS_DIR, file));
});

app.get(`${BASE_PATH}/assets/message-images/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(MESSAGE_IMAGE_DIR, file));
});

app.get(`${BASE_PATH}/assets/replicate/:file`, requireAuth, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(REPLICATE_ASSET_DIR, file));
});

app.get(`${BASE_PATH}/public/replicate/:file`, (req, res) => {
  const file = path.basename(req.params.file);
  sendCacheableAsset(res, path.join(REPLICATE_ASSET_DIR, file));
});

app.use(BASE_PATH, (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static(path.join(process.cwd(), 'public')));
app.get(`${BASE_PATH}*`, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

ensureStore().then(async () => {
  await pruneAudioCache().catch(() => {});
  app.listen(PORT, () => {
    console.log(`AIChat MVP listening on ${PORT} with base path ${BASE_PATH}`);
  });
});
