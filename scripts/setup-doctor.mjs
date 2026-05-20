#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const fileEnv = parseEnvFile(ENV_PATH);
const env = { ...fileEnv, ...process.env };

const PORT = Number(env.PORT || 3000);
const BASE_PATH = env.BASE_PATH || '/aichat';
const BACKEND_BASE_URL = String(env.BACKEND_BASE_URL || '').replace(/\/$/, '');
const DEFAULT_MODEL = env.DEFAULT_MODEL || 'mistralai/mistral-nemo-instruct-2407';
const APP_DATA_DIR = path.resolve(ROOT, env.APP_DATA_DIR || './data');
const PUBLIC_APP_ORIGIN = env.PUBLIC_APP_ORIGIN || `http://localhost:${PORT}`;
const FISH_AUDIO_API_KEY = env.FISH_AUDIO_API_KEY || '';
const REPLICATE_API_TOKEN = env.REPLICATE_API_TOKEN || '';
const OPENCLAW_BRIDGE_SECRET = env.OPENCLAW_BRIDGE_SECRET || '';

const checks = [];
function add(ok, label, fix = '', level = ok ? 'ok' : 'warn') {
  checks.push({ ok: Boolean(ok), label, fix, level });
}

async function canWriteDir(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.nexus-doctor-${process.pid}-${Date.now()}`);
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function testBackend() {
  if (!BACKEND_BASE_URL) {
    add(false, 'Chat backend URL is missing.', 'Set BACKEND_BASE_URL to an OpenAI-compatible /v1 endpoint.', 'error');
    return;
  }
  add(true, `Chat backend URL: ${BACKEND_BASE_URL}`);
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/models`, { signal: AbortSignal.timeout(3500) });
    const text = await res.text();
    add(res.ok, `Chat backend /models responded with HTTP ${res.status}.`, 'Start your local model server or fix BACKEND_BASE_URL.', res.ok ? 'ok' : 'error');
    if (res.ok && DEFAULT_MODEL) {
      let found = false;
      try {
        const json = JSON.parse(text);
        const models = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
        found = models.some((item) => String(item?.id || item?.name || item) === DEFAULT_MODEL);
      } catch {}
      add(found, found ? `Default model appears available: ${DEFAULT_MODEL}` : `Default model was not found in /models: ${DEFAULT_MODEL}`, 'Choose an available model in admin Model & endpoint settings.', found ? 'ok' : 'warn');
    }
  } catch (error) {
    add(false, `Could not reach chat backend: ${error.message}`, 'Start LM Studio/Ollama/provider proxy, then run this again.', 'error');
  }
}

async function main() {
  console.log('NEXUS Setup Doctor\n');

  const major = Number(process.versions.node.split('.')[0] || 0);
  add(major >= 22, `Node.js ${process.versions.node}`, 'Install/use Node.js 22 or newer.', major >= 22 ? 'ok' : 'error');
  const hasPackage = fs.existsSync(path.join(ROOT, 'package.json'));
  add(hasPackage, 'package.json found.', 'Run this from the NEXUS/aichat project directory.', hasPackage ? 'ok' : 'error');
  add(fs.existsSync(ENV_PATH), '.env file found.', 'Copy .env.example to .env and edit the basics.');
  add(BASE_PATH.startsWith('/'), `BASE_PATH: ${BASE_PATH}`, 'Use BASE_PATH=/aichat for the default setup.');
  add(/^https?:\/\//i.test(PUBLIC_APP_ORIGIN), `PUBLIC_APP_ORIGIN: ${PUBLIC_APP_ORIGIN}`, 'Use a full URL, e.g. http://localhost:3000.');
  const dataWritable = await canWriteDir(APP_DATA_DIR);
  add(dataWritable, `APP_DATA_DIR writable: ${APP_DATA_DIR}`, 'Set APP_DATA_DIR to a writable path or fix permissions.', dataWritable ? 'ok' : 'error');
  add(Boolean(DEFAULT_MODEL), `DEFAULT_MODEL: ${DEFAULT_MODEL}`, 'Set DEFAULT_MODEL or choose one in the admin UI.');

  await testBackend();

  add(Boolean(FISH_AUDIO_API_KEY), FISH_AUDIO_API_KEY ? 'Fish Audio key configured.' : 'Fish Audio key missing. Voice is optional.', 'Set FISH_AUDIO_API_KEY only if you want manual TTS playback.', FISH_AUDIO_API_KEY ? 'ok' : 'info');
  add(Boolean(REPLICATE_API_TOKEN || env.OPENAI_API_KEY || env.OPENROUTER_API_KEY), (REPLICATE_API_TOKEN || env.OPENAI_API_KEY || env.OPENROUTER_API_KEY) ? 'At least one image provider key configured.' : 'No image provider key configured. Image generation is optional.', 'Add REPLICATE_API_TOKEN, OPENAI_API_KEY, or OPENROUTER_API_KEY only if you want image generation.', (REPLICATE_API_TOKEN || env.OPENAI_API_KEY || env.OPENROUTER_API_KEY) ? 'ok' : 'info');
  add(Boolean(OPENCLAW_BRIDGE_SECRET), OPENCLAW_BRIDGE_SECRET ? 'OpenClaw bridge secret configured.' : 'OpenClaw bridge missing. Optional unless using OpenClaw assistant characters.', 'Set OPENCLAW_BRIDGE_SECRET only if using the bridge.', OPENCLAW_BRIDGE_SECRET ? 'ok' : 'info');

  let errors = 0;
  let warnings = 0;
  for (const check of checks) {
    const icon = check.level === 'error' ? '❌' : check.level === 'warn' ? '⚠️ ' : check.level === 'info' ? 'ℹ️ ' : '✅';
    if (check.level === 'error') errors += 1;
    if (check.level === 'warn') warnings += 1;
    console.log(`${icon} ${check.label}`);
    if (!check.ok && check.fix) console.log(`   Fix: ${check.fix}`);
  }

  console.log('\nResult:');
  if (errors) {
    console.log(`❌ ${errors} blocking issue${errors === 1 ? '' : 's'} found. Fix those before blaming the app, gremlin.`);
    process.exitCode = 1;
  } else if (warnings) {
    console.log(`⚠️  Setup can run, but ${warnings} item${warnings === 1 ? '' : 's'} need attention.`);
  } else {
    console.log('✅ Setup looks ready. Open the app and cause problems on purpose.');
  }
}

main().catch((error) => {
  console.error('Setup doctor failed:', error);
  process.exit(1);
});
