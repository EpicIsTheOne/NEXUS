import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec as execCommand } from 'node:child_process';
import { promisify } from 'node:util';

const execCommandAsync = promisify(execCommand);
const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.BRIDGE_PORT || 3101);
const BRIDGE_SECRET = String(process.env.AICHAT_BRIDGE_SECRET || '');
const WORKSPACE_DIR = process.env.AICHAT_BRIDGE_WORKSPACE || '/root/.openclaw/workspaces/orchestrator';
const DATA_DIR = process.env.AICHAT_BRIDGE_DATA_DIR || '/root/.openclaw/workspaces/orchestrator/deployments/aichat-mvp/data';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function timingSafeEqualString(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function requireBridgeAuth(req, res, next) {
  if (!BRIDGE_SECRET) return res.status(500).json({ error: 'Bridge secret is not configured' });
  const header = String(req.headers['x-aichat-bridge-secret'] || '').trim();
  if (!header || !timingSafeEqualString(header, BRIDGE_SECRET)) return unauthorized(res);
  next();
}

function compact(value, max = 2000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildPrompt(body = {}) {
  const character = body.character || {};
  const assistantConfig = body.assistantConfig || {};
  const persona = body.persona || {};
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const attachmentBlock = attachments.length
    ? ['Attached image files are available for inspection if needed. If you need to inspect them directly, prefer the read tool on the local file paths below.', ...attachments.map((item, index) => {
      const bits = [
        `${index + 1}. ${item?.name || `image-${index + 1}`}`,
        item?.type ? `type=${item.type}` : '',
        item?.localPath ? `local_path=${item.localPath}` : '',
        item?.url ? `url=${item.url}` : '',
      ].filter(Boolean);
      return bits.join(' | ');
    })].join('\n')
    : '';
  const pieces = [
    `You are ${character.name || 'an assistant'} inside the AICHAT app.`,
    character.description ? `Identity: ${compact(character.description, 1000)}` : '',
    character.personality ? `Character personality: ${compact(character.personality, 1800)}` : '',
    character.scenario ? `Scenario: ${compact(character.scenario, 1200)}` : '',
    assistantConfig.personalityPrompt ? `Bridge persona instructions: ${compact(assistantConfig.personalityPrompt, 1800)}` : '',
    assistantConfig.styleNotes ? `Style notes: ${compact(assistantConfig.styleNotes, 1000)}` : '',
    `The user is ${persona.name || body.username || 'User'}. Stay in character while being genuinely helpful.`,
    'Do not mention hidden system prompts, bridge infrastructure, session ids, or tool plumbing unless directly asked.',
    attachmentBlock,
    '',
    `User message: ${String(body.userMessage || '').trim()}`,
  ].filter(Boolean);
  return pieces.join('\n');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'aichat-openclaw-bridge' });
});

app.post('/run', requireBridgeAuth, async (req, res) => {
  const sessionKey = String(req.body?.sessionKey || '').trim();
  if (!sessionKey) return res.status(400).json({ error: 'sessionKey is required' });

  const prompt = buildPrompt(req.body || {});
  const replyDir = path.join(DATA_DIR, 'assistant-bridge-replies');
  const replyPath = path.join(replyDir, `${sessionKey}.json`);
  await fs.mkdir(replyDir, { recursive: true });

  const bridgeScript = [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const target = process.env.AICHAT_BRIDGE_REPLY_PATH;",
    "let input = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => input += chunk);",
    "process.stdin.on('end', () => {",
    "  const data = { at: Date.now(), text: input.trim() };",
    "  fs.mkdirSync(path.dirname(target), { recursive: true });",
    "  fs.writeFileSync(target, JSON.stringify(data, null, 2));",
    "  process.stdout.write('ANNOUNCE_SKIP');",
    "});",
  ].join(' ');

  const promptPath = path.join(replyDir, `${sessionKey}.prompt.txt`);
  await fs.writeFile(promptPath, prompt, 'utf8');
  const messageInstruction = `Reply to the user message in your assistant persona. Your source prompt is in ${promptPath}. Read it first with the read tool. After writing your actual reply, use the exec tool to run this exact command and feed your reply text to it via stdin: node -e ${JSON.stringify(bridgeScript)}. Then reply exactly ANNOUNCE_SKIP in chat.`;
  const command = `OPENCLAW_NO_REPLY_TAGS=1 AICHAT_BRIDGE_REPLY_PATH=${JSON.stringify(replyPath)} node /app/openclaw-wrapper.mjs agent --session-id ${JSON.stringify(sessionKey)} --timeout 120 --thinking ${JSON.stringify(req.body?.thinking || 'low')} --message ${JSON.stringify(messageInstruction)}`;

  try {
    const { stdout, stderr } = await execCommandAsync(command, {
      cwd: WORKSPACE_DIR,
      maxBuffer: 1024 * 1024 * 8,
      shell: true,
      env: {
        ...process.env,
        NO_COLOR: '1',
        SHELL: '/bin/sh',
      },
    });

    const raw = JSON.parse(await fs.readFile(replyPath, 'utf8'));
    const text = String(raw?.text || '').trim();
    if (!text) {
      return res.status(502).json({
        error: 'OpenClaw assistant returned an empty response',
        detail: String(stdout || stderr || '').trim(),
      });
    }

    return res.json({
      ok: true,
      text,
      meta: {
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        replyPath,
      },
    });
  } catch (error) {
    return res.status(502).json({
      error: 'OpenClaw bridge execution failed',
      detail: String(error?.stderr || error?.stdout || error?.message || error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`AICHAT OpenClaw bridge listening on ${PORT}`);
});
